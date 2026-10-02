import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';
import type {
  GuardianObservation,
  GuardianPullRequestSummary,
  CheckItem,
  CheckDiagnosis,
  ProposedRepairProposal,
  GuardianCockpitState,
  NormalizedCheckStatus,
} from '../services/types';

export const GuardianCockpitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLive } = useMode();

  const [discoveredPulls, setDiscoveredPulls] = useState<GuardianPullRequestSummary[]>([]);
  const [selectedPr, setSelectedPr] = useState<GuardianPullRequestSummary | null>(null);
  const [observation, setObservation] = useState<GuardianObservation | null>(null);
  const [loadingPulls, setLoadingPulls] = useState<boolean>(true);
  const [inspectingCi, setInspectingCi] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'checks' | 'evidence' | 'diagnosis' | 'repair'>('overview');

  // Load all authorized contributor pull requests
  const loadPullRequests = useCallback(async () => {
    setLoadingPulls(true);
    setError(null);
    try {
      if (isLive) {
        const res = await githubService.discoverGuardianPullRequests();
        const pulls = res.pulls || [];
        setDiscoveredPulls(pulls);

        // Check if query params specify owner, repo, pullNumber
        const paramOwner = searchParams.get('owner');
        const paramRepo = searchParams.get('repo');
        const paramPull = searchParams.get('pull');

        if (paramOwner && paramRepo && paramPull) {
          const matched = pulls.find(
            (p) =>
              p.upstreamOwner.toLowerCase() === paramOwner.toLowerCase() &&
              p.upstreamRepo.toLowerCase() === paramRepo.toLowerCase() &&
              p.prNumber === parseInt(paramPull, 10)
          );
          if (matched) {
            setSelectedPr(matched);
          } else {
            // Build synthetic summary to attempt direct inspection
            setSelectedPr({
              upstreamRepository: `${paramOwner}/${paramRepo}`,
              upstreamOwner: paramOwner,
              upstreamRepo: paramRepo,
              prNumber: parseInt(paramPull, 10),
              prUrl: `https://github.com/${paramOwner}/${paramRepo}/pull/${paramPull}`,
              prTitle: `PR #${paramPull}`,
              prState: 'open',
              headRepository: `${paramOwner}/${paramRepo}`,
              headOwner: paramOwner,
              headRepo: paramRepo,
              headBranch: 'unknown',
              headCommitSha: 'unknown',
              baseBranch: 'main',
              author: 'contributor',
              prChangedFiles: [],
            });
          }
        } else if (pulls.length > 0) {
          setSelectedPr(pulls[0]);
        }
      } else {
        // Mock presentation fallback for offline development
        const mockPulls: GuardianPullRequestSummary[] = [
          {
            upstreamRepository: 'acme-corp/core-utils',
            upstreamOwner: 'acme-corp',
            upstreamRepo: 'core-utils',
            prNumber: 405,
            prUrl: 'https://github.com/acme-corp/core-utils/pull/405',
            prTitle: 'fix(http): add exponential backoff retry policy',
            prState: 'open',
            headRepository: 'alice-contributor/core-utils',
            headOwner: 'alice-contributor',
            headRepo: 'core-utils',
            headBranch: 'alice/retry-policy-fix',
            headCommitSha: '7f9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
            baseBranch: 'main',
            author: 'alice-contributor',
            mergeable: true,
            mergeableState: 'clean',
            prChangedFiles: ['src/client.ts', 'tests/client.test.ts'],
          },
        ];
        setDiscoveredPulls(mockPulls);
        setSelectedPr(mockPulls[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to discover contributor pull requests.');
    } finally {
      setLoadingPulls(false);
    }
  }, [isLive, searchParams]);

  useEffect(() => {
    loadPullRequests();
  }, [loadPullRequests]);

  // Inspect CI for currently selected PR
  const inspectCurrentPrCi = useCallback(
    async (forceRefresh = false) => {
      if (!selectedPr) return;
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setInspectingCi(true);
      }
      setError(null);

      try {
        if (isLive) {
          const res = forceRefresh
            ? await githubService.refreshGuardianCi(
                selectedPr.upstreamOwner,
                selectedPr.upstreamRepo,
                selectedPr.prNumber
              )
            : await githubService.inspectGuardianCi(
                selectedPr.upstreamOwner,
                selectedPr.upstreamRepo,
                selectedPr.prNumber
              );

          if (res.success && res.observation) {
            setObservation(res.observation);
            if (forceRefresh) {
              toast.success(`CI status refreshed for PR #${selectedPr.prNumber}.`);
            }
          }
        } else {
          // Mock observation for offline development
          const mockObs: GuardianObservation = {
            id: `${selectedPr.upstreamRepository}:${selectedPr.prNumber}:${selectedPr.headCommitSha}`,
            observedKey: `${selectedPr.upstreamRepository}:${selectedPr.prNumber}:${selectedPr.headCommitSha}`,
            pullRequest: selectedPr,
            headCommitSha: selectedPr.headCommitSha,
            state: 'DIAGNOSIS_READY',
            summary: {
              totalChecks: 4,
              passedCount: 3,
              failedCount: 1,
              inProgressCount: 0,
              queuedCount: 0,
              otherCount: 0,
              conclusion: 'FAILED',
            },
            checks: [
              {
                id: '101',
                name: 'TypeScript Typecheck',
                source: 'check_run',
                providerStatus: 'completed',
                providerConclusion: 'failure',
                normalizedStatus: 'FAILED',
                startedAt: new Date(Date.now() - 300000).toISOString(),
                completedAt: new Date(Date.now() - 240000).toISOString(),
                htmlUrl: 'https://github.com/acme-corp/core-utils/actions/runs/101',
                summary: 'tsc --noEmit exited with code 1',
                text: "src/client.ts:87:11 - error TS2322: Type 'string' is not assignable to type 'number'.",
                annotations: [
                  {
                    path: 'src/client.ts',
                    startLine: 87,
                    endLine: 87,
                    annotationLevel: 'failure',
                    title: 'Type Mismatch',
                    message: "Type 'string' is not assignable to type 'number' in parameter 'timeoutMs'.",
                  },
                ],
              },
              {
                id: '102',
                name: 'Unit Tests (Vitest)',
                source: 'check_run',
                providerStatus: 'completed',
                providerConclusion: 'success',
                normalizedStatus: 'PASSED',
                startedAt: new Date(Date.now() - 300000).toISOString(),
                completedAt: new Date(Date.now() - 250000).toISOString(),
                htmlUrl: 'https://github.com/acme-corp/core-utils/actions/runs/102',
                summary: '14 tests passed in 3 test suites',
              },
              {
                id: '103',
                name: 'ESLint Code Quality',
                source: 'check_run',
                providerStatus: 'completed',
                providerConclusion: 'success',
                normalizedStatus: 'PASSED',
                startedAt: new Date(Date.now() - 300000).toISOString(),
                completedAt: new Date(Date.now() - 270000).toISOString(),
                htmlUrl: 'https://github.com/acme-corp/core-utils/actions/runs/103',
                summary: 'Zero lint errors or warnings',
              },
              {
                id: '104',
                name: 'Production Build Bundle',
                source: 'check_run',
                providerStatus: 'completed',
                providerConclusion: 'success',
                normalizedStatus: 'PASSED',
                startedAt: new Date(Date.now() - 300000).toISOString(),
                completedAt: new Date(Date.now() - 200000).toISOString(),
                htmlUrl: 'https://github.com/acme-corp/core-utils/actions/runs/104',
                summary: 'Vite production build completed',
              },
            ],
            classifications: [
              {
                category: 'TYPECHECK_FAILURE',
                confidence: 'HIGH',
                supportingEvidence: [
                  "TypeScript compiler reported TS2322 in 'src/client.ts:87:11'.",
                  "Parameter 'timeoutMs' expects type number but received string.",
                ],
                sourceCheckName: 'TypeScript Typecheck',
                sourceCheckId: '101',
                relevantFiles: ['src/client.ts'],
                logExcerpts: [
                  "src/client.ts:87:11 - error TS2322: Type 'string' is not assignable to type 'number'.",
                ],
                annotations: [
                  {
                    path: 'src/client.ts',
                    startLine: 87,
                    endLine: 87,
                    annotationLevel: 'failure',
                    title: 'Type Mismatch',
                    message: "Type 'string' is not assignable to type 'number' in parameter 'timeoutMs'.",
                  },
                ],
              },
            ],
            diagnoses: [
              {
                checkName: 'TypeScript Typecheck',
                checkId: '101',
                failedCommandOrStep: 'tsc --noEmit',
                githubReportedSummary: "tsc --noEmit failed: TS2322 in src/client.ts:87",
                likelyCategory: 'TYPECHECK_FAILURE',
                relevantFiles: ['src/client.ts'],
                relatedToPrDiff: true,
                diffRelevanceReasoning: "Failure correlates with file 'src/client.ts' modified in this PR (#405).",
                distinctions: [
                  {
                    type: 'VERIFIED_FACT',
                    statement: "GitHub Check 'TypeScript Typecheck' concluded with 'failure'.",
                    source: 'GitHub Check Runs API',
                  },
                  {
                    type: 'VERIFIED_FACT',
                    statement: "GitHub provided 1 direct failure annotation in 'src/client.ts' at line 87.",
                    source: 'GitHub Check Annotations API',
                  },
                  {
                    type: 'EVIDENCE_BASED_INFERENCE',
                    statement: "The failure is related to PR changes because 'src/client.ts' is in the PR diff.",
                    source: 'Cross-reference of PR changed files against check annotations',
                  },
                  {
                    type: 'EVIDENCE_BASED_INFERENCE',
                    statement: "Classified as TYPECHECK_FAILURE with HIGH confidence based on TS2322 code annotation.",
                    source: 'COSInput Failure Classifier',
                  },
                ],
              },
            ],
            repairProposals: [
              {
                id: 'repair-101',
                failedCheckName: 'TypeScript Typecheck',
                rootCauseHypothesis: "Parameter 'timeoutMs' was passed as string instead of parsed number.",
                evidenceSupportingHypothesis: [
                  "Type 'string' is not assignable to type 'number' in parameter 'timeoutMs'.",
                ],
                candidateFilesRequiringInspection: ['src/client.ts'],
                proposedModification: "Wrap 'timeoutMs' input with parseInt(timeoutMs, 10) or Number(timeoutMs) before assigning.",
                verificationCommandToRerun: 'npx tsc --noEmit',
                riskLevel: 'LOW',
                confidenceLevel: 'HIGH',
                requiresFurtherInspection: false,
              },
            ],
            evidenceStatus: 'AVAILABLE',
            observedAt: new Date().toISOString(),
            lastRefreshedAt: new Date().toISOString(),
          };
          setObservation(mockObs);
          if (forceRefresh) {
            toast.success('CI status refreshed.');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to inspect CI status for pull request.');
      } finally {
        setInspectingCi(false);
        setRefreshing(false);
      }
    },
    [selectedPr, isLive, toast]
  );

  useEffect(() => {
    if (selectedPr) {
      inspectCurrentPrCi();
    }
  }, [selectedPr, inspectCurrentPrCi]);

  const handleSelectPr = (pr: GuardianPullRequestSummary) => {
    setSelectedPr(pr);
    setSearchParams({
      owner: pr.upstreamOwner,
      repo: pr.upstreamRepo,
      pull: String(pr.prNumber),
    });
  };

  const getStatusBadge = (state: GuardianCockpitState) => {
    switch (state) {
      case 'CI_PASSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container/30 text-tertiary border border-tertiary/20 text-xs font-semibold">
            <span className="material-symbols-outlined text-[15px]">check_circle</span>
            <span>CI_PASSING</span>
          </span>
        );
      case 'CI_PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
            <span className="material-symbols-outlined text-[15px] animate-spin">hourglass_top</span>
            <span>CI_PENDING</span>
          </span>
        );
      case 'CI_FAILURE_DETECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container border border-error/30 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
            <span>CI_FAILURE_DETECTED</span>
          </span>
        );
      case 'ANALYZING_FAILURE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary border border-primary/30 text-xs font-semibold">
            <span className="material-symbols-outlined text-[15px] animate-pulse">travel_explore</span>
            <span>ANALYZING_FAILURE</span>
          </span>
        );
      case 'DIAGNOSIS_READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold">
            <span className="material-symbols-outlined text-[15px]">fact_check</span>
            <span>DIAGNOSIS_READY</span>
          </span>
        );
      case 'EVIDENCE_UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold">
            <span className="material-symbols-outlined text-[15px]">report_problem</span>
            <span>EVIDENCE_UNAVAILABLE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary text-xs font-medium">
            <span className="material-symbols-outlined text-[15px]">help_outline</span>
            <span>CI_DATA_UNAVAILABLE</span>
          </span>
        );
    }
  };

  const getCheckStatusBadge = (status: NormalizedCheckStatus) => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[13px]">check_circle</span>
            <span>PASSED</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-bold">
            <span className="material-symbols-outlined text-[13px]">cancel</span>
            <span>FAILED</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[13px] animate-spin">refresh</span>
            <span>IN_PROGRESS</span>
          </span>
        );
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-secondary text-[11px] font-medium">
            <span className="material-symbols-outlined text-[13px]">schedule</span>
            <span>QUEUED</span>
          </span>
        );
      case 'TIMED_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[13px]">timer_off</span>
            <span>TIMED_OUT</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-highest text-secondary text-[11px] font-medium">
            <span className="material-symbols-outlined text-[13px]">block</span>
            <span>CANCELLED</span>
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary text-[11px] font-medium">
            <span className="material-symbols-outlined text-[13px]">skip_next</span>
            <span>SKIPPED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary text-[11px] font-medium">
            <span className="material-symbols-outlined text-[13px]">help_outline</span>
            <span>UNKNOWN</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-[1720px] mx-auto animate-fade-in">
      {/* Top Header & Context Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <nav className="flex items-center gap-2 font-code-sm text-code-sm text-secondary">
            <span
              onClick={() => navigate('/pull-requests')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Pull Requests
            </span>
            <span>/</span>
            <span className="font-semibold text-on-surface">CI Guardian Cockpit</span>
            {selectedPr && (
              <>
                <span>/</span>
                <span className="text-secondary font-mono">
                  {selectedPr.upstreamRepository} #{selectedPr.prNumber}
                </span>
              </>
            )}
          </nav>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary text-[28px]">verified_user</span>
              <span>CI Guardian Cockpit</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-surface-container-high border border-surface-container text-secondary font-code-sm text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span>v0.5.1 Read-Only Active</span>
            </span>
          </div>
          <p className="text-body-sm font-body-sm text-secondary">
            Continuous surveillance, evidence-backed failure classification, grounded diagnosis, and non-executable repair planning for contributor pull requests.
          </p>
        </div>

        {/* Action Controls & Manual Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            disabled={refreshing || inspectingCi || !selectedPr}
            onClick={() => inspectCurrentPrCi(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-surface-container font-headline-sm text-sm font-medium transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[18px] text-primary ${refreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{refreshing ? 'Refreshing CI...' : 'Refresh CI Status'}</span>
          </button>

          {selectedPr?.prUrl && (
            <a
              href={selectedPr.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container font-headline-sm text-sm font-medium transition-all shadow-sm"
            >
              <span>View on GitHub</span>
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </a>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-error-container/20 border border-error/30 text-on-error-container flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">error</span>
          <div className="space-y-1">
            <span className="font-semibold text-body-sm block">Guardian Inspection Error</span>
            <span className="text-xs text-secondary">{error}</span>
          </div>
        </div>
      )}

      {/* Empty State: No PRs Discovered */}
      {!loadingPulls && discoveredPulls.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-surface-container-lowest border border-surface-container space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-secondary">
            <span className="material-symbols-outlined text-[32px]">shield_with_house</span>
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
              No Authorized Contributor Pull Requests Found
            </h3>
            <p className="font-body-sm text-body-sm text-secondary">
              CI Guardian only monitors authorized pull requests associated with your GitHub account. No open pull requests were detected in your connected repositories or forks.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/issues')}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-headline-sm text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Explore Assigned Issues
            </button>
            <button
              type="button"
              onClick={() => loadPullRequests()}
              className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface font-headline-sm text-sm font-medium hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Scan Again
            </button>
          </div>
        </div>
      )}

      {/* Active Monitored PR Selector Bar */}
      {discoveredPulls.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-secondary font-code-sm text-xs font-semibold uppercase tracking-wider">
              Monitored Pull Request:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {discoveredPulls.map((pr) => {
                const isSelected =
                  selectedPr?.upstreamRepository === pr.upstreamRepository &&
                  selectedPr?.prNumber === pr.prNumber;
                return (
                  <button
                    key={`${pr.upstreamRepository}#${pr.prNumber}`}
                    type="button"
                    onClick={() => handleSelectPr(pr)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-sm font-semibold'
                        : 'bg-surface-container-high text-secondary hover:text-on-surface hover:bg-surface-container-highest'
                    }`}
                  >
                    <span>
                      {pr.upstreamRepository} #{pr.prNumber}
                    </span>
                    <span className="opacity-80">({pr.prState})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-code-sm text-secondary">
            <span>Deduplication key:</span>
            <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface font-mono">
              {selectedPr?.upstreamRepository}#{selectedPr?.prNumber}@
              {selectedPr?.headCommitSha?.substring(0, 7) || 'HEAD'}
            </code>
          </div>
        </div>
      )}

      {/* Primary Cockpit Card */}
      {selectedPr && (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden divide-y divide-surface-container">
          {/* Header Banner */}
          <div className="p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-code-sm text-xs font-semibold uppercase tracking-wider text-secondary">
                    {selectedPr.upstreamRepository}
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-code-sm text-xs text-secondary font-mono">
                    PR #{selectedPr.prNumber}
                  </span>
                  {observation && getStatusBadge(observation.state)}
                </div>
                <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">
                  {selectedPr.prTitle}
                </h2>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1.5 bg-surface-container-high p-1 rounded-xl self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'overview'
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('checks')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'checks'
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  Checks ({observation?.checks.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('evidence')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'evidence'
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  Evidence ({observation?.classifications.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('diagnosis')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'diagnosis'
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  Diagnosis ({observation?.diagnoses.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('repair')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'repair'
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  Repair Plan ({observation?.repairProposals.length || 0})
                </button>
              </div>
            </div>

            {/* PR Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2 font-code-sm text-xs">
              <div className="p-3 rounded-lg bg-surface-container-high/50 border border-surface-container">
                <span className="text-secondary block">Author</span>
                <span className="font-semibold text-on-surface font-mono">@{selectedPr.author}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high/50 border border-surface-container">
                <span className="text-secondary block">Head Branch</span>
                <span className="font-semibold text-on-surface font-mono truncate block" title={selectedPr.headBranch}>
                  {selectedPr.headBranch}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high/50 border border-surface-container">
                <span className="text-secondary block">Base Branch</span>
                <span className="font-semibold text-on-surface font-mono">{selectedPr.baseBranch}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high/50 border border-surface-container">
                <span className="text-secondary block">Head Commit SHA</span>
                <code className="font-semibold text-primary font-mono block">
                  {selectedPr.headCommitSha.substring(0, 10)}
                </code>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high/50 border border-surface-container">
                <span className="text-secondary block">Mergeability</span>
                <span className="font-semibold text-on-surface">
                  {selectedPr.mergeable === true
                    ? 'Mergeable (Clean)'
                    : selectedPr.mergeable === false
                    ? 'Conflict Detected'
                    : 'Computing...'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-high/50 border border-surface-container">
                <span className="text-secondary block">PR Changed Files</span>
                <span className="font-semibold text-on-surface font-mono">
                  {selectedPr.prChangedFiles.length} file(s)
                </span>
              </div>
            </div>
          </div>

          {/* Tab 1: Overview & CI Summary */}
          {activeTab === 'overview' && (
            <div className="p-6 space-y-6">
              {/* Summary Counter Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="p-4 rounded-xl bg-surface-container-high/40 border border-surface-container space-y-1">
                  <span className="text-xs text-secondary font-code-sm uppercase font-semibold">Total Checks</span>
                  <div className="text-2xl font-headline-lg font-bold text-on-surface">
                    {observation?.summary.totalChecks ?? 0}
                  </div>
                  <span className="text-[11px] text-secondary">Verified GitHub checks</span>
                </div>

                <div className="p-4 rounded-xl bg-tertiary-container/20 border border-tertiary/20 space-y-1">
                  <span className="text-xs text-tertiary font-code-sm uppercase font-semibold">Passed</span>
                  <div className="text-2xl font-headline-lg font-bold text-tertiary">
                    {observation?.summary.passedCount ?? 0}
                  </div>
                  <span className="text-[11px] text-tertiary/80">Completed successfully</span>
                </div>

                <div className="p-4 rounded-xl bg-error-container/20 border border-error/30 space-y-1">
                  <span className="text-xs text-error font-code-sm uppercase font-semibold">Failed</span>
                  <div className="text-2xl font-headline-lg font-bold text-error">
                    {observation?.summary.failedCount ?? 0}
                  </div>
                  <span className="text-[11px] text-error/80">Requires failure analysis</span>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <span className="text-xs text-amber-300 font-code-sm uppercase font-semibold">In Progress</span>
                  <div className="text-2xl font-headline-lg font-bold text-amber-300">
                    {observation?.summary.inProgressCount ?? 0}
                  </div>
                  <span className="text-[11px] text-amber-400/80">Currently running</span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-high/40 border border-surface-container space-y-1">
                  <span className="text-xs text-secondary font-code-sm uppercase font-semibold">Queued</span>
                  <div className="text-2xl font-headline-lg font-bold text-secondary">
                    {observation?.summary.queuedCount ?? 0}
                  </div>
                  <span className="text-[11px] text-secondary">Awaiting runner</span>
                </div>
              </div>

              {/* Evidence Unavailable Notification */}
              {observation?.evidenceStatus === 'EVIDENCE_UNAVAILABLE' && (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-200 flex items-start gap-3">
                  <span className="material-symbols-outlined text-orange-400 text-[22px] shrink-0 mt-0.5">
                    warning
                  </span>
                  <div className="space-y-1">
                    <span className="font-semibold text-sm block">Failure Evidence Unavailable from GitHub</span>
                    <p className="text-xs text-orange-300/90 leading-relaxed">
                      {observation.evidenceUnavailableReason ||
                        'GitHub did not provide detailed step logs or annotations for failed check runs. Detailed error stack traces are unconfirmed. COSInput will not fabricate or infer source defects without verified evidence.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Top Diagnoses Preview */}
              {observation?.diagnoses && observation.diagnoses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                      <span className="material-symbols-outlined text-purple-400 text-[18px]">fact_check</span>
                      <span>Active Failure Diagnoses ({observation.diagnoses.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('diagnosis')}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      View Detailed Breakdown →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {observation.diagnoses.map((diag) => (
                      <div
                        key={diag.checkId}
                        className="p-4 rounded-xl bg-surface-container-high/30 border border-surface-container flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-on-surface text-sm">{diag.checkName}</span>
                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-semibold">
                              {diag.likelyCategory}
                            </span>
                            {diag.relatedToPrDiff ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-medium">
                                Correlates with PR Diff
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary text-[11px] font-medium">
                                Unrelated to PR Diff
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-secondary leading-relaxed font-body-sm">
                            {diag.diffRelevanceReasoning}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab('repair')}
                          className="px-3 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-container text-on-surface text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          View Repair Proposal
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Individual Checks Matrix */}
          {activeTab === 'checks' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider">
                  Verified GitHub Checks & Statuses ({observation?.checks.length || 0})
                </h3>
                <span className="text-xs font-code-sm text-secondary">
                  Preserving provider status and normalized COSInput state
                </span>
              </div>

              {(!observation?.checks || observation.checks.length === 0) ? (
                <div className="p-8 text-center rounded-xl bg-surface-container-high/20 border border-surface-container space-y-2">
                  <span className="material-symbols-outlined text-secondary text-[28px]">search_off</span>
                  <p className="text-xs text-secondary">No check runs or commit statuses reported by GitHub for this commit SHA.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-container border border-surface-container rounded-xl overflow-hidden bg-surface-container-high/20">
                  {observation.checks.map((chk) => (
                    <div key={chk.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container-high/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold text-on-surface text-sm">{chk.name}</span>
                          {getCheckStatusBadge(chk.normalizedStatus)}
                          <span className="font-mono text-[11px] text-secondary bg-surface-container px-2 py-0.5 rounded">
                            {chk.source}
                          </span>
                        </div>
                        {chk.summary && (
                          <p className="text-xs text-secondary font-mono">{chk.summary}</p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] font-code-sm text-secondary pt-0.5">
                          <span>
                            Provider status: <strong className="text-on-surface font-mono">{chk.providerStatus}</strong>
                            {chk.providerConclusion && ` (conclusion: ${chk.providerConclusion})`}
                          </span>
                          {chk.completedAt && (
                            <>
                              <span>•</span>
                              <span>Completed: {new Date(chk.completedAt).toLocaleTimeString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {chk.detailsUrl && (
                        <a
                          href={chk.detailsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
                        >
                          <span>Check Details</span>
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Failure Evidence */}
          {activeTab === 'evidence' && (
            <div className="p-6 space-y-4">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[18px]">bug_report</span>
                <span>Failure Evidence & Annotations ({observation?.classifications.length || 0})</span>
              </h3>

              {(!observation?.classifications || observation.classifications.length === 0) ? (
                <div className="p-8 text-center rounded-xl bg-surface-container-high/20 border border-surface-container space-y-2">
                  <span className="material-symbols-outlined text-tertiary text-[28px]">verified</span>
                  <p className="text-xs text-secondary">No failure evidence detected. All executed checks are green or queued.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {observation.classifications.map((cl, idx) => (
                    <div key={`${cl.sourceCheckId}-${idx}`} className="p-5 rounded-xl bg-surface-container-high/30 border border-surface-container space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-on-surface text-sm">{cl.sourceCheckName}</span>
                          <span className="px-2.5 py-0.5 rounded bg-error-container text-on-error-container text-xs font-mono font-bold">
                            {cl.category}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary text-[11px] font-semibold">
                            Confidence: {cl.confidence}
                          </span>
                        </div>
                      </div>

                      {/* Supporting Evidence List */}
                      <div className="space-y-1.5">
                        <span className="text-xs text-secondary font-code-sm font-semibold uppercase">
                          Supporting Evidence:
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-xs text-on-surface font-body-sm">
                          {cl.supportingEvidence.map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Annotations */}
                      {cl.annotations && cl.annotations.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="text-xs text-secondary font-code-sm font-semibold uppercase">
                            Direct Code Annotations ({cl.annotations.length}):
                          </span>
                          <div className="space-y-2">
                            {cl.annotations.map((ann, ai) => (
                              <div
                                key={ai}
                                className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1 font-mono text-xs"
                              >
                                <div className="flex items-center justify-between text-secondary">
                                  <span className="font-bold text-primary">
                                    {ann.path}:{ann.startLine || 1}
                                  </span>
                                  <span className="text-[11px] uppercase text-error font-semibold">
                                    {ann.annotationLevel}
                                  </span>
                                </div>
                                <p className="text-on-surface">{ann.message}</p>
                                {ann.rawDetails && (
                                  <pre className="text-[11px] text-secondary bg-surface-container/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                    {ann.rawDetails}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Log Excerpts */}
                      {cl.logExcerpts && cl.logExcerpts.length > 0 && (
                        <div className="space-y-1.5 pt-2">
                          <span className="text-xs text-secondary font-code-sm font-semibold uppercase">
                            Relevant Log Excerpts:
                          </span>
                          <pre className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container text-xs text-on-surface font-mono overflow-x-auto whitespace-pre-wrap">
                            {cl.logExcerpts.join('\n')}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Grounded Diagnosis */}
          {activeTab === 'diagnosis' && (
            <div className="p-6 space-y-4">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">clinical_notes</span>
                <span>Grounded CI Diagnoses ({observation?.diagnoses.length || 0})</span>
              </h3>

              {(!observation?.diagnoses || observation.diagnoses.length === 0) ? (
                <div className="p-8 text-center rounded-xl bg-surface-container-high/20 border border-surface-container space-y-2">
                  <span className="material-symbols-outlined text-tertiary text-[28px]">task_alt</span>
                  <p className="text-xs text-secondary">Zero diagnoses required: no active failure items found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {observation.diagnoses.map((diag) => (
                    <div key={diag.checkId} className="p-5 rounded-xl bg-surface-container-high/30 border border-surface-container space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-0.5">
                          <span className="font-bold text-on-surface text-base">{diag.checkName}</span>
                          <span className="text-xs text-secondary block font-mono">
                            Command / Step: {diag.failedCommandOrStep || 'Not specified'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-semibold">
                            {diag.likelyCategory}
                          </span>
                          {diag.relatedToPrDiff ? (
                            <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-semibold">
                              Correlates with PR Diff
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded bg-surface-container-high text-secondary text-xs font-semibold">
                              Unrelated to PR Diff
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Diff Correlation Reasoning */}
                      <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1">
                        <span className="text-xs text-secondary font-code-sm uppercase font-semibold">
                          PR Diff Correlation & Responsibility:
                        </span>
                        <p className="text-xs text-on-surface leading-relaxed font-body-sm">
                          {diag.diffRelevanceReasoning}
                        </p>
                      </div>

                      {/* Fact vs Inference Distinctions Ledger */}
                      <div className="space-y-2">
                        <span className="text-xs text-secondary font-code-sm uppercase font-semibold">
                          Epistemic Ledger (Distinguishing Verified Facts from Inferences):
                        </span>
                        <div className="space-y-2">
                          {diag.distinctions.map((dist, di) => (
                            <div
                              key={di}
                              className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-start gap-3 text-xs"
                            >
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase shrink-0 mt-0.5 ${
                                  dist.type === 'VERIFIED_FACT'
                                    ? 'bg-tertiary-container/30 text-tertiary'
                                    : dist.type === 'EVIDENCE_BASED_INFERENCE'
                                    ? 'bg-primary-container text-on-primary'
                                    : 'bg-surface-container-highest text-secondary'
                                }`}
                              >
                                {dist.type.replace('_', ' ')}
                              </span>
                              <div className="space-y-0.5">
                                <p className="text-on-surface">{dist.statement}</p>
                                <span className="text-[11px] text-secondary block">
                                  Source: {dist.source}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Proposed Repair Plan (Non-Executable) */}
          {activeTab === 'repair' && (
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[18px]">build</span>
                  <span>Proposed Repair Plan ({observation?.repairProposals.length || 0})</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded bg-error-container text-on-error-container text-xs font-bold font-mono">
                  STRICTLY READ-ONLY (NON-EXECUTABLE IN v0.5.1)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-high/40 border border-surface-container flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">info</span>
                <p className="text-xs text-secondary leading-relaxed">
                  In accordance with COSInput Foundation v0.5.1 safety invariants, CI Guardian generates advisory repair hypotheses and local reproduction commands for contributor inspection. Automated commits, pushes, and workflow reruns are prohibited.
                </p>
              </div>

              {(!observation?.repairProposals || observation.repairProposals.length === 0) ? (
                <div className="p-8 text-center rounded-xl bg-surface-container-high/20 border border-surface-container space-y-2">
                  <span className="material-symbols-outlined text-tertiary text-[28px]">done_all</span>
                  <p className="text-xs text-secondary">No repairs needed: all CI checks are passing.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {observation.repairProposals.map((prop) => (
                    <div key={prop.id} className="p-5 rounded-xl bg-surface-container-high/30 border border-surface-container space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-on-surface text-sm">
                          Repair for: {prop.failedCheckName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-surface-container text-secondary text-[11px] font-semibold">
                            Risk: {prop.riskLevel}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-surface-container text-secondary text-[11px] font-semibold">
                            Confidence: {prop.confidenceLevel}
                          </span>
                        </div>
                      </div>

                      {/* Root Cause Hypothesis */}
                      <div className="space-y-1">
                        <span className="text-xs text-secondary font-code-sm font-semibold uppercase">
                          Root-Cause Hypothesis:
                        </span>
                        <p className="text-xs text-on-surface leading-relaxed font-body-sm bg-surface-container-lowest p-3 rounded-lg border border-surface-container">
                          {prop.rootCauseHypothesis}
                        </p>
                      </div>

                      {/* Proposed Modification */}
                      <div className="space-y-1">
                        <span className="text-xs text-secondary font-code-sm font-semibold uppercase">
                          Advisory Proposed Modification:
                        </span>
                        <p className="text-xs text-on-surface leading-relaxed font-body-sm bg-surface-container-lowest p-3 rounded-lg border border-surface-container">
                          {prop.proposedModification}
                        </p>
                      </div>

                      {/* Verification Command */}
                      <div className="space-y-1">
                        <span className="text-xs text-secondary font-code-sm font-semibold uppercase">
                          Recommended Local Reproduction Command:
                        </span>
                        <div className="flex items-center justify-between bg-surface-container-lowest p-2.5 rounded-lg border border-surface-container font-mono text-xs">
                          <code className="text-primary">{prop.verificationCommandToRerun}</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(prop.verificationCommandToRerun);
                              toast.info('Command copied to clipboard.');
                            }}
                            className="text-secondary hover:text-on-surface text-[11px] font-sans font-semibold cursor-pointer"
                          >
                            Copy Command
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Security Notice */}
          <div className="p-4 bg-surface-container-high/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-secondary">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-tertiary">lock</span>
              <span>
                Read-only CI monitoring active • Zero remote write operations permitted in milestone v0.5.1
              </span>
            </div>
            {observation?.lastRefreshedAt && (
              <span>Last evaluated: {new Date(observation.lastRefreshedAt).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
