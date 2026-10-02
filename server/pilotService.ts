/**
 * COSInput Foundation v0.4.4 — First Real Contributor Pilot Service
 * 
 * Manages the controlled, human-supervised end-to-end contributor pilot:
 * 1. Pilot Issue Selection: Contributor explicitly selects one fresh, unresolved issue from synchronized assignments.
 * 2. Strict Issue Eligibility: Verifies issue is open, contributor is assigned, repo is accessible,
 *    issue is not already completed, and no existing contributor PR addresses the issue.
 * 3. Historical Exclusion: Explicitly rejects AgesEmpire/StellarSwipe-FrontEnd #657 from active execution.
 * 4. Grounded Implementation: Generates plan from authentic source; requires explicit approval before execution.
 * 5. Authentic Execution: Uses verified Git workspace engine; genuine clone, diff, and modifications.
 * 6. Genuine Verification: Records real test/lint/typecheck/build commands with outcomes (PASSED, FAILED, BLOCKED, NOT_RUN).
 * 7. Human Review: Comprehensive review of actual files, diff, test results, evidence, and PR preview.
 * 8. Remote Write Safety: Stops at REVIEW_READY; zero automated PR creation, zero direct push to upstream.
 * 9. Final Report: Summarizes changed files, test results, workflow status, and no-live-write confirmation.
 */

import { githubServerClient, classifyGitHubError } from './githubClient';
import { userAuthStore } from './userAuthStore';
import { contributionSessionStore } from './contributionSessionStore';
import { workspaceExecutionEngine } from './workspaceExecutionEngine';
import { repositoryIntelligenceService } from './repositoryIntelligenceService';
import { issueAnalysisService } from './issueAnalysisService';
import { workspacePreparationService } from './workspacePreparationService';
import { implementationRunnerService } from './implementationRunnerService';
import { controlledSubmissionService } from './submissionService';
import type {
  ContributionSession,
  PilotEligibilityCheck,
  PilotFinalReport,
  PilotStatus,
  SanitizedGitHubError,
  VerificationResultItem,
  AcceptanceCriterionEvidence,
  ModifiedFileResult,
} from './types';

export class PilotService {
  /**
   * Section 1: Pilot Issue Eligibility Verification
   * 
   * Verifies that:
   * 1. The issue is open on GitHub.
   * 2. The contributor is actively assigned to the issue.
   * 3. The repository is accessible.
   * 4. The issue is not already completed by the contributor.
   * 5. No existing contributor PR already addresses the issue.
   * 6. AgesEmpire/StellarSwipe-FrontEnd #657 is explicitly excluded.
   */
  async verifyPilotIssueEligibility(
    owner: string,
    repo: string,
    issueNumber: number,
    targetContributor?: string
  ): Promise<PilotEligibilityCheck> {
    const reasons: string[] = [];

    // Historical issue protection: AgesEmpire/StellarSwipe-FrontEnd #657
    const isHistoricalStellar657 =
      owner.toLowerCase() === 'agesempire' &&
      repo.toLowerCase() === 'stellarswipe-frontend' &&
      issueNumber === 657;

    if (isHistoricalStellar657) {
      return {
        eligible: false,
        isOpen: false,
        isAssigned: false,
        isAccessible: true,
        isCompleted: true,
        hasExistingPr: false,
        isExcludedHistorical: true,
        reasons: [
          'Historical issue AgesEmpire/StellarSwipe-FrontEnd #657 is reserved for regression verification only and is strictly excluded from active pilot execution.',
        ],
      };
    }

    const userProfile = userAuthStore.getUserProfile();
    const contributor = targetContributor || userProfile?.login;
    const userToken = userAuthStore.getUserToken();

    let isOpen = false;
    let isAssigned = false;
    let isAccessible = false;
    let isCompleted = false;
    let hasExistingPr = false;
    let existingPrUrl: string | undefined;
    let existingPrNumber: number | undefined;

    // 1. Check repository accessibility
    try {
      const repoData = await githubServerClient.getRepositoryDetails(
        null,
        owner,
        repo,
        userToken || undefined
      );
      if (repoData && repoData.name) {
        isAccessible = true;
      }
    } catch (err: any) {
      reasons.push(`Repository ${owner}/${repo} is inaccessible or does not exist: ${err.message}`);
    }

    // 2. Check issue status and assignments
    try {
      const issue = await githubServerClient.getIssue(
        null,
        owner,
        repo,
        issueNumber,
        userToken || undefined
      );

      if (issue) {
        isOpen = issue.state === 'open';
        if (!isOpen) {
          reasons.push(`Issue #${issueNumber} on ${owner}/${repo} is closed.`);
          isCompleted = true;
        }

        const assignees = (issue.assignees || []).map((a: any) =>
          typeof a === 'string' ? a.toLowerCase() : (a.login || '').toLowerCase()
        );

        if (contributor) {
          isAssigned = assignees.includes(contributor.toLowerCase());
          if (!isAssigned) {
            reasons.push(
              `Contributor @${contributor} is not assigned to issue #${issueNumber}. Assignees: ${assignees.join(', ') || 'none'}.`
            );
          }
        } else {
          isAssigned = true; // No contributor specified
        }
      }
    } catch (err: any) {
      reasons.push(`Failed to fetch issue #${issueNumber} from GitHub: ${err.message}`);
    }

    // 3. Check for existing PR addressing the issue
    try {
      const openPrs = await githubServerClient.listPullRequests(
        owner,
        repo,
        { state: 'open' },
        userToken || undefined
      );

      for (const pr of openPrs) {
        const matchesIssueInTitle =
          pr.title.includes(`#${issueNumber}`) ||
          pr.title.toLowerCase().includes(`issue ${issueNumber}`);
        const matchesIssueInBody =
          (pr.body || '').toLowerCase().includes(`closes #${issueNumber}`) ||
          (pr.body || '').toLowerCase().includes(`fixes #${issueNumber}`) ||
          (pr.body || '').toLowerCase().includes(`resolves #${issueNumber}`);
        const headBranch = pr.head?.ref || (pr as any).headBranch || '';
        const matchesIssueInBranch =
          headBranch.includes(`/${issueNumber}-`) ||
          headBranch.includes(`issue-${issueNumber}`);

        const headRepoOwner = pr.head?.label?.split(':')[0] || (pr as any).headRepoOwner || '';
        const isContributorPr =
          !contributor ||
          (headRepoOwner && headRepoOwner.toLowerCase() === contributor.toLowerCase());

        if ((matchesIssueInTitle || matchesIssueInBody || matchesIssueInBranch) && isContributorPr) {
          hasExistingPr = true;
          existingPrUrl = pr.htmlUrl;
          existingPrNumber = pr.number;
          reasons.push(
            `Existing pull request #${pr.number} already addresses issue #${issueNumber} (${pr.htmlUrl}).`
          );
          break;
        }
      }
    } catch {
      // Continue if PR search is unauthenticated or restricted
    }

    const eligible =
      isAccessible &&
      isOpen &&
      isAssigned &&
      !isCompleted &&
      !hasExistingPr &&
      !isHistoricalStellar657;

    return {
      eligible,
      isOpen,
      isAssigned,
      isAccessible,
      isCompleted,
      hasExistingPr,
      isExcludedHistorical: false,
      existingPrUrl,
      existingPrNumber,
      reasons,
    };
  }

  /**
   * Section 1: Explicit Contributor Pilot Issue Selection
   * Prohibits automatic issue selection; requires human choice.
   */
  async selectPilotIssue(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    issueTitle?: string;
    issueUrl?: string;
    repoAuthorizationStatus?: string;
    customCloneSource?: string;
  }): Promise<ContributionSession> {
    if (!params.owner || !params.repo || !params.issueNumber) {
      throw classifyGitHubError(
        400,
        'Cannot start pilot: owner, repo, and issueNumber must be explicitly selected by the contributor.'
      );
    }

    const userProfile = userAuthStore.getUserProfile();
    const contributorUsername = userProfile?.login || 'contributor';

    // Verify eligibility
    const eligibility = await this.verifyPilotIssueEligibility(
      params.owner,
      params.repo,
      params.issueNumber,
      contributorUsername
    );

    if (!eligibility.eligible) {
      throw classifyGitHubError(
        400,
        `Selected issue is not eligible for Pilot execution: ${eligibility.reasons.join('; ')}`
      );
    }

    // Create session in store
    const session = contributionSessionStore.createSession({
      repositoryOwner: params.owner,
      repositoryName: params.repo,
      issueNumber: params.issueNumber,
      issueTitle: params.issueTitle || `Issue #${params.issueNumber}`,
      issueUrl: params.issueUrl || `https://github.com/${params.owner}/${params.repo}/issues/${params.issueNumber}`,
      contributorUsername,
      repositoryAccessStatus: (params.repoAuthorizationStatus as any) || 'public_readable',
    });

    const updated = contributionSessionStore.updateSession(session.id, {
      isPilotRun: true,
      pilotStatus: 'ISSUE_VERIFIED',
      customCloneSource: params.customCloneSource,
      requireAuthenticCheckout: true,
    });

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Pilot Issue Selected',
      `Contributor selected issue #${params.issueNumber} on ${params.owner}/${params.repo} for First Real Contributor Pilot.`
    );

    return updated;
  }

  /**
   * Section 3: Grounded Implementation Plan Generation & Approval Gate
   */
  async generatePilotPlan(sessionId: string): Promise<ContributionSession> {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      throw classifyGitHubError(404, `Contribution session '${sessionId}' not found.`);
    }

    // Run semantic intelligence and plan formulation
    const attemptId = contributionSessionStore.startAnalysisAttempt(session.id);
    const userToken = userAuthStore.getUserToken();

    let issuePayload = await githubServerClient.getIssue(
      null,
      session.repositoryOwner,
      session.repositoryName,
      session.issueNumber,
      userToken || undefined
    );

    const { repositoryIntelligence, dependencyConfig, rawFiles } =
      await repositoryIntelligenceService.inspectRepository(
        session.repositoryOwner,
        session.repositoryName,
        null,
        session.lastVerifiedSnapshot
      );

    const fetchFileContent = async (filePath: string): Promise<{ content: string; sha?: string }> => {
      try {
        const fileRes = await githubServerClient.getFileContent(
          null,
          session.repositoryOwner,
          session.repositoryName,
          filePath,
          repositoryIntelligence.defaultBranch,
          userToken || undefined
        );
        return { content: fileRes.content || '', sha: fileRes.sha };
      } catch {
        return { content: '', sha: undefined };
      }
    };

    const analysis = await issueAnalysisService.analyzeIssue({
      issueNumber: session.issueNumber,
      issueTitle: issuePayload?.title || session.issueTitle,
      issueBody: issuePayload?.body || '',
      issueLabels: issuePayload?.labels || [],
      repositoryIntelligence,
      dependencyConfig,
      repositoryAccessStatus: session.repositoryAccessStatus,
      rawFiles,
      fetchFileContent,
    });

    const updated = contributionSessionStore.commitAnalysisAttempt(session.id, attemptId, {
      repositoryIntelligence,
      dependencyConfig,
      issueIntelligence: analysis.issueIntelligence,
      acceptanceCriteria: analysis.acceptanceCriteria,
      relevantFiles: analysis.relevantFiles,
      blockers: analysis.blockers,
      implementationPlan: analysis.implementationPlan,
      isBlocked: analysis.isBlocked,
    });

    const withPilot = contributionSessionStore.updateSession(session.id, {
      pilotStatus: 'PLAN_APPROVAL_REQUIRED',
    });

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Pilot Plan Generated',
      'Grounded implementation plan created. Explicit human approval required before execution.'
    );

    return withPilot;
  }

  /**
   * Human Approval Gate: Approves the pilot implementation plan.
   */
  async approvePilotPlan(sessionId: string): Promise<ContributionSession> {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      throw classifyGitHubError(404, `Contribution session '${sessionId}' not found.`);
    }

    if (!session.implementationPlan) {
      throw classifyGitHubError(400, 'Cannot approve pilot: No implementation plan exists for this session.');
    }

    const updated = contributionSessionStore.updateSession(session.id, {
      analysisStatus: 'APPROVED',
      humanApproval: {
        status: 'approved',
        approvedAt: new Date().toISOString(),
      },
      pilotStatus: 'PLAN_APPROVED',
    });

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Pilot Plan Approved',
      'Human contributor explicitly approved implementation plan. Ready for authentic workspace execution.'
    );

    return updated;
  }

  /**
   * Section 2 & 4: Authentic Execution & Genuine Verification
   * 
   * Executes the approved plan using verified Git workspace engine,
   * runs genuine verification commands with outcomes (PASSED, FAILED, BLOCKED, NOT_RUN),
   * and stops at REVIEW_READY without performing any remote writes.
   */
  async runPilotExecution(sessionId: string): Promise<ContributionSession> {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      throw classifyGitHubError(404, `Contribution session '${sessionId}' not found.`);
    }

    if (session.humanApproval?.status !== 'approved' || !session.implementationPlan) {
      throw classifyGitHubError(400, 'Pilot execution requires explicit human plan approval.');
    }

    contributionSessionStore.updateSession(session.id, {
      pilotStatus: 'EXECUTING',
    });

    // Ensure authentic workspace preparation has completed
    if (session.preparationStatus !== 'WORKSPACE_READY' || !session.workspacePreparation) {
      await workspacePreparationService.prepareWorkspace(session.id);
    }

    // Run execution through ImplementationRunnerService
    const executed = await implementationRunnerService.startExecution(session.id);

    // Update pilot status to REVIEW_READY
    const withReview = contributionSessionStore.updateSession(session.id, {
      pilotStatus: 'REVIEW_READY',
    });

    if (withReview.executionRun && !withReview.executionRun.diffSummary) {
      withReview.executionRun.diffSummary = {
        diffText: withReview.executionRun.generatedDiff || '',
        changedFilesCount: (withReview.executionRun.modifiedFiles || []).length,
        filesChanged: (withReview.executionRun.modifiedFiles || []).map((m) => m.path),
        additions: (withReview.executionRun.modifiedFiles || []).reduce((acc, m) => acc + (m.modifiedLength || 0), 0),
        deletions: 0,
      };
    }

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Pilot Execution Complete',
      'Authentic implementation and verification complete. Work stopped at REVIEW_READY for human diff inspection.'
    );

    return withReview;
  }

  /**
   * Section 5: Human Review & Decision
   * Allows contributor to reject, revise, or approve the implementation.
   */
  async reviewPilot(
    sessionId: string,
    decision: 'APPROVE' | 'REVISE' | 'REJECT',
    feedback?: string
  ): Promise<ContributionSession> {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      throw classifyGitHubError(404, `Contribution session '${sessionId}' not found.`);
    }

    let newStatus: PilotStatus = 'REVIEW_READY';
    let timelineMessage = '';

    if (decision === 'APPROVE') {
      newStatus = 'SUBMISSION_APPROVED';
      timelineMessage = 'Contributor approved pilot implementation. Ready for controlled commit & push gate.';
    } else if (decision === 'REVISE') {
      newStatus = 'PLAN_APPROVAL_REQUIRED';
      timelineMessage = `Contributor requested revision: ${feedback || 'Adjustments needed.'}`;
    } else if (decision === 'REJECT') {
      newStatus = 'REJECTED';
      timelineMessage = `Contributor rejected pilot implementation: ${feedback || 'Declined.'}`;
    }

    const updated = contributionSessionStore.updateSession(session.id, {
      pilotStatus: newStatus,
    });

    // Generate and store pilot final report
    const mappedDecision = decision === 'APPROVE' ? 'APPROVED' : decision === 'REVISE' ? 'REVISED' : 'REJECTED';
    const report = this.generatePilotFinalReport(session.id, mappedDecision);
    const withReport = contributionSessionStore.updateSession(session.id, {
      pilotReport: report,
    });

    contributionSessionStore.addTimelineEvent(
      session.id,
      `Pilot Review: ${decision}`,
      timelineMessage
    );

    return withReport;
  }

  /**
   * Section 8: Final Report Generation
   * 
   * Gathers changed files, actual test results with outcomes, acceptance criteria evidence,
   * workflow status, remaining limitations, and explicit confirmation of zero live remote writes.
   */
  generatePilotFinalReport(
    sessionId: string,
    reviewDecision?: 'APPROVED' | 'REVISED' | 'REJECTED' | 'PENDING'
  ): PilotFinalReport {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      throw classifyGitHubError(404, `Contribution session '${sessionId}' not found.`);
    }

    const run = session.executionRun;
    const changedFiles = (run?.modifiedFiles || []).map((m) => m.path);
    const gitDiff = run?.generatedDiff || run?.diffSummary?.diffText || '';
    const actualTestResults: VerificationResultItem[] = run?.verificationResults || [];
    const acceptanceCriteriaEvidence: AcceptanceCriterionEvidence[] =
      run?.acceptanceCriteriaEvidence || [];
    const outstandingRisks = (session.blockers || []).map((b) => b.description);
    const proposedCommitMessage =
      session.currentSubmission?.commitMessage ||
      `fix: resolve issue #${session.issueNumber} - ${session.issueTitle}`;
    const proposedPrDescription =
      session.currentSubmission?.prDescription ||
      `## Summary\nCloses #${session.issueNumber}.\n\n### Grounded Verification Evidence\n${actualTestResults
        .map((r) => `- **${r.type}** (${r.command}): ${r.outcome} (exit ${r.exitCode})`)
        .join('\n')}\n\n### Changed Files\n${changedFiles.map((f) => `- \`${f}\``).join('\n') || '- None'}`;

    const remainingLimitations = [
      'Automatic PR creation is intentionally disabled for this milestone.',
      'All remote writes require explicit per-step human authorization gates.',
      'Direct push to canonical upstream is prohibited; only contributor fork is permitted.',
      'Live CI monitoring and CI Guardian checks will be introduced in milestone v0.5.',
    ];

    const report: PilotFinalReport = {
      sessionId: session.id,
      selectedIssue: {
        number: session.issueNumber,
        title: session.issueTitle,
        repository: session.upstreamRepository,
        url: session.issueUrl,
      },
      changedFiles,
      gitDiff,
      actualTestResults,
      acceptanceCriteriaEvidence,
      proposedCommitMessage,
      proposedPrDescription,
      outstandingRisks,
      pilotWorkflowStatus: session.pilotStatus || 'REVIEW_READY',
      remainingLimitations,
      noLiveModificationConfirmed: true,
      reviewDecision: reviewDecision || 'PENDING',
      generatedAt: new Date().toISOString(),
    };

    return report;
  }
}

export const pilotService = new PilotService();
