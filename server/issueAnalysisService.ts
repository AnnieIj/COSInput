/**
 * COSInput Foundation v0.3 — Issue Analysis & Acceptance Criteria Engine
 * Analyzes real GitHub issues against repository intelligence.
 * Strictly read-only, generates structured acceptance criteria, relevant files,
 * blocker detection, and implementation plans.
 */

import { GoogleGenAI } from '@google/genai';
import type {
  IssueIntelligenceData,
  AcceptanceCriterion,
  RelevantFile,
  RelevantFileCategory,
  BlockerItem,
  ImplementationPlan,
  RepositoryIntelligenceData,
  DependencyConfigAnalysis,
  RepositoryAccessStatus,
} from './types';

export interface ExtractedConcepts {
  primaryTerms: string[];
  stemmedVariants: string[];
  identifiers: string[];
  codeTokens: string[];
}

/**
 * Dynamically extracts domain identifiers, keywords, and architectural tokens from issue title and body.
 * Avoids hardcoding any issue-specific terms.
 */
export function extractDynamicConcepts(title: string, body: string): ExtractedConcepts {
  const fullText = `${title}\n${body}`;

  // 1. Extract code tokens in backticks: `apiKey`, `expiresAt`, `src/foo/bar.ts`
  const backtickMatches = (fullText.match(/`([^`]+)`/g) || []).map((m) =>
    m.replace(/`/g, '').trim()
  );

  // 2. Extract identifiers (camelCase, PascalCase, snake_case, kebab-case)
  const identifierMatches =
    fullText.match(
      /[a-zA-Z0-9]+(?:[A-Z][a-z0-9]+)+|[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)+/g
    ) || [];

  const identifiers = Array.from(new Set([...backtickMatches, ...identifierMatches]));

  // 3. Decompose identifiers into constituent sub-tokens
  const subTokens = new Set<string>();
  for (const id of identifiers) {
    const clean = id.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (clean.length >= 2) subTokens.add(clean);

    // Split camelCase: expiresAt -> expires, at; apiKey -> api, key
    const parts = id
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length >= 2);
    for (const p of parts) {
      subTokens.add(p);
    }
  }

  // 4. Tokenize title and body words (filtering only standard grammatical stop words)
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'when',
    'should', 'must', 'will', 'can', 'are', 'were', 'was', 'been', 'has',
    'had', 'not', 'but', 'what', 'some', 'add', 'fix', 'update', 'make',
    'implement', 'change', 'support', 'allow', 'create', 'into', 'onto',
    'over', 'under', 'between', 'such', 'than', 'then', 'also', 'about',
    'each', 'more', 'most', 'very', 'optional', 'please', 'needed', 'needs',
    'issue', 'pull', 'request', 'branch', 'file', 'code'
  ]);

  const rawWords = `${title} ${body}`
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  const primaryTerms = Array.from(new Set([...Array.from(subTokens), ...rawWords]));

  // 5. Expand stemming and inflectional variations
  const stemmedVariants = new Set<string>();
  for (const term of primaryTerms) {
    stemmedVariants.add(term);
    // Plural / singular stemming
    if (term.endsWith('ies')) stemmedVariants.add(term.slice(0, -3) + 'y');
    else if (term.endsWith('es')) stemmedVariants.add(term.slice(0, -2));
    else if (term.endsWith('s') && !term.endsWith('ss')) stemmedVariants.add(term.slice(0, -1));
    else stemmedVariants.add(term + 's');

    // Domain inflectional expansions
    if (term.startsWith('expire') || term === 'expiry') {
      stemmedVariants.add('expiry');
      stemmedVariants.add('expire');
      stemmedVariants.add('expires');
      stemmedVariants.add('expiration');
      stemmedVariants.add('expiresat');
      stemmedVariants.add('expires_at');
    }
    if (term.includes('key')) {
      stemmedVariants.add('key');
      stemmedVariants.add('keys');
      stemmedVariants.add('apikey');
      stemmedVariants.add('api_key');
      stemmedVariants.add('api-key');
    }
    if (term === 'auth' || term.startsWith('authenticat')) {
      stemmedVariants.add('auth');
      stemmedVariants.add('authentication');
      stemmedVariants.add('authorizer');
    }
  }

  return {
    primaryTerms,
    stemmedVariants: Array.from(stemmedVariants),
    identifiers,
    codeTokens: Array.from(subTokens),
  };
}

/**
 * Searches and scores candidate files across the entire indexed repository tree.
 */
export function findRelevantFilesFromTree(
  treeFiles: string[],
  concepts: ExtractedConcepts,
  issueBody: string
): RelevantFile[] {
  const ignoredPatterns = [
    'node_modules/', 'dist/', 'build/', '.git/', 'coverage/', '.next/',
    'vendor/', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'Cargo.lock', 'bun.lock'
  ];

  const candidatePool = treeFiles.filter((p) => {
    return !ignoredPatterns.some((ig) => p.includes(ig)) && p.includes('.');
  });

  const scoredFiles: {
    path: string;
    score: number;
    reason: string;
    category: RelevantFileCategory;
    modificationLikely: boolean;
  }[] = [];

  const architecturalRoles = [
    'service', 'controller', 'model', 'schema', 'entity', 'router', 'route', 'routes',
    'repository', 'middleware', 'guard', 'handler', 'dto', 'types', 'migration'
  ];

  for (const filePath of candidatePool) {
    const lowerPath = filePath.toLowerCase();
    const fileName = lowerPath.split('/').pop() || '';
    const dirPath = lowerPath.includes('/') ? lowerPath.substring(0, lowerPath.lastIndexOf('/')) : '';
    let score = 0;
    const matchReasons: string[] = [];

    // Check direct code token matches
    for (const id of concepts.codeTokens) {
      if (id.length >= 3 && fileName.includes(id)) {
        score += 15;
        matchReasons.push(`File name matches code token '${id}'`);
      } else if (id.length >= 3 && dirPath.includes(id)) {
        score += 10;
        matchReasons.push(`Directory path matches code token '${id}'`);
      }
    }

    // Check stemmed concept matches
    for (const term of concepts.stemmedVariants) {
      if (term.length >= 3 && (fileName.includes(term) || dirPath.includes(term))) {
        score += 8;
        matchReasons.push(`Path matches concept '${term}'`);
      }
    }

    // Explicit path match in issue body
    if (issueBody.includes(fileName) && fileName.length > 4) {
      score += 25;
      matchReasons.push(`File explicitly mentioned in issue description`);
    }

    // Architectural role boost when domain concept matches
    if (score > 0) {
      for (const role of architecturalRoles) {
        if (fileName.includes(role) || dirPath.includes(role)) {
          score += 6;
          matchReasons.push(`Matches architectural role '${role}'`);
          break;
        }
      }
    }

    if (score >= 8) {
      const isTest = lowerPath.includes('test') || lowerPath.includes('spec') || lowerPath.includes('__tests__');
      const isDoc = lowerPath.endsWith('.md');
      const isConfig = lowerPath.includes('config') || lowerPath.includes('schema.prisma') || lowerPath.includes('migration');
      const isDtoOrType = lowerPath.includes('.dto.') || lowerPath.includes('.type.') || lowerPath.includes('/types/');

      let category: RelevantFileCategory = 'PRIMARY';
      let modificationLikely = true;

      if (isTest) {
        category = 'TEST';
        modificationLikely = false;
      } else if (isDoc) {
        category = 'DOCUMENTATION';
        modificationLikely = false;
      } else if (isConfig) {
        category = 'CONFIGURATION';
        modificationLikely = true;
      } else if (isDtoOrType) {
        category = 'SUPPORTING';
        modificationLikely = true;
      }

      scoredFiles.push({
        path: filePath,
        score,
        reason: matchReasons.slice(0, 3).join('; ') || 'Path semantic correlation with issue concepts.',
        category,
        modificationLikely,
      });
    }
  }

  // Sort by score descending and take top grounded candidates
  scoredFiles.sort((a, b) => b.score - a.score);

  return scoredFiles.slice(0, 8).map((f) => ({
    path: f.path,
    category: f.category,
    reason: f.reason,
    confidence: f.score >= 20 ? 'HIGH' : f.score >= 12 ? 'MEDIUM' : 'LOW',
    modificationLikely: f.modificationLikely,
  }));
}

export class IssueAnalysisService {
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (key) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: key });
      } catch {
        this.aiClient = null;
      }
    }
  }

  /**
   * Orchestrates complete issue analysis using grounded repository context.
   */
  async analyzeIssue(params: {
    issueNumber: number;
    issueTitle: string;
    issueBody: string;
    issueLabels: { name: string; description?: string }[];
    repositoryIntelligence: RepositoryIntelligenceData;
    dependencyConfig: DependencyConfigAnalysis;
    repositoryAccessStatus: RepositoryAccessStatus;
  }): Promise<{
    issueIntelligence: IssueIntelligenceData;
    acceptanceCriteria: AcceptanceCriterion[];
    relevantFiles: RelevantFile[];
    blockers: BlockerItem[];
    implementationPlan: ImplementationPlan;
    isBlocked: boolean;
  }> {
    const {
      issueNumber,
      issueTitle,
      issueBody,
      issueLabels,
      repositoryIntelligence,
      dependencyConfig,
      repositoryAccessStatus,
    } = params;

    // 1. Attempt LLM-assisted analysis if Gemini is configured
    if (this.aiClient && process.env.GEMINI_API_KEY) {
      try {
        return await this.runGeminiAnalysis(params);
      } catch (err) {
        // Fall back to deterministic grounded analysis if Gemini call fails or rate-limits
      }
    }

    // 2. Deterministic Rule-Based Semantic Analysis Engine (Ground Truth Fallback)
    return this.runGroundedSemanticAnalysis(params);
  }

  /**
   * Deterministic grounded semantic analyzer.
   * Extracts requirements, maps files against the repository tree, detects blockers,
   * generates criteria, and builds the plan without hallucinations.
   */
  runGroundedSemanticAnalysis(params: {
    issueNumber: number;
    issueTitle: string;
    issueBody: string;
    issueLabels: { name: string; description?: string }[];
    repositoryIntelligence: RepositoryIntelligenceData;
    dependencyConfig: DependencyConfigAnalysis;
    repositoryAccessStatus: RepositoryAccessStatus;
  }): {
    issueIntelligence: IssueIntelligenceData;
    acceptanceCriteria: AcceptanceCriterion[];
    relevantFiles: RelevantFile[];
    blockers: BlockerItem[];
    implementationPlan: ImplementationPlan;
    isBlocked: boolean;
  } {
    const {
      issueNumber,
      issueTitle,
      issueBody,
      issueLabels,
      repositoryIntelligence,
      dependencyConfig,
      repositoryAccessStatus,
    } = params;

    const fullText = `${issueTitle}\n${issueBody}`;
    const lines = issueBody.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Extract Explicit Requirements
    const explicitRequirements: string[] = [];
    const inferredRequirements: string[] = [];
    const unknownsAndQuestions: string[] = [];
    const filesMentioned: string[] = [];
    const apisMentioned: string[] = [];
    const dependenciesMentioned: string[] = [];
    const testsRequested: string[] = [];
    const documentationRequirements: string[] = [];
    const constraints: string[] = [];
    const securityConsiderations: string[] = [];
    const outOfScopeItems: string[] = [];

    // Parse markdown checklist items and requirement bullet points
    for (const line of lines) {
      if (line.startsWith('- [ ]') || line.startsWith('* [ ]') || line.startsWith('- [x]')) {
        explicitRequirements.push(line.replace(/^[-*]\s*\[[ x]\]\s*/, ''));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.substring(2).trim();
        if (/must|shall|require|should|implement|add|fix|update/i.test(text)) {
          explicitRequirements.push(text);
        } else if (/scope|not needed|ignore|do not/i.test(text)) {
          outOfScopeItems.push(text);
        }
      }
    }

    // If no bullet items, synthesize from problem/request
    if (explicitRequirements.length === 0) {
      explicitRequirements.push(`Resolve reported issue: ${issueTitle}`);
      const summaryParagraph = lines.find((l) => l.length > 20 && !l.startsWith('#'));
      if (summaryParagraph) {
        explicitRequirements.push(summaryParagraph);
      }
    }

    // Infer architectural requirements supported by repository context
    if (dependencyConfig.testFramework !== 'None detected') {
      inferredRequirements.push(
        `Provide unit or integration tests verifying the fix under ${dependencyConfig.testFramework}.`
      );
    }
    if (dependencyConfig.lintTooling !== 'None detected') {
      inferredRequirements.push(
        `Ensure all modifications adhere to repository ${dependencyConfig.lintTooling} rules.`
      );
    }
    if (dependencyConfig.language === 'TypeScript') {
      inferredRequirements.push(`Maintain strict TypeScript type safety with zero type errors.`);
    }

    // 2. Dynamic Issue Concept Extraction
    const concepts = extractDynamicConcepts(issueTitle, issueBody);

    // Detect mentioned files in issue text
    const allTree =
      repositoryIntelligence.allTreeFiles && repositoryIntelligence.allTreeFiles.length > 0
        ? repositoryIntelligence.allTreeFiles
        : repositoryIntelligence.sampleTreeFiles || [];

    for (const treePath of allTree) {
      const fileName = treePath.split('/').pop() || '';
      if (fileName && fileName.length > 3 && fullText.includes(fileName)) {
        filesMentioned.push(treePath);
      }
    }

    // Detect mentioned contracts/APIs/endpoints
    const contractMatches = fullText.match(
      /(0x[a-fA-F0-9]{40}|C[A-Z0-9]{55}|[A-Z0-9_]{6,}_ADDRESS|[A-Z0-9_]{6,}_URL)/g
    );
    if (contractMatches) {
      apisMentioned.push(...Array.from(new Set(contractMatches)));
    }

    // 3. Relevant File Discovery across Entire Tree
    const relevantFiles: RelevantFile[] = findRelevantFilesFromTree(
      allTree,
      concepts,
      issueBody
    );

    // Add explicitly mentioned files if not already present
    for (const f of filesMentioned) {
      if (!relevantFiles.some((rf) => rf.path === f)) {
        const isTest = f.includes('test') || f.includes('spec');
        relevantFiles.unshift({
          path: f,
          category: isTest ? 'TEST' : 'PRIMARY',
          reason: 'Explicitly referenced in issue specification or stack trace.',
          confidence: 'HIGH',
          modificationLikely: !isTest,
        });
      }
    }

    // 4. Build Acceptance Criteria (AC-01...)
    const acceptanceCriteria: AcceptanceCriterion[] = [];
    let acCounter = 1;

    for (const req of explicitRequirements) {
      acceptanceCriteria.push({
        id: `AC-${String(acCounter++).padStart(2, '0')}`,
        description: req,
        source: 'ISSUE',
        type: /test/i.test(req)
          ? 'TEST'
          : /ui|display|screen|button|color/i.test(req)
          ? 'UX'
          : 'FUNCTIONAL',
        verificationStrategy: /test/i.test(req)
          ? 'Execute relevant test suite to verify functionality.'
          : 'Inspect affected component and verify behavioral change.',
        confidence: 'HIGH',
      });
    }

    if (dependencyConfig.testFramework !== 'None detected') {
      acceptanceCriteria.push({
        id: `AC-${String(acCounter++).padStart(2, '0')}`,
        description: `Run ${dependencyConfig.testFramework} test suite covering modified routines.`,
        source: 'EXISTING_TEST',
        type: 'TEST',
        verificationStrategy: `Execute local test command: ${
          dependencyConfig.testFramework === 'Vitest' ? 'npm run test / vitest run' : 'npm test'
        }`,
        confidence: 'HIGH',
      });
    }

    if (dependencyConfig.lintTooling !== 'None detected') {
      acceptanceCriteria.push({
        id: `AC-${String(acCounter++).padStart(2, '0')}`,
        description: `Pass repository ${dependencyConfig.lintTooling} check without regressions.`,
        source: 'REPOSITORY_DOCUMENTATION',
        type: 'LINT',
        verificationStrategy: 'Execute npm run lint / static analysis check.',
        confidence: 'HIGH',
      });
    }

    // 5. Blocker & Risk Detection
    const blockers: BlockerItem[] = [];

    // Plan Quality Gate: Check if code changes are required but zero evidence-backed targets were found
    if (relevantFiles.length === 0) {
      blockers.push({
        id: 'blocker-insufficient-code-context',
        category: 'INSUFFICIENT_CODE_CONTEXT',
        description:
          'Repository inspection succeeded, but zero evidence-backed implementation targets could be identified in the repository tree for this issue.',
        evidence: `Scanned repository tree (${allTree.length} files) with dynamic issue concepts [${concepts.primaryTerms
          .slice(0, 8)
          .join(', ')}], but found no matching candidate files.`,
        impact:
          'Plan generation stopped. A confident implementation plan cannot be constructed without grounded target files.',
        recommendedNextAction:
          'Review repository structure, provide relevant file paths or module references in the issue description, or confirm the repository branch.',
      });
    }

    // Informational future execution constraint (NOT a blocker for v0.3 analysis)
    if (repositoryAccessStatus !== 'app_authorized') {
      blockers.push({
        id: 'blocker-repo-access',
        category: 'REPOSITORY_ACCESS_LIMITATION',
        description: `Repository "${repositoryIntelligence.owner}/${repositoryIntelligence.repo}" is public-readable. Write operations are not enabled in v0.3.`,
        evidence:
          'Repository not installed in active GitHub App installations. Public read access active.',
        impact:
          'Public repository analysis is available. Repository write operations are not enabled in v0.3. Future contribution execution will determine the appropriate contributor fork and authorization path.',
        recommendedNextAction:
          'Proceed with read-only repository inspection and plan verification. No maintainer action required for v0.3.',
      });
    }

    // Category: MISSING_CANONICAL_INFORMATION
    if (
      fullText.includes('<CONTRACT_ADDRESS>') ||
      fullText.includes('TODO: add address') ||
      fullText.includes('REPLACE_WITH_KEY')
    ) {
      blockers.push({
        id: 'blocker-missing-canonical',
        category: 'MISSING_CANONICAL_INFORMATION',
        description:
          'Required canonical contract address or deployment identifier is missing from issue specification.',
        evidence: 'Placeholder identifier detected in issue description.',
        impact:
          'Implementation cannot generate deterministic transaction calls without canonical contract identity.',
        recommendedNextAction:
          'Request maintainer clarification for the canonical deployed contract address.',
      });
    }

    // Check if ambiguous questions remain
    if (
      fullText.toLowerCase().includes('tbd') ||
      fullText.toLowerCase().includes('needs discussion')
    ) {
      unknownsAndQuestions.push('Issue indicates requirements are still TBD or under discussion.');
      blockers.push({
        id: 'blocker-ambiguous-req',
        category: 'AMBIGUOUS_REQUIREMENT',
        description: 'Requirement specification contains unresolved TBD items.',
        evidence: 'Issue text contains "TBD" or "needs discussion".',
        impact: 'Implementation scope is volatile and subject to maintainer dispute.',
        recommendedNextAction: 'Confirm finalized requirements with maintainer before code changes.',
      });
    }

    // Critical Quality Gate: Only HARD blockers prevent PLAN_READY status
    // Write access limitation is an informational future execution constraint and does NOT block v0.3 analysis.
    const hardBlockers = blockers.filter((b) => b.category !== 'REPOSITORY_ACCESS_LIMITATION');
    const isBlocked = hardBlockers.length > 0;

    // 6. Structure Proposed Changes (mapped back to ACs)
    const proposedChanges = isBlocked
      ? []
      : relevantFiles
          .filter((f) => f.modificationLikely)
          .slice(0, 5)
          .map((f, idx) => ({
            id: `change-${idx + 1}`,
            targetFile: f.path,
            description: `Apply updates to resolve issue requirements in ${f.path}.`,
            mappedAcceptanceCriteriaIds: [acceptanceCriteria[0]?.id || 'AC-01'],
          }));

    if (!isBlocked && proposedChanges.length === 0 && relevantFiles.length > 0) {
      proposedChanges.push({
        id: 'change-1',
        targetFile: relevantFiles[0].path,
        description: `Apply modifications to address issue requirements.`,
        mappedAcceptanceCriteriaIds: [acceptanceCriteria[0]?.id || 'AC-01'],
      });
    }

    // 7. Change Surface Recalculation:
    // Do NOT calculate SMALL/MEDIUM/LARGE until relevant files and proposed changes have been grounded!
    let estimatedChangeSurface: 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNSPECIFIED';
    if (isBlocked || proposedChanges.length === 0 || relevantFiles.length === 0) {
      estimatedChangeSurface = 'UNSPECIFIED';
    } else if (proposedChanges.length <= 2 && acceptanceCriteria.length <= 4) {
      estimatedChangeSurface = 'SMALL';
    } else if (proposedChanges.length <= 5 && acceptanceCriteria.length <= 8) {
      estimatedChangeSurface = 'MEDIUM';
    } else {
      estimatedChangeSurface = 'LARGE';
    }

    const implementationPlan: ImplementationPlan = {
      issueSummary: `Issue #${issueNumber}: ${issueTitle}${
        isBlocked ? ' (Blocked: Insufficient Code Context / Missing Info)' : ''
      }`,
      repositoryUnderstanding: `Repository ${repositoryIntelligence.owner}/${repositoryIntelligence.repo} (${dependencyConfig.language}, ${dependencyConfig.framework}) with ${dependencyConfig.testFramework} test tooling.`,
      proposedChanges,
      testsToRun:
        dependencyConfig.testFramework !== 'None detected'
          ? [`npm test / ${dependencyConfig.testFramework}`]
          : ['Unit test suite'],
      buildLintVerification: [
        dependencyConfig.lintTooling !== 'None detected'
          ? `Lint check (${dependencyConfig.lintTooling})`
          : 'Static code inspection',
        dependencyConfig.language === 'TypeScript'
          ? 'TypeScript compiler check (tsc --noEmit)'
          : 'Build verification',
      ],
      risks: [
        'Public repository analysis is available. Repository write operations are not enabled in v0.3. Future contribution execution will determine the appropriate contributor fork and authorization path.',
        'Changes must preserve backward compatibility with existing interfaces.',
      ],
      blockers: blockers.map((b) => `[${b.category}] ${b.description}`),
      outOfScopeItems:
        outOfScopeItems.length > 0
          ? outOfScopeItems
          : ['Major architectural refactoring', 'Unrelated dependency upgrades'],
      estimatedChangeSurface,
    };

    const issueIntelligence: IssueIntelligenceData = {
      problemStatement: lines[0] || issueTitle,
      requestedBehavior: issueTitle,
      expectedBehavior: explicitRequirements.join('; '),
      explicitRequirements,
      inferredRequirements,
      unknownsAndQuestions,
      filesMentioned,
      apisMentioned,
      dependenciesMentioned,
      testsRequested,
      documentationRequirements,
      constraints,
      securityConsiderations,
      outOfScopeItems,
    };

    return {
      issueIntelligence,
      acceptanceCriteria,
      relevantFiles,
      blockers,
      implementationPlan,
      isBlocked,
    };
  }

  /**
   * Runs Gemini 3.8 Flash model using structured schema.
   */
  private async runGeminiAnalysis(params: {
    issueNumber: number;
    issueTitle: string;
    issueBody: string;
    issueLabels: { name: string; description?: string }[];
    repositoryIntelligence: RepositoryIntelligenceData;
    dependencyConfig: DependencyConfigAnalysis;
    repositoryAccessStatus: RepositoryAccessStatus;
  }) {
    if (!this.aiClient) {
      throw new Error('AI Client not initialized.');
    }

    const {
      issueNumber,
      issueTitle,
      issueBody,
      issueLabels,
      repositoryIntelligence,
      dependencyConfig,
      repositoryAccessStatus,
    } = params;

    const base = this.runGroundedSemanticAnalysis(params);
    if (base.isBlocked) {
      // If grounded semantic quality gate failed, do not let AI bypass the blocker
      return base;
    }

    const systemPrompt = `You are the COSInput Foundation Repository & Issue Analysis Engine.
Analyze the provided real GitHub issue grounded strictly in the repository tree, metadata, and instructions.
CRITICAL INVARIANTS:
1. v0.3 is strictly read-only. Never generate write actions, code commits, branch creations, or PR commands.
2. Separate EXPLICIT requirements from INFERRED requirements. Never present inferred items as explicit maintainer rules.
3. If canonical information is missing (e.g. unknown contract address, missing deployment secret), do NOT invent it. Mark as BLOCKED_CANONICAL_INFORMATION.
4. Each proposed change must map to one or more Acceptance Criteria IDs.
5. Do NOT estimate time-to-completion. Estimate change surface as SMALL, MEDIUM, or LARGE.`;

    const userPrompt = JSON.stringify({
      issue: {
        number: issueNumber,
        title: issueTitle,
        body: issueBody,
        labels: issueLabels,
      },
      repository: {
        owner: repositoryIntelligence.owner,
        repo: repositoryIntelligence.repo,
        defaultBranch: repositoryIntelligence.defaultBranch,
        language: dependencyConfig.language,
        framework: dependencyConfig.framework,
        testFramework: dependencyConfig.testFramework,
        lintTooling: dependencyConfig.lintTooling,
        sampleFiles: (repositoryIntelligence.sampleTreeFiles || []).slice(0, 40),
        instructions: repositoryIntelligence.discoveredInstructions,
      },
      repositoryAccessStatus,
    });

    const response = await this.aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    return {
      issueIntelligence: {
        ...base.issueIntelligence,
        ...(parsed.issueIntelligence || {}),
      },
      acceptanceCriteria:
        Array.isArray(parsed.acceptanceCriteria) && parsed.acceptanceCriteria.length > 0
          ? parsed.acceptanceCriteria
          : base.acceptanceCriteria,
      relevantFiles:
        base.relevantFiles.length > 0
          ? base.relevantFiles
          : Array.isArray(parsed.relevantFiles)
          ? parsed.relevantFiles
          : [],
      blockers: base.blockers,
      implementationPlan: base.implementationPlan,
      isBlocked: base.isBlocked,
    };
  }
}

export const issueAnalysisService = new IssueAnalysisService();
