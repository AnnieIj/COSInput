/**
 * COSInput Presentation Domain Types
 * Used strictly for demo & prototype presentation layer.
 */

export interface RepositoryItem {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  openIssuesCount: number;
  activePRsCount: number;
  isWatching: boolean;
  techStack: string[];
  lastSynced: string;
}

export interface IssueItem {
  id: string;
  number: number;
  repository: string;
  title: string;
  summary: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  status: 'triage' | 'active_contribution' | 'review' | 'merged';
  labels: { text: string; color: string }[];
  acceptanceCriteriaCount: number;
  activeRunId?: string;
  activeContributionId?: string;
}

export interface PipelineStep {
  number: number;
  name: string;
  status: 'completed' | 'active' | 'pending' | 'blocked';
  subtext?: string;
}

export interface ExecutionPlanItem {
  id: string;
  order: number;
  title: string;
  status: 'completed' | 'in_progress' | 'blocked' | 'pending';
  statusLabel: string;
  governanceTag: string;
  blockedReason?: string;
}

export interface StagedFileItem {
  path: string;
  additions: number;
  deletions: number;
  status: 'Modified' | 'New File' | 'Deleted';
}

export interface AcceptanceCriterionItem {
  id: string;
  title: string;
  status: 'Passed' | 'Blocked' | 'Pending';
  evidencePath?: string;
  statusNote?: string;
}

export interface SessionActivityItem {
  time: string;
  text: string;
  type?: 'neutral' | 'agent' | 'user' | 'success';
}

export interface PRHealthStatusCard {
  id: string;
  title: string;
  badgeText: string;
  badgeVariant: 'error' | 'success' | 'info' | 'neutral' | 'warning';
  primaryValue: string;
  primarySubtext?: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  actionIcon?: string;
  topStripeColor: string;
}

export interface FailureClassificationCard {
  id: string;
  title: string;
  badge: string;
  badgeVariant: 'neutral' | 'error' | 'secondary';
  description: string;
  actionLabel: string;
  actionIcon: string;
  highlighted?: boolean;
}

export interface AuditTimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  quote?: string;
  sourceBadge: string;
  badgeVariant: 'maintainer' | 'agent_prepared' | 'agent_diagnosed' | 'ci_failed' | 'ci_passed' | 'user_approved' | 'workflow';
  icon: string;
  iconBg: string;
  iconColor: string;
}

export interface ContinuousRunCheckpoint {
  id: string;
  phase: 1 | 2;
  phaseLabel: string;
  title: string;
  duration: string;
  tag: string;
  tagVariant: 'agent' | 'github_verified' | 'sandbox' | 'user_approved' | 'local_verified' | 'maintainer';
  description: string;
  status: 'completed' | 'failed' | 'running' | 'waiting' | 'done';
}

export interface DiffLineItem {
  oldLineNumber?: number | string;
  newLineNumber?: number | string;
  sign: ' ' | '+' | '-';
  content: string;
  variant: 'normal' | 'added' | 'removed';
}
