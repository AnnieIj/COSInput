import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';
import type {
  ContributionSession,
  AnalysisStatus,
  RepositoryAccessStatus,
  AcceptanceCriterion,
  RelevantFile,
  BlockerItem,
  RepositoryInstructionItem,
  SanitizedGitHubError,
} from '../services/types';

export const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLive } = useMode();

  const [session, setSession] = useState<ContributionSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<SanitizedGitHubError | null>(null);
  const hasAutoAnalyzedRef = React.useRef<string | null>(null);

  // Tab navigation inside workspace
  const [activeTab, setActiveTab] = useState<
    'plan' | 'issue' | 'criteria' | 'files' | 'instructions' | 'deps' | 'blockers'
  >('plan');

  // Human Approval Feedback modal state
  const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
  const [revisionFeedback, setRevisionFeedback] = useState<string>('');
  const [approving, setApproving] = useState<boolean>(false);

  // Load contribution session from server
  const loadSession = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      if (isLive) {
        const res = await githubService.getContributionSession(id);
        if (res.success && res.session) {
          setSession(res.session);

          // If session is newly created (NOT_STARTED), automatically run analysis once
          if (res.session.analysisStatus === 'NOT_STARTED' && hasAutoAnalyzedRef.current !== res.session.id) {
            hasAutoAnalyzedRef.current = res.session.id;
            runAnalysis(id);
          }
        }
      } else {
        // Deterministic Demo Session fixture
        setSession(getDemoSession(id));
      }
    } catch (err: any) {
      // In live mode, if not found on server, try to create from ID params
      if (isLive && err.statusCode === 404 && id.startsWith('contrib-')) {
        const parts = id.replace('contrib-', '').split('-');
        if (parts.length >= 3) {
          const issueNum = parseInt(parts.pop() || '1', 10);
          const repo = parts.pop() || 'repo';
          const owner = parts.join('-');
          try {
            const createRes = await githubService.createContributionSession({
              owner,
              repo,
              issueNumber: issueNum,
            });
            if (createRes.success && createRes.session) {
              setSession(createRes.session);
              if (hasAutoAnalyzedRef.current !== createRes.session.id) {
                hasAutoAnalyzedRef.current = createRes.session.id;
                runAnalysis(createRes.session.id);
              }
              return;
            }
          } catch {
            // Fall through to error
          }
        }
      }

      setError(
        err.classification
          ? err
          : {
              classification: 'REPOSITORY_ANALYSIS_FAILURE',
              statusCode: err.statusCode || 500,
              message: err.message || `Failed to load contribution session '${id}'.`,
            }
      );
    } finally {
      setLoading(false);
    }
  }, [id, isLive]);

  // Run analysis pipeline
  const runAnalysis = async (sessionId: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await githubService.runContributionAnalysis(sessionId);
      if (res.success && res.session) {
        setSession(res.session);
      }
    } catch (err: any) {
      if (err.session) {
        setSession(err.session);
      } else {
        const refreshed = await githubService.getContributionSession(sessionId).catch(() => null);
        if (refreshed?.session) {
          setSession(refreshed.session);
        } else {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  analysisStatus: 'FAILED',
                  currentAttemptStatus: 'FAILED',
                  errorMessage: err.message,
                  implementationPlan: null,
                }
              : prev
          );
        }
      }

      setError(
        err.classification
          ? err
          : {
              classification: 'REPOSITORY_ANALYSIS_FAILURE',
              statusCode: 500,
              message: err.message || 'Error occurred during repository intelligence analysis.',
            }
      );
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Human Approval Action Handlers
  const handleApprovePlan = async () => {
    if (!session) return;
    setApproving(true);
    try {
      if (isLive) {
        const res = await githubService.approveContributionPlan(session.id);
        if (res.success && res.session) {
          setSession(res.session);
        }
      } else {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                analysisStatus: 'APPROVED',
                humanApproval: {
                  status: 'approved',
                  approvedAt: new Date().toISOString(),
                },
              }
            : null
        );
      }
    } catch (err: any) {
      alert(`Approval error: ${err.message || 'Failed to record approval.'}`);
    } finally {
      setApproving(false);
    }
  };

  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !revisionFeedback.trim()) return;

    try {
      if (isLive) {
        const res = await githubService.requestPlanRevision(session.id, revisionFeedback);
        if (res.success && res.session) {
          setSession(res.session);
        }
      } else {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                analysisStatus: 'PLAN_READY',
                humanApproval: {
                  status: 'revision_requested',
                  feedback: revisionFeedback,
                },
              }
            : null
        );
      }
      setShowRevisionModal(false);
      setRevisionFeedback('');
    } catch (err: any) {
      alert(`Revision request error: ${err.message || 'Failed to submit revision feedback.'}`);
    }
  };

  const handleCancelContribution = async () => {
    if (!session) return;
    if (!confirm('Are you sure you want to cancel this contribution analysis session?')) return;

    try {
      if (isLive) {
        const res = await githubService.cancelContribution(session.id);
        if (res.success && res.session) {
          setSession(res.session);
        }
      } else {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                analysisStatus: 'NOT_STARTED',
                humanApproval: { status: 'cancelled' },
              }
            : null
        );
      }
    } catch (err: any) {
      alert(`Cancellation error: ${err.message || 'Failed to cancel session.'}`);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: AnalysisStatus) => {
    switch (status) {
      case 'NOT_STARTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-code-sm text-[11px] font-semibold border border-surface-container">
            Not Started
          </span>
        );
      case 'REPOSITORY_INSPECTION':
      case 'ISSUE_ANALYSIS':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-code-sm text-[11px] font-semibold flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-on-primary"></span>
            {status === 'REPOSITORY_INSPECTION' ? 'Inspecting Repository...' : 'Analyzing Issue...'}
          </span>
        );
      case 'PLAN_READY':
      case 'WAITING_FOR_APPROVAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-900 font-code-sm text-[11px] font-bold border border-amber-500/40 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
            Waiting for Human Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/25 text-tertiary font-code-sm text-[11px] font-bold border border-tertiary/40 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            Plan Approved (Implementation Idle)
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-error-container text-error font-code-sm text-[11px] font-bold border border-error/40 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px]">block</span>
            Blocked — Action Required
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-error-container text-error font-code-sm text-[11px] font-bold border border-error/40">
            Analysis Failed
          </span>
        );
      default:
        return null;
    }
  };

  const renderAccessBadge = (access: RepositoryAccessStatus) => {
    if (access === 'app_authorized') {
      return (
        <span className="px-2 py-0.5 rounded font-code-sm text-[10px] font-semibold bg-tertiary-container/20 text-tertiary border border-tertiary/30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
          <span>GitHub App Authorized</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded font-code-sm text-[10px] font-semibold bg-amber-500/15 text-amber-900 border border-amber-500/30 flex items-center gap-1">
        <span className="material-symbols-outlined text-[12px] text-amber-700">lock</span>
        <span>Write Access Not Authorized (Public Readable)</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col w-full bg-surface min-w-0">
      {/* 1. Top Context Subheader Bar */}
      <div className="bg-surface-container-lowest px-4 lg:px-8 py-4 border-b border-surface-container shadow-sm w-full">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/issues')}
                className="hover:text-primary transition-colors flex items-center gap-1 text-xs"
              >
                <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                <span>Assignments</span>
              </button>
              <span>/</span>
              <span className="font-semibold text-on-surface font-mono">
                {session?.upstreamRepository || 'Repository'}
              </span>
              <span>/</span>
              <span className="text-primary font-bold font-mono">
                #{session?.issueNumber || '0'}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h1 className="font-headline-md text-headline-md text-on-surface font-bold break-words max-w-full">
                {session?.issueTitle || 'Contribution Analysis Workspace'}
              </h1>
              {session && renderStatusBadge(session.analysisStatus)}
              {session && renderAccessBadge(session.repositoryAccessStatus)}
            </div>

            <div className="flex items-center gap-3 text-secondary font-code-sm text-[11px] flex-wrap">
              <span>Session ID: <code className="font-mono text-on-surface bg-surface-container px-1 rounded">{session?.id || id}</code></span>
              <span>•</span>
              <span>Contributor: <strong>@{session?.contributorUsername || 'you'}</strong></span>
              <span>•</span>
              <a
                href={session?.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-0.5"
              >
                <span>View on GitHub</span>
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>
            </div>
          </div>

          {/* Global Header Actions */}
          <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0 flex-wrap">
            {session && (
              <button
                type="button"
                disabled={analyzing}
                onClick={() => runAnalysis(session.id)}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold border border-surface-container shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Rerun read-only repository inspection and issue intelligence"
              >
                <span className={`material-symbols-outlined text-[16px] ${analyzing ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>{analyzing ? 'Inspecting...' : 'Re-analyze'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/issues')}
              className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface font-label-md text-label-md font-medium border border-surface-container transition-colors"
            >
              Back to Issues
            </button>
          </div>
        </div>
      </div>

      {/* 2. Error Diagnostic Box */}
      {error && (
        <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 pt-4">
          <div className="p-4 rounded-xl bg-error-container/20 border border-error/40 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-[22px] mt-0.5 shrink-0">error</span>
              <div className="flex flex-col gap-1">
                <span className="font-headline-sm text-headline-sm text-error font-bold">
                  {error.classification} {error.statusCode > 0 ? `(Status ${error.statusCode})` : ''}
                </span>
                <p className="font-body-md text-body-md text-on-surface">{error.message}</p>
                <span className="font-code-sm text-[11px] text-secondary">
                  Strict Rule: COSInput will not fake analysis or fall back to mock data.
                </span>
              </div>
            </div>
            {session && (
              <button
                type="button"
                onClick={() => runAnalysis(session.id)}
                className="px-3 py-1.5 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold shrink-0 cursor-pointer"
              >
                Retry Analysis
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Human Approval Gate Banner (Requirement 10 & 16) */}
      {session && session.analysisStatus === 'APPROVED' && (
        <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 pt-4">
          <div className="p-4 rounded-xl bg-tertiary-container/15 border border-tertiary/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">check</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-bold text-tertiary">
                  Plan Approved. Implementation has not started.
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Human verification completed. In accordance with Foundation v0.3 invariants, zero write operations, branches, or autonomous coding runs were executed.
                </span>
              </div>
            </div>
            <span className="font-code-sm text-[11px] bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1 rounded font-semibold uppercase">
              Ready for v0.4 Runner
            </span>
          </div>
        </div>
      )}

      {session && (session.analysisStatus === 'FAILED' || session.currentAttemptStatus === 'FAILED') && (
        <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 pt-4">
          <div className="p-4 rounded-xl bg-error-container/20 border border-error/40 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-error text-on-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">block</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-bold text-error">
                  Analysis Failed — Approval Blocked
                </span>
                <span className="font-body-sm text-body-sm text-on-surface">
                  The current analysis attempt encountered a failure. No partial plan has been published, and plan approval is strictly disabled.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => runAnalysis(session.id)}
              className="px-4 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold cursor-pointer shrink-0"
            >
              Retry Analysis
            </button>
          </div>
        </div>
      )}

      {session && session.analysisStatus === 'PLAN_READY' && session.currentAttemptStatus === 'SUCCEEDED' && session.implementationPlan && (
        <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 pt-4">
          <div className="p-4 rounded-xl bg-primary-fixed/30 border border-primary/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">fact_check</span>
              </div>
              <div>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface block">
                  Implementation Plan Ready for Human Approval
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  Review the proposed changes, acceptance criteria, and relevant files below. Approving confirms the specification without modifying code.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowRevisionModal(true)}
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold border border-surface-container transition-colors cursor-pointer"
              >
                Request Plan Revision
              </button>

              <button
                type="button"
                onClick={handleCancelContribution}
                className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-error-container/20 text-secondary hover:text-error font-label-md text-label-md font-medium border border-surface-container transition-colors"
              >
                Cancel Contribution
              </button>

              <button
                type="button"
                disabled={approving}
                onClick={handleApprovePlan}
                className="px-5 py-2 rounded-lg bg-tertiary-container text-on-tertiary hover:opacity-90 font-headline-sm text-headline-sm font-semibold shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>{approving ? 'Approving...' : 'Approve Plan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Main Body: Split Layout (Main Content + Right Side Panel) */}
      <main className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 flex-1">
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-surface-container rounded-xl w-1/3"></div>
            <div className="h-64 bg-surface-container-low rounded-xl"></div>
          </div>
        )}

        {!loading && session && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Main Workspace Section (Cols 8) */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              {/* Tab Navigation */}
              <div className="bg-surface-container-lowest p-1.5 rounded-xl border border-surface-container shadow-sm flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('plan')}
                  className={`px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'plan'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">assignment</span>
                  <span>Implementation Plan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('issue')}
                  className={`px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'issue'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  <span>Issue Understanding</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('criteria')}
                  className={`px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'criteria'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">checklist</span>
                  <span>Acceptance Criteria ({session.acceptanceCriteria.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'files'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>Relevant Files ({session.relevantFiles.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('instructions')}
                  className={`px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'instructions'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">menu_book</span>
                  <span>Repo Instructions</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('deps')}
                  className={`px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'deps'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">settings_input_component</span>
                  <span>Deps & Config</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('blockers')}
                  className={`px-3.5 py-2 rounded-lg font-label-md text-label-md font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'blockers'
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  <span>Risks & Blockers ({session.blockers.length})</span>
                </button>
              </div>

              {/* Tab 1: Implementation Plan */}
              {activeTab === 'plan' && (
                <div className="space-y-5">
                  {session.implementationPlan ? (
                    <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-6">
                      <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[22px]">assignment</span>
                          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                            Proposed Implementation Plan
                          </h2>
                        </div>
                        <span className="px-3 py-1 rounded font-code-sm text-[11px] font-bold uppercase bg-surface-container text-on-surface">
                          Change Surface: {session.implementationPlan.estimatedChangeSurface}
                        </span>
                      </div>

                      {/* Issue & Repo Understanding */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-1.5">
                          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
                            Issue Target
                          </span>
                          <p className="font-body-md text-body-md text-on-surface font-semibold">
                            {session.implementationPlan.issueSummary}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-1.5">
                          <span className="font-label-caps text-[10px] uppercase text-secondary font-bold">
                            Repository Context
                          </span>
                          <p className="font-body-md text-body-md text-secondary">
                            {session.implementationPlan.repositoryUnderstanding}
                          </p>
                        </div>
                      </div>

                      {/* Proposed Changes list (mapped to ACs) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                            Proposed Code & Structural Changes
                          </h3>
                          <span className="font-code-sm text-code-sm text-secondary">
                            {session.implementationPlan.proposedChanges.length} targets mapped to ACs
                          </span>
                        </div>

                        <div className="divide-y divide-surface-container-low border border-surface-container rounded-xl overflow-hidden">
                          {session.implementationPlan.proposedChanges.map((change) => (
                            <div
                              key={change.id}
                              className="p-4 bg-surface-container-lowest hover:bg-surface-container-low/30 transition-colors flex flex-col gap-2.5"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-code-sm text-code-sm font-mono font-bold text-primary">
                                    {change.targetFile}
                                  </span>
                                  {change.changeRole && (
                                    <span
                                      className={`px-2 py-0.5 rounded font-label-caps text-[10px] font-bold ${
                                        change.changeRole === 'MODIFICATION'
                                          ? 'bg-primary-container text-on-primary'
                                          : change.changeRole === 'INSPECTION_ONLY'
                                          ? 'bg-amber-500/20 text-amber-900 border border-amber-500/30'
                                          : 'bg-tertiary-container/30 text-tertiary border border-tertiary/40'
                                      }`}
                                    >
                                      {change.changeRole}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {change.mappedAcceptanceCriteriaIds.map((acId) => (
                                    <span
                                      key={acId}
                                      className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-code-sm text-[10px] font-bold"
                                    >
                                      Maps to {acId}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <p className="font-body-md text-body-md text-on-surface font-semibold">
                                {change.description}
                              </p>

                              {change.existingBehavior && (
                                <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container space-y-0.5 text-body-sm font-body-sm">
                                  <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block font-mono">
                                    Inspected Existing Behavior
                                  </span>
                                  <p className="text-secondary">{change.existingBehavior}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-body-sm font-body-sm">
                                {change.necessityExplanation && (
                                  <div className="p-2.5 rounded-lg bg-surface-container-low/70 border border-surface-container text-secondary space-y-0.5">
                                    <strong className="text-on-surface text-[11px] block font-mono">
                                      Why Necessary:
                                    </strong>
                                    <span>{change.necessityExplanation}</span>
                                  </div>
                                )}
                                {change.verificationStrategy && (
                                  <div className="p-2.5 rounded-lg bg-surface-container-low/70 border border-surface-container text-secondary space-y-0.5">
                                    <strong className="text-on-surface text-[11px] block font-mono">
                                      Verification Strategy:
                                    </strong>
                                    <span>{change.verificationStrategy}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Verification: Tests & Build/Lint */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
                          <div className="flex items-center gap-1.5 font-headline-sm text-headline-sm font-semibold text-on-surface">
                            <span className="material-symbols-outlined text-primary text-[18px]">biotech</span>
                            <span>Tests To Run</span>
                          </div>
                          <ul className="space-y-1.5 font-code-sm text-code-sm text-secondary">
                            {session.implementationPlan.testsToRun.map((t, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                <span>{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
                          <div className="flex items-center gap-1.5 font-headline-sm text-headline-sm font-semibold text-on-surface">
                            <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                            <span>Build / Lint Checks</span>
                          </div>
                          <ul className="space-y-1.5 font-code-sm text-code-sm text-secondary">
                            {session.implementationPlan.buildLintVerification.map((b, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Out of Scope & Risks */}
                      <div className="space-y-3 pt-2 border-t border-surface-container-low">
                        <h4 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                          Strictly Out of Scope
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.implementationPlan.outOfScopeItems.map((item, idx) => (
                            <span key={idx} className="px-3 py-1 rounded-lg bg-surface-container text-secondary font-code-sm text-code-sm">
                              ✕ {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {session.currentAttemptStatus === 'FAILED' ? (
                        <div className="p-6 rounded-xl bg-surface-container-lowest border border-error/30 space-y-4">
                          <div className="flex items-center gap-2 text-error font-bold font-headline-sm text-headline-sm">
                            <span className="material-symbols-outlined text-[24px]">gpp_bad</span>
                            <span>Analysis Attempt Failed — Approval Strictly Disabled</span>
                          </div>
                          <p className="font-body-md text-body-md text-on-surface">
                            The current analysis attempt failed and was aborted. No unverified or partial plan is ready for review or approval.
                          </p>
                          {session.errorMessage && (
                            <div className="p-3.5 rounded-lg bg-error-container/10 border border-error/20 font-code-sm text-[12px] text-error font-mono break-all">
                              {session.errorMessage}
                            </div>
                          )}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => runAnalysis(session.id)}
                              className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold cursor-pointer"
                            >
                              Retry Repository & Issue Analysis
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl bg-surface-container-lowest border border-surface-container text-center space-y-3">
                          <span className="material-symbols-outlined text-[40px] text-outline">pending_actions</span>
                          <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Plan Not Generated Yet</h3>
                          <p className="font-body-md text-body-md text-secondary max-w-md mx-auto">
                            Repository inspection and issue analysis have not run for this contribution session.
                          </p>
                          <button
                            type="button"
                            onClick={() => runAnalysis(session.id)}
                            className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold"
                          >
                            Run Repository & Issue Analysis
                          </button>
                        </div>
                      )}

                      {/* Preserved Historical Plans */}
                      {session.historicalPlans && session.historicalPlans.length > 0 && (
                        <div className="p-6 rounded-xl bg-surface-container-low border border-surface-container space-y-4">
                          <div className="flex items-center justify-between border-b border-surface-container pb-3">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-secondary text-[22px]">history</span>
                              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                                Historical Plan (Preserved from Previous Attempt)
                              </h3>
                            </div>
                            <span className="px-2.5 py-0.5 rounded font-code-sm text-[11px] font-bold uppercase bg-surface-container-high text-secondary border border-surface-container">
                              ARCHIVED SNAPSHOT — NOT APPROVABLE
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-secondary">
                            This implementation plan was generated during an earlier successful attempt (Archived at: {new Date(session.historicalPlans[session.historicalPlans.length - 1].completedAt).toLocaleString()}). It is preserved strictly as historical data and cannot be approved against the failed current attempt.
                          </p>
                          <div className="space-y-3">
                            <span className="font-label-caps text-[11px] uppercase font-bold text-secondary block">
                              Preserved Proposed Changes ({session.historicalPlans[session.historicalPlans.length - 1].plan.proposedChanges.length})
                            </span>
                            <div className="space-y-2">
                              {session.historicalPlans[session.historicalPlans.length - 1].plan.proposedChanges.map((change, idx) => (
                                <div key={idx} className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-center justify-between text-sm">
                                  <div>
                                    <span className="font-code-sm text-[12px] text-on-surface font-semibold block">{change.targetFile}</span>
                                    <span className="font-body-sm text-[12px] text-secondary">{change.description}</span>
                                  </div>
                                  <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-surface-container text-secondary uppercase font-semibold">
                                    {change.changeRole || 'HISTORICAL'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Issue Understanding */}
              {activeTab === 'issue' && (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-6">
                  <div className="border-b border-surface-container-low pb-3">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Issue Intelligence & Requirements Separation
                    </h2>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Strict separation of explicit maintainer requirements from inferred context and unknown questions.
                    </p>
                  </div>

                  {session.issueIntelligence ? (
                    <div className="space-y-5">
                      {/* Explicit Requirements */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded font-label-caps text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-fixed">
                            EXPLICIT REQUIREMENTS
                          </span>
                          <span className="font-code-sm text-code-sm text-secondary">
                            Directly specified by maintainer or issue author
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
                          {session.issueIntelligence.explicitRequirements.map((req, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-on-surface font-body-md text-body-md">
                              <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">check_circle</span>
                              <span>{req}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Inferred Requirements */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded font-label-caps text-[10px] font-bold bg-primary-fixed text-on-primary-fixed">
                            INFERRED REQUIREMENTS
                          </span>
                          <span className="font-code-sm text-code-sm text-secondary">
                            Derived from repository architecture and toolchain
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
                          {session.issueIntelligence.inferredRequirements.map((req, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-secondary font-body-md text-body-md">
                              <span className="material-symbols-outlined text-outline text-[18px] mt-0.5 shrink-0">info</span>
                              <span>{req}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Unknowns / Questions */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded font-label-caps text-[10px] font-bold bg-amber-500/20 text-amber-900 border border-amber-500/30">
                            UNKNOWN / NEEDS CONFIRMATION
                          </span>
                          <span className="font-code-sm text-code-sm text-secondary">
                            Must not be invented by AI assumptions
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container">
                          {session.issueIntelligence.unknownsAndQuestions.length > 0 ? (
                            session.issueIntelligence.unknownsAndQuestions.map((q, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-amber-900 font-body-md text-body-md">
                                <span className="material-symbols-outlined text-amber-700 text-[18px] mt-0.5 shrink-0">help</span>
                                <span>{q}</span>
                              </div>
                            ))
                          ) : (
                            <span className="font-code-sm text-code-sm text-secondary">
                              No unresolved specification ambiguities identified.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-secondary font-body-md">Issue intelligence pending analysis.</p>
                  )}
                </div>
              )}

              {/* Tab 3: Acceptance Criteria */}
              {activeTab === 'criteria' && (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                    <div>
                      <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                        Acceptance Criteria Engine
                      </h2>
                      <p className="font-body-sm text-body-sm text-secondary">
                        Structured, verifiable criteria derived from issue, documentation, and existing tests.
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded bg-surface-container font-code-sm text-code-sm font-bold text-primary">
                      {session.acceptanceCriteria.length} Criteria
                    </span>
                  </div>

                  <div className="space-y-3">
                    {session.acceptanceCriteria.map((ac) => (
                      <div key={ac.id} className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-code-sm text-code-sm font-mono font-bold text-primary bg-primary-fixed/40 px-2 py-0.5 rounded">
                              {ac.id}
                            </span>
                            <span className="px-2 py-0.5 rounded font-label-caps text-[10px] font-bold bg-surface-container text-secondary">
                              {ac.type}
                            </span>
                            <span className="font-code-sm text-[11px] text-secondary">
                              Source: <strong>{ac.source}</strong>
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded font-code-sm text-[10px] font-bold ${
                            ac.confidence === 'HIGH' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-amber-500/20 text-amber-900'
                          }`}>
                            {ac.confidence} Confidence
                          </span>
                        </div>

                        <p className="font-body-md text-body-md text-on-surface font-medium pl-1">
                          {ac.description}
                        </p>

                        <div className="pt-2 border-t border-surface-container text-code-sm font-code-sm text-secondary flex items-start gap-1.5 pl-1">
                          <span className="font-semibold text-on-surface shrink-0">Verification:</span>
                          <span>{ac.verificationStrategy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 4: Relevant Files */}
              {activeTab === 'files' && (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
                  <div className="border-b border-surface-container-low pb-3">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Relevant Files Discovery
                    </h2>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Classified against repository tree with confidence ratings and modification likelihood.
                    </p>
                  </div>

                  <div className="divide-y divide-surface-container-low border border-surface-container rounded-xl overflow-hidden">
                    {session.relevantFiles.map((file) => (
                      <div key={file.path} className="p-4 bg-surface-container-lowest hover:bg-surface-container-low/40 transition-colors flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-code-sm text-code-sm font-mono font-bold text-on-surface">
                            {file.path}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-surface-container font-label-caps text-[10px] font-bold text-secondary">
                              {file.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded font-code-sm text-[10px] font-semibold ${
                              file.modificationLikely ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container text-secondary'
                            }`}>
                              {file.modificationLikely ? 'Modification Likely' : 'Read-Only Reference'}
                            </span>
                          </div>
                        </div>
                        <p className="font-body-sm text-body-sm text-secondary">
                          {file.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 5: Repository Instructions */}
              {activeTab === 'instructions' && (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
                  <div className="border-b border-surface-container-low pb-3">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Discovered Contributor Instructions
                    </h2>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Extracted from AGENTS.md, CONTRIBUTING.md, and configuration manifests. COSInput never invents rules.
                    </p>
                  </div>

                  {session.repositoryIntelligence?.discoveredInstructions && session.repositoryIntelligence.discoveredInstructions.length > 0 ? (
                    <div className="space-y-3">
                      {session.repositoryIntelligence.discoveredInstructions.map((inst, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                              {inst.title}
                            </h3>
                            <span className="px-2 py-0.5 rounded font-code-sm text-[10px] font-mono bg-surface-container text-secondary">
                              Source: {inst.sourceFile}
                            </span>
                          </div>
                          <p className="font-code-sm text-code-sm text-secondary whitespace-pre-wrap">
                            {inst.details}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-secondary font-body-md">
                      No explicit AGENTS.md or CONTRIBUTING.md files detected in repository tree.
                    </p>
                  )}
                </div>
              )}

              {/* Tab 6: Dependencies & Config */}
              {activeTab === 'deps' && (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-6">
                  <div className="border-b border-surface-container-low pb-3">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Dependencies & External Configuration
                    </h2>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Detected runtime toolchain and external environment dependencies.
                    </p>
                  </div>

                  {session.dependenciesAndConfig && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container">
                          <span className="text-secondary font-code-sm text-[11px] block">Language</span>
                          <span className="font-bold text-on-surface font-mono">{session.dependenciesAndConfig.language}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container">
                          <span className="text-secondary font-code-sm text-[11px] block">Framework</span>
                          <span className="font-bold text-primary font-mono">{session.dependenciesAndConfig.framework}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container">
                          <span className="text-secondary font-code-sm text-[11px] block">Package Manager</span>
                          <span className="font-bold text-on-surface font-mono">{session.dependenciesAndConfig.packageManager}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container">
                          <span className="text-secondary font-code-sm text-[11px] block">Test Tooling</span>
                          <span className="font-bold text-tertiary font-mono">{session.dependenciesAndConfig.testFramework}</span>
                        </div>
                      </div>

                      {session.dependenciesAndConfig.externalConfiguration.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                            Required External Configuration (.env.example)
                          </h3>
                          <div className="divide-y divide-surface-container border border-surface-container rounded-xl overflow-hidden">
                            {session.dependenciesAndConfig.externalConfiguration.map((cfg, idx) => (
                              <div key={idx} className="p-3 bg-surface-container-lowest flex items-center justify-between">
                                <code className="font-mono text-code-sm text-primary font-bold">{cfg.name}</code>
                                <span className="px-2 py-0.5 rounded font-code-sm text-[10px] bg-surface-container text-secondary uppercase">
                                  {cfg.category}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 7: Risks & Blockers */}
              {activeTab === 'blockers' && (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
                  <div className="border-b border-surface-container-low pb-3">
                    <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Blocker Detection & Risk Analysis
                    </h2>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Pre-implementation blockers must be resolved before any code modifications occur.
                    </p>
                  </div>

                  {session.blockers.length > 0 ? (
                    <div className="space-y-3">
                      {session.blockers.map((b) => {
                        const isConstraint = b.category === 'REPOSITORY_ACCESS_LIMITATION';
                        return (
                          <div
                            key={b.id}
                            className={`p-4 rounded-xl space-y-2 border ${
                              isConstraint
                                ? 'bg-amber-500/10 border-amber-500/25'
                                : 'bg-error-container/15 border-error/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span
                                className={`px-2.5 py-0.5 rounded font-label-caps text-[10px] font-bold ${
                                  isConstraint
                                    ? 'bg-amber-500/20 text-amber-900 border border-amber-500/30'
                                    : 'bg-error text-on-error'
                                }`}
                              >
                                {isConstraint ? 'INFORMATIONAL EXECUTION CONSTRAINT' : b.category}
                              </span>
                            </div>
                            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                              {b.description}
                            </h3>
                            <p className="font-body-sm text-body-sm text-secondary">
                              <strong>Impact:</strong> {b.impact}
                            </p>
                            <div className="p-2.5 rounded-lg bg-surface-container-low font-code-sm text-code-sm text-on-surface border border-surface-container">
                              <strong>{isConstraint ? 'Guidance:' : 'Action:'}</strong> {b.recommendedNextAction}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-tertiary-container/15 text-tertiary border border-tertiary/30 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      <span className="font-headline-sm text-headline-sm font-semibold">Zero Blockers Detected</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Side Panel: Repository Intelligence & Timeline (Cols 4) */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Repository Intelligence Card */}
              <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-surface-container-low pb-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">source</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Repository Intelligence
                  </h3>
                </div>

                <div className="space-y-2.5 font-code-sm text-code-sm">
                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">Language:</span>
                    <span className="font-semibold text-on-surface font-mono">
                      {session.dependenciesAndConfig?.language || session.repositoryIntelligence?.sampleTreeFiles ? 'TypeScript' : 'Detecting...'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">Framework:</span>
                    <span className="font-semibold text-primary font-mono">
                      {session.dependenciesAndConfig?.framework || 'React'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">Package Manager:</span>
                    <span className="font-semibold text-on-surface font-mono">
                      {session.dependenciesAndConfig?.packageManager || 'npm'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">Default Branch:</span>
                    <span className="font-semibold text-on-surface font-mono">
                      {session.repositoryIntelligence?.defaultBranch || 'main'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">Test Tooling:</span>
                    <span className="font-semibold text-tertiary font-mono">
                      {session.dependenciesAndConfig?.testFramework || 'Vitest'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">CI System:</span>
                    <span className="font-semibold text-on-surface font-mono">
                      {session.dependenciesAndConfig?.ciSystem || 'GitHub Actions'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">App Authorization:</span>
                    <span className="font-semibold text-on-surface font-mono">
                      {session.repositoryAccessStatus === 'app_authorized' ? 'Authorized' : 'Public Only'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-surface-container-low">
                    <span className="text-secondary">Files Indexed:</span>
                    <span className="font-semibold text-on-surface font-mono">
                      {session.repositoryIntelligence?.totalTreeFilesCount || 0} files
                    </span>
                  </div>
                </div>
              </div>

              {/* Activity Timeline Card (Requirement 11) */}
              <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-surface-container-low pb-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Activity Timeline
                  </h3>
                </div>

                <div className="space-y-4 relative pl-3 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container">
                  {session.activityTimeline.map((item, idx) => (
                    <div key={item.id || idx} className="flex items-start gap-3 relative">
                      <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 z-10 ${
                        item.completed ? 'bg-tertiary ring-2 ring-surface' : item.active ? 'bg-primary ring-2 ring-surface animate-ping' : 'bg-outline'
                      }`} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-headline-sm text-sm font-bold text-on-surface truncate">
                            {item.stage}
                          </span>
                          <span className="font-code-sm text-[10px] text-secondary">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-secondary">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 5. Revision Feedback Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRequestRevision} className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 border border-surface-container shadow-2xl space-y-4">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
              Request Plan Revision
            </h3>
            <p className="font-body-sm text-body-sm text-secondary">
              Provide feedback or specific directives for revising the proposed implementation plan.
            </p>
            <textarea
              required
              rows={4}
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="e.g. Please add specific unit tests for the filter debounce routine..."
              className="w-full p-3 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold cursor-pointer"
              >
                Submit Feedback
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/**
 * Deterministic Demo Session generator for offline demonstration.
 */
function getDemoSession(id: string): ContributionSession {
  const now = new Date().toISOString();
  return {
    id,
    repositoryOwner: 'DigiNodes',
    repositoryName: 'truthbounty-frontend',
    upstreamRepository: 'DigiNodes/truthbounty-frontend',
    issueNumber: 381,
    issueTitle: 'Improve search and filter discoverability in signal lists',
    issueUrl: 'https://github.com/DigiNodes/truthbounty-frontend/issues/381',
    contributorUsername: 'contributor',
    repositoryAccessStatus: 'app_authorized',
    analysisStatus: 'PLAN_READY',
    createdTimestamp: now,
    updatedTimestamp: now,
    repositoryIntelligence: {
      owner: 'DigiNodes',
      repo: 'truthbounty-frontend',
      defaultBranch: 'main',
      description: 'Decentralized truth verification frontend',
      stars: 142,
      forks: 38,
      openIssuesCount: 4,
      isPrivate: false,
      discoveredInstructionFiles: ['CONTRIBUTING.md', 'package.json'],
      discoveredInstructions: [
        {
          category: 'pr_expectations',
          title: 'Repository Contribution Guidelines',
          details: 'All pull requests must pass local vitest and eslint verification before opening PR.',
          sourceFile: 'CONTRIBUTING.md',
        },
      ],
      workflowFiles: ['.github/workflows/ci.yml'],
      relevantSourceDirs: ['src', 'components'],
      relevantTestDirs: ['tests'],
      totalTreeFilesCount: 84,
      sampleTreeFiles: ['src/components/SignalList.tsx', 'src/components/SearchFilter.tsx', 'tests/SignalList.test.ts'],
    },
    issueIntelligence: {
      problemStatement: 'Users cannot easily find or filter signals in dense list views.',
      requestedBehavior: 'Make filter controls permanently visible and add instant search feedback.',
      expectedBehavior: 'Search controls remain sticky at top of list with clear badges for active filters.',
      explicitRequirements: [
        'Search controls remain visible and discoverable in the signal list.',
        'Selected filter pills display count of active matches.',
      ],
      inferredRequirements: [
        'Provide unit tests under Vitest verifying filter reactivity.',
        'Ensure strict TypeScript compliance with zero lint regressions.',
      ],
      unknownsAndQuestions: [],
      filesMentioned: ['src/components/SignalList.tsx'],
      apisMentioned: [],
      dependenciesMentioned: ['lucide-react', 'vitest'],
      testsRequested: ['Unit test for filter query change'],
      documentationRequirements: [],
      constraints: ['Preserve existing responsive layout breakpoints'],
      securityConsiderations: ['Sanitize user input before regex filtering'],
      outOfScopeItems: ['Backend search API changes', 'Database schema updates'],
    },
    acceptanceCriteria: [
      {
        id: 'AC-01',
        description: 'Search controls remain visible and discoverable in the signal list.',
        source: 'ISSUE',
        type: 'UX',
        verificationStrategy: 'Inspect affected component + verify sticky positioning.',
        confidence: 'HIGH',
      },
      {
        id: 'AC-02',
        description: 'Selected filter pills display count of active matches.',
        source: 'ISSUE',
        type: 'FUNCTIONAL',
        verificationStrategy: 'Verify filter match counter increments correctly.',
        confidence: 'HIGH',
      },
      {
        id: 'AC-03',
        description: 'Pass Vitest unit test suite covering modified routines.',
        source: 'EXISTING_TEST',
        type: 'TEST',
        verificationStrategy: 'Run npm test / vitest run tests/SignalList.test.ts.',
        confidence: 'HIGH',
      },
    ],
    relevantFiles: [
      {
        path: 'src/components/SignalList.tsx',
        category: 'PRIMARY',
        reason: 'Main component rendering signal items and filter toolbar.',
        confidence: 'HIGH',
        modificationLikely: true,
      },
      {
        path: 'tests/SignalList.test.ts',
        category: 'TEST',
        reason: 'Unit test suite for signal list component.',
        confidence: 'HIGH',
        modificationLikely: true,
      },
    ],
    dependenciesAndConfig: {
      framework: 'React',
      language: 'TypeScript',
      packageManager: 'npm',
      runtime: 'Node.js',
      majorDependencies: ['react', 'react-dom', 'lucide-react', 'vitest'],
      testFramework: 'Vitest',
      lintTooling: 'ESLint',
      buildTooling: 'Vite',
      ciSystem: 'GitHub Actions',
      externalConfiguration: [],
    },
    blockers: [],
    implementationPlan: {
      issueSummary: 'Issue #381: Improve search and filter discoverability in signal lists',
      repositoryUnderstanding: 'DigiNodes/truthbounty-frontend (TypeScript, React) with Vitest tooling.',
      proposedChanges: [
        {
          id: 'change-1',
          targetFile: 'src/components/SignalList.tsx',
          description: 'Refactor search header to sticky container and add active filter badges.',
          mappedAcceptanceCriteriaIds: ['AC-01', 'AC-02'],
        },
        {
          id: 'change-2',
          targetFile: 'tests/SignalList.test.ts',
          description: 'Add tests for search filtering and active filter badge counts.',
          mappedAcceptanceCriteriaIds: ['AC-03'],
        },
      ],
      testsToRun: ['npm test / vitest run tests/SignalList.test.ts'],
      buildLintVerification: ['npm run lint', 'tsc --noEmit'],
      risks: ['Ensure mobile responsiveness on narrow viewports'],
      blockers: [],
      outOfScopeItems: ['Backend search API changes'],
      estimatedChangeSurface: 'SMALL',
    },
    humanApproval: {
      status: 'pending',
    },
    activityTimeline: [
      {
        id: 't-1',
        stage: 'Issue Loaded',
        timestamp: now,
        detail: 'Targeted #381 in DigiNodes/truthbounty-frontend for read-only inspection.',
        completed: true,
      },
      {
        id: 't-2',
        stage: 'Repository Inspected',
        timestamp: now,
        detail: 'Tree indexed (84 files), CONTRIBUTING.md found.',
        completed: true,
      },
      {
        id: 't-3',
        stage: 'Instructions Found',
        timestamp: now,
        detail: 'Discovered contributor guidelines from CONTRIBUTING.md.',
        completed: true,
      },
      {
        id: 't-4',
        stage: 'Acceptance Criteria Generated',
        timestamp: now,
        detail: 'Synthesized 3 structured criteria (AC-01 to AC-03).',
        completed: true,
      },
      {
        id: 't-5',
        stage: 'Relevant Files Identified',
        timestamp: now,
        detail: 'Identified src/components/SignalList.tsx and tests/SignalList.test.ts.',
        completed: true,
      },
      {
        id: 't-6',
        stage: 'Plan Generated',
        timestamp: now,
        detail: 'Structured implementation plan ready for human review.',
        completed: true,
      },
      {
        id: 't-7',
        stage: 'Waiting For Approval',
        timestamp: now,
        detail: 'Plan submitted to human contributor. Implementation has not started.',
        completed: true,
        active: true,
      },
    ],
  };
}
