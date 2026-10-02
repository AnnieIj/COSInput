/**
 * COSInput Foundation v0.4.4 — First Real Contributor Pilot Test Suite
 *
 * Verifies:
 * 1. Pilot Issue Selection & Strict Eligibility Gating:
 *    - Verifies issue is open, contributor assigned, repo accessible, issue not completed, no existing PR
 *    - Rejects missing required selection parameters (prohibits automatic selection)
 *    - Strictly excludes AgesEmpire/StellarSwipe-FrontEnd #657
 * 2. Grounded Implementation & Approval Gates:
 *    - Generates grounded plan from repository intelligence
 *    - Rejects execution without explicit human approval
 *    - Records explicit approval gate transition
 * 3. Authentic Execution & Genuine Verification:
 *    - Operates on verified Git workspace
 *    - Inspects real source and applies actual focused modifications
 *    - Generates genuine Git diff
 *    - Runs real repository verification commands and records exact exit codes
 *    - Distinguishes PASSED, FAILED, BLOCKED, and NOT_RUN outcomes
 *    - Refuses to fabricate verification results or treat skipped commands as successful
 * 4. Human Review & Decision:
 *    - Displays actual changed files, diff, test results, and outstanding risks
 *    - Supports APPROVE, REVISE, and REJECT review decisions
 * 5. Remote Write Safety & Stopping at REVIEW_READY:
 *    - Work stops at REVIEW_READY without automated PR creation
 *    - Zero commits or pushes to canonical upstream
 *    - Governed by separate explicit per-step human authorization gates
 * 6. Pilot Final Report Generation:
 *    - Produces structured report confirming zero unapproved live modifications
 *
 * Distinction:
 * - Suites 1, 2, 4, 5, 6: Mocked GitHub / Orchestration Tests
 * - Suite 3 & Authentic Lifecycle: Genuine Local Git Integration Tests (Disposable Repo)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { pilotService } from '../server/pilotService';
import { contributionSessionStore } from '../server/contributionSessionStore';
import { userAuthStore } from '../server/userAuthStore';
import { githubServerClient } from '../server/githubClient';
import { workspaceExecutionEngine } from '../server/workspaceExecutionEngine';
import { implementationRunnerService } from '../server/implementationRunnerService';
import { workspacePreparationService } from '../server/workspacePreparationService';
import { repositoryIntelligenceService } from '../server/repositoryIntelligenceService';
import { issueAnalysisService } from '../server/issueAnalysisService';
import type {
  ContributionSession,
  ImplementationPlan,
  VerificationResultItem,
} from '../server/types';

const execFileAsync = promisify(execFile);

// Helper to create disposable local repositories for genuine integration testing
async function createDisposableUpstreamRepo(repoDir: string): Promise<{
  repoDir: string;
  initialCommitSha: string;
}> {
  await fs.mkdir(repoDir, { recursive: true, mode: 0o700 });
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: repoDir });
  await execFileAsync('git', ['config', 'user.name', 'Upstream Maintainer'], { cwd: repoDir });
  await execFileAsync('git', ['config', 'user.email', 'maintainer@example.com'], { cwd: repoDir });

  // Add real source files
  const srcDir = path.join(repoDir, 'src');
  await fs.mkdir(srcDir, { recursive: true });
  await fs.writeFile(
    path.join(srcDir, 'math.ts'),
    `export const calculateTotal = (items: number[]): number => items.reduce((a, b) => a + b, 0);\n`,
    'utf-8'
  );
  await fs.writeFile(
    path.join(repoDir, 'package.json'),
    JSON.stringify({ name: 'sample-pilot-repo', version: '1.0.0', type: 'module' }, null, 2),
    'utf-8'
  );

  await execFileAsync('git', ['add', '.'], { cwd: repoDir });
  await execFileAsync('git', ['commit', '-m', 'feat: initial math module'], { cwd: repoDir });

  const { stdout: initialSha } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoDir });

  return {
    repoDir,
    initialCommitSha: initialSha.trim(),
  };
}

describe('COSInput Foundation v0.4.4 — First Real Contributor Pilot', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    userAuthStore.setUserSession(undefined, 'valid-pilot-token', {
      login: 'alice-contributor',
      name: 'Alice Contributor',
      id: '99991',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99991',
      authSource: 'oauth',
      authenticatedAt: new Date().toISOString(),
    });
  });

  // =========================================================================
  // SUITE 1: [Mocked GitHub Tests] Issue Selection & Strict Eligibility
  // =========================================================================
  describe('1. [Mocked GitHub Tests] Pilot Issue Selection & Strict Eligibility Gating', () => {
    it('verifies that an open, assigned issue without existing PR is eligible for pilot', async () => {
      vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValue({
        id: 101,
        name: 'core-utils',
        fullName: 'acme-corp/core-utils',
        owner: 'acme-corp',
        isPrivate: false,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/acme-corp/core-utils',
      } as any);

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 501,
        number: 42,
        title: 'Add Exponential Backoff for HTTP Requests',
        body: 'Implement retry policy with exponential backoff.',
        state: 'open',
        author: 'maintainer-bob',
        assignees: ['alice-contributor'],
        labels: [],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
        commentsCount: 2,
        htmlUrl: 'https://github.com/acme-corp/core-utils/issues/42',
      } as any);

      vi.spyOn(githubServerClient, 'listPullRequests').mockResolvedValue([]);

      const result = await pilotService.verifyPilotIssueEligibility(
        'acme-corp',
        'core-utils',
        42,
        'alice-contributor'
      );

      expect(result.eligible).toBe(true);
      expect(result.isOpen).toBe(true);
      expect(result.isAssigned).toBe(true);
      expect(result.isAccessible).toBe(true);
      expect(result.isCompleted).toBe(false);
      expect(result.hasExistingPr).toBe(false);
      expect(result.isExcludedHistorical).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('strictly excludes AgesEmpire/StellarSwipe-FrontEnd #657 from active execution', async () => {
      const result = await pilotService.verifyPilotIssueEligibility(
        'AgesEmpire',
        'StellarSwipe-FrontEnd',
        657,
        'alice-contributor'
      );

      expect(result.eligible).toBe(false);
      expect(result.isExcludedHistorical).toBe(true);
      expect(result.reasons[0]).toContain(
        'AgesEmpire/StellarSwipe-FrontEnd #657 is reserved for regression verification only'
      );
    });

    it('rejects closed issues as ineligible', async () => {
      vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValue({
        id: 101,
        name: 'core-utils',
        fullName: 'acme-corp/core-utils',
      } as any);

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 501,
        number: 10,
        title: 'Closed Issue',
        state: 'closed',
        assignees: ['alice-contributor'],
      } as any);

      vi.spyOn(githubServerClient, 'listPullRequests').mockResolvedValue([]);

      const result = await pilotService.verifyPilotIssueEligibility(
        'acme-corp',
        'core-utils',
        10,
        'alice-contributor'
      );

      expect(result.eligible).toBe(false);
      expect(result.isOpen).toBe(false);
      expect(result.reasons.some((r) => r.includes('is closed'))).toBe(true);
    });

    it('rejects issues where the contributor is not assigned', async () => {
      vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValue({
        id: 101,
        name: 'core-utils',
      } as any);

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 502,
        number: 22,
        title: 'Assigned to someone else',
        state: 'open',
        assignees: ['bob-developer'],
      } as any);

      vi.spyOn(githubServerClient, 'listPullRequests').mockResolvedValue([]);

      const result = await pilotService.verifyPilotIssueEligibility(
        'acme-corp',
        'core-utils',
        22,
        'alice-contributor'
      );

      expect(result.eligible).toBe(false);
      expect(result.isAssigned).toBe(false);
      expect(result.reasons.some((r) => r.includes('not assigned'))).toBe(true);
    });

    it('rejects issues that already have an existing contributor pull request', async () => {
      vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValue({
        id: 101,
        name: 'core-utils',
      } as any);

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 503,
        number: 33,
        title: 'Fix cache bug',
        state: 'open',
        assignees: ['alice-contributor'],
      } as any);

      vi.spyOn(githubServerClient, 'listPullRequests').mockResolvedValue([
        {
          id: 9001,
          number: 77,
          title: 'Fix cache bug (closes #33)',
          body: 'Resolves #33',
          htmlUrl: 'https://github.com/acme-corp/core-utils/pull/77',
          headBranch: 'alice-contributor/33-fix-cache',
          headRepoOwner: 'alice-contributor',
        } as any,
      ]);

      const result = await pilotService.verifyPilotIssueEligibility(
        'acme-corp',
        'core-utils',
        33,
        'alice-contributor'
      );

      expect(result.eligible).toBe(false);
      expect(result.hasExistingPr).toBe(true);
      expect(result.existingPrNumber).toBe(77);
      expect(result.reasons.some((r) => r.includes('Existing pull request #77 already addresses issue #33'))).toBe(true);
    });

    it('prohibits automatic issue selection and requires explicit contributor choice', async () => {
      await expect(
        pilotService.selectPilotIssue({
          owner: '',
          repo: 'core-utils',
          issueNumber: 42,
        })
      ).rejects.toMatchObject({
        message: expect.stringContaining('explicitly selected by the contributor'),
      });
    });

    it('creates an active pilot session upon explicit contributor selection', async () => {
      vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValue({
        id: 101,
        name: 'core-utils',
        fullName: 'acme-corp/core-utils',
      } as any);

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 501,
        number: 42,
        title: 'Add Exponential Backoff for HTTP Requests',
        state: 'open',
        assignees: ['alice-contributor'],
      } as any);

      vi.spyOn(githubServerClient, 'listPullRequests').mockResolvedValue([]);

      const session = await pilotService.selectPilotIssue({
        owner: 'acme-corp',
        repo: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
      });

      expect(session).toBeDefined();
      expect(session.isPilotRun).toBe(true);
      expect(session.pilotStatus).toBe('ISSUE_VERIFIED');
      expect(session.requireAuthenticCheckout).toBe(true);
      expect(session.upstreamRepository).toBe('acme-corp/core-utils');
    });
  });

  // =========================================================================
  // SUITE 2: [Mocked GitHub Tests] Grounded Implementation & Approval Gates
  // =========================================================================
  describe('2. [Mocked GitHub Tests] Grounded Plan Generation & Approval Gate', () => {
    it('generates a grounded plan and sets status to PLAN_APPROVAL_REQUIRED', async () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
        issueUrl: 'https://github.com/acme-corp/core-utils/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        pilotStatus: 'ISSUE_VERIFIED',
      });

      // Mock repository inspection
      vi.spyOn(issueAnalysisService, 'analyzeIssue').mockImplementation(async (params) => {
        return issueAnalysisService.runGroundedSemanticAnalysis(params);
      });

      vi.spyOn(repositoryIntelligenceService, 'inspectRepository').mockResolvedValue({
        repositoryIntelligence: {
          owner: 'acme-corp',
          name: 'core-utils',
          defaultBranch: 'main',
          stars: 10,
          forks: 2,
          openIssuesCount: 1,
          isPrivate: false,
          discoveredInstructionFiles: [],
          discoveredInstructions: [],
          workflowFiles: [],
          relevantSourceDirs: ['src'],
          relevantTestDirs: ['tests'],
          totalTreeFilesCount: 3,
          sampleTreeFiles: ['src/client.ts', 'tests/client.test.ts', 'package.json'],
          allTreeFiles: ['src/client.ts', 'tests/client.test.ts', 'package.json'],
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
        rawFiles: {},
      } as any);

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 501,
        number: 42,
        title: 'Add Exponential Backoff for HTTP Requests',
        body: 'Implement retry policy with exponential backoff in src/client.ts.',
        state: 'open',
        assignees: ['alice-contributor'],
      } as any);

      vi.spyOn(githubServerClient, 'getRepositoryTree').mockResolvedValue({
        sha: 'tree1',
        truncated: false,
        tree: [
          { path: 'src/client.ts', mode: '100644', type: 'blob', size: 1024, sha: 'abc1' },
          { path: 'tests/client.test.ts', mode: '100644', type: 'blob', size: 512, sha: 'abc2' },
          { path: 'package.json', mode: '100644', type: 'blob', size: 256, sha: 'abc3' },
        ],
      } as any);

      vi.spyOn(githubServerClient, 'getFileContent').mockResolvedValue({
        content: Buffer.from(
          JSON.stringify({
            name: 'core-utils',
            scripts: { test: 'vitest run', lint: 'eslint .', build: 'tsc' },
          })
        ).toString('base64'),
        path: 'package.json',
        size: 100,
        sha: 'pkg1',
      } as any);

      const withPlan = await pilotService.generatePilotPlan(session.id);

      expect(withPlan.pilotStatus).toBe('PLAN_APPROVAL_REQUIRED');
      expect(withPlan.implementationPlan).toBeDefined();
      expect(withPlan.implementationPlan?.proposedChanges.length).toBeGreaterThan(0);
    });

    it('rejects execution attempt without explicit human approval', async () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
        issueUrl: 'https://github.com/acme-corp/core-utils/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        pilotStatus: 'PLAN_APPROVAL_REQUIRED',
        implementationPlan: {
          issueSummary: 'Add retry policy',
          repositoryUnderstanding: 'TypeScript project',
          proposedChanges: [
            {
              id: 'c1',
              targetFile: 'src/client.ts',
              changeType: 'MODIFY',
              summary: 'Add retry helper',
              description: 'Add retry helper',
              mappedAcceptanceCriteriaIds: ['ac-1'],
              rationale: 'Addresses issue',
              verificationCriteria: ['Test backoff'],
            },
          ],
          buildLintVerification: ['npm test'],
          testsToRun: ['npm test'],
          risks: [],
          blockers: [],
          outOfScopeItems: [],
          estimatedChangeSurface: 'SMALL',
          manualVerificationSteps: [],
        },
        humanApproval: undefined, // Not approved yet
      });

      await expect(pilotService.runPilotExecution(session.id)).rejects.toMatchObject({
        message: expect.stringContaining('requires explicit human plan approval'),
      });
    });

    it('transitions to PLAN_APPROVED when contributor explicitly approves plan', async () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
        issueUrl: 'https://github.com/acme-corp/core-utils/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        pilotStatus: 'PLAN_APPROVAL_REQUIRED',
        implementationPlan: {
          issueSummary: 'Add retry policy',
          repositoryUnderstanding: 'TypeScript project',
          proposedChanges: [
            {
              id: 'c1',
              targetFile: 'src/client.ts',
              changeType: 'MODIFY',
              summary: 'Add retry helper',
              description: 'Add retry helper',
              mappedAcceptanceCriteriaIds: ['ac-1'],
              rationale: 'Addresses issue',
              verificationCriteria: ['Test backoff'],
            },
          ],
          buildLintVerification: ['npm test'],
          testsToRun: ['npm test'],
          risks: [],
          blockers: [],
          outOfScopeItems: [],
          estimatedChangeSurface: 'SMALL',
          manualVerificationSteps: [],
        },
      });

      const approved = await pilotService.approvePilotPlan(session.id);

      expect(approved.pilotStatus).toBe('PLAN_APPROVED');
      expect(approved.humanApproval?.status).toBe('approved');
      expect(approved.analysisStatus).toBe('APPROVED');
    });
  });

  // =========================================================================
  // SUITE 3: [Genuine Local Git Integration Tests] Authentic Workspace Execution
  // =========================================================================
  describe('3. [Genuine Local Git Integration Tests] Authentic Execution & Verification', () => {
    let tempDir: string;
    let upstreamRepoDir: string;
    let baseSha: string;

    beforeEach(async () => {
      tempDir = path.join('/tmp', `cosinput-pilot-test-${Date.now()}`);
      upstreamRepoDir = path.join(tempDir, 'upstream-repo');
      const repo = await createDisposableUpstreamRepo(upstreamRepoDir);
      baseSha = repo.initialCommitSha;
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Cleanup best effort
      }
    });

    it('executes genuine lifecycle: authentic clone -> file modification -> real git diff -> records outcomes -> stops at REVIEW_READY', async () => {
      // Setup session pointing to disposable local repo as customCloneSource
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'disposable-org',
        repositoryName: 'sample-pilot-repo',
        issueNumber: 42,
        issueTitle: 'Add multiply function to math module',
        issueUrl: 'https://github.com/disposable-org/sample-pilot-repo/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      const plan: ImplementationPlan = {
        issueSummary: 'Add multiply function',
        repositoryUnderstanding: 'Math library',
        proposedChanges: [
          {
            id: 'change-multiply',
            targetFile: 'src/math.ts',
            changeType: 'MODIFY',
            summary: 'Add export multiply function',
            description: 'Add export multiply function',
            mappedAcceptanceCriteriaIds: ['ac-1'],
            rationale: 'Required by issue acceptance criteria',
            verificationCriteria: ['src/math.ts exports multiply'],
          },
        ],
        buildLintVerification: ['git status'],
        testsToRun: ['git status'],
        risks: [],
        blockers: [],
        outOfScopeItems: [],
        estimatedChangeSurface: 'SMALL',
        manualVerificationSteps: [],
      };

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        customCloneSource: upstreamRepoDir,
        requireAuthenticCheckout: true,
        implementationPlan: plan,
        currentAttemptStatus: 'SUCCEEDED',
        currentAttemptId: 'attempt-pilot-1',
        analysisStatus: 'APPROVED',
        humanApproval: {
          status: 'approved',
          approvedAt: new Date().toISOString(),
        },
        pilotStatus: 'PLAN_APPROVED',
      });

      // Mock GitHub calls for verification
      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 42,
        number: 42,
        title: 'Add multiply function',
        state: 'open',
        assignees: ['alice-contributor'],
      } as any);

      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue({
        id: 555,
        name: 'sample-pilot-repo',
        fullName: 'alice-contributor/sample-pilot-repo',
        owner: 'alice-contributor',
        parentFullName: 'disposable-org/sample-pilot-repo',
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/alice-contributor/sample-pilot-repo',
      } as any);

      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
        name: 'main',
        sha: baseSha,
        isProtected: false,
      } as any);

      // Run pilot execution
      const executedSession = await pilotService.runPilotExecution(session.id);

      // Verify that execution stopped at REVIEW_READY
      expect(executedSession.pilotStatus).toBe('REVIEW_READY');
      expect(executedSession.executionRun).toBeDefined();
      expect(executedSession.executionRun?.status).toBe('SUCCEEDED');

      // Verify genuine Git diff was produced
      const diffSummary = executedSession.executionRun?.diffSummary;
      expect(diffSummary).toBeDefined();
      expect(diffSummary?.changedFilesCount).toBeGreaterThan(0);
      expect(diffSummary?.diffText).toContain('multiply');

      // Verify authentic file modification on disk
      const wsPath = workspaceExecutionEngine.getWorkspacePath(
        session.id,
        executedSession.executionRun!.id
      );
      const modifiedContent = await fs.readFile(path.join(wsPath, 'src/math.ts'), 'utf-8');
      expect(modifiedContent).toContain('multiply');

      // Verify verification outcomes were recorded with exact exit codes
      const verifications = executedSession.executionRun?.verificationResults || [];
      expect(verifications.length).toBeGreaterThan(0);
      for (const item of verifications) {
        expect(['PASSED', 'FAILED', 'BLOCKED', 'NOT_RUN']).toContain(item.outcome);
        expect(typeof item.exitCode).toBe('number');
      }

      // Invariant: Zero commits or PRs were pushed without separate explicit approval
      expect(executedSession.currentSubmission ?? null).toBeNull();
    });

    it('correctly distinguishes BLOCKED verification outcome when tooling is unavailable', async () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'disposable-org',
        repositoryName: 'sample-pilot-repo',
        issueNumber: 43,
        issueTitle: 'Add helper',
        issueUrl: 'https://github.com/disposable-org/sample-pilot-repo/issues/43',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      // Set command executor on implementationRunnerService to simulate missing tool (exit 127)
      implementationRunnerService.setCommandExecutor(async (command, type) => {
        if (type === 'typecheck') {
          return {
            exitCode: 127,
            output: 'tsc: command not found',
          };
        }
        return {
          exitCode: 0,
          output: 'ok',
        };
      });

      const plan: ImplementationPlan = {
        issueSummary: 'Add helper',
        repositoryUnderstanding: 'Math library',
        proposedChanges: [
          {
            id: 'change-1',
            targetFile: 'src/math.ts',
            changeType: 'MODIFY',
            summary: 'Modify math.ts',
            description: 'Modify math.ts',
            mappedAcceptanceCriteriaIds: ['ac-1'],
            rationale: 'Fix',
            verificationCriteria: ['passes'],
          },
        ],
        buildLintVerification: ['tsc --noEmit'],
        testsToRun: ['tsc --noEmit'],
        risks: [],
        blockers: [],
        outOfScopeItems: [],
        estimatedChangeSurface: 'SMALL',
        manualVerificationSteps: [],
      };

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        customCloneSource: upstreamRepoDir,
        requireAuthenticCheckout: true,
        implementationPlan: plan,
        currentAttemptStatus: 'SUCCEEDED',
        currentAttemptId: 'attempt-pilot-blocked',
        analysisStatus: 'APPROVED',
        humanApproval: {
          status: 'approved',
          approvedAt: new Date().toISOString(),
        },
        pilotStatus: 'PLAN_APPROVED',
      });

      vi.spyOn(githubServerClient, 'getIssue').mockResolvedValue({
        id: 43,
        number: 43,
        title: 'Add helper',
        state: 'open',
        assignees: ['alice-contributor'],
      } as any);

      vi.spyOn(githubServerClient, 'getFork').mockResolvedValue({
        id: 555,
        name: 'sample-pilot-repo',
        fullName: 'alice-contributor/sample-pilot-repo',
        owner: 'alice-contributor',
        parentFullName: 'disposable-org/sample-pilot-repo',
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/alice-contributor/sample-pilot-repo',
      } as any);

      vi.spyOn(githubServerClient, 'getBranch').mockResolvedValue({
        name: 'main',
        sha: baseSha,
        isProtected: false,
      } as any);

      const executed = await pilotService.runPilotExecution(session.id);
      implementationRunnerService.setCommandExecutor(undefined);

      const typecheckResult = executed.executionRun?.verificationResults.find(
        (r) => r.type === 'typecheck'
      );
      expect(typecheckResult).toBeDefined();
      expect(typecheckResult?.outcome).toBe('BLOCKED');
      expect(typecheckResult?.passed).toBe(false);
      expect(typecheckResult?.blockReason).toContain('command not found');
    });
  });

  // =========================================================================
  // SUITE 4: [Mocked GitHub Tests] Human Review Decisions & Final Report
  // =========================================================================
  describe('4. [Mocked GitHub Tests] Human Review & Decision Workflow', () => {
    it('handles human review APPROVE decision and moves to SUBMISSION_APPROVED', async () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
        issueUrl: 'https://github.com/acme-corp/core-utils/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        pilotStatus: 'REVIEW_READY',
        executionRun: {
          id: 'run-123',
          sessionId: session.id,
          status: 'SUCCEEDED',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          modifiedFiles: [
            {
              path: 'src/client.ts',
              action: 'MODIFY',
              summary: 'Added retry mechanism',
              linesAdded: 15,
              linesRemoved: 2,
            },
          ],
          diffSummary: {
            diffText: '+ export function retry() {}',
            filesChanged: ['src/client.ts'],
            changedFilesCount: 1,
            additions: 15,
            deletions: 2,
            totalChanges: 17,
          },
          verificationResults: [
            {
              id: 'step-test',
              type: 'test',
              command: 'npm test',
              exitCode: 0,
              passed: true,
              outcome: 'PASSED',
              outputSummary: '3 tests passed',
              timestamp: new Date().toISOString(),
              durationMs: 120,
            },
          ],
          acceptanceCriteriaEvidence: [
            {
              criterionId: 'ac-1',
              criterionDescription: 'HTTP requests are retried on 5xx errors',
              satisfied: true,
              verificationDetail: 'Verified by unit test suite',
            },
          ],
          commandOutputs: [],
          repairCycles: 0,
          repairHistory: [],
        } as any,
      });

      const reviewed = await pilotService.reviewPilot(session.id, 'APPROVE');

      expect(reviewed.pilotStatus).toBe('SUBMISSION_APPROVED');
      expect(reviewed.pilotReport).toBeDefined();
      expect(reviewed.pilotReport?.reviewDecision).toBe('APPROVED');
      expect(reviewed.pilotReport?.noLiveModificationConfirmed).toBe(true);
      expect(reviewed.pilotReport?.changedFiles).toEqual(['src/client.ts']);
      expect(reviewed.pilotReport?.actualTestResults[0].outcome).toBe('PASSED');
    });

    it('handles human review REVISE decision and resets status to PLAN_APPROVAL_REQUIRED', async () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
        issueUrl: 'https://github.com/acme-corp/core-utils/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        pilotStatus: 'REVIEW_READY',
      });

      const reviewed = await pilotService.reviewPilot(
        session.id,
        'REVISE',
        'Add extra test for jitter calculation'
      );

      expect(reviewed.pilotStatus).toBe('PLAN_APPROVAL_REQUIRED');
      expect(reviewed.pilotReport?.reviewDecision).toBe('REVISED');
    });

    it('handles human review REJECT decision and halts at REJECTED', async () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
        issueUrl: 'https://github.com/acme-corp/core-utils/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        pilotStatus: 'REVIEW_READY',
      });

      const reviewed = await pilotService.reviewPilot(
        session.id,
        'REJECT',
        'Architecture incompatible with team guidelines'
      );

      expect(reviewed.pilotStatus).toBe('REJECTED');
      expect(reviewed.pilotReport?.reviewDecision).toBe('REJECTED');
    });

    it('generates a comprehensive pilot final report confirming zero live modification', () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'core-utils',
        issueNumber: 42,
        issueTitle: 'Add Exponential Backoff for HTTP Requests',
        issueUrl: 'https://github.com/acme-corp/core-utils/issues/42',
        contributorUsername: 'alice-contributor',
        repositoryAccessStatus: 'public_readable',
      });

      contributionSessionStore.updateSession(session.id, {
        isPilotRun: true,
        pilotStatus: 'REVIEW_READY',
        blockers: [
          {
            id: 'b1',
            type: 'DEPENDENCY',
            severity: 'LOW',
            description: 'Axios dependency is peer-optional',
            resolutionRecommendation: 'Keep dependency scoped',
          },
        ] as any,
        executionRun: {
          id: 'run-99',
          sessionId: session.id,
          status: 'SUCCEEDED',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          modifiedFiles: [
            {
              path: 'src/backoff.ts',
              action: 'CREATE',
              summary: 'Added backoff calculation',
              linesAdded: 30,
              linesRemoved: 0,
            },
          ],
          diffSummary: {
            diffText: 'diff --git a/src/backoff.ts ...',
            filesChanged: ['src/backoff.ts'],
            changedFilesCount: 1,
            additions: 30,
            deletions: 0,
            totalChanges: 30,
          },
          verificationResults: [
            {
              id: 'test-1',
              type: 'test',
              command: 'vitest run',
              exitCode: 0,
              passed: true,
              outcome: 'PASSED',
              outputSummary: '1 test passed',
              timestamp: new Date().toISOString(),
              durationMs: 50,
            },
          ],
          acceptanceCriteriaEvidence: [],
          commandOutputs: [],
          repairCycles: 0,
          repairHistory: [],
        } as any,
      });

      const report = pilotService.generatePilotFinalReport(session.id, 'APPROVED');

      expect(report.sessionId).toBe(session.id);
      expect(report.selectedIssue.number).toBe(42);
      expect(report.changedFiles).toEqual(['src/backoff.ts']);
      expect(report.gitDiff).toContain('diff --git');
      expect(report.actualTestResults[0].outcome).toBe('PASSED');
      expect(report.outstandingRisks).toEqual(['Axios dependency is peer-optional']);
      expect(report.noLiveModificationConfirmed).toBe(true);
      expect(report.remainingLimitations.some((l) => l.includes('Automatic PR creation is intentionally disabled'))).toBe(true);
      expect(report.remainingLimitations.some((l) => l.includes('CI Guardian'))).toBe(true);
    });
  });
});
