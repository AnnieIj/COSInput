/**
 * COSInput - Assigned-Issue Sync Service (Server-Side)
 * Discovers and synchronizes real GitHub issues assigned to the connected user across public repositories.
 * Strictly read-only: zero repository modification, zero automatic branch creation, zero autonomous coding execution.
 */

import { githubServerClient, classifyGitHubError } from './githubClient';
import { getInstallationAccessToken } from './githubAppAuth';
import { userAuthStore } from './userAuthStore';
import type {
  GitHubAssignedIssueRef,
  RepositoryAssignmentGroup,
  AssignmentSyncResult,
  SanitizedGitHubError,
} from './types';

// In-memory assignment sync cache
let cachedResult: AssignmentSyncResult | null = null;

/**
 * Normalizes a raw GitHub issue into a structured GitHubAssignedIssueRef.
 * Strictly filters out pull requests.
 */
export function normalizeAssignedIssue(
  item: any,
  authorizedReposSet: Set<string>
): GitHubAssignedIssueRef | null {
  // CRITICAL: Pull requests returned through GitHub issue/search APIs MUST be filtered out
  if (!item || item.pull_request) {
    return null;
  }

  // Extract repository full name from repository_url or html_url
  let repoFullName = '';
  if (item.repository?.full_name) {
    repoFullName = item.repository.full_name;
  } else if (item.repository_url) {
    repoFullName = item.repository_url.replace(/^https?:\/\/api\.github\.com\/repos\//, '');
  } else if (item.html_url) {
    const match = item.html_url.match(/github\.com\/([^/]+\/[^/]+)\/issues\/\d+/);
    if (match) {
      repoFullName = match[1];
    }
  }

  const parts = repoFullName.split('/');
  const owner = parts[0] || 'unknown';
  const name = parts[1] || 'unknown';

  const isAppAuthorized = authorizedReposSet.has(repoFullName.toLowerCase());
  const repoAuthorizationStatus = isAppAuthorized ? 'app_authorized' : 'public_readable';

  // Normalize labels
  const rawLabels: any[] = Array.isArray(item.labels) ? item.labels : [];
  const labels = rawLabels.map((lbl) => {
    const labelName = typeof lbl === 'string' ? lbl : lbl.name || '';
    let color = typeof lbl === 'string' ? '#6b7280' : lbl.color || '6b7280';
    if (!color.startsWith('#')) {
      color = `#${color}`;
    }
    return {
      name: labelName,
      color,
      description: typeof lbl === 'object' ? lbl.description : undefined,
    };
  });

  // Normalize assignees
  const rawAssignees: any[] = Array.isArray(item.assignees)
    ? item.assignees
    : item.assignee
    ? [item.assignee]
    : [];
  const assignees = rawAssignees
    .map((a: any) => (typeof a === 'string' ? a : a.login || ''))
    .filter(Boolean);

  const issueRef: GitHubAssignedIssueRef = {
    id: String(item.id || `issue_${item.number}_${repoFullName}`),
    number: item.number,
    repository: repoFullName,
    repositoryOwner: owner,
    repositoryName: name,
    title: item.title || 'Untitled Issue',
    body: item.body || '',
    state: item.state === 'closed' ? 'closed' : 'open',
    author: item.user?.login || 'unknown',
    authorAvatarUrl: item.user?.avatar_url || '',
    labels,
    assignees,
    commentsCount: item.comments || 0,
    createdAt: item.created_at || new Date().toISOString(),
    updatedAt: item.updated_at || new Date().toISOString(),
    closedAt: item.closed_at || null,
    htmlUrl: item.html_url || `https://github.com/${repoFullName}/issues/${item.number}`,
    repoAuthorizationStatus,
    writeAccessAuthorized: isAppAuthorized,
    contributionStatus: item.state === 'closed' ? 'completed' : 'ready',
  };

  return issueRef;
}

/**
 * Groups normalized issues by repository.
 */
export function groupIssuesByRepository(
  issues: GitHubAssignedIssueRef[],
  authorizedReposSet: Set<string>
): RepositoryAssignmentGroup[] {
  const groupsMap = new Map<string, RepositoryAssignmentGroup>();

  for (const issue of issues) {
    let group = groupsMap.get(issue.repository);
    if (!group) {
      const isAppAuthorized = authorizedReposSet.has(issue.repository.toLowerCase());
      group = {
        fullName: issue.repository,
        owner: issue.repositoryOwner,
        name: issue.repositoryName,
        repoAuthorizationStatus: isAppAuthorized ? 'app_authorized' : 'public_readable',
        writeAccessAuthorized: isAppAuthorized,
        issuesCount: 0,
        issues: [],
      };
      groupsMap.set(issue.repository, group);
    }
    group.issues.push(issue);
    group.issuesCount = group.issues.length;
  }

  // Sort groups: App Authorized repositories first, then alphabetically
  return Array.from(groupsMap.values()).sort((a, b) => {
    if (a.repoAuthorizationStatus === 'app_authorized' && b.repoAuthorizationStatus !== 'app_authorized') {
      return -1;
    }
    if (b.repoAuthorizationStatus === 'app_authorized' && a.repoAuthorizationStatus !== 'app_authorized') {
      return 1;
    }
    return a.fullName.localeCompare(b.fullName);
  });
}

export class AssignmentSyncService {
  /**
   * Executes a real GitHub search to discover open issues assigned to the connected user.
   * Safety invariant: Read-only query; never performs commits, branches, or PRs.
   */
  async syncAssignments(targetUsername?: string): Promise<AssignmentSyncResult> {
    // 1. Identify contributor username
    let username = targetUsername?.trim();
    let userAvatarUrl = '';
    let userId = '';

    const oauthUser = userAuthStore.getUserProfile();
    if (oauthUser && oauthUser.login) {
      username = oauthUser.login;
      userAvatarUrl = oauthUser.avatarUrl;
      userId = oauthUser.id;
    }

    // Fall back to GitHub App active installation user if OAuth user is not connected
    const appStatus = await githubServerClient.getConnectionStatus();
    if (!username && appStatus.activeInstallation?.accountLogin) {
      username = appStatus.activeInstallation.accountLogin;
      userAvatarUrl = appStatus.activeInstallation.accountAvatarUrl;
      userId = String(appStatus.activeInstallation.id);
    }

    if (!username) {
      const error: SanitizedGitHubError = {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 401,
        message: 'No GitHub user is connected. Please connect GitHub in Settings to discover assigned issues.',
      };
      throw error;
    }

    // 2. Obtain an authentication token for the search API call
    let bearerToken: string | null = userAuthStore.getUserToken();

    if (!bearerToken && appStatus.activeInstallation) {
      bearerToken = await getInstallationAccessToken(appStatus.activeInstallation.id);
    }

    // 3. Fetch list of authorized repositories to distinguish App-Authorized vs Public-Readable
    const authorizedReposSet = new Set<string>();
    if (appStatus.activeInstallation) {
      try {
        const repoData = await githubServerClient.listInstallationRepositories(appStatus.activeInstallation.id);
        for (const r of repoData.repositories) {
          authorizedReposSet.add(r.fullName.toLowerCase());
        }
      } catch {
        // Continue even if repository listing has an issue
      }
    }

    // 4. Query GitHub search API for open issues assigned to the user
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'COSInput-Server/0.2.1',
    };

    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    const searchQuery = `is:issue is:open assignee:${encodeURIComponent(username)}`;
    const url = `https://api.github.com/search/issues?q=${searchQuery}&per_page=100&sort=updated&order=desc`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorBody = await response.text();
      throw classifyGitHubError(response.status, errorBody, response.headers);
    }

    const data = (await response.json()) as { total_count: number; items: any[] };
    const rawItems = data.items || [];

    // 5. Strictly filter out pull requests and normalize issues
    const normalizedIssues: GitHubAssignedIssueRef[] = [];
    for (const rawItem of rawItems) {
      const issue = normalizeAssignedIssue(rawItem, authorizedReposSet);
      if (issue) {
        normalizedIssues.push(issue);
      }
    }

    // 6. Group issues by repository
    const grouped = groupIssuesByRepository(normalizedIssues, authorizedReposSet);

    const result: AssignmentSyncResult = {
      success: true,
      count: normalizedIssues.length,
      lastSyncedAt: new Date().toISOString(),
      user: {
        login: username,
        avatarUrl: userAvatarUrl,
        id: userId,
      },
      issues: normalizedIssues,
      groupedByRepository: grouped,
    };

    cachedResult = result;
    return result;
  }

  /**
   * Retrieves the currently cached assignment result or triggers a sync if empty.
   */
  async getAssignments(): Promise<AssignmentSyncResult> {
    if (cachedResult) {
      return cachedResult;
    }
    return this.syncAssignments();
  }

  /**
   * Resets the cache (e.g. for testing).
   */
  clearCache(): void {
    cachedResult = null;
  }
}

export const assignmentSyncService = new AssignmentSyncService();
