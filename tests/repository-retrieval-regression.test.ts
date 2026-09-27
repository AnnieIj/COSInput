import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeParseResponse } from '../server/responseUtils';
import { githubServerClient } from '../server/githubClient';
import { repositoryIntelligenceService } from '../server/repositoryIntelligenceService';
import { issueAnalysisService } from '../server/issueAnalysisService';
import { contributionSessionStore } from '../server/contributionSessionStore';
import * as githubAppAuth from '../server/githubAppAuth';
import * as config from '../server/config';
import type { VerifiedRepositorySnapshot } from '../server/types';

describe('COSInput v0.3 — Repository Retrieval & Public Inspection Regressions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Valid recursive Git tree response with 600+ files', async () => {
    // Generate mock tree of 659 files similar to AgesEmpire/StellarSwipe-FrontEnd
    const mockTreeItems = Array.from({ length: 659 }, (_, i) => ({
      path: `src/components/module_${i}/Component_${i}.tsx`,
      mode: '100644',
      type: 'blob',
      sha: `sha_hash_${i}`,
      size: 1024 + i,
    }));

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sha: 'root_tree_sha_123',
          truncated: false,
          tree: mockTreeItems,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const result = await githubServerClient.getRepositoryTree(
      null,
      'AgesEmpire',
      'StellarSwipe-FrontEnd',
      'main',
      'test-token'
    );

    expect(result.tree.length).toBe(659);
    expect(result.truncated).toBe(false);
    expect(result.isEmptyRepository).toBe(false);
    expect(result.tree[0].path).toBe('src/components/module_0/Component_0.tsx');
    expect(result.tree[658].path).toBe('src/components/module_658/Component_658.tsx');
  });

  it('2. Git tree response parsing after safeParseResponse', async () => {
    const rawTree = {
      sha: 'master_tree_sha',
      tree: [
        { path: 'package.json', mode: '100644', type: 'blob', sha: 'sha_pkg', size: 500 },
        { path: 'src', mode: '040000', type: 'tree', sha: 'sha_src' },
        { path: 'src/index.tsx', mode: '100644', type: 'blob', sha: 'sha_idx', size: 1200 },
      ],
      truncated: false,
    };

    const response = new Response(JSON.stringify(rawTree), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const parsed = await safeParseResponse<any>(response);
    expect(parsed.ok).toBe(true);
    expect(parsed.isJson).toBe(true);
    expect(Array.isArray(parsed.json.tree)).toBe(true);
    expect(parsed.json.tree.length).toBe(3);
    expect(response.bodyUsed).toBe(true);
  });

  it('3. Public repository inspection without upstream App installation uses effective token', async () => {
    // Mock configured GitHub App with active installation
    vi.spyOn(config, 'getGitHubAppConfig').mockReturnValue({
      appId: '5071869',
      appSlug: 'cosinput-bot',
      clientId: 'Iv1.test',
      clientSecret: 'secret',
      webhookSecret: 'whsec',
      privateKey: 'dummy',
      privateKeyObject: {} as any,
      isConfigured: true,
    });

    vi.spyOn(githubServerClient, 'listInstallations').mockResolvedValueOnce([
      {
        id: 164759349,
        accountLogin: 'AnnieIj',
        accountAvatarUrl: 'https://avatars.githubusercontent.com/u/168873935?v=4',
        accountType: 'User',
        repositorySelection: 'all',
        suspendedAt: null,
        createdAt: '2026-09-25T09:50:44.000Z',
        updatedAt: '2026-09-25T10:02:29.000Z',
      },
    ]);

    vi.spyOn(githubAppAuth, 'getInstallationAccessToken').mockResolvedValueOnce('ghs_active_token_123');

    // Call getEffectiveToken with installationId: null (uninstalled upstream repo)
    const effectiveToken = await githubServerClient.getEffectiveToken(null);
    expect(effectiveToken).toBe('ghs_active_token_123');
  });

  it('4. package.json retrieval and framework detection', async () => {
    const rawFiles: Record<string, string> = {
      'package.json': JSON.stringify({
        name: 'stellarswipe-frontend',
        version: '0.1.0',
        dependencies: {
          next: '14.2.14',
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
        devDependencies: {
          typescript: '^5.6.2',
          vitest: '^2.1.1',
          eslint: '^8.57.0',
        },
        scripts: {
          dev: 'next dev',
          build: 'next build',
          test: 'vitest run',
          lint: 'eslint .',
        },
      }),
    };

    const tree = [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'vitest.config.ts',
      '.eslintrc.json',
      'src/app/page.tsx',
    ];

    const detected = repositoryIntelligenceService.analyzeDependenciesAndConfig(rawFiles, tree, []);
    expect(detected.framework).toBe('Next.js');
    expect(detected.language).toBe('TypeScript');
    expect(detected.packageManager).toBe('npm');
    expect(detected.testFramework).toBe('Vitest');
    expect(detected.lintTooling).toBe('ESLint');
  });

  it('5. Issue Markdown acceptance-criteria extraction from "What done looks like"', () => {
    const issueTitle = 'Improve search and filter discoverability in signal lists';
    const issueBody = `## Issue description
Users need to locate relevant signals quickly, especially as the list grows. The search and filter affordances should be obvious, discoverable, and consistent with the app design language.

## What done looks like
- Search and filter controls are easy to find in the feed UI.
- The active state is visible and understandable.
- Results update quickly without blocking scroll.
- Clear empty or no-results feedback is included.`;

    const dependencyConfig = {
      framework: 'Next.js',
      language: 'TypeScript',
      packageManager: 'npm',
      runtime: 'Node.js',
      majorDependencies: ['next', 'react'],
      testFramework: 'Vitest',
      lintTooling: 'ESLint',
      buildTooling: 'Next.js',
      ciSystem: 'None detected',
      externalConfiguration: [],
    };

    const tree = [
      'src/components/SignalList.tsx',
      'src/components/SignalFeed.tsx',
      'src/components/SignalEmptyState.tsx',
      'src/tests/SignalList.test.tsx',
      'package.json',
    ];

    const analysis = issueAnalysisService.runGroundedSemanticAnalysis({
      issueNumber: 657,
      issueTitle,
      issueBody,
      issueLabels: [{ name: 'Frontend' }],
      repositoryIntelligence: {
        owner: 'AgesEmpire',
        repo: 'StellarSwipe-FrontEnd',
        defaultBranch: 'main',
        description: 'StellarSwipe FrontEnd',
        stars: 10,
        forks: 2,
        openIssuesCount: 5,
        isPrivate: false,
        discoveredInstructionFiles: ['package.json'],
        discoveredInstructions: [],
        workflowFiles: [],
        relevantSourceDirs: ['src/components'],
        relevantTestDirs: ['src/tests'],
        totalTreeFilesCount: tree.length,
        sampleTreeFiles: tree,
        allTreeFiles: tree,
      },
      dependencyConfig,
      repositoryAccessStatus: 'public_readable',
      rawFiles: {},
    });

    // 4 explicit criteria from "What done looks like" + 1 Vitest + 1 ESLint = exactly 6 criteria
    expect(analysis.acceptanceCriteria.length).toBe(6);
    expect(analysis.acceptanceCriteria[0].description).toBe(
      'Search and filter controls are easy to find in the feed UI.'
    );
    expect(analysis.acceptanceCriteria[1].description).toBe(
      'The active state is visible and understandable.'
    );
    expect(analysis.acceptanceCriteria[2].description).toBe(
      'Results update quickly without blocking scroll.'
    );
    expect(analysis.acceptanceCriteria[3].description).toBe(
      'Clear empty or no-results feedback is included.'
    );
    expect(analysis.acceptanceCriteria[4].description).toContain('Vitest');
    expect(analysis.acceptanceCriteria[5].description).toContain('ESLint');
  });

  it('6. Failed API request must not become an empty repository', async () => {
    // Mock getRepositoryDetails failure with RATE_LIMIT (403)
    vi.spyOn(githubServerClient, 'getRepositoryDetails').mockRejectedValueOnce({
      classification: 'RATE_LIMIT',
      statusCode: 403,
      message: 'API rate limit exceeded for 34.34.246.106',
      endpointCategory: 'repository_metadata',
    });

    await expect(
      repositoryIntelligenceService.inspectRepository('AgesEmpire', 'StellarSwipe-FrontEnd', null)
    ).rejects.toMatchObject({
      classification: 'RATE_LIMIT',
      statusCode: 403,
      endpointCategory: 'repository_metadata',
    });

    // Mock genuine empty repository (HTTP 409 from GitHub)
    vi.spyOn(githubServerClient, 'getRepositoryDetails').mockResolvedValueOnce({
      default_branch: 'main',
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      isPrivate: false,
    } as any);

    vi.spyOn(githubServerClient, 'getRepositoryTree').mockResolvedValueOnce({
      sha: '',
      truncated: false,
      tree: [],
      isEmptyRepository: true,
    });

    const emptyRepo = await repositoryIntelligenceService.inspectRepository(
      'AgesEmpire',
      'EmptyRepo',
      null
    );
    expect(emptyRepo.repositoryIntelligence.totalTreeFilesCount).toBe(0);
  });

  it('7. Failed retrieval must never produce PLAN_READY and preserves failure status', () => {
    const session = contributionSessionStore.createSession({
      repositoryOwner: 'AgesEmpire',
      repositoryName: 'StellarSwipe-FrontEnd',
      issueNumber: 657,
      issueTitle: 'Test Issue',
      issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/657',
      contributorUsername: 'contributor',
      repositoryAccessStatus: 'public_readable',
    });

    const attemptId = contributionSessionStore.startAnalysisAttempt(session.id);
    const failedSession = contributionSessionStore.failAnalysisAttempt(
      session.id,
      attemptId,
      'API rate limit exceeded on GitHub Git Trees API.'
    );

    expect(failedSession.currentAttemptStatus).toBe('FAILED');
    expect(failedSession.analysisStatus).toBe('FAILED');
    expect(failedSession.analysisStatus).not.toBe('PLAN_READY');
    expect(failedSession.implementationPlan).toBeNull();
    expect(failedSession.errorMessage).toContain('API rate limit exceeded');
  });

  it('8. Historical verified metadata must not be presented as current', () => {
    const historicalSnapshot: VerifiedRepositorySnapshot = {
      timestamp: '2026-09-25T10:00:00.000Z',
      repositoryIntelligence: {
        owner: 'AgesEmpire',
        repo: 'StellarSwipe-FrontEnd',
        defaultBranch: 'main',
        description: 'Historical snapshot repo',
        stars: 42,
        forks: 5,
        openIssuesCount: 3,
        isPrivate: false,
        discoveredInstructionFiles: ['package.json'],
        discoveredInstructions: [],
        workflowFiles: [],
        relevantSourceDirs: ['src'],
        relevantTestDirs: ['tests'],
        totalTreeFilesCount: 659,
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
        buildTooling: 'Next.js',
        ciSystem: 'GitHub Actions',
        externalConfiguration: [],
      },
      status: 'verified',
    };

    const session = contributionSessionStore.createSession({
      repositoryOwner: 'AgesEmpire',
      repositoryName: 'StellarSwipe-FrontEnd',
      issueNumber: 657,
      issueTitle: 'Test Issue',
      issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/657',
      contributorUsername: 'contributor',
      repositoryAccessStatus: 'public_readable',
    });

    // Attach historical verified snapshot
    contributionSessionStore.updateSession(session.id, {
      lastVerifiedSnapshot: historicalSnapshot,
    });

    // Start a new attempt and fail it
    const attemptId = contributionSessionStore.startAnalysisAttempt(session.id);
    const updated = contributionSessionStore.failAnalysisAttempt(
      session.id,
      attemptId,
      'Network timeout contacting GitHub API.'
    );

    // Current attempt is FAILED and plan is null
    expect(updated.currentAttemptStatus).toBe('FAILED');
    expect(updated.implementationPlan).toBeNull();
    expect(updated.analysisStatus).toBe('FAILED');

    // Historical snapshot remains preserved as historical record, but is not the active current plan
    expect(updated.lastVerifiedSnapshot).toBeDefined();
    expect(updated.lastVerifiedSnapshot?.status).toBe('verified');
    expect(updated.lastVerifiedSnapshot?.timestamp).toBe('2026-09-25T10:00:00.000Z');
  });

  it('9. Approval remains disabled when inspection fails', () => {
    const session = contributionSessionStore.createSession({
      repositoryOwner: 'AgesEmpire',
      repositoryName: 'StellarSwipe-FrontEnd',
      issueNumber: 657,
      issueTitle: 'Test Issue',
      issueUrl: 'https://github.com/AgesEmpire/StellarSwipe-FrontEnd/issues/657',
      contributorUsername: 'contributor',
      repositoryAccessStatus: 'public_readable',
    });

    const attemptId = contributionSessionStore.startAnalysisAttempt(session.id);
    const failedSession = contributionSessionStore.failAnalysisAttempt(
      session.id,
      attemptId,
      'GitHub rate limit encountered during tree inspection.'
    );

    expect(failedSession.humanApproval.status).toBe('pending');
    expect(failedSession.analysisStatus).toBe('FAILED');
    expect(failedSession.implementationPlan).toBeNull();

    // Trying to commit on a failed attempt throws or fails
    expect(() =>
      contributionSessionStore.commitAnalysisAttempt(session.id, 'old-attempt', {} as any)
    ).toThrow();
  });
});
