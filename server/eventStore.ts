/**
 * COSInput - Event-Driven Guardian In-Memory Event Store
 * Stores safe sanitized webhook metadata for Guardian event surveillance.
 * No sensitive payloads or tokens are retained.
 */

import type { WebhookEventRecord } from './types';

const MAX_EVENTS = 100;
const eventLog: WebhookEventRecord[] = [];

export function recordWebhookEvent(record: WebhookEventRecord): void {
  eventLog.unshift(record);
  if (eventLog.length > MAX_EVENTS) {
    eventLog.pop();
  }
}

export function getRecentWebhookEvents(limit = 20): WebhookEventRecord[] {
  return eventLog.slice(0, limit);
}

export function clearWebhookEvents(): void {
  eventLog.length = 0;
}
