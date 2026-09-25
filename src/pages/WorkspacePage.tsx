import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockContribution381 } from '../data/mock';

export const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'plan' | 'code' | 'tests' | 'acceptance' | 'ci' | 'reviews' | 'activity'>('overview');
  const [copiedBranch, setCopiedBranch] = useState(false);

  const contribution = mockContribution381;

  const handleCopyBranch = () => {
    navigator.clipboard?.writeText(contribution.branch);
    setCopiedBranch(true);
    setTimeout(() => setCopiedBranch(false), 2000);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-surface">
      {/* Top Workspace Context Header Bar */}
      <header className="bg-surface-container-lowest px-4 lg:px-6 py-3 border-b border-surface-container shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left Metadata & Branch Context */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-code-sm text-code-sm text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-primary">terminal</span>
                {contribution.repository}
              </span>
              <span className="font-code-sm text-code-sm text-outline-variant">/</span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                #{contribution.issueNumber} {contribution.title}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm text-code-sm font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                {contribution.stageTag}
              </span>
            </div>

            <div className="flex items-center gap-3 text-secondary font-code-sm text-code-sm flex-wrap">
              <div className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded border border-surface-container-high/40">
                <span className="material-symbols-outlined text-[14px] text-outline">fork_right</span>
                <span className="text-on-surface font-medium select-all font-mono">{contribution.branch}</span>
                <button
                  type="button"
                  onClick={handleCopyBranch}
                  className="hover:text-primary transition-colors flex items-center"
                  title="Copy branch name"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {copiedBranch ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
              <span className="text-outline-variant">•</span>
              <div className="flex items-center gap-1">
                <span className="text-outline">Commit:</span>
                <span className="bg-surface-container-low px-1.5 py-0.5 rounded text-on-surface font-semibold font-mono">
                  {contribution.commitSha}
                </span>
              </div>
              <span className="text-outline-variant">•</span>
              <span className="text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-tertiary">history</span>
                Updated {contribution.updatedAgo}
              </span>
            </div>
          </div>

          {/* Right Action Bar & Global Controls */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => alert(`Run trace share link copied: /contributions/${id || '381'}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md border border-surface-container"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Share Run</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-secondary hover:text-on-surface transition-colors font-label-md text-label-md border border-surface-container"
            >
              <span className="material-symbols-outlined text-[16px]">pause_circle</span>
              <span>Pause</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/contributions/${id || '381'}/ci`)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-all shadow-sm font-label-md text-label-md font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>Review & Run Tests</span>
              <kbd className="ml-1 px-1.5 py-0.2 rounded bg-surface-container-lowest/20 font-code-sm text-code-sm text-on-primary">
                ⌘R
              </kbd>
            </button>
          </div>
        </div>

        {/* 9-Step Pipeline Stepper */}
        <div className="mt-4 pt-2 overflow-x-auto scrollbar-none border-t border-surface-container-low">
          <div className="flex items-center min-w-[780px] justify-between pb-1">
            {contribution.steps.map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';

              return (
                <React.Fragment key={step.number}>
                  {idx > 0 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        isCompleted
                          ? 'bg-tertiary'
                          : isActive
                          ? 'bg-primary'
                          : 'bg-surface-container-high'
                      }`}
                    />
                  )}

                  <div className={`flex items-center gap-2 ${!isCompleted && !isActive ? 'opacity-50' : ''}`}>
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      </div>
                    ) : isActive ? (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-md relative">
                        <span className="w-2 h-2 rounded-full bg-on-primary animate-ping"></span>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-outline">
                        <span className="font-code-sm text-[10px]">{step.number}</span>
                      </div>
                    )}

                    <div className="flex flex-col">
                      <span
                        className={`font-label-caps text-[10px] ${
                          isActive ? 'text-primary font-bold' : isCompleted ? 'text-on-surface font-semibold' : 'text-secondary'
                        }`}
                      >
                        {step.number}. {step.name}
                      </span>
                      {step.subtext && (
                        <span className="font-code-sm text-[9px] text-primary">{step.subtext}</span>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </header>

      {/* Workspace Subnavigation Tabs */}
      <nav className="bg-surface-container-low px-4 lg:px-6 flex items-center gap-1 overflow-x-auto border-b border-surface-container">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 font-label-md text-label-md flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'overview'
              ? 'text-primary bg-surface-container-lowest border-primary shadow-sm font-semibold'
              : 'text-secondary hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">view_quilt</span>
          <span>Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('plan')}
          className={`px-3 py-2 font-label-md text-label-md flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'plan'
              ? 'text-primary bg-surface-container-lowest border-primary shadow-sm font-semibold'
              : 'text-secondary hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">account_tree</span>
          <span>Plan</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`px-3 py-2 font-label-md text-label-md flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'code'
              ? 'text-primary bg-surface-container-lowest border-primary shadow-sm font-semibold'
              : 'text-secondary hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">code</span>
          <span>Code</span>
          <span className="px-1.5 py-0.2 rounded-full bg-surface-container font-code-sm text-[10px] text-on-surface">
            3 (+124 -18)
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/contributions/${id || '381'}/ci`)}
          className="px-3 py-2 font-label-md text-label-md text-secondary hover:text-on-surface transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">task_alt</span>
          <span>Tests</span>
          <span className="px-1.5 py-0.2 rounded-full bg-error-container text-on-error-container font-code-sm text-[10px] font-semibold">
            1 Failed, 2 Passed
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('acceptance')}
          className={`px-3 py-2 font-label-md text-label-md flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'acceptance'
              ? 'text-primary bg-surface-container-lowest border-primary shadow-sm font-semibold'
              : 'text-secondary hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">verified</span>
          <span>Acceptance</span>
          <span className="px-1.5 py-0.2 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm text-[10px] font-semibold">
            4/5 Verified
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/contributions/${id || '381'}/ci`)}
          className="px-3 py-2 font-label-md text-label-md text-secondary hover:text-on-surface transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">integration_instructions</span>
          <span>CI</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/contributions/${id || '381'}/guardian`)}
          className="px-3 py-2 font-label-md text-label-md text-secondary hover:text-on-surface transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">verified_user</span>
          <span>Guardian</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/contributions/${id || '381'}/conflicts`)}
          className="px-3 py-2 font-label-md text-label-md text-secondary hover:text-on-surface transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">call_merge</span>
          <span>Conflicts</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/contributions/${id || '381'}/reviews`)}
          className="px-3 py-2 font-label-md text-label-md text-secondary hover:text-on-surface transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">rate_review</span>
          <span>Reviews</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`px-3 py-2 font-label-md text-label-md flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'activity'
              ? 'text-primary bg-surface-container-lowest border-primary shadow-sm font-semibold'
              : 'text-secondary hover:text-on-surface border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">history_toggle_off</span>
          <span>Activity</span>
        </button>
      </nav>

      {/* Main View Grid Content */}
      <div className="px-4 lg:px-6 py-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT 2/3 COLUMN: Blocker, Spec, Plan, Files */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* 1. HIGH-PRIORITY SAFETY BLOCKER BANNER */}
          <section className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-md relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-error"></div>
            <div className="flex flex-col gap-3 pl-1">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-error-container text-on-error-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">warning</span>
                  </span>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 font-bold">
                      {contribution.safetyBlocker.title}
                      <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-code-sm text-[10px] font-bold uppercase tracking-wider">
                        {contribution.safetyBlocker.status}
                      </span>
                    </h3>
                    <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                      Affects: <code className="font-code-sm text-code-sm bg-surface-container px-1 py-0.5 rounded text-on-surface">{contribution.safetyBlocker.affectedFile}</code> & production staking execution.
                    </p>
                  </div>
                </div>
                <span className="font-code-sm text-code-sm text-secondary bg-surface-container px-2.5 py-1 rounded">
                  {contribution.safetyBlocker.ruleText}
                </span>
              </div>

              <div className="bg-surface-container-low p-3 rounded-lg text-on-surface font-body-sm text-body-sm leading-relaxed border border-error/20">
                <span className="font-semibold text-error">COSInput Safety Invariant:</span> {contribution.safetyBlocker.invariantMessage}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => alert("Drafting question to repository maintainer regarding canonical contract deployment address.")}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md flex items-center gap-1.5 shadow-sm transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-[16px]">contact_support</span>
                  <span>Draft Maintainer Question</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Continuing isolated unblocked work on form UI validation and error boundaries.")}
                  className="px-3.5 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1.5 transition-colors border border-surface-container font-medium"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  <span>Continue Unblocked Work (Form UI & Validation)</span>
                </button>
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-lg bg-surface-container text-secondary hover:text-error font-label-md text-label-md flex items-center gap-1.5 transition-colors border border-surface-container font-medium"
                >
                  <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                  <span>Pause Contribution</span>
                </button>
              </div>
            </div>
          </section>

          {/* 2. ISSUE SUMMARY & REPOSITORY CONTEXT */}
          <section className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Issue Spec & Repository Context
                </h4>
              </div>
              <span className="font-code-sm text-code-sm text-secondary">Extracted via AST Indexer</span>
            </div>

            <p className="font-body-md text-body-md text-on-surface leading-relaxed bg-surface-container-low p-3.5 rounded-lg border border-surface-container-low">
              "{contribution.specContext.description}"
            </p>

            {/* Tech Stack Context Badges */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {contribution.specContext.techStack.map((tech) => (
                <span
                  key={tech.name}
                  className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface font-code-sm text-code-sm flex items-center gap-1.5 border border-surface-container-high/40"
                >
                  <span className={`w-2 h-2 rounded-full ${tech.color}`}></span>
                  <span>{tech.name}</span>
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-on-surface font-code-sm text-code-sm ml-auto">
                {contribution.specContext.stats}
              </span>
            </div>
          </section>

          {/* 3. EXECUTION PLAN PANEL */}
          <section className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">alt_route</span>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Execution Plan
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm text-code-sm font-semibold">
                  {contribution.executionPlan.progressLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed font-label-caps text-label-caps font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">verified_user</span>
                  <span>User Approved</span>
                </span>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors"
                >
                  Request Changes
                </button>
              </div>
            </div>

            {/* Plan Step Progression List */}
            <div className="flex flex-col gap-1.5">
              {contribution.executionPlan.steps.map((step) => {
                const isCompleted = step.status === 'completed';
                const isInProgress = step.status === 'in_progress';
                const isBlocked = step.status === 'blocked';

                return (
                  <div
                    key={step.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                      isInProgress
                        ? 'bg-primary-fixed/20 border-primary/30 shadow-sm'
                        : isBlocked
                        ? 'bg-error-container/20 border-error/30'
                        : isCompleted
                        ? 'bg-surface-container-low border-surface-container-high/30'
                        : 'bg-surface border-surface-container opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isCompleted && (
                        <div className="w-5 h-5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                        </div>
                      )}
                      {isInProgress && (
                        <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center animate-pulse shrink-0">
                          <span className="w-2 h-2 rounded-full bg-on-primary"></span>
                        </div>
                      )}
                      {isBlocked && (
                        <div className="w-5 h-5 rounded-full bg-error-container text-on-error-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[14px]">block</span>
                        </div>
                      )}
                      {!isCompleted && !isInProgress && !isBlocked && (
                        <div className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center text-outline shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                        </div>
                      )}

                      <span
                        className={`font-body-md text-body-md truncate ${
                          isCompleted
                            ? 'line-through decoration-secondary text-secondary'
                            : isInProgress
                            ? 'font-semibold text-on-surface'
                            : isBlocked
                            ? 'text-error font-medium'
                            : 'text-secondary'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded font-code-sm text-[10px] font-semibold ${
                          isCompleted
                            ? 'bg-surface-container text-secondary'
                            : isInProgress
                            ? 'bg-primary text-on-primary'
                            : isBlocked
                            ? 'bg-error text-on-error'
                            : 'bg-surface-container text-secondary'
                        }`}
                      >
                        {step.statusLabel}
                      </span>
                      {step.governanceTag && (
                        <span
                          className={`font-code-sm text-[11px] ${
                            isInProgress
                              ? 'text-primary font-medium'
                              : isBlocked
                              ? 'text-error font-medium'
                              : 'text-secondary-fixed-dim'
                          }`}
                        >
                          {step.governanceTag}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. FILES BEING INVESTIGATED & MODIFIED */}
          <section className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">folder_open</span>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Staged Files & Working Tree
                </h4>
              </div>
              <span className="font-code-sm text-code-sm text-secondary">
                {contribution.stagedFiles.length} Modified in this run
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {contribution.stagedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors border border-surface-container-high/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                      {file.status === 'New File' ? 'note_add' : 'javascript'}
                    </span>
                    <span className="font-code-md text-code-md text-on-surface font-medium truncate font-mono">
                      {file.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-code-sm text-code-sm text-tertiary font-semibold">
                      +{file.additions}
                    </span>
                    <span className="font-code-sm text-code-sm text-error font-semibold">
                      -{file.deletions}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-code-sm text-[11px] ${
                        file.status === 'New File'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                          : 'bg-secondary-fixed text-on-secondary-fixed'
                      }`}
                    >
                      {file.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/contributions/${id || '381'}/conflicts`)}
                      className="p-1 text-secondary hover:text-on-surface"
                      title="Inspect Diff"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT 1/3 COLUMN: Safety, State Ledger & Acceptance */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* 1. STATE CLASSIFICATION LEDGER */}
          <section className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Governance & Authority Ledger
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-2 my-1">
              <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col border border-surface-container">
                <span className="font-label-caps text-[10px] text-secondary">AI Suggested</span>
                <span className="font-headline-md text-headline-md text-on-surface font-bold mt-0.5">
                  {contribution.governanceLedger.aiSuggested.count}
                </span>
                <span className="font-code-sm text-[11px] text-secondary mt-0.5">
                  {contribution.governanceLedger.aiSuggested.note}
                </span>
              </div>

              <div className="bg-primary-fixed/30 p-2.5 rounded-lg flex flex-col border border-primary/20">
                <span className="font-label-caps text-[10px] text-primary">AI Prepared</span>
                <span className="font-headline-md text-headline-md text-primary font-bold mt-0.5">
                  {contribution.governanceLedger.aiPrepared.count}
                </span>
                <span className="font-code-sm text-[11px] text-primary mt-0.5">
                  {contribution.governanceLedger.aiPrepared.note}
                </span>
              </div>

              <div className="bg-tertiary-fixed/40 p-2.5 rounded-lg flex flex-col border border-tertiary/20">
                <span className="font-label-caps text-[10px] text-on-tertiary-fixed">User Approved</span>
                <span className="font-headline-md text-headline-md text-on-tertiary-fixed font-bold mt-0.5">
                  {contribution.governanceLedger.userApproved.count}
                </span>
                <span className="font-code-sm text-[11px] text-tertiary font-medium mt-0.5">
                  {contribution.governanceLedger.userApproved.note}
                </span>
              </div>

              <div className="bg-surface-container-high p-2.5 rounded-lg flex flex-col border border-surface-container-highest">
                <span className="font-label-caps text-[10px] text-secondary">GitHub Verified</span>
                <span className="font-headline-md text-headline-md text-outline font-bold mt-0.5">
                  {contribution.governanceLedger.githubVerified.count}
                </span>
                <span className="font-code-sm text-[11px] text-secondary mt-0.5">
                  {contribution.governanceLedger.githubVerified.note}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-low p-3 rounded-lg border border-surface-container">
              <p className="font-code-sm text-code-sm text-secondary leading-relaxed">
                <strong className="text-on-surface font-semibold">Strict Rule:</strong>{' '}
                {contribution.governanceLedger.strictRule}
              </p>
            </div>
          </section>

          {/* 2. ACCEPTANCE VERIFICATION SUMMARY */}
          <section className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Acceptance Verification
              </h4>
            </div>

            {/* Overall status score badge */}
            <div className="p-2.5 rounded-lg bg-error-container/20 border border-error/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping"></span>
                <span className="font-headline-sm text-headline-sm text-error font-bold">
                  {contribution.acceptanceSummary.status}
                </span>
              </div>
              <div className="flex items-center gap-2 font-code-sm text-code-sm">
                <span className="text-tertiary font-semibold">
                  {contribution.acceptanceSummary.passedCount} Passed
                </span>
                <span className="text-outline">•</span>
                <span className="text-error font-semibold">
                  {contribution.acceptanceSummary.blockedCount} Blocked
                </span>
              </div>
            </div>

            {/* Breakdown items with evidence links */}
            <div className="flex flex-col gap-1.5 mt-1">
              {contribution.acceptanceSummary.items.map((item) => {
                const isPassed = item.status === 'Passed';
                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded border flex flex-col gap-0.5 ${
                      isPassed
                        ? 'bg-surface-container-low border-surface-container-high/40'
                        : 'bg-error-container/30 border-error/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-body-sm text-body-sm flex items-center gap-1.5 font-medium ${
                          isPassed ? 'text-on-surface' : 'text-error font-semibold'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isPassed ? 'text-tertiary' : 'text-error'
                          }`}
                        >
                          {isPassed ? 'check_circle' : 'cancel'}
                        </span>
                        {item.title}
                      </span>
                      <span
                        className={`font-code-sm text-code-sm font-bold ${
                          isPassed ? 'text-tertiary' : 'text-error'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {item.evidencePath && (
                      <span className="font-code-sm text-[11px] text-secondary pl-5 truncate font-mono">
                        Evidence: {item.evidencePath}
                      </span>
                    )}
                    {item.statusNote && (
                      <span className="font-code-sm text-[11px] text-error pl-5 font-mono">
                        Status: {item.statusNote}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. SESSION ACTIVITY */}
          <section className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Session Activity
                </h4>
              </div>
              <span className="font-code-sm text-code-sm text-secondary">Today</span>
            </div>

            <div className="flex flex-col gap-2 font-code-sm text-code-sm">
              {contribution.sessionActivity.map((act, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-secondary shrink-0 font-mono">{act.time}</span>
                  <div className="flex items-center gap-1.5 text-on-surface">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        act.type === 'agent'
                          ? 'bg-primary'
                          : act.type === 'user' || act.type === 'success'
                          ? 'bg-tertiary'
                          : 'bg-outline'
                      }`}
                    ></span>
                    <span>{act.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
