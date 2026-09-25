import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockRun8f92a10c } from '../data/mock';
import { RunStageItem } from '../components/common/RunStageItem';
import { ReviewComments } from '../components/common/ReviewComments';

export const LiveRunPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'reviews' | 'changes' | 'tests' | 'ci' | 'acceptance' | 'ledger'>('reviews');

  const run = mockRun8f92a10c;

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-[1720px] mx-auto">
      {/* Top Context Banner & Action Control Cockpit */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-4">
        {/* Breadcrumb & Status Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 font-code-sm text-code-sm text-secondary">
            <span
              onClick={() => navigate('/repositories')}
              className="text-on-surface font-semibold flex items-center gap-1 hover:text-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-primary text-[18px]">folder_open</span>
              {run.repository}
            </span>
            <span className="text-outline">/</span>
            <span>Runs</span>
            <span className="text-outline">/</span>
            <span className="bg-surface-container-low px-2 py-0.5 rounded text-primary font-semibold font-mono">
              {runId || run.runId}
            </span>
            <span className="text-outline">→</span>
            <button
              type="button"
              onClick={() => navigate(`/contributions/${run.issueNumber}/guardian`)}
              className="bg-primary-container/10 text-primary-container hover:bg-primary-container/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span>Guardian PR #{run.prNumber}</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-body-sm font-body-sm flex-wrap">
            <div className="flex items-center gap-1 text-secondary font-code-sm text-code-sm">
              <span className="material-symbols-outlined text-tertiary text-[16px]">timer</span>
              <span>Elapsed: <strong className="text-on-surface font-mono">{run.elapsed}</strong></span>
            </div>
            <div className="flex items-center gap-1 text-secondary font-code-sm text-code-sm">
              <span className="material-symbols-outlined text-secondary text-[16px]">person</span>
              <span>Initiator: <strong className="text-on-surface">{run.initiator}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-tertiary-container/10 text-tertiary rounded-full font-label-md text-label-md font-semibold">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              <span>GUARDIAN ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Active Contribution Headline Card */}
        <div className="bg-surface-container-low rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 border border-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">sync_alt</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[10px] bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded font-bold font-mono">
                  RUN #{runId || run.runId}
                </span>
                <span className="text-outline text-xs">•</span>
                <span className="font-label-caps text-[10px] text-tertiary font-bold tracking-wider">
                  {run.status}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <h1 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  #{run.prNumber} Build Verification and Stake Flow
                </h1>
                <span className="font-code-sm text-code-sm bg-surface-container-highest px-2 py-0.5 rounded text-secondary flex items-center gap-1 font-mono">
                  <span className="material-symbols-outlined text-[13px]">fork_right</span>
                  {run.branch}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-surface-container shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-tertiary">terminal</span>
              <span>Live Stream</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-surface-container shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">pause_circle</span>
              <span>Pause Watcher</span>
            </button>
            <button
              type="button"
              onClick={() => alert("Run trace URL copied.")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-surface-container shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">share</span>
              <span>Share Trace</span>
            </button>
            <button
              type="button"
              onClick={() => alert("Re-running verification check suite...")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-opacity font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Re-verify Checks</span>
            </button>
          </div>
        </div>

        {/* Session Persistence Notice */}
        <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary bg-surface rounded-lg px-3.5 py-2 border border-surface-container">
          <div className="flex items-center gap-1.5 font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
            <span>Session history preserved: you can leave and return to this contribution without losing run execution state.</span>
          </div>
          <div className="font-code-sm text-[11px] text-outline font-mono">
            Worker ID: <span className="text-on-surface font-medium">{run.workerId}</span>
          </div>
        </div>
      </div>

      {/* 2-Column Split Screen Developer Cockpit */}
      <div className="grid grid-cols-12 gap-6 w-full items-start">
        {/* LEFT COLUMN: Unified Persistent Execution Timeline (21 checkpoints) */}
        <div className="col-span-12 xl:col-span-5 flex flex-col gap-3 bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Continuous Execution Pipeline
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Zero-state intake through 24/7 post-PR Guardian
                </p>
              </div>
            </div>
            <span className="font-code-sm text-[11px] bg-surface-container text-secondary px-2 py-0.5 rounded font-medium">
              {run.checkpointsCount} checkpoints
            </span>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto max-h-[820px] pr-1">
            {/* Phase 1 Header */}
            <div className="flex items-center gap-2 pt-2 pb-1">
              <span className="font-label-caps text-[9px] bg-surface-container-high px-1.5 py-0.5 rounded text-primary font-bold">
                PHASE 1
              </span>
              <span className="font-label-caps text-[9px] text-secondary tracking-wider font-semibold">
                AGENT RUN & IMPLEMENTATION PIPELINE
              </span>
            </div>

            {run.checkpoints.filter((cp) => cp.phase === 1).map((cp) => (
              <RunStageItem key={cp.id} checkpoint={cp} />
            ))}

            {/* Seamless Transition Divider */}
            <div className="my-2 p-3 bg-primary-container text-on-primary rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[20px]">shield</span>
                <div className="flex flex-col">
                  <span className="font-label-caps text-[9px] tracking-wider text-primary-fixed font-bold">
                    AUTOMATIC PIPELINE HANDOFF
                  </span>
                  <span className="font-body-md text-body-md font-semibold text-white">
                    TRANSITIONED TO CONTRIBUTION GUARDIAN
                  </span>
                </div>
              </div>
              <span className="font-label-caps text-[9px] bg-surface-container-lowest/20 px-2.5 py-1 rounded-full text-white font-bold">
                24/7 Active Watch
              </span>
            </div>

            {/* Phase 2 Header */}
            <div className="flex items-center gap-2 pt-2 pb-1">
              <span className="font-label-caps text-[9px] bg-surface-container-high px-1.5 py-0.5 rounded text-tertiary font-bold">
                PHASE 2
              </span>
              <span className="font-label-caps text-[9px] text-secondary tracking-wider font-semibold">
                POST-PR GUARDIAN LIFECYCLE
              </span>
            </div>

            {run.checkpoints.filter((cp) => cp.phase === 2).map((cp) => (
              <RunStageItem key={cp.id} checkpoint={cp} />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: High-Precision Inspection Cockpit with Tabs */}
        <div className="col-span-12 xl:col-span-7 flex flex-col gap-6">
          <div className="w-full bg-surface-container-lowest rounded-xl border border-surface-container shadow-sm overflow-hidden flex flex-col">
            {/* Tab Navigation */}
            <div className="flex items-center justify-between px-4 pt-3 bg-surface-container-low border-b border-surface-container">
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className={`px-3 py-2 font-label-md text-label-md font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'reviews'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">rate_review</span>
                  <span>Reviews</span>
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('changes')}
                  className={`px-3 py-2 font-label-md text-label-md font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'changes'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">difference</span>
                  <span>Changes</span>
                  <span className="font-code-sm text-[10px] text-tertiary font-semibold">+124</span>
                  <span className="font-code-sm text-[10px] text-error font-semibold">-18</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tests')}
                  className={`px-3 py-2 font-label-md text-label-md font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'tests'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">science</span>
                  <span>Tests & Terminal</span>
                  <span className="font-code-sm text-[10px] bg-tertiary-fixed text-tertiary-container px-1.5 py-0.2 rounded font-bold">
                    24/24
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ci')}
                  className={`px-3 py-2 font-label-md text-label-md font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'ci'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">alt_route</span>
                  <span>GitHub CI</span>
                  <span className="font-code-sm text-[10px] bg-surface-container-highest px-1.5 py-0.2 rounded text-on-surface font-bold">
                    4 checks
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('acceptance')}
                  className={`px-3 py-2 font-label-md text-label-md font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'acceptance'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">checklist</span>
                  <span>Acceptance</span>
                  <span className="font-code-sm text-[10px] bg-tertiary-fixed text-tertiary-container px-1.5 py-0.2 rounded font-bold">
                    6/6
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ledger')}
                  className={`px-3 py-2 font-label-md text-label-md font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'ledger'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  <span>Ledger</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1 pb-2 text-outline font-code-sm text-code-sm">
                <span className="material-symbols-outlined text-[15px]">lock</span>
                <span>PR Protected</span>
              </div>
            </div>

            {/* Tab Body */}
            <div className="p-5 flex flex-col gap-4 min-h-[460px]">
              {/* TAB 1: REVIEWS */}
              {activeTab === 'reviews' && (
                <ReviewComments
                  reviewer={run.reviewData.reviewer}
                  reviewerRole={run.reviewData.reviewerRole}
                  timeAgo={run.reviewData.timeAgo}
                  badge={run.reviewData.badge}
                  comment={run.reviewData.comment}
                  proposedResolution={run.reviewData.proposedResolution}
                  onApplyPatch={() => {
                    alert("Patch applied to branch cosinput/381-verification-stake!");
                  }}
                  onDraftReply={() => {
                    navigate(`/contributions/${run.issueNumber}/reviews`);
                  }}
                />
              )}

              {/* TAB 2: CHANGES */}
              {activeTab === 'changes' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-code-md text-code-md font-semibold text-on-surface font-mono">
                      src/components/StakeForm.tsx
                    </span>
                    <div className="flex items-center gap-2 font-code-sm text-code-sm">
                      <span className="text-tertiary font-bold">+124 additions</span>
                      <span className="text-error font-bold">-18 deletions</span>
                    </div>
                  </div>

                  <div className="bg-inverse-surface text-inverse-on-surface rounded-xl overflow-hidden font-code-sm text-code-sm font-mono">
                    <div className="px-4 py-1.5 bg-surface-dim/20 text-outline-variant text-[11px] flex justify-between border-b border-surface-variant/10">
                      <span>@@ -84,8 +84,14 @@ export const StakeForm = (&#123; bountyId, minStake &#125;: StakeFormProps) =&gt;</span>
                      <span>cosinput/381-verification-stake</span>
                    </div>
                    <div className="p-4 space-y-0.5 overflow-x-auto leading-relaxed">
                      <div className="text-secondary/70">84 |   const [isSubmitting, setIsSubmitting] = useState(false);</div>
                      <div className="text-secondary/70">85 |   const [stakeAmount, setStakeAmount] = useState('');</div>
                      <div className="bg-error-container/30 text-on-error-container px-1 py-0.5 rounded">
                        86 -   const handleStake = async () =&gt; executeContractStake(bountyId, stakeAmount);
                      </div>
                      <div className="bg-tertiary-container/30 text-tertiary-fixed px-1 py-0.5 rounded">
                        86 +   const handleStake = async () =&gt; &#123;
                      </div>
                      <div className="bg-tertiary-container/30 text-tertiary-fixed px-1 py-0.5 rounded">
                        87 +     if (!validateStakeInput(stakeAmount, minStake)) return;
                      </div>
                      <div className="bg-tertiary-container/30 text-tertiary-fixed px-1 py-0.5 rounded">
                        88 +     const parsedAtomic = parseUnits(stakeAmount, 18);
                      </div>
                      <div className="bg-tertiary-container/30 text-tertiary-fixed px-1 py-0.5 rounded">
                        89 +     await executeContractStake(bountyId, BigInt(parsedAtomic));
                      </div>
                      <div className="bg-tertiary-container/30 text-tertiary-fixed px-1 py-0.5 rounded">
                        90 +   &#125;;
                      </div>
                      <div className="text-secondary/70">91 |   return (</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TESTS & TERMINAL */}
              {activeTab === 'tests' && (
                <div className="flex flex-col gap-3 font-mono">
                  <div className="flex items-center justify-between text-code-sm">
                    <span className="flex items-center gap-1.5 text-tertiary font-bold">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Vitest Execution & Coverage Report
                    </span>
                    <span className="text-outline text-xs">Runtime: 1.84s (threads: 4)</span>
                  </div>

                  <div className="bg-inverse-surface text-inverse-on-surface rounded-xl p-4 font-code-sm text-code-sm flex flex-col gap-1 shadow-inner border border-surface-container-highest/20 overflow-x-auto">
                    <div className="flex items-center justify-between text-outline-variant pb-2 border-b border-surface-variant/10 text-xs">
                      <span>sandbox@cosinput-vm: ~/diginodes-truthbounty-frontend</span>
                      <span className="text-tertiary-fixed">exit: 0</span>
                    </div>
                    <div><span className="text-primary-fixed-dim">$</span> vitest run --coverage --reporter=verbose</div>
                    <div className="text-tertiary-fixed">✓ tests/stake.test.ts (8 tests) 412ms</div>
                    <div className="text-tertiary-fixed">✓ tests/validators.test.ts (6 tests) 180ms</div>
                    <div className="text-tertiary-fixed">✓ tests/signature.test.ts (5 tests) 298ms</div>
                    <div className="text-tertiary-fixed">✓ tests/boundary.test.ts (5 tests) 210ms</div>
                    <div className="pt-2 text-white font-bold">Test Files  4 passed (4)</div>
                    <div className="text-white font-bold">Tests       24 passed (24)</div>
                    <div className="text-outline-variant">Coverage    98.4% Stmts | 95.2% Branch | 100% Funcs</div>
                    <div className="pt-2"><span className="text-primary-fixed-dim">$</span> npx tsc --noEmit</div>
                    <div className="text-tertiary-fixed">✓ TypeScript check completed with 0 errors (TS v5.4.5)</div>
                  </div>
                </div>
              )}

              {/* TAB 4: CI */}
              {activeTab === 'ci' && (
                <div className="flex flex-col gap-3 font-code-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-body-md text-body-md font-semibold text-on-surface font-sans">
                      GitHub Actions Check Table
                    </h3>
                    <span className="font-code-sm text-code-sm bg-tertiary-fixed text-tertiary-container px-2 py-0.5 rounded font-bold">
                      ALL PASSED ON RERUN
                    </span>
                  </div>

                  <div className="bg-surface-container-low rounded-xl overflow-hidden border border-surface-container">
                    <table className="w-full text-left font-body-sm text-body-sm">
                      <thead className="bg-surface-container font-label-caps text-[10px] text-secondary">
                        <tr>
                          <th className="p-2.5">Check Name</th>
                          <th className="p-2.5">Workflow Run</th>
                          <th className="p-2.5">Duration</th>
                          <th className="p-2.5">Commit</th>
                          <th className="p-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container font-mono text-[12px]">
                        <tr>
                          <td className="p-2.5 font-medium text-on-surface font-sans">Unit Tests (Vitest)</td>
                          <td className="p-2.5 text-secondary">#91025.1</td>
                          <td className="p-2.5 text-secondary">42s</td>
                          <td className="p-2.5 text-primary">e48da19</td>
                          <td className="p-2.5 text-right text-tertiary font-bold">Passed</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-medium text-on-surface font-sans">Lint & Formatting</td>
                          <td className="p-2.5 text-secondary">#91025.2</td>
                          <td className="p-2.5 text-secondary">28s</td>
                          <td className="p-2.5 text-primary">e48da19</td>
                          <td className="p-2.5 text-right text-tertiary font-bold">Passed</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-medium text-on-surface font-sans">TypeScript Strict Compile</td>
                          <td className="p-2.5 text-secondary">#91025.3</td>
                          <td className="p-2.5 text-secondary">35s</td>
                          <td className="p-2.5 text-primary">e48da19</td>
                          <td className="p-2.5 text-right text-tertiary font-bold">Passed</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: ACCEPTANCE */}
              {activeTab === 'acceptance' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="font-body-md text-body-md font-semibold text-on-surface">
                      Acceptance Verification Matrix
                    </h3>
                    <span className="font-code-sm text-code-sm bg-tertiary-fixed text-tertiary-container px-2 py-0.5 rounded font-bold">
                      6 / 6 VERIFIED
                    </span>
                  </div>

                  <div className="space-y-1.5 font-body-sm text-body-sm">
                    <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-surface-container">
                      <span>1. Verification form implemented (src/components/StakeForm.tsx)</span>
                      <span className="font-code-sm text-tertiary font-bold">Passed</span>
                    </div>
                    <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-surface-container">
                      <span>2. Stake validation implemented (src/lib/staking.ts)</span>
                      <span className="font-code-sm text-tertiary font-bold">Passed</span>
                    </div>
                    <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-surface-container">
                      <span>3. Client-side input sanitization (src/lib/validators.ts)</span>
                      <span className="font-code-sm text-tertiary font-bold">Passed</span>
                    </div>
                    <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-surface-container">
                      <span>4. Error boundary state handling (src/components/ErrorBoundary.tsx)</span>
                      <span className="font-code-sm text-tertiary font-bold">Passed</span>
                    </div>
                    <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-surface-container">
                      <span>5. Fallback signature verification (src/lib/signature.ts)</span>
                      <span className="font-code-sm text-tertiary font-bold">Passed</span>
                    </div>
                    <div className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between border border-surface-container">
                      <span>6. Non-breaking fallback behavior (tests/stake.test.ts)</span>
                      <span className="font-code-sm text-tertiary font-bold">Passed</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: LEDGER */}
              {activeTab === 'ledger' && (
                <div className="flex flex-col gap-2 font-code-sm text-code-sm font-mono">
                  <div className="flex items-center justify-between pb-1 border-b border-surface-container font-sans">
                    <span className="font-semibold text-on-surface">Real-time Agent & GitHub Ledger</span>
                    <span className="text-tertiary text-xs">Live connection streaming</span>
                  </div>

                  <div className="space-y-1.5 text-secondary">
                    <div className="p-2 hover:bg-surface-container-low rounded flex justify-between">
                      <span className="text-on-surface">[18:42:04] Guardian polling check PR #405: checks verified green</span>
                      <span className="text-outline">12s ago</span>
                    </div>
                    <div className="p-2 hover:bg-surface-container-low rounded flex justify-between">
                      <span className="text-on-surface">[18:40:11] Upstream main polled: 0 new commits since last sync</span>
                      <span className="text-outline">2m ago</span>
                    </div>
                    <div className="p-2 hover:bg-surface-container-low rounded flex justify-between">
                      <span className="text-on-surface">[18:38:22] Webhook received: review_comment submitted by @charlie-maintainer</span>
                      <span className="text-outline">4m ago</span>
                    </div>
                    <div className="p-2 hover:bg-surface-container-low rounded flex justify-between">
                      <span className="text-on-surface">[18:24:50] Fix pushed e48da19 to cosinput/381-verification-stake</span>
                      <span className="text-outline">17m ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Guardian Radar Widget */}
          <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">radar</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    PR #{run.prNumber} Guardian Radar
                  </h3>
                  <p className="font-body-sm text-body-sm text-secondary">
                    Autonomous continuous background surveillance
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-label-caps text-[10px] text-secondary font-bold">READINESS SCORE</span>
                <p className="font-headline-sm text-headline-sm font-semibold text-primary font-mono">
                  {run.readinessScore}%
                </p>
              </div>
            </div>

            {/* Radar Segmented Progress Bar */}
            <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden flex">
              <div className="bg-tertiary h-full" style={{ width: '45%' }} title="Agent Verification"></div>
              <div className="bg-primary h-full" style={{ width: '30%' }} title="GitHub CI Checks"></div>
              <div className="bg-surface-container-highest h-full" style={{ width: '25%' }} title="Awaiting Maintainer"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-body-sm text-body-sm">
              <div className="flex items-center gap-1.5 text-secondary">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                <span>Agent Implementation: <strong className="text-on-surface">Passed</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-secondary">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <span>Remote CI Status: <strong className="text-on-surface">Green</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-secondary">
                <span className="w-2.5 h-2.5 rounded-full bg-outline"></span>
                <span>Maintainer Approval: <strong className="text-on-surface">Pending</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
