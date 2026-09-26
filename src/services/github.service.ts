/**
 * COSInput - Real GitHub Service Boundary
 * Communicates with the COSInput backend proxy (/api/github/*) to interact with the GitHub App.
 * Strictly read-only for repository contents during Foundation v0.2.
 */

import type {
  GitHubUser,
  GitHubRepoSummary,
  GitHubIssueRef,
  GitHubAssignedIssueRef,
  AssignmentSyncResult,
  GitHubIssueCommentRef,
  GitHubFileContent,
  GitHubDirectoryItem,
  GitHubPRRef,
  GitHubConnectionState,
  SanitizedGitHubError,
} from './types';

export interface IGitHubService {
  getConnectionStatus(): Promise<{
    configured: boolean;
    state: GitHubConnectionState;
    installationsCount: number;
    appSlug: string | null;
    activeInstallation?: any;
    error?: SanitizedGitHubError;
  }>;
  getAuthUrl(): Promise<{ installationUrl: string; appSlug: string }>;
  getAuthenticatedUser(): Promise<GitHubUser | null>;
  syncAssignments(username?: string): Promise<AssignmentSyncResult>;
  getAssignments(): Promise<AssignmentSyncResult>;
  getUserMe(): Promise<{ authenticated: boolean; user: any }>;
  getUserAuthUrl(redirectUri?: string): Promise<{ authUrl: string; state: string }>;
  connectUserByUsername(username: string): Promise<{ success: boolean; user: any; syncResult?: AssignmentSyncResult }>;
  disconnectUser(): Promise<void>;
  listRepositories(): Promise<GitHubRepoSummary[]>;
  getRepository(owner: string, repo: string): Promise<GitHubRepoSummary | null>;
  listIssues(
    owner?: string,
    repo?: string,
    options?: { state?: 'open' | 'closed' | 'all'; labels?: string }
  ): Promise<GitHubIssueRef[]>;
  getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueRef | null>;
  listIssueComments(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueCommentRef[]>;
  getDefaultBranch(owner: string, repo: string): Promise<string>;
  getBranchReference(owner: string, repo: string, branch: string): Promise<{ ref: string; sha: string }>;
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFileContent>;
  getDirectoryContents(owner: string, repo: string, path: string, ref?: string): Promise<GitHubDirectoryItem[]>;
  getRepositoryTree(owner: string, repo: string, treeSha: string, recursive?: boolean): Promise<any>;

  // v0.3 Contribution Session & Intelligence methods
  createContributionSession(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    issueTitle?: string;
    issueUrl?: string;
    repoAuthorizationStatus?: string;
  }): Promise<{ success: boolean; session: any }>;
  getContributionSession(id: string): Promise<{ success: boolean; session: any }>;
  runContributionAnalysis(id: string): Promise<{ success: boolean; session: any }>;
  approveContributionPlan(id: string, feedback?: string): Promise<{ success: boolean; session: any; message: string }>;
  requestPlanRevision(id: string, feedback: string): Promise<{ success: boolean; session: any }>;
  cancelContribution(id: string): Promise<{ success: boolean; session: any }>;

  // Reserved write methods (Strictly disabled in v0.2/v0.3 production UI)
  createBranch(owner: string, repo: string, branchName: string, baseSha: string): Promise<{ ref: string; sha: string }>;
  pushCommit(owner: string, repo: string, branch: string, message: string, changes: unknown[]): Promise<{ sha: string }>;
  retriggerWorkflowRun(owner: string, repo: string, runId: number): Promise<{ success: boolean; message: string }>;
}

export class RealGitHubService implements IGitHubService {
  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    // Single-read response body: consume stream exactly once via res.text()
    const bodyText = await res.text();
    let bodyJson: any = null;
    let isJson = false;

    if (bodyText && bodyText.trim().length > 0) {
      try {
        bodyJson = JSON.parse(bodyText);
        isJson = true;
      } catch {
        bodyJson = null;
        isJson = false;
      }
    }

    if (!res.ok) {
      const errorData = (isJson && bodyJson) ? bodyJson : { message: bodyText || `Request to ${endpoint} failed with HTTP ${res.status}` };

      const sanitizedError: SanitizedGitHubError & { session?: any } = errorData.error || {
        classification:
          res.status === 401
            ? 'AUTHENTICATION_FAILURE'
            : res.status === 403
            ? 'AUTHORIZATION_FAILURE'
            : res.status === 404
            ? 'NOT_FOUND'
            : 'GITHUB_SERVICE_FAILURE',
        statusCode: res.status,
        message:
          errorData.message ||
          (errorData.error && errorData.error.message) ||
          bodyText ||
          `Request to ${endpoint} failed with HTTP ${res.status}`,
      };

      if (errorData.session) {
        sanitizedError.session = errorData.session;
      }

      throw sanitizedError;
    }

    return (bodyJson !== null ? bodyJson : ({} as T)) as T;
  }

  async getConnectionStatus() {
    return this.fetchApi<{
      configured: boolean;
      state: GitHubConnectionState;
      installationsCount: number;
      appSlug: string | null;
      activeInstallation?: any;
      error?: SanitizedGitHubError;
    }>('/api/github/status');
  }

  async getAuthUrl() {
    return this.fetchApi<{ installationUrl: string; appSlug: string }>('/api/github/auth-url');
  }

  async getAuthenticatedUser(): Promise<GitHubUser | null> {
    const status = await this.getConnectionStatus();
    if (!status.configured || !status.activeInstallation) {
      return null;
    }

    const inst = status.activeInstallation;
    return {
      id: String(inst.id),
      login: inst.accountLogin,
      name: inst.accountLogin,
      avatarUrl: inst.accountAvatarUrl,
      authorized: true,
      syncedAt: inst.updatedAt || new Date().toISOString(),
    };
  }

  async syncAssignments(username?: string): Promise<AssignmentSyncResult> {
    return this.fetchApi<AssignmentSyncResult>('/api/github/assignments/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
  }

  async getAssignments(): Promise<AssignmentSyncResult> {
    return this.fetchApi<AssignmentSyncResult>('/api/github/assignments');
  }

  async getUserMe(): Promise<{ authenticated: boolean; user: any }> {
    return this.fetchApi<{ authenticated: boolean; user: any }>('/api/github/user/me');
  }

  async getUserAuthUrl(redirectUri?: string): Promise<{ authUrl: string; state: string }> {
    const params = new URLSearchParams();
    if (redirectUri) params.set('redirect_uri', redirectUri);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.fetchApi<{ authUrl: string; state: string }>(`/api/github/user/auth-url${queryString}`);
  }

  async connectUserByUsername(username: string): Promise<{ success: boolean; user: any; syncResult?: AssignmentSyncResult }> {
    return this.fetchApi<{ success: boolean; user: any; syncResult?: AssignmentSyncResult }>('/api/github/user/connect-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
  }

  async disconnectUser(): Promise<void> {
    await this.fetchApi('/api/github/user/disconnect', { method: 'POST' });
  }

  async listRepositories(): Promise<GitHubRepoSummary[]> {
    const data = await this.fetchApi<{ totalCount: number; repositories: GitHubRepoSummary[] }>(
      '/api/github/repositories'
    );
    return data.repositories;
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepoSummary | null> {
    const repos = await this.listRepositories();
    const found = repos.find(
      (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repo.toLowerCase()
    );
    return found || null;
  }

  async listIssues(
    owner?: string,
    repo?: string,
    options: { state?: 'open' | 'closed' | 'all'; labels?: string } = {}
  ): Promise<GitHubIssueRef[]> {
    const params = new URLSearchParams();
    if (owner) params.set('owner', owner);
    if (repo) params.set('repo', repo);
    if (options.state) params.set('state', options.state);
    if (options.labels) params.set('labels', options.labels);

    const data = await this.fetchApi<{ issues: GitHubIssueRef[]; totalCount: number }>(
      `/api/github/issues?${params.toString()}`
    );
    return data.issues;
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueRef | null> {
    const data = await this.fetchApi<{ issue: GitHubIssueRef }>(
      `/api/github/issues/${owner}/${repo}/${issueNumber}`
    );
    return data.issue;
  }

  async listIssueComments(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueCommentRef[]> {
    const data = await this.fetchApi<{ comments: GitHubIssueCommentRef[] }>(
      `/api/github/issues/${owner}/${repo}/${issueNumber}/comments`
    );
    return data.comments;
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const repoInfo = await this.getRepository(owner, repo);
    return repoInfo?.defaultBranch || 'main';
  }

  async getBranchReference(owner: string, repo: string, branch: string): Promise<{ ref: string; sha: string }> {
    return this.fetchApi<{ ref: string; sha: string }>(
      `/api/github/repos/${owner}/${repo}/branch?branch=${encodeURIComponent(branch)}`
    );
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFileContent> {
    const params = new URLSearchParams();
    params.set('path', path);
    if (ref) params.set('ref', ref);
    return this.fetchApi<GitHubFileContent>(
      `/api/github/repos/${owner}/${repo}/content?${params.toString()}`
    );
  }

  async getDirectoryContents(owner: string, repo: string, path: string, ref?: string): Promise<GitHubDirectoryItem[]> {
    const params = new URLSearchParams();
    params.set('path', path);
    if (ref) params.set('ref', ref);
    const data = await this.fetchApi<{ contents: GitHubDirectoryItem[] }>(
      `/api/github/repos/${owner}/${repo}/dir?${params.toString()}`
    );
    return data.contents;
  }

  async getRepositoryTree(owner: string, repo: string, treeSha: string, recursive = false) {
    return this.fetchApi(
      `/api/github/repos/${owner}/${repo}/tree/${treeSha}?recursive=${recursive}`
    );
  }

  // v0.3 Contribution Session & Intelligence implementations
  async createContributionSession(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    issueTitle?: string;
    issueUrl?: string;
    repoAuthorizationStatus?: string;
  }): Promise<{ success: boolean; session: any }> {
    return this.fetchApi<{ success: boolean; session: any }>('/api/github/contributions/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async getContributionSession(id: string): Promise<{ success: boolean; session: any }> {
    return this.fetchApi<{ success: boolean; session: any }>(`/api/github/contributions/${encodeURIComponent(id)}`);
  }

  async runContributionAnalysis(id: string): Promise<{ success: boolean; session: any }> {
    return this.fetchApi<{ success: boolean; session: any }>(`/api/github/contributions/${encodeURIComponent(id)}/analyze`, {
      method: 'POST',
    });
  }

  async approveContributionPlan(id: string, feedback?: string): Promise<{ success: boolean; session: any; message: string }> {
    return this.fetchApi<{ success: boolean; session: any; message: string }>(
      `/api/github/contributions/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      }
    );
  }

  async requestPlanRevision(id: string, feedback: string): Promise<{ success: boolean; session: any }> {
    return this.fetchApi<{ success: boolean; session: any }>(
      `/api/github/contributions/${encodeURIComponent(id)}/revision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      }
    );
  }

  async cancelContribution(id: string): Promise<{ success: boolean; session: any }> {
    return this.fetchApi<{ success: boolean; session: any }>(
      `/api/github/contributions/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
      }
    );
  }

  // Strictly disabled in active v0.2/v0.3 UI
  async createBranch(_owner: string, _repo: string, _branchName: string, _baseSha: string): Promise<{ ref: string; sha: string }> {
    throw new Error('Write operations are forbidden in COSInput Foundation v0.2. Read-only foundation active.');
  }

  async pushCommit(_owner: string, _repo: string, _branch: string, _message: string, _changes: unknown[]): Promise<{ sha: string }> {
    throw new Error('Write operations are forbidden in COSInput Foundation v0.2. Read-only foundation active.');
  }

  async retriggerWorkflowRun(_owner: string, _repo: string, _runId: number): Promise<{ success: boolean; message: string }> {
    throw new Error('Workflow reruns are forbidden in COSInput Foundation v0.2. Read-only foundation active.');
  }
}

export const githubService = new RealGitHubService();
