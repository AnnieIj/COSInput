/**
 * COSInput Foundation v0.4.3 — Controlled Commit, Push & Pull Request Creation UI
 * 
 * Strict Multi-Stage Approval Workflow:
 * 1. Diff & Local Verification Review
 * 2. Explicit Commit Approval & Approved-File Staging
 * 3. Explicit Push Approval & Fork Destination Verification (Zero Upstream Writes)
 * 4. Explicit Pull Request Approval & Upstream Targeting ('Closes #...')
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { githubService } from '../services/github.service';
import type {
  ContributionSession,
  SubmissionReviewData,
  SubmissionRecord,
  SubmissionStatus,
  SanitizedGitHubError,
} from '../services/types';

interface SubmissionReviewPanelProps {
  session: ContributionSession;
  onSessionUpdated: (updatedSession: ContributionSession) => void;
  onError: (err: SanitizedGitHubError | Error) => void;
}

export const SubmissionReviewPanel: React.FC<SubmissionReviewPanelProps> = ({
  session,
  onSessionUpdated,
  onError,
}) => {
  const { toast } = useToast();
  const [review, setReview] = useState<SubmissionReviewData | null>(null);
  const [loadingReview, setLoadingReview] = useState<boolean>(true);
  const [workspaceStatus, setWorkspaceStatus] = useState<any>(null);

  // Form states
  const [customCommitMessage, setCustomCommitMessage] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [proceedDespiteFailureAck, setProceedDespiteFailureAck] = useState<boolean>(false);
  const [customPrTitle, setCustomPrTitle] = useState<string>('');
  const [customPrBody, setCustomPrBody] = useState<string>('');

  // Loading states
  const [committing, setCommitting] = useState<boolean>(false);
  const [pushing, setPushing] = useState<boolean>(false);
  const [creatingPR, setCreatingPR] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  // Active sub-view within review panel
  const [activeSubTab, setActiveSubTab] = useState<'diff' | 'verification' | 'criteria'>('diff');

  // Load review data and workspace status
  const loadReviewData = useCallback(async () => {
    setLoadingReview(true);
    try {
      const res = await githubService.getSubmissionReview(session.id);
      if (res.success && res.review) {
        setReview(res.review);
        setCustomCommitMessage(res.review.proposedCommitMessage);
        setSelectedFiles(res.review.actualChangedFiles);
        setCustomPrTitle(res.review.proposedPrTitle);
        setCustomPrBody(res.review.proposedPrDescription);
      }

      // Also fetch real execution boundary status
      try {
        const wsRes = await githubService.getWorkspaceExecutionStatus(session.id);
        if (wsRes.success) {
          setWorkspaceStatus(wsRes.status);
        }
      } catch {
        // Fall through
      }
    } catch (err: any) {
      onError(err);
    } finally {
      setLoadingReview(false);
    }
  }, [session.id, onError]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  const currentSubmission: SubmissionRecord | null = session.currentSubmission || null;
  const status: SubmissionStatus = currentSubmission?.status || 'REVIEW_READY';

  // Handler for Commit approval
  const handleApproveCommit = async () => {
    if (selectedFiles.length === 0) {
      toast.warning('You must select at least one approved file to stage.');
      return;
    }
    if (review?.hasVerificationFailure && !proceedDespiteFailureAck) {
      toast.warning('Please check the acknowledgement to proceed despite verification failures.');
      return;
    }

    setCommitting(true);
    try {
      const res = await githubService.approveCommit(session.id, {
        approvedFiles: selectedFiles,
        customCommitMessage: customCommitMessage.trim(),
        proceedDespiteFailureAck,
      });
      if (res.success && res.session) {
        onSessionUpdated(res.session);
      }
    } catch (err: any) {
      onError(err);
    } finally {
      setCommitting(false);
    }
  };

  // Handler for Push approval
  const handleApprovePush = async () => {
    setPushing(true);
    try {
      const res = await githubService.approvePush(session.id);
      if (res.success && res.session) {
        onSessionUpdated(res.session);
      }
    } catch (err: any) {
      onError(err);
    } finally {
      setPushing(false);
    }
  };

  // Handler for PR creation approval
  const handleApprovePR = async () => {
    setCreatingPR(true);
    try {
      const res = await githubService.approvePullRequest(session.id, {
        title: customPrTitle.trim(),
        body: customPrBody.trim(),
      });
      if (res.success && res.session) {
        onSessionUpdated(res.session);
      }
    } catch (err: any) {
      onError(err);
    } finally {
      setCreatingPR(false);
    }
  };

  // Handler for reset
  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset the submission state?')) return;
    setResetting(true);
    try {
      const res = await githubService.resetSubmission(session.id);
      if (res.success && res.session) {
        onSessionUpdated(res.session);
        loadReviewData();
      }
    } catch (err: any) {
      onError(err);
    } finally {
      setResetting(false);
    }
  };

  if (loadingReview) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
        <p className="font-body-md text-body-md text-secondary">
          Analyzing working tree, diff, and verification evidence for submission...
        </p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-6 rounded-xl bg-error-container/20 border border-error/40 text-on-surface">
        <h3 className="font-headline-sm text-headline-sm font-bold text-error">
          Submission Review Unavailable
        </h3>
        <p className="font-body-sm text-body-sm mt-1 text-secondary">
          Could not load submission review. Please verify that the implementation runner has completed.
        </p>
        <button
          type="button"
          onClick={loadReviewData}
          className="mt-3 px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold"
        >
          Retry Review Check
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Real Execution Boundary Badge (Section 1) */}
      <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">publish</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Controlled Contributor Submission Pipeline
              </h2>
              <span className="px-2.5 py-0.5 rounded font-mono text-[11px] font-bold uppercase bg-surface-container-high text-on-surface border border-surface-container">
                Stage: {status}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Reviewed implementation → Explicit approval → Commit → Push to fork → Open upstream PR.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadReviewData}
            className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold border border-surface-container flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh</span>
          </button>
          {status !== 'REVIEW_READY' && status !== 'PR_OPENED' && (
            <button
              type="button"
              disabled={resetting}
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-error-container/20 text-secondary hover:text-error font-label-md text-label-md font-medium border border-surface-container transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>{resetting ? 'Resetting...' : 'Reset'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Real vs Simulated Execution Boundary Indicator (Section 1) */}
      <div
        className={`p-3.5 rounded-xl border flex items-start gap-3 ${
          review.isExecutionReal
            ? 'bg-tertiary-container/15 border-tertiary/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${
            review.isExecutionReal ? 'text-tertiary' : 'text-amber-500'
          }`}
        >
          {review.isExecutionReal ? 'verified' : 'info'}
        </span>
        <div className="text-body-sm text-body-sm space-y-0.5">
          <div className="flex items-center gap-2">
            <strong className="text-on-surface">
              Execution Boundary:{' '}
              {review.isExecutionReal ? 'REAL GIT WORKING DIRECTORY' : 'SIMULATED / TEST RUNNER'}
            </strong>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                review.isExecutionReal
                  ? 'bg-tertiary-container text-on-tertiary'
                  : 'bg-amber-500/20 text-amber-900'
              }`}
            >
              {review.executionEnvironment}
            </span>
          </div>
          <p className="text-secondary">
            {review.isExecutionReal
              ? `Changes exist on isolated disk workspace (${workspaceStatus?.workspacePath || '/tmp/cosinput-workspaces'}). Diff and exit codes were verified from genuine processes.`
              : 'Execution ran within bounded test fixtures. Commit and push operations will use verified records.'}
          </p>
        </div>
      </div>

      {/* 2. Pipeline Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div
          className={`p-3 rounded-lg border flex items-center gap-2.5 ${
            status === 'REVIEW_READY' || status === 'COMMIT_APPROVAL_REQUIRED'
              ? 'bg-primary-container text-on-primary border-primary font-bold'
              : currentSubmission?.commitSha
              ? 'bg-surface-container-low border-tertiary text-tertiary'
              : 'bg-surface-container-lowest border-surface-container text-secondary'
          }`}
        >
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/20">
            {currentSubmission?.commitSha ? '✓' : '1'}
          </span>
          <div className="text-xs">
            <div className="font-semibold">Stage 1: Commit</div>
            <div className="opacity-80">
              {currentSubmission?.commitSha ? currentSubmission.commitSha.substring(0, 7) : 'Requires Approval'}
            </div>
          </div>
        </div>

        <div
          className={`p-3 rounded-lg border flex items-center gap-2.5 ${
            status === 'PUSH_APPROVAL_REQUIRED' || status === 'PUSHING'
              ? 'bg-primary-container text-on-primary border-primary font-bold'
              : currentSubmission?.pushedAt
              ? 'bg-surface-container-low border-tertiary text-tertiary'
              : 'bg-surface-container-lowest border-surface-container text-secondary'
          }`}
        >
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/20">
            {currentSubmission?.pushedAt ? '✓' : '2'}
          </span>
          <div className="text-xs">
            <div className="font-semibold">Stage 2: Push to Fork</div>
            <div className="opacity-80">
              {currentSubmission?.pushedAt ? 'Branch Pushed' : 'Requires Approval'}
            </div>
          </div>
        </div>

        <div
          className={`p-3 rounded-lg border flex items-center gap-2.5 ${
            status === 'PR_APPROVAL_REQUIRED' || status === 'PR_CREATING'
              ? 'bg-primary-container text-on-primary border-primary font-bold'
              : currentSubmission?.prUrl
              ? 'bg-surface-container-low border-tertiary text-tertiary'
              : 'bg-surface-container-lowest border-surface-container text-secondary'
          }`}
        >
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/20">
            {currentSubmission?.prUrl ? '✓' : '3'}
          </span>
          <div className="text-xs">
            <div className="font-semibold">Stage 3: Upstream PR</div>
            <div className="opacity-80">
              {currentSubmission?.prNumber ? `#${currentSubmission.prNumber}` : 'Requires Approval'}
            </div>
          </div>
        </div>

        <div
          className={`p-3 rounded-lg border flex items-center gap-2.5 ${
            status === 'PR_OPENED'
              ? 'bg-tertiary-container text-on-tertiary border-tertiary font-bold shadow-sm'
              : 'bg-surface-container-lowest border-surface-container text-secondary'
          }`}
        >
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/20">
            {status === 'PR_OPENED' ? '✓' : '4'}
          </span>
          <div className="text-xs">
            <div className="font-semibold">Stage 4: Completed</div>
            <div className="opacity-80">
              {status === 'PR_OPENED' ? 'PR Active on GitHub' : 'Pending PR'}
            </div>
          </div>
        </div>
      </div>

      {/* Conflict or Divergence Warning (Section 5) */}
      {status === 'CONFLICT_REQUIRES_REVIEW' && (
        <div className="p-4 rounded-xl bg-error-container/20 border-2 border-error space-y-2">
          <div className="flex items-center gap-2 text-error font-headline-sm text-headline-sm font-bold">
            <span className="material-symbols-outlined text-[22px]">merge_type</span>
            <span>Remote Branch Divergence Detected — Push Halted</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface">
            {currentSubmission?.divergenceDetails ||
              'Remote branch on contributor fork contains commits that do not exist locally. In accordance with COSInput invariants, force-pushing is strictly prohibited.'}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleApprovePush}
              disabled={pushing}
              className="px-4 py-2 rounded-lg bg-error text-on-error font-headline-sm text-headline-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              <span>{pushing ? 'Retrying Push...' : 'Retry Divergence Check'}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold"
            >
              Reset Submission
            </button>
          </div>
        </div>
      )}

      {/* 3. Stage 4: PR Opened Success Banner */}
      {status === 'PR_OPENED' && currentSubmission && (
        <div className="p-6 rounded-xl bg-tertiary-container/20 border-2 border-tertiary space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-tertiary/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-[28px]">task_alt</span>
              <div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Pull Request #{currentSubmission.prNumber} Successfully Opened
                </h3>
                <span className="font-body-sm text-body-sm text-secondary">
                  Target: <code>{session.upstreamRepository}</code> ({session.workspacePreparation?.baseBranch})
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full font-bold text-xs uppercase bg-tertiary text-on-tertiary">
              PR OPENED
            </span>
          </div>

          <div className="p-4 rounded-lg bg-surface-container-lowest border border-surface-container space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-secondary font-semibold">GitHub Pull Request URL:</span>
              <a
                href={currentSubmission.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono font-bold flex items-center gap-1"
              >
                <span>{currentSubmission.prUrl}</span>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-secondary font-semibold">Head Reference:</span>
              <code className="text-on-surface font-mono">
                {session.workspacePreparation?.contributorFork?.owner}:{session.workspacePreparation?.branchName}
              </code>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-secondary font-semibold">Issue Closing Reference:</span>
              <code className="text-tertiary font-mono font-bold">Closes #{session.issueNumber}</code>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container text-body-sm text-secondary">
            <strong className="text-on-surface">Foundation v0.4.3 Milestone Complete:</strong> Pull request has been submitted to the upstream maintainers. COSInput does NOT autonomously merge PRs or start CI Guardian. Further monitoring will be handled in v0.5 CI Guardian.
          </div>
        </div>
      )}

      {/* 4. Submission Review Details (Section 3) */}
      <div className="p-5 rounded-xl bg-surface-container-low border border-surface-container space-y-4">
        {/* Repo & Branch Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-code-sm font-code-sm">
          <div className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1.5">
            <div className="flex justify-between">
              <span className="text-secondary">Canonical Upstream:</span>
              <strong className="text-on-surface">{review.canonicalUpstream}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Target Base Branch:</span>
              <code className="text-on-surface">{review.targetBranch}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Target Issue:</span>
              <strong className="text-primary">#{review.issueNumber}: {review.issueTitle.substring(0, 30)}...</strong>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1.5">
            <div className="flex justify-between">
              <span className="text-secondary">Contributor Fork (Push Target):</span>
              <strong className="text-primary">{review.contributorFork}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Source Issue Branch:</span>
              <code className="text-on-surface font-bold">{review.sourceBranch}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Approved Plan Version:</span>
              <code className="text-secondary">{review.approvedPlanVersion}</code>
            </div>
          </div>
        </div>

        {/* Sub-tab navigation: Diff vs Verification vs Criteria */}
        <div className="flex items-center gap-2 border-b border-surface-container pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('diff')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeSubTab === 'diff'
                ? 'bg-primary-container text-on-primary'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Actual Git Diff ({review.actualChangedFiles.length} files)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('verification')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeSubTab === 'verification'
                ? 'bg-primary-container text-on-primary'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Verification Suite ({review.verificationResults.length} commands)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('criteria')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeSubTab === 'criteria'
                ? 'bg-primary-container text-on-primary'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            Acceptance Criteria ({review.acceptanceCriteriaEvidence.length} criteria)
          </button>
        </div>

        {/* Diff View */}
        {activeSubTab === 'diff' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-secondary font-code-sm">
              <span>Changed Files: <strong>{review.actualChangedFiles.join(', ')}</strong></span>
              <span>Diff lines: {review.gitDiff.split('\n').length}</span>
            </div>
            <pre className="bg-black text-green-300 font-mono text-xs p-4 rounded-lg overflow-x-auto whitespace-pre leading-relaxed max-h-72">
              {review.gitDiff || '// No diff recorded'}
            </pre>
          </div>
        )}

        {/* Verification View */}
        {activeSubTab === 'verification' && (
          <div className="space-y-2">
            {review.verificationResults.map((vr) => (
              <div
                key={vr.id}
                className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      vr.passed ? 'bg-tertiary-container text-on-tertiary' : 'bg-error-container text-on-error'
                    }`}
                  >
                    {vr.passed ? '✓' : '✗'}
                  </span>
                  <div>
                    <code className="font-bold text-on-surface">{vr.command}</code>
                    <p className="text-secondary">{vr.outputSummary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono shrink-0">
                  <span className="text-secondary">Exit: {vr.exitCode}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      vr.passed ? 'bg-tertiary-container/30 text-tertiary' : 'bg-error-container/30 text-error'
                    }`}
                  >
                    {vr.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Criteria View */}
        {activeSubTab === 'criteria' && (
          <div className="space-y-2">
            {review.acceptanceCriteriaEvidence.map((ace) => (
              <div
                key={ace.criterionId}
                className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-start gap-2.5 text-xs"
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] mt-0.5 shrink-0 ${
                    ace.verified ? 'bg-tertiary-container text-on-tertiary' : 'bg-error-container text-on-error'
                  }`}
                >
                  {ace.verified ? '✓' : '✗'}
                </span>
                <div>
                  <strong className="text-on-surface block">{ace.description}</strong>
                  <p className="text-secondary mt-0.5">Evidence: {ace.evidence}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Stage 1: Commit Approval Gate (Section 4) */}
      {!currentSubmission?.commitSha && (
        <div className="p-5 rounded-xl bg-surface-container-lowest border-2 border-primary/30 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Human Approval Gate 1: Create Controlled Commit
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                Explicit approval is required before staging and committing changes. Wildcard staging is prohibited.
              </p>
            </div>
          </div>

          {/* Staging Selection: Approved Files Only (Section 3) */}
          <div className="space-y-2">
            <label className="font-label-caps text-[11px] uppercase font-bold text-secondary block">
              Stage Approved Files (Select files to include in commit):
            </label>
            <div className="space-y-1.5 p-3 rounded-lg bg-surface-container-low border border-surface-container">
              {review.actualChangedFiles.map((file) => (
                <label key={file} className="flex items-center gap-2.5 text-xs font-mono text-on-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(file)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles([...selectedFiles, file]);
                      } else {
                        setSelectedFiles(selectedFiles.filter((f) => f !== file));
                      }
                    }}
                    className="rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>{file}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Grounded Commit Message Editor (Section 4) */}
          <div className="space-y-1.5">
            <label className="font-label-caps text-[11px] uppercase font-bold text-secondary block">
              Grounded Commit Message:
            </label>
            <textarea
              rows={4}
              value={customCommitMessage}
              onChange={(e) => setCustomCommitMessage(e.target.value)}
              className="w-full font-mono text-xs p-3 rounded-lg bg-surface-container-low border border-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Failure Acknowledgement checkbox if verification failed (Section 2) */}
          {review.hasVerificationFailure && (
            <div className="p-3.5 rounded-lg bg-amber-500/15 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Verification Failures Detected in Local Test Suite</span>
              </div>
              <label className="flex items-start gap-2 text-xs text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={proceedDespiteFailureAck}
                  onChange={(e) => setProceedDespiteFailureAck(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>
                  I acknowledge that one or more verification commands failed, and I explicitly choose to proceed with commit creation. Failure details will be preserved in the submission record.
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={committing || selectedFiles.length === 0 || (review.hasVerificationFailure && !proceedDespiteFailureAck)}
              onClick={handleApproveCommit}
              className="px-6 py-2.5 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center gap-2 shadow hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>{committing ? 'Staging & Committing...' : 'Approve & Create Commit'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Stage 2: Push Approval Gate (Section 5) */}
      {currentSubmission?.commitSha && !currentSubmission.pushedAt && (
        <div className="p-5 rounded-xl bg-surface-container-lowest border-2 border-primary/30 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-tertiary text-[24px]">cloud_upload</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Human Approval Gate 2: Safe Push to Contributor Fork
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                Separate explicit approval required. Destination is verified as contributor fork only. Never pushes to canonical upstream.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface-container-low border border-surface-container space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-secondary">Verified Commit SHA:</span>
              <strong className="text-tertiary">{currentSubmission.commitSha}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Push Destination:</span>
              <strong className="text-primary font-bold">{review.contributorFork} (Fork)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Branch:</span>
              <strong className="text-on-surface">{review.sourceBranch}</strong>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Upstream Write Protection:</span>
              <span className="text-tertiary font-bold">Enforced (Upstream push blocked)</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={pushing}
              onClick={handleApprovePush}
              className="px-6 py-2.5 rounded-lg bg-tertiary-container text-on-tertiary font-headline-sm text-headline-sm font-semibold flex items-center gap-2 shadow hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
              <span>{pushing ? 'Pushing Branch to Fork...' : 'Approve & Push to Fork'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. Stage 3: Pull Request Approval Gate (Section 6) */}
      {currentSubmission?.pushedAt && status !== 'PR_OPENED' && (
        <div className="p-5 rounded-xl bg-surface-container-lowest border-2 border-primary/30 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[24px]">call_merge</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Human Approval Gate 3: Open Pull Request Against Upstream
              </h3>
              <p className="font-body-sm text-body-sm text-secondary">
                Targets canonical upstream repository <code>{review.canonicalUpstream}</code>. Includes closing reference <code>Closes #{review.issueNumber}</code>.
              </p>
            </div>
          </div>

          {/* Existing PR Warning if found (Section 6) */}
          {review.existingPrFound && (
            <div className="p-3.5 rounded-lg bg-primary-fixed/20 border border-primary/30 text-xs text-on-surface flex items-center justify-between">
              <div>
                <strong>Existing Pull Request Detected:</strong> #{review.existingPr?.number} ({review.existingPr?.title})
              </div>
              <a
                href={review.existingPr?.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-bold"
              >
                View Existing PR
              </a>
            </div>
          )}

          {/* PR Title */}
          <div className="space-y-1.5">
            <label className="font-label-caps text-[11px] uppercase font-bold text-secondary block">
              Pull Request Title:
            </label>
            <input
              type="text"
              value={customPrTitle}
              onChange={(e) => setCustomPrTitle(e.target.value)}
              className="w-full font-mono text-xs p-3 rounded-lg bg-surface-container-low border border-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* PR Body */}
          <div className="space-y-1.5">
            <label className="font-label-caps text-[11px] uppercase font-bold text-secondary block">
              Pull Request Description (Markdown):
            </label>
            <textarea
              rows={8}
              value={customPrBody}
              onChange={(e) => setCustomPrBody(e.target.value)}
              className="w-full font-mono text-xs p-3 rounded-lg bg-surface-container-low border border-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={creatingPR || !customPrTitle.trim()}
              onClick={handleApprovePR}
              className="px-6 py-2.5 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center gap-2 shadow hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
              <span>{creatingPR ? 'Opening Pull Request...' : 'Approve & Open Pull Request'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
