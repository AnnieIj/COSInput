/**
 * COSInput - Server-Side Configuration
 * Reads GitHub App credentials strictly from server environment variables.
 * Never logs secrets. Never sends secrets to the browser.
 */

import dotenv from 'dotenv';
import type { GitHubAppConfig } from './types';

dotenv.config();

function parsePrivateKey(): string | null {
  const rawKey = process.env.GITHUB_PRIVATE_KEY;
  if (rawKey && rawKey.trim()) {
    // Replace literal '\n' sequences if stored in single-line env var
    return rawKey.replace(/\\n/g, '\n').trim();
  }

  const base64Key = process.env.GITHUB_PRIVATE_KEY_BASE64;
  if (base64Key && base64Key.trim()) {
    try {
      const decoded = Buffer.from(base64Key.trim(), 'base64').toString('utf8');
      if (decoded.includes('BEGIN') && decoded.includes('PRIVATE KEY')) {
        return decoded.trim();
      }
    } catch {
      // In case decoding fails, do not throw or leak; return null
      return null;
    }
  }

  return null;
}

export function getGitHubAppConfig(): GitHubAppConfig {
  const appId = process.env.GITHUB_APP_ID?.trim() || null;
  const appSlug = process.env.GITHUB_APP_SLUG?.trim() || null;
  const clientId = process.env.GITHUB_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || null;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim() || null;
  const privateKey = parsePrivateKey();

  const isConfigured = Boolean(appId && privateKey);

  return {
    appId,
    appSlug,
    clientId,
    clientSecret,
    webhookSecret,
    privateKey,
    isConfigured,
  };
}
