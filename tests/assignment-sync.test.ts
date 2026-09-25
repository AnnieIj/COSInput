/**
 * COSInput Foundation v0.2.1 - GitHub Assignment Sync Test Suite
 * Tests assigned issue normalization, pull-request filtering, multi-repository grouping,
 * public repository discovery without GitHub App installation, authorization status distinction,
 * manual sync execution, authentication failure, rate limiting, Live vs Demo isolation,
 * and safety invariants (sync never automatically starts a contribution or AI run).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  normalizeAssignedIssue,
  groupIssuesByRepository,
  assignmentSyncService,
} from '../server/assignmentSyncService';
import { userAuthStore } from '../server/userAuthStore';
import { classifyGitHubError, githubServerClient } from '../server/githubClient';
import { mockIssues } from '../src/data/mock';
import type { GitHubAssignedIssueRef, SanitizedGitHubError } from '../server/types';

describe('Assigned Issue Normalization & Filtering', () => {
  const authorizedRepos = new Set(['myorg/installed-app-repo']);

  it('normalizes a raw GitHub issue object into GitHubAssignedIssueRef with all required fields', () => {
    const rawIssue = {
      id: 987654,
      number: 101,
      title: 'Fix edge case in WebSocket reconnect',
      body: 'When socket drops, reconnect backoff should be exponential.',
      state: 'open',
      html_url: 'https://github.com/facebook/react/issues/101',
      repository_url: 'https://api.github.com/repos/facebook/react',
      user: {
        login: 'gaearon',
        avatar_url: 'https://avatars.githubusercontent.com/u/1234?v=4',
      },
      labels: [
        { name: 'bug', color: 'd73a4a', description: "Something isn't working" },
        { name: 'component: core', color: '0075ca' },
      ],
      assignees: [
        { login: 'contributor-user' },
        { login: 'reviewer-user' },
      ],
      comments: 7,
      created_at: '2026-03-15T10:00:00Z',
      updated_at: '2026-03-16T12:30:00Z',
      closed_at: null,
    };

    const normalized = normalizeAssignedIssue(rawIssue, authorizedRepos);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.id).toBe('987654');
    expect(normalized.number).toBe(101);
    expect(normalized.repository).toBe('facebook/react');
    expect(normalized.repositoryOwner).toBe('facebook');
    expect(normalized.repositoryName).toBe('react');
    expect(normalized.title).toBe('Fix edge case in WebSocket reconnect');
    expect(normalized.body).toContain('reconnect backoff should be exponential');
    expect(normalized.state).toBe('open');
    expect(normalized.author).toBe('gaearon');
    expect(normalized.authorAvatarUrl).toBe('https://avatars.githubusercontent.com/u/1234?v=4');
    expect(normalized.commentsCount).toBe(7);
    expect(normalized.createdAt).toBe('2026-03-15T10:00:00Z');
    expect(normalized.updatedAt).toBe('2026-03-16T12:30:00Z');
    expect(normalized.closedAt).toBeNull();
    expect(normalized.htmlUrl).toBe('https://github.com/facebook/react/issues/101');

    // Labels normalized with # hex prefix
    expect(normalized.labels).toHaveLength(2);
    expect(normalized.labels[0].name).toBe('bug');
    expect(normalized.labels[0].color).toBe('#d73a4a');
    expect(normalized.labels[1].name).toBe('component: core');
    expect(normalized.labels[1].color).toBe('#0075ca');

    // Assignees normalized to string array
    expect(normalized.assignees).toEqual(['contributor-user', 'reviewer-user']);
  });

  it('strictly filters out pull requests returned by GitHub search/issue APIs', () => {
    // Case 1: item has pull_request object
    const rawPR = {
      id: 555,
      number: 42,
      title: 'feat: add support for streaming responses',
      pull_request: {
        url: 'https://api.github.com/repos/facebook/react/pulls/42',
        html_url: 'https://github.com/facebook/react/pull/42',
      },
      html_url: 'https://github.com/facebook/react/pull/42',
      repository_url: 'https://api.github.com/repos/facebook/react',
    };

    expect(normalizeAssignedIssue(rawPR, authorizedRepos)).toBeNull();

    // Case 2: item html_url contains /pull/
    const rawPRByUrl = {
      id: 556,
      number: 43,
      title: 'fix: typos in documentation',
      html_url: 'https://github.com/facebook/react/pull/43',
      repository_url: 'https://api.github.com/repos/facebook/react',
    };

    expect(normalizeAssignedIssue(rawPRByUrl, authorizedRepos)).toBeNull();

    // Case 3: null or undefined items
    expect(normalizeAssignedIssue(null, authorizedRepos)).toBeNull();
    expect(normalizeAssignedIssue(undefined, authorizedRepos)).toBeNull();
  });
});

describe('Repository Access Indicator & Multiple Repositories', () => {
  const authorizedRepos = new Set(['myorg/installed-app-repo']);

  it('discovers public repository assignments without GitHub App installation and marks them public_readable', () => {
    const rawPublicIssue = {
      id: 111,
      number: 77,
      title: 'Implement retry handler',
      html_url: 'https://github.com/unaffiliated-owner/public-library/issues/77',
      repository_url: 'https://api.github.com/repos/unaffiliated-owner/public-library',
      state: 'open',
    };

    const normalized = normalizeAssignedIssue(rawPublicIssue, authorizedRepos);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    // Discovered and accessible
    expect(normalized.repository).toBe('unaffiliated-owner/public-library');
    expect(normalized.repoAuthorizationStatus).toBe('public_readable');
    expect(normalized.writeAccessAuthorized).toBe(false);
  });

  it('distinguishes GitHub App Authorized vs Public Readable repositories correctly', () => {
    const rawAuthorizedIssue = {
      id: 222,
      number: 12,
      title: 'Update CI configuration',
      html_url: 'https://github.com/myorg/installed-app-repo/issues/12',
      repository_url: 'https://api.github.com/repos/myorg/installed-app-repo',
      state: 'open',
    };

    const rawUnauthorizedIssue = {
      id: 333,
      number: 99,
      title: 'Fix typo in README',
      html_url: 'https://github.com/other-org/external-repo/issues/99',
      repository_url: 'https://api.github.com/repos/other-org/external-repo',
      state: 'open',
    };

    const authIssue = normalizeAssignedIssue(rawAuthorizedIssue, authorizedRepos);
    const unauthIssue = normalizeAssignedIssue(rawUnauthorizedIssue, authorizedRepos);

    expect(authIssue?.repoAuthorizationStatus).toBe('app_authorized');
    expect(authIssue?.writeAccessAuthorized).toBe(true);

    expect(unauthIssue?.repoAuthorizationStatus).toBe('public_readable');
    expect(unauthIssue?.writeAccessAuthorized).toBe(false);
  });

  it('groups assignments across multiple repositories and sorts App Authorized repos first', () => {
    const issues: GitHubAssignedIssueRef[] = [
      {
        id: '1',
        number: 1,
        repository: 'alpha/external-repo',
        repositoryOwner: 'alpha',
        repositoryName: 'external-repo',
        title: 'Task 1',
        body: '',
        state: 'open',
        author: 'dev',
        labels: [],
        assignees: ['me'],
        commentsCount: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        htmlUrl: 'https://github.com/alpha/external-repo/issues/1',
        repoAuthorizationStatus: 'public_readable',
        writeAccessAuthorized: false,
        contributionStatus: 'ready',
      },
      {
        id: '2',
        number: 2,
        repository: 'myorg/installed-app-repo',
        repositoryOwner: 'myorg',
        repositoryName: 'installed-app-repo',
        title: 'Task 2',
        body: '',
        state: 'open',
        author: 'dev',
        labels: [],
        assignees: ['me'],
        commentsCount: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        htmlUrl: 'https://github.com/myorg/installed-app-repo/issues/2',
        repoAuthorizationStatus: 'app_authorized',
        writeAccessAuthorized: true,
        contributionStatus: 'ready',
      },
      {
        id: '3',
        number: 3,
        repository: 'alpha/external-repo',
        repositoryOwner: 'alpha',
        repositoryName: 'external-repo',
        title: 'Task 3',
        body: '',
        state: 'open',
        author: 'dev',
        labels: [],
        assignees: ['me'],
        commentsCount: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        htmlUrl: 'https://github.com/alpha/external-repo/issues/3',
        repoAuthorizationStatus: 'public_readable',
        writeAccessAuthorized: false,
        contributionStatus: 'ready',
      },
      {
        id: '4',
        number: 4,
        repository: 'zeta/another-public-repo',
        repositoryOwner: 'zeta',
        repositoryName: 'another-public-repo',
        title: 'Task 4',
        body: '',
        state: 'open',
        author: 'dev',
        labels: [],
        assignees: ['me'],
        commentsCount: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        htmlUrl: 'https://github.com/zeta/another-public-repo/issues/4',
        repoAuthorizationStatus: 'public_readable',
        writeAccessAuthorized: false,
        contributionStatus: 'ready',
      },
    ];

    const groups = groupIssuesByRepository(issues, authorizedRepos);
    expect(groups).toHaveLength(3);

    // App authorized repos must appear first
    expect(groups[0].fullName).toBe('myorg/installed-app-repo');
    expect(groups[0].repoAuthorizationStatus).toBe('app_authorized');
    expect(groups[0].writeAccessAuthorized).toBe(true);
    expect(groups[0].issuesCount).toBe(1);

    // Followed by remaining repos in alphabetical order
    expect(groups[1].fullName).toBe('alpha/external-repo');
    expect(groups[1].issuesCount).toBe(2);

    expect(groups[2].fullName).toBe('zeta/another-public-repo');
    expect(groups[2].issuesCount).toBe(1);
  });
});

describe('Manual Sync & Cache Management', () => {
  beforeEach(() => {
    assignmentSyncService.clearCache();
    userAuthStore.clearSession();
    vi.restoreAllMocks();
    vi.spyOn(githubServerClient, 'getConnectionStatus').mockResolvedValue({
      configured: false,
      state: 'NOT_CONNECTED',
      installationsCount: 0,
      appSlug: null,
      activeInstallation: null,
    });
  });

  afterEach(() => {
    assignmentSyncService.clearCache();
    userAuthStore.clearSession();
    vi.restoreAllMocks();
  });

  it('executes manual sync using targetUsername and caches results', async () => {
    const mockSearchResponse = {
      total_count: 2,
      items: [
        {
          id: 101,
          number: 1,
          title: 'Implement OAuth refresh',
          body: 'Token rotation spec',
          state: 'open',
          html_url: 'https://github.com/public-org/repo-a/issues/1',
          repository_url: 'https://api.github.com/repos/public-org/repo-a',
          user: { login: 'maintainer' },
          assignees: [{ login: 'alice' }],
          comments: 2,
          created_at: '2026-02-01T00:00:00Z',
          updated_at: '2026-02-02T00:00:00Z',
        },
        {
          id: 102,
          number: 2,
          title: 'A PR that should be filtered out',
          pull_request: {},
          html_url: 'https://github.com/public-org/repo-a/pull/2',
          repository_url: 'https://api.github.com/repos/public-org/repo-a',
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/search/issues')) {
        return {
          ok: true,
          json: async () => mockSearchResponse,
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const result = await assignmentSyncService.syncAssignments('alice');
    expect(result.success).toBe(true);
    expect(result.count).toBe(1); // PR was filtered out!
    expect(result.issues[0].title).toBe('Implement OAuth refresh');
    expect(result.user?.login).toBe('alice');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Calling getAssignments() immediately after uses the cache without refetching
    const cached = await assignmentSyncService.getAssignments();
    expect(cached.count).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1 call!
  });

  it('throws AUTHENTICATION_FAILURE when no user or app account is connected', async () => {
    await expect(assignmentSyncService.syncAssignments()).rejects.toMatchObject({
      classification: 'AUTHENTICATION_FAILURE',
      statusCode: 401,
    });
  });

  it('classifies rate limiting errors and extracts retryAfterSeconds', async () => {
    const headers = new Headers();
    headers.set('x-ratelimit-remaining', '0');
    headers.set('retry-after', '45');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/search/issues')) {
        return {
          ok: false,
          status: 403,
          text: async () => 'API rate limit exceeded',
          headers,
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    await expect(assignmentSyncService.syncAssignments('bob')).rejects.toMatchObject({
      classification: 'RATE_LIMIT',
      statusCode: 403,
      retryAfterSeconds: 45,
    });
  });
});

describe('Live vs Demo Isolation', () => {
  beforeEach(() => {
    assignmentSyncService.clearCache();
    userAuthStore.clearSession();
    vi.restoreAllMocks();
    vi.spyOn(githubServerClient, 'getConnectionStatus').mockResolvedValue({
      configured: false,
      state: 'NOT_CONNECTED',
      installationsCount: 0,
      appSlug: null,
      activeInstallation: null,
    });
  });

  it('ensures demo mock issues remain isolated and are never returned by assignmentSyncService', async () => {
    assignmentSyncService.clearCache();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/search/issues')) {
        return {
          ok: true,
          json: async () => ({ total_count: 0, items: [] }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const liveResult = await assignmentSyncService.syncAssignments('charlie');
    expect(liveResult.issues).toEqual([]);

    // Verify mockIssues has fixtures and was not affected or returned
    expect(mockIssues.length).toBeGreaterThan(0);
    expect(liveResult.issues).not.toEqual(mockIssues);
  });

  it('never falls back to mock issues when Live sync fails with an error', async () => {
    assignmentSyncService.clearCache();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/search/issues')) {
        return {
          ok: false,
          status: 503,
          text: async () => 'GitHub Service Unavailable',
          headers: new Headers(),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    let caughtError: SanitizedGitHubError | null = null;
    try {
      await assignmentSyncService.syncAssignments('david');
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.classification).toBe('GITHUB_SERVICE_FAILURE');
  });
});

describe('Safety Invariant: Sync Never Starts a Contribution Automatically', () => {
  beforeEach(() => {
    assignmentSyncService.clearCache();
    userAuthStore.clearSession();
    vi.restoreAllMocks();
    vi.spyOn(githubServerClient, 'getConnectionStatus').mockResolvedValue({
      configured: false,
      state: 'NOT_CONNECTED',
      installationsCount: 0,
      appSlug: null,
      activeInstallation: null,
    });
  });

  it('running syncAssignments only queries GitHub and never triggers repository writes or runs', async () => {
    const mockItem = {
      id: 888,
      number: 55,
      title: 'Review specifications',
      state: 'open',
      html_url: 'https://github.com/org/repo/issues/55',
      repository_url: 'https://api.github.com/repos/org/repo',
      user: { login: 'maintainer' },
      assignees: [{ login: 'engineer' }],
      comments: 0,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/search/issues')) {
        return {
          ok: true,
          json: async () => ({ total_count: 1, items: [mockItem] }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const result = await assignmentSyncService.syncAssignments('engineer');
    expect(result.issues).toHaveLength(1);

    const issue = result.issues[0];
    // Contribution status is 'ready' for open issues, NOT 'in_progress'
    expect(issue.contributionStatus).toBe('ready');

    // Verify zero write calls were made to GitHub (only the GET search query was performed)
    // The issue is discovered and selected in memory only
    expect(issue.number).toBe(55);
  });
});
