/**
 * COSInput - Server-Side Configuration
 * Reads GitHub App credentials strictly from server environment variables.
 * Never logs secrets. Never sends secrets to the browser.
 * Validates and normalizes multiline/escaped PEM keys safely using Node crypto.
 */

import dotenv from 'dotenv';
import crypto from 'crypto';
import type { GitHubAppConfig, SanitizedGitHubError } from './types';

dotenv.config();

export interface KeyValidationResult {
  pem: string | null;
  keyObject: crypto.KeyObject | null;
  error?: SanitizedGitHubError;
}

/**
 * Normalizes and validates a GitHub App private key PEM safely.
 * Handles:
 * - Multi-line PEM secrets with preserved newlines
 * - Single-line strings with escaped '\n' or '\r\n'
 * - Secrets enclosed in quotes (single, double, or escaped quotes)
 * - Raw Base64-encoded PEM strings
 * - Delimiter whitespace or collapsed spacing
 *
 * Validates the parsed key using Node crypto.createPrivateKey.
 * Returns a sanitized AUTHENTICATION_FAILURE error if parsing fails,
 * strictly suppressing OpenSSL internals (e.g. error:1E08010C:DECODER routines::unsupported)
 * and never exposing or logging the secret material.
 */
export function normalizeAndValidatePrivateKey(rawKey: string | null | undefined): KeyValidationResult {
  if (!rawKey || typeof rawKey !== 'string') {
    return { pem: null, keyObject: null };
  }

  let str = rawKey.trim();
  if (!str) {
    return { pem: null, keyObject: null };
  }

  // Strip wrapping outer quotes (single, double, or escaped)
  while (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'")) ||
    (str.startsWith('\\"') && str.endsWith('\\"')) ||
    (str.startsWith("\\'") && str.endsWith("\\'"))
  ) {
    if (str.startsWith('\\"') && str.endsWith('\\"')) {
      str = str.slice(2, -2).trim();
    } else if (str.startsWith("\\'") && str.endsWith("\\'")) {
      str = str.slice(2, -2).trim();
    } else {
      str = str.slice(1, -1).trim();
    }
  }

  // If input appears to be base64-encoded without PEM headers, attempt base64 decoding
  if (!str.includes('-----BEGIN') && !str.includes('-----END')) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf8');
      if (decoded.includes('BEGIN') && decoded.includes('PRIVATE KEY')) {
        str = decoded.trim();
      }
    } catch {
      // Ignore base64 decode failure and continue with raw string
    }
  }

  // Unescape literal backslash newline sequences (\r\n, \n, \r)
  str = str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  // Normalize Windows CRLF line breaks
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Re-check quotes in case unescaping exposed outer quotes
  while (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim();
  }

  // Find PEM BEGIN and END delimiters (supports both PKCS#1 and PKCS#8)
  const beginMatch = str.match(/-----BEGIN\s+(?:[A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/);
  const endMatch = str.match(/-----END\s+(?:[A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/);

  if (!beginMatch || !endMatch) {
    return {
      pem: null,
      keyObject: null,
      error: {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 401,
        message: 'GitHub App private key could not be parsed: missing valid PEM BEGIN/END headers.',
      },
    };
  }

  const beginTag = beginMatch[0];
  const endTag = endMatch[0];
  const startIndex = str.indexOf(beginTag);
  const endIndex = str.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return {
      pem: null,
      keyObject: null,
      error: {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 401,
        message: 'GitHub App private key is malformed: invalid PEM delimiter positions.',
      },
    };
  }

  // Extract and clean the base64 key payload
  const bodyRaw = str.slice(startIndex + beginTag.length, endIndex);
  const base64Body = bodyRaw.replace(/[^A-Za-z0-9+/=]/g, '');

  if (!base64Body) {
    return {
      pem: null,
      keyObject: null,
      error: {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 401,
        message: 'GitHub App private key payload is empty between PEM headers.',
      },
    };
  }

  // Format into standard PEM with 64-character line wraps
  const pemLines: string[] = [beginTag];
  for (let i = 0; i < base64Body.length; i += 64) {
    pemLines.push(base64Body.slice(i, i + 64));
  }
  pemLines.push(endTag);
  pemLines.push('');
  const normalizedPem = pemLines.join('\n');

  // Validate the key server-side using Node crypto
  try {
    const keyObject = crypto.createPrivateKey({
      key: normalizedPem,
      format: 'pem',
    });

    if (keyObject.type !== 'private') {
      return {
        pem: null,
        keyObject: null,
        error: {
          classification: 'AUTHENTICATION_FAILURE',
          statusCode: 401,
          message: 'The provided key is not a private key.',
        },
      };
    }

    return {
      pem: normalizedPem,
      keyObject,
    };
  } catch (_openSslError) {
    // Suppress OpenSSL internals (e.g. error:1E08010C:DECODER routines::unsupported)
    // Never print, log, or leak the private key material
    return {
      pem: null,
      keyObject: null,
      error: {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 401,
        message: 'Failed to parse GitHub App private key. Ensure the key is a valid PEM-encoded RSA private key.',
      },
    };
  }
}

export function getGitHubAppConfig(): GitHubAppConfig {
  const appId = process.env.GITHUB_APP_ID?.trim() || null;
  const appSlug = process.env.GITHUB_APP_SLUG?.trim() || null;
  const clientId = process.env.GITHUB_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || null;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim() || null;

  // Retrieve raw key from either GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_BASE64
  const rawKey = process.env.GITHUB_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY_BASE64 || null;

  const keyResult = normalizeAndValidatePrivateKey(rawKey);

  const isConfigured = Boolean(appId && keyResult.keyObject);

  return {
    appId,
    appSlug,
    clientId,
    clientSecret,
    webhookSecret,
    privateKey: keyResult.pem,
    privateKeyObject: keyResult.keyObject,
    keyError: rawKey ? keyResult.error : undefined,
    isConfigured,
  };
}
