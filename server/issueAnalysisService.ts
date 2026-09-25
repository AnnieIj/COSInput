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
  BlockerItem,
  ImplementationPlan,
  RepositoryIntelligenceData,
  DependencyConfigAnalysis,
  RepositoryAccessStatus,
} from './types';

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

    // Detect mentioned files in issue text
    const sampleTree = repositoryIntelligence.sampleTreeFiles || [];
    for (const treePath of sampleTree) {
      const fileName = treePath.split('/').pop() || '';
      if (fileName && fileName.length > 3 && fullText.includes(fileName)) {
        filesMentioned.push(treePath);
      }
    }

    // Detect mentioned contracts/APIs/endpoints
    const contractMatches = fullText.match(/(0x[a-fA-F0-9]{40}|C[A-Z0-9]{55}|[A-Z0-9_]{6,}_ADDRESS|[A-Z0-9_]{6,}_URL)/g);
    if (contractMatches) {
      apisMentioned.push(...Array.from(new Set(contractMatches)));
    }

    // 2. Identify Relevant Files from Repository Tree
    const relevantFiles: RelevantFile[] = [];
    const matchedPaths = new Set<string>();

    // A. Add explicitly mentioned files
    for (const f of filesMentioned) {
      matchedPaths.add(f);
      const isTest = f.includes('test') || f.includes('spec');
      relevantFiles.push({
        path: f,
        category: isTest ? 'TEST' : 'PRIMARY',
        reason: 'Explicitly referenced in issue specification or stack trace.',
        confidence: 'HIGH',
        modificationLikely: !isTest,
      });
    }

    // B. Heuristically match keyword in path
    const titleKeywords = issueTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(' ')
      .filter((w) => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'when'].includes(w));

    for (const treePath of sampleTree) {
      if (matchedPaths.has(treePath)) continue;
      const lowerPath = treePath.toLowerCase();

      // Check keyword match
      const matchedKw = titleKeywords.find((kw) => lowerPath.includes(kw));
      if (matchedKw) {
        matchedPaths.add(treePath);
        const isTest = lowerPath.includes('test') || lowerPath.includes('spec');
        const isDoc = lowerPath.endsWith('.md');
        const isConfig = lowerPath.includes('config') || lowerPath.includes('json');

        relevantFiles.push({
          path: treePath,
          category: isTest ? 'TEST' : isDoc ? 'DOCUMENTATION' : isConfig ? 'CONFIGURATION' : 'PRIMARY',
          reason: `Path matches issue keyword "${matchedKw}".`,
          confidence: 'MEDIUM',
          modificationLikely: !isDoc && !isTest,
        });
      }
    }

    // C. Always include configuration/test anchors if needed
    if (relevantFiles.length === 0) {
      // Pick first source and test files
      const firstSrc = sampleTree.find((p) => p.startsWith('src/') || p.startsWith('lib/'));
      if (firstSrc) {
        relevantFiles.push({
          path: firstSrc,
          category: 'PRIMARY',
          reason: 'Entry candidate in relevant source directory.',
          confidence: 'LOW',
          modificationLikely: true,
        });
      }
    }

    // 3. Build Acceptance Criteria (AC-01...)
    const acceptanceCriteria: AcceptanceCriterion[] = [];
    let acCounter = 1;

    for (const req of explicitRequirements) {
      acceptanceCriteria.push({
        id: `AC-${String(acCounter++).padStart(2, '0')}`,
        description: req,
        source: 'ISSUE',
        type: /test/i.test(req) ? 'TEST' : /ui|display|screen|button|color/i.test(req) ? 'UX' : 'FUNCTIONAL',
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
        verificationStrategy: `Execute local test command: ${dependencyConfig.testFramework === 'Vitest' ? 'npm run test / vitest run' : 'npm test'}`,
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

    // 4. Blocker Detection
    const blockers: BlockerItem[] = [];

    // Category: REPOSITORY_ACCESS_LIMITATION
    if (repositoryAccessStatus !== 'app_authorized') {
      blockers.push({
        id: 'blocker-repo-access',
        category: 'REPOSITORY_ACCESS_LIMITATION',
        description: `Repository "${repositoryIntelligence.owner}/${repositoryIntelligence.repo}" is public-readable, but write access is not authorized through the COSInput GitHub App.`,
        evidence: 'Repository not listed in active GitHub App installations.',
        impact: 'COSInput can inspect specifications and analyze files, but cannot push branches or open Pull Requests until authorized.',
        recommendedNextAction: 'Install the COSInput GitHub App on this repository or obtain fork authorization from the repository maintainer.',
      });
    }

    // Category: MISSING_CANONICAL_INFORMATION
    // Check if issue mentions unconfigured contract addresses, private APIs, or missing credentials
    if (fullText.includes('<CONTRACT_ADDRESS>') || fullText.includes('TODO: add address') || fullText.includes('REPLACE_WITH_KEY')) {
      blockers.push({
        id: 'blocker-missing-canonical',
        category: 'MISSING_CANONICAL_INFORMATION',
        description: 'Required canonical contract address or deployment identifier is missing from issue specification.',
        evidence: 'Placeholder identifier detected in issue description.',
        impact: 'Implementation cannot generate deterministic transaction calls without canonical contract identity.',
        recommendedNextAction: 'Request maintainer clarification for the canonical deployed contract address.',
      });
    }

    // Check if ambiguous questions remain
    if (fullText.toLowerCase().includes('tbd') || fullText.toLowerCase().includes('needs discussion')) {
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

    // 5. Structure Proposed Changes (mapped back to ACs)
    const proposedChanges = relevantFiles
      .filter((f) => f.modificationLikely)
      .slice(0, 5)
      .map((f, idx) => ({
        id: `change-${idx + 1}`,
        targetFile: f.path,
        description: `Apply updates to resolve issue requirements in ${f.path}.`,
        mappedAcceptanceCriteriaIds: [acceptanceCriteria[0]?.id || 'AC-01'],
      }));

    if (proposedChanges.length === 0 && relevantFiles.length > 0) {
      proposedChanges.push({
        id: 'change-1',
        targetFile: relevantFiles[0].path,
        description: `Apply modifications to address issue requirements.`,
        mappedAcceptanceCriteriaIds: [acceptanceCriteria[0]?.id || 'AC-01'],
      });
    }

    // 6. Implementation Plan
    const isSmall = relevantFiles.length <= 2 && explicitRequirements.length <= 2;
    const isLarge = relevantFiles.length > 6 || explicitRequirements.length > 5;
    const estimatedChangeSurface = isSmall ? 'SMALL' : isLarge ? 'LARGE' : 'MEDIUM';

    const implementationPlan: ImplementationPlan = {
      issueSummary: `Issue #${issueNumber}: ${issueTitle}`,
      repositoryUnderstanding: `Repository ${repositoryIntelligence.owner}/${repositoryIntelligence.repo} (${dependencyConfig.language}, ${dependencyConfig.framework}) with ${dependencyConfig.testFramework} test tooling.`,
      proposedChanges,
      testsToRun: dependencyConfig.testFramework !== 'None detected' ? [`npm test / ${dependencyConfig.testFramework}`] : ['Unit test suite'],
      buildLintVerification: [
        dependencyConfig.lintTooling !== 'None detected' ? `Lint check (${dependencyConfig.lintTooling})` : 'Static code inspection',
        dependencyConfig.language === 'TypeScript' ? 'TypeScript compiler check (tsc --noEmit)' : 'Build verification',
      ],
      risks: [
        'Changes must preserve backward compatibility with existing interfaces.',
        'External API or public contract changes require maintainer signoff.',
      ],
      blockers: blockers.map((b) => `[${b.category}] ${b.description}`),
      outOfScopeItems: outOfScopeItems.length > 0 ? outOfScopeItems : ['Major architectural refactoring', 'Unrelated dependency upgrades'],
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
      isBlocked: blockers.length > 0,
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

    // Merge with deterministic safety checks (e.g. repository access blocker)
    const base = this.runGroundedSemanticAnalysis(params);

    return {
      issueIntelligence: {
        ...base.issueIntelligence,
        ...(parsed.issueIntelligence || {}),
      },
      acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) && parsed.acceptanceCriteria.length > 0
        ? parsed.acceptanceCriteria
        : base.acceptanceCriteria,
      relevantFiles: Array.isArray(parsed.relevantFiles) && parsed.relevantFiles.length > 0
        ? parsed.relevantFiles
        : base.relevantFiles,
      blockers: [
        ...base.blockers.filter((b) => b.category === 'REPOSITORY_ACCESS_LIMITATION'),
        ...(Array.isArray(parsed.blockers) ? parsed.blockers : []),
      ],
      implementationPlan: parsed.implementationPlan || base.implementationPlan,
      isBlocked: base.blockers.length > 0 || (Array.isArray(parsed.blockers) && parsed.blockers.length > 0),
    };
  }
}

export const issueAnalysisService = new IssueAnalysisService();
