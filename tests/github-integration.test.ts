/**
 * COSInput Foundation v0.2 - GitHub Integration Test Suite
 * Tests error classification, webhook HMAC verification, event storage,
 * safety invariants (read-only enforcement), and multiline/escaped PEM key loading & validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { classifyGitHubError } from '../server/githubClient';
import { verifyGitHubWebhookSignature, processVerifiedWebhook } from '../server/webhookHandler';
import { recordWebhookEvent, getRecentWebhookEvents, clearWebhookEvents } from '../server/eventStore';
import { normalizeAndValidatePrivateKey } from '../server/config';
import { RealGitHubService } from '../src/services/github.service';

describe('GitHub Error Classification', () => {
  it('classifies 401 as AUTHENTICATION_FAILURE', () => {
    const error = classifyGitHubError(401, 'Bad credentials');
    expect(error.classification).toBe('AUTHENTICATION_FAILURE');
    expect(error.statusCode).toBe(401);
  });

  it('classifies 403 as AUTHORIZATION_FAILURE by default', () => {
    const error = classifyGitHubError(403, 'Resource not accessible by integration');
    expect(error.classification).toBe('AUTHORIZATION_FAILURE');
    expect(error.statusCode).toBe(403);
  });

  it('classifies 403 with zero remaining rate limit as RATE_LIMIT', () => {
    const headers = new Headers();
    headers.set('x-ratelimit-remaining', '0');
    const error = classifyGitHubError(403, 'API rate limit exceeded', headers);
    expect(error.classification).toBe('RATE_LIMIT');
  });

  it('classifies 429 as RATE_LIMIT and extracts retry-after', () => {
    const headers = new Headers();
    headers.set('retry-after', '60');
    const error = classifyGitHubError(429, 'Too many requests', headers);
    expect(error.classification).toBe('RATE_LIMIT');
    expect(error.retryAfterSeconds).toBe(60);
  });

  it('classifies 404 as NOT_FOUND', () => {
    const error = classifyGitHubError(404, 'Not Found');
    expect(error.classification).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('classifies 500+ as GITHUB_SERVICE_FAILURE', () => {
    const error = classifyGitHubError(503, 'Service Unavailable');
    expect(error.classification).toBe('GITHUB_SERVICE_FAILURE');
    expect(error.statusCode).toBe(503);
  });
});

describe('GitHub App Private Key Normalization & Validation', () => {
  // Generate real test RSA keys (PKCS#1 and PKCS#8)
  const { privateKey: rsaPkcs1 } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  const { privateKey: rsaPkcs8 } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  it('successfully parses raw multiline PKCS#1 PEM with preserved newlines', () => {
    const result = normalizeAndValidatePrivateKey(rsaPkcs1);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
    expect(result.keyObject?.type).toBe('private');
    expect(result.keyObject?.asymmetricKeyType).toBe('rsa');
    expect(result.pem).toContain('-----BEGIN RSA PRIVATE KEY-----');
  });

  it('successfully parses raw multiline PKCS#8 PEM with preserved newlines', () => {
    const result = normalizeAndValidatePrivateKey(rsaPkcs8);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
    expect(result.keyObject?.type).toBe('private');
    expect(result.keyObject?.asymmetricKeyType).toBe('rsa');
    expect(result.pem).toContain('-----BEGIN PRIVATE KEY-----');
  });

  it('successfully parses single-line strings with literal escaped \\n', () => {
    const escaped = rsaPkcs1.replace(/\n/g, '\\n');
    const result = normalizeAndValidatePrivateKey(escaped);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
    expect(result.keyObject?.asymmetricKeyType).toBe('rsa');
  });

  it('successfully parses keys wrapped in double quotes', () => {
    const quoted = `"${rsaPkcs1.replace(/\n/g, '\\n')}"`;
    const result = normalizeAndValidatePrivateKey(quoted);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
  });

  it('successfully parses keys wrapped in single quotes', () => {
    const singleQuoted = `'${rsaPkcs1.replace(/\n/g, '\\n')}'`;
    const result = normalizeAndValidatePrivateKey(singleQuoted);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
  });

  it('successfully parses keys with escaped quotes \\" ... \\"', () => {
    const escapedQuotes = `\\"${rsaPkcs1.replace(/\n/g, '\\n')}\\"`;
    const result = normalizeAndValidatePrivateKey(escapedQuotes);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
  });

  it('successfully parses keys where newlines are collapsed into spaces', () => {
    const spaced = rsaPkcs1.replace(/\r?\n/g, ' ');
    const result = normalizeAndValidatePrivateKey(spaced);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
  });

  it('successfully parses base64-encoded PEM strings', () => {
    const b64 = Buffer.from(rsaPkcs1, 'utf8').toString('base64');
    const result = normalizeAndValidatePrivateKey(b64);
    expect(result.error).toBeUndefined();
    expect(result.keyObject).not.toBeNull();
  });

  it('returns sanitized AUTHENTICATION_FAILURE for corrupt or invalid keys without leaking OpenSSL internals', () => {
    const corruptKey = '-----BEGIN RSA PRIVATE KEY-----\nNOT_A_VALID_BASE64_OR_RSA_KEY\n-----END RSA PRIVATE KEY-----';
    const result = normalizeAndValidatePrivateKey(corruptKey);

    expect(result.keyObject).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.classification).toBe('AUTHENTICATION_FAILURE');
    expect(result.error?.statusCode).toBe(401);

    // CRITICAL: Must NEVER expose OpenSSL internals
    expect(result.error?.message).not.toContain('DECODER routines');
    expect(result.error?.message).not.toContain('error:1E08010C');
    // Must NEVER leak the key material
    expect(result.error?.message).not.toContain(corruptKey);
  });

  it('returns sanitized AUTHENTICATION_FAILURE for missing BEGIN/END delimiters', () => {
    const result = normalizeAndValidatePrivateKey('invalid-arbitrary-text-secret');
    expect(result.keyObject).toBeNull();
    expect(result.error?.classification).toBe('AUTHENTICATION_FAILURE');
    expect(result.error?.statusCode).toBe(401);
  });

  it('returns null keyObject when key is empty or null', () => {
    expect(normalizeAndValidatePrivateKey(null).keyObject).toBeNull();
    expect(normalizeAndValidatePrivateKey('').keyObject).toBeNull();
  });
});

describe('Webhook HMAC SHA-256 Verification', () => {
  const secret = 'super-secret-webhook-key-123';
  const payload = JSON.stringify({ action: 'opened', issue: { number: 42 } });
  const rawBody = Buffer.from(payload, 'utf8');

  it('validates genuine HMAC-SHA256 signature', () => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const validSignature = `sha256=${hmac.digest('hex')}`;

    const isValid = verifyGitHubWebhookSignature(rawBody, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it('rejects tampered payload or incorrect secret', () => {
    const invalidSignature = 'sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const isValid = verifyGitHubWebhookSignature(rawBody, invalidSignature, secret);
    expect(isValid).toBe(false);
  });

  it('rejects missing or malformed signature', () => {
    expect(verifyGitHubWebhookSignature(rawBody, undefined, secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(rawBody, 'not-a-sha256-prefix', secret)).toBe(false);
  });
});

describe('Webhook Event Processing & Store', () => {
  beforeEach(() => {
    clearWebhookEvents();
  });

  it('processes issue event and generates safe summary without leaking sensitive data', () => {
    const payload = {
      action: 'opened',
      repository: { full_name: 'acme/webapp' },
      issue: { number: 101, title: 'Bug in checkout' },
    };

    const record = processVerifiedWebhook('deliv-1', 'issues', payload);
    expect(record.eventName).toBe('issues');
    expect(record.action).toBe('opened');
    expect(record.safeSummary).toContain('Issue #101 opened');

    const stored = getRecentWebhookEvents(10);
    expect(stored.length).toBe(1);
    expect(stored[0].deliveryId).toBe('deliv-1');
  });

  it('maintains ring buffer capacity without memory leaks', () => {
    for (let i = 0; i < 120; i++) {
      recordWebhookEvent({
        id: `evt-${i}`,
        deliveryId: `deliv-${i}`,
        eventName: 'push',
        action: 'pushed',
        receivedAt: new Date().toISOString(),
        safeSummary: `Event ${i}`,
        classification: 'push_event',
      });
    }

    const events = getRecentWebhookEvents(150);
    expect(events.length).toBeLessThanOrEqual(100); // MAX_EVENTS = 100
    expect(events[0].safeSummary).toBe('Event 119'); // Most recent first
  });
});

describe('Safety Invariants: v0.2 Read-Only Enforcement', () => {
  const service = new RealGitHubService();

  it('strictly forbids createBranch', async () => {
    await expect(
      service.createBranch('owner', 'repo', 'feature-branch', 'sha123')
    ).rejects.toThrow(/Write operations are forbidden in COSInput Foundation v0.2/);
  });

  it('strictly forbids pushCommit', async () => {
    await expect(
      service.pushCommit('owner', 'repo', 'main', 'Commit message', [])
    ).rejects.toThrow(/Write operations are forbidden in COSInput Foundation v0.2/);
  });

  it('strictly forbids retriggerWorkflowRun', async () => {
    await expect(
      service.retriggerWorkflowRun('owner', 'repo', 12345)
    ).rejects.toThrow(/Workflow reruns are forbidden in COSInput Foundation v0.2/);
  });
});
