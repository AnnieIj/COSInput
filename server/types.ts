/**
 * COSInput - Server-Side GitHub Integration Types
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

import type crypto from 'crypto';

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
