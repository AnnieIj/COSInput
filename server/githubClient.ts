/**
 * COSInput - Real GitHub API Client (Server-Side Proxy Boundary)
 * Handles authenticated communication with GitHub REST API via GitHub App installation tokens.
 * Enforces strict read-only boundaries, error classification, sanitization, and single-read body handling.
 */

import { generateAppJWT, getInstallationAccessToken } from './githubAppAuth';
import { getGitHubAppConfig } from './config';
import { safeParseResponse } from './responseUtils';
import type {
  GitHubConnectionState,
  SanitizedGitHubError,
  GitHubErrorClassification,
  GitHubInstallationSummary,
  ContributorForkInfo,
} from './types';

export function classifyGitHubError(
  statusCode: number,
  rawMessage = '',
  headers?: Headers,
  endpointCategory?: SanitizedGitHubError['endpointCategory']
): SanitizedGitHubError {
  let classification: GitHubErrorClassification = 'GITHUB_SERVICE_FAILURE';

  if (statusCode === 401) {
    classification = 'AUTHENTICATION_FAILURE';
  } else if (statusCode === 403) {
    const rateLimitRemaining = headers?.get('x-ratelimit-remaining');
    if (rateLimitRemaining === '0' || rawMessage.toLowerCase().includes('rate limit')) {
      classification = 'RATE_LIMIT';
    } else {
      classification = 'AUTHORIZATION_FAILURE';
    }
  } else if (statusCode === 429) {
    classification = 'RATE_LIMIT';
  } else if (statusCode === 404) {
    classification = 'NOT_FOUND';
  } else if (statusCode >= 500) {
    classification = 'GITHUB_SERVICE_FAILURE';
  }

  // Parse retry-after if provided
  const retryAfterHeader = headers?.get('retry-after');
  const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
  const responseContentType = headers?.get('content-type') || undefined;

  return {
    classification,
    statusCode,
    message: rawMessage || `GitHub API request failed with status ${statusCode}`,
    endpointCategory,
    responseContentType,
    retryAfterSeconds: isNaN(retryAfterSeconds as number) ? undefined : retryAfterSeconds,
  };
}

export class GitHubServerClient {
  /**
   * Resolves the effective token for GitHub API operations.
   * Priority:
   * 1. customToken (e.g. user OAuth token)
   * 2. installationId (specific installation token)
   * 3. Configured GitHub App active installation token (for public repo read access with 5,000 req/hr rate limits)
   * 4. undefined (unauthenticated public read fallback)
   */
  async getEffectiveToken(
    installationId?: number | null,
    customToken?: string
  ): Promise<string | undefined> {
    if (customToken) {
      return customToken;
    }
    if (installationId) {
      try {
        const token = await getInstallationAccessToken(installationId);
        if (token) return token;
      } catch {
        // Fall back to any active installation
      }
    }

    // Public repository inspection:
    // If the GitHub App is configured, use an active installation token to authenticate
    // read requests across public GitHub repositories without requiring upstream installation.
    try {
      const config = getGitHubAppConfig();
      if (config.isConfigured && !config.keyError) {
        const installations = await this.listInstallations();
        const active = installations.find((i) => !i.suspendedAt);
        if (active) {
          const token = await getInstallationAccessToken(active.id);
          if (token) return token;
        }
      }
    } catch {
      // Fall back to unauthenticated
    }

    return undefined;
  }

  /**
   * Evaluates current system connection status with GitHub App credentials.
   */
  async getConnectionStatus(): Promise<{
    configured: boolean;
    state: GitHubConnectionState;
    installationsCount: number;
    appSlug: string | null;
    activeInstallation: GitHubInstallationSummary | null;
    error?: SanitizedGitHubError;
  }> {
    const config = getGitHubAppConfig();

    // If private key parsing or validation failed, return sanitized AUTHENTICATION_FAILURE
    if (config.keyError) {
      return {
        configured: Boolean(config.appId),
        state: 'AUTH_FAILED',
        installationsCount: 0,
        appSlug: config.appSlug,
        activeInstallation: null,
        error: config.keyError,
      };
    }

    if (!config.isConfigured) {
      return {
        configured: false,
        state: 'NOT_CONNECTED',
        installationsCount: 0,
        appSlug: config.appSlug,
        activeInstallation: null,
      };
    }

    try {
      const jwt = generateAppJWT();
      const response = await fetch('https://api.github.com/app', {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'COSInput-Server/0.3',
        },
      });

      const parsed = await safeParseResponse<any>(response);
      if (!response.ok) {
        const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) ? String(parsed.json.message || parsed.json.error) : parsed.text;
        const classified = classifyGitHubError(response.status, errorText, response.headers);
        return {
          configured: true,
          state: classified.classification === 'AUTHENTICATION_FAILURE' ? 'AUTH_FAILED' : 'API_UNAVAILABLE',
          installationsCount: 0,
          appSlug: config.appSlug,
          activeInstallation: null,
          error: classified,
        };
      }

      // App is valid, now fetch installations
      const installations = await this.listInstallations();
      if (installations.length === 0) {
        return {
          configured: true,
          state: 'APP_NOT_INSTALLED',
          installationsCount: 0,
          appSlug: config.appSlug,
          activeInstallation: null,
        };
      }

      const active = installations[0];
      if (active.suspendedAt) {
        return {
          configured: true,
          state: 'INSTALLATION_REVOKED',
          installationsCount: installations.length,
          appSlug: config.appSlug,
          activeInstallation: active,
        };
      }

      return {
        configured: true,
        state: 'APP_INSTALLED',
        installationsCount: installations.length,
        appSlug: config.appSlug,
        activeInstallation: active,
      };
    } catch (err: any) {
      if (err && err.classification === 'AUTHENTICATION_FAILURE') {
        return {
          configured: true,
          state: 'AUTH_FAILED',
          installationsCount: 0,
          appSlug: config.appSlug,
          activeInstallation: null,
          error: err,
        };
      }
      return {
        configured: true,
        state: 'API_UNAVAILABLE',
        installationsCount: 0,
        appSlug: config.appSlug,
        activeInstallation: null,
        error: {
          classification: 'NETWORK_FAILURE',
          statusCode: 0,
          message: err?.message || 'Unable to connect to GitHub API endpoint.',
        },
      };
    }
  }

  /**
   * Lists GitHub App installations.
   */
  async listInstallations(): Promise<GitHubInstallationSummary[]> {
    const jwt = generateAppJWT();
    const response = await fetch('https://api.github.com/app/installations', {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'COSInput-Server/0.3',
      },
    });

    const parsed = await safeParseResponse<any[]>(response);
    if (!response.ok) {
      const errorText = (parsed.json && ((parsed.json as any).message || (parsed.json as any).error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers);
    }

    const data = Array.isArray(parsed.json) ? parsed.json : [];
    return data.map((item) => ({
      id: item.id,
      accountLogin: item.account?.login || 'unknown',
      accountAvatarUrl: item.account?.avatar_url || '',
      accountType: item.account?.type === 'Organization' ? 'Organization' : 'User',
      repositorySelection: item.repository_selection || 'all',
      suspendedAt: item.suspended_at || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  }

  /**
   * Lists repositories accessible to the installation.
   */
  async listInstallationRepositories(installationId: number) {
    const token = await getInstallationAccessToken(installationId);
    const response = await fetch('https://api.github.com/installation/repositories?per_page=100', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'COSInput-Server/0.3',
      },
    });

    const parsed = await safeParseResponse<{ total_count: number; repositories: any[] }>(response);
    if (!response.ok) {
      const errorText = (parsed.json && ((parsed.json as any).message || (parsed.json as any).error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers);
    }

    const data = parsed.json || { total_count: 0, repositories: [] };
    const repoList = Array.isArray(data.repositories) ? data.repositories : [];
    return {
      totalCount: data.total_count || repoList.length,
      repositories: repoList.map((repo) => ({
        id: String(repo.id),
        owner: repo.owner?.login || '',
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        isPrivate: Boolean(repo.private),
        defaultBranch: repo.default_branch || 'main',
        openIssuesCount: repo.open_issues_count || 0,
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        updatedAt: repo.updated_at,
        htmlUrl: repo.html_url,
        permissions: repo.permissions || {},
      })),
    };
  }

  /**
   * Lists real repository issues (strictly excluding pull requests).
   */
  async listRepositoryIssues(
    installationId: number,
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all'; labels?: string } = {}
  ) {
    const token = await getInstallationAccessToken(installationId);
    const params = new URLSearchParams();
    params.set('state', options.state || 'open');
    params.set('per_page', '50');
    if (options.labels) {
      params.set('labels', options.labels);
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'COSInput-Server/0.3',
        },
      }
    );

    const parsed = await safeParseResponse<any[]>(response);
    if (!response.ok) {
      const errorText = (parsed.json && ((parsed.json as any).message || (parsed.json as any).error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers);
    }

    const data = Array.isArray(parsed.json) ? parsed.json : [];

    // CRITICAL: Filter out pull requests returned by the GitHub /issues endpoint!
    const realIssues = data.filter((item) => !item.pull_request);

    return realIssues.map((item) => ({
      id: String(item.id),
      number: item.number,
      repository: `${owner}/${repo}`,
      title: item.title,
      body: item.body || '',
      state: item.state as 'open' | 'closed',
      author: item.user?.login || 'unknown',
      authorAvatarUrl: item.user?.avatar_url || '',
      labels: (item.labels || []).map((l: any) => ({
        name: typeof l === 'string' ? l : l.name,
        color: typeof l === 'string' ? 'bg-surface-container' : `#${l.color}`,
        description: l.description,
      })),
      assignees: (item.assignees || []).map((a: any) => a.login),
      commentsCount: item.comments || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      closedAt: item.closed_at,
      htmlUrl: item.html_url,
    }));
  }

  /**
   * Retrieves single issue details.
   */
  async getIssue(installationId: number | null | undefined, owner: string, repo: string, issueNumber: number, customToken?: string) {
    const token = await this.getEffectiveToken(installationId, customToken);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      { headers }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'issue_payload');
    }

    const item = parsed.json || {};
    if (item.pull_request) {
      throw {
        classification: 'NOT_FOUND',
        statusCode: 404,
        message: `#${issueNumber} is a Pull Request, not an ordinary issue.`,
      };
    }

    return {
      id: String(item.id),
      number: item.number,
      repository: `${owner}/${repo}`,
      title: item.title,
      body: item.body || '',
      state: item.state as 'open' | 'closed',
      author: item.user?.login || 'unknown',
      authorAvatarUrl: item.user?.avatar_url || '',
      labels: (item.labels || []).map((l: any) => ({
        name: typeof l === 'string' ? l : l.name,
        color: typeof l === 'string' ? 'bg-surface-container' : `#${l.color}`,
        description: l.description,
      })),
      assignees: (item.assignees || []).map((a: any) => a.login),
      commentsCount: item.comments || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      closedAt: item.closed_at,
      htmlUrl: item.html_url,
    };
  }

  /**
   * Retrieves comments on an issue.
   */
  async listIssueComments(installationId: number | null | undefined, owner: string, repo: string, issueNumber: number, customToken?: string) {
    const token = await this.getEffectiveToken(installationId, customToken);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=50`,
      { headers }
    );

    const parsed = await safeParseResponse<any[]>(response);
    if (!response.ok) {
      const errorText = (parsed.json && ((parsed.json as any).message || (parsed.json as any).error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'issue_payload');
    }

    const data = Array.isArray(parsed.json) ? parsed.json : [];
    return data.map((c) => ({
      id: String(c.id),
      author: c.user?.login || 'unknown',
      authorAvatarUrl: c.user?.avatar_url || '',
      body: c.body || '',
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      htmlUrl: c.html_url,
    }));
  }

  /**
   * Read-only repository content inspector (single file).
   * Works for both GitHub App installed repos and public uninstalled repositories.
   */
  async getFileContent(
    installationId: number | null | undefined,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    customToken?: string
  ) {
    const token = await this.getEffectiveToken(installationId, customToken);

    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    if (ref) url.searchParams.set('ref', ref);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), { headers });
    const parsed = await safeParseResponse<any>(response);

    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'source_file');
    }

    const data = parsed.json;
    if (!data || data.type !== 'file') {
      throw {
        classification: 'NOT_FOUND',
        statusCode: 400,
        message: `Path '${path}' is not a file.`,
      };
    }

    let decodedContent = '';
    if (data.content && data.encoding === 'base64') {
      decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
    }

    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      content: decodedContent,
    };
  }

  /**
   * Read-only directory listing.
   * Works for both GitHub App installed repos and public uninstalled repositories.
   */
  async getDirectoryContents(
    installationId: number | null | undefined,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    customToken?: string
  ) {
    const token = await this.getEffectiveToken(installationId, customToken);

    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    if (ref) url.searchParams.set('ref', ref);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), { headers });
    const parsed = await safeParseResponse<any>(response);

    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'source_file');
    }

    const data = parsed.json;
    if (!Array.isArray(data)) {
      throw {
        classification: 'NOT_FOUND',
        statusCode: 400,
        message: `Path '${path}' is not a directory.`,
      };
    }

    return data.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
      type: item.type, // 'file' | 'dir'
    }));
  }

  /**
   * Read-only repository metadata inspector.
   */
  async getRepositoryDetails(
    installationId: number | null | undefined,
    owner: string,
    repo: string,
    customToken?: string
  ) {
    const token = await this.getEffectiveToken(installationId, customToken);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    const parsed = await safeParseResponse<any>(response);

    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'repository_metadata');
    }

    const data = parsed.json || {};
    return {
      id: String(data.id || ''),
      owner: data.owner?.login || owner,
      name: data.name || repo,
      fullName: data.full_name || `${owner}/${repo}`,
      description: data.description || '',
      isPrivate: Boolean(data.private),
      defaultBranch: data.default_branch || 'main',
      openIssuesCount: data.open_issues_count || 0,
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      updatedAt: data.updated_at || new Date().toISOString(),
      htmlUrl: data.html_url || `https://github.com/${owner}/${repo}`,
      language: data.language || '',
      permissions: data.permissions || {},
    };
  }

  /**
   * Retrieves the repository git tree recursively.
   */
  async getRepositoryTree(
    installationId: number | null | undefined,
    owner: string,
    repo: string,
    branch: string = 'main',
    customToken?: string
  ): Promise<{
    sha: string;
    truncated: boolean;
    tree: { path: string; mode: string; type: 'blob' | 'tree'; sha: string; size?: number }[];
    isEmptyRepository?: boolean;
  }> {
    const token = await this.getEffectiveToken(installationId, customToken);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      // Differentiate genuine empty repositories from failed retrieval:
      // When a repository is legitimately empty (0 commits/branches), GitHub returns 409 Conflict with "Git Repository is empty."
      if (response.status === 409 || String(errorText).toLowerCase().includes('git repository is empty')) {
        return {
          sha: '',
          truncated: false,
          tree: [],
          isEmptyRepository: true,
        };
      }
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'git_tree');
    }

    const data = parsed.json || {};
    const tree = Array.isArray(data.tree) ? data.tree : [];
    return {
      sha: data.sha || '',
      truncated: Boolean(data.truncated),
      tree: tree.map((item: any) => ({
        path: item.path,
        mode: item.mode,
        type: item.type as 'blob' | 'tree',
        sha: item.sha,
        size: item.size,
      })),
      isEmptyRepository: false,
    };
  }

  /**
   * Retrieves branch details from a repository, including head commit SHA.
   */
  async getBranch(
    owner: string,
    repo: string,
    branch: string,
    customToken?: string
  ): Promise<{ name: string; commitSha: string; protected: boolean }> {
    const token = await this.getEffectiveToken(null, customToken);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.1',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
      { headers }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'repository_metadata');
    }

    const data = parsed.json || {};
    return {
      name: data.name || branch,
      commitSha: data.commit?.sha || '',
      protected: Boolean(data.protected),
    };
  }

  /**
   * Discovers whether a contributor already owns a verified fork of an upstream repository.
   * Validates the upstream parent relationship before returning.
   */
  async getFork(
    upstreamOwner: string,
    upstreamRepo: string,
    contributorLogin: string,
    customToken?: string
  ): Promise<ContributorForkInfo | null> {
    const token = await this.getEffectiveToken(null, customToken);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.1',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const canonicalUpstream = `${upstreamOwner}/${upstreamRepo}`.toLowerCase();

    // 1. Direct probe of contributor's personal repository with same name
    try {
      const directRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(contributorLogin)}/${encodeURIComponent(upstreamRepo)}`,
        { headers }
      );

      const parsed = await safeParseResponse<any>(directRes);
      if (directRes.status === 403 || directRes.status === 429) {
        const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
        const err = classifyGitHubError(directRes.status, String(errorText), directRes.headers, 'other');
        if (err.classification === 'RATE_LIMIT') {
          throw err;
        }
      }
      if (directRes.ok && parsed.json) {
        const data = parsed.json;
        const parentFull = (data.parent?.full_name || '').toLowerCase();
        const sourceFull = (data.source?.full_name || '').toLowerCase();

        // Validate upstream relationship
        if (data.fork && (parentFull === canonicalUpstream || sourceFull === canonicalUpstream)) {
          return {
            owner: data.owner?.login || contributorLogin,
            name: data.name,
            fullName: data.full_name,
            htmlUrl: data.html_url,
            defaultBranch: data.default_branch || 'main',
            isFork: true,
            parentFullName: data.parent?.full_name || `${upstreamOwner}/${upstreamRepo}`,
            hasWritePermission: Boolean(data.permissions?.push || data.permissions?.admin),
          };
        }
      }
    } catch (err: any) {
      if (err?.classification === 'RATE_LIMIT') {
        throw err;
      }
      // Continue to secondary probe
    }

    // 2. Query upstream repository's forks list to discover contributor-owned forks
    try {
      const forksRes = await fetch(
        `https://api.github.com/repos/${upstreamOwner}/${upstreamRepo}/forks?per_page=100`,
        { headers }
      );

      const parsed = await safeParseResponse<any>(forksRes);
      if (forksRes.status === 403 || forksRes.status === 429) {
        const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
        const err = classifyGitHubError(forksRes.status, String(errorText), forksRes.headers, 'other');
        if (err.classification === 'RATE_LIMIT') {
          throw err;
        }
      }
      if (forksRes.ok && Array.isArray(parsed.json)) {
        const matchingFork = parsed.json.find(
          (f) => (f.owner?.login || '').toLowerCase() === contributorLogin.toLowerCase()
        );
        if (matchingFork) {
          return {
            owner: matchingFork.owner?.login || contributorLogin,
            name: matchingFork.name,
            fullName: matchingFork.full_name,
            htmlUrl: matchingFork.html_url,
            defaultBranch: matchingFork.default_branch || 'main',
            isFork: true,
            parentFullName: `${upstreamOwner}/${upstreamRepo}`,
            hasWritePermission: Boolean(matchingFork.permissions?.push || matchingFork.permissions?.admin),
          };
        }
      }
    } catch (err: any) {
      if (err?.classification === 'RATE_LIMIT') {
        throw err;
      }
      // Fall through to null
    }

    return null;
  }

  /**
   * Creates a fork of an upstream repository under the contributor's account.
   * Requires a valid contributor user token with write permissions.
   * Never overwrites an existing fork.
   */
  async createFork(
    upstreamOwner: string,
    upstreamRepo: string,
    userToken: string
  ): Promise<ContributorForkInfo> {
    if (!userToken) {
      throw classifyGitHubError(
        401,
        'Contributor write authorization token is required to create a fork.',
        undefined,
        'installation'
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.1',
    };

    const response = await fetch(
      `https://api.github.com/repos/${upstreamOwner}/${upstreamRepo}/forks`,
      {
        method: 'POST',
        headers,
      }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok && response.status !== 202) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'installation');
    }

    const data = parsed.json || {};
    return {
      owner: data.owner?.login || '',
      name: data.name || upstreamRepo,
      fullName: data.full_name || `${data.owner?.login || ''}/${upstreamRepo}`,
      htmlUrl: data.html_url || `https://github.com/${data.owner?.login || ''}/${upstreamRepo}`,
      defaultBranch: data.default_branch || 'main',
      isFork: true,
      parentFullName: `${upstreamOwner}/${upstreamRepo}`,
      hasWritePermission: true,
    };
  }

  /**
   * Creates an isolated issue branch on a contributor fork.
   * Never overwrites, resets, or force-pushes an existing branch.
   */
  async createBranch(
    forkOwner: string,
    forkRepo: string,
    branchName: string,
    commitSha: string,
    userToken: string
  ): Promise<{ ref: string; sha: string; created: boolean }> {
    if (!userToken) {
      throw classifyGitHubError(
        401,
        'Contributor write authorization token is required to create a branch on the fork.',
        undefined,
        'source_file'
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.1',
    };

    const response = await fetch(
      `https://api.github.com/repos/${forkOwner}/${forkRepo}/git/refs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: commitSha,
        }),
      }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'source_file');
    }

    const data = parsed.json || {};
    return {
      ref: data.ref || `refs/heads/${branchName}`,
      sha: data.object?.sha || commitSha,
      created: true,
    };
  }

  /**
   * Compares two commits / references on a repository.
   * Useful to detect divergence, ahead/behind status, and changed files.
   */
  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string,
    userToken?: string
  ): Promise<{
    status: 'ahead' | 'behind' | 'diverged' | 'identical';
    aheadBy: number;
    behindBy: number;
    totalCommits: number;
    files: Array<{ filename: string; status: string; additions: number; deletions: number }>;
    mergeBaseCommitSha?: string;
  }> {
    const token = await this.getEffectiveToken(undefined, userToken);
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
      { headers }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'other');
    }

    const data = parsed.json || {};
    return {
      status: data.status || 'identical',
      aheadBy: data.ahead_by || 0,
      behindBy: data.behind_by || 0,
      totalCommits: data.total_commits || 0,
      files: (data.files || []).map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
      mergeBaseCommitSha: data.merge_base_commit?.sha,
    };
  }

  /**
   * Lists pull requests on a repository with optional filtering by head or base.
   */
  async listPullRequests(
    owner: string,
    repo: string,
    options?: { head?: string; base?: string; state?: 'open' | 'closed' | 'all' },
    userToken?: string
  ): Promise<
    Array<{
      id: number;
      number: number;
      title: string;
      body: string;
      state: string;
      htmlUrl: string;
      head: { ref: string; sha: string; label: string };
      base: { ref: string; sha: string };
      createdAt: string;
      updatedAt: string;
      draft: boolean;
    }>
  > {
    const token = await this.getEffectiveToken(undefined, userToken);
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.3',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const params = new URLSearchParams();
    if (options?.state) params.set('state', options.state);
    if (options?.head) params.set('head', options.head);
    if (options?.base) params.set('base', options.base);
    params.set('per_page', '50');

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?${params.toString()}`,
      { headers }
    );

    const parsed = await safeParseResponse<any[]>(response);
    if (!response.ok) {
      const errorText = (parsed.json && ((parsed.json as any).message || (parsed.json as any).error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'other');
    }

    const data = Array.isArray(parsed.json) ? parsed.json : [];
    return data.map((pr: any) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      htmlUrl: pr.html_url,
      head: {
        ref: pr.head?.ref || '',
        sha: pr.head?.sha || '',
        label: pr.head?.label || '',
      },
      base: {
        ref: pr.base?.ref || '',
        sha: pr.base?.sha || '',
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      draft: Boolean(pr.draft),
    }));
  }

  /**
   * Creates a pull request targeting the canonical upstream repository.
   * Requires contributor write authorization.
   * Strictly verifies that target repository matches canonical upstream.
   */
  async createPullRequest(
    upstreamOwner: string,
    upstreamRepo: string,
    data: {
      title: string;
      body: string;
      head: string;
      base: string;
      draft?: boolean;
    },
    userToken: string
  ): Promise<{
    id: number;
    number: number;
    htmlUrl: string;
    title: string;
    state: string;
    createdAt: string;
    head: string;
    base: string;
  }> {
    if (!userToken) {
      throw classifyGitHubError(
        401,
        'Contributor write authorization token is required to open a pull request.',
        undefined,
        'other'
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.3',
    };

    const response = await fetch(
      `https://api.github.com/repos/${upstreamOwner}/${upstreamRepo}/pulls`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: data.title,
          body: data.body,
          head: data.head,
          base: data.base,
          draft: Boolean(data.draft),
        }),
      }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'other');
    }

    const pr = parsed.json || {};
    return {
      id: pr.id,
      number: pr.number,
      htmlUrl: pr.html_url,
      title: pr.title,
      state: pr.state || 'open',
      createdAt: pr.created_at || new Date().toISOString(),
      head: pr.head?.label || data.head,
      base: pr.base?.ref || data.base,
    };
  }

  /**
   * Updates a Git branch reference on the contributor fork.
   * NEVER force-pushes: force must remain false.
   */
  async updateBranchRef(
    forkOwner: string,
    forkRepo: string,
    branchName: string,
    sha: string,
    force: boolean,
    userToken: string
  ): Promise<{ ref: string; sha: string; updated: boolean }> {
    if (!userToken) {
      throw classifyGitHubError(
        401,
        'Contributor write authorization token is required to update branch reference.',
        undefined,
        'source_file'
      );
    }

    // Force push strictly prohibited in COSInput
    if (force) {
      throw classifyGitHubError(
        400,
        'Force pushing is strictly prohibited by COSInput invariant safety rules.',
        undefined,
        'source_file'
      );
    }

    const cleanBranch = branchName.replace(/^refs\/heads\//, '');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${userToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.4.3',
    };

    const response = await fetch(
      `https://api.github.com/repos/${forkOwner}/${forkRepo}/git/refs/heads/${cleanBranch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha,
          force: false,
        }),
      }
    );

    const parsed = await safeParseResponse<any>(response);
    if (!response.ok) {
      const errorText = (parsed.json && (parsed.json.message || parsed.json.error)) || parsed.text;
      throw classifyGitHubError(response.status, String(errorText), response.headers, 'source_file');
    }

    const data = parsed.json || {};
    return {
      ref: data.ref || `refs/heads/${cleanBranch}`,
      sha: data.object?.sha || sha,
      updated: true,
    };
  }
}

export const githubServerClient = new GitHubServerClient();

