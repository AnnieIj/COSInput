import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';
import { mockRepositories } from '../data/mock';
import type { GitHubRepoSummary, SanitizedGitHubError } from '../services/types';

export const RepositoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { mode, isLive, connectionState } = useMode();

  const [realRepos, setRealRepos] = useState<GitHubRepoSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(isLive);
  const [error, setError] = useState<SanitizedGitHubError | null>(null);

  const fetchRealRepositories = async () => {
    setLoading(true);
    setError(null);
    try {
      const repos = await githubService.listRepositories();
      setRealRepos(repos);
    } catch (err: any) {
      setError(
        err.classification
          ? err
          : {
              classification: 'GITHUB_SERVICE_FAILURE',
              statusCode: 500,
              message: err.message || 'Failed to retrieve repositories from GitHub App installation.',
            }
      );
      setRealRepos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLive) {
      fetchRealRepositories();
    } else {
      setLoading(false);
      setError(null);
    }
  }, [isLive, connectionState]);

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              Authorized Repositories
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
              ? 'Repositories authorized through your COSInput GitHub App installation.'
              : 'Displaying offline demonstration repository fixtures.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLive && (
            <button
              type="button"
              disabled={loading}
              onClick={fetchRealRepositories}
              className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold border border-surface-container shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span>Manage App Installations</span>
          </button>
        </div>
      </div>

      {/* Error Banner (Never silent fallback) */}
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
                Strict Rule: COSInput will not fall back to mock data. Please verify your GitHub App installation in Settings.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-3 py-1.5 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold shrink-0"
          >
            Configure in Settings
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLive && loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container animate-pulse h-48 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="h-5 bg-surface-container rounded w-3/4"></div>
                <div className="h-4 bg-surface-container rounded w-1/2"></div>
                <div className="h-10 bg-surface-container-low rounded w-full"></div>
              </div>
              <div className="h-4 bg-surface-container rounded w-1/3"></div>
            </div>
          ))}
        </div>
      )}

      {/* Live Mode - No Repositories Found */}
      {isLive && !loading && !error && realRepos.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-10 border border-surface-container text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-outline text-[48px]">folder_off</span>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            No Repositories Authorized Yet
          </h2>
          <p className="font-body-md text-body-md text-secondary max-w-md">
            The COSInput GitHub App is either not installed or has not been granted access to any repositories.
          </p>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="mt-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold shadow-md"
          >
            Install COSInput GitHub App
          </button>
        </div>
      )}

      {/* Live Mode - Real Repositories Grid */}
      {isLive && !loading && realRepos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {realRepos.map((repo) => (
            <div
              key={repo.id}
              className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container hover:border-primary shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary text-[22px]">source</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate font-mono">
                      {repo.fullName}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container font-code-sm text-[10px] text-secondary font-bold uppercase shrink-0">
                    {repo.isPrivate ? 'Private' : 'Public'}
                  </span>
                </div>

                <p className="font-body-md text-body-md text-secondary line-clamp-2">
                  {repo.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary pt-1">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">fork_right</span>
                    <code className="font-mono text-on-surface">{repo.defaultBranch}</code>
                  </span>
                  <span>•</span>
                  <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-container-low font-code-sm text-code-sm">
                <div className="flex items-center gap-3 text-secondary">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">adjust</span>
                    {repo.openIssuesCount} issues
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">star</span>
                    {repo.stars}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-secondary hover:text-on-surface"
                    title="Open on GitHub"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate(`/issues?repo=${encodeURIComponent(repo.fullName)}`)}
                    className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-semibold transition-colors"
                  >
                    View Issues
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Demo Mode - Isolated Mock Repositories */}
      {!isLive && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockRepositories.map((repo) => (
            <div
              key={repo.id}
              className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container hover:border-outline-variant shadow-sm flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary text-[22px]">source</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate font-mono">
                      {repo.fullName}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-[11px] font-semibold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                    Guardian Active
                  </span>
                </div>

                <p className="font-body-md text-body-md text-secondary line-clamp-2">
                  {repo.description}
                </p>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {repo.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 rounded bg-surface-container font-code-sm text-[11px] text-on-surface font-medium font-mono"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-container-low text-secondary font-code-sm text-code-sm">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">star</span>
                    {repo.stars.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">adjust</span>
                    {repo.openIssuesCount} issues
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/issues')}
                  className="text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <span>View Issues</span>
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
