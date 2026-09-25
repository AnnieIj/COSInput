/**
 * COSInput - GitHub App Authentication (Server-Side Boundary)
 * Generates RS256 JWT for GitHub App authentication and caches installation tokens.
 * Zero external JWT dependencies — uses Node native crypto.
 */

import crypto from 'crypto';
import { getGitHubAppConfig } from './config';
import type { CachedInstallationToken, SanitizedGitHubError } from './types';

// In-memory cache for installation access tokens: installationId -> { token, expiresAt }
const tokenCache = new Map<number, CachedInstallationToken>();

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Generates an RS256 JSON Web Token (JWT) authenticated as the GitHub App.
 * Valid for max 10 minutes (9 minutes with 60-second backdate for clock drift).
 * Uses validated KeyObject. Never exposes OpenSSL internal error strings or key material.
 */
export function generateAppJWT(): string {
  const config = getGitHubAppConfig();
  if (!config.appId) {
    const error: SanitizedGitHubError = {
      classification: 'AUTHENTICATION_FAILURE',
      statusCode: 401,
      message: 'GitHub App is not configured. Missing GITHUB_APP_ID.',
    };
    throw error;
  }

  if (config.keyError) {
    throw config.keyError;
  }

  if (!config.privateKeyObject) {
    const error: SanitizedGitHubError = {
      classification: 'AUTHENTICATION_FAILURE',
      statusCode: 401,
      message: 'GitHub App private key is missing or invalid. Please check GITHUB_PRIVATE_KEY.',
    };
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iat: now - 60, // 60s in the past to allow for clock drift
    exp: now + 9 * 60, // 9 minutes expiration (GitHub allows max 10m)
    iss: config.appId,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(config.privateKeyObject, 'base64url');
    return `${signingInput}.${signature}`;
  } catch (_err) {
    // Strictly sanitized error: never expose OpenSSL decoder internals or key material
    const error: SanitizedGitHubError = {
      classification: 'AUTHENTICATION_FAILURE',
      statusCode: 401,
      message: 'Failed to sign GitHub App authentication token. Private key is invalid or incompatible.',
    };
    throw error;
  }
}

/**
 * Gets or refreshes an installation access token for a given installation ID.
 * Caches tokens in memory until 5 minutes before expiration.
 */
export async function getInstallationAccessToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  const now = Date.now();

  // If token is cached and has at least 5 minutes remaining, use it
  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.token;
  }

  const jwt = generateAppJWT();
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'COSInput-Server/0.2',
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to obtain installation access token for installation #${installationId}. HTTP ${response.status}: ${errorBody}`
    );
  }

  const data = (await response.json()) as { token: string; expires_at: string };
  const expiresAt = new Date(data.expires_at).getTime();

  tokenCache.set(installationId, {
    token: data.token,
    expiresAt,
  });

  return data.token;
}

/**
 * Clears the cached token for a given installation (e.g. upon revocation).
 */
export function invalidateInstallationToken(installationId: number): void {
  tokenCache.delete(installationId);
}
