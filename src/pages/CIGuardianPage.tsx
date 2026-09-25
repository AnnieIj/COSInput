import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockCIGuardianWorkflow } from '../data/mock';
import { CIChecksMatrix } from '../components/common/CIChecksMatrix';
import { ApprovalActions } from '../components/common/ApprovalActions';

export const CIGuardianPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedCheck, setSelectedCheck] = useState('typecheck');
  const [isCopiedLog, setIsCopiedLog] = useState(false);
  const [isPushed, setIsPushed] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  const workflow = mockCIGuardianWorkflow;

  const handleCopyLog = () => {
    setIsCopiedLog(true);
    navigator.clipboard?.writeText(
      `src/components/StakeForm.tsx:87:11 - error TS2322: Type 'string' is not assignable to type 'bigint'.`
    );
    setTimeout(() => setIsCopiedLog(false), 2000);
  };

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Action Breadcrumb Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-code-sm text-code-sm text-secondary">
            <span
              onClick={() => navigate('/repositories')}
              className="hover:text-primary cursor-pointer"
            >
              DigiNodes
            </span>
            <span>/</span>
            <span
              onClick={() => navigate(`/contributions/${id || '381'}`)}
              className="hover:text-primary cursor-pointer"
            >
              truthbounty-frontend
            </span>
            <span>/</span>
            <span
              onClick={() => navigate(`/contributions/${id || '381'}/guardian`)}
              className="hover:text-primary cursor-pointer"
            >
              Guardian
            </span>
            <span>/</span>
            <span className="text-on-surface font-medium">CI Guardian</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight">
              CI Guardian — GitHub Actions Workflow #{workflow.workflowNumber}
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-error-container text-on-error-container font-code-sm text-code-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
              <span>{workflow.overallStatus}</span>
            </div>
          </div>

          <p className="font-body-sm text-body-sm text-secondary flex items-center gap-1.5 pt-0.5">
            <span className="material-symbols-outlined text-[15px] text-error">lock_clock</span>
            <span>{workflow.strictPolicyNote}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <button
            type="button"
            onClick={() => alert("Re-triggering GitHub Actions CI workflow #91024...")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-headline-sm text-headline-sm font-medium border border-surface-container shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Re-trigger CI on GitHub</span>
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm font-medium border border-surface-container transition-all"
          >
            <span>Raw Workflow Logs</span>
            <span className="material-symbols-outlined text-[15px]">open_in_new</span>
          </a>
        </div>
      </div>

      {/* Actual GitHub CI Status Matrix Strip */}
      <CIChecksMatrix
        checks={workflow.checks as any}
        selectedCheckId={selectedCheck}
        onSelectCheck={(chk) => setSelectedCheck(chk)}
      />

      {/* 5-Step Mini Stepper: Autonomous Guardian Resolution Cycle */}
      <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[18px]">
              auto_fix_high
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Autonomous Guardian Resolution Cycle
            </span>
          </div>
          <span className="font-label-caps text-[10px] px-2.5 py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-semibold">
            Stage 5/5: Ready for Human Push
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {workflow.stepperStages.map((stg) => {
            const isCompleted = stg.completed;
            const isActive = stg.active;

            return (
              <div
                key={stg.number}
                className={`p-2.5 rounded-lg flex items-center gap-2.5 border transition-all ${
                  isActive
                    ? 'bg-primary-container text-on-primary border-primary shadow-md'
                    : isCompleted
                    ? 'bg-surface-container-low border-surface-container text-on-surface'
                    : 'bg-surface border-surface-container opacity-60 text-secondary'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-code-sm font-bold text-xs ${
                    isActive
                      ? 'bg-on-primary text-primary'
                      : isCompleted
                      ? 'bg-tertiary text-on-tertiary'
                      : 'bg-surface-container text-outline'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  ) : (
                    stg.number
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className={`font-label-caps text-[9px] uppercase ${
                      isActive ? 'text-primary-fixed' : 'text-secondary'
                    }`}
                  >
                    {stg.label}
                  </span>
                  <span
                    className={`font-code-sm text-code-sm font-medium truncate ${
                      isActive ? 'text-on-primary font-bold' : 'text-on-surface'
                    }`}
                  >
                    {stg.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Failure Terminal & Autonomous Diagnosis Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Raw Failure Terminal Logs */}
        <div className="lg:col-span-7 bg-inverse-surface rounded-xl shadow-md overflow-hidden flex flex-col border border-surface-container-highest/20">
          <div className="px-4 py-2.5 bg-inverse-surface flex items-center justify-between border-b border-surface-variant/10">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed"></span>
              </div>
              <span className="font-code-sm text-code-sm text-surface-container-lowest font-medium ml-2 font-mono">
                {workflow.terminalLog.logPath}
              </span>
            </div>
            <div className="flex items-center gap-2 text-surface-variant font-code-sm text-code-sm">
              <button
                type="button"
                onClick={handleCopyLog}
                className="hover:text-surface-container-lowest transition-colors flex items-center"
                title="Copy raw log snippet"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isCopiedLog ? 'check' : 'content_copy'}
                </span>
              </button>
              <span>ANSI UTF-8</span>
            </div>
          </div>

          {/* Code Terminal Content */}
          <div className="p-4 font-code-sm text-code-sm leading-relaxed overflow-x-auto select-text text-surface-variant font-mono space-y-1">
            <div className="text-surface-container-lowest opacity-70">$ npm run typecheck</div>
            <div className="text-surface-variant opacity-60">&gt; truthbounty-frontend@0.1.0 typecheck</div>
            <div className="text-surface-variant opacity-60 pb-2">&gt; tsc --noEmit</div>

            <div className="text-on-error-container bg-error-container/20 p-2.5 rounded-lg border border-error/30 my-2">
              <span className="text-surface-container-lowest font-bold">src/components/StakeForm.tsx:87:11</span>
              <span className="text-error-container font-semibold"> - error TS2322: </span>
              <span className="text-surface-container-lowest">Type 'string' is not assignable to type 'bigint'.</span>
            </div>

            <div className="pl-3 border-l-2 border-error text-surface-container-lowest my-2 space-y-0.5">
              <div><span className="text-secondary select-none">85 | </span>    try &#123;</div>
              <div><span className="text-secondary select-none">86 | </span>      await executeStakeTransaction(&#123;</div>
              <div className="bg-error/20 py-0.5 text-error-container font-semibold">
                <span className="text-secondary select-none">87 | </span>        amount: stakeInputAmount,
              </div>
              <div className="text-error font-bold">
                <span className="text-secondary select-none">   | </span>                ~~~~~~~~~~~~~~~~
              </div>
              <div><span className="text-secondary select-none">88 | </span>        validatorAddress: userAddress,</div>
              <div><span className="text-secondary select-none">89 | </span>      &#125;);</div>
            </div>

            <div className="pl-3 border-l-2 border-surface-variant/30 text-surface-variant my-2">
              <div className="text-inverse-primary">src/lib/staking.ts:14:3</div>
              <div><span className="text-secondary select-none">14 | </span>   amount: bigint;</div>
              <div className="text-surface-variant italic text-xs mt-0.5">
                The expected type comes from property 'amount' which is declared here on type 'StakeTransactionPayload'
              </div>
            </div>

            <div className="text-error-container font-semibold pt-2">
              Found 1 error in src/components/StakeForm.tsx at line 87.
            </div>
            <div className="text-secondary">Process exited with code 2. (Elapsed: 8.91s)</div>
          </div>

          <div className="px-4 py-2 bg-surface-container-highest/10 flex items-center justify-between text-surface-variant font-code-sm text-code-sm border-t border-surface-variant/10">
            <span>{workflow.terminalLog.workerInfo}</span>
          </div>
        </div>

        {/* Right 5 Cols: Autonomous Diagnosis & Safe Repair Blueprint */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary-container text-[20px]">
                  psychology
                </span>
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  Autonomous Diagnosis
                </span>
              </div>
              <span className="inline-flex items-center gap-1 font-label-caps text-[10px] px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                {workflow.diagnosis.confidence}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
                Detected Anomaly
              </span>
              <div className="font-code-sm text-code-sm text-on-surface bg-surface-container-low p-2.5 rounded-lg border border-surface-container flex items-center justify-between">
                <span className="font-semibold text-primary">{workflow.diagnosis.anomalyType}</span>
                <span className="text-secondary font-mono">{workflow.diagnosis.fileLocation}</span>
              </div>
            </div>

            <p className="font-body-md text-body-md text-secondary leading-relaxed">
              {workflow.diagnosis.explanation}
            </p>

            <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-primary font-headline-sm text-headline-sm">
                <span className="material-symbols-outlined text-[16px]">shield</span>
                <span className="font-semibold">Safe Invariant Note</span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary">
                {workflow.diagnosis.safeInvariantNote}
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 font-code-sm text-code-sm pt-1">
              <div className="bg-surface-container-lowest p-2 rounded border border-surface-container">
                <span className="text-secondary block font-label-caps text-[10px]">Estimated Diff</span>
                <span className="font-semibold text-on-surface">{workflow.diagnosis.diffEstimate}</span>
              </div>
              <div className="bg-surface-container-lowest p-2 rounded border border-surface-container">
                <span className="text-secondary block font-label-caps text-[10px]">Risk Vector</span>
                <span className="font-semibold text-tertiary">{workflow.diagnosis.riskVector}</span>
              </div>
            </div>
          </div>

          {/* Branch Build Health */}
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
                Branch Build Health
              </span>
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {workflow.diagnosis.branchBuildHealth}
              </span>
            </div>
            <svg className="w-24 h-8 text-primary" fill="none" viewBox="0 0 110 32">
              <path
                d="M 0,20 L 25,12 L 50,18 L 75,6 L 95,28 L 110,8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
              <circle cx="110" cy="8" fill="currentColor" r="3.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Proposed Fix & Git Diff Review Section */}
      <div
        className={`bg-surface-container-lowest rounded-xl border border-surface-container shadow-md overflow-hidden flex flex-col transition-opacity ${
          discarded ? 'opacity-40' : ''
        }`}
        id="diff-section"
      >
        <div className="p-4 bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[20px]">difference</span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-code-lg text-code-lg font-semibold text-on-surface font-mono">
                  {workflow.unifiedDiff.file}
                </span>
                <span className="font-label-caps text-[10px] bg-surface-container text-secondary px-1.5 py-0.5 rounded font-mono">
                  {workflow.unifiedDiff.linesRange}
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-secondary">
                Git Unified Diff • {workflow.unifiedDiff.patchTag}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 font-label-caps text-[10px] px-2.5 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold self-start sm:self-center">
            <span className="material-symbols-outlined text-[13px]">done_all</span>
            <span>Local Check: npx tsc Passed (0 errors)</span>
          </span>
        </div>

        {/* Diff Unified View */}
        <div className="p-4 bg-surface-container-lowest font-code-sm text-code-sm leading-relaxed overflow-x-auto font-mono">
          <div className="text-secondary pb-2 select-none">{workflow.unifiedDiff.header}</div>
          <div className="space-y-0.5">
            {workflow.unifiedDiff.hunks.map((hunk, idx) => (
              <div
                key={idx}
                className={`flex items-center px-1.5 py-0.5 rounded ${
                  hunk.type === 'removed'
                    ? 'bg-error-container/40 text-on-error-container font-semibold'
                    : hunk.type === 'added'
                    ? 'bg-tertiary-fixed/30 text-on-tertiary-fixed font-semibold'
                    : 'text-secondary hover:bg-surface-container-low/40'
                }`}
              >
                <span className="w-8 select-none text-right pr-2 opacity-50 shrink-0">
                  {hunk.oldLine}
                </span>
                <span className="w-8 select-none text-right pr-2 opacity-50 shrink-0">
                  {hunk.newLine}
                </span>
                <span className="w-4 select-none font-bold text-center shrink-0">{hunk.sign}</span>
                <span className="text-on-surface whitespace-pre">{hunk.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sandbox Verification Confirmation Banner */}
        <div className="p-3.5 bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-surface-container">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Sandbox Verification Succeeded
              </span>
              <span className="font-code-sm text-code-sm text-secondary">
                Executed: <code className="font-bold text-on-surface">npx tsc --noEmit</code> • 0 diagnostic errors • TypeScript v5.4.5
              </span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface rounded-full font-label-caps text-[10px] uppercase font-semibold">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>Awaiting User Push Approval</span>
          </div>
        </div>

        {/* Explicit Invariant Banner */}
        <div className="px-4 py-3 bg-secondary-container/40 text-on-secondary-fixed flex items-start gap-3 border-t border-surface-container">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">policy</span>
          <div className="flex flex-col gap-0.5">
            <span className="font-headline-sm text-headline-sm font-bold text-on-secondary-fixed">
              Invariant: Remote GitHub CI Authority
            </span>
            <span className="font-body-sm text-body-sm text-on-secondary-fixed-variant leading-relaxed">
              Local verification passed, but GitHub CI will remain marked <strong className="text-error uppercase">FAILED</strong> until you approve and push this fix, and GitHub Actions successfully finishes running the re-triggered pipeline.
            </span>
          </div>
        </div>

        {/* Commit Message Preview Bar */}
        <div className="px-4 py-2.5 bg-surface-container-lowest flex flex-col md:flex-row md:items-center justify-between gap-2 border-t border-surface-container-low">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-label-caps text-[10px] uppercase text-secondary shrink-0 font-bold">
              Commit Message:
            </span>
            <div className="font-code-sm text-code-sm font-semibold text-on-surface bg-surface-container-low px-2 py-0.5 rounded truncate font-mono">
              {workflow.unifiedDiff.commitMessage}
            </div>
          </div>
          <div className="flex items-center gap-1 text-secondary font-code-sm text-code-sm shrink-0">
            <span className="material-symbols-outlined text-[13px]">alt_route</span>
            <span className="font-mono">Target: {workflow.unifiedDiff.targetBranch}</span>
          </div>
        </div>

        {/* Human Approval Action Bar */}
        <ApprovalActions
          isCompleted={isPushed}
          onApprove={() => {
            setIsPushed(true);
            setTimeout(() => {
              alert("Patch pushed to origin/cosinput/381-verification-stake! GitHub Actions workflow #91025 triggered.");
            }, 300);
          }}
          onDiscard={() => {
            if (confirm("Discard this proposed repair AST patch?")) {
              setDiscarded(true);
            }
          }}
          onEdit={() => {
            alert("Opening COSInput inline AST patch editor for src/components/StakeForm.tsx");
          }}
        />
      </div>
    </div>
  );
};
