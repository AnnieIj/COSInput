/**
 * COSInput - GitHub Webhook Signature Verification & Event Routing
 * Verifies HMAC SHA-256 signatures, classifies events, and logs safe audit metadata.
 * Strictly read-only / event-driven foundation: zero automatic code pushes or repository writes.
 */

import crypto from 'crypto';
import { getGitHubAppConfig } from './config';
import { recordWebhookEvent } from './eventStore';
import { invalidateInstallationToken } from './githubAppAuth';
import type { WebhookEventRecord } from './types';

/**
 * Validates the GitHub webhook signature using HMAC SHA-256 and timingSafeEqual.
 */
export function verifyGitHubWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7); // remove 'sha256='
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const calculatedBuf = Buffer.from(calculatedSignature, 'utf8');

  if (expectedBuf.length !== calculatedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
}

/**
 * Classifies GitHub webhook events for Guardian event-driven architecture.
 */
export function classifyWebhookEvent(
  eventName: string,
  action?: string
): WebhookEventRecord['classification'] {
  if (eventName === 'issues' || eventName === 'issue_comment') {
    return 'issue_activity';
  }
  if (eventName.startsWith('pull_request')) {
    return 'pr_activity';
  }
  if (eventName === 'check_run' || eventName === 'check_suite' || eventName === 'workflow_run') {
    return 'ci_check';
  }
  if (eventName === 'push') {
    return 'push_event';
  }
  if (eventName === 'installation' || eventName === 'installation_repositories') {
    return 'installation_change';
  }
  return 'other';
}

/**
 * Processes incoming verified webhook event safely.
 */
export function processVerifiedWebhook(
  deliveryId: string,
  eventName: string,
  payload: any
): WebhookEventRecord {
  const action = payload.action;
  const classification = classifyWebhookEvent(eventName, action);
  const repository = payload.repository?.full_name;
  const sender = payload.sender?.login;

  let safeSummary = `${eventName}${action ? `.${action}` : ''}`;
  if (payload.issue?.number) {
    safeSummary = `Issue #${payload.issue.number} ${action || 'activity'}`;
  } else if (payload.pull_request?.number) {
    safeSummary = `PR #${payload.pull_request.number} ${action || 'activity'}`;
  } else if (payload.check_run?.name) {
    safeSummary = `Check ${payload.check_run.name} ${payload.check_run.status || action || 'event'}`;
  }
  if (repository) {
    safeSummary += ` in ${repository}`;
  }

  // Handle installation invalidation if app installation was deleted or suspended
  if (eventName === 'installation' && (action === 'deleted' || action === 'suspend')) {
    if (payload.installation?.id) {
      invalidateInstallationToken(payload.installation.id);
    }
  }

  const record: WebhookEventRecord = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    deliveryId,
    eventName,
    action,
    repository,
    sender,
    receivedAt: new Date().toISOString(),
    classification,
    safeSummary,
  };

  recordWebhookEvent(record);
  return record;
}
