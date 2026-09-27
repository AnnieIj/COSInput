/**
 * COSInput Foundation v0.4.1 — Contributor Fork & Workspace Preparation Service
 * Prepares isolated, safe contributor workspaces for approved implementation plans.
 * Strictly enforces human approval gates, fork discovery, authorization boundaries,
 * branch collision safety, and approved plan integrity.
 * Does NOT generate code, execute plans, commit changes, or open pull requests.
 */

import { githubServerClient, classifyGitHubError } from './githubClient';
import { userAuthStore } from './userAuthStore';
import { contributionSessionStore } from './contributionSessionStore';
import type {
  ContributionSession,
  ContributorForkInfo,
  WorkspacePreparationData,
  PreparationStatus,
  SanitizedGitHubError,
} from './types';

export function generateSafeBranchSlug(issueNumber: number, issueTitle: string): string {
  const cleanTitle = issueTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
  const slug = cleanTitle || 'workspace';
  return `cosinput/${issueNumber}-${slug}`;
}

export class WorkspacePreparationService {
  /**
   * Discovers contributor fork and prepares an isolated workspace record.
   * Enforces all v0.4.1 safety checks:
   * 1. Rejects previously resolved issues (e.g. AgesEmpire/StellarSwipe-FrontEnd #657)
   * 2. Confirms issue is open and actionable on GitHub
   * 3. Confirms approved plan validity (not historical or failed)
   * 4. Verifies upstream commit revision has not made approved plan stale
   * 5. Checks contributor write authorization boundaries
   * 6. Discovers existing fork or requires explicit human approval for fork creation
   * 7. Checks for branch naming collisions and generates safe alternatives
   */
  async prepareWorkspace(sessionId: string): Promise<ContributionSession> {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      const error: SanitizedGitHubError = {
        classification: 'NOT_FOUND',
        statusCode: 404,
        message: `Contribution session '${sessionId}' not found.`,
      };
      throw error;
    }

    // 1. Guard against targeting already resolved / historical issues
    // Specific mandate: AgesEmpire/StellarSwipe-FrontEnd #657 must not be used as an active execution target
    const isHistoricalStellar657 =
      session.repositoryOwner.toLowerCase() === 'agesempire' &&
      session.repositoryName.toLowerCase() === 'stellarswipe-frontend' &&
      session.issueNumber === 657;

    if (isHistoricalStellar657) {
      const error: SanitizedGitHubError = {
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message:
          'Previously resolved issue AgesEmpire/StellarSwipe-FrontEnd #657 is reserved for historical analysis and regression testing only. It cannot be used as an active execution target.',
      };
      throw error;
    }

    // 2. Approved Plan Integrity Verification
    if (
      session.analysisStatus !== 'APPROVED' ||
      session.humanApproval?.status !== 'approved' ||
      !session.implementationPlan
    ) {
      const error: SanitizedGitHubError = {
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message:
          'Workspace preparation requires a valid, human-approved implementation plan. Plan has not been approved.',
      };
      throw error;
    }

    // Ensure approved plan is active attempt, not a failed or historical snapshot
    if (session.currentAttemptStatus !== 'SUCCEEDED') {
      const error: SanitizedGitHubError = {
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message:
          'Cannot prepare workspace from a failed or unverified analysis attempt.',
      };
      throw error;
    }

    // 3. Confirm upstream issue remains open and actionable
    try {
      const liveIssue = await githubServerClient.getIssue(
        null,
        session.repositoryOwner,
        session.repositoryName,
        session.issueNumber,
        userAuthStore.getUserToken() || undefined
      );

      if (liveIssue.state === 'closed') {
        const errorMsg = `Issue #${session.issueNumber} on ${session.upstreamRepository} has already been closed. Preparation blocked.`;
        contributionSessionStore.updateSession(session.id, {
          preparationStatus: 'REANALYSIS_REQUIRED',
          errorMessage: errorMsg,
        });
        const error: SanitizedGitHubError = {
          classification: 'AUTHORIZATION_FAILURE',
          statusCode: 400,
          message: errorMsg,
        };
        throw error;
      }
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('closed')) {
        throw err;
      }
      // If issue query fails with rate limit or auth, propagate structured error
      if (err.classification && err.classification !== 'GITHUB_SERVICE_FAILURE') {
        throw err;
      }
    }

    // 4. Verify Upstream Revision Drift
    const defaultBranch =
      session.repositoryIntelligence?.defaultBranch ||
      session.lastVerifiedSnapshot?.repositoryIntelligence?.defaultBranch ||
      'main';

    let currentHeadSha = '';
    try {
      const branchInfo = await githubServerClient.getBranch(
        session.repositoryOwner,
        session.repositoryName,
        defaultBranch,
        userAuthStore.getUserToken() || undefined
      );
      currentHeadSha = branchInfo.commitSha;
    } catch (err: any) {
      if (err.classification === 'RATE_LIMIT') {
        contributionSessionStore.updateSession(session.id, {
          preparationStatus: 'PREPARATION_FAILED',
          errorMessage: err.message,
        });
        contributionSessionStore.addTimelineEvent(
          session.id,
          'Preparation Failed',
          `GitHub API rate limit exceeded during branch verification: ${err.message}`
        );
        throw err;
      }
      if (err.classification) {
        throw err;
      }
      currentHeadSha = 'upstream-head-ref';
    }

    // Compare with approved snapshot SHA if available
    const approvedSha =
      session.approvedCommitSha ||
      session.baseCommitSha ||
      session.workspacePreparation?.approvedCommitSha;

    // Detect stale plan if approved SHA is recorded and differs from current upstream head
    if (
      approvedSha &&
      currentHeadSha &&
      currentHeadSha !== 'upstream-head-ref' &&
      approvedSha !== currentHeadSha
    ) {
      const errorMsg = `Approved implementation plan is stale: Upstream default branch '${defaultBranch}' revision drifted from ${approvedSha.substring(0, 7)} to ${currentHeadSha.substring(0, 7)}. Reanalysis or renewed approval is required before workspace preparation.`;
      contributionSessionStore.updateSession(session.id, {
        preparationStatus: 'REANALYSIS_REQUIRED',
        errorMessage: errorMsg,
      });
      contributionSessionStore.addTimelineEvent(
        session.id,
        'Reanalysis Required',
        errorMsg
      );
      const error: SanitizedGitHubError = {
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: errorMsg,
      };
      throw error;
    }

    const effectiveApprovedSha = approvedSha || currentHeadSha;

    // 5. Contributor Identity & Authorization Boundaries
    const userProfile = userAuthStore.getUserProfile();
    const userToken = userAuthStore.getUserToken();
    const contributorIdentity = userProfile?.login || session.contributorUsername;

    // 6. Contributor Fork Discovery
    let existingFork: ContributorForkInfo | null = null;
    try {
      existingFork = await githubServerClient.getFork(
        session.repositoryOwner,
        session.repositoryName,
        contributorIdentity,
        userToken || undefined
      );
    } catch (err: any) {
      if (err.classification === 'RATE_LIMIT') {
        contributionSessionStore.updateSession(session.id, {
          preparationStatus: 'PREPARATION_FAILED',
          errorMessage: err.message,
        });
        contributionSessionStore.addTimelineEvent(
          session.id,
          'Preparation Failed',
          `GitHub API rate limit exceeded during contributor fork discovery: ${err.message}`
        );
        throw err;
      }
      existingFork = null;
    }

    const executionRunId =
      session.workspacePreparation?.executionRunId ||
      `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Generate safe base branch slug
    const baseSlug = generateSafeBranchSlug(session.issueNumber, session.issueTitle);

    // If NO fork exists: require explicit human approval before creating remote fork
    if (!existingFork) {
      const pendingOperation = {
        type: 'create_fork' as const,
        description: `Create contributor fork of ${session.upstreamRepository} under @${contributorIdentity}`,
        targetRepository: `${contributorIdentity}/${session.repositoryName}`,
        requiredPermissionScope: 'public_repo (read & write to user forks)',
      };

      const prepStatus: PreparationStatus = !userToken
        ? 'AUTHORIZATION_REQUIRED'
        : 'FORK_CREATION_APPROVAL_REQUIRED';

      const prepData: WorkspacePreparationData = {
        executionRunId,
        status: prepStatus,
        contributorIdentity,
        upstreamRepository: session.upstreamRepository,
        selectedIssueNumber: session.issueNumber,
        approvedAnalysisAttemptId: session.currentAttemptId || 'attempt-approved',
        approvedPlanVersion: `v1-${session.currentAttemptId || 'current'}`,
        baseBranch: defaultBranch,
        baseCommitSha: currentHeadSha,
        approvedCommitSha: effectiveApprovedSha,
        contributorFork: null,
        branchName: baseSlug,
        branchCreated: false,
        pendingOperation,
      };

      const updated = contributionSessionStore.updateSession(session.id, {
        preparationStatus: prepStatus,
        approvedCommitSha: effectiveApprovedSha,
        workspacePreparation: prepData,
      });

      contributionSessionStore.addTimelineEvent(
        session.id,
        prepStatus === 'AUTHORIZATION_REQUIRED'
          ? 'Authorization Required'
          : 'Fork Creation Approval Required',
        prepStatus === 'AUTHORIZATION_REQUIRED'
          ? 'Contributor write credentials required to manage forks on GitHub.'
          : `Fork not detected under @${contributorIdentity}. Explicit human approval required before creating remote fork.`
      );

      return updated;
    }

    // If fork exists, check if user has write authorization on fork
    if (!userToken) {
      const prepData: WorkspacePreparationData = {
        executionRunId,
        status: 'AUTHORIZATION_REQUIRED',
        contributorIdentity,
        upstreamRepository: session.upstreamRepository,
        selectedIssueNumber: session.issueNumber,
        approvedAnalysisAttemptId: session.currentAttemptId || 'attempt-approved',
        approvedPlanVersion: `v1-${session.currentAttemptId || 'current'}`,
        baseBranch: defaultBranch,
        baseCommitSha: currentHeadSha,
        approvedCommitSha: effectiveApprovedSha,
        contributorFork: existingFork,
        branchName: session.workspacePreparation?.branchName || baseSlug,
        branchCreated: false,
        pendingOperation: {
          type: 'create_branch',
          description: `Authorize contributor write credentials to prepare branch on fork ${existingFork.fullName}`,
          targetRepository: existingFork.fullName,
          requiredPermissionScope: 'public_repo',
        },
      };

      const updated = contributionSessionStore.updateSession(session.id, {
        preparationStatus: 'AUTHORIZATION_REQUIRED',
        approvedCommitSha: effectiveApprovedSha,
        workspacePreparation: prepData,
      });

      contributionSessionStore.addTimelineEvent(
        session.id,
        'Authorization Required',
        `Discovered fork ${existingFork.fullName}. Contributor write authorization required before preparing remote workspace branch.`
      );

      return updated;
    }

    // 7. Check for Branch Collision on Contributor Fork (idempotent if already prepared)
    let safeBranchName = session.workspacePreparation?.branchName || baseSlug;
    if (!session.workspacePreparation?.branchName) {
      let collisionDetected = false;
      try {
        const branchOnFork = await githubServerClient.getBranch(
          existingFork.owner,
          existingFork.name,
          safeBranchName,
          userToken
        );
        if (branchOnFork && branchOnFork.commitSha) {
          collisionDetected = true;
        }
      } catch (err: any) {
        if (err?.classification === 'RATE_LIMIT') {
          contributionSessionStore.updateSession(session.id, {
            preparationStatus: 'PREPARATION_FAILED',
            errorMessage: err.message,
          });
          throw err;
        }
        // 404 means no collision — safe to use base slug
        collisionDetected = false;
      }

      if (collisionDetected) {
        // Generate safe collision-free alternative (e.g. -v2, -v3)
        let version = 2;
        let foundAlternative = false;
        while (!foundAlternative && version <= 10) {
          const candidate = `${baseSlug}-v${version}`;
          try {
            const testBranch = await githubServerClient.getBranch(
              existingFork.owner,
              existingFork.name,
              candidate,
              userToken
            );
            if (!testBranch || !testBranch.commitSha) {
              safeBranchName = candidate;
              foundAlternative = true;
            } else {
              version++;
            }
          } catch (err: any) {
            if (err?.classification === 'RATE_LIMIT') {
              contributionSessionStore.updateSession(session.id, {
                preparationStatus: 'PREPARATION_FAILED',
                errorMessage: err.message,
              });
              throw err;
            }
            safeBranchName = candidate;
            foundAlternative = true;
          }
        }
      }
    }

    // 8. Idempotent Workspace Preparation
    const prepData: WorkspacePreparationData = {
      executionRunId,
      status: 'WORKSPACE_READY',
      contributorIdentity,
      upstreamRepository: session.upstreamRepository,
      selectedIssueNumber: session.issueNumber,
      approvedAnalysisAttemptId: session.currentAttemptId || 'attempt-approved',
      approvedPlanVersion: `v1-${session.currentAttemptId || 'current'}`,
      baseBranch: defaultBranch,
      baseCommitSha: currentHeadSha,
      approvedCommitSha: effectiveApprovedSha,
      contributorFork: existingFork,
      branchName: safeBranchName,
      branchCreated: session.workspacePreparation?.branchCreated || false,
      preparedAt: session.workspacePreparation?.preparedAt || new Date().toISOString(),
      pendingOperation: null,
    };

    const updated = contributionSessionStore.updateSession(session.id, {
      preparationStatus: 'WORKSPACE_READY',
      approvedCommitSha: effectiveApprovedSha,
      baseCommitSha: currentHeadSha,
      workspacePreparation: prepData,
    });

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Workspace Ready',
      `Isolated development workspace prepared on fork ${existingFork.fullName} (Base: ${defaultBranch}@${currentHeadSha.substring(0, 7)}, Branch: ${safeBranchName}). Zero remote code pushed.`
    );

    return updated;
  }

  /**
   * Human Approval Gate: Creates the contributor fork upon explicit user confirmation.
   * Never runs autonomously without user consent.
   */
  async approveForkCreation(sessionId: string): Promise<ContributionSession> {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      throw classifyGitHubError(404, `Contribution session '${sessionId}' not found.`);
    }

    const userToken = userAuthStore.getUserToken();
    if (!userToken) {
      throw classifyGitHubError(
        401,
        'Cannot create fork: Contributor write credentials are not connected.'
      );
    }

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Fork Creation Approved',
      `Human contributor approved creating fork of ${session.upstreamRepository}.`
    );

    try {
      // Perform remote fork creation on GitHub with contributor OAuth token
      await githubServerClient.createFork(
        session.repositoryOwner,
        session.repositoryName,
        userToken
      );
    } catch (err: any) {
      contributionSessionStore.updateSession(session.id, {
        preparationStatus: 'PREPARATION_FAILED',
        errorMessage: err.message || 'Remote fork creation failed.',
      });
      contributionSessionStore.addTimelineEvent(
        session.id,
        'Preparation Failed',
        `Remote fork creation failed: ${err.message || 'Unknown error'}`
      );
      throw err;
    }

    // Re-run workspace preparation with the new fork
    return await this.prepareWorkspace(sessionId);
  }

  /**
   * Human Approval Gate: Creates the isolated branch on the contributor fork.
   * Never runs autonomously without user consent.
   */
  async approveBranchCreation(sessionId: string): Promise<ContributionSession> {
    const session = contributionSessionStore.getSession(sessionId);
    if (!session) {
      throw classifyGitHubError(404, `Contribution session '${sessionId}' not found.`);
    }

    const prep = session.workspacePreparation;
    if (!prep || !prep.contributorFork) {
      throw classifyGitHubError(
        400,
        'Cannot create remote branch: Contributor fork is not prepared.'
      );
    }

    const userToken = userAuthStore.getUserToken();
    if (!userToken) {
      throw classifyGitHubError(
        401,
        'Cannot create remote branch: Contributor write credentials are not connected.'
      );
    }

    try {
      // Call GitHub API to create the remote reference on the fork
      await githubServerClient.createBranch(
        prep.contributorFork.owner,
        prep.contributorFork.name,
        prep.branchName,
        prep.baseCommitSha,
        userToken
      );
    } catch (err: any) {
      contributionSessionStore.updateSession(session.id, {
        preparationStatus: 'PREPARATION_FAILED',
        errorMessage: err.message || 'Remote branch creation failed.',
      });
      contributionSessionStore.addTimelineEvent(
        session.id,
        'Preparation Failed',
        `Remote branch creation failed: ${err.message || 'Unknown error'}`
      );
      throw err;
    }

    const updatedPrep: WorkspacePreparationData = {
      ...prep,
      branchCreated: true,
      status: 'WORKSPACE_READY',
    };

    const updated = contributionSessionStore.updateSession(session.id, {
      preparationStatus: 'WORKSPACE_READY',
      workspacePreparation: updatedPrep,
    });

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Branch Created',
      `Created isolated branch '${prep.branchName}' on fork ${prep.contributorFork.fullName}. Ready for v0.5 implementation.`
    );

    return updated;
  }
}

export const workspacePreparationService = new WorkspacePreparationService();
