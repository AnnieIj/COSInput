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
  authSource: 'oauth' | 'installation_account';
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
