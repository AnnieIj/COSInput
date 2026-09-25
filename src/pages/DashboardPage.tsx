import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mockRepositories, mockIssues, mockContribution381, mockGuardianPR405 } from '../data/mock';
import { IssueCard } from '../components/common/IssueCard';
import { RepositoryCard } from '../components/common/RepositoryCard';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full px-4 lg:px-8 py-6 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Top Welcome & KPI Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Continuous execution cockpit & active open-source contribution engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/contributions/381')}
            className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>New Contribution</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
            Active Runs
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-headline-xl text-headline-xl font-bold text-on-surface">1</span>
            <span className="font-code-sm text-code-sm text-tertiary flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              Live
            </span>
          </div>
          <span className="font-code-sm text-[11px] text-secondary">#381 in Implementation</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
            Guardian Watching
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-headline-xl text-headline-xl font-bold text-primary">4 PRs</span>
            <span className="font-code-sm text-code-sm text-error font-semibold">1 Alert</span>
          </div>
          <span className="font-code-sm text-[11px] text-secondary">PR #405 needs sign-off</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
            Indexed Repositories
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-headline-xl text-headline-xl font-bold text-on-surface">3</span>
            <span className="font-code-sm text-code-sm text-tertiary">All Synced</span>
          </div>
          <span className="font-code-sm text-[11px] text-secondary">42 files cached</span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col justify-between">
          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
            Assigned Issues
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-headline-xl text-headline-xl font-bold text-on-surface">14</span>
            <span className="font-code-sm text-code-sm text-primary font-semibold">1 Active</span>
          </div>
          <span className="font-code-sm text-[11px] text-secondary">2 ready for triage</span>
        </div>
      </div>

      {/* Active Work In Progress Banner */}
      <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[20px]">terminal</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-label-caps text-[10px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-semibold">
                ACTIVE WORKSPACE
              </span>
              <span className="font-code-sm text-code-sm text-secondary">
                {mockContribution381.repository}
              </span>
              <span className="font-code-sm text-code-sm text-outline">•</span>
              <span className="font-code-sm text-code-sm text-tertiary flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                Step 4 of 9 (Implementation)
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              #{mockContribution381.issueNumber} {mockContribution381.title}
            </h3>
            <p className="font-body-sm text-body-sm text-secondary line-clamp-1 max-w-2xl">
              {mockContribution381.specContext.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
          <button
            type="button"
            onClick={() => navigate('/runs/run_8f92a10c')}
            className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">play_circle</span>
            <span>Live Stream</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/contributions/${mockContribution381.id}`)}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>Resume Workspace</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Two Column Split: Issues and Repositories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Available Issues */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">adjust</span>
              <span>Available Contributions & Issues</span>
            </h2>
            <button
              type="button"
              onClick={() => navigate('/issues')}
              className="text-primary hover:underline font-code-sm text-code-sm font-semibold"
            >
              View all 14 issues
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {mockIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>

        {/* Right 5 Cols: Guardian Radar Preview & Monitored Repos */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Quick Guardian Monitor Widget */}
          <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-[20px]">security</span>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  Guardian Radar
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-error font-code-sm text-[11px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                Action Required
              </span>
            </div>

            <p className="font-body-sm text-body-sm text-secondary">
              PR #405: 1 CI check failed (<code className="text-error font-bold">TS2322</code>) & maintainer requested changes. Non-destructive repair prepared.
            </p>

            <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-caps text-[10px] text-secondary uppercase">Merge Readiness</span>
                <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  {mockGuardianPR405.readinessPercentage}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/contributions/381/guardian')}
                className="px-3.5 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-semibold transition-colors shadow-sm"
              >
                Inspect PR Cockpit
              </button>
            </div>
          </div>

          {/* Monitored Repositories */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
                <span>Authorized Repositories</span>
              </h2>
              <button
                type="button"
                onClick={() => navigate('/repositories')}
                className="text-primary hover:underline font-code-sm text-code-sm font-semibold"
              >
                Manage
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {mockRepositories.slice(0, 2).map((repo) => (
                <RepositoryCard key={repo.id} repo={repo} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
