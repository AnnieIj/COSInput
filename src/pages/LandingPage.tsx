import React from 'react';
import { useNavigate } from 'react-router-dom';
import { COSInputLogo } from '../components/common/COSInputLogo';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen bg-surface px-4 lg:px-8 py-8 flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Top Welcome & Foundation Identity Banner */}
      <div className="relative rounded-2xl bg-surface-container-lowest p-6 sm:p-10 border border-surface-container shadow-sm overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col gap-4 max-w-3xl">
          <div className="flex items-center gap-3">
            <COSInputLogo size={42} showText={false} />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-headline-xl text-headline-xl text-on-surface font-extrabold tracking-tight">
                  COSInput
                </h1>
                <span className="px-2.5 py-0.5 rounded bg-primary text-on-primary font-code-sm text-code-sm font-semibold">
                  v0.1 Foundation
                </span>
              </div>
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider font-semibold">
                Contribution Open Source Input
              </span>
            </div>
          </div>

          <p className="font-body-lg text-body-lg text-secondary leading-relaxed">
            The sovereign developer workspace and continuous guardian platform for verified, non-destructive open source contributions.
            Preserving exact Google Stitch interface architecture, strict safety invariants, and isolated service boundaries.
          </p>

          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Open Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/contributions/381')}
              className="px-5 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm font-semibold border border-surface-container shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">play_circle</span>
              <span>Active Workspace #381</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/contributions/381/guardian')}
              className="px-5 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm font-semibold border border-surface-container shadow-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px] text-tertiary">security</span>
              <span>PR #405 Guardian</span>
            </button>
          </div>
        </div>

        {/* Foundation Invariants Banner Strip */}
        <div className="mt-8 pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-4 text-secondary font-code-sm text-code-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
            <span>Zero-Mock Address Enforcement</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[18px]">shield</span>
            <span>Non-Destructive AST Synthesized Repairs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-[18px]">lock</span>
            <span>Autonomous Merging Strictly Forbidden</span>
          </div>
        </div>
      </div>

      {/* Screen Directory Grid (Direct access to all major routes) */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            Core Screens & Subsystem Directory
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Stabilized routes based on approved Google Stitch design artifacts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Workspace Engine */}
          <div
            onClick={() => navigate('/contributions/381')}
            className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-primary-fixed/30 text-primary">
                  <span className="material-symbols-outlined text-[20px]">play_circle</span>
                </span>
                <span className="font-code-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-semibold">
                  /contributions/:id
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                Contribution Workspace
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                #381 Build Verification & Stake Flow, 9-step pipeline, AST indexer context, staged files, safety blocker banner.
              </p>
            </div>
            <div className="flex items-center text-primary font-code-sm text-code-sm font-semibold gap-1 pt-2 border-t border-surface-container-low">
              <span>Inspect Workspace</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 2: Guardian PR Cockpit */}
          <div
            onClick={() => navigate('/contributions/381/guardian')}
            className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-tertiary-fixed/30 text-tertiary">
                  <span className="material-symbols-outlined text-[20px]">security</span>
                </span>
                <span className="font-code-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-semibold">
                  /contributions/:id/guardian
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                Contribution Guardian Cockpit
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                PR #405 cockpit with 6 health cards, Four Failure Invariants, repair diff preview, audit timeline, and merge readiness radar.
              </p>
            </div>
            <div className="flex items-center text-primary font-code-sm text-code-sm font-semibold gap-1 pt-2 border-t border-surface-container-low">
              <span>Open Guardian</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 3: CI Guardian */}
          <div
            onClick={() => navigate('/contributions/381/ci')}
            className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-error-container text-error">
                  <span className="material-symbols-outlined text-[20px]">integration_instructions</span>
                </span>
                <span className="font-code-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-semibold">
                  /contributions/:id/ci
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                CI Guardian
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                GitHub Actions Workflow #91024, Typecheck failure TS2322, 5-stage resolution cycle, stdout runner logs, unified AST patch.
              </p>
            </div>
            <div className="flex items-center text-primary font-code-sm text-code-sm font-semibold gap-1 pt-2 border-t border-surface-container-low">
              <span>Inspect CI Pipeline</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 4: Merge Conflict Guardian */}
          <div
            onClick={() => navigate('/contributions/381/conflicts')}
            className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-secondary-container text-on-secondary-fixed">
                  <span className="material-symbols-outlined text-[20px]">call_merge</span>
                </span>
                <span className="font-code-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-semibold">
                  /contributions/:id/conflicts
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                Merge Conflict Guardian
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                Zero-loss atomic preservation, 3-column change breakdown, 3-way code canvas (Ours, Theirs, Synthesized Target), 4 safety gates.
              </p>
            </div>
            <div className="flex items-center text-primary font-code-sm text-code-sm font-semibold gap-1 pt-2 border-t border-surface-container-low">
              <span>View Conflict Canvas</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 5: Live Agent Run */}
          <div
            onClick={() => navigate('/runs/run_8f92a10c')}
            className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-primary-container text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">terminal</span>
                </span>
                <span className="font-code-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-semibold">
                  /runs/:runId
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                Live Agent Run & Continuous Pipeline
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                21-checkpoint execution timeline, 2 phases (Agent Implementation & Post-PR Guardian), 6 inspection tabs, Vitest terminal output.
              </p>
            </div>
            <div className="flex items-center text-primary font-code-sm text-code-sm font-semibold gap-1 pt-2 border-t border-surface-container-low">
              <span>Stream Live Run</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 6: Dashboard & Index */}
          <div
            onClick={() => navigate('/dashboard')}
            className="p-5 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-surface-container text-secondary">
                  <span className="material-symbols-outlined text-[20px]">grid_view</span>
                </span>
                <span className="font-code-sm text-[11px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-semibold">
                  /dashboard
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                Operations Dashboard
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                High-level operational overview: active repos, monitored pull requests, active runs, and quick actions.
              </p>
            </div>
            <div className="flex items-center text-primary font-code-sm text-code-sm font-semibold gap-1 pt-2 border-t border-surface-container-low">
              <span>Go to Dashboard</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
