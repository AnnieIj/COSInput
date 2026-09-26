/**
 * COSInput Foundation v0.3 — Repository Intelligence Service
 * Performs read-only progressive inspection of public or GitHub App authorized repositories.
 * Extracts metadata, git tree structure, contributor instructions (AGENTS.md, CONTRIBUTING.md),
 * manifests, configs, and dependency landscapes without modifying GitHub.
 */

import { githubServerClient } from './githubClient';
import { userAuthStore } from './userAuthStore';
import type {
  RepositoryIntelligenceData,
  RepositoryInstructionItem,
  DependencyConfigAnalysis,
  ExternalConfigurationItem,
  SanitizedGitHubError,
} from './types';

export class RepositoryIntelligenceService {
  /**
   * Inspects a repository safely and progressively.
   */
  async inspectRepository(
    owner: string,
    repo: string,
    installationId?: number | null
  ): Promise<{
    repositoryIntelligence: RepositoryIntelligenceData;
    dependencyConfig: DependencyConfigAnalysis;
    rawFiles: Record<string, string>;
  }> {
    const bearerToken = userAuthStore.getUserToken() || undefined;

    // 1. Fetch Repository Metadata
    const repoDetails = await githubServerClient.getRepositoryDetails(
      installationId,
      owner,
      repo,
      bearerToken
    );

    const defaultBranch = repoDetails.defaultBranch || 'main';

    // 2. Fetch Git Tree (recursive, safe)
    let treeFiles: { path: string; type: string; size?: number }[] = [];
    try {
      const treeData = await githubServerClient.getRepositoryTree(
        installationId,
        owner,
        repo,
        defaultBranch,
        bearerToken
      );
      treeFiles = treeData.tree || [];
    } catch {
      // If recursive tree fails (e.g. repo too large or 409 empty), try directory listing of root
      try {
        const rootItems = await githubServerClient.getDirectoryContents(
          installationId,
          owner,
          repo,
          '',
          defaultBranch,
          bearerToken
        );
        treeFiles = rootItems.map((item) => ({
          path: item.path,
          type: item.type === 'dir' ? 'tree' : 'blob',
          size: item.size,
        }));
      } catch {
        treeFiles = [];
      }
    }

    const allFilePaths = treeFiles.map((f) => f.path);
    const blobPaths = treeFiles.filter((f) => f.type === 'blob').map((f) => f.path);

    // 3. Identify Candidate Instruction & Config Files in Tree
    const candidatePaths = [
      'AGENTS.md',
      '.github/AGENTS.md',
      'CONTRIBUTING.md',
      '.github/CONTRIBUTING.md',
      'docs/CONTRIBUTING.md',
      'README.md',
      'README.txt',
      'CODE_OF_CONDUCT.md',
      '.github/pull_request_template.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
      'package.json',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'Cargo.toml',
      'pyproject.toml',
      'requirements.txt',
      'go.mod',
      'pom.xml',
      'tsconfig.json',
      'vite.config.ts',
      'vite.config.js',
      'webpack.config.js',
      'vitest.config.ts',
      'jest.config.js',
      'Makefile',
      '.env.example',
      '.env.sample',
    ];

    // Select existing candidate files from tree
    const matchingPaths = candidatePaths.filter((cand) =>
      blobPaths.some((p) => p.toLowerCase() === cand.toLowerCase())
    );

    // Also pick up workflow files: .github/workflows/*.yml or *.yaml
    const workflowFiles = blobPaths.filter(
      (p) => p.startsWith('.github/workflows/') && (p.endsWith('.yml') || p.endsWith('.yaml'))
    );

    // Read top candidate files (limit to at most 10 critical files to respect rate limits)
    const filesToRead = matchingPaths.slice(0, 10);
    const rawFiles: Record<string, string> = {};

    for (const filePath of filesToRead) {
      try {
        const fileContent = await githubServerClient.getFileContent(
          installationId,
          owner,
          repo,
          filePath,
          defaultBranch,
          bearerToken
        );
        rawFiles[filePath] = fileContent.content || '';
      } catch {
        // Continue if a specific file cannot be read
      }
    }

    // 4. Discover Repository Instructions
    const discoveredInstructions: RepositoryInstructionItem[] = this.parseInstructions(rawFiles);

    // 5. Detect Relevant Source & Test Directories
    const relevantSourceDirs = this.detectSourceDirs(allFilePaths);
    const relevantTestDirs = this.detectTestDirs(allFilePaths);

    // 6. Analyze Dependency & Configuration Landscape
    const dependencyConfig = this.analyzeDependenciesAndConfig(rawFiles, blobPaths, workflowFiles);

    const repositoryIntelligence: RepositoryIntelligenceData = {
      owner,
      repo,
      defaultBranch,
      description: repoDetails.description || '',
      stars: repoDetails.stars || 0,
      forks: repoDetails.forks || 0,
      openIssuesCount: repoDetails.openIssuesCount || 0,
      isPrivate: repoDetails.isPrivate,
      discoveredInstructionFiles: Object.keys(rawFiles),
      discoveredInstructions,
      workflowFiles,
      relevantSourceDirs,
      relevantTestDirs,
      totalTreeFilesCount: blobPaths.length,
      sampleTreeFiles: blobPaths.slice(0, 100),
      allTreeFiles: blobPaths,
    };

    return {
      repositoryIntelligence,
      dependencyConfig,
      rawFiles,
    };
  }

  /**
   * Discovers and structures contributor instructions from parsed documents.
   * Never invents repository rules.
   */
  parseInstructions(rawFiles: Record<string, string>): RepositoryInstructionItem[] {
    const instructions: RepositoryInstructionItem[] = [];

    // Check AGENTS.md / CONTRIBUTING.md / README.md
    for (const [filePath, content] of Object.entries(rawFiles)) {
      if (!content) continue;
      const lowerPath = filePath.toLowerCase();

      // Look for AGENTS.md
      if (lowerPath.includes('agents.md')) {
        instructions.push({
          category: 'coding_conventions',
          title: 'Autonomous Agent Directives (AGENTS.md)',
          details: this.extractFirstMeaningfulSection(content, 300),
          sourceFile: filePath,
        });
      }

      // Look for CONTRIBUTING.md
      if (lowerPath.includes('contributing.md')) {
        instructions.push({
          category: 'pr_expectations',
          title: 'Repository Contribution Guidelines',
          details: this.extractFirstMeaningfulSection(content, 350),
          sourceFile: filePath,
        });

        if (content.toLowerCase().includes('test') || content.toLowerCase().includes('npm test')) {
          instructions.push({
            category: 'testing_requirements',
            title: 'Contributor Test Verification Mandate',
            details: 'Tests must pass locally before pull request submission per repository guidelines.',
            sourceFile: filePath,
          });
        }
      }

      // Check package.json scripts for repository commands
      if (lowerPath === 'package.json') {
        try {
          const pkg = JSON.parse(content);
          if (pkg.scripts) {
            const cmdList = Object.entries(pkg.scripts)
              .map(([name, cmd]) => `npm run ${name} -> ${cmd}`)
              .join('\n');
            instructions.push({
              category: 'repository_commands',
              title: 'Configured NPM Scripts',
              details: cmdList,
              sourceFile: 'package.json',
            });
          }
        } catch {
          // ignore json parse error
        }
      }
    }

    return instructions;
  }

  /**
   * Analyzes dependencies, frameworks, test tools, and required external configurations.
   */
  analyzeDependenciesAndConfig(
    rawFiles: Record<string, string>,
    allBlobPaths: string[],
    workflowFiles: string[]
  ): DependencyConfigAnalysis {
    let framework = 'None / framework-agnostic';
    let language = 'Unknown';
    let packageManager = 'Unknown';
    let runtime = 'Node.js';
    const majorDependencies: string[] = [];
    let testFramework = 'None detected';
    let lintTooling = 'None detected';
    let buildTooling = 'None detected';
    let ciSystem = workflowFiles.length > 0 ? 'GitHub Actions' : 'None detected';
    const externalConfiguration: ExternalConfigurationItem[] = [];
    let scripts: Record<string, string> = {};

    // Parse package.json if present
    const pkgContent = rawFiles['package.json'];
    if (pkgContent) {
      try {
        const pkg = JSON.parse(pkgContent);
        if (pkg.scripts && typeof pkg.scripts === 'object') {
          scripts = { ...pkg.scripts };
        }
        packageManager = allBlobPaths.includes('pnpm-lock.yaml')
          ? 'pnpm'
          : allBlobPaths.includes('yarn.lock')
          ? 'yarn'
          : 'npm';

        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const depKeys = Object.keys(deps);

        // Comprehensive backend and frontend framework detection
        if (depKeys.includes('@nestjs/core') || depKeys.includes('@nestjs/common')) {
          framework = 'NestJS';
        } else if (depKeys.includes('fastify')) {
          framework = 'Fastify';
        } else if (depKeys.includes('koa')) {
          framework = 'Koa';
        } else if (depKeys.includes('hono')) {
          framework = 'Hono';
        } else if (depKeys.includes('express')) {
          framework = 'Express';
        } else if (depKeys.includes('@adonisjs/core')) {
          framework = 'AdonisJS';
        } else if (depKeys.includes('elysia')) {
          framework = 'Elysia';
        } else if (depKeys.includes('@trpc/server')) {
          framework = 'tRPC';
        } else if (depKeys.includes('next')) {
          framework = 'Next.js';
        } else if (depKeys.includes('nuxt')) {
          framework = 'Nuxt';
        } else if (depKeys.includes('@remix-run/react') || depKeys.includes('@remix-run/node')) {
          framework = 'Remix';
        } else if (depKeys.includes('@sveltejs/kit')) {
          framework = 'SvelteKit';
        } else if (depKeys.includes('astro')) {
          framework = 'Astro';
        } else if (depKeys.includes('react')) {
          framework = 'React';
        } else if (depKeys.includes('vue')) {
          framework = 'Vue.js';
        } else if (depKeys.includes('@angular/core')) {
          framework = 'Angular';
        } else if (depKeys.includes('svelte')) {
          framework = 'Svelte';
        } else {
          framework = 'None / framework-agnostic';
        }

        if (depKeys.includes('typescript') || allBlobPaths.some((p) => p.endsWith('.ts') || p.endsWith('.tsx'))) {
          language = 'TypeScript';
        } else if (allBlobPaths.some((p) => p.endsWith('.js') || p.endsWith('.jsx'))) {
          language = 'JavaScript';
        }

        if (depKeys.includes('vitest')) testFramework = 'Vitest';
        else if (depKeys.includes('jest')) testFramework = 'Jest';
        else if (depKeys.includes('mocha')) testFramework = 'Mocha';
        else if (depKeys.includes('@playwright/test')) testFramework = 'Playwright';

        if (depKeys.includes('eslint')) lintTooling = 'ESLint';
        if (depKeys.includes('biome') || depKeys.includes('@biomejs/biome')) lintTooling = 'Biome';

        if (depKeys.includes('vite')) buildTooling = 'Vite';
        else if (depKeys.includes('webpack')) buildTooling = 'Webpack';
        else if (depKeys.includes('esbuild')) buildTooling = 'esbuild';
        else if (depKeys.includes('tsup')) buildTooling = 'tsup';

        majorDependencies.push(...depKeys.slice(0, 20));
      } catch {
        // Ignore
      }
    } else if (allBlobPaths.some((p) => p.endsWith('Cargo.toml'))) {
      language = 'Rust';
      packageManager = 'Cargo';
      runtime = 'Rust Native';
      buildTooling = 'cargo build';
      testFramework = 'cargo test';
      if (allBlobPaths.some((p) => p.includes('actix'))) framework = 'Actix-web';
      else if (allBlobPaths.some((p) => p.includes('axum'))) framework = 'Axum';
      else if (allBlobPaths.some((p) => p.includes('rocket'))) framework = 'Rocket';
      else framework = 'None / framework-agnostic';
    } else if (allBlobPaths.some((p) => p.endsWith('pyproject.toml') || p.endsWith('requirements.txt'))) {
      language = 'Python';
      packageManager = 'pip / poetry';
      runtime = 'Python 3';
      testFramework = 'pytest';
      framework = 'None / framework-agnostic';
    }

    // Inspect .env.example for required external configuration
    const envExample = rawFiles['.env.example'] || rawFiles['.env.sample'];
    if (envExample) {
      const lines = envExample.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key] = trimmed.split('=');
          const cleanKey = key.trim();
          if (cleanKey) {
            const isSecret = /KEY|SECRET|TOKEN|PASSWORD|AUTH/i.test(cleanKey);
            const isEndpoint = /URL|HOST|ENDPOINT|PORT|API/i.test(cleanKey);
            externalConfiguration.push({
              name: cleanKey,
              category: isSecret ? 'secret' : isEndpoint ? 'service_endpoint' : 'env_var',
              status: 'detected',
              description: `Configuration variable declared in repository .env.example`,
            });
          }
        }
      }
    }

    return {
      framework,
      language,
      packageManager,
      runtime,
      majorDependencies,
      testFramework,
      lintTooling,
      buildTooling,
      ciSystem,
      externalConfiguration,
      scripts,
    };
  }

  private detectSourceDirs(paths: string[]): string[] {
    const dirs = new Set<string>();
    for (const p of paths) {
      const parts = p.split('/');
      if (parts.length > 1) {
        const top = parts[0];
        if (['src', 'lib', 'app', 'packages', 'client', 'server', 'core', 'components'].includes(top)) {
          dirs.add(top);
        }
      }
    }
    return Array.from(dirs);
  }

  private detectTestDirs(paths: string[]): string[] {
    const dirs = new Set<string>();
    for (const p of paths) {
      const parts = p.split('/');
      if (parts.length > 1) {
        const top = parts[0];
        if (['tests', 'test', 'spec', '__tests__', 'e2e'].includes(top)) {
          dirs.add(top);
        }
      }
    }
    return Array.from(dirs);
  }

  private extractFirstMeaningfulSection(content: string, maxLen = 300): string {
    const cleaned = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))
      .join(' ');
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.substring(0, maxLen).trim() + '...';
  }
}

export const repositoryIntelligenceService = new RepositoryIntelligenceService();
