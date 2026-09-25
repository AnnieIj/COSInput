import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';
import { mockIssues } from '../data/mock';
import type { GitHubIssueRef, SanitizedGitHubError, GitHubRepoSummary } from '../services/types';

export const IssuesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mode, isLive, currentUser } = useMode();

  const [realIssues, setRealIssues] = useState<GitHubIssueRef[]>([]);
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoSummary[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>(searchParams.get('repo') || '');
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(isLive);
  const [error, setError] = useState<SanitizedGitHubError | null>(null);

  // Fetch repositories list for the filter dropdown
  useEffect(() => {
    if (isLive) {
      githubService
        .listRepositories()
        .then((repos) => setAvailableRepos(repos))
        .catch(() => setAvailableRepos([]));
    }
  }, [isLive]);

  // Fetch real issues
  const fetchIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      let owner: string | undefined;
      let repo: string | undefined;

      if (selectedRepo) {
        const parts = selectedRepo.split('/');
        if (parts.length === 2) {
          owner = parts[0].trim();
          repo = parts[1].trim();
        }
      }

      const issues = await githubService.listIssues(owner, repo, {
        state: stateFilter,
      });

      setRealIssues(issues);
    } catch (err: any) {
      setError(
        err.classification
          ? err
          : {
              classification: 'GITHUB_SERVICE_FAILURE',
              statusCode: 500,
              message: err.message || 'Failed to retrieve repository issues.',
            }
      );
      setRealIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLive) {
      fetchIssues();
    } else {
      setLoading(false);
      setError(null);
    }
  }, [isLive, selectedRepo, stateFilter]);

  // Filter items in memory
  const getFilteredIssues = () => {
    if (!isLive) {
      return mockIssues.filter((issue) => {
        if (stateFilter === 'open' && issue.status === 'review') return true;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            issue.title.toLowerCase().includes(q) ||
            issue.summary.toLowerCase().includes(q) ||
            issue.repository.toLowerCase().includes(q) ||
            String(issue.number).includes(q)
          );
        }
        return true;
      });
    }

    return realIssues.filter((item) => {
      if (assignedToMe && currentUser) {
        if (!item.assignees.includes(currentUser.login)) {
          return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          item.repository.toLowerCase().includes(q) ||
          String(item.number).includes(q) ||
          item.author.toLowerCase().includes(q)
        );
      }
      return true;
    });
  };

  const displayedIssues = getFilteredIssues();

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              Repository Issues
            </h1>
            <span
              className={`px-2 py-0.5 rounded font-code-sm text-[11px] font-semibold ${
                isLive
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {isLive ? 'LIVE GITHUB' : 'DEMO MODE'}
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary">
            {isLive
              ? 'Real issues extracted from authorized repositories. Pull requests are strictly filtered out.'
              : 'Displaying offline demonstration issue fixtures.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLive && (
            <button
              type="button"
              disabled={loading}
              onClick={fetchIssues}
              className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold border border-surface-container shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{loading ? 'Fetching...' : 'Sync GitHub'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStateFilter('open')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
                stateFilter === 'open'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Open Issues
            </button>
            <button
              type="button"
              onClick={() => setStateFilter('closed')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
                stateFilter === 'closed'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Closed Issues
            </button>
            <button
              type="button"
              onClick={() => setStateFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
                stateFilter === 'all'
                  ? 'bg-primary-container text-on-primary'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              All
            </button>

            {isLive && currentUser && (
              <button
                type="button"
                onClick={() => setAssignedToMe(!assignedToMe)}
                className={`ml-2 px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold border transition-colors ${
                  assignedToMe
                    ? 'bg-secondary-fixed text-on-secondary-fixed border-primary'
                    : 'text-secondary border-surface-container hover:bg-surface-container'
                }`}
              >
                Assigned to me
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              filter_list
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues, numbers, authors..."
              className="w-full h-8 pl-8 pr-3 bg-surface-container-low rounded-lg font-code-sm text-code-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container"
            />
          </div>
        </div>

        {/* Repository Filter Dropdown (Live mode) */}
        {isLive && availableRepos.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-surface-container-low font-code-sm text-code-sm text-secondary">
            <span className="font-semibold text-on-surface shrink-0">Filter by Repository:</span>
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="bg-surface-container-low text-on-surface px-2.5 py-1 rounded border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary max-w-sm"
            >
              <option value="">All Authorized Repositories</option>
              {availableRepos.map((r) => (
                <option key={r.id} value={r.fullName}>
                  {r.fullName} ({r.openIssuesCount} issues)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Real Error Diagnostic Box */}
      {isLive && error && (
        <div className="p-5 rounded-xl bg-error-container/20 border border-error/40 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-[24px] mt-0.5 shrink-0">
              error
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-headline-sm text-headline-sm text-error font-bold">
                {error.classification} (Status {error.statusCode})
              </span>
              <p className="font-body-md text-body-md text-on-surface">
                {error.message}
              </p>
              <span className="font-code-sm text-code-sm text-secondary pt-1">
                Strict Rule: COSInput will not fall back to mock data.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-3 py-1.5 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold shrink-0"
          >
            Check App Settings
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLive && loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container animate-pulse h-28 flex flex-col justify-between"
            >
              <div className="h-5 bg-surface-container rounded w-1/3"></div>
              <div className="h-4 bg-surface-container-low rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )}

      {/* No Issues Found */}
      {!loading && !error && displayedIssues.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-10 border border-surface-container text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-outline text-[48px]">task</span>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            No Issues Found
          </h2>
          <p className="font-body-md text-body-md text-secondary max-w-md">
            {isLive
              ? 'No issues match your current repository and state filters.'
              : 'No mock issues match your query.'}
          </p>
        </div>
      )}

      {/* Real Issues List (Live Mode) */}
      {isLive && !loading && !error && (
        <div className="flex flex-col gap-3">
          {displayedIssues.map((issue: any) => (
            <div
              key={issue.id}
              className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container hover:border-outline-variant hover:shadow-md transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        issue.state === 'open' ? 'text-primary' : 'text-secondary'
                      }`}
                    >
                      {issue.state === 'open' ? 'adjust' : 'check_circle'}
                    </span>
                    <span className="font-code-sm text-code-sm text-secondary font-mono font-medium">
                      {issue.repository} #{issue.number}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full font-code-sm text-[10px] font-bold uppercase ${
                        issue.state === 'open'
                          ? 'bg-tertiary-container/20 text-tertiary'
                          : 'bg-surface-container text-secondary'
                      }`}
                    >
                      {issue.state}
                    </span>
                    {(issue.labels || []).map((lbl: any) => (
                      <span
                        key={lbl.name}
                        className="px-2 py-0.5 rounded-full font-code-sm text-[10px] font-medium bg-surface-container text-on-surface border border-surface-container-high/40"
                      >
                        {lbl.name}
                      </span>
                    ))}
                  </div>
                </div>

                <h3
                  onClick={() => navigate(`/issues/${issue.number}?repo=${encodeURIComponent(issue.repository)}`)}
                  className="font-headline-sm text-headline-sm text-on-surface font-semibold hover:text-primary transition-colors cursor-pointer"
                >
                  {issue.title}
                </h3>

                {issue.body && (
                  <p className="font-body-md text-body-md text-secondary line-clamp-2">
                    {issue.body}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-container-low font-code-sm text-code-sm text-secondary flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span>Opened by <strong>{issue.author}</strong></span>
                  <span>•</span>
                  <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{issue.commentsCount} comments</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={issue.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-secondary hover:text-on-surface"
                    title="View on GitHub"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate(`/issues/${issue.number}?repo=${encodeURIComponent(issue.repository)}`)}
                    className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-semibold transition-colors flex items-center gap-1"
                  >
                    <span>View Details</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Demo Mode Issues List */}
      {!isLive && (
        <div className="flex flex-col gap-3">
          {displayedIssues.map((issue: any) => (
            <div
              key={issue.id}
              className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container hover:border-outline-variant hover:shadow-md transition-all flex flex-col justify-between gap-3"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">adjust</span>
                    <span className="font-code-sm text-code-sm text-secondary font-medium font-mono">
                      {issue.repository} #{issue.number}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {issue.status === 'active_contribution' && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm text-[11px] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                        Active Contribution
                      </span>
                    )}
                    {issue.labels.map((lbl: any) => (
                      <span
                        key={lbl.text}
                        className={`px-2 py-0.5 rounded-full font-code-sm text-[11px] font-medium ${lbl.color}`}
                      >
                        {lbl.text}
                      </span>
                    ))}
                  </div>
                </div>

                <h3
                  onClick={() => navigate(`/issues/${issue.number}`)}
                  className="font-headline-sm text-headline-sm text-on-surface font-semibold hover:text-primary transition-colors cursor-pointer"
                >
                  {issue.title}
                </h3>

                <p className="font-body-md text-body-md text-secondary line-clamp-2">
                  {issue.summary}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-container-low font-code-sm text-code-sm text-secondary flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span>By {issue.author}</span>
                  <span>•</span>
                  <span>{issue.createdAt}</span>
                  <span>•</span>
                  <span className="text-tertiary font-medium">
                    {issue.acceptanceCriteriaCount} Acceptance Criteria
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/issues/${issue.number}`)}
                  className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-semibold transition-colors flex items-center gap-1"
                >
                  <span>Inspect Spec</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
