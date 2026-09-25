import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockMergeConflictsData } from '../data/mock';
import { ConflictStatusCanvas } from '../components/common/ConflictStatusCanvas';

export const MergeConflictPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeFileId, setActiveFileId] = useState('stakeform');
  const [rebased, setRebased] = useState(false);
  const [rebasing, setRebasing] = useState(false);

  const conflictData = mockMergeConflictsData;
  const currentFile = conflictData.files.find((f) => f.id === activeFileId) || conflictData.files[0];

  const handleRebase = () => {
    setRebasing(true);
    setTimeout(() => {
      setRebasing(false);
      setRebased(true);
      alert("Branch cosinput/381-verification-stake cleanly rebased onto upstream main with zero code loss.");
    }, 1200);
  };

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Alert & Context Strip */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex items-center gap-1.5 font-code-sm text-code-sm text-secondary">
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
              onClick={() => navigate(`/contributions/${id || '381'}/guardian`)}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Guardian
            </span>
            <span>/</span>
            <span className="text-primary font-semibold">Merge Conflicts</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container-high rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
            <span className="font-label-caps text-[10px] uppercase text-error font-bold">
              Conflict State: Intercepted
            </span>
            <span className="font-code-sm text-[11px] text-secondary font-mono">
              PR #{conflictData.prNumber} · {conflictData.sourceBranch} → {conflictData.targetBranch}
            </span>
          </div>
        </div>

        {/* Hero Conflict Banner */}
        <div className="relative bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-md overflow-hidden">
          <div className="absolute -top-12 -right-8 w-48 h-48 bg-error-container/30 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="material-symbols-outlined text-error text-[24px]">error</span>
                <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
                  Merge Conflict Guardian
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-caps text-[10px] uppercase font-bold tracking-wider">
                  Action Required
                </span>
              </div>
              <p className="font-body-md text-body-md text-secondary leading-relaxed">
                The base branch <span className="font-code-sm text-code-sm bg-surface-container px-1 py-0.5 rounded text-on-surface font-semibold font-mono">main</span> advanced after this contribution branch split. 
                <span className="font-semibold text-on-surface"> {conflictData.conflictFilesCount} files</span> contain intersecting AST-level hunks that require atomic validation.
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="bg-surface-container-low px-4 py-2.5 rounded-lg border border-surface-container shadow-sm flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="font-label-caps text-[10px] text-secondary uppercase">Preservation Protocol</span>
                  <span className="font-headline-sm text-headline-sm text-tertiary font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">verified_user</span>
                    {conflictData.protocol}
                  </span>
                </div>
                <div className="h-8 w-px bg-surface-container"></div>
                <div className="flex flex-col">
                  <span className="font-label-caps text-[10px] text-secondary uppercase">Automated Synthesis</span>
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">
                    {conflictData.synthesisStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-container-low flex flex-wrap items-center justify-between gap-2 text-body-sm font-body-sm text-secondary">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">shield_lock</span>
              <span><strong>Invariant Badge:</strong> {conflictData.invariantBadge}</span>
            </div>
            <span className="font-code-sm text-code-sm text-secondary font-mono">
              Engine: {conflictData.engineVersion}
            </span>
          </div>
        </div>
      </div>

      {/* File Switcher Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-surface-container-lowest p-1.5 rounded-xl border border-surface-container shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto">
          {conflictData.files.map((f) => {
            const isActive = f.id === activeFileId;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFileId(f.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-code-sm text-code-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">code</span>
                <span className="font-mono">{f.path}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-surface-container-lowest/20 font-label-caps text-[9px] font-bold">
                  {f.hunksCount} Hunk
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-2 py-1 font-label-caps text-[10px] text-secondary uppercase tracking-wider">
          <span>Active Focus: {currentFile.linesFocus}</span>
          <span className="text-outline-variant">•</span>
          <span>Context window: {currentFile.contextWindow}</span>
        </div>
      </div>

      {/* Plain Language Change Explanation Grid (3 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Our Contribution */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Our Contribution
              </span>
              <span className="font-code-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container-low text-secondary font-medium font-mono">
                {currentFile.ourContribution.badge}
              </span>
            </div>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              {currentFile.ourContribution.title}
            </h2>
            <p className="font-body-md text-body-md text-secondary leading-relaxed">
              {currentFile.ourContribution.description}
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-surface-container-low flex items-center justify-between text-body-sm font-body-sm text-secondary font-code-sm">
            <span className="text-primary font-mono">{currentFile.ourContribution.branchRef}</span>
            <span className="text-tertiary font-semibold">{currentFile.ourContribution.tag}</span>
          </div>
        </div>

        {/* Card 2: Upstream / Maintainer */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[10px] font-bold text-error uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-error"></span>
                Upstream Maintainer
              </span>
              <span className="font-code-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container-low text-secondary font-medium font-mono">
                {currentFile.upstreamMaintainer.badge}
              </span>
            </div>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              {currentFile.upstreamMaintainer.title}
            </h2>
            <p className="font-body-md text-body-md text-secondary leading-relaxed">
              {currentFile.upstreamMaintainer.description}
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-surface-container-low flex items-center justify-between text-body-sm font-body-sm text-secondary font-code-sm">
            <span className="text-on-surface font-mono">{currentFile.upstreamMaintainer.mergeBase}</span>
            <span className="text-secondary font-medium">{currentFile.upstreamMaintainer.tag}</span>
          </div>
        </div>

        {/* Card 3: Guardian Synthesis Strategy */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-tertiary/30 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[10px] font-bold text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                Resolution Synthesis
              </span>
              <span className="font-code-sm text-[11px] px-2 py-0.5 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant font-bold">
                {currentFile.resolutionSynthesis.badge}
              </span>
            </div>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              {currentFile.resolutionSynthesis.title}
            </h2>
            <p className="font-body-md text-body-md text-secondary leading-relaxed">
              {currentFile.resolutionSynthesis.description}
            </p>
          </div>
          <div className="mt-4 pt-2 border-t border-surface-container-low flex items-center justify-between text-body-sm font-body-sm">
            <span className="font-label-caps text-[10px] text-tertiary font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">task_alt</span>
              <span>{currentFile.resolutionSynthesis.verificationTag}</span>
            </span>
            <span className="font-code-sm text-code-sm text-primary font-semibold">
              {currentFile.resolutionSynthesis.statusTag}
            </span>
          </div>
        </div>
      </div>

      {/* 3-Way Atomic Preservation Canvas */}
      <ConflictStatusCanvas file={currentFile as any} />

      {/* Verification & Safety Gates Bento Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {conflictData.safetyGates.map((gate) => (
          <div
            key={gate.id}
            className="bg-surface-container-lowest rounded-xl p-4 border border-surface-container shadow-sm flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/30 text-tertiary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">{gate.icon}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {gate.title}
                </span>
                <span className="material-symbols-outlined text-tertiary text-[15px]">check_circle</span>
              </div>
              <span className="font-body-sm text-body-sm text-secondary mt-0.5 leading-snug">
                {gate.description}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Explicit Warning Advisory */}
      <div className="bg-surface-container-low rounded-xl p-4 border border-surface-container shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-secondary">
            <span className="material-symbols-outlined text-[18px]">info</span>
          </div>
          <p className="font-body-md text-body-md text-secondary">
            <strong className="text-on-surface font-semibold">Strict Guardian Principle:</strong> COSInput will never unilaterally enforce an automated choice between "ours" or "theirs". Examine the interleaved code block above and confirm the resolution.
          </p>
        </div>
        <span className="font-label-caps text-[10px] text-secondary uppercase shrink-0 font-bold">
          Deterministic Rebase Engine
        </span>
      </div>

      {/* Action Bar / Resolution Deck */}
      <div className="sticky bottom-4 z-30 bg-surface-container-lowest/95 backdrop-blur-md rounded-xl p-4 border border-surface-container shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/contributions/${id || '381'}`)}
            className="px-3.5 py-2 rounded-lg text-secondary hover:text-error hover:bg-error-container/30 font-headline-sm text-headline-sm font-medium transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            <span>Keep Branch as-is</span>
          </button>
          <button
            type="button"
            onClick={() => alert("Simulating Vitest & Playwright e2e suites against synthesized conflict resolution...")}
            className="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-headline-sm text-headline-sm font-medium border border-surface-container shadow-sm flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">play_arrow</span>
            <span>Run Full Test Matrix</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => alert("Opening AST in-browser patch editor for " + currentFile.path)}
            className="px-3.5 py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-headline-sm text-headline-sm font-medium border border-surface-container shadow-sm flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Edit Resolution Manually</span>
          </button>
          <button
            type="button"
            disabled={rebasing || rebased}
            onClick={handleRebase}
            className={`px-5 py-2 rounded-lg font-headline-sm text-headline-sm font-semibold transition-all shadow-md flex items-center gap-2 ${
              rebased
                ? 'bg-tertiary-container text-on-tertiary-container'
                : 'bg-primary-container text-on-primary hover:bg-primary'
            }`}
          >
            {rebasing ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
            ) : rebased ? (
              <span className="material-symbols-outlined text-[18px]">check</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">merge</span>
            )}
            <span>
              {rebasing
                ? 'Rebasing PR #405...'
                : rebased
                ? 'Rebased & Synced Cleanly'
                : 'Approve & Update Branch with Rebase'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
