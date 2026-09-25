import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';
import { mockIssues } from '../data/mock';
import type { GitHubIssueRef, GitHubIssueCommentRef, SanitizedGitHubError } from '../services/types';

export const IssueDetailPage: React.FC = () => {
  const { issueId } = useParams<{ issueId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { mode, isLive } = useMode();

  const [realIssue, setRealIssue] = useState<GitHubIssueRef | null>(null);
  const [comments, setComments] = useState<GitHubIssueCommentRef[]>([]);
  const [loading, setLoading] = useState<boolean>(isLive);
  const [error, setError] = useState<SanitizedGitHubError | null>(null);

  const repoQuery = searchParams.get('repo');

  useEffect(() => {
    if (!isLive) {
      setLoading(false);
      setError(null);
      return;
    }

    const fetchIssueDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const num = parseInt(issueId || '0', 10);
        let targetOwner = '';
        let targetRepo = '';

        if (repoQuery) {
          const parts = repoQuery.split('/');
          if (parts.length === 2) {
            targetOwner = parts[0];
            targetRepo = parts[1];
          }
        } else {
          // Find repo containing this issue
          const repos = await githubService.listRepositories();
          if (repos.length > 0) {
            targetOwner = repos[0].owner;
            targetRepo = repos[0].name;
          }
        }

        if (!targetOwner || !targetRepo) {
          throw {
            classification: 'NOT_FOUND',
            statusCode: 404,
            message: 'No authorized repository specified for issue lookup.',
          };
        }

        const issue = await githubService.getIssue(targetOwner, targetRepo, num);
        setRealIssue(issue);

        // Fetch comments if issue found
        if (issue) {
          const fetchedComments = await githubService
            .listIssueComments(targetOwner, targetRepo, num)
            .catch(() => []);
          setComments(fetchedComments);
        }
      } catch (err: any) {
        setError(
          err.classification
            ? err
            : {
                classification: 'GITHUB_SERVICE_FAILURE',
                statusCode: 500,
                message: err.message || 'Failed to retrieve issue details.',
              }
        );
      } finally {
        setLoading(false);
      }
    };

    fetchIssueDetail();
  }, [isLive, issueId, repoQuery]);

  // Demo fallback strictly when mode === 'demo'
  const demoIssue = mockIssues.find((i) => String(i.number) === issueId) || mockIssues[0];

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary">
        <button
          type="button"
          onClick={() => navigate('/issues')}
          className="hover:text-primary transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Issues</span>
        </button>
        <span>/</span>
        <span className="text-on-surface font-semibold font-mono">
          {isLive ? realIssue?.repository || repoQuery || 'Authorized Repo' : demoIssue.repository}
        </span>
        <span>/</span>
        <span className="text-primary font-bold font-mono">#{issueId}</span>
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
            onClick={() => navigate('/issues')}
            className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold shrink-0"
          >
            Back to Issues
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLive && loading && (
        <div className="bg-surface-container-lowest rounded-xl p-8 border border-surface-container animate-pulse space-y-4">
          <div className="h-6 bg-surface-container rounded w-1/4"></div>
          <div className="h-8 bg-surface-container rounded w-3/4"></div>
          <div className="h-32 bg-surface-container-low rounded w-full"></div>
        </div>
      )}

      {/* Real Issue Details View (Live Mode) */}
      {isLive && !loading && realIssue && (
        <>
          {/* Main Card Header */}
          <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-code-sm text-code-sm text-secondary font-medium font-mono">
                    {realIssue.repository} #{realIssue.number}
                  </span>
                  <span className="font-code-sm text-code-sm text-outline">•</span>
                  <span className="font-code-sm text-code-sm text-secondary">
                    Opened by <strong>@{realIssue.author}</strong> on {new Date(realIssue.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-code-sm text-[10px] font-bold uppercase ${
                      realIssue.state === 'open'
                        ? 'bg-tertiary-container/20 text-tertiary'
                        : 'bg-surface-container text-secondary'
                    }`}
                  >
                    {realIssue.state}
                  </span>
                </div>

                <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
                  {realIssue.title}
                </h1>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={realIssue.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium border border-surface-container transition-all flex items-center gap-1.5"
                >
                  <span>View on GitHub</span>
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                </a>
              </div>
            </div>

            {/* Labels & Assignees */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-surface-container-low">
              <div className="flex items-center gap-1.5 flex-wrap">
                {realIssue.labels.map((lbl) => (
                  <span
                    key={lbl.name}
                    className="px-2.5 py-0.5 rounded-full font-code-sm text-[11px] font-semibold bg-surface-container text-on-surface border border-surface-container-high/40"
                  >
                    {lbl.name}
                  </span>
                ))}
              </div>

              {realIssue.assignees.length > 0 && (
                <div className="flex items-center gap-1 text-code-sm text-secondary">
                  <span>Assignees:</span>
                  <span className="font-semibold text-on-surface font-mono">
                    {realIssue.assignees.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Two-Column Grid: Body & Upcoming Action */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Body & Comments */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Body */}
              <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
                  <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
                    Issue Description
                  </span>
                  <span className="font-code-sm text-code-sm text-secondary">
                    Updated {new Date(realIssue.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap font-sans">
                  {realIssue.body || 'No description provided by issue author.'}
                </div>
              </div>

              {/* Comments Thread */}
              {comments.length > 0 && (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
                  <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    Discussion & Activity ({comments.length})
                  </h3>
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-lg bg-surface-container-low border border-surface-container space-y-2"
                      >
                        <div className="flex items-center justify-between font-code-sm text-code-sm">
                          <span className="font-bold text-on-surface font-mono">@{c.author}</span>
                          <span className="text-secondary">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 4 Cols: Upcoming Agent Analysis Notice */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">rocket_launch</span>
                  <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    Repository Intelligence
                  </h3>
                </div>

                <div className="p-4 rounded-lg bg-surface-container-low border border-surface-container space-y-2">
                  <div className="flex items-center gap-1.5 text-primary font-label-caps text-[10px] font-bold">
                    <span className="material-symbols-outlined text-[15px]">insights</span>
                    <span>FOUNDATION v0.3 ANALYSIS ACTIVE</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                    Inspect repository context, contributor instructions, extract acceptance criteria, and generate a trustworthy implementation plan.
                  </p>
                </div>

                {/* Start Contribution Button */}
                <button
                  type="button"
                  onClick={async () => {
                    const repoParts = (realIssue.repository || '').split('/');
                    const owner = repoParts[0] || 'repository';
                    const repo = repoParts[1] || 'project';
                    try {
                      const res = await githubService.createContributionSession({
                        owner,
                        repo,
                        issueNumber: realIssue.number,
                        issueTitle: realIssue.title,
                        issueUrl: realIssue.htmlUrl,
                      });
                      if (res.success && res.session?.id) {
                        navigate(`/contributions/${res.session.id}`);
                        return;
                      }
                    } catch {
                      // Fall back
                    }
                    const safeOwner = owner.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    const safeRepo = repo.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    navigate(`/contributions/contrib-${safeOwner}-${safeRepo}-${realIssue.number}`);
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                  <span>Start Contribution Analysis</span>
                </button>
              </div>

              {/* Metadata Summary Card */}
              <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm font-code-sm text-code-sm space-y-2">
                <div className="flex justify-between p-2 rounded bg-surface-container-low">
                  <span className="text-secondary">Comments:</span>
                  <span className="font-semibold text-on-surface font-mono">{realIssue.commentsCount}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-surface-container-low">
                  <span className="text-secondary">State:</span>
                  <span className="font-semibold text-on-surface font-mono uppercase">{realIssue.state}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-surface-container-low">
                  <span className="text-secondary">Integration:</span>
                  <span className="font-semibold text-tertiary font-mono">Live Read-Only</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Demo Mode View */}
      {!isLive && (
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold">
              #{demoIssue.number} {demoIssue.title}
            </h1>
            <span className="font-label-caps text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded font-bold">
              Demo Fixture
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary leading-relaxed p-4 rounded-lg bg-surface-container-low">
            {demoIssue.summary}
          </p>
        </div>
      )}
    </div>
  );
};
