/**
 * COSInput Foundation v0.4.2 — Controlled Issue Implementation Runner Test Suite
 *
 * Verifies:
 * 1. Execution eligibility gating:
 *    - Rejects unapproved plans
 *    - Rejects failed or unverified analysis attempts
 *    - Rejects unprepared workspaces
 *    - Rejects missing contributor write authorization
 *    - Rejects closed upstream issues
 *    - Detects upstream revision drift and demands reanalysis
 *    - Rejects historical issue AgesEmpire/StellarSwipe-FrontEnd #657
 *    - Rejects concurrent executions
 * 2. Implementation preview generation & command derivation:
 *    - Renders files proposed, run ID, branch, and base SHA
 *    - Derives commands based on packageManager (npm, pnpm, yarn, bun)
 * 3. Grounded source inspection & plan discrepancy detection:
 *    - Pauses on missing files; refuses to invent speculative files or APIs
 * 4. Human-controlled execution & stop controls:
 *    - Stop execution control halts runner; stopped run is never presented as completed
 * 5. Local verification pipeline:
 *    - Diff review, tests, typecheck, lint, and build recorded with exit codes
 *    - Acceptance criteria verified against actual evidence
 * 6. Bounded local repair cycle:
 *    - Handles verification failure, applies focused correction, reruns
 *    - Bounded to maxRepairs (preventing infinite loops)
 * 7. Reporting & zero-push invariants:
 *    - Generates final report with next required human approval
 *    - Invariant: Zero remote git push or pull request creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contributionSessionStore } from '../server/contributionSessionStore';
import { implementationRunnerService } from '../server/implementationRunnerService';
import { githubServerClient } from '../server/githubClient';
import { userAuthStore } from '../server/userAuthStore';
import type {
  ContributionSession,
  ImplementationPlan,
} from '../server/types';

function createPreparedSession(overrides: Partial<ContributionSession> = {}): ContributionSession {
  const session = contributionSessionStore.createSession({
    repositoryOwner: 'acme-corp',
    repositoryName: 'payment-widget',
    issueNumber: 42,
    issueTitle: 'Add Webhook Retry Logic for Failed Debits',
    issueUrl: 'https://github.com/acme-corp/payment-widget/issues/42',
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
        mappedAcceptanceCriteriaIds: ['ac-1'],
        changeRole: 'MODIFICATION',
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
      problemStatement: 'Debits fail silently without retry',
      requestedBehavior: 'Retry failed debits 3 times',
      expectedBehavior: 'Exponential backoff',
      explicitRequirements: ['Retry 3 times'],
      inferredRequirements: [],
      unknownsAndQuestions: [],
      filesMentioned: ['src/webhook.ts'],
      apisMentioned: [],
      dependenciesMentioned: [],
      testsRequested: ['test retry'],
      documentationRequirements: [],
      constraints: [],
      securityConsiderations: [],
      outOfScopeItems: [],
    },
    acceptanceCriteria: [
      {
        id: 'ac-1',
        description: 'Failed webhook debits are retried up to 3 times',
        source: 'ISSUE',
        type: 'FUNCTIONAL',
        verificationStrategy: 'Vitest integration test',
        confidence: 'HIGH',
      },
    ],
    relevantFiles: [
      {
        path: 'src/webhook.ts',
        category: 'PRIMARY',
        reason: 'Contains debit dispatch logic',
        confidence: 'HIGH',
        modificationLikely: true,
      },
    ],
    blockers: [],
    implementationPlan: plan,
    isBlocked: false,
  });

  // Approve the plan
  const baseCommitSha = 'initial-commit-sha-123456';
  const approvedCommitSha = 'initial-commit-sha-123456';

  const updated = contributionSessionStore.updateSession(session.id, {
    analysisStatus: 'APPROVED',
    preparationStatus: 'WORKSPACE_READY',
    approvedCommitSha,
    baseCommitSha,
    humanApproval: {
      status: 'approved',
      approvedAt: new Date().toISOString(),
    },
    workspacePreparation: {
      executionRunId: `run-${Date.now()}-test`,
      status: 'WORKSPACE_READY',
      contributorIdentity: 'contributor-jane',
      upstreamRepository: 'acme-corp/payment-widget',
      selectedIssueNumber: 42,
      approvedAnalysisAttemptId: attemptId,
      approvedPlanVersion: `v1-${attemptId}`,
      baseBranch: 'main',
      baseCommitSha,
      approvedCommitSha,
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
      branchName: 'cosinput/42-add-webhook-retry-logic',
      branchCreated: true,
      preparedAt: new Date().toISOString(),
      pendingOperation: null,
    },
    ...overrides,
  });

  return updated;
}

describe('COSInput Foundation v0.4.2 — Controlled Issue Implementation Runner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    contributionSessionStore.clearAll();
    userAuthStore.clearSession();
    // Default valid contributor token
    userAuthStore.setUserSession(undefined, 'gho_valid_contributor_token_12345', {
      login: 'contributor-jane',
      id: '9999',
      name: 'Jane Contributor',
      avatarUrl: 'https://avatars.githubusercontent.com/u/9999',
      authSource: 'oauth',
      authenticatedAt: new Date().toISOString(),
    });

    // Default GitHub API mocks
    vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
      number: 42,
      title: 'Add Webhook Retry Logic for Failed Debits',
      body: 'Please retry debits 3 times before failing.',
      state: 'open',
      author: 'acme-lead',
      authorAvatarUrl: '',
      repository: 'acme-corp/payment-widget',
      labels: [],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      assignees: ['contributor-jane'],
      commentsCount: 0,
      htmlUrl: 'https://github.com/acme-corp/payment-widget/issues/42',
      id: 'issue-42',
    } as any);

    vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
      name: 'main',
      commitSha: 'initial-commit-sha-123456',
      protected: false,
    });

    // Reset command executor to default passing
    implementationRunnerService.setCommandExecutor(undefined);
  });

  describe('1. Execution Eligibility Gating', () => {
    it('rejects execution when implementation plan is not approved', async () => {
      const session = createPreparedSession({
        analysisStatus: 'PLAN_READY',
        humanApproval: { status: 'pending' },
      });

      await expect(implementationRunnerService.verifyEligibility(session)).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('Plan has not been approved'),
      });
    });

    it('rejects execution when analysis attempt failed', async () => {
      const session = createPreparedSession({
        currentAttemptStatus: 'FAILED',
      });

      await expect(implementationRunnerService.verifyEligibility(session)).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('failed or unverified analysis attempt'),
      });
    });

    it('rejects execution when workspace is not prepared', async () => {
      const session = createPreparedSession({
        preparationStatus: 'FORK_CREATION_APPROVAL_REQUIRED',
        workspacePreparation: null,
      });

      await expect(implementationRunnerService.verifyEligibility(session)).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('Workspace is not prepared'),
      });
    });

    it('rejects execution when contributor write authorization is missing', async () => {
      userAuthStore.clearSession();
      const session = createPreparedSession();

      await expect(implementationRunnerService.verifyEligibility(session)).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 401,
        message: expect.stringContaining('Contributor authorization credentials are required'),
      });
    });

    it('rejects execution when the target issue has already been closed on GitHub', async () => {
      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        number: 42,
        title: 'Add Webhook Retry Logic for Failed Debits',
        body: 'Debits',
        state: 'closed',
        author: 'acme-lead',
        authorAvatarUrl: '',
        repository: 'acme-corp/payment-widget',
        labels: [],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
        assignees: ['contributor-jane'],
        commentsCount: 2,
        htmlUrl: 'https://github.com/acme-corp/payment-widget/issues/42',
        id: 'issue-42',
      } as any);

      const session = createPreparedSession();

      await expect(implementationRunnerService.verifyEligibility(session)).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('has already been closed'),
      });

      const updated = contributionSessionStore.getSession(session.id);
      expect(updated?.preparationStatus).toBe('REANALYSIS_REQUIRED');
    });

    it('detects upstream revision drift and requires reanalysis before execution', async () => {
      // Simulate upstream main moving from initial-commit-sha-123456 to new-head-sha-789012
      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
        name: 'main',
        commitSha: 'new-head-sha-789012',
        protected: false,
      });

      const session = createPreparedSession();

      await expect(implementationRunnerService.verifyEligibility(session)).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('Approved implementation plan is stale'),
      });

      const updated = contributionSessionStore.getSession(session.id);
      expect(updated?.preparationStatus).toBe('REANALYSIS_REQUIRED');
    });

    it('strictly forbids targeting previously resolved AgesEmpire/StellarSwipe-FrontEnd #657', async () => {
      const stellarSession = contributionSessionStore.createSession({
        repositoryOwner: 'AgesEmpire',
        repositoryName: 'StellarSwipe-FrontEnd',
        issueNumber: 657,
        issueTitle: 'Integrate Live Repository Tree and Acceptance Parsing',
        issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/657',
        contributorUsername: 'contributor-jane',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(stellarSession.id, {
        analysisStatus: 'APPROVED',
        preparationStatus: 'WORKSPACE_READY',
        currentAttemptStatus: 'SUCCEEDED',
        humanApproval: { status: 'approved' },
        implementationPlan: {
          issueSummary: 'Historical issue',
          repositoryUnderstanding: 'Frontend',
          proposedChanges: [],
          testsToRun: [],
          buildLintVerification: [],
          risks: [],
          blockers: [],
          outOfScopeItems: [],
          estimatedChangeSurface: 'SMALL',
        },
      });

      const retrieved = contributionSessionStore.getSession(stellarSession.id)!;

      await expect(
        implementationRunnerService.verifyEligibility(retrieved)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringContaining('AgesEmpire/StellarSwipe-FrontEnd #657 is reserved for historical analysis and regression testing only'),
      });
    });

    it('rejects starting a new execution when an execution is already actively running', async () => {
      const session = createPreparedSession();
      contributionSessionStore.updateSession(session.id, {
        executionRun: {
          id: 'existing-run',
          sessionId: session.id,
          status: 'EXECUTING',
          preview: {} as any,
          logs: [],
          modifiedFiles: [],
          verificationResults: [],
          acceptanceCriteriaEvidence: [],
          repairAttempts: [],
          repairCount: 0,
          maxRepairs: 2,
        },
      });

      const retrieved = contributionSessionStore.getSession(session.id)!;
      await expect(
        implementationRunnerService.verifyEligibility(retrieved)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 409,
        message: expect.stringContaining('execution is already in progress'),
      });
    });
  });

  describe('2. Implementation Preview & Command Derivation (Section 4)', () => {
    it('generates an implementation preview with proposed files, branches, and planned commands', async () => {
      const session = createPreparedSession();
      const preview = await implementationRunnerService.getExecutionPreview(session.id);

      expect(preview.upstreamRepository).toBe('acme-corp/payment-widget');
      expect(preview.issueNumber).toBe(42);
      expect(preview.selectedBranch).toBe('cosinput/42-add-webhook-retry-logic');
      expect(preview.baseBranch).toBe('main');
      expect(preview.baseCommitSha).toBe('initial-commit-sha-123456');
      expect(preview.filesProposed).toHaveLength(1);
      expect(preview.filesProposed[0].path).toBe('src/webhook.ts');
      expect(preview.filesProposed[0].changeRole).toBe('MODIFICATION');
      expect(preview.plannedVerificationCommands.length).toBeGreaterThanOrEqual(4);
      expect(preview.eligibilityCheck.eligible).toBe(true);
    });

    it('correctly derives verification commands for pnpm repositories', () => {
      const session = createPreparedSession();
      session.dependenciesAndConfig = {
        ...session.dependenciesAndConfig!,
        packageManager: 'pnpm',
      };
      session.implementationPlan = {
        ...session.implementationPlan!,
        testsToRun: [],
        buildLintVerification: [],
      };

      const commands = implementationRunnerService.deriveVerificationCommands(session);
      const testCmd = commands.find((c) => c.type === 'test');
      const lintCmd = commands.find((c) => c.type === 'lint');
      const typecheckCmd = commands.find((c) => c.type === 'typecheck');
      const buildCmd = commands.find((c) => c.type === 'build');

      expect(testCmd?.command).toBe('pnpm test');
      expect(lintCmd?.command).toBe('pnpm run lint');
      expect(typecheckCmd?.command).toBe('pnpm exec tsc --noEmit');
      expect(buildCmd?.command).toBe('pnpm run build');
    });

    it('correctly derives verification commands for yarn repositories', () => {
      const session = createPreparedSession();
      session.dependenciesAndConfig = {
        ...session.dependenciesAndConfig!,
        packageManager: 'yarn',
      };
      session.implementationPlan = {
        ...session.implementationPlan!,
        testsToRun: [],
        buildLintVerification: [],
      };

      const commands = implementationRunnerService.deriveVerificationCommands(session);
      const testCmd = commands.find((c) => c.type === 'test');
      const lintCmd = commands.find((c) => c.type === 'lint');
      const typecheckCmd = commands.find((c) => c.type === 'typecheck');

      expect(testCmd?.command).toBe('yarn test');
      expect(lintCmd?.command).toBe('yarn lint');
      expect(typecheckCmd?.command).toBe('yarn tsc --noEmit');
    });
  });

  describe('3. Grounded Implementation & Plan Discrepancies (Section 3)', () => {
    it('pauses execution and reports discrepancy when approved plan targets a non-existent file', async () => {
      const session = createPreparedSession();
      // Inject non-existent file target into proposed changes
      session.implementationPlan = {
        ...session.implementationPlan!,
        proposedChanges: [
          {
            id: 'change-missing',
            targetFile: 'src/invented-magic-file.ts',
            description: 'Modify invented file',
            mappedAcceptanceCriteriaIds: ['ac-1'],
            changeRole: 'MODIFICATION',
          },
        ],
      };
      contributionSessionStore.updateSession(session.id, {
        implementationPlan: session.implementationPlan,
      });

      const updated = await implementationRunnerService.startExecution(session.id);
      expect(updated.executionRun?.status).toBe('FAILED');
      expect(updated.executionRun?.planDiscrepancy).toBeDefined();
      expect(updated.executionRun?.planDiscrepancy?.type).toBe('MISSING_FILE');
      expect(updated.executionRun?.planDiscrepancy?.file).toBe('src/invented-magic-file.ts');
      expect(updated.executionRun?.errorMessage).toContain('does not exist in repository tree');

      // Timeline event recorded
      const events = updated.activityTimeline.map((e) => e.stage);
      expect(events).toContain('Execution Paused: Plan Discrepancy');
    });
  });

  describe('4. Human-Controlled Execution & Stop Controls (Section 4)', () => {
    it('allows human contributor to stop a running execution and never marks it completed', async () => {
      const session = createPreparedSession();

      // Start execution with a command executor that leaves execution active
      contributionSessionStore.updateSession(session.id, {
        executionRun: {
          id: 'test-run-stop',
          sessionId: session.id,
          status: 'EXECUTING',
          preview: {} as any,
          logs: [],
          modifiedFiles: [],
          verificationResults: [],
          acceptanceCriteriaEvidence: [],
          repairAttempts: [],
          repairCount: 0,
          maxRepairs: 2,
        },
      });

      const stopped = await implementationRunnerService.stopExecution(session.id);
      expect(stopped.executionRun?.status).toBe('STOPPED');
      expect(stopped.executionRun?.stopRequested).toBe(true);
      expect(stopped.executionRun?.status).not.toBe('SUCCEEDED');

      // Timeline event
      const lastEvent = stopped.activityTimeline[stopped.activityTimeline.length - 1];
      expect(lastEvent.stage).toBe('Execution Stopped');
    });
  });

  describe('5. Local Verification Pipeline (Section 5)', () => {
    it('executes verification suite and verifies acceptance criteria against evidence', async () => {
      const session = createPreparedSession();

      const executed = await implementationRunnerService.startExecution(session.id);
      expect(executed.executionRun?.status).toBe('SUCCEEDED');
      expect(executed.executionRun?.verificationResults.length).toBeGreaterThanOrEqual(4);

      // Diff review
      const diffReview = executed.executionRun?.verificationResults.find(
        (v) => v.type === 'diff_review'
      );
      expect(diffReview?.passed).toBe(true);

      // Tests performed
      const testResult = executed.executionRun?.verificationResults.find(
        (v) => v.type === 'test'
      );
      expect(testResult?.passed).toBe(true);
      expect(testResult?.exitCode).toBe(0);

      // Acceptance Criteria Evidence
      expect(executed.executionRun?.acceptanceCriteriaEvidence).toHaveLength(1);
      const acEvidence = executed.executionRun?.acceptanceCriteriaEvidence[0];
      expect(acEvidence?.criterionId).toBe('ac-1');
      expect(acEvidence?.verified).toBe(true);
      expect(acEvidence?.evidence).toContain('Verified by local test suite');
    });
  });

  describe('6. Bounded Local Repair Cycle (Section 6)', () => {
    it('applies focused repair when a verification step fails and reruns successfully', async () => {
      const session = createPreparedSession();

      // Configure mock executor to fail once on test command, then pass on rerun
      let callCount = 0;
      implementationRunnerService.setCommandExecutor(async (cmd, type) => {
        if (type === 'test') {
          callCount++;
          if (callCount === 1) {
            return {
              exitCode: 1,
              output: 'AssertionError: expected debit retry count to be 3, received 1',
            };
          }
          return {
            exitCode: 0,
            output: 'Vitest: 1 test passed (retry debit logic verified)',
          };
        }
        return { exitCode: 0, output: `${cmd} succeeded` };
      });

      const executed = await implementationRunnerService.startExecution(session.id);
      expect(executed.executionRun?.status).toBe('SUCCEEDED');
      expect(executed.executionRun?.repairCount).toBe(1);
      expect(executed.executionRun?.repairAttempts).toHaveLength(1);

      const attempt = executed.executionRun?.repairAttempts[0];
      expect(attempt?.attemptNumber).toBe(1);
      expect(attempt?.failedVerificationType).toBe('test');
      expect(attempt?.rerunPassed).toBe(true);
      expect(attempt?.identifiedError).toContain('AssertionError');
    });

    it('halts with REPAIR_EXHAUSTED and does not loop infinitely when repairs fail', async () => {
      const session = createPreparedSession();

      // Always fail test command
      implementationRunnerService.setCommandExecutor(async (_cmd, type) => {
        if (type === 'test') {
          return { exitCode: 1, output: 'SyntaxError: unexpected token in webhook.ts' };
        }
        return { exitCode: 0, output: 'passed' };
      });

      const executed = await implementationRunnerService.startExecution(session.id);
      expect(executed.executionRun?.status).toBe('FAILED');
      expect(executed.executionRun?.repairCount).toBe(2);
      expect(executed.executionRun?.finalReport?.actualResults).toBe('REPAIR_EXHAUSTED');
      expect(executed.executionRun?.finalReport?.unresolvedLimitations.length).toBeGreaterThan(0);
    });
  });

  describe('7. Final Reporting & Invariant Enforcement (Section 7)', () => {
    it('generates a final report with changed files, test evidence, and required human approval', async () => {
      const session = createPreparedSession();
      const executed = await implementationRunnerService.startExecution(session.id);

      const report = executed.executionRun?.finalReport;
      expect(report).toBeDefined();
      expect(report?.executionRunId).toBe(executed.executionRun?.id);
      expect(report?.upstreamRepository).toBe('acme-corp/payment-widget');
      expect(report?.branchName).toBe('cosinput/42-add-webhook-retry-logic');
      expect(report?.changedFiles).toContain('src/webhook.ts');
      expect(report?.actualResults).toBe('SUCCESS');
      expect(report?.nextRequiredHumanApproval).toContain('Explicit human approval required before staging remote commits, pushing branches, or opening pull requests');

      // Timeline events must enforce zero-code-pushed invariant
      const timelineMsgs = executed.activityTimeline.map((t) => t.detail).join(' ');
      expect(timelineMsgs).toContain('Zero code pushed');
    });

    it('supports resetting execution state cleanly', async () => {
      const session = createPreparedSession();
      await implementationRunnerService.startExecution(session.id);

      const resetSession = await implementationRunnerService.resetExecution(session.id);
      expect(resetSession.executionRun).toBeNull();
      const timelineStages = resetSession.activityTimeline.map((t) => t.stage);
      expect(timelineStages).toContain('Execution Reset');
    });
  });
});
