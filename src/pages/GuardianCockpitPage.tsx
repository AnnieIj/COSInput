import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockGuardianPR405 } from '../data/mock';
import { PRHealthCockpit } from '../components/common/PRHealthCockpit';
import { FailureClassificationsStrip } from '../components/common/FailureClassificationsStrip';
import { ActivityEvents } from '../components/common/ActivityEvents';
import { RadarGauge } from '../components/common/RadarGauge';

export const GuardianCockpitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [patchApplied, setPatchApplied] = useState(false);
  const [copyingDiff, setCopyingDiff] = useState(false);

  const pr = mockGuardianPR405;

  const handleApplyPatch = () => {
    setPatchApplied(true);
    setTimeout(() => {
      alert("Patch approved and pushed to PR #405! GitHub Actions CI workflow re-triggered.");
    }, 400);
  };

  const handleCopyDiff = () => {
    setCopyingDiff(true);
    navigator.clipboard?.writeText(`@@ -139,7 +139,7 @@
-     const stakeWei = parseEther(stakeInputAmount);
+     const stakeWei: bigint = BigInt(parseUnits(stakeInputAmount, 18).toString());`);
    setTimeout(() => setCopyingDiff(false), 2000);
  };

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-[1720px] mx-auto">
      {/* Top Context & Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <nav className="flex items-center gap-2 font-code-sm text-code-sm text-secondary">
            <span
              onClick={() => navigate('/repositories')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              DigiNodes
            </span>
            <span>/</span>
            <span
              onClick={() => navigate(`/contributions/${id || '381'}`)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              truthbounty-frontend
            </span>
            <span>/</span>
            <span
              onClick={() => navigate('/pull-requests')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Pull Requests
            </span>
            <span>/</span>
            <span className="font-medium text-on-surface">#{pr.prNumber}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              PR #{pr.prNumber} — {pr.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-code-sm font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                {pr.statusTag}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary-container text-on-primary font-code-sm text-code-sm font-medium shadow-sm">
                <span className="material-symbols-outlined text-[13px] animate-pulse">security</span>
                {pr.guardianTag}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-error-container text-on-error-container font-code-sm text-code-sm font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                {pr.alertTag}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-code-sm text-code-sm text-secondary pt-1">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-tertiary">sync</span>
              Synced with GitHub {pr.syncedAgo}
            </span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-primary">fork_right</span>
              Base: <span className="font-medium text-on-surface">{pr.baseBranch}</span> ({pr.commitsAhead} commits ahead detected)
            </span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">commit</span>
              Head: <code className="bg-surface-container-highest/60 px-1 py-0.5 rounded text-on-surface font-semibold font-mono">{pr.headCommitSha}</code>
            </span>
            <span className="text-outline-variant">•</span>
            <span className="text-on-secondary-container bg-surface-container-high px-2 py-0.5 rounded-full font-mono">
              {pr.branchName}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start lg:self-center shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(`/contributions/${id || '381'}/conflicts`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm font-medium transition-all border border-surface-container shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">merge</span>
            <span>Sync Upstream</span>
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm font-medium transition-all border border-surface-container shadow-sm"
          >
            <span>View on GitHub</span>
            <span className="material-symbols-outlined text-[15px]">open_in_new</span>
          </a>
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-headline-sm text-headline-sm font-medium transition-all ${
              isPaused
                ? 'bg-primary-container text-on-primary'
                : 'bg-error-container/40 hover:bg-error-container text-error'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isPaused ? 'play_arrow' : 'pause_circle'}
            </span>
            <span>{isPaused ? 'Resume Guardian' : 'Pause Guardian'}</span>
          </button>
        </div>
      </div>

      {/* Alert Banner (High Contrast Actionable) */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-error/10 via-surface-container-low to-primary/5 p-4 sm:p-5 border border-error/20 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0 shadow-md">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[10px] uppercase tracking-wider text-error font-bold">
                  {pr.alertBanner.badge}
                </span>
                <span className="text-xs text-secondary">• {pr.alertBanner.subtext}</span>
              </div>
              <p className="font-body-lg text-body-lg font-medium text-on-surface max-w-3xl leading-snug">
                {pr.alertBanner.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <button
              type="button"
              onClick={() => navigate(`/contributions/${id || '381'}/ci`)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm shadow-md transition-all font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
              <span>Review CI Repair & Feedback</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/contributions/${id || '381'}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-headline-sm text-headline-sm border border-surface-container shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>Run Full Verification</span>
            </button>
          </div>
        </div>
      </div>

      {/* PR Health Cockpit: 6 Status Cards Grid */}
      <PRHealthCockpit cards={pr.healthCards} />

      {/* Four Failure Classification Invariants Reference Strip */}
      <FailureClassificationsStrip cards={pr.failureClassifications} />

      {/* Active Diagnosis & Diff Preview Unit */}
      <div className="rounded-xl bg-surface-container-lowest p-5 border border-surface-container shadow-sm space-y-4" id="ci-repair">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">build_circle</span>
            </span>
            <div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Synthesized Non-Destructive Repair
              </h3>
              <p className="font-code-sm text-code-sm text-secondary">
                Target: <code className="text-on-surface font-semibold font-mono">{pr.synthesizedRepair.targetFile}</code> • {pr.synthesizedRepair.diagnosticNote}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={patchApplied}
              onClick={handleApplyPatch}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-headline-sm text-headline-sm font-semibold shadow-sm transition-all ${
                patchApplied
                  ? 'bg-tertiary-container text-on-tertiary-container'
                  : 'bg-primary-container hover:bg-primary text-on-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {patchApplied ? 'done' : 'check'}
              </span>
              <span>{patchApplied ? 'Patch Pushed to PR #405' : 'Approve & Push Patch'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyDiff}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-code-sm text-code-sm border border-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copyingDiff ? 'check' : 'content_copy'}
              </span>
              <span>{copyingDiff ? 'Copied' : 'Copy Diff'}</span>
            </button>
          </div>
        </div>

        {/* Diff Box */}
        <div className="rounded-lg overflow-hidden bg-inverse-surface text-surface-container-lowest font-code-sm text-code-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-surface-container-highest/10 font-code-sm text-code-sm text-surface-variant border-b border-surface-variant/10">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="material-symbols-outlined text-[15px]">data_object</span>
              <span>src/components/StakeForm.tsx</span>
            </span>
            <span className="font-mono">{pr.synthesizedRepair.hunkRange}</span>
          </div>

          <div className="p-4 space-y-0.5 overflow-x-auto leading-relaxed font-mono">
            {pr.synthesizedRepair.lines.map((l, i) => (
              <div
                key={i}
                className={`flex gap-3 px-2 py-0.5 rounded ${
                  l.type === 'removed'
                    ? 'bg-error/20 text-on-error font-semibold'
                    : l.type === 'added'
                    ? 'bg-tertiary-container/30 text-tertiary-fixed font-semibold'
                    : 'text-surface-variant/80'
                }`}
              >
                <span className="w-8 select-none text-right opacity-40 shrink-0">{l.num}</span>
                <span className="whitespace-pre">{l.content}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Split: Audit Ledger & Merge Readiness Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (60%): Interactive Event Timeline */}
        <div className="lg:col-span-7">
          <ActivityEvents events={pr.auditTimeline} />
        </div>

        {/* Right Column (40%): Merge Readiness Assessment Gauge */}
        <div className="lg:col-span-5">
          <RadarGauge
            score={pr.readinessPercentage}
            isReady={pr.isMergeReady}
            statusText="NOT MERGE READY"
            statusSubtext="Blocked by 1 failing CI check & maintainer changes requested."
            checklist={pr.invariantsChecklist as any}
          />
        </div>
      </div>
    </div>
  );
};
