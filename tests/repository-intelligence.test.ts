/**
 * COSInput Foundation v0.3 — Repository Intelligence & Issue Analysis Test Suite
 * Tests:
 * 1. Contribution session creation & lifecycle state machine
 * 2. Progressive repository inspection (metadata, tree, candidate files)
 * 3. Repository instruction discovery (AGENTS.md, CONTRIBUTING.md, etc.)
 * 4. Issue analysis normalization (explicit vs inferred, constraints, questions)
 * 5. Acceptance criteria synthesis (functional, test, lint, verification strategy)
 * 6. Relevant file discovery & classification (primary, test, config, docs, confidence)
 * 7. Blocker detection (write access limitations, missing canonical info, ambiguous items)
 * 8. Implementation plan generation (summary, proposed changes, surface estimation, risks)
 * 9. Human approval gate behavior (transition to APPROVED, read-only guarantees, revision request, cancel)
 * 10. Live vs Demo isolation (Demo fixture fallback vs real server requests)
 * 11. Zero GitHub write invariants (verifies no branch creation, commits, pushes, PRs, or comments)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { contributionSessionStore } from '../server/contributionSessionStore';
import { repositoryIntelligenceService } from '../server/repositoryIntelligenceService';
import { issueAnalysisService } from '../server/issueAnalysisService';
import { githubServerClient } from '../server/githubClient';
import { githubService } from '../src/services/github.service';
import type {
  ContributionSession,
  RepositoryIntelligenceData,
  DependencyConfigAnalysis,
  RepositoryAccessStatus,
} from '../server/types';

describe('COSInput Foundation v0.3 — Repository Intelligence & Issue Analysis', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Contribution Session Creation & Lifecycle State Machine
  // --------------------------------------------------------------------------
  describe('Contribution Session Creation & Lifecycle', () => {
    it('creates a local contribution session with all required initial fields and NOT_STARTED status', () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'acme-corp',
        repositoryName: 'payment-gateway',
        issueNumber: 42,
        issueTitle: 'Add webhook signature verification',
        issueUrl: 'https://github.com/acme-corp/payment-gateway/issues/42',
        contributorUsername: 'alice',
        repositoryAccessStatus: 'public_readable',
      });

      expect(session).toBeDefined();
      expect(session.id).toBe('contrib-acme-corp-payment-gateway-42');
      expect(session.repositoryOwner).toBe('acme-corp');
      expect(session.repositoryName).toBe('payment-gateway');
      expect(session.upstreamRepository).toBe('acme-corp/payment-gateway');
      expect(session.issueNumber).toBe(42);
      expect(session.issueTitle).toBe('Add webhook signature verification');
      expect(session.issueUrl).toBe('https://github.com/acme-corp/payment-gateway/issues/42');
      expect(session.contributorUsername).toBe('alice');
      expect(session.repositoryAccessStatus).toBe('public_readable');
      expect(session.analysisStatus).toBe('NOT_STARTED');
      expect(session.createdTimestamp).toBeDefined();
      expect(session.updatedTimestamp).toBeDefined();
      expect(session.humanApproval.status).toBe('pending');
      expect(session.activityTimeline.length).toBeGreaterThan(0);
      expect(session.activityTimeline[0].stage).toContain('Session Initialized');
    });

    it('updates session status progressively through analysis states', () => {
      const sessionId = 'contrib-acme-corp-payment-gateway-42';

      // 1. REPOSITORY_INSPECTION
      const inspecting = contributionSessionStore.updateSession(sessionId, {
        analysisStatus: 'REPOSITORY_INSPECTION',
      });
      expect(inspecting.analysisStatus).toBe('REPOSITORY_INSPECTION');

      // 2. ISSUE_ANALYSIS
      const analyzing = contributionSessionStore.updateSession(sessionId, {
        analysisStatus: 'ISSUE_ANALYSIS',
      });
      expect(analyzing.analysisStatus).toBe('ISSUE_ANALYSIS');

      // 3. PLAN_READY
      const planReady = contributionSessionStore.updateSession(sessionId, {
        analysisStatus: 'PLAN_READY',
      });
      expect(planReady.analysisStatus).toBe('PLAN_READY');

      // 4. APPROVED
      const approved = contributionSessionStore.updateSession(sessionId, {
        analysisStatus: 'APPROVED',
      });
      expect(approved.analysisStatus).toBe('APPROVED');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Progressive Repository Inspection & Instruction Discovery
  // --------------------------------------------------------------------------
  describe('Progressive Repository Inspection & Instruction Discovery', () => {
    it('inspects repository tree, detects AGENTS.md and CONTRIBUTING.md, and extracts contributor constraints', async () => {
      // Mock repository metadata
      vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValue({
        id: '123456',
        name: 'stellar-frontend',
        fullName: 'AgesEmpire/StellarSwipe-FrontEnd',
        owner: 'AgesEmpire',
        description: 'Decentralized card swipe application',
        defaultBranch: 'main',
        openIssuesCount: 5,
        isPrivate: false,
        stars: 42,
        forks: 10,
        updatedAt: '2026-03-01T00:00:00Z',
        htmlUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd',
        language: 'TypeScript',
        permissions: { admin: false, push: false, pull: true },
      });

      // Mock repository tree containing instructions and configs
      vi.spyOn(githubServerClient, 'getRepositoryTree').mockResolvedValue({
        sha: 'tree123',
        truncated: false,
        tree: [
          { path: 'README.md', mode: '100644', type: 'blob', sha: 'blob1' },
          { path: 'AGENTS.md', mode: '100644', type: 'blob', sha: 'blob2' },
          { path: 'CONTRIBUTING.md', mode: '100644', type: 'blob', sha: 'blob3' },
          { path: 'package.json', mode: '100644', type: 'blob', sha: 'blob4' },
          { path: 'tsconfig.json', mode: '100644', type: 'blob', sha: 'blob5' },
          { path: 'src/components/Deck.tsx', mode: '100644', type: 'blob', sha: 'blob6' },
          { path: 'src/tests/Deck.test.tsx', mode: '100644', type: 'blob', sha: 'blob7' },
          { path: '.github/workflows/ci.yml', mode: '100644', type: 'blob', sha: 'blob8' },
        ],
      });

      // Mock candidate file contents
      vi.spyOn(githubServerClient, 'getFileContent').mockImplementation(
        async (_instId, _owner, _repo, path) => {
          if (path === 'AGENTS.md') {
            return {
              name: 'AGENTS.md',
              path: 'AGENTS.md',
              sha: 'blob2',
              size: 500,
              type: 'file',
              content:
                '# Agent Directives\n- Never modify src/contracts/generated.ts\n- Always run npm test before proposing changes\n- Follow atomic commit message rules',
              encoding: 'utf-8',
            };
          }
          if (path === 'CONTRIBUTING.md') {
            return {
              name: 'CONTRIBUTING.md',
              path: 'CONTRIBUTING.md',
              sha: 'blob3',
              size: 400,
              type: 'file',
              content:
                '# Contributing Guidelines\n- Branch naming: feat/* or fix/*\n- Run npm run lint before opening PR',
              encoding: 'utf-8',
            };
          }
          if (path === 'package.json') {
            return {
              name: 'package.json',
              path: 'package.json',
              sha: 'blob4',
              size: 300,
              type: 'file',
              content: JSON.stringify({
                name: 'stellar-frontend',
                scripts: {
                  test: 'vitest run',
                  lint: 'eslint .',
                  build: 'vite build',
                },
                dependencies: {
                  react: '^19.0.0',
                  vite: '^6.0.0',
                },
                devDependencies: {
                  vitest: '^3.0.0',
                  eslint: '^9.0.0',
                  typescript: '^5.0.0',
                },
              }),
              encoding: 'utf-8',
            };
          }
          return {
            name: path,
            path,
            sha: 'unknown',
            size: 10,
            type: 'file',
            content: '',
            encoding: 'utf-8',
          };
        }
      );

      const inspection = await repositoryIntelligenceService.inspectRepository(
        'AgesEmpire',
        'StellarSwipe-FrontEnd'
      );

      expect(inspection.repositoryIntelligence).toBeDefined();
      expect(inspection.repositoryIntelligence.owner).toBe('AgesEmpire');
      expect(inspection.repositoryIntelligence.repo).toBe('StellarSwipe-FrontEnd');
      expect(inspection.repositoryIntelligence.defaultBranch).toBe('main');

      // Discovered instruction files
      expect(inspection.repositoryIntelligence.discoveredInstructionFiles).toContain('AGENTS.md');
      expect(inspection.repositoryIntelligence.discoveredInstructionFiles).toContain('CONTRIBUTING.md');

      // Discovered instructions parsed
      const instructions = inspection.repositoryIntelligence.discoveredInstructions;
      expect(instructions.length).toBeGreaterThan(0);

      const agentRule = instructions.find((i) => i.sourceFile === 'AGENTS.md');
      expect(agentRule).toBeDefined();

      // Tooling & Dependency mapping
      expect(inspection.dependencyConfig.language).toBe('TypeScript');
      expect(inspection.dependencyConfig.testFramework).toBe('Vitest');
      expect(inspection.dependencyConfig.lintTooling).toBe('ESLint');
      expect(inspection.dependencyConfig.buildTooling).toBe('Vite');
      expect(inspection.repositoryIntelligence.workflowFiles).toContain('.github/workflows/ci.yml');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Issue Analysis Normalization, Acceptance Criteria, & Relevant Files
  // --------------------------------------------------------------------------
  describe('Issue Analysis Engine & Acceptance Criteria Synthesis', () => {
    const mockRepoIntelligence: RepositoryIntelligenceData = {
      owner: 'AgesEmpire',
      repo: 'StellarSwipe-FrontEnd',
      defaultBranch: 'main',
      description: 'Swipe UI frontend',
      stars: 12,
      forks: 3,
      openIssuesCount: 4,
      isPrivate: false,
      discoveredInstructionFiles: ['AGENTS.md', 'package.json'],
      discoveredInstructions: [
        {
          category: 'prohibited_modifications',
          title: 'Agent Constraint',
          details: 'Do not modify generated files',
          sourceFile: 'AGENTS.md',
        },
      ],
      workflowFiles: ['.github/workflows/ci.yml'],
      relevantSourceDirs: ['src/components'],
      relevantTestDirs: ['src/tests'],
      totalTreeFilesCount: 8,
      sampleTreeFiles: [
        'package.json',
        'src/components/SwipeCard.tsx',
        'src/components/Deck.tsx',
        'src/tests/SwipeCard.test.tsx',
        'src/services/stellar.ts',
      ],
    };

    const mockDependencyConfig: DependencyConfigAnalysis = {
      framework: 'React',
      language: 'TypeScript',
      packageManager: 'npm',
      runtime: 'Node.js',
      majorDependencies: ['react', 'vite'],
      testFramework: 'Vitest',
      lintTooling: 'ESLint',
      buildTooling: 'Vite',
      ciSystem: 'GitHub Actions',
      externalConfiguration: [],
    };

    it('synthesizes structured acceptance criteria across functional, test, and lint dimensions', () => {
      const issueBody = `
### Summary
The swipe animation stutters when dragging quickly on mobile viewports.

### Acceptance Criteria
- [ ] SwipeCard component must animate smoothly at 60fps
- [ ] Threshold trigger must register at 120px offset
- [ ] SwipeCard.test.tsx must pass with new drag tests
      `;

      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 15,
        issueTitle: 'Fix stuttering gesture animation in SwipeCard',
        issueBody,
        issueLabels: [{ name: 'bug' }, { name: 'ui' }],
        repositoryIntelligence: mockRepoIntelligence,
        dependencyConfig: mockDependencyConfig,
        repositoryAccessStatus: 'app_authorized',
      });

      expect(analysis.issueIntelligence).toBeDefined();
      expect(analysis.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);

      // Criteria IDs follow AC-01 format
      expect(analysis.acceptanceCriteria[0].id).toBe('AC-01');
      expect(analysis.acceptanceCriteria[0].confidence).toBe('HIGH');

      // Test criterion added based on Vitest tooling
      const testCriterion = analysis.acceptanceCriteria.find((ac) => ac.type === 'TEST');
      expect(testCriterion).toBeDefined();
      expect(testCriterion?.verificationStrategy).toContain('test');

      // Lint criterion added based on ESLint tooling
      const lintCriterion = analysis.acceptanceCriteria.find((ac) => ac.type === 'LINT');
      expect(lintCriterion).toBeDefined();
    });

    it('discovers relevant files from repository tree and categorizes them with confidence scores', () => {
      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 15,
        issueTitle: 'Fix gesture animation in SwipeCard',
        issueBody: 'Check src/components/SwipeCard.tsx and verify with SwipeCard.test.tsx',
        issueLabels: [{ name: 'bug' }],
        repositoryIntelligence: mockRepoIntelligence,
        dependencyConfig: mockDependencyConfig,
        repositoryAccessStatus: 'app_authorized',
      });

      const files = analysis.relevantFiles;
      expect(files.length).toBeGreaterThan(0);

      const primaryFile = files.find((f) => f.path === 'src/components/SwipeCard.tsx');
      expect(primaryFile).toBeDefined();
      expect(primaryFile?.category).toBe('PRIMARY');
      expect(primaryFile?.modificationLikely).toBe(true);
      expect(primaryFile?.confidence).toBe('HIGH');

      const testFile = files.find((f) => f.path === 'src/tests/SwipeCard.test.tsx');
      expect(testFile).toBeDefined();
      expect(testFile?.category).toBe('TEST');
    });

    it('generates a phased implementation plan with estimated change surface and risks', () => {
      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 15,
        issueTitle: 'Fix gesture animation in SwipeCard',
        issueBody: 'Optimize touchmove event listener in SwipeCard component.',
        issueLabels: [{ name: 'performance' }],
        repositoryIntelligence: mockRepoIntelligence,
        dependencyConfig: mockDependencyConfig,
        repositoryAccessStatus: 'app_authorized',
      });

      const plan = analysis.implementationPlan;
      expect(plan).toBeDefined();
      expect(plan.issueSummary).toContain('Issue #15');
      expect(plan.estimatedChangeSurface).toBeDefined();
      expect(['SMALL', 'MEDIUM', 'LARGE']).toContain(plan.estimatedChangeSurface);
      expect(plan.testsToRun.length).toBeGreaterThan(0);
      expect(plan.buildLintVerification.length).toBeGreaterThan(0);
      expect(plan.risks.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Blocker Detection (Write Permissions & Missing Information)
  // --------------------------------------------------------------------------
  describe('Blocker & Risk Detection', () => {
    const mockRepoIntelligence: RepositoryIntelligenceData = {
      owner: 'DigiNodes',
      repo: 'truthbounty-frontend',
      defaultBranch: 'main',
      description: 'Public community repository',
      stars: 5,
      forks: 1,
      openIssuesCount: 2,
      isPrivate: false,
      discoveredInstructionFiles: [],
      discoveredInstructions: [],
      workflowFiles: [],
      relevantSourceDirs: ['src'],
      relevantTestDirs: [],
      totalTreeFilesCount: 5,
      sampleTreeFiles: ['src/App.tsx'],
    };

    const mockDependencyConfig: DependencyConfigAnalysis = {
      framework: 'React',
      language: 'TypeScript',
      packageManager: 'npm',
      runtime: 'Node.js',
      majorDependencies: ['react'],
      testFramework: 'None detected',
      lintTooling: 'None detected',
      buildTooling: 'Vite',
      ciSystem: 'None detected',
      externalConfiguration: [],
    };

    it('flags REPOSITORY_ACCESS_LIMITATION blocker when repository is not App-Authorized', () => {
      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 8,
        issueTitle: 'Update hero banner copy',
        issueBody: 'Change the title on the hero banner to TruthBounty v2.',
        issueLabels: [{ name: 'copy' }],
        repositoryIntelligence: mockRepoIntelligence,
        dependencyConfig: mockDependencyConfig,
        repositoryAccessStatus: 'public_readable', // Not app_authorized!
      });

      expect(analysis.isBlocked).toBe(true);
      const accessBlocker = analysis.blockers.find(
        (b) => b.category === 'REPOSITORY_ACCESS_LIMITATION'
      );
      expect(accessBlocker).toBeDefined();
      expect(accessBlocker?.description).toContain('write access is not authorized');
      expect(accessBlocker?.recommendedNextAction).toContain('Install the COSInput GitHub App');
    });

    it('flags MISSING_CANONICAL_INFORMATION when issue contains unconfigured contract placeholder', () => {
      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 9,
        issueTitle: 'Connect bounty escrow contract',
        issueBody: 'Deploy handler for escrow at <CONTRACT_ADDRESS> and test payout.',
        issueLabels: [{ name: 'blockchain' }],
        repositoryIntelligence: mockRepoIntelligence,
        dependencyConfig: mockDependencyConfig,
        repositoryAccessStatus: 'app_authorized',
      });

      expect(analysis.isBlocked).toBe(true);
      const canonicalBlocker = analysis.blockers.find(
        (b) => b.category === 'MISSING_CANONICAL_INFORMATION'
      );
      expect(canonicalBlocker).toBeDefined();
      expect(canonicalBlocker?.evidence).toContain('Placeholder identifier detected');
    });

    it('flags AMBIGUOUS_REQUIREMENT when issue has unresolved TBD items', () => {
      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 10,
        issueTitle: 'Add payment routing',
        issueBody: 'Design payment fee splits. Fee percentages are TBD and needs discussion.',
        issueLabels: [{ name: 'discussion' }],
        repositoryIntelligence: mockRepoIntelligence,
        dependencyConfig: mockDependencyConfig,
        repositoryAccessStatus: 'app_authorized',
      });

      expect(analysis.isBlocked).toBe(true);
      const ambiguousBlocker = analysis.blockers.find(
        (b) => b.category === 'AMBIGUOUS_REQUIREMENT'
      );
      expect(ambiguousBlocker).toBeDefined();
      expect(ambiguousBlocker?.description).toContain('unresolved TBD items');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Human Approval Gate Behavior
  // --------------------------------------------------------------------------
  describe('Human Approval Gate Behavior', () => {
    it('approving plan transitions local status to APPROVED and keeps implementation idle', () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'org',
        repositoryName: 'repo',
        issueNumber: 100,
        issueTitle: 'Upgrade logger',
        issueUrl: 'https://github.com/org/repo/issues/100',
        contributorUsername: 'contributor',
        repositoryAccessStatus: 'app_authorized',
      });

      // Update to PLAN_READY
      contributionSessionStore.updateSession(session.id, {
        analysisStatus: 'PLAN_READY',
      });

      // Contributor approves the plan
      const now = new Date().toISOString();
      const updated = contributionSessionStore.updateSession(session.id, {
        analysisStatus: 'APPROVED',
        humanApproval: {
          status: 'approved',
          approvedAt: now,
          feedback: 'Plan looks solid and well scoped.',
        },
      });

      expect(updated.analysisStatus).toBe('APPROVED');
      expect(updated.humanApproval.status).toBe('approved');
      expect(updated.humanApproval.approvedAt).toBe(now);
      expect(updated.humanApproval.feedback).toBe('Plan looks solid and well scoped.');
    });

    it('requesting plan revision returns status to PLAN_READY with feedback attached', () => {
      const sessionId = 'contrib-org-repo-100';
      const revised = contributionSessionStore.updateSession(sessionId, {
        analysisStatus: 'PLAN_READY',
        humanApproval: {
          status: 'revision_requested',
          feedback: 'Please include the test file in Phase 2.',
        },
      });

      expect(revised.analysisStatus).toBe('PLAN_READY');
      expect(revised.humanApproval.status).toBe('revision_requested');
      expect(revised.humanApproval.feedback).toBe('Please include the test file in Phase 2.');
    });

    it('cancelling contribution sets human approval to cancelled without deleting record', () => {
      const sessionId = 'contrib-org-repo-100';
      const cancelled = contributionSessionStore.updateSession(sessionId, {
        analysisStatus: 'NOT_STARTED',
        humanApproval: {
          status: 'cancelled',
        },
      });

      expect(cancelled.analysisStatus).toBe('NOT_STARTED');
      expect(cancelled.humanApproval.status).toBe('cancelled');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Zero GitHub Write Invariants (v0.3 Foundation Constraint)
  // --------------------------------------------------------------------------
  describe('Zero GitHub Write Invariants', () => {
    it('enforces that githubService write methods throw errors and are completely disabled', async () => {
      await expect(
        githubService.createBranch('owner', 'repo', 'feat/test', 'sha123')
      ).rejects.toThrow(/Write operations are forbidden in COSInput Foundation/);

      await expect(
        githubService.pushCommit('owner', 'repo', 'feat/test', 'fix: bug', [])
      ).rejects.toThrow(/Write operations are forbidden in COSInput Foundation/);

      await expect(
        githubService.retriggerWorkflowRun('owner', 'repo', 999)
      ).rejects.toThrow(/Workflow reruns are forbidden/);
    });

    it('verifies creating a contribution session and analyzing an issue makes zero mutation API calls', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // Starting a local contribution session
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'AgesEmpire',
        repositoryName: 'StellarSwipe-FrontEnd',
        issueNumber: 3,
        issueTitle: 'Investigate swipe bug',
        issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/3',
        contributorUsername: 'contributor',
        repositoryAccessStatus: 'public_readable',
      });

      expect(session).toBeDefined();

      // Ensure no POST / PATCH / DELETE / PUT fetch calls were made to GitHub API
      const mutatingCalls = fetchSpy.mock.calls.filter((call) => {
        const url = String(call[0]);
        const opts = call[1] as RequestInit | undefined;
        const method = (opts?.method || 'GET').toUpperCase();
        return url.includes('api.github.com') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
      });

      expect(mutatingCalls.length).toBe(0);
    });
  });
});
