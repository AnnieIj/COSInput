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
} from './types';

export function classifyGitHubError(statusCode: number, rawMessage = '', headers?: Headers): SanitizedGitHubError {
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

  return {
    classification,
    statusCode,
    message: rawMessage || `GitHub API request failed with status ${statusCode}`,
    retryAfterSeconds: isNaN(retryAfterSeconds as number) ? undefined : retryAfterSeconds,
  };
}

export class GitHubServerClient {
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
    let token = customToken;
    if (!token && installationId) {
      try {
        token = await getInstallationAccessToken(installationId);
      } catch {
        // Continue even if installation token fails; will try unauthenticated if public
      }
    }

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
      throw classifyGitHubError(response.status, String(errorText), response.headers);
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
    let token = customToken;
    if (!token && installationId) {
      try {
        token = await getInstallationAccessToken(installationId);
      } catch {
        // Fallback
      }
    }

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
      throw classifyGitHubError(response.status, String(errorText), response.headers);
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
    let token = customToken;
    if (!token && installationId) {
      try {
        token = await getInstallationAccessToken(installationId);
      } catch {
        // Fall back to unauthenticated public request
      }
    }

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
      throw classifyGitHubError(response.status, String(errorText), response.headers);
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
    let token = customToken;
    if (!token && installationId) {
      try {
        token = await getInstallationAccessToken(installationId);
      } catch {
        // Fall back
      }
    }

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
      throw classifyGitHubError(response.status, String(errorText), response.headers);
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
    let token = customToken;
    if (!token && installationId) {
      try {
        token = await getInstallationAccessToken(installationId);
      } catch {
        // Fall back
      }
    }

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
      throw classifyGitHubError(response.status, String(errorText), response.headers);
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
  ) {
    let token = customToken;
    if (!token && installationId) {
      try {
        token = await getInstallationAccessToken(installationId);
      } catch {
        // Fall back
      }
    }

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
      throw classifyGitHubError(response.status, String(errorText), response.headers);
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
    };
  }
}

export const githubServerClient = new GitHubServerClient();
