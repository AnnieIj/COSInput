import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeParseResponse, safeExtractGitHubError } from '../server/responseUtils';
import { contributionSessionStore } from '../server/contributionSessionStore';
import { repositoryIntelligenceService } from '../server/repositoryIntelligenceService';
import { issueAnalysisService, generateEvidenceGroundedChanges } from '../server/issueAnalysisService';
import { githubServerClient } from '../server/githubClient';
import type {
  RepositoryIntelligenceData,
  DependencyConfigAnalysis,
  AcceptanceCriterion,
} from '../server/types';

describe('COSInput v0.3 — Critical Live Analysis Failure & State Integrity Regressions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Fetch Response Body Handling & Stream Integrity', () => {
    it('consumes a fetch Response body stream exactly once', async () => {
      const payload = { message: 'success', data: [1, 2, 3] };
      const response = new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.bodyUsed).toBe(false);
      const parsed = await safeParseResponse(response);
      expect(response.bodyUsed).toBe(true);

      expect(parsed.ok).toBe(true);
      expect(parsed.status).toBe(200);
      expect(parsed.isJson).toBe(true);
      expect(parsed.json).toEqual(payload);
      expect(parsed.text).toBe(JSON.stringify(payload));
    });

    it('throws the exact body-stream-already-read error if response was already consumed', async () => {
      const response = new Response('first read stream', { status: 200 });
      await response.text(); // Consume stream initially

      expect(response.bodyUsed).toBe(true);

      await expect(safeParseResponse(response)).rejects.toThrow(
        "Failed to execute 'text' on 'Response': body stream already read"
      );
    });

    it('safely extracts GitHub API errors from JSON response without secondary body reads', async () => {
      const errorPayload = { message: 'Repository not found', documentation_url: 'https://docs.github.com' };
      const response = new Response(JSON.stringify(errorPayload), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

      const sanitized = await safeExtractGitHubError(response);
      expect(response.bodyUsed).toBe(true);
      expect(sanitized.statusCode).toBe(404);
      expect(sanitized.classification).toBe('NOT_FOUND');
      expect(sanitized.message).toContain('Repository not found');
    });

    it('safely extracts GitHub API errors from plain text response without secondary body reads', async () => {
      const rawText = 'Internal Server Error: upstream timeout';
      const response = new Response(rawText, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });

      const sanitized = await safeExtractGitHubError(response);
      expect(response.bodyUsed).toBe(true);
      expect(sanitized.statusCode).toBe(500);
      expect(sanitized.classification).toBe('GITHUB_SERVICE_FAILURE');
      expect(sanitized.message).toContain('Internal Server Error: upstream timeout');
    });
  });

  describe('2. Atomic Analysis State & Approval Safety', () => {
    it('isolates analysis attempts and only publishes plan upon full success', () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'AgesEmpire',
        repositoryName: 'StellarSwipe-FrontEnd',
        issueNumber: 657,
        issueTitle: 'Improve search and filter discoverability in signal lists',
        issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/657',
        contributorUsername: 'AnnieIj',
        repositoryAccessStatus: 'public_readable',
      });

      // 1. Initial attempt
      const attempt1 = contributionSessionStore.startAnalysisAttempt(session.id);
      expect(session.currentAttemptId).toBe(attempt1);
      expect(session.currentAttemptStatus).toBe('RUNNING');
      expect(session.implementationPlan).toBeNull();

      // 2. Successful completion commits atomically
      const mockRepoIntel: RepositoryIntelligenceData = {
        owner: 'AgesEmpire',
        repo: 'StellarSwipe-FrontEnd',
        defaultBranch: 'main',
        description: '',
        stars: 10,
        forks: 2,
        openIssuesCount: 4,
        isPrivate: false,
        discoveredInstructionFiles: [],
        discoveredInstructions: [],
        workflowFiles: [],
        relevantSourceDirs: ['src'],
        relevantTestDirs: ['tests'],
        totalTreeFilesCount: 5,
        sampleTreeFiles: ['package.json', 'src/SignalFeed.tsx'],
        allTreeFiles: ['package.json', 'src/SignalFeed.tsx'],
      };

      const mockDepConfig: DependencyConfigAnalysis = {
        framework: 'Next.js',
        language: 'TypeScript',
        packageManager: 'npm',
        runtime: 'Node.js',
        majorDependencies: ['next', 'react'],
        testFramework: 'Vitest',
        lintTooling: 'ESLint',
        buildTooling: 'Vite',
        ciSystem: 'GitHub Actions',
        externalConfiguration: [],
        scripts: { test: 'vitest run' },
      };

      contributionSessionStore.commitAnalysisAttempt(session.id, attempt1, {
        repositoryIntelligence: mockRepoIntel,
        dependencyConfig: mockDepConfig,
        issueIntelligence: {
          problemStatement: 'Search and filter discoverability',
          requestedBehavior: 'Make search bar visible',
          expectedBehavior: 'Search controls discoverable at top of feed',
          explicitRequirements: ['Make search bar visible'],
          inferredRequirements: [],
          unknownsAndQuestions: [],
          filesMentioned: [],
          apisMentioned: [],
          dependenciesMentioned: [],
          testsRequested: [],
          documentationRequirements: [],
          constraints: [],
          securityConsiderations: [],
          outOfScopeItems: [],
        },
        acceptanceCriteria: [
          {
            id: 'AC-01',
            description: 'Make search bar visible',
            source: 'ISSUE',
            type: 'UX',
            verificationStrategy: 'Visual inspection',
            confidence: 'HIGH',
          },
        ],
        relevantFiles: [{ path: 'src/SignalFeed.tsx', category: 'PRIMARY', reason: 'Feed', confidence: 'HIGH', modificationLikely: true }],
        blockers: [],
        implementationPlan: {
          issueSummary: 'Improve search and filter',
          repositoryUnderstanding: 'Next.js and Vitest frontend',
          estimatedChangeSurface: 'SMALL',
          proposedChanges: [
            {
              id: 'change-1',
              targetFile: 'src/SignalFeed.tsx',
              description: 'Expose search bar',
              mappedAcceptanceCriteriaIds: ['AC-01'],
              changeRole: 'MODIFICATION',
              existingBehavior: 'Virtualized list',
              specificChange: 'Add search bar',
              necessityExplanation: 'Direct requirement',
              verificationStrategy: 'Mount and test',
            },
          ],
          testsToRun: ['npm test'],
          buildLintVerification: ['npm run lint'],
          risks: [],
          blockers: [],
          outOfScopeItems: [],
        },
        isBlocked: false,
      });

      expect(session.analysisStatus).toBe('PLAN_READY');
      expect(session.currentAttemptStatus).toBe('SUCCEEDED');
      expect(session.implementationPlan).not.toBeNull();
      expect(session.implementationPlan?.proposedChanges.length).toBe(1);

      // 3. Start second attempt (which encounters a failure)
      const attempt2 = contributionSessionStore.startAnalysisAttempt(session.id);
      expect(session.currentAttemptId).toBe(attempt2);
      expect(session.currentAttemptStatus).toBe('RUNNING');

      // Failure occurs during attempt2
      contributionSessionStore.failAnalysisAttempt(
        session.id,
        attempt2,
        "Failed to execute 'text' on 'Response': body stream already read"
      );

      // Verify atomic failure invariants
      expect(session.currentAttemptStatus).toBe('FAILED');
      expect(session.analysisStatus).toBe('FAILED');
      expect(session.implementationPlan).toBeNull(); // Current plan must not be ready for approval
      expect(session.humanApproval.status).toBe('pending');
      expect(session.errorMessage).toContain("Failed to execute 'text' on 'Response': body stream already read");

      // Verify historical preservation
      expect(session.historicalPlans).toBeDefined();
      expect(session.historicalPlans!.length).toBeGreaterThanOrEqual(1);
      expect(session.historicalPlans![0].plan.proposedChanges[0].targetFile).toBe('src/SignalFeed.tsx');
    });

    it('rejects stale or superseded analysis commits', () => {
      const session = contributionSessionStore.createSession({
        repositoryOwner: 'AgesEmpire',
        repositoryName: 'StellarSwipe-FrontEnd',
        issueNumber: 657,
        issueTitle: 'Test race condition',
        issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/657',
        contributorUsername: 'AnnieIj',
        repositoryAccessStatus: 'public_readable',
      });

      const attempt1 = contributionSessionStore.startAnalysisAttempt(session.id);
      const attempt2 = contributionSessionStore.startAnalysisAttempt(session.id); // Attempt 2 supersedes Attempt 1

      expect(session.currentAttemptId).toBe(attempt2);

      // Late commit from attempt1 should throw and be rejected
      expect(() => {
        contributionSessionStore.commitAnalysisAttempt(session.id, attempt1, {
          repositoryIntelligence: {} as any,
          dependencyConfig: {} as any,
          issueIntelligence: {} as any,
          acceptanceCriteria: [],
          relevantFiles: [],
          blockers: [],
          implementationPlan: {} as any,
          isBlocked: false,
        });
      }).toThrow(/stale/i);
    });
  });

  describe('3. Repository Intelligence Accuracy & Snapshot Preservation', () => {
    it('preserves verified metadata when subsequent inspection encounters partial/failed responses', async () => {
      const verifiedSnapshot = {
        timestamp: new Date().toISOString(),
        repositoryIntelligence: {
          owner: 'AgesEmpire',
          repo: 'StellarSwipe-FrontEnd',
          defaultBranch: 'main',
          description: 'Verified repo',
          stars: 42,
          forks: 5,
          openIssuesCount: 3,
          isPrivate: false,
          discoveredInstructionFiles: ['package.json'],
          discoveredInstructions: [],
          workflowFiles: ['.github/workflows/ci.yml'],
          relevantSourceDirs: ['src'],
          relevantTestDirs: ['tests'],
          totalTreeFilesCount: 10,
          sampleTreeFiles: ['package.json'],
          allTreeFiles: ['package.json'],
        },
        dependencyConfig: {
          framework: 'Next.js',
          language: 'TypeScript',
          packageManager: 'npm',
          runtime: 'Node.js',
          majorDependencies: ['next', 'react'],
          testFramework: 'Vitest',
          lintTooling: 'ESLint',
          buildTooling: 'Vite',
          ciSystem: 'GitHub Actions',
          externalConfiguration: [],
          scripts: { test: 'vitest run', lint: 'eslint .' },
        },
        status: 'verified' as const,
      };

      // Mock GitHub client failure to fetch repository tree on rerun
      vi.spyOn(githubServerClient, 'getRepositoryTree').mockRejectedValueOnce(
        new Error('GitHub API rate limit exceeded')
      );
      vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValueOnce({
        default_branch: 'main',
        stargazers_count: 42,
        forks_count: 5,
        open_issues_count: 3,
      } as any);

      const result = await repositoryIntelligenceService.inspectRepository(
        'AgesEmpire',
        'StellarSwipe-FrontEnd',
        null,
        verifiedSnapshot
      );

      // Verified metadata must be preserved, NOT degraded to 'None / framework-agnostic' or 'Unknown'
      expect(result.dependencyConfig.framework).toBe('Next.js');
      expect(result.dependencyConfig.language).toBe('TypeScript');
      expect(result.dependencyConfig.packageManager).toBe('npm');
      expect(result.dependencyConfig.testFramework).toBe('Vitest');
      expect(result.dependencyConfig.lintTooling).toBe('ESLint');
      expect(result.dependencyConfig.ciSystem).toBe('GitHub Actions');
    });
  });

  describe('4. Grounded Source Evidence & Unverified File Gates', () => {
    it('marks uninspected files as UNVERIFIED and prohibits proposed modifications based on assumptions', () => {
      const mockTree = [
        'components/signal/SignalFeed.tsx',
        'components/unfetched/MysteryComponent.tsx',
      ];

      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 657,
        issueTitle: 'Improve search and filter discoverability in signal lists',
        issueBody: 'Make search bar prominent in signal feed.',
        issueLabels: [{ name: 'ui' }],
        repositoryAccessStatus: 'public_readable',
        repositoryIntelligence: {
          owner: 'AgesEmpire',
          repo: 'StellarSwipe-FrontEnd',
          defaultBranch: 'main',
          description: '',
          stars: 1,
          forks: 0,
          openIssuesCount: 1,
          isPrivate: false,
          discoveredInstructionFiles: [],
          discoveredInstructions: [],
          workflowFiles: [],
          relevantSourceDirs: ['components'],
          relevantTestDirs: [],
          totalTreeFilesCount: 2,
          sampleTreeFiles: mockTree,
          allTreeFiles: mockTree,
        },
        dependencyConfig: {
          framework: 'Next.js',
          language: 'TypeScript',
          packageManager: 'npm',
          runtime: 'Node.js',
          majorDependencies: [],
          testFramework: 'Vitest',
          lintTooling: 'ESLint',
          buildTooling: 'Vite',
          ciSystem: 'GitHub Actions',
          externalConfiguration: [],
          scripts: {},
        },
        // Only SignalFeed.tsx was fetched; MysteryComponent.tsx was not retrieved
        rawFiles: {
          'components/signal/SignalFeed.tsx': `
            export function SignalFeed() {
              return <div>Feed</div>;
            }
          `,
        },
      });

      const mysteryChange = analysis.implementationPlan.proposedChanges.find(
        (c) => c.targetFile.includes('MysteryComponent.tsx')
      );

      if (mysteryChange) {
        expect(mysteryChange.verificationStatus).toBe('UNVERIFIED');
        expect(mysteryChange.changeRole).toBe('INSPECTION_ONLY');
        expect(mysteryChange.necessityExplanation).toContain('zero assumed code modifications on unverified files');
      }
    });

    it('does not attribute signal-list rendering or pagination to unrelated PortfolioEmptyState.tsx', () => {
      const mockRawFiles = {
        'components/portfolio/PortfolioEmptyState.tsx': `
          export function PortfolioEmptyState() {
            return <div>No assets in your portfolio. Start trading.</div>;
          }
        `,
        'components/signal/SignalSortControls.tsx': `
          export function SignalSortControls({ onSort }) {
            return <div className="sort-buttons"><button onClick={() => onSort('flame')}>Hot</button></div>;
          }
        `,
      };

      const changes = generateEvidenceGroundedChanges({
        relevantFiles: [
          { path: 'components/portfolio/PortfolioEmptyState.tsx', category: 'SUPPORTING', reason: 'Portfolio state', confidence: 'MEDIUM', modificationLikely: false },
          { path: 'components/signal/SignalSortControls.tsx', category: 'PRIMARY', reason: 'Sort controls', confidence: 'HIGH', modificationLikely: true },
        ],
        inspectedContents: mockRawFiles,
        acceptanceCriteria: [
          { id: 'AC-01', description: 'Search and filter controls are easy to find', source: 'ISSUE', type: 'UX', verificationStrategy: 'Manual', confidence: 'HIGH' },
        ],
        issueTitle: 'Improve search and filter discoverability in signal lists',
        issueBody: 'Search and filter controls should be visible.',
        issueLabels: [{ name: 'ui' }],
        dependencyConfig: {
          framework: 'Next.js',
          language: 'TypeScript',
          packageManager: 'npm',
          runtime: 'Node.js',
          majorDependencies: [],
          testFramework: 'Vitest',
          lintTooling: 'ESLint',
          buildTooling: 'Vite',
          ciSystem: 'GitHub Actions',
          externalConfiguration: [],
          scripts: {},
        },
      });

      const portfolioChange = changes.find((c) => c.targetFile.includes('PortfolioEmptyState.tsx'));
      expect(portfolioChange).toBeDefined();
      expect(portfolioChange?.changeRole).toBe('INSPECTION_ONLY');
      expect(portfolioChange?.existingBehavior).toContain('portfolio allocation and PnL metrics');
      expect(portfolioChange?.specificChange).toContain('zero modifications required');

      const sortChange = changes.find((c) => c.targetFile.includes('SignalSortControls.tsx'));
      expect(sortChange).toBeDefined();
      expect(sortChange?.existingBehavior).toContain('segmented control buttons for feed sort ordering');
      expect(sortChange?.existingBehavior).toContain('Does not render signal feed items or pagination');
      expect(sortChange?.existingBehavior).toContain('feed sort ordering');
    });
  });

  describe('5. Acceptance Criteria Synthesis & Preservation', () => {
    it('synthesizes exactly 6 criteria from StellarSwipe #657 requirements without manufacturing fake items', () => {
      const issueBody = `
## Issue description
Users need to locate relevant signals quickly, especially as the list grows. The search and filter affordances should be obvious, discoverable, and consistent with the app design language.

## What done looks like
- Search and filter controls are easy to find in the feed UI.
- The active state is visible and understandable.
- Results update quickly without blocking scroll.
- Clear empty or no-results feedback is included.
      `;

      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 657,
        issueTitle: 'Improve search and filter discoverability in signal lists',
        issueBody,
        issueLabels: [{ name: 'ui' }, { name: 'ux' }],
        repositoryAccessStatus: 'public_readable',
        repositoryIntelligence: {
          owner: 'AgesEmpire',
          repo: 'StellarSwipe-FrontEnd',
          defaultBranch: 'main',
          description: '',
          stars: 10,
          forks: 1,
          openIssuesCount: 2,
          isPrivate: false,
          discoveredInstructionFiles: [],
          discoveredInstructions: [],
          workflowFiles: [],
          relevantSourceDirs: ['src'],
          relevantTestDirs: [],
          totalTreeFilesCount: 3,
          sampleTreeFiles: ['src/SignalFeed.tsx'],
          allTreeFiles: ['src/SignalFeed.tsx'],
        },
        dependencyConfig: {
          framework: 'Next.js',
          language: 'TypeScript',
          packageManager: 'npm',
          runtime: 'Node.js',
          majorDependencies: ['next', 'react'],
          testFramework: 'Vitest',
          lintTooling: 'ESLint',
          buildTooling: 'Vite',
          ciSystem: 'GitHub Actions',
          externalConfiguration: [],
          scripts: { test: 'vitest run' },
        },
        rawFiles: {
          'src/SignalFeed.tsx': 'export const SignalFeed = () => <div>Feed</div>;',
        },
      });

      // 4 explicit requirements from "What done looks like" + 1 Vitest test requirement + 1 ESLint lint requirement = 6
      expect(analysis.acceptanceCriteria.length).toBe(6);
      expect(analysis.acceptanceCriteria[0].description).toBe('Search and filter controls are easy to find in the feed UI.');
      expect(analysis.acceptanceCriteria[1].description).toBe('The active state is visible and understandable.');
      expect(analysis.acceptanceCriteria[2].description).toBe('Results update quickly without blocking scroll.');
      expect(analysis.acceptanceCriteria[3].description).toBe('Clear empty or no-results feedback is included.');
      expect(analysis.acceptanceCriteria[4].type).toBe('TEST');
      expect(analysis.acceptanceCriteria[5].type).toBe('LINT');
    });

    it('preserves previously validated acceptance criteria when an incomplete run produces fewer criteria', () => {
      const previouslyValidated: AcceptanceCriterion[] = [
        { id: 'AC-01', description: 'Search and filter controls are easy to find in the feed UI.', source: 'ISSUE', type: 'UX', verificationStrategy: 'Test', confidence: 'HIGH' },
        { id: 'AC-02', description: 'The active state is visible and understandable.', source: 'ISSUE', type: 'UX', verificationStrategy: 'Test', confidence: 'HIGH' },
        { id: 'AC-03', description: 'Results update quickly without blocking scroll.', source: 'ISSUE', type: 'UX', verificationStrategy: 'Test', confidence: 'HIGH' },
        { id: 'AC-04', description: 'Clear empty or no-results feedback is included.', source: 'ISSUE', type: 'UX', verificationStrategy: 'Test', confidence: 'HIGH' },
        { id: 'AC-05', description: 'Run Vitest test suite covering modified routines.', source: 'EXISTING_TEST', type: 'TEST', verificationStrategy: 'Test', confidence: 'HIGH' },
        { id: 'AC-06', description: 'Pass repository ESLint check without regressions.', source: 'REPOSITORY_DOCUMENTATION', type: 'LINT', verificationStrategy: 'Test', confidence: 'HIGH' },
      ];

      // A degraded run with an empty body that would only produce 1 criterion
      const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
        issueNumber: 657,
        issueTitle: 'Improve search and filter discoverability in signal lists',
        issueBody: '', // Empty or corrupted body
        issueLabels: [],
        repositoryAccessStatus: 'public_readable',
        repositoryIntelligence: {
          owner: 'AgesEmpire',
          repo: 'StellarSwipe-FrontEnd',
          defaultBranch: 'main',
          description: '',
          stars: 1,
          forks: 0,
          openIssuesCount: 1,
          isPrivate: false,
          discoveredInstructionFiles: [],
          discoveredInstructions: [],
          workflowFiles: [],
          relevantSourceDirs: ['src'],
          relevantTestDirs: [],
          totalTreeFilesCount: 1,
          sampleTreeFiles: ['src/SignalFeed.tsx'],
          allTreeFiles: ['src/SignalFeed.tsx'],
        },
        dependencyConfig: {
          framework: 'None / framework-agnostic',
          language: 'Unknown',
          packageManager: 'Unknown',
          runtime: 'Node.js',
          majorDependencies: [],
          testFramework: 'None detected',
          lintTooling: 'None detected',
          buildTooling: 'None detected',
          ciSystem: 'None detected',
          externalConfiguration: [],
          scripts: {},
        },
        previousAcceptanceCriteria: previouslyValidated,
        rawFiles: {
          'src/SignalFeed.tsx': 'export const SignalFeed = () => <div>Feed</div>;',
        },
      });

      // The 6 previously validated criteria are preserved intact!
      expect(analysis.acceptanceCriteria.length).toBe(6);
      expect(analysis.acceptanceCriteria).toEqual(previouslyValidated);
    });
  });
});
