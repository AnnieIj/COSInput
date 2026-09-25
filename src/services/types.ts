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
