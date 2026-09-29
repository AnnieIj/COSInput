/**
 * COSInput - Server-Side GitHub Integration Types
 */

import type crypto from 'crypto';

export type GitHubConnectionState =
  | 'NOT_CONNECTED'
  | 'CONNECTION_PENDING'
  | 'CONNECTED'
  | 'APP_NOT_INSTALLED'
  | 'APP_INSTALLED'
  | 'ACCESS_RESTRICTED'
  | 'AUTH_FAILED'
  | 'API_UNAVAILABLE'
  | 'INSTALLATION_REVOKED';

export type GitHubErrorClassification =
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHORIZATION_FAILURE'
  | 'RATE_LIMIT'
  | 'NOT_FOUND'
  | 'GITHUB_SERVICE_FAILURE'
  | 'NETWORK_FAILURE';

export type RepositoryAccessStatus =
  | 'app_authorized'
  | 'public_readable'
  | 'write_not_authorized';

export type COSInputContributionStatus =
  | 'discovered'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'blocked';

export interface GitHubAppConfig {
  appId: string | null;
  appSlug: string | null;
  clientId: string | null;
  clientSecret: string | null;
  webhookSecret: string | null;
  privateKey: string | null;
  privateKeyObject: crypto.KeyObject | null;
  keyError?: SanitizedGitHubError;
  isConfigured: boolean;
}

export interface SanitizedGitHubError {
  classification: GitHubErrorClassification;
  statusCode: number;
  message: string;
  endpointCategory?: 'repository_metadata' | 'git_tree' | 'source_file' | 'issue_payload' | 'installation' | 'other';
  responseContentType?: string;
  documentationUrl?: string;
  retryAfterSeconds?: number;
}

export interface CachedInstallationToken {
  token: string;
  expiresAt: number; // Unix timestamp ms
}

export interface GitHubInstallationSummary {
  id: number;
  accountLogin: string;
  accountAvatarUrl: string;
  accountType: 'User' | 'Organization';
  repositorySelection: 'all' | 'selected';
  repositoriesCount?: number;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEventRecord {
  id: string;
  deliveryId: string;
  eventName: string;
  action?: string;
  repository?: string;
  sender?: string;
  receivedAt: string;
  classification: 'issue_activity' | 'pr_activity' | 'ci_check' | 'push_event' | 'installation_change' | 'other';
  safeSummary: string;
}

export interface GitHubUserProfile {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
  authSource: 'oauth' | 'installation_account' | 'user_discovery';
  authenticatedAt: string;
}

export interface GitHubAssignedIssueRef {
  id: string;
  number: number;
  repository: string;
  repositoryOwner: string;
  repositoryName: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: string;
  authorAvatarUrl?: string;
  labels: { name: string; color: string; description?: string }[];
  assignees: string[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  htmlUrl: string;
  repoAuthorizationStatus: RepositoryAccessStatus;
  writeAccessAuthorized: boolean;
  contributionStatus: COSInputContributionStatus;
}

export interface RepositoryAssignmentGroup {
  fullName: string;
  owner: string;
  name: string;
  repoAuthorizationStatus: RepositoryAccessStatus;
  writeAccessAuthorized: boolean;
  issuesCount: number;
  issues: GitHubAssignedIssueRef[];
}

export interface AssignmentSyncResult {
  success: boolean;
  count: number;
  lastSyncedAt: string;
  user: {
    login: string;
    avatarUrl?: string;
    id?: string;
  } | null;
  issues: GitHubAssignedIssueRef[];
  groupedByRepository: RepositoryAssignmentGroup[];
}

export type AnalysisStatus =
  | 'NOT_STARTED'
  | 'REPOSITORY_INSPECTION'
  | 'ISSUE_ANALYSIS'
  | 'PLAN_READY'
  | 'WAITING_FOR_APPROVAL'
  | 'APPROVED'
  | 'BLOCKED'
  | 'FAILED';

export type AcceptanceCriterionSource =
  | 'ISSUE'
  | 'REPOSITORY_DOCUMENTATION'
  | 'EXISTING_TEST'
  | 'CODE_CONTEXT'
  | 'INFERRED';

export type AcceptanceCriterionType =
  | 'FUNCTIONAL'
  | 'TEST'
  | 'BUILD'
  | 'LINT'
  | 'SECURITY'
  | 'DOCUMENTATION'
  | 'UX'
  | 'CONFIGURATION';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AcceptanceCriterion {
  id: string;
  description: string;
  source: AcceptanceCriterionSource;
  type: AcceptanceCriterionType;
  verificationStrategy: string;
  confidence: ConfidenceLevel;
}

export type RelevantFileCategory =
  | 'PRIMARY'
  | 'SUPPORTING'
  | 'TEST'
  | 'CONFIGURATION'
  | 'DOCUMENTATION';

export interface RelevantFile {
  path: string;
  category: RelevantFileCategory;
  reason: string;
  confidence: ConfidenceLevel;
  modificationLikely: boolean;
}

export type BlockerCategory =
  | 'MISSING_CANONICAL_INFORMATION'
  | 'AMBIGUOUS_REQUIREMENT'
  | 'REPOSITORY_ACCESS_LIMITATION'
  | 'MISSING_DEPENDENCY'
  | 'UNAVAILABLE_EXTERNAL_SERVICE'
  | 'CONFLICTING_REPOSITORY_INSTRUCTIONS'
  | 'UNSUPPORTED_PROJECT_STRUCTURE'
  | 'RATE_LIMIT'
  | 'AUTHENTICATION_FAILURE'
  | 'AUTHORIZATION_FAILURE'
  | 'INSUFFICIENT_CODE_CONTEXT';

export interface BlockerItem {
  id: string;
  category: BlockerCategory;
  description: string;
  evidence: string;
  impact: string;
  recommendedNextAction: string;
}

export interface RepositoryInstructionItem {
  category:
    | 'coding_conventions'
    | 'testing_requirements'
    | 'formatting'
    | 'branch_expectations'
    | 'pr_expectations'
    | 'generated_files'
    | 'prohibited_modifications'
    | 'repository_commands';
  title: string;
  details: string;
  sourceFile: string;
}

export interface ExternalConfigurationItem {
  name: string;
  category: 'env_var' | 'service_endpoint' | 'contract_abi' | 'network_id' | 'secret' | 'other';
  status: 'detected' | 'missing_canonical' | 'optional';
  description: string;
}

export interface DependencyConfigAnalysis {
  framework: string;
  language: string;
  packageManager: string;
  runtime: string;
  majorDependencies: string[];
  testFramework: string;
  lintTooling: string;
  buildTooling: string;
  ciSystem: string;
  externalConfiguration: ExternalConfigurationItem[];
  scripts?: Record<string, string>;
}

export interface IssueIntelligenceData {
  problemStatement: string;
  requestedBehavior: string;
  expectedBehavior: string;
  explicitRequirements: string[];
  inferredRequirements: string[];
  unknownsAndQuestions: string[];
  filesMentioned: string[];
  apisMentioned: string[];
  dependenciesMentioned: string[];
  testsRequested: string[];
  documentationRequirements: string[];
  constraints: string[];
  securityConsiderations: string[];
  outOfScopeItems: string[];
}

export type ChangeRole =
  | 'MODIFICATION'
  | 'INSPECTION_ONLY'
  | 'EXISTING_TEST'
  | 'NEW_OR_UPDATED_TEST';

export interface ProposedChange {
  id: string;
  targetFile: string;
  description: string;
  mappedAcceptanceCriteriaIds: string[];
  changeRole?: ChangeRole;
  existingBehavior?: string;
  specificChange?: string;
  necessityExplanation?: string;
  verificationStrategy?: string;
  evidenceSnippet?: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
  inspectedSha?: string;
  lineReferences?: string;
}

export interface HistoricalPlanRecord {
  attemptId: string;
  completedAt: string;
  plan: ImplementationPlan;
  acceptanceCriteria: AcceptanceCriterion[];
  status: 'superseded' | 'historical';
}

export interface VerifiedRepositorySnapshot {
  timestamp: string;
  repositoryIntelligence: RepositoryIntelligenceData;
  dependencyConfig: DependencyConfigAnalysis;
  status: 'verified';
}

export interface ImplementationPlan {
  issueSummary: string;
  repositoryUnderstanding: string;
  proposedChanges: ProposedChange[];
  testsToRun: string[];
  buildLintVerification: string[];
  risks: string[];
  blockers: string[];
  outOfScopeItems: string[];
  estimatedChangeSurface: 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNSPECIFIED';
}

export interface RepositoryIntelligenceData {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  stars: number;
  forks: number;
  openIssuesCount: number;
  isPrivate: boolean;
  discoveredInstructionFiles: string[];
  discoveredInstructions: RepositoryInstructionItem[];
  workflowFiles: string[];
  relevantSourceDirs: string[];
  relevantTestDirs: string[];
  totalTreeFilesCount: number;
  sampleTreeFiles: string[];
  allTreeFiles?: string[];
}

export interface ActivityTimelineItem {
  id: string;
  stage: string;
  timestamp: string;
  detail: string;
  completed: boolean;
  active?: boolean;
}

export type PreparationStatus =
  | 'PLAN_APPROVED'
  | 'FORK_DISCOVERY'
  | 'AUTHORIZATION_REQUIRED'
  | 'FORK_CREATION_APPROVAL_REQUIRED'
  | 'WORKSPACE_PREPARING'
  | 'WORKSPACE_READY'
  | 'PREPARATION_FAILED'
  | 'REANALYSIS_REQUIRED';

export interface ContributorForkInfo {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  isFork: boolean;
  parentFullName?: string;
  hasWritePermission: boolean;
}

export interface WorkspacePendingOperation {
  type: 'create_fork' | 'create_branch';
  description: string;
  targetRepository: string;
  targetBranch?: string;
  requiredPermissionScope: string;
}

export interface WorkspacePreparationData {
  executionRunId: string;
  status: PreparationStatus;
  contributorIdentity: string;
  upstreamRepository: string;
  selectedIssueNumber: number;
  approvedAnalysisAttemptId: string;
  approvedPlanVersion: string;
  baseBranch: string;
  baseCommitSha: string;
  approvedCommitSha?: string;
  contributorFork: ContributorForkInfo | null;
  branchName: string;
  branchCreated?: boolean;
  preparedAt?: string;
  errorMessage?: string;
  pendingOperation?: WorkspacePendingOperation | null;
}

export interface ContributionSession {
  id: string;
  repositoryOwner: string;
  repositoryName: string;
  upstreamRepository: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  contributorUsername: string;
  repositoryAccessStatus: RepositoryAccessStatus;
  analysisStatus: AnalysisStatus;
  preparationStatus?: PreparationStatus;
  workspacePreparation?: WorkspacePreparationData | null;
  baseCommitSha?: string;
  approvedCommitSha?: string;
  createdTimestamp: string;
  updatedTimestamp: string;
  currentAttemptId?: string;
  currentAttemptStatus?: 'NOT_STARTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  lastVerifiedSnapshot?: VerifiedRepositorySnapshot | null;
  historicalPlans?: HistoricalPlanRecord[];
  repositoryIntelligence: RepositoryIntelligenceData | null;
  issueIntelligence: IssueIntelligenceData | null;
  acceptanceCriteria: AcceptanceCriterion[];
  relevantFiles: RelevantFile[];
  dependenciesAndConfig: DependencyConfigAnalysis | null;
  blockers: BlockerItem[];
  implementationPlan: ImplementationPlan | null;
  humanApproval: {
    status: 'pending' | 'approved' | 'revision_requested' | 'cancelled';
    approvedAt?: string;
    feedback?: string;
  };
  activityTimeline: ActivityTimelineItem[];
  errorMessage?: string;
  executionRun?: ImplementationRunState | null;
  currentSubmission?: SubmissionRecord | null;
  submissionHistory?: SubmissionRecord[];
  customCloneSource?: string;
  requireAuthenticCheckout?: boolean;
}

export type ExecutionStatus =
  | 'NOT_STARTED'
  | 'PREVIEW_READY'
  | 'APPROVAL_REQUIRED'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'REPAIRING'
  | 'STOPPED'
  | 'FAILED'
  | 'SUCCEEDED';

export interface ImplementationPreview {
  upstreamRepository: string;
  issueNumber: number;
  issueTitle: string;
  executionRunId: string;
  selectedBranch: string;
  baseBranch: string;
  baseCommitSha: string;
  approvedPlanVersion: string;
  filesProposed: {
    path: string;
    description: string;
    changeRole: string;
    mappedCriteriaIds: string[];
  }[];
  plannedVerificationCommands: {
    type: 'test' | 'typecheck' | 'lint' | 'build';
    command: string;
    reason: string;
  }[];
  eligibilityCheck: {
    eligible: boolean;
    reasons: string[];
  };
}

export interface ExecutionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  step: string;
}

export interface ModifiedFileResult {
  path: string;
  status: 'modified' | 'created' | 'deleted';
  diffSummary: string;
  originalLength: number;
  modifiedLength: number;
}

export interface VerificationResultItem {
  id: string;
  type: 'diff_review' | 'test' | 'typecheck' | 'lint' | 'build';
  command: string;
  exitCode: number;
  outputSummary: string;
  passed: boolean;
  timestamp: string;
  durationMs: number;
}

export interface AcceptanceCriterionEvidence {
  criterionId: string;
  description: string;
  verified: boolean;
  evidence: string;
  commandUsed?: string;
}

export interface RepairAttemptRecord {
  attemptNumber: number;
  failedVerificationType: string;
  identifiedError: string;
  targetSource: string;
  correctionApplied: string;
  rerunPassed: boolean;
  timestamp: string;
}

export interface PlanDiscrepancy {
  type: 'MISSING_FILE' | 'INCOMPATIBLE_CODE' | 'UNRESOLVED_DEPENDENCY';
  file: string;
  details: string;
  detectedAt: string;
}

export interface ImplementationFinalReport {
  executionRunId: string;
  upstreamRepository: string;
  branchName: string;
  changedFiles: string[];
  implementedFunctionality: string[];
  testsPerformed: {
    command: string;
    exitCode: number;
    summary: string;
    passed: boolean;
  }[];
  acceptanceEvidence: {
    criterionId: string;
    criterion: string;
    status: 'VERIFIED' | 'FAILED';
    evidence: string;
  }[];
  actualResults: 'SUCCESS' | 'FAILED' | 'REPAIR_EXHAUSTED' | 'STOPPED';
  unresolvedLimitations: string[];
  nextRequiredHumanApproval: string;
  completedAt: string;
}

export type WorkspaceExecutionMode = 'REAL_GIT_WORKSPACE' | 'SIMULATED_TEST_ENVIRONMENT';

export type SubmissionStatus =
  | 'REVIEW_READY'
  | 'COMMIT_APPROVAL_REQUIRED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'PUSH_APPROVAL_REQUIRED'
  | 'PUSHING'
  | 'PUSHED'
  | 'PR_APPROVAL_REQUIRED'
  | 'PR_CREATING'
  | 'PR_OPENED'
  | 'SUBMISSION_FAILED'
  | 'CONFLICT_REQUIRES_REVIEW';

export interface SubmissionReviewData {
  canonicalUpstream: string;
  contributorFork: string;
  issueNumber: number;
  issueTitle: string;
  sourceBranch: string;
  targetBranch: string;
  approvedPlanVersion: string;
  actualChangedFiles: string[];
  gitDiff: string;
  verificationResults: VerificationResultItem[];
  acceptanceCriteriaEvidence: AcceptanceCriterionEvidence[];
  proposedCommitMessage: string;
  proposedPrTitle: string;
  proposedPrDescription: string;
  isExecutionReal: boolean;
  executionEnvironment: WorkspaceExecutionMode;
  hasVerificationFailure: boolean;
  existingPrFound: boolean;
  existingPr?: {
    number: number;
    htmlUrl: string;
    title: string;
    state: string;
  } | null;
}

export interface CommitRecord {
  sha: string;
  message: string;
  stagedFiles: string[];
  executionRunId: string;
  approvedAt: string;
  author: string;
}

export interface SubmissionRecord {
  id: string;
  sessionId: string;
  executionRunId: string;
  status: SubmissionStatus;
  executionEnvironment: WorkspaceExecutionMode;
  upstreamRepository: string;
  contributorFork: string;
  sourceBranch: string;
  targetBranch: string;
  approvedPlanVersion: string;
  stagedFiles: string[];
  gitDiff: string;
  commitSha?: string;
  commitMessage?: string;
  commitApprovedAt?: string;
  pushApprovedAt?: string;
  pushedAt?: string;
  prApprovedAt?: string;
  prOpenedAt?: string;
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  prDescription?: string;
  existingPrFound?: boolean;
  existingPr?: {
    number: number;
    htmlUrl: string;
    title: string;
    state: string;
  } | null;
  verificationResults: VerificationResultItem[];
  proceedDespiteFailureAck?: boolean;
  divergenceDetails?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImplementationRunState {
  id: string;
  sessionId: string;
  status: ExecutionStatus;
  executionEnvironment?: WorkspaceExecutionMode;
  preview: ImplementationPreview;
  startedAt?: string;
  completedAt?: string;
  stoppedAt?: string;
  stopRequested?: boolean;
  logs: ExecutionLogEntry[];
  generatedDiff?: string;
  modifiedFiles: ModifiedFileResult[];
  verificationResults: VerificationResultItem[];
  acceptanceCriteriaEvidence: AcceptanceCriterionEvidence[];
  repairAttempts: RepairAttemptRecord[];
  repairCount: number;
  maxRepairs: number;
  planDiscrepancy?: PlanDiscrepancy | null;
  finalReport?: ImplementationFinalReport | null;
  errorMessage?: string;
}
