/**
 * COSInput Foundation v0.4.1 — Contributor Fork & Workspace Preparation Test Suite
 *
 * Verifies:
 * 1. Discovery of existing valid contributor fork.
 * 2. Discovery when no fork exists (requiring explicit human approval).
 * 3. Stale plan detection when upstream base commit SHA changes.
 * 4. Branch name collision detection and non-destructive resolution.
 * 5. Remote write operations require explicit human approval.
 * 6. Missing write credentials trigger AUTHORIZATION_REQUIRED without erroring out.
 * 7. Preparation idempotency and safe retry.
 * 8. Rate limiting and sanitized error reporting during preparation.
 * 9. Historical issue protection (AgesEmpire/StellarSwipe-FrontEnd #657).
 * 10. Approved plan integrity and failure gating.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contributionSessionStore } from '../server/contributionSessionStore';
import {
  workspacePreparationService,
  generateSafeBranchSlug,
} from '../server/workspacePreparationService';
import { githubServerClient, classifyGitHubError } from '../server/githubClient';
import { userAuthStore } from '../server/userAuthStore';
import type {
  ContributionSession,
  ContributorForkInfo,
  ImplementationPlan,
} from '../server/types';

function createApprovedSession(overrides: Partial<ContributionSession> = {}): ContributionSession {
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
    buildLintVerification: ['npm run lint'],
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
      discoveredInstructionFiles: [],
      discoveredInstructions: [],
      workflowFiles: [],
      relevantSourceDirs: ['src'],
      relevantTestDirs: ['tests'],
      totalTreeFilesCount: 45,
      sampleTreeFiles: ['src/webhook.ts'],
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
  contributionSessionStore.updateSession(session.id, {
    analysisStatus: 'APPROVED',
    preparationStatus: 'PLAN_APPROVED',
    approvedCommitSha: 'initial-commit-sha-123456',
    baseCommitSha: 'initial-commit-sha-123456',
    humanApproval: {
      status: 'approved',
      approvedAt: new Date().toISOString(),
    },
    ...overrides,
  });

  return contributionSessionStore.getSession(session.id)!;
}

describe('COSInput Foundation v0.4.1 — Contributor Fork & Workspace Preparation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    contributionSessionStore.clearAll();
    userAuthStore.clearSession();
    userAuthStore.setUserSession(undefined, 'valid-user-oauth-token-xyz', {
      id: 'usr-jane',
      login: 'contributor-jane',
      name: 'Jane Doe',
      avatarUrl: 'https://github.com/contributor-jane.png',
      authSource: 'oauth',
      authenticatedAt: new Date().toISOString(),
    });
  });

  describe('1. Branch Slug Generation', () => {
    it('generates consistent, safe branch slugs with issue number and sanitized title', () => {
      const slug = generateSafeBranchSlug(42, 'Add Webhook Retry Logic for Failed Debits!');
      expect(slug).toBe('cosinput/42-add-webhook-retry-logic-for-fa');
      expect(slug.startsWith('cosinput/42-')).toBe(true);
      expect(slug).not.toContain('!');
      expect(slug).not.toContain(' ');
    });

    it('falls back to "workspace" if title consists solely of special characters', () => {
      const slug = generateSafeBranchSlug(99, '$$$###@@@');
      expect(slug).toBe('cosinput/99-workspace');
    });
  });

  describe('2. Contributor Fork Discovery', () => {
    it('discovers and verifies an existing valid contributor fork', async () => {
      const session = createApprovedSession();

      const mockFork: ContributorForkInfo = {
        owner: 'contributor-jane',
        name: 'payment-widget',
        fullName: 'contributor-jane/payment-widget',
        htmlUrl: 'https://github.com/contributor-jane/payment-widget',
        defaultBranch: 'main',
        isFork: true,
        parentFullName: 'acme-corp/payment-widget',
        hasWritePermission: true,
      };

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        number: 42,
        title: 'Add Webhook Retry Logic',
        body: 'Description',
        state: 'open',
        html_url: 'https://github.com/acme-corp/payment-widget/issues/42',
      } as any);

      vi.spyOn(githubServerClient, 'getBranch').mockImplementation(async (_owner, _repo, branch) => {
        if (branch === 'main') {
          return { name: 'main', commitSha: 'initial-commit-sha-123456', protected: false };
        }
        // Branch collision check probe returns 404 (safe to create)
        throw classifyGitHubError(404, 'Branch not found');
      });

      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue(mockFork);

      const prepared = await workspacePreparationService.prepareWorkspace(session.id);

      expect(prepared.preparationStatus).toBe('WORKSPACE_READY');
      expect(prepared.workspacePreparation).toBeDefined();
      expect(prepared.workspacePreparation?.contributorFork?.fullName).toBe('contributor-jane/payment-widget');
      expect(prepared.workspacePreparation?.baseBranch).toBe('main');
      expect(prepared.workspacePreparation?.baseCommitSha).toBe('initial-commit-sha-123456');
      expect(prepared.workspacePreparation?.branchName).toBe('cosinput/42-add-webhook-retry-logic-for-fa');
      expect(prepared.workspacePreparation?.branchCreated).toBe(false);
      expect(prepared.workspacePreparation?.pendingOperation).toBeNull();
    });

    it('requires human approval when no fork exists', async () => {
      const session = createApprovedSession();

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        number: 42,
        state: 'open',
      } as any);

      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
        name: 'main',
        commitSha: 'initial-commit-sha-123456',
        protected: false,
      });

      // No fork found
      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue(null);

      const prepared = await workspacePreparationService.prepareWorkspace(session.id);

      expect(prepared.preparationStatus).toBe('FORK_CREATION_APPROVAL_REQUIRED');
      expect(prepared.workspacePreparation?.contributorFork).toBeNull();
      expect(prepared.workspacePreparation?.pendingOperation).toEqual({
        type: 'create_fork',
        description: 'Create contributor fork of acme-corp/payment-widget under @contributor-jane',
        targetRepository: 'contributor-jane/payment-widget',
        requiredPermissionScope: 'public_repo (read & write to user forks)',
      });
    });
  });

  describe('3. Human Approval Gates & Remote Write Boundaries', () => {
    it('creates remote fork only upon explicit user approval', async () => {
      const session = createApprovedSession();

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        number: 42,
        state: 'open',
      } as any);

      vi.spyOn(githubServerClient, 'getBranch').mockImplementation(async (_owner, _repo, branch) => {
        if (branch === 'main') {
          return { name: 'main', commitSha: 'initial-commit-sha-123456', protected: false };
        }
        throw classifyGitHubError(404, 'Branch not found');
      });

      const mockCreatedFork: ContributorForkInfo = {
        owner: 'contributor-jane',
        name: 'payment-widget',
        fullName: 'contributor-jane/payment-widget',
        htmlUrl: 'https://github.com/contributor-jane/payment-widget',
        defaultBranch: 'main',
        isFork: true,
        parentFullName: 'acme-corp/payment-widget',
        hasWritePermission: true,
      };

      const createForkSpy = vi.spyOn(githubServerClient, 'createFork').mockResolvedValue(mockCreatedFork);
      // Initially no fork, then newly created fork
      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue(mockCreatedFork);

      const approvedSession = await workspacePreparationService.approveForkCreation(session.id);

      expect(createForkSpy).toHaveBeenCalledTimes(1);
      expect(createForkSpy).toHaveBeenCalledWith('acme-corp', 'payment-widget', 'valid-user-oauth-token-xyz');
      expect(approvedSession.preparationStatus).toBe('WORKSPACE_READY');
      expect(approvedSession.workspacePreparation?.contributorFork?.fullName).toBe('contributor-jane/payment-widget');
    });

    it('creates remote branch on contributor fork only upon explicit user approval', async () => {
      const session = createApprovedSession();

      const mockFork: ContributorForkInfo = {
        owner: 'contributor-jane',
        name: 'payment-widget',
        fullName: 'contributor-jane/payment-widget',
        htmlUrl: 'https://github.com/contributor-jane/payment-widget',
        defaultBranch: 'main',
        isFork: true,
        parentFullName: 'acme-corp/payment-widget',
        hasWritePermission: true,
      };

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({ number: 42, state: 'open' } as any);
      vi.spyOn(githubServerClient, 'getBranch').mockImplementation(async (_owner, _repo, branch) => {
        if (branch === 'main') {
          return { name: 'main', commitSha: 'initial-commit-sha-123456', protected: false };
        }
        throw classifyGitHubError(404, 'Not found');
      });
      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue(mockFork);

      // 1. Prepare workspace (read-only, does not create branch yet)
      const prepared = await workspacePreparationService.prepareWorkspace(session.id);
      expect(prepared.workspacePreparation?.branchCreated).toBe(false);

      // 2. User confirms and approves branch creation
      const createBranchSpy = vi.spyOn(githubServerClient, 'createBranch').mockResolvedValue({
        ref: 'refs/heads/cosinput/42-add-webhook-retry-logic-for-fa',
        sha: 'initial-commit-sha-123456',
        created: true,
      });

      const withBranch = await workspacePreparationService.approveBranchCreation(session.id);

      expect(createBranchSpy).toHaveBeenCalledTimes(1);
      expect(createBranchSpy).toHaveBeenCalledWith(
        'contributor-jane',
        'payment-widget',
        'cosinput/42-add-webhook-retry-logic-for-fa',
        'initial-commit-sha-123456',
        'valid-user-oauth-token-xyz'
      );
      expect(withBranch.workspacePreparation?.branchCreated).toBe(true);
    });
  });

  describe('4. Authorization Boundaries & Missing Credentials', () => {
    it('triggers AUTHORIZATION_REQUIRED without throwing an error when write credentials are missing', async () => {
      const session = createApprovedSession();
      // Remove contributor write credentials
      userAuthStore.clearSession();

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({ number: 42, state: 'open' } as any);
      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
        name: 'main',
        commitSha: 'initial-commit-sha-123456',
        protected: false,
      });
      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue(null);

      // Must NOT throw an unhandled error; must return updated session in AUTHORIZATION_REQUIRED state
      const result = await workspacePreparationService.prepareWorkspace(session.id);

      expect(result.preparationStatus).toBe('AUTHORIZATION_REQUIRED');
      expect(result.workspacePreparation?.status).toBe('AUTHORIZATION_REQUIRED');
      expect(result.workspacePreparation?.pendingOperation?.requiredPermissionScope).toContain('public_repo');
    });

    it('rejects remote branch creation if write credentials are missing', async () => {
      const session = createApprovedSession();
      userAuthStore.clearSession();

      await expect(
        workspacePreparationService.approveBranchCreation(session.id)
      ).rejects.toMatchObject({
        statusCode: 400, // Fork not prepared
      });
    });
  });

  describe('5. Approved Plan Integrity & Stale Revision Drift', () => {
    it('detects stale plan when upstream base commit SHA changes and requires reanalysis', async () => {
      // Plan was approved against 'initial-commit-sha-123456'
      const session = createApprovedSession({
        approvedCommitSha: 'initial-commit-sha-123456',
        baseCommitSha: 'initial-commit-sha-123456',
      });

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({ number: 42, state: 'open' } as any);

      // Upstream branch has now moved to 'new-head-sha-789012'
      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
        name: 'main',
        commitSha: 'new-head-sha-789012',
        protected: false,
      });

      await expect(
        workspacePreparationService.prepareWorkspace(session.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringMatching(/stale/i),
      });

      const updated = contributionSessionStore.getSession(session.id)!;
      expect(updated.preparationStatus).toBe('REANALYSIS_REQUIRED');
      expect(updated.errorMessage).toContain('stale');
    });

    it('blocks workspace preparation when upstream issue has been closed', async () => {
      const session = createApprovedSession();

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        number: 42,
        state: 'closed', // Closed upstream!
      } as any);

      await expect(
        workspacePreparationService.prepareWorkspace(session.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringMatching(/closed/i),
      });

      const updated = contributionSessionStore.getSession(session.id)!;
      expect(updated.preparationStatus).toBe('REANALYSIS_REQUIRED');
    });

    it('strictly forbids targeting previously resolved issue AgesEmpire/StellarSwipe-FrontEnd #657', async () => {
      const stellarSession = contributionSessionStore.createSession({
        repositoryOwner: 'AgesEmpire',
        repositoryName: 'StellarSwipe-FrontEnd',
        issueNumber: 657,
        issueTitle: 'Historical issue',
        issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/657',
        contributorUsername: 'contributor-jane',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(stellarSession.id, {
        analysisStatus: 'APPROVED',
        humanApproval: { status: 'approved', approvedAt: new Date().toISOString() },
        currentAttemptStatus: 'SUCCEEDED',
        implementationPlan: { issueSummary: 'demo' } as any,
      });

      await expect(
        workspacePreparationService.prepareWorkspace(stellarSession.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringMatching(/historical analysis and regression testing only/i),
      });
    });

    it('strictly forbids workspace preparation from unapproved or failed analysis attempts', async () => {
      const unapprovedSession = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'payment-widget',
        issueNumber: 42,
        issueTitle: 'Unapproved issue',
        issueUrl: 'https://github.com/acme-corp/payment-widget/issues/42',
        contributorUsername: 'contributor-jane',
        repositoryAccessStatus: 'public_readable',
      });

      // Still in PLAN_READY, not approved by human
      contributionSessionStore.updateSession(unapprovedSession.id, {
        analysisStatus: 'PLAN_READY',
        currentAttemptStatus: 'SUCCEEDED',
      });

      await expect(
        workspacePreparationService.prepareWorkspace(unapprovedSession.id)
      ).rejects.toMatchObject({
        classification: 'AUTHORIZATION_FAILURE',
        statusCode: 400,
        message: expect.stringMatching(/human-approved/i),
      });
    });
  });

  describe('6. Branch Collision Detection & Resolution', () => {
    it('detects existing branch on contributor fork and safely creates alternative suffix without overwriting', async () => {
      const session = createApprovedSession();

      const mockFork: ContributorForkInfo = {
        owner: 'contributor-jane',
        name: 'payment-widget',
        fullName: 'contributor-jane/payment-widget',
        htmlUrl: 'https://github.com/contributor-jane/payment-widget',
        defaultBranch: 'main',
        isFork: true,
        parentFullName: 'acme-corp/payment-widget',
        hasWritePermission: true,
      };

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({ number: 42, state: 'open' } as any);
      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue(mockFork);

      // Base branch exists; base candidate 'cosinput/42-...' exists; but '-v2' does not exist!
      vi.spyOn(githubServerClient, 'getBranch').mockImplementation(async (_owner, _repo, branch) => {
        if (branch === 'main') {
          return { name: 'main', commitSha: 'initial-commit-sha-123456', protected: false };
        }
        if (branch === 'cosinput/42-add-webhook-retry-logic-for-fa') {
          // Collision! Branch already exists on fork
          return { name: branch, commitSha: 'existing-branch-sha', protected: false };
        }
        if (branch === 'cosinput/42-add-webhook-retry-logic-for-fa-v2') {
          // Alternative is free!
          throw classifyGitHubError(404, 'Branch not found');
        }
        throw classifyGitHubError(404, 'Branch not found');
      });

      const prepared = await workspacePreparationService.prepareWorkspace(session.id);

      expect(prepared.workspacePreparation?.branchName).toBe(
        'cosinput/42-add-webhook-retry-logic-for-fa-v2'
      );
      expect(prepared.preparationStatus).toBe('WORKSPACE_READY');
    });
  });

  describe('7. Workspace Preparation Idempotency', () => {
    it('is safe to run multiple times without duplicating or corrupting state', async () => {
      const session = createApprovedSession();

      const mockFork: ContributorForkInfo = {
        owner: 'contributor-jane',
        name: 'payment-widget',
        fullName: 'contributor-jane/payment-widget',
        htmlUrl: 'https://github.com/contributor-jane/payment-widget',
        defaultBranch: 'main',
        isFork: true,
        parentFullName: 'acme-corp/payment-widget',
        hasWritePermission: true,
      };

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({ number: 42, state: 'open' } as any);
      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue(mockFork);
      vi.spyOn(githubServerClient, 'getBranch').mockImplementation(async (_owner, _repo, branch) => {
        if (branch === 'main') {
          return { name: 'main', commitSha: 'initial-commit-sha-123456', protected: false };
        }
        throw classifyGitHubError(404, 'Not found');
      });

      // Run 1
      const run1 = await workspacePreparationService.prepareWorkspace(session.id);
      const runId = run1.workspacePreparation?.executionRunId;
      const branchName = run1.workspacePreparation?.branchName;

      expect(runId).toBeDefined();
      expect(branchName).toBeDefined();

      // Run 2 (Retry)
      const run2 = await workspacePreparationService.prepareWorkspace(session.id);

      expect(run2.workspacePreparation?.executionRunId).toBe(runId);
      expect(run2.workspacePreparation?.branchName).toBe(branchName);
      expect(run2.preparationStatus).toBe('WORKSPACE_READY');
    });
  });

  describe('8. Rate Limiting and Sanitized Error Reporting', () => {
    it('captures GitHub rate limits during fork discovery and reports sanitized error without crashing', async () => {
      const session = createApprovedSession();

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({ number: 42, state: 'open' } as any);
      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
        name: 'main',
        commitSha: 'initial-commit-sha-123456',
        protected: false,
      });

      // GitHub returns 403 Rate Limit on fork check
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '0');
      const rateLimitError = classifyGitHubError(403, 'API rate limit exceeded', headers, 'repository_metadata');
      vi.spyOn(githubServerClient, 'getFork').mockRejectedValue(rateLimitError);

      await expect(
        workspacePreparationService.prepareWorkspace(session.id)
      ).rejects.toMatchObject({
        classification: 'RATE_LIMIT',
        statusCode: 403,
      });

      const updated = contributionSessionStore.getSession(session.id)!;
      expect(updated.preparationStatus).toBe('PREPARATION_FAILED');
      expect(updated.errorMessage).toContain('rate limit');
    });
  });
});
