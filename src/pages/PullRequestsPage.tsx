import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';
import { mockGuardianPR405 } from '../data/mock';

interface ContributionSessionSummary {
  id: string;
  repositoryOwner: string;
  repositoryName: string;
  upstreamRepository: string;
  issueNumber: number;
  issueTitle: string;
  analysisStatus: string;
  currentSubmission?: {
    status: string;
    pullRequestNumber?: number;
    pullRequestUrl?: string;
    commitSha?: string;
    targetBranch?: string;
    pushedAt?: string;
  };
  updatedTimestamp: string;
}

export const PullRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLive, connectionState } = useMode();
  const [sessions, setSessions] = useState<ContributionSessionSummary[]>([]);
  const [githubPulls, setGithubPulls] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'guardian' | 'submitted' | 'active'>('all');

  const defaultPR = mockGuardianPR405;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [contribRes, pullsData] = await Promise.all([
          githubService.listContributions().catch(() => ({ success: false, sessions: [] })),
          isLive && connectionState === 'APP_INSTALLED'
            ? githubService.listPullRequests().catch(() => [])
            : Promise.resolve([]),
        ]);

        if (isMounted) {
          if (contribRes.success && Array.isArray(contribRes.sessions)) {
            setSessions(contribRes.sessions);
          }
          if (Array.isArray(pullsData)) {
            setGithubPulls(pullsData);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isLive, connectionState]);

  // Extract sessions that have reached commit, push, or PR stage
  const submissionSessions = sessions.filter(
    (s) => s.currentSubmission && ['COMMITTED', 'PUSH_COMPLETED', 'PR_OPENED'].includes(s.currentSubmission.status)
  );

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
            Pull Requests & Guardian Cockpit
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Continuous Guardian surveillance, CI diagnostics, and merge readiness across open contributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/issues')}
            className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Contribution</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-code-sm text-code-sm font-medium transition-all ${
            activeFilter === 'all'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          All Monitored ({1 + submissionSessions.length + githubPulls.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('guardian')}
          className={`px-3 py-1.5 rounded-lg font-code-sm text-code-sm font-medium transition-all ${
            activeFilter === 'guardian'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-secondary hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          Guardian Active (1)
        </button>
        {submissionSessions.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter('submitted')}
            className={`px-3 py-1.5 rounded-lg font-code-sm text-code-sm font-medium transition-all ${
              activeFilter === 'submitted'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            COSInput Submissions ({submissionSessions.length})
          </button>
        )}
        {githubPulls.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-code-sm text-code-sm font-medium transition-all ${
              activeFilter === 'active'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            GitHub Upstream PRs ({githubPulls.length})
          </button>
        )}
      </div>

      {/* Primary Reference PR Monitored by Guardian Cockpit */}
      {(activeFilter === 'all' || activeFilter === 'guardian') && (
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-primary text-[20px]">call_merge</span>
              <span className="font-code-sm text-code-sm text-secondary font-medium font-mono">
                {defaultPR.repository} #{defaultPR.prNumber}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                {defaultPR.statusTag}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-code-sm text-[11px] font-medium">
                <span className="material-symbols-outlined text-[12px] animate-pulse">security</span>
                {defaultPR.guardianTag}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-code-sm text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                {defaultPR.alertTag}
              </span>
            </div>

            <span className="font-code-sm text-code-sm text-secondary">
              Synced with GitHub {defaultPR.syncedAgo}
            </span>
          </div>

          <div className="space-y-1">
            <h2
              onClick={() => navigate('/contributions/381/guardian')}
              className="font-headline-lg text-headline-lg font-bold text-on-surface hover:text-primary transition-colors cursor-pointer"
            >
              PR #{defaultPR.prNumber} — {defaultPR.title}
            </h2>
            <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary flex-wrap">
              <span>
                Branch:{' '}
                <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">
                  {defaultPR.branchName}
                </code>
              </span>
              <span>•</span>
              <span>
                Target:{' '}
                <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">
                  {defaultPR.baseBranch}
                </code>
              </span>
              <span>•</span>
              <span>
                Head SHA:{' '}
                <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">
                  {defaultPR.headCommitSha}
                </code>
              </span>
            </div>
          </div>

          {/* PR Quick Status Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col">
              <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold">CI Status</span>
              <span className="font-headline-sm text-headline-sm text-error font-bold mt-0.5">1 Failure</span>
              <span className="font-code-sm text-[11px] text-secondary">TS2322 diagnosed</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col">
              <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold">Acceptance</span>
              <span className="font-headline-sm text-headline-sm text-tertiary font-bold mt-0.5">6 / 6 Passed</span>
              <span className="font-code-sm text-[11px] text-secondary">Harness verified</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col">
              <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold">Merge Conflicts</span>
              <span className="font-headline-sm text-headline-sm text-tertiary font-bold mt-0.5">Clean Tree</span>
              <span className="font-code-sm text-[11px] text-secondary">0 active hunks</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col">
              <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold">Merge Readiness</span>
              <span className="font-headline-sm text-headline-sm text-primary font-bold mt-0.5 font-mono">
                {defaultPR.readinessPercentage}%
              </span>
              <span className="font-code-sm text-[11px] text-secondary">Awaiting maintainer</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-surface-container-low flex-wrap gap-2">
            <span className="font-body-sm text-body-sm text-secondary">
              Strict Non-Circumvention Policy active: Autonomous merging is strictly forbidden.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/contributions/381/ci')}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium border border-surface-container transition-colors"
              >
                Inspect CI
              </button>
              <button
                type="button"
                onClick={() => navigate('/contributions/381/conflicts')}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium border border-surface-container transition-colors"
              >
                Conflicts
              </button>
              <button
                type="button"
                onClick={() => navigate('/contributions/381/reviews')}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium border border-surface-container transition-colors"
              >
                Reviews
              </button>
              <button
                type="button"
                onClick={() => navigate('/contributions/381/guardian')}
                className="px-4 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-semibold transition-colors shadow-sm"
              >
                Open Guardian Cockpit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active COSInput Submission Sessions */}
      {(activeFilter === 'all' || activeFilter === 'submitted') && submissionSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">assignment_turned_in</span>
            <span>Active Controlled Submissions</span>
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {submissionSessions.map((s) => {
              const sub = s.currentSubmission!;
              const isPrOpened = sub.status === 'PR_OPENED';

              return (
                <div
                  key={s.id}
                  className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-code-sm text-code-sm text-secondary font-medium font-mono">
                        {s.upstreamRepository} #{s.issueNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-code-sm text-[11px] font-semibold ${
                          isPrOpened
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : 'bg-amber-500/20 text-amber-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isPrOpened ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        ></span>
                        {isPrOpened ? 'PR Opened' : sub.status.replace(/_/g, ' ')}
                      </span>
                      {sub.pullRequestNumber && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-code-sm text-[11px] font-bold">
                          PR #{sub.pullRequestNumber}
                        </span>
                      )}
                    </div>
                    <span className="font-code-sm text-code-sm text-secondary">
                      Updated {new Date(s.updatedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3
                    onClick={() => navigate(`/contributions/${s.id}`)}
                    className="font-headline-sm text-headline-sm font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer"
                  >
                    #{s.issueNumber} — {s.issueTitle}
                  </h3>

                  <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary flex-wrap">
                    {sub.commitSha && (
                      <span>
                        Commit: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">{sub.commitSha.substring(0, 7)}</code>
                      </span>
                    )}
                    {sub.targetBranch && (
                      <>
                        <span>•</span>
                        <span>
                          Target Branch: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">{sub.targetBranch}</code>
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-container-low flex-wrap gap-2">
                    <span className="font-body-sm text-body-sm text-secondary">
                      {isPrOpened
                        ? 'PR awaiting maintainer sign-off & CI verification.'
                        : 'Branch pushed to contributor fork. PR approval pending.'}
                    </span>
                    <div className="flex items-center gap-2">
                      {sub.pullRequestUrl && (
                        <a
                          href={sub.pullRequestUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium border border-surface-container flex items-center gap-1"
                        >
                          <span>View on GitHub</span>
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/contributions/${s.id}`)}
                        className="px-4 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold transition-colors shadow-sm"
                      >
                        Inspect Workspace
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GitHub Upstream Pull Requests */}
      {(activeFilter === 'all' || activeFilter === 'active') && githubPulls.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">fork_right</span>
            <span>Authorized Repositories Pull Requests</span>
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {githubPulls.map((pull) => (
              <div
                key={pull.id}
                className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-code-sm text-code-sm text-secondary font-medium font-mono">
                      {pull.repository || 'Upstream'} #{pull.number}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 font-code-sm text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {pull.state}
                    </span>
                    {pull.draft && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-code-sm text-[11px]">
                        Draft
                      </span>
                    )}
                  </div>
                  <span className="font-code-sm text-code-sm text-secondary">
                    Created {new Date(pull.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  #{pull.number} — {pull.title}
                </h3>

                <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary flex-wrap">
                  <span>
                    Head: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">{pull.head?.ref}</code>
                  </span>
                  <span>•</span>
                  <span>
                    Base: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">{pull.base?.ref}</code>
                  </span>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-surface-container-low">
                  <a
                    href={pull.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium border border-surface-container flex items-center gap-1"
                  >
                    <span>Inspect on GitHub</span>
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
