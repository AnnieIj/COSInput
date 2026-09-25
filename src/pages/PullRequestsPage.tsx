import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mockGuardianPR405 } from '../data/mock';

export const PullRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const pr = mockGuardianPR405;

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
            Pull Requests
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Continuous Guardian surveillance and merge readiness tracking across open contributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/contributions/381')}
            className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Contribution</span>
          </button>
        </div>
      </div>

      {/* PR Card Monitored by Guardian */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-primary text-[20px]">call_merge</span>
            <span className="font-code-sm text-code-sm text-secondary font-medium font-mono">
              {pr.repository} #{pr.prNumber}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              {pr.statusTag}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-code-sm text-[11px] font-medium">
              <span className="material-symbols-outlined text-[12px] animate-pulse">security</span>
              {pr.guardianTag}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-code-sm text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
              {pr.alertTag}
            </span>
          </div>

          <span className="font-code-sm text-code-sm text-secondary">
            Synced with GitHub {pr.syncedAgo}
          </span>
        </div>

        <div className="space-y-1">
          <h2
            onClick={() => navigate('/contributions/381/guardian')}
            className="font-headline-lg text-headline-lg font-bold text-on-surface hover:text-primary transition-colors cursor-pointer"
          >
            PR #{pr.prNumber} — {pr.title}
          </h2>
          <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary flex-wrap">
            <span>Branch: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">{pr.branchName}</code></span>
            <span>•</span>
            <span>Target: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">{pr.baseBranch}</code></span>
            <span>•</span>
            <span>Head SHA: <code className="bg-surface-container px-1 py-0.5 rounded font-mono text-on-surface">{pr.headCommitSha}</code></span>
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
            <span className="font-headline-sm text-headline-sm text-primary font-bold mt-0.5 font-mono">{pr.readinessPercentage}%</span>
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
              onClick={() => navigate('/contributions/381/guardian')}
              className="px-4 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-semibold transition-colors shadow-sm"
            >
              Open Guardian Cockpit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
