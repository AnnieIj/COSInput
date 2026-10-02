/**
 * COSInput Foundation v0.5.1 — Read-Only CI Guardian Service
 *
 * Implements the first stage of CI Guardian as a strictly read-only PR monitoring and diagnosis system.
 *
 * Responsibilities:
 * 1. PR Discovery: Inspects authorized contributor pull requests across COSInput sessions,
 *    authorized installation repositories, and open PRs from contributor-owned forks.
 * 2. Read-Only CI Status Retrieval: Retrieves GitHub Check Runs and Commit Statuses for the PR's current head SHA.
 * 3. Failure Evidence Retrieval: Collects annotations, check output, and job metadata; reports EVIDENCE_UNAVAILABLE if inaccessible.
 * 4. Failure Classification: Categorizes failures (TEST, TYPECHECK, LINT, BUILD, DEPENDENCY, CONFIG, ENV, TIMEOUT, PERMISSION, EXTERNAL, UNKNOWN).
 * 5. Grounded Diagnosis: Explains failed command, GitHub report, relevant files, and PR diff relevance with strict VERIFIED_FACT vs INFERENCE distinctions.
 * 6. Proposed Repair Plan: Generates non-executable repair hypotheses and verification commands; recommends inspection when evidence is insufficient.
 * 7. Refresh & Monitoring: Manual refresh, deduplication by (repo + PR + head SHA), and new commit invalidation.
 * 8. Strict Security Boundaries: Strictly prohibited from code modification, commit creation, pushes, reruns, comments, or merges.
 */

import { githubServerClient, classifyGitHubError } from './githubClient';
import { userAuthStore } from './userAuthStore';
import { contributionSessionStore } from './contributionSessionStore';
import type {
  GuardianObservation,
  GuardianPullRequestSummary,
  CheckItem,
  CheckAnnotation,
  NormalizedCheckStatus,
  FailureClassification,
  FailureClassificationCategory,
  CheckDiagnosis,
  ProposedRepairProposal,
  GuardianCockpitState,
} from './types';

export class CIGuardianService {
  // In-memory cache of Guardian observations indexed by `${repository}:${prNumber}:${headSha}`
  private observations = new Map<string, GuardianObservation>();

  /**
   * Helper to redact sensitive credentials or tokens from any error or diagnostic string.
   */
  private redactSecrets(text: string): string {
    return text
      .replace(/(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}|Bearer\s+[a-zA-Z0-9_\-\.]+)/gi, '[REDACTED_CREDENTIAL]')
      .replace(/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/gi, (match) => {
        // Redact email addresses except example.com
        return match.includes('example.com') ? match : '[REDACTED_EMAIL]';
      });
  }

  /**
   * Section 1: PR Discovery
   *
   * Discovers pull requests associated with the authenticated contributor from:
   * 1. COSInput contribution sessions with active submissions or opened PRs.
   * 2. Authorized GitHub repositories accessible via App installation or user OAuth.
   * 3. Open PRs from contributor-owned forks targeting upstream repositories.
   */
  async discoverPullRequests(
    contributorUsername?: string,
    userToken?: string
  ): Promise<GuardianPullRequestSummary[]> {
    const discoveredMap = new Map<string, GuardianPullRequestSummary>();
    const effectiveToken = userToken || userAuthStore.getUserToken() || undefined;
    const effectiveContributor =
      contributorUsername || userAuthStore.getUserProfile()?.login || undefined;

    // 1. Check local contribution sessions in store
    const localSessions = contributionSessionStore.listSessions();
    for (const session of localSessions) {
      const sub = session.currentSubmission;
      const prep = session.workspacePreparation;

      const prNumber = sub?.prNumber || (sub?.existingPrFound && sub?.existingPr?.number) || undefined;
      const repo = session.upstreamRepository;

      if (prNumber && repo && repo.includes('/')) {
        const [owner, repoName] = repo.split('/');
        try {
          const prDetails = await githubServerClient.getPullRequest(
            owner,
            repoName,
            prNumber,
            effectiveToken
          );

          let prFiles: string[] = [];
          try {
            const files = await githubServerClient.getPullRequestFiles(
              owner,
              repoName,
              prNumber,
              effectiveToken
            );
            prFiles = files.map((f) => f.filename);
          } catch {
            prFiles = sub?.stagedFiles || [];
          }

          const key = `${repo}#${prNumber}`;
          discoveredMap.set(key, {
            upstreamRepository: repo,
            upstreamOwner: owner,
            upstreamRepo: repoName,
            prNumber,
            prUrl: prDetails.htmlUrl,
            prTitle: prDetails.title,
            prState: prDetails.state,
            headRepository: prDetails.head.repo?.fullName || sub?.contributorFork || repo,
            headOwner: prDetails.head.repo?.owner || owner,
            headRepo: prDetails.head.repo?.name || repoName,
            headBranch: prDetails.head.ref,
            headCommitSha: prDetails.head.sha,
            baseBranch: prDetails.base.ref,
            author: prDetails.author || session.contributorUsername,
            mergeable: prDetails.mergeable,
            mergeableState: prDetails.mergeableState,
            prChangedFiles: prFiles,
          });
        } catch {
          // If remote fetch fails, construct verified summary from local session record
          const key = `${repo}#${prNumber}`;
          discoveredMap.set(key, {
            upstreamRepository: repo,
            upstreamOwner: owner,
            upstreamRepo: repoName,
            prNumber,
            prUrl: sub?.prUrl || `https://github.com/${repo}/pull/${prNumber}`,
            prTitle: sub?.prTitle || `fix: resolve issue #${session.issueNumber}`,
            prState: 'open',
            headRepository: sub?.contributorFork || repo,
            headOwner: sub?.contributorFork?.split('/')[0] || owner,
            headRepo: sub?.contributorFork?.split('/')[1] || repoName,
            headBranch: sub?.sourceBranch || prep?.branchName || 'contributor-branch',
            headCommitSha: sub?.commitSha || prep?.baseCommitSha || 'unknown',
            baseBranch: sub?.targetBranch || prep?.baseBranch || 'main',
            author: session.contributorUsername,
            mergeable: null,
            mergeableState: null,
            prChangedFiles: sub?.stagedFiles || [],
          });
        }
      }
    }

    // 2. Discover open PRs via GitHub App installations / authorized repos
    try {
      const installations = await githubServerClient.listInstallations();
      for (const inst of installations.slice(0, 3)) {
        try {
          const reposData = await githubServerClient.listInstallationRepositories(inst.id);
          for (const r of reposData.repositories.slice(0, 5)) {
            try {
              const pulls = await githubServerClient.listPullRequests(
                r.owner,
                r.name,
                { state: 'open' },
                effectiveToken
              );

              for (const pr of pulls) {
                const headOwner = pr.head.label.split(':')[0] || '';
                const isContributorAuthor =
                  !effectiveContributor ||
                  headOwner.toLowerCase() === effectiveContributor.toLowerCase();

                const key = `${r.owner}/${r.name}#${pr.number}`;
                if (isContributorAuthor && !discoveredMap.has(key)) {
                  // Fetch full details
                  try {
                    const fullPr = await githubServerClient.getPullRequest(
                      r.owner,
                      r.name,
                      pr.number,
                      effectiveToken
                    );

                    let prFiles: string[] = [];
                    try {
                      const files = await githubServerClient.getPullRequestFiles(
                        r.owner,
                        r.name,
                        pr.number,
                        effectiveToken
                      );
                      prFiles = files.map((f) => f.filename);
                    } catch {
                      prFiles = [];
                    }

                    discoveredMap.set(key, {
                      upstreamRepository: `${r.owner}/${r.name}`,
                      upstreamOwner: r.owner,
                      upstreamRepo: r.name,
                      prNumber: pr.number,
                      prUrl: fullPr.htmlUrl,
                      prTitle: fullPr.title,
                      prState: fullPr.state,
                      headRepository: fullPr.head.repo?.fullName || `${headOwner}/${r.name}`,
                      headOwner: fullPr.head.repo?.owner || headOwner,
                      headRepo: fullPr.head.repo?.name || r.name,
                      headBranch: fullPr.head.ref,
                      headCommitSha: fullPr.head.sha,
                      baseBranch: fullPr.base.ref,
                      author: fullPr.author || headOwner,
                      mergeable: fullPr.mergeable,
                      mergeableState: fullPr.mergeableState,
                      prChangedFiles: prFiles,
                    });
                  } catch {
                    discoveredMap.set(key, {
                      upstreamRepository: `${r.owner}/${r.name}`,
                      upstreamOwner: r.owner,
                      upstreamRepo: r.name,
                      prNumber: pr.number,
                      prUrl: pr.htmlUrl,
                      prTitle: pr.title,
                      prState: pr.state,
                      headRepository: `${headOwner}/${r.name}`,
                      headOwner,
                      headRepo: r.name,
                      headBranch: pr.head.ref,
                      headCommitSha: pr.head.sha,
                      baseBranch: pr.base.ref,
                      author: headOwner,
                      mergeable: null,
                      mergeableState: null,
                      prChangedFiles: [],
                    });
                  }
                }
              }
            } catch {
              // Ignore single repo PR fetch failure
            }
          }
        } catch {
          // Ignore installation repository failure
        }
      }
    } catch {
      // Installation lookup failed; rely on local session PRs
    }

    return Array.from(discoveredMap.values());
  }

  /**
   * Normalizes raw check-run or commit status to explicit COSInput NormalizedCheckStatus.
   * Invariant: Never represent a pending, skipped, unavailable, or unknown check as passed!
   */
  normalizeCheckStatus(
    source: 'check_run' | 'commit_status',
    statusOrState: string,
    conclusion?: string | null
  ): NormalizedCheckStatus {
    if (source === 'check_run') {
      const st = (statusOrState || '').toLowerCase();
      const conc = (conclusion || '').toLowerCase();

      if (st === 'queued') return 'QUEUED';
      if (st === 'in_progress') return 'IN_PROGRESS';
      if (st === 'completed') {
        if (conc === 'success') return 'PASSED';
        if (conc === 'failure') return 'FAILED';
        if (conc === 'timed_out') return 'TIMED_OUT';
        if (conc === 'cancelled') return 'CANCELLED';
        if (conc === 'action_required') return 'ACTION_REQUIRED';
        if (conc === 'skipped' || conc === 'neutral') return 'SKIPPED';
        return 'UNKNOWN';
      }
      return 'UNKNOWN';
    }

    // Commit Status
    const state = (statusOrState || '').toLowerCase();
    if (state === 'success') return 'PASSED';
    if (state === 'failure' || state === 'error') return 'FAILED';
    if (state === 'pending') return 'IN_PROGRESS';
    return 'UNKNOWN';
  }

  /**
   * Section 4: Failure Classification
   *
   * Analyzes failed check metadata, annotations, and text evidence to classify into
   * evidence-backed categories.
   */
  classifyFailure(
    check: CheckItem,
    annotations: CheckAnnotation[]
  ): FailureClassification {
    const combinedText = [
      check.name,
      check.summary || '',
      check.text || '',
      ...annotations.map((a) => `${a.title || ''} ${a.message} ${a.rawDetails || ''}`),
    ]
      .join(' ')
      .toLowerCase();

    let category: FailureClassificationCategory = 'UNKNOWN_FAILURE';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    const supportingEvidence: string[] = [];
    const relevantFiles: string[] = [];
    const logExcerpts: string[] = [];

    // Collect file paths from annotations
    for (const ann of annotations) {
      if (ann.path && !relevantFiles.includes(ann.path)) {
        relevantFiles.push(ann.path);
      }
      if (ann.message) {
        logExcerpts.push(
          `${ann.path}${ann.startLine ? `:${ann.startLine}` : ''}: ${ann.message}`
        );
      }
    }

    if (check.text && check.text.trim()) {
      const lines = check.text.split('\n').filter((l) => l.trim().length > 0);
      logExcerpts.push(...lines.slice(0, 5));
    }

    // 1. Typecheck Failure
    if (
      combinedText.includes('type error') ||
      combinedText.includes('typecheck') ||
      combinedText.includes('tsc ') ||
      /ts\d{4}/i.test(combinedText) ||
      combinedText.includes('cannot find name') ||
      combinedText.includes('is not assignable to')
    ) {
      category = 'TYPECHECK_FAILURE';
      confidence = annotations.length > 0 || /ts\d{4}/i.test(combinedText) ? 'HIGH' : 'MEDIUM';
      supportingEvidence.push(
        `TypeScript compilation or type assertion failure detected in check '${check.name}'.`
      );
    }
    // 2. Test Failure
    else if (
      combinedText.includes('test') ||
      combinedText.includes('vitest') ||
      combinedText.includes('jest') ||
      combinedText.includes('assertionerror') ||
      combinedText.includes('expected') && combinedText.includes('received') ||
      combinedText.includes('tests failed')
    ) {
      category = 'TEST_FAILURE';
      confidence = combinedText.includes('assertionerror') || annotations.length > 0 ? 'HIGH' : 'MEDIUM';
      supportingEvidence.push(
        `Test runner assertion or execution failure detected in check '${check.name}'.`
      );
    }
    // 3. Lint Failure
    else if (
      combinedText.includes('eslint') ||
      combinedText.includes('lint') ||
      combinedText.includes('prettier') ||
      combinedText.includes('formatting')
    ) {
      category = 'LINT_FAILURE';
      confidence = annotations.length > 0 || combinedText.includes('eslint') ? 'HIGH' : 'MEDIUM';
      supportingEvidence.push(`Linter or code style rule violation in check '${check.name}'.`);
    }
    // 4. Build / Compilation Failure
    else if (
      combinedText.includes('build failed') ||
      combinedText.includes('compile error') ||
      combinedText.includes('vite build') ||
      combinedText.includes('webpack') ||
      combinedText.includes('syntaxerror')
    ) {
      category = 'BUILD_FAILURE';
      confidence = 'HIGH';
      supportingEvidence.push(`Build asset compilation error in check '${check.name}'.`);
    }
    // 5. Dependency Failure
    else if (
      combinedText.includes('module not found') ||
      combinedText.includes('cannot find module') ||
      combinedText.includes('npm err') ||
      combinedText.includes('yarn err') ||
      combinedText.includes('resolution failed')
    ) {
      category = 'DEPENDENCY_FAILURE';
      confidence = 'HIGH';
      supportingEvidence.push(`Unresolved dependency or package installation failure in '${check.name}'.`);
    }
    // 6. Timeout
    else if (
      check.providerConclusion === 'timed_out' ||
      check.normalizedStatus === 'TIMED_OUT' ||
      combinedText.includes('timed out') ||
      combinedText.includes('timeout')
    ) {
      category = 'TIMEOUT';
      confidence = 'HIGH';
      supportingEvidence.push(`Check execution exceeded time limit in '${check.name}'.`);
    }
    // 7. Permission Failure
    else if (
      combinedText.includes('permission denied') ||
      combinedText.includes('unauthorized') ||
      combinedText.includes('403 forbidden') ||
      combinedText.includes('token expired')
    ) {
      category = 'PERMISSION_FAILURE';
      confidence = 'HIGH';
      supportingEvidence.push(`Access or authorization denied during check '${check.name}'.`);
    }
    // 8. Configuration Failure
    else if (
      combinedText.includes('invalid configuration') ||
      combinedText.includes('workflow syntax error') ||
      combinedText.includes('yaml') ||
      combinedText.includes('missing env')
    ) {
      category = 'CONFIGURATION_FAILURE';
      confidence = 'MEDIUM';
      supportingEvidence.push(`CI workflow configuration or environment variable definition discrepancy in '${check.name}'.`);
    }
    // 9. External Service Failure
    else if (
      combinedText.includes('connection refused') ||
      combinedText.includes('503 service unavailable') ||
      combinedText.includes('econnrefused') ||
      combinedText.includes('github status')
    ) {
      category = 'EXTERNAL_SERVICE_FAILURE';
      confidence = 'MEDIUM';
      supportingEvidence.push(`External network or dependency service unreachable in '${check.name}'.`);
    }
    // 10. Environment Failure
    else if (
      combinedText.includes('runner') ||
      combinedText.includes('out of memory') ||
      combinedText.includes('enospc') ||
      combinedText.includes('docker')
    ) {
      category = 'ENVIRONMENT_FAILURE';
      confidence = 'MEDIUM';
      supportingEvidence.push(`Runner environment or hardware resource constraint in '${check.name}'.`);
    } else {
      category = 'UNKNOWN_FAILURE';
      confidence = 'LOW';
      supportingEvidence.push(
        `Check '${check.name}' reported failure with conclusion '${check.providerConclusion || check.providerStatus}', but detailed diagnostics could not be unambiguously categorized.`
      );
    }

    return {
      category,
      confidence,
      supportingEvidence: supportingEvidence.map(this.redactSecrets),
      sourceCheckName: check.name,
      sourceCheckId: check.id,
      relevantFiles,
      logExcerpts: logExcerpts.map(this.redactSecrets),
      annotations,
    };
  }

  /**
   * Section 5: Grounded Diagnosis
   *
   * Formulates a diagnosis for a failed check, clearly distinguishing VERIFIED_FACT,
   * EVIDENCE_BASED_INFERENCE, and UNKNOWN, and assessing correlation with the PR diff.
   */
  diagnoseCheckFailure(
    check: CheckItem,
    classification: FailureClassification,
    prChangedFiles: string[]
  ): CheckDiagnosis {
    const distinctions: DiagnosisEvidenceItem[] = [];

    // 1. Verified Fact: Provider result
    distinctions.push({
      type: 'VERIFIED_FACT',
      statement: `GitHub Check '${check.name}' (ID: ${check.id}) reported provider status '${check.providerStatus}' with conclusion '${check.providerConclusion || 'none'}'.`,
      source: `GitHub Check Run API: ${check.name}`,
    });

    // 2. Verified Fact / Unknown: Annotations
    if (check.annotations && check.annotations.length > 0) {
      distinctions.push({
        type: 'VERIFIED_FACT',
        statement: `GitHub reported ${check.annotations.length} direct failure annotation(s): ${check.annotations
          .map((a) => `${a.path}${a.startLine ? `:${a.startLine}` : ''}`)
          .slice(0, 3)
          .join(', ')}.`,
        source: 'GitHub Check Annotations API',
      });
    } else {
      distinctions.push({
        type: 'UNKNOWN',
        statement: `GitHub did not return check-run annotations or full container logs for check '${check.name}'.`,
        source: 'GitHub Check Annotations API',
      });
    }

    // 3. Diff Correlation & Relevance
    const matchingFiles = classification.relevantFiles.filter((rf) =>
      prChangedFiles.some((pf) => pf.toLowerCase() === rf.toLowerCase() || rf.endsWith(pf) || pf.endsWith(rf))
    );

    const relatedToPrDiff = matchingFiles.length > 0;
    let diffRelevanceReasoning = '';

    if (relatedToPrDiff) {
      diffRelevanceReasoning = `Failure correlates with file(s) modified in this PR: ${matchingFiles.map((f) => `\`${f}\``).join(', ')}.`;
      distinctions.push({
        type: 'EVIDENCE_BASED_INFERENCE',
        statement: `The failure is likely related to this pull request's modifications because failure location (${matchingFiles.join(', ')}) matches files in the PR diff.`,
        source: 'Cross-reference of PR changed files against check annotations',
      });
    } else if (classification.relevantFiles.length > 0) {
      diffRelevanceReasoning = `Failure occurs in file(s) NOT modified in this PR: ${classification.relevantFiles.map((f) => `\`${f}\``).join(', ')}. Failure may be pre-existing on base branch or infrastructure-related.`;
      distinctions.push({
        type: 'EVIDENCE_BASED_INFERENCE',
        statement: `The failure may NOT be caused by this pull request: failure files (${classification.relevantFiles.join(', ')}) were not modified in the PR diff.`,
        source: 'Cross-reference of PR changed files against check annotations',
      });
    } else {
      diffRelevanceReasoning = `Failure evidence does not pinpoint specific source files. Correlation with the PR diff cannot be verified without detailed container logs.`;
      distinctions.push({
        type: 'UNKNOWN',
        statement: `Unable to confirm or refute whether failure is caused by PR changes due to lack of file-level evidence from GitHub.`,
        source: 'Grounded Evidence Audit',
      });
    }

    // 4. Inferred Category
    distinctions.push({
      type: 'EVIDENCE_BASED_INFERENCE',
      statement: `Classified as ${classification.category} with ${classification.confidence} confidence based on check title and failure signals.`,
      source: 'COSInput Failure Classifier',
    });

    const failedCommandOrStep =
      check.summary && check.summary.includes('failed on')
        ? check.summary
        : check.name;

    const githubReportedSummary =
      check.summary || check.text || `Check concluded with '${check.providerConclusion || check.providerStatus}'.`;

    const additionalEvidenceRequired =
      check.annotations && check.annotations.length > 0
        ? undefined
        : 'Full workflow run logs or step console output from GitHub Actions.';

    return {
      checkName: check.name,
      checkId: check.id,
      failedCommandOrStep: this.redactSecrets(failedCommandOrStep),
      githubReportedSummary: this.redactSecrets(githubReportedSummary),
      likelyCategory: classification.category,
      relevantFiles: classification.relevantFiles,
      additionalEvidenceRequired,
      relatedToPrDiff,
      diffRelevanceReasoning,
      distinctions,
    };
  }

  /**
   * Section 6: Proposed Repair Plan
   *
   * Formulates candidate repair hypotheses and rerun verification commands.
   * Strictly non-executable in v0.5.1!
   */
  generateProposedRepairPlan(
    check: CheckItem,
    diagnosis: CheckDiagnosis,
    classification: FailureClassification
  ): ProposedRepairProposal {
    const hasSufficientEvidence = classification.confidence !== 'LOW';
    let rootCauseHypothesis = '';
    let proposedModification = '';
    let verificationCommandToRerun = 'npm test';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

    switch (classification.category) {
      case 'TYPECHECK_FAILURE':
        rootCauseHypothesis = `Type mismatch or missing property declaration identified in ${diagnosis.relevantFiles.join(', ') || check.name}.`;
        proposedModification = `Inspect type signatures and declarations in ${diagnosis.relevantFiles[0] || 'the affected source file'} and ensure assignment compatibility.`;
        verificationCommandToRerun = 'npx tsc --noEmit';
        riskLevel = 'LOW';
        break;

      case 'TEST_FAILURE':
        rootCauseHypothesis = `Test assertion failed or behavior deviated from expectations in test suite for '${check.name}'.`;
        proposedModification = `Review failed assertions in ${diagnosis.relevantFiles.join(', ') || 'test suite'}, align component logic or update test expectations if requirements evolved.`;
        verificationCommandToRerun = 'npm test';
        riskLevel = 'LOW';
        break;

      case 'LINT_FAILURE':
        rootCauseHypothesis = `Code style or linting rules violated in ${diagnosis.relevantFiles.join(', ') || check.name}.`;
        proposedModification = `Apply automated lint formatting or correct reported lint warnings in ${diagnosis.relevantFiles.join(', ') || 'modified files'}.`;
        verificationCommandToRerun = 'npm run lint';
        riskLevel = 'LOW';
        break;

      case 'BUILD_FAILURE':
        rootCauseHypothesis = `Build tooling failed to compile production bundle for '${check.name}'.`;
        proposedModification = `Verify import paths, syntax validity, and build configuration files.`;
        verificationCommandToRerun = 'npm run build';
        riskLevel = 'MEDIUM';
        break;

      case 'DEPENDENCY_FAILURE':
        rootCauseHypothesis = `Package resolution or peer dependency version conflict in '${check.name}'.`;
        proposedModification = `Check package.json and lockfile dependencies; ensure required module is listed in dependencies.`;
        verificationCommandToRerun = 'npm install && npm test';
        riskLevel = 'MEDIUM';
        break;

      case 'TIMEOUT':
        rootCauseHypothesis = `Job or step execution timed out before completion in '${check.name}'.`;
        proposedModification = `Inspect asynchronous operations or infinite loops; verify if timeout limits in CI configuration need adjustment.`;
        verificationCommandToRerun = 'npm test';
        riskLevel = 'MEDIUM';
        break;

      case 'CONFIGURATION_FAILURE':
        rootCauseHypothesis = `Discrepancy in CI workflow YAML or environment variables for '${check.name}'.`;
        proposedModification = `Review GitHub Actions workflow configuration in .github/workflows for syntax or environment variable prerequisites.`;
        verificationCommandToRerun = 'git status';
        riskLevel = 'HIGH';
        break;

      default:
        rootCauseHypothesis = `Unclassified failure in check '${check.name}'. Insufficient structured annotations to isolate root cause.`;
        proposedModification = `Inspect full raw GitHub workflow logs and run the project test suite locally to reproduce.`;
        verificationCommandToRerun = 'npm test';
        riskLevel = 'HIGH';
        break;
    }

    return {
      id: `repair-${check.id}`,
      failedCheckName: check.name,
      rootCauseHypothesis: this.redactSecrets(rootCauseHypothesis),
      evidenceSupportingHypothesis: classification.supportingEvidence,
      candidateFilesRequiringInspection: diagnosis.relevantFiles,
      proposedModification: this.redactSecrets(proposedModification),
      verificationCommandToRerun,
      riskLevel,
      confidenceLevel: classification.confidence,
      requiresFurtherInspection: !hasSufficientEvidence,
    };
  }

  /**
   * Section 2 & 8: Read-Only CI Status Inspection & Observation Construction
   *
   * Retrieves actual checks/status for the PR's current head SHA, deduplicates by
   * (repo + PR number + head SHA), and handles commit SHA changes gracefully.
   */
  async inspectPullRequestCi(
    upstreamOwner: string,
    upstreamRepo: string,
    prNumber: number,
    options?: { forceRefresh?: boolean; userToken?: string }
  ): Promise<GuardianObservation> {
    const effectiveToken = options?.userToken || userAuthStore.getUserToken() || undefined;
    const repoFullName = `${upstreamOwner}/${upstreamRepo}`;

    // 1. Fetch live PR details to obtain authenticated HEAD SHA
    const prDetails = await githubServerClient.getPullRequest(
      upstreamOwner,
      upstreamRepo,
      prNumber,
      effectiveToken
    );

    const currentHeadSha = prDetails.head.sha;
    const observationKey = `${repoFullName}:${prNumber}:${currentHeadSha}`;

    // Deduplication check: return existing observation if not forcing refresh
    if (!options?.forceRefresh && this.observations.has(observationKey)) {
      return this.observations.get(observationKey)!;
    }

    // New commit SHA check: if PR has previous observation with different head SHA,
    // mark that older observation as superseded so stale diagnosis is never applied.
    for (const [key, prevObs] of this.observations.entries()) {
      if (
        prevObs.pullRequest.upstreamRepository === repoFullName &&
        prevObs.pullRequest.prNumber === prNumber &&
        prevObs.headCommitSha !== currentHeadSha
      ) {
        prevObs.isSuperseded = true;
      }
    }

    // 2. Fetch modified files for PR diff correlation
    let prChangedFiles: string[] = [];
    try {
      const files = await githubServerClient.getPullRequestFiles(
        upstreamOwner,
        upstreamRepo,
        prNumber,
        effectiveToken
      );
      prChangedFiles = files.map((f) => f.filename);
    } catch {
      prChangedFiles = [];
    }

    const prSummary: GuardianPullRequestSummary = {
      upstreamRepository: repoFullName,
      upstreamOwner,
      upstreamRepo,
      prNumber,
      prUrl: prDetails.htmlUrl,
      prTitle: prDetails.title,
      prState: prDetails.state,
      headRepository: prDetails.head.repo?.fullName || repoFullName,
      headOwner: prDetails.head.repo?.owner || upstreamOwner,
      headRepo: prDetails.head.repo?.name || upstreamRepo,
      headBranch: prDetails.head.ref,
      headCommitSha: currentHeadSha,
      baseBranch: prDetails.base.ref,
      author: prDetails.author,
      mergeable: prDetails.mergeable,
      mergeableState: prDetails.mergeableState,
      prChangedFiles,
    };

    // 3. Fetch check runs and commit status for current head SHA
    const checks: CheckItem[] = [];

    try {
      const checkRunsData = await githubServerClient.getCommitCheckRuns(
        upstreamOwner,
        upstreamRepo,
        currentHeadSha,
        effectiveToken
      );

      for (const cr of checkRunsData.checkRuns) {
        const normalized = this.normalizeCheckStatus('check_run', cr.status, cr.conclusion);

        // Failure evidence retrieval
        let annotations: CheckAnnotation[] = [];
        if (normalized === 'FAILED' || normalized === 'TIMED_OUT' || normalized === 'CANCELLED') {
          try {
            annotations = await githubServerClient.getCheckRunAnnotations(
              upstreamOwner,
              upstreamRepo,
              cr.id,
              effectiveToken
            );
          } catch {
            annotations = [];
          }
        }

        checks.push({
          id: String(cr.id),
          name: cr.name,
          source: 'check_run',
          providerStatus: cr.status,
          providerConclusion: cr.conclusion,
          normalizedStatus: normalized,
          startedAt: cr.startedAt,
          completedAt: cr.completedAt,
          htmlUrl: cr.htmlUrl,
          detailsUrl: cr.detailsUrl,
          summary: cr.output.summary,
          text: cr.output.text,
          annotations,
        });
      }
    } catch {
      // Check runs endpoint failed or not permitted
    }

    // Also fetch legacy commit statuses (e.g. Jenkins, CircleCI, Travis)
    try {
      const combinedStatus = await githubServerClient.getCommitCombinedStatus(
        upstreamOwner,
        upstreamRepo,
        currentHeadSha,
        effectiveToken
      );

      for (const st of combinedStatus.statuses) {
        const normalized = this.normalizeCheckStatus('commit_status', st.state);
        checks.push({
          id: String(st.id),
          name: st.context,
          source: 'commit_status',
          providerStatus: st.state,
          providerConclusion: st.state,
          normalizedStatus: normalized,
          startedAt: st.createdAt,
          completedAt: st.updatedAt,
          detailsUrl: st.targetUrl,
          summary: st.description,
        });
      }
    } catch {
      // Status endpoint failed
    }

    // 4. Compute CI Summary & Cockpit State
    const totalChecks = checks.length;
    const passedCount = checks.filter((c) => c.normalizedStatus === 'PASSED').length;
    const failedCount = checks.filter((c) => c.normalizedStatus === 'FAILED').length;
    const queuedCount = checks.filter((c) => c.normalizedStatus === 'QUEUED').length;
    const inProgressCount = checks.filter((c) => c.normalizedStatus === 'IN_PROGRESS').length;
    const otherCount = totalChecks - (passedCount + failedCount + queuedCount + inProgressCount);

    let summaryConclusion: 'PASSED' | 'FAILED' | 'PENDING' | 'UNKNOWN' | 'NO_CHECKS' = 'NO_CHECKS';
    let cockpitState: GuardianCockpitState = 'CI_DATA_UNAVAILABLE';

    if (totalChecks === 0) {
      summaryConclusion = 'NO_CHECKS';
      cockpitState = 'CI_DATA_UNAVAILABLE';
    } else if (failedCount > 0 || checks.some((c) => c.normalizedStatus === 'TIMED_OUT' || c.normalizedStatus === 'CANCELLED')) {
      summaryConclusion = 'FAILED';
      cockpitState = 'CI_FAILURE_DETECTED';
    } else if (queuedCount > 0 || inProgressCount > 0) {
      summaryConclusion = 'PENDING';
      cockpitState = 'CI_PENDING';
    } else if (passedCount === totalChecks) {
      summaryConclusion = 'PASSED';
      cockpitState = 'CI_PASSING';
    } else {
      summaryConclusion = 'UNKNOWN';
      cockpitState = 'CI_PENDING';
    }

    // 5. Analyze Failures, Generate Classifications, Diagnoses, and Repair Proposals
    const classifications: FailureClassification[] = [];
    const diagnoses: CheckDiagnosis[] = [];
    const repairProposals: ProposedRepairProposal[] = [];
    let evidenceStatus: 'AVAILABLE' | 'EVIDENCE_UNAVAILABLE' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
    let evidenceUnavailableReason: string | undefined;

    const failedChecks = checks.filter(
      (c) => c.normalizedStatus === 'FAILED' || c.normalizedStatus === 'TIMED_OUT' || c.normalizedStatus === 'CANCELLED'
    );

    if (failedChecks.length > 0) {
      evidenceStatus = 'AVAILABLE';

      for (const fc of failedChecks) {
        const hasAnnotations = (fc.annotations && fc.annotations.length > 0) || Boolean(fc.summary || fc.text);
        if (!hasAnnotations) {
          evidenceStatus = 'EVIDENCE_UNAVAILABLE';
          evidenceUnavailableReason = `GitHub did not return check-run annotations or detailed logs for failed check '${fc.name}'. Check details may require higher token permissions or retention may have expired.`;
        }

        const classification = this.classifyFailure(fc, fc.annotations || []);
        classifications.push(classification);

        const diagnosis = this.diagnoseCheckFailure(fc, classification, prChangedFiles);
        diagnoses.push(diagnosis);

        const proposal = this.generateProposedRepairPlan(fc, diagnosis, classification);
        repairProposals.push(proposal);
      }

      if (evidenceStatus === 'EVIDENCE_UNAVAILABLE') {
        cockpitState = 'EVIDENCE_UNAVAILABLE';
      } else {
        cockpitState = 'DIAGNOSIS_READY';
      }
    }

    const observation: GuardianObservation = {
      id: observationKey,
      observedKey: observationKey,
      pullRequest: prSummary,
      headCommitSha: currentHeadSha,
      state: cockpitState,
      summary: {
        totalChecks,
        passedCount,
        failedCount,
        inProgressCount,
        queuedCount,
        otherCount,
        conclusion: summaryConclusion,
      },
      checks,
      classifications,
      diagnoses,
      repairProposals,
      evidenceStatus,
      evidenceUnavailableReason,
      observedAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
      isSuperseded: false,
    };

    this.observations.set(observationKey, observation);
    return observation;
  }

  /**
   * Section 8: Manual Refresh
   */
  async refreshPullRequestCi(
    upstreamOwner: string,
    upstreamRepo: string,
    prNumber: number,
    userToken?: string
  ): Promise<GuardianObservation> {
    return this.inspectPullRequestCi(upstreamOwner, upstreamRepo, prNumber, {
      forceRefresh: true,
      userToken,
    });
  }

  /**
   * Gets cached observation if present.
   */
  getObservation(repository: string, prNumber: number, headSha: string): GuardianObservation | null {
    const key = `${repository}:${prNumber}:${headSha}`;
    return this.observations.get(key) || null;
  }

  /**
   * Lists all current observations in the Guardian surveillance radar.
   */
  listObservations(): GuardianObservation[] {
    return Array.from(this.observations.values()).sort(
      (a, b) => new Date(b.lastRefreshedAt).getTime() - new Date(a.lastRefreshedAt).getTime()
    );
  }

  /**
   * =========================================================================
   * Section 9 & Strict v0.5.1 Boundary: Prevention of Every Remote Write Operation
   * =========================================================================
   *
   * Guardian must NOT:
   * - Edit repository files.
   * - Create commits.
   * - Push branches.
   * - Force-push.
   * - Rerun workflows.
   * - Cancel workflows.
   * - Create PR comments.
   * - Modify PR metadata.
   * - Merge PRs.
   * - Close PRs.
   * - Trigger the v0.4 implementation runner.
   */
  async executeRepair(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Read-only milestone active. Repair execution is strictly prohibited.'
    );
  }

  async createCommit(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Creating commits is strictly prohibited.'
    );
  }

  async pushBranch(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Pushing branches is strictly prohibited.'
    );
  }

  async forcePush(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Force-pushing is strictly prohibited.'
    );
  }

  async rerunWorkflow(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Rerunning workflows is strictly prohibited.'
    );
  }

  async cancelWorkflow(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Cancelling workflows is strictly prohibited.'
    );
  }

  async createPullRequestComment(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Creating PR comments is strictly prohibited.'
    );
  }

  async mergePullRequest(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Merging pull requests is strictly prohibited.'
    );
  }

  async closePullRequest(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Closing pull requests is strictly prohibited.'
    );
  }

  async triggerImplementationRunner(): Promise<never> {
    throw new Error(
      'Write operations are forbidden in COSInput Foundation v0.5.1 CI Guardian. Triggering implementation runner is strictly prohibited.'
    );
  }
}

export const ciGuardianService = new CIGuardianService();
