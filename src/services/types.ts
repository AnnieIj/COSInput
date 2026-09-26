/**
 * COSInput - Integration Service Types & Signatures
 * Defines domain contracts for real GitHub App integration and execution services.
 */

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

export interface SanitizedGitHubError {
  classification: GitHubErrorClassification;
  statusCode: number;
  message: string;
  documentationUrl?: string;
  retryAfterSeconds?: number;
}

export interface GitHubUser {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
  authorized: boolean;
  syncedAt: string;
}

export interface GitHubUserProfile {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
  authSource: 'oauth' | 'installation_account' | 'user_discovery';
  authenticatedAt: string;
}

export interface GitHubRepoSummary {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  openIssuesCount: number;
  stars: number;
  forks: number;
  updatedAt: string;
  description: string;
  htmlUrl: string;
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  };
}

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

export interface GitHubIssueRef {
  id: string;
  number: number;
  repository: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: string;
  authorAvatarUrl: string;
  labels: { name: string; color: string; description?: string }[];
  assignees: string[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  htmlUrl: string;
}

export interface GitHubIssueCommentRef {
  id: string;
  author: string;
  authorAvatarUrl: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
}

export interface GitHubDirectoryItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

export interface GitHubPRRef {
  number: number;
  title: string;
  branch: string;
  base: string;
  headSha: string;
  state: 'open' | 'closed' | 'merged';
  isDraft: boolean;
  mergeable: boolean | null;
  commitsCount: number;
}

export interface AgentPlanStep {
  id: string;
  order: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  blockedReason?: string;
  userApproved: boolean;
}

export interface StagedFileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface SandboxExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  completedAt: string;
}

export interface AcceptanceCriterionResult {
  id: string;
  criterionText: string;
  status: 'passed' | 'failed' | 'blocked' | 'pending';
  evidencePath?: string;
  details?: string;
}

export interface GuardianAssessment {
  prNumber: number;
  readinessScore: number;
  isMergeReady: boolean;
  ciCheckState: 'passed' | 'failed' | 'running';
  acceptanceState: 'passed' | 'failed' | 'blocked';
  conflictState: 'clean' | 'conflicted';
  maintainerReviewState: 'approved' | 'changes_requested' | 'pending';
  humanGovernanceSignoff: boolean;
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

export interface ProposedChange {
  id: string;
  targetFile: string;
  description: string;
  mappedAcceptanceCriteriaIds: string[];
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
  createdTimestamp: string;
  updatedTimestamp: string;
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
}
