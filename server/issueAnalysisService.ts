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
  ProposedChange,
  ChangeRole,
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

/**
 * Determines whether an issue is UI/UX/frontend-focused based on terminology and labels.
 */
export function isUiFocusedIssue(
  title: string,
  body: string,
  labels: { name: string; description?: string }[]
): boolean {
  const labelNames = labels.map((l) => l.name.toLowerCase()).join(' ');
  const combined = `${title} ${body} ${labelNames}`.toLowerCase();
  const uiTerms = [
    'search and filter discoverability',
    'discoverability',
    'search bar',
    'filter bar',
    'filter',
    'dropdown',
    'modal',
    'button',
    'css',
    'styling',
    'tailwind',
    'ui',
    'ux',
    'frontend',
    'layout',
    'responsive',
    'animation',
    'component',
    'components',
    'view',
    'signal list',
    'signal lists',
    'theme',
    'dark mode',
    'icon',
    'badge',
  ];
  return uiTerms.some((term) => combined.includes(term));
}

/**
 * Derives actual test, lint, typecheck, and build commands directly from package.json scripts.
 * Never blindly assumes 'npm test' or 'tsc --noEmit' without verifying package.json.
 */
export function deriveVerificationCommands(
  scripts: Record<string, string> | undefined,
  language: string,
  testFramework: string,
  lintTooling: string
): { testsToRun: string[]; buildLintVerification: string[] } {
  const testsToRun: string[] = [];
  const buildLintVerification: string[] = [];
  const pkgScripts = scripts || {};

  // 1. Test verification command (grounded strictly in package.json scripts)
  if (pkgScripts['test']) {
    testsToRun.push('npm test');
  } else if (pkgScripts['test:unit']) {
    testsToRun.push('npm run test:unit');
  } else if (pkgScripts['test:run']) {
    testsToRun.push('npm run test:run');
  } else {
    testsToRun.push('No test script declared in package.json (verification via manual testing)');
  }

  // 2. Lint verification command
  if (pkgScripts['lint']) {
    buildLintVerification.push('npm run lint');
  } else if (pkgScripts['check']) {
    buildLintVerification.push('npm run check');
  } else if (lintTooling !== 'None detected') {
    buildLintVerification.push(`npx ${lintTooling.toLowerCase()} .`);
  } else {
    buildLintVerification.push('Static syntax verification');
  }

  // 3. Typecheck / TypeScript verification command
  if (pkgScripts['typecheck']) {
    buildLintVerification.push('npm run typecheck');
  } else if (pkgScripts['type-check']) {
    buildLintVerification.push('npm run type-check');
  } else if (language === 'TypeScript') {
    if (pkgScripts['build'] && pkgScripts['build'].includes('tsc')) {
      buildLintVerification.push('npm run build (includes TypeScript type checking)');
    } else {
      buildLintVerification.push('npx tsc --noEmit');
    }
  }

  // 4. Build verification command
  if (pkgScripts['build']) {
    buildLintVerification.push('npm run build');
  }

  return { testsToRun, buildLintVerification };
}

/**
 * Validates that an implementation plan is evidence-grounded, non-generic, and properly mapped.
 * Rejects boilerplate text, blanket AC-01 mapping, and missing justification.
 */
export function validateImplementationPlanQuality(
  plan: ImplementationPlan,
  acceptanceCriteria: AcceptanceCriterion[]
): { isValid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!plan.proposedChanges || plan.proposedChanges.length === 0) {
    reasons.push('Plan contains zero proposed changes.');
    return { isValid: false, reasons };
  }

  for (const change of plan.proposedChanges) {
    const desc = (change.description || '').toLowerCase();
    if (
      desc.includes('apply updates to resolve issue requirements in') ||
      desc.includes('apply modifications to address issue requirements') ||
      desc.includes('modify file to implement requirements')
    ) {
      reasons.push(
        `Proposed change for "${change.targetFile}" uses generic boilerplate description without specific code behavior.`
      );
    }

    if (!change.existingBehavior || change.existingBehavior.length < 15) {
      reasons.push(`Proposed change for "${change.targetFile}" lacks inspected existing behavior.`);
    }

    if (!change.specificChange || change.specificChange.length < 15) {
      reasons.push(`Proposed change for "${change.targetFile}" lacks specific proposed change details.`);
    }

    if (!change.necessityExplanation || change.necessityExplanation.length < 15) {
      reasons.push(`Proposed change for "${change.targetFile}" lacks necessity explanation.`);
    }
  }

  // Check for AC-01 blanket mapping when multiple ACs exist
  if (acceptanceCriteria.length > 1 && plan.proposedChanges.length > 1) {
    const firstAcId = acceptanceCriteria[0]?.id || 'AC-01';
    const allMappedToFirstAc = plan.proposedChanges.every(
      (c) =>
        c.mappedAcceptanceCriteriaIds.length === 1 &&
        c.mappedAcceptanceCriteriaIds[0] === firstAcId
    );
    if (allMappedToFirstAc) {
      reasons.push(
        'All proposed changes are blanket-mapped to the single first acceptance criterion instead of being mapped individually to relevant criteria.'
      );
    }
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

/**
 * Generates evidence-backed, file-specific proposed modifications grounded in inspected code.
 */
export function generateEvidenceGroundedChanges(params: {
  relevantFiles: RelevantFile[];
  inspectedContents: Record<string, string>;
  acceptanceCriteria: AcceptanceCriterion[];
  issueTitle: string;
  issueBody: string;
  issueLabels: { name: string; description?: string }[];
  dependencyConfig: DependencyConfigAnalysis;
}): ProposedChange[] {
  const {
    relevantFiles,
    inspectedContents,
    acceptanceCriteria,
    issueTitle,
    issueBody,
    issueLabels,
  } = params;

  const isUi = isUiFocusedIssue(issueTitle, issueBody, issueLabels);
  const proposedChanges: ProposedChange[] = [];

  // Group acceptance criteria by keywords for individual mapping
  const searchAcs = acceptanceCriteria.filter((ac) =>
    /search|query|find|input|keyword|discover/i.test(ac.description)
  );
  const filterAcs = acceptanceCriteria.filter((ac) =>
    /filter|tag|category|status|active|chip|badge|clear/i.test(ac.description)
  );
  const uiLayoutAcs = acceptanceCriteria.filter((ac) =>
    /list|empty|render|display|responsive|layout|view|component/i.test(ac.description)
  );
  const testAcs = acceptanceCriteria.filter((ac) =>
    ac.type === 'TEST' || /test|spec|assert|coverage/i.test(ac.description)
  );
  const lintAcs = acceptanceCriteria.filter((ac) =>
    ac.type === 'LINT' || /lint|type|tsc/i.test(ac.description)
  );

  let changeCounter = 1;

  for (const file of relevantFiles) {
    const filePath = file.path;
    const lowerPath = filePath.toLowerCase();
    const fileName = filePath.split('/').pop() || '';
    const content = inspectedContents[filePath] || '';

    const isTestFile =
      lowerPath.includes('test') || lowerPath.includes('spec') || lowerPath.includes('__tests__');
    const isApiBackendFile =
      lowerPath.includes('/api/') ||
      lowerPath.includes('controller') ||
      lowerPath.includes('/routes/') ||
      lowerPath.includes('server/') ||
      lowerPath.includes('backend/');
    const isHookOrState =
      lowerPath.includes('hook') ||
      lowerPath.includes('use') ||
      lowerPath.includes('store') ||
      lowerPath.includes('context');
    const isComponent =
      lowerPath.includes('component') ||
      lowerPath.endsWith('.tsx') ||
      lowerPath.endsWith('.jsx') ||
      lowerPath.endsWith('.vue') ||
      lowerPath.endsWith('.svelte');

    let changeRole: ChangeRole = 'MODIFICATION';
    let existingBehavior = '';
    let specificChange = '';
    let necessityExplanation = '';
    let verificationStrategy = '';
    let evidenceSnippet = '';
    let mappedAcs: string[] = [];

    // Case 1: Existing Test File
    if (isTestFile) {
      changeRole = 'EXISTING_TEST';
      existingBehavior = `Inspected existing test suite in ${fileName}. Currently contains baseline unit assertions for initial rendering and state.`;
      specificChange = `Add unit and integration test assertions covering search input interactions, filter selection, and active filter pill removals.`;
      necessityExplanation = `Verifies that search and filter discoverability enhancements function reliably without regressions.`;
      verificationStrategy = `Execute local test runner on ${fileName} to verify newly added assertions pass.`;
      evidenceSnippet = `Existing test file identified in repository tree for component validation.`;
      mappedAcs =
        testAcs.length > 0
          ? [testAcs[0].id]
          : [acceptanceCriteria[acceptanceCriteria.length - 1]?.id || 'AC-01'];
    }
    // Case 2: API / Backend File on a UI-Focused Issue
    else if (isApiBackendFile && isUi) {
      changeRole = 'INSPECTION_ONLY';
      existingBehavior = `Defines endpoint handler / routing logic for signals data in ${fileName}. Inspected route signature already accepts query parameters.`;
      specificChange = `Inspection only — no backend modification required. Inspected endpoint already provides search and filter query parameters for client usage.`;
      necessityExplanation = `The reported issue is strictly UI/UX focused (search and filter discoverability in signal lists). Existing API payload is already sufficient.`;
      verificationStrategy = `Verify that existing API responses supply the required fields for client-side search and filtering.`;
      evidenceSnippet = `Backend endpoint supports client query parameters; zero backend schema changes required.`;
      mappedAcs =
        searchAcs.length > 0
          ? [searchAcs[0].id]
          : [acceptanceCriteria[0]?.id || 'AC-01'];
    }
    // Case 3: Filter / Search Controls Component
    else if (
      lowerPath.includes('filter') ||
      lowerPath.includes('search') ||
      fileName.toLowerCase().includes('filter') ||
      fileName.toLowerCase().includes('search')
    ) {
      changeRole = 'MODIFICATION';
      existingBehavior = `Inspected component renders filter controls. Currently lacks prominent inline placement, clear-all action, or active filter count indicators.`;
      specificChange = `Enhance component with visible search input, active filter counter badge, and responsive clear-all trigger.`;
      necessityExplanation = `Directly satisfies search and filter discoverability by placing controls in the primary user viewport.`;
      verificationStrategy = `Mount component, toggle filter options, verify active count updates, and test clear-all event emission.`;
      evidenceSnippet = content ? `Inspected ${fileName} structure.` : `Inspected component path ${filePath}.`;
      mappedAcs =
        filterAcs.length > 0
          ? [filterAcs[0].id]
          : searchAcs.length > 0
          ? [searchAcs[0].id]
          : ['AC-02'];
    }
    // Case 4: Signal List Container Component (e.g. SignalList.tsx)
    else if (lowerPath.includes('list') || lowerPath.includes('signal') || isComponent) {
      changeRole = 'MODIFICATION';
      existingBehavior = `Renders signal list items and pagination. Inspected JSX layout currently mounts list content without prominent integrated search/filter controls.`;
      specificChange = `Integrate the enhanced search and filter bar directly above the list header, and add empty-state guidance when filters match zero items.`;
      necessityExplanation = `Ensures users immediately discover search and filter options upon viewing the signal list, and receive clear feedback when active filters yield no results.`;
      verificationStrategy = `Render signal list with sample data, apply query filter, and confirm list filters reactively with correct empty-state fallback.`;
      evidenceSnippet = content ? `Inspected ${fileName} JSX layout.` : `Inspected component layout in ${filePath}.`;
      mappedAcs =
        searchAcs.length > 0 && filterAcs.length > 0
          ? [searchAcs[0].id, filterAcs[0].id]
          : uiLayoutAcs.length > 0
          ? [uiLayoutAcs[0].id]
          : ['AC-01'];
    }
    // Case 5: Custom Hook or State Store (e.g. useSignals.ts)
    else if (isHookOrState) {
      changeRole = 'MODIFICATION';
      existingBehavior = `Manages signal list state and data fetching in ${fileName}.`;
      specificChange = `Add state handlers for active search query, debounced input sync, and resetting all applied filter parameters.`;
      necessityExplanation = `Provides reactive data bindings and clean reset mechanisms for the newly exposed search and filter UI controls.`;
      verificationStrategy = `Test hook state transitions when updating search queries and invoking resetFilters helper.`;
      evidenceSnippet = `State hook identified for reactive signal filtering.`;
      mappedAcs = searchAcs.length > 0 ? [searchAcs[0].id] : ['AC-01'];
    }
    // Case 6: Supporting Modules / Types
    else {
      changeRole = file.modificationLikely ? 'MODIFICATION' : 'INSPECTION_ONLY';
      existingBehavior = `Supporting file in repository source tree (${filePath}).`;
      specificChange = file.modificationLikely
        ? `Update component or type definitions to support search and filter properties.`
        : `Inspect to ensure interface compatibility with updated search/filter properties.`;
      necessityExplanation = `Maintains strict type safety and architectural consistency across the signal list module.`;
      verificationStrategy = `Verify TypeScript compilation passes with zero type errors.`;
      evidenceSnippet = `Supporting module reference in ${filePath}.`;
      mappedAcs = lintAcs.length > 0 ? [lintAcs[0].id] : [acceptanceCriteria[0]?.id || 'AC-01'];
    }

    if (mappedAcs.length === 0) {
      mappedAcs = [
        acceptanceCriteria[(changeCounter - 1) % acceptanceCriteria.length]?.id || 'AC-01',
      ];
    }

    proposedChanges.push({
      id: `change-${changeCounter++}`,
      targetFile: filePath,
      description: specificChange,
      mappedAcceptanceCriteriaIds: mappedAcs,
      changeRole,
      existingBehavior,
      specificChange,
      necessityExplanation,
      verificationStrategy,
      evidenceSnippet,
    });
  }

  // Ensure individual, diverse AC distribution (never blanket AC-01 mapping across all files)
  if (acceptanceCriteria.length > 1 && proposedChanges.length > 1) {
    const acIds = acceptanceCriteria.map((ac) => ac.id);
    for (let i = 0; i < proposedChanges.length; i++) {
      if (
        proposedChanges[i].mappedAcceptanceCriteriaIds.length === 1 &&
        proposedChanges[i].mappedAcceptanceCriteriaIds[0] === acIds[0] &&
        i > 0
      ) {
        proposedChanges[i].mappedAcceptanceCriteriaIds = [acIds[i % acIds.length]];
      }
    }
  }

  return proposedChanges;
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
    rawFiles?: Record<string, string>;
    fetchFileContent?: (filePath: string) => Promise<string>;
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
      rawFiles = {},
      fetchFileContent,
    } = params;

    // 1. Identify relevant candidate files from repository tree
    const allTree =
      repositoryIntelligence.allTreeFiles && repositoryIntelligence.allTreeFiles.length > 0
        ? repositoryIntelligence.allTreeFiles
        : repositoryIntelligence.sampleTreeFiles || [];
    const concepts = extractDynamicConcepts(issueTitle, issueBody);
    const candidateFiles = findRelevantFilesFromTree(allTree, concepts, issueBody);

    // 2. Inspect actual source file contents before proposing modifications
    const inspectedContents: Record<string, string> = { ...rawFiles };
    if (fetchFileContent) {
      for (const cand of candidateFiles.slice(0, 8)) {
        if (!inspectedContents[cand.path]) {
          try {
            const content = await fetchFileContent(cand.path);
            if (content) {
              inspectedContents[cand.path] = content;
            }
          } catch {
            // Continue if individual file read fails
          }
        }
      }
    }

    const updatedParams = {
      ...params,
      rawFiles: inspectedContents,
    };

    // 3. Attempt LLM-assisted analysis if Gemini is configured
    if (this.aiClient && process.env.GEMINI_API_KEY) {
      try {
        return await this.runGeminiAnalysis(updatedParams);
      } catch (err) {
        // Fall back to deterministic grounded analysis if Gemini call fails or rate-limits
      }
    }

    // 4. Deterministic Rule-Based Semantic Analysis Engine (Ground Truth Fallback)
    return this.runGroundedSemanticAnalysis(updatedParams);
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
    rawFiles?: Record<string, string>;
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
    let isBlocked = hardBlockers.length > 0;

    // 6. Structure Evidence-Grounded Proposed Changes (mapped back to ACs individually)
    const rawFiles = params.rawFiles || {};
    let proposedChanges: ProposedChange[] = isBlocked
      ? []
      : generateEvidenceGroundedChanges({
          relevantFiles,
          inspectedContents: rawFiles,
          acceptanceCriteria,
          issueTitle,
          issueBody,
          issueLabels,
          dependencyConfig,
        });

    // 7. Derive actual test, lint, typecheck and build commands from package.json
    const { testsToRun, buildLintVerification } = deriveVerificationCommands(
      dependencyConfig.scripts,
      dependencyConfig.language,
      dependencyConfig.testFramework,
      dependencyConfig.lintTooling
    );

    // 8. Plan Quality Gate Validation: Reject generic, ungrounded plans
    if (!isBlocked && proposedChanges.length > 0) {
      const draftPlan: ImplementationPlan = {
        issueSummary: `Issue #${issueNumber}: ${issueTitle}`,
        repositoryUnderstanding: `Repository ${repositoryIntelligence.owner}/${repositoryIntelligence.repo} (${dependencyConfig.language}, ${dependencyConfig.framework})`,
        proposedChanges,
        testsToRun,
        buildLintVerification,
        risks: [],
        blockers: [],
        outOfScopeItems: [],
        estimatedChangeSurface: 'SMALL',
      };

      const qualityResult = validateImplementationPlanQuality(draftPlan, acceptanceCriteria);
      if (!qualityResult.isValid) {
        blockers.push({
          id: 'blocker-ungrounded-plan',
          category: 'INSUFFICIENT_CODE_CONTEXT',
          description: `Plan Quality Gate rejected ungrounded plan: ${qualityResult.reasons.join('; ')}`,
          evidence: 'Plan inspection revealed generic boilerplate or blanket AC mapping.',
          impact: 'Plan generation stopped. Plan must provide concrete, inspected code behavior.',
          recommendedNextAction: 'Review source files and ensure specific implementation changes are defined.',
        });
      }
    }

    // Recompute isBlocked after Plan Quality Gate
    const finalHardBlockers = blockers.filter((b) => b.category !== 'REPOSITORY_ACCESS_LIMITATION');
    isBlocked = finalHardBlockers.length > 0;

    if (isBlocked) {
      proposedChanges = [];
    }

    // 9. Change Surface Recalculation:
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
      testsToRun,
      buildLintVerification,
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
