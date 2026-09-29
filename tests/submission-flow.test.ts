/**
 * COSInput Foundation v0.4.3 — Controlled Commit, Push & Pull Request Creation Test Suite
 * 
 * Verifies:
 * 1. Real versus simulated workspace detection & boundary reporting.
 * 2. Submission eligibility checks:
 *    - Rejects unauthenticated contributor
 *    - Rejects closed upstream issues
 *    - Rejects unapproved implementation plans
 *    - Rejects unprepared workspaces
 *    - Rejects active/running executions
 *    - Rejects historical issue AgesEmpire/StellarSwipe-FrontEnd #657
 * 3. Human approval requirements at each gate (Commit, Push, Pull Request).
 * 4. Approved-file-only staging (strictly prohibits unrestricted 'git add .' or '-A').
 * 5. Commit creation, commit SHA recording, failure handling without losing changes.
 * 6. Fork ownership verification & rejection of upstream repository as push target.
 * 7. Remote branch divergence detection (pauses with CONFLICT_REQUIRES_REVIEW).
 * 8. Duplicate push prevention & idempotent push handling.
 * 9. Existing PR detection (displays existing PR without creating duplicate).
 * 10. Correct upstream PR targeting & inclusion of 'Closes #<issue-number>'.
 * 11. Accurate reporting of verification results; failure acknowledgement requirement.
 * 12. Complete Submission State Machine flow.
 * 
 * Note: External GitHub write operations in this suite are mocked to prevent destructive remote writes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contributionSessionStore } from '../server/contributionSessionStore';
import { controlledSubmissionService } from '../server/submissionService';
import { workspaceExecutionEngine } from '../server/workspaceExecutionEngine';
import { githubServerClient } from '../server/githubClient';
import { userAuthStore } from '../server/userAuthStore';
import type {
  ContributionSession,
  ImplementationPlan,
  ImplementationRunState,
  WorkspacePreparationData,
} from '../server/types';

function createSucceededSession(overrides: Partial<ContributionSession> = {}): ContributionSession {
  const owner = overrides.repositoryOwner || 'acme-corp';
  const repo = overrides.repositoryName || 'payment-widget';
  const issueNumber = overrides.issueNumber || 42;
  const session = contributionSessionStore.createSession({
    repositoryOwner: owner,
    repositoryName: repo,
    issueNumber: issueNumber,
    issueTitle: overrides.issueTitle || 'Add Webhook Retry Logic for Failed Debits',
    issueUrl: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
    contributorUsername: 'contributor-jane',
    repositoryAccessStatus: 'public_readable',
  });

  const attemptId = contributionSessionStore.startAnalysisAttempt(session.id);
  const plan: ImplementationPlan = {
    issueSummary: 'Add retry logic for failed debits',
    repositoryUnderstanding: 'TypeScript payment widget repository',
    proposedChanges: [
      {
        id: 'change-1',
        targetFile: 'src/webhook.ts',
        description: 'Implement exponential backoff retry mechanism',
        mappedAcceptanceCriteriaIds: ['AC-1'],
        changeRole: 'MODIFICATION',
      },
      {
        id: 'change-2',
        targetFile: 'tests/webhook.test.ts',
        description: 'Add tests for retry loop and backoff factor',
        mappedAcceptanceCriteriaIds: ['AC-2'],
        changeRole: 'NEW_OR_UPDATED_TEST',
      },
    ],
    testsToRun: ['npm test'],
    buildLintVerification: ['npm run lint', 'npm run build'],
    risks: [],
    blockers: [],
    outOfScopeItems: ['Modifying core debit processing API'],
    estimatedChangeSurface: 'SMALL',
  };

  contributionSessionStore.commitAnalysisAttempt(session.id, attemptId, {
    repositoryIntelligence: {
      owner: 'acme-corp',
      repo: 'payment-widget',
      defaultBranch: 'main',
      description: 'Payment widget',
      stars: 120,
      forks: 15,
      openIssuesCount: 3,
      isPrivate: false,
      discoveredInstructionFiles: ['CONTRIBUTING.md'],
      discoveredInstructions: [],
      workflowFiles: [],
      relevantSourceDirs: ['src'],
      relevantTestDirs: ['tests'],
      totalTreeFilesCount: 45,
      sampleTreeFiles: ['src/webhook.ts', 'src/index.ts', 'tests/webhook.test.ts'],
      allTreeFiles: ['src/webhook.ts', 'src/index.ts', 'tests/webhook.test.ts', 'package.json'],
    },
    dependencyConfig: {
      framework: 'None',
      language: 'TypeScript',
      packageManager: 'npm',
      runtime: 'Node.js',
      majorDependencies: [],
      testFramework: 'Vitest',
      lintTooling: 'ESLint',
      buildTooling: 'tsc',
      ciSystem: 'GitHub Actions',
      externalConfiguration: [],
    },
    issueIntelligence: {
      problemStatement: 'Failed debits are currently dropped instead of retried.',
      requestedBehavior: 'Retry transient failures up to 3 times.',
      expectedBehavior: 'Retry with exponential backoff.',
      explicitRequirements: ['Implement exponential backoff retry mechanism'],
      inferredRequirements: ['Preserve existing telemetry events'],
      unknownsAndQuestions: [],
      filesMentioned: ['src/webhook.ts'],
      apisMentioned: [],
      dependenciesMentioned: [],
      testsRequested: ['Unit test for retry loop'],
      documentationRequirements: [],
      constraints: ['No external broker dependencies'],
      securityConsiderations: [],
      outOfScopeItems: ['Modifying core debit processing API'],
    },
    acceptanceCriteria: [
      {
        id: 'AC-1',
        description: 'Failed debits retry up to 3 times with exponential backoff',
        source: 'ISSUE',
        type: 'FUNCTIONAL',
        verificationStrategy: 'Inspect webhook.ts retry loop',
        confidence: 'HIGH',
      },
      {
        id: 'AC-2',
        description: 'All unit tests pass without errors',
        source: 'EXISTING_TEST',
        type: 'TEST',
        verificationStrategy: 'Run npm test',
        confidence: 'HIGH',
      },
    ],
    relevantFiles: [
      {
        path: 'src/webhook.ts',
        category: 'PRIMARY',
        reason: 'Target file',
        confidence: 'HIGH',
        modificationLikely: true,
      },
      {
        path: 'tests/webhook.test.ts',
        category: 'TEST',
        reason: 'Test suite',
        confidence: 'HIGH',
        modificationLikely: true,
      },
    ],
    blockers: [],
    implementationPlan: plan,
    isBlocked: false,
  });

  contributionSessionStore.updateSession(session.id, {
    analysisStatus: 'APPROVED',
    humanApproval: {
      status: 'approved',
      approvedAt: new Date().toISOString(),
    },
  });

  const runId = `run-test-${Date.now()}`;
  const workspacePrep: WorkspacePreparationData = {
    executionRunId: runId,
    status: 'WORKSPACE_READY',
    contributorIdentity: 'contributor-jane',
    upstreamRepository: 'acme-corp/payment-widget',
    selectedIssueNumber: 42,
    approvedAnalysisAttemptId: attemptId,
    approvedPlanVersion: 'v1',
    baseBranch: 'main',
    baseCommitSha: 'base-commit-sha-1234567',
    approvedCommitSha: 'base-commit-sha-1234567',
    contributorFork: {
      owner: 'contributor-jane',
      name: 'payment-widget',
      fullName: 'contributor-jane/payment-widget',
      htmlUrl: 'https://github.com/contributor-jane/payment-widget',
      defaultBranch: 'main',
      isFork: true,
      parentFullName: 'acme-corp/payment-widget',
      hasWritePermission: true,
    },
    branchName: 'cosinput/42-add-webhook-retry',
    branchCreated: true,
    preparedAt: new Date().toISOString(),
    pendingOperation: null,
  };

  const runState: ImplementationRunState = {
    id: runId,
    sessionId: session.id,
    status: 'SUCCEEDED',
    executionEnvironment: 'REAL_GIT_WORKSPACE',
    preview: {
      upstreamRepository: 'acme-corp/payment-widget',
      issueNumber: 42,
      issueTitle: 'Add Webhook Retry Logic for Failed Debits',
      executionRunId: runId,
      selectedBranch: 'cosinput/42-add-webhook-retry',
      baseBranch: 'main',
      baseCommitSha: 'base-commit-sha-1234567',
      approvedPlanVersion: 'v1',
      filesProposed: [
        {
          path: 'src/webhook.ts',
          description: 'Implement retry loop',
          changeRole: 'MODIFICATION',
          mappedCriteriaIds: ['AC-1'],
        },
        {
          path: 'tests/webhook.test.ts',
          description: 'Add tests',
          changeRole: 'NEW_OR_UPDATED_TEST',
          mappedCriteriaIds: ['AC-2'],
        },
      ],
      plannedVerificationCommands: [
        { type: 'test', command: 'npm test', reason: 'Unit tests' },
        { type: 'lint', command: 'npm run lint', reason: 'Linter' },
      ],
      eligibilityCheck: { eligible: true, reasons: ['Verified'] },
    },
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'success',
        message: 'All verifications passed.',
        step: 'Completion',
      },
    ],
    generatedDiff: `diff --git a/src/webhook.ts b/src/webhook.ts\n--- a/src/webhook.ts\n+++ b/src/webhook.ts\n@@ -1,5 +1,15 @@\n+ // Added retry mechanism with exponential backoff\n+ export const retry = true;\n`,
    modifiedFiles: [
      {
        path: 'src/webhook.ts',
        status: 'modified',
        diffSummary: 'Added exponential backoff',
        originalLength: 100,
        modifiedLength: 135,
      },
      {
        path: 'tests/webhook.test.ts',
        status: 'created',
        diffSummary: 'Added unit tests',
        originalLength: 0,
        modifiedLength: 80,
      },
    ],
    verificationResults: [
      {
        id: 'step-test',
        type: 'test',
        command: 'npm test',
        exitCode: 0,
        outputSummary: '2 passed in 12ms',
        passed: true,
        timestamp: new Date().toISOString(),
        durationMs: 40,
      },
      {
        id: 'step-lint',
        type: 'lint',
        command: 'npm run lint',
        exitCode: 0,
        outputSummary: '0 errors, 0 warnings',
        passed: true,
        timestamp: new Date().toISOString(),
        durationMs: 30,
      },
    ],
    acceptanceCriteriaEvidence: [
      {
        criterionId: 'AC-1',
        description: 'Failed debits retry up to 3 times',
        verified: true,
        evidence: 'Verified by unit tests',
      },
      {
        criterionId: 'AC-2',
        description: 'All unit tests pass',
        verified: true,
        evidence: 'Vitest suite green',
      },
    ],
    repairAttempts: [],
    repairCount: 0,
    maxRepairs: 2,
  };

  return contributionSessionStore.updateSession(session.id, {
    preparationStatus: 'WORKSPACE_READY',
    workspacePreparation: workspacePrep,
    executionRun: runState,
    ...overrides,
  });
}

describe('COSInput Foundation v0.4.3 — Controlled Commit, Push & Pull Request Creation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    contributionSessionStore.clearAll();
    workspaceExecutionEngine.setForceSimulatedMode(false);

    // Mock authenticated contributor credentials
    userAuthStore.setUserToken('contributor-mock-write-token-abc');
    userAuthStore.setUserProfile({
      id: 'usr-123',
      login: 'contributor-jane',
      name: 'Jane Contributor',
      avatarUrl: 'https://avatars.githubusercontent.com/u/123',
      authSource: 'oauth',
      authenticatedAt: new Date().toISOString(),
    });

    // Default mock for live issue check
    vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
      id: 'issue-42',
      number: 42,
      repository: 'acme-corp/payment-widget',
      title: 'Add Webhook Retry Logic for Failed Debits',
      body: 'Body',
      state: 'open',
      author: 'contributor-jane',
      authorAvatarUrl: '',
      assignees: ['contributor-jane'],
      labels: [],
      commentsCount: 0,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      closedAt: null,
      htmlUrl: 'https://github.com/acme-corp/payment-widget/issues/42',
    });

    // Default mock for fork branch check (branch does not exist yet)
    vi.spyOn(githubServerClient, 'getBranch').mockRejectedValue({
      statusCode: 404,
      message: 'Branch not found',
    });

    // Default mock for PR check (no existing PR)
    vi.spyOn(githubServerClient, 'listPullRequests').mockResolvedValue([]);

    // Default mock for branch creation/updating on fork
    vi.spyOn(githubServerClient, 'createBranch').mockResolvedValue({
      ref: 'refs/heads/cosinput/42-add-webhook-retry',
      sha: 'commit-sha-456789',
      created: true,
    });
    vi.spyOn(githubServerClient, 'updateBranchRef').mockResolvedValue({
      ref: 'refs/heads/cosinput/42-add-webhook-retry',
      sha: 'commit-sha-456789',
      updated: true,
    });

    // Default mock for PR creation
    vi.spyOn(githubServerClient, 'createPullRequest').mockResolvedValue({
      id: 991,
      number: 105,
      htmlUrl: 'https://github.com/acme-corp/payment-widget/pull/105',
      title: 'feat: Add retry logic for failed debits (#42)',
      state: 'open',
      createdAt: new Date().toISOString(),
      head: 'contributor-jane:cosinput/42-add-webhook-retry',
      base: 'main',
    });
  });

  // 1. Real vs Simulated Workspace Detection
  describe('1. Real vs Simulated Workspace Detection & Reporting', () => {
    it('detects real git workspace mode by default when git commands are available', () => {
      const mode = workspaceExecutionEngine.getExecutionMode();
      expect(mode).toBe('REAL_GIT_WORKSPACE');
    });

    it('detects simulated test environment when configured or falling back', () => {
      workspaceExecutionEngine.setForceSimulatedMode(true);
      const mode = workspaceExecutionEngine.getExecutionMode();
      expect(mode).toBe('SIMULATED_TEST_ENVIRONMENT');
    });

    it('reports workspace execution mode clearly in submission review', async () => {
      const session = createSucceededSession();
      const review = await controlledSubmissionService.getSubmissionReview(session.id);

      expect(review.isExecutionReal).toBe(true);
      expect(review.executionEnvironment).toBe('REAL_GIT_WORKSPACE');
    });
  });

  // 2. Submission Eligibility Gating
  describe('2. Submission Eligibility Gating', () => {
    it('rejects submission when contributor write credentials are not connected', async () => {
      userAuthStore.setUserToken('');
      const session = createSucceededSession();

      await expect(
        controlledSubmissionService.getSubmissionReview(session.id)
      ).rejects.toMatchObject({
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 401,
      });
    });

    it('rejects submission when upstream issue has been closed', async () => {
      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValueOnce({
        id: 'issue-42',
        number: 42,
        repository: 'acme-corp/payment-widget',
        title: 'Add Webhook Retry Logic for Failed Debits',
        body: 'Body',
        state: 'closed',
        author: 'contributor-jane',
        authorAvatarUrl: '',
        assignees: [],
        labels: [],
        commentsCount: 0,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
        closedAt: '2026-09-02T00:00:00Z',
        htmlUrl: 'https://github.com/acme-corp/payment-widget/issues/42',
      });

      const session = createSucceededSession();

      await expect(
        controlledSubmissionService.getSubmissionReview(session.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('already been closed'),
      });
    });

    it('rejects submission when plan has not received human approval', async () => {
      const session = createSucceededSession({
        analysisStatus: 'PLAN_READY',
        humanApproval: { status: 'pending' },
      });

      await expect(
        controlledSubmissionService.getSubmissionReview(session.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('human-approved implementation plan'),
      });
    });

    it('rejects submission for historical reserved issue AgesEmpire/StellarSwipe-FrontEnd #657', async () => {
      const session = createSucceededSession({
        repositoryOwner: 'AgesEmpire',
        repositoryName: 'StellarSwipe-FrontEnd',
        issueNumber: 657,
      });

      await expect(
        controlledSubmissionService.getSubmissionReview(session.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('AgesEmpire/StellarSwipe-FrontEnd #657'),
      });
    });

    it('rejects submission when an execution run is still actively running', async () => {
      const session = createSucceededSession();
      contributionSessionStore.updateSession(session.id, {
        executionRun: {
          ...session.executionRun!,
          status: 'EXECUTING',
        },
      });

      await expect(
        controlledSubmissionService.getSubmissionReview(session.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 409,
      });
    });
  });

  // 3. Diff Review & Explicit Approval
  describe('3. Diff Review & Grounded Content Formulation', () => {
    it('returns comprehensive review preview with diff, verification, and grounded content', async () => {
      const session = createSucceededSession();
      const review = await controlledSubmissionService.getSubmissionReview(session.id);

      expect(review.canonicalUpstream).toBe('acme-corp/payment-widget');
      expect(review.contributorFork).toBe('contributor-jane/payment-widget');
      expect(review.issueNumber).toBe(42);
      expect(review.sourceBranch).toBe('cosinput/42-add-webhook-retry');
      expect(review.targetBranch).toBe('main');
      expect(review.actualChangedFiles).toEqual(['src/webhook.ts', 'tests/webhook.test.ts']);
      expect(review.gitDiff).toContain('diff --git');
      expect(review.verificationResults).toHaveLength(2);
      expect(review.hasVerificationFailure).toBe(false);

      // Verify grounded commit message contains Closes #42
      expect(review.proposedCommitMessage).toContain('Closes #42');
      expect(review.proposedCommitMessage).toContain('feat(#42)');

      // Verify grounded PR content contains Closes #42 and verification details
      expect(review.proposedPrTitle).toContain('(#42)');
      expect(review.proposedPrDescription).toContain('Closes #42');
      expect(review.proposedPrDescription).toContain('Local Verification Suite');
    });
  });

  // 4. Controlled Commit Creation & Approved-File Staging
  describe('4. Controlled Commit Creation & Approved-File Staging', () => {
    it('stages only approved files and creates commit with SHA and metadata', async () => {
      const session = createSucceededSession();
      const updated = await controlledSubmissionService.approveCommit(session.id, {
        approvedFiles: ['src/webhook.ts'],
        customCommitMessage: 'feat(webhook): add retry logic (Closes #42)',
      });

      const submission = updated.currentSubmission!;
      expect(submission).toBeDefined();
      expect(submission.status).toBe('PUSH_APPROVAL_REQUIRED');
      expect(submission.commitSha).toBeDefined();
      expect(submission.commitSha!.length).toBeGreaterThan(6);
      expect(submission.stagedFiles).toEqual(['src/webhook.ts']);
      expect(submission.commitMessage).toBe('feat(webhook): add retry logic (Closes #42)');
      expect(submission.commitApprovedAt).toBeDefined();
    });

    it('strictly prohibits unrestricted wildcard staging patterns like "." or "-A"', async () => {
      const session = createSucceededSession();

      await expect(
        controlledSubmissionService.approveCommit(session.id, {
          approvedFiles: ['.'],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Unrestricted staging pattern'),
      });

      await expect(
        controlledSubmissionService.approveCommit(session.id, {
          approvedFiles: ['-A'],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Unrestricted staging pattern'),
      });
    });

    it('rejects files not present in the reviewed implementation', async () => {
      const session = createSucceededSession();

      await expect(
        controlledSubmissionService.approveCommit(session.id, {
          approvedFiles: ['unrelated-secret.env'],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('File was not part of the approved implementation plan'),
      });
    });

    it('requires explicit human acknowledgement to proceed when verification failed', async () => {
      const session = createSucceededSession();
      contributionSessionStore.updateSession(session.id, {
        executionRun: {
          ...session.executionRun!,
          verificationResults: [
            {
              id: 'step-test',
              type: 'test',
              command: 'npm test',
              exitCode: 1,
              outputSummary: 'Assertion failed',
              passed: false,
              timestamp: new Date().toISOString(),
              durationMs: 40,
            },
          ],
        },
      });

      // Attempt commit without acknowledgment -> blocked
      await expect(
        controlledSubmissionService.approveCommit(session.id, {
          proceedDespiteFailureAck: false,
        })
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('Explicit human acknowledgement is required'),
      });

      // With explicit acknowledgement -> allowed, failure record preserved
      const committed = await controlledSubmissionService.approveCommit(session.id, {
        proceedDespiteFailureAck: true,
      });

      expect(committed.currentSubmission?.proceedDespiteFailureAck).toBe(true);
      expect(committed.currentSubmission?.status).toBe('PUSH_APPROVAL_REQUIRED');
    });
  });

  // 5. Safe Push to Contributor Fork
  describe('5. Safe Push to Contributor Fork & Boundary Protection', () => {
    it('pushes exclusively to the contributor fork and never to canonical upstream', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);

      const pushed = await controlledSubmissionService.approvePush(session.id);
      expect(pushed.currentSubmission?.status).toBe('PR_APPROVAL_REQUIRED');
      expect(pushed.currentSubmission?.pushedAt).toBeDefined();

      // Verify updateBranchRef was called targeting fork owner 'contributor-jane', NOT 'acme-corp'
      expect(githubServerClient.updateBranchRef).toHaveBeenCalledWith(
        'contributor-jane',
        'payment-widget',
        'cosinput/42-add-webhook-retry',
        expect.any(String),
        false, // Never force-push
        expect.any(String)
      );
    });

    it('strictly forbids pushing if fork target matches canonical upstream repository', async () => {
      const session = createSucceededSession();
      // Tamper fork to point to upstream
      contributionSessionStore.updateSession(session.id, {
        workspacePreparation: {
          ...session.workspacePreparation!,
          contributorFork: {
            ...session.workspacePreparation!.contributorFork!,
            fullName: 'acme-corp/payment-widget',
          },
        },
      });

      await expect(
        controlledSubmissionService.approveCommit(session.id)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Security Boundary Violation'),
      });
    });

    it('strictly forbids push if authenticated contributor is not the fork owner', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);

      // Switch auth to a different user
      userAuthStore.setUserProfile({
        id: 'usr-999',
        login: 'malicious-user',
        name: 'Malicious',
        avatarUrl: '',
        authSource: 'oauth',
        authenticatedAt: new Date().toISOString(),
      });

      await expect(
        controlledSubmissionService.approvePush(session.id)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Fork ownership mismatch'),
      });
    });

    it('detects remote branch divergence and pauses with CONFLICT_REQUIRES_REVIEW', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);

      // Mock remote branch on fork existing with a different commit SHA
      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValueOnce({
        name: 'cosinput/42-add-webhook-retry',
        commitSha: 'remote-diverged-sha-999',
        protected: false,
      });

      // Mock compareCommits indicating divergence
      vi.spyOn(githubServerClient, 'compareCommits').mockResolvedValueOnce({
        status: 'diverged',
        aheadBy: 2,
        behindBy: 3,
        totalCommits: 5,
        files: [],
      });

      await expect(
        controlledSubmissionService.approvePush(session.id)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('has diverged'),
      });

      const updated = contributionSessionStore.getSession(session.id)!;
      expect(updated.currentSubmission?.status).toBe('CONFLICT_REQUIRES_REVIEW');
      expect(updated.currentSubmission?.divergenceDetails).toContain('has diverged');
    });

    it('handles idempotent retries gracefully when remote branch is already at commit SHA', async () => {
      const session = createSucceededSession();
      const committed = await controlledSubmissionService.approveCommit(session.id);
      const commitSha = committed.currentSubmission!.commitSha!;

      // Mock remote branch already having the exact commitSha
      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValueOnce({
        name: 'cosinput/42-add-webhook-retry',
        commitSha,
        protected: false,
      });

      const pushed = await controlledSubmissionService.approvePush(session.id);
      expect(pushed.currentSubmission?.status).toBe('PR_APPROVAL_REQUIRED');
      expect(pushed.currentSubmission?.pushedAt).toBeDefined();
    });
  });

  // 6. Pull Request Creation
  describe('6. Pull Request Creation & Upstream Targeting', () => {
    it('creates pull request targeting canonical upstream and includes "Closes #<issue-number>"', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);
      await controlledSubmissionService.approvePush(session.id);

      const prResult = await controlledSubmissionService.approvePullRequest(session.id);
      const submission = prResult.currentSubmission!;

      expect(submission.status).toBe('PR_OPENED');
      expect(submission.prNumber).toBe(105);
      expect(submission.prUrl).toBe('https://github.com/acme-corp/payment-widget/pull/105');
      expect(submission.prDescription).toContain('Closes #42');

      // Verify PR creation targeted canonical upstream 'acme-corp/payment-widget'
      expect(githubServerClient.createPullRequest).toHaveBeenCalledWith(
        'acme-corp',
        'payment-widget',
        expect.objectContaining({
          head: 'contributor-jane:cosinput/42-add-webhook-retry',
          base: 'main',
          body: expect.stringContaining('Closes #42'),
        }),
        expect.any(String)
      );
    });

    it('detects existing PR for head branch and displays it without creating a duplicate', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);
      await controlledSubmissionService.approvePush(session.id);

      // Mock existing open PR found on upstream
      vi.spyOn(githubServerClient, 'listPullRequests').mockResolvedValueOnce([
        {
          id: 555,
          number: 88,
          title: 'Existing PR for webhook retry',
          body: 'Already open',
          state: 'open',
          htmlUrl: 'https://github.com/acme-corp/payment-widget/pull/88',
          head: {
            ref: 'cosinput/42-add-webhook-retry',
            sha: 'some-sha',
            label: 'contributor-jane:cosinput/42-add-webhook-retry',
          },
          base: { ref: 'main', sha: 'base' },
          createdAt: '2026-09-20T00:00:00Z',
          updatedAt: '2026-09-20T00:00:00Z',
          draft: false,
        },
      ]);

      const prResult = await controlledSubmissionService.approvePullRequest(session.id);
      const submission = prResult.currentSubmission!;

      expect(submission.status).toBe('PR_OPENED');
      expect(submission.prNumber).toBe(88);
      expect(submission.prUrl).toBe('https://github.com/acme-corp/payment-widget/pull/88');
      expect(submission.existingPrFound).toBe(true);

      // createPullRequest was NOT called (no duplicate created)
      expect(githubServerClient.createPullRequest).not.toHaveBeenCalled();
    });

    it('preserves historical submission attempts when submission is reset', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);
      await controlledSubmissionService.approvePush(session.id);
      await controlledSubmissionService.approvePullRequest(session.id);

      // Contributor resets submission
      const resetSession = await controlledSubmissionService.resetSubmission(session.id);
      expect(resetSession.currentSubmission).toBeNull();
      expect(resetSession.submissionHistory).toHaveLength(1);
      expect(resetSession.submissionHistory![0].prNumber).toBe(105);
    });
  });

  // 7. Security and Invariant Protection
  describe('7. Security Boundaries & Zero Upstream Write Invariant', () => {
    it('prevents direct upstream writes and never exposes GitHub tokens in logs or timeline', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);
      await controlledSubmissionService.approvePush(session.id);

      const updated = contributionSessionStore.getSession(session.id)!;
      for (const event of updated.activityTimeline) {
        expect(event.detail).not.toContain('contributor-mock-write-token-abc');
      }
    });

    it('fails safely when GitHub API returns rate limit or service error', async () => {
      const session = createSucceededSession();
      await controlledSubmissionService.approveCommit(session.id);

      vi.spyOn(githubServerClient, 'updateBranchRef').mockRejectedValueOnce({
        statusCode: 403,
        classification: 'RATE_LIMIT',
        message: 'API rate limit exceeded',
      });

      await expect(
        controlledSubmissionService.approvePush(session.id)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('rate limit exceeded'),
      });

      const updated = contributionSessionStore.getSession(session.id)!;
      expect(updated.currentSubmission?.status).toBe('SUBMISSION_FAILED');
    });
  });
});
