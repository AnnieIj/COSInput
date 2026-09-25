import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';
import { mockIssues } from '../data/mock';
import type {
  GitHubAssignedIssueRef,
  RepositoryAssignmentGroup,
  AssignmentSyncResult,
  SanitizedGitHubError,
  RepositoryAccessStatus,
  COSInputContributionStatus,
} from '../services/types';

export const IssuesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mode, isLive, currentUser } = useMode();

  const [assignments, setAssignments] = useState<GitHubAssignedIssueRef[]>([]);
  const [groupedRepos, setGroupedRepos] = useState<RepositoryAssignmentGroup[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(isLive);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<SanitizedGitHubError | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'in_progress' | 'completed' | 'blocked'>('assigned');
  const [repoFilter, setRepoFilter] = useState<string>(searchParams.get('repo') || '');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '');

  // Start Contribution Gate Modal
  const [selectedIssueForGate, setSelectedIssueForGate] = useState<GitHubAssignedIssueRef | null>(null);

  // Load assignments (initial fetch)
  const loadAssignments = async (forceSync = false) => {
    if (!isLive) {
      setLoading(false);
      setError(null);
      return;
    }

    if (forceSync) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result: AssignmentSyncResult = forceSync
        ? await githubService.syncAssignments()
        : await githubService.getAssignments();

      setAssignments(result.issues || []);
      setGroupedRepos(result.groupedByRepository || []);
      setLastSyncedAt(result.lastSyncedAt || new Date().toISOString());
    } catch (err: any) {
      setError(
        err.classification
          ? err
          : {
              classification: 'GITHUB_SERVICE_FAILURE',
              statusCode: 500,
              message: err.message || 'Failed to synchronize assigned GitHub issues.',
            }
      );
      setAssignments([]);
      setGroupedRepos([]);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (isLive) {
      loadAssignments(false);
    } else {
      setLoading(false);
      setError(null);
    }
  }, [isLive]);

  // Demo Mode issues mapping
  const getDemoGroupedIssues = (): RepositoryAssignmentGroup[] => {
    const demoAssigned: GitHubAssignedIssueRef[] = mockIssues.map((m) => ({
      id: String(m.id),
      number: m.number,
      repository: m.repository,
      repositoryOwner: m.repository.split('/')[0]?.trim() || 'DigiNodes',
      repositoryName: m.repository.split('/')[1]?.trim() || 'truthbounty-frontend',
      title: m.title,
      body: m.summary,
      state: 'open',
      author: m.author,
      labels: m.labels.map((l) => ({ name: l.text, color: '#3b82f6' })),
      assignees: ['vitalik-fan', 'contributor'],
      commentsCount: 4,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      htmlUrl: `https://github.com/${m.repository}/issues/${m.number}`,
      repoAuthorizationStatus: 'app_authorized',
      writeAccessAuthorized: true,
      contributionStatus: m.status === 'active_contribution' ? 'in_progress' : 'ready',
    }));

    // Filter
    const filtered = demoAssigned.filter((issue) => {
      if (statusFilter === 'in_progress' && issue.contributionStatus !== 'in_progress') return false;
      if (statusFilter === 'completed' && issue.contributionStatus !== 'completed') return false;
      if (statusFilter === 'blocked' && issue.contributionStatus !== 'blocked') return false;
      if (repoFilter && !issue.repository.toLowerCase().includes(repoFilter.toLowerCase())) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          issue.title.toLowerCase().includes(q) ||
          issue.body.toLowerCase().includes(q) ||
          issue.repository.toLowerCase().includes(q) ||
          String(issue.number).includes(q)
        );
      }
      return true;
    });

    return [
      {
        fullName: 'DigiNodes / truthbounty-frontend',
        owner: 'DigiNodes',
        name: 'truthbounty-frontend',
        repoAuthorizationStatus: 'app_authorized',
        writeAccessAuthorized: true,
        issuesCount: filtered.length,
        issues: filtered,
      },
    ];
  };

  // Filter live issues and re-group
  const getFilteredLiveGroups = (): RepositoryAssignmentGroup[] => {
    const filteredIssues = assignments.filter((issue) => {
      // Status filter
      if (statusFilter === 'assigned') {
        if (issue.state !== 'open') return false;
      } else if (statusFilter === 'in_progress') {
        if (issue.contributionStatus !== 'in_progress') return false;
      } else if (statusFilter === 'completed') {
        if (issue.state !== 'closed' && issue.contributionStatus !== 'completed') return false;
      } else if (statusFilter === 'blocked') {
        if (issue.contributionStatus !== 'blocked') return false;
      }

      // Repository filter
      if (repoFilter && issue.repository.toLowerCase() !== repoFilter.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          issue.title.toLowerCase().includes(q) ||
          issue.body.toLowerCase().includes(q) ||
          issue.repository.toLowerCase().includes(q) ||
          String(issue.number).includes(q) ||
          issue.author.toLowerCase().includes(q)
        );
      }

      return true;
    });

    // Group filtered issues by repository
    const groupsMap = new Map<string, RepositoryAssignmentGroup>();
    for (const issue of filteredIssues) {
      let group = groupsMap.get(issue.repository);
      if (!group) {
        group = {
          fullName: issue.repository,
          owner: issue.repositoryOwner,
          name: issue.repositoryName,
          repoAuthorizationStatus: issue.repoAuthorizationStatus,
          writeAccessAuthorized: issue.writeAccessAuthorized,
          issuesCount: 0,
          issues: [],
        };
        groupsMap.set(issue.repository, group);
      }
      group.issues.push(issue);
      group.issuesCount = group.issues.length;
    }

    return Array.from(groupsMap.values());
  };

  const displayedGroups = isLive ? getFilteredLiveGroups() : getDemoGroupedIssues();
  const totalDisplayedIssues = displayedGroups.reduce((acc, g) => acc + g.issuesCount, 0);

  // Available unique repositories for filter dropdown
  const uniqueRepos = isLive
    ? Array.from(new Set(assignments.map((i) => i.repository))).sort()
    : ['DigiNodes / truthbounty-frontend'];

  // Format relative last sync time
  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString();
  };

  // Badge helpers
  const renderRepoAccessBadge = (status: RepositoryAccessStatus) => {
    if (status === 'app_authorized') {
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-[11px] font-semibold flex items-center gap-1 border border-tertiary/30">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
          <span>GitHub App Authorized</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-800 font-code-sm text-[11px] font-semibold flex items-center gap-1 border border-sky-500/30">
        <span className="material-symbols-outlined text-[13px]">public</span>
        <span>Public Repository Readable</span>
      </span>
    );
  };

  const renderWriteAccessBadge = (isAuthorized: boolean) => {
    if (!isAuthorized) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-code-sm text-[11px] font-medium border border-surface-container-high flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">lock</span>
          <span>Write Access Not Authorized</span>
        </span>
      );
    }
    return null;
  };

  const renderContributionStatusBadge = (status: COSInputContributionStatus) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm text-[11px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-code-sm text-[11px] font-medium">
            Completed
          </span>
        );
      case 'blocked':
        return (
          <span className="px-2 py-0.5 rounded-full bg-error-container text-error font-code-sm text-[11px] font-bold">
            Blocked
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-[11px] font-semibold">
            Ready to Contribute
          </span>
        );
    }
  };

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Primary Sync Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              GitHub Assignments
            </h1>
            <span
              className={`px-2 py-0.5 rounded font-code-sm text-[11px] font-semibold ${
                isLive ? 'bg-primary-container text-on-primary' : 'bg-amber-600 text-white'
              }`}
            >
              {isLive ? 'LIVE GITHUB' : 'DEMO MODE'}
            </span>
            {currentUser && isLive && (
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-code-sm text-[11px] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-tertiary">verified_user</span>
                @{currentUser.login}
              </span>
            )}
          </div>
          <p className="font-body-md text-body-md text-secondary">
            {isLive
              ? 'Real open GitHub issues assigned to you across public and authorized repositories. Pull requests are filtered out.'
              : 'Displaying offline demonstration assignment fixtures.'}
          </p>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col items-end text-code-sm font-code-sm text-secondary">
            <span className="text-[11px] uppercase tracking-wider text-outline font-semibold">Last Sync</span>
            <span className="text-on-surface font-mono font-medium">{formatSyncTime(lastSyncedAt)}</span>
          </div>

          {isLive && (
            <button
              type="button"
              disabled={syncing || loading}
              onClick={() => loadAssignments(true)}
              className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Queries GitHub for open issues assigned to you across public repositories"
            >
              <span className={`material-symbols-outlined text-[18px] ${syncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface border border-surface-container shadow-sm transition-colors"
            title="Configure GitHub App & User Connections"
            aria-label="GitHub Settings"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </div>

      {/* 2. Metrics & Status Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Assigned Issues</span>
          <div className="text-headline-lg font-bold text-on-surface mt-1">
            {isLive ? assignments.length : mockIssues.length}
          </div>
          <span className="font-code-sm text-[11px] text-secondary">Open tasks assigned</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Repositories</span>
          <div className="text-headline-lg font-bold text-primary mt-1">
            {isLive ? groupedRepos.length : 1}
          </div>
          <span className="font-code-sm text-[11px] text-secondary">With active assignments</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">App Authorized</span>
          <div className="text-headline-lg font-bold text-tertiary mt-1">
            {isLive
              ? groupedRepos.filter((g) => g.repoAuthorizationStatus === 'app_authorized').length
              : 1}
          </div>
          <span className="font-code-sm text-[11px] text-secondary">Installed on GitHub</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">Public Readable</span>
          <div className="text-headline-lg font-bold text-sky-700 mt-1">
            {isLive
              ? groupedRepos.filter((g) => g.repoAuthorizationStatus === 'public_readable').length
              : 0}
          </div>
          <span className="font-code-sm text-[11px] text-secondary">External open-source</span>
        </div>
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              All ({assignments.length || (isLive ? 0 : mockIssues.length)})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('assigned')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 ${
                statusFilter === 'assigned'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Assigned (Open)
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 ${
                statusFilter === 'in_progress'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              In Progress
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 ${
                statusFilter === 'completed'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Completed
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('blocked')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 ${
                statusFilter === 'blocked'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Failed/Blocked
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              filter_list
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, #number, author..."
              className="w-full h-8 pl-8 pr-3 bg-surface-container-low rounded-lg font-code-sm text-code-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container"
            />
          </div>
        </div>

        {/* Repository Filter Dropdown */}
        {uniqueRepos.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-surface-container-low font-code-sm text-code-sm text-secondary flex-wrap">
            <span className="font-semibold text-on-surface shrink-0">Filter by Repository:</span>
            <select
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              className="bg-surface-container-low text-on-surface px-2.5 py-1 rounded border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary max-w-sm"
            >
              <option value="">All Repositories ({uniqueRepos.length})</option>
              {uniqueRepos.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
            {repoFilter && (
              <button
                type="button"
                onClick={() => setRepoFilter('')}
                className="text-primary hover:underline text-xs"
              >
                Clear repo filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Real Error Diagnostic Box (Never silent mock fallback) */}
      {isLive && error && (
        <div className="p-5 rounded-xl bg-error-container/20 border border-error/40 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-[24px] mt-0.5 shrink-0">error</span>
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-headline-sm text-error font-bold">
                {error.classification} (Status {error.statusCode})
              </span>
              <p className="font-body-md text-body-md text-on-surface">{error.message}</p>
              {error.retryAfterSeconds && (
                <span className="font-code-sm text-code-sm text-secondary">
                  Rate limit resets in {error.retryAfterSeconds} seconds.
                </span>
              )}
              <span className="font-code-sm text-code-sm text-secondary pt-1">
                Strict Invariant: COSInput does not fall back to fake data on error. Please check your GitHub connection.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadAssignments(true)}
            className="px-3 py-1.5 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold shrink-0 cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* 5. Loading Skeleton */}
      {isLive && loading && (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="p-6 rounded-xl bg-surface-container-lowest border border-surface-container animate-pulse space-y-3"
            >
              <div className="h-5 bg-surface-container rounded w-1/4"></div>
              <div className="h-10 bg-surface-container-low rounded w-full"></div>
              <div className="h-10 bg-surface-container-low rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )}

      {/* 6. Empty State */}
      {!loading && !error && displayedGroups.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-10 border border-surface-container text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-outline text-[48px]">assignment_turned_in</span>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            No Assigned Issues Found
          </h2>
          <p className="font-body-md text-body-md text-secondary max-w-md">
            {isLive
              ? 'No open issues currently assigned to your connected GitHub user account match your filter criteria.'
              : 'No mock issues match your query.'}
          </p>
          {isLive && (
            <button
              type="button"
              onClick={() => loadAssignments(true)}
              className="mt-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>Sync GitHub Assignments</span>
            </button>
          )}
        </div>
      )}

      {/* 7. Grouped Issues by Repository */}
      {!loading && !error && displayedGroups.length > 0 && (
        <div className="space-y-6">
          {displayedGroups.map((group) => (
            <div
              key={group.fullName}
              className="bg-surface-container-lowest rounded-xl border border-surface-container shadow-sm overflow-hidden"
            >
              {/* Repository Header Strip */}
              <div className="p-4 bg-surface-container-low border-b border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
                    source
                  </span>
                  <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface font-mono truncate">
                    {group.fullName}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container font-code-sm text-[11px] font-bold text-secondary shrink-0">
                    {group.issuesCount} {group.issuesCount === 1 ? 'issue' : 'issues'}
                  </span>
                </div>

                {/* Repository Access Badges */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {renderRepoAccessBadge(group.repoAuthorizationStatus)}
                  {renderWriteAccessBadge(group.writeAccessAuthorized)}
                </div>
              </div>

              {/* Issues in this Repository */}
              <div className="divide-y divide-surface-container-low">
                {group.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-5 hover:bg-surface-container-low/40 transition-colors flex flex-col gap-3"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        {/* Issue Identifier & Title */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`material-symbols-outlined text-[20px] shrink-0 ${
                              issue.state === 'open' ? 'text-primary' : 'text-secondary'
                            }`}
                          >
                            {issue.state === 'open' ? 'adjust' : 'check_circle'}
                          </span>
                          <span className="font-code-sm text-code-sm font-mono text-secondary font-semibold">
                            #{issue.number}
                          </span>
                          <h3
                            onClick={() =>
                              navigate(`/issues/${issue.number}?repo=${encodeURIComponent(issue.repository)}`)
                            }
                            className="font-headline-sm text-headline-sm font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer"
                          >
                            {issue.title}
                          </h3>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {renderContributionStatusBadge(issue.contributionStatus)}
                          <span
                            className={`px-2 py-0.5 rounded-full font-code-sm text-[10px] font-bold uppercase ${
                              issue.state === 'open'
                                ? 'bg-tertiary-container/20 text-tertiary'
                                : 'bg-surface-container text-secondary'
                            }`}
                          >
                            {issue.state}
                          </span>
                        </div>
                      </div>

                      {/* Issue Body Excerpt */}
                      {issue.body && (
                        <p className="font-body-md text-body-md text-secondary line-clamp-2 pl-7">
                          {issue.body}
                        </p>
                      )}

                      {/* Labels */}
                      {issue.labels.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-7 pt-1">
                          {issue.labels.map((lbl) => (
                            <span
                              key={lbl.name}
                              className="px-2.5 py-0.5 rounded-full font-code-sm text-[10px] font-semibold border"
                              style={{
                                backgroundColor: `${lbl.color}20`,
                                borderColor: `${lbl.color}50`,
                                color: '#1f2937',
                              }}
                            >
                              {lbl.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Row: Metadata & Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-surface-container-low font-code-sm text-code-sm text-secondary flex-wrap gap-3 pl-7">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>
                          Opened by <strong>@{issue.author}</strong>
                        </span>
                        <span>•</span>
                        <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                        {issue.commentsCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">chat</span>
                              {issue.commentsCount}
                            </span>
                          </>
                        )}
                        {issue.assignees.length > 0 && (
                          <>
                            <span>•</span>
                            <span>Assigned to: <strong>{issue.assignees.join(', ')}</strong></span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={issue.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                          title="View on GitHub"
                        >
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </a>

                        {/* Start Contribution Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedIssueForGate(issue)}
                          className="px-3.5 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Start Contribution</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 8. Start Contribution Gate Modal (Safety Invariant: Read-Only in v0.2.1) */}
      {selectedIssueForGate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 border border-surface-container shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">rocket_launch</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Contribution Workspace Gate
                  </h3>
                  <span className="font-code-sm text-code-sm text-secondary font-mono">
                    {selectedIssueForGate.repository} #{selectedIssueForGate.number}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssueForGate(null)}
                className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
              <span className="text-secondary text-[11px] font-bold uppercase tracking-wider block">
                Selected Issue
              </span>
              <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {selectedIssueForGate.title}
              </h4>
            </div>

            {/* Repository Authorization Status Disclosure */}
            <div className="p-4 rounded-xl border space-y-2 bg-surface-container-lowest border-surface-container">
              <div className="flex items-center justify-between">
                <span className="text-secondary text-[11px] font-bold uppercase tracking-wider">
                  Repository Access Level
                </span>
                {renderRepoAccessBadge(selectedIssueForGate.repoAuthorizationStatus)}
              </div>

              {selectedIssueForGate.repoAuthorizationStatus === 'app_authorized' ? (
                <p className="font-body-sm text-body-sm text-tertiary">
                  ✓ This repository is authorized by the COSInput GitHub App. Ready for future automated branch orchestration and PR checks.
                </p>
              ) : (
                <p className="font-body-sm text-body-sm text-amber-900 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  ℹ Public repository discovery active. COSInput can read specifications and verify criteria. Automated branch creation and PR submission in future phases will require the repository maintainer to install the COSInput GitHub App.
                </p>
              )}
            </div>

            {/* Safety Invariant Notice */}
            <div className="p-3 rounded-lg bg-surface-container-low text-body-sm font-body-sm text-secondary border border-surface-container">
              <strong className="text-on-surface">Foundation v0.2.1 Invariant:</strong> Proceeding creates/selects this contribution context for local specification review. No branches, commits, or PRs will be created on GitHub, and no autonomous AI coding run is started automatically.
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedIssueForGate(null)}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const issue = selectedIssueForGate;
                  setSelectedIssueForGate(null);
                  navigate(`/issues/${issue.number}?repo=${encodeURIComponent(issue.repository)}`);
                }}
                className="px-5 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Proceed to Issue Context</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
