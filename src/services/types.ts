/**
 * COSInput - Integration Service Types & Signatures
 * Note: These are contract definitions for future real integrations.
 * Current implementation uses explicit stubs; no live connections are claimed.
 */

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
  openPRsCount: number;
}

export interface GitHubIssueRef {
  number: number;
  title: string;
  body: string;
  labels: string[];
  state: 'open' | 'closed';
  author: string;
  createdAt: string;
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
