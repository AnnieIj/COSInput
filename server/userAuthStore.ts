/**
 * COSInput - Server-Side GitHub User Authorization Store
 * Stores user OAuth tokens and identities strictly server-side.
 * Tokens are NEVER sent to the client, logged, or exposed in API payloads.
 */

import { getGitHubAppConfig } from './config';
import type { GitHubUserProfile, SanitizedGitHubError } from './types';

interface UserSession {
  token: string;
  profile: GitHubUserProfile;
  createdAt: number;
}

// In-memory server session store (token never leaves server)
const userSessions = new Map<string, UserSession>();
const DEFAULT_SESSION_KEY = '__active_user_session__';

export class UserAuthStore {
  /**
   * Stores an authenticated user access token and profile server-side.
   */
  setUserSession(sessionKey: string = DEFAULT_SESSION_KEY, token: string, profile: GitHubUserProfile): void {
    userSessions.set(sessionKey, {
      token,
      profile,
      createdAt: Date.now(),
    });
  }

  /**
   * Retrieves user access token server-side (only for backend API calls).
   */
  getUserToken(sessionKey: string = DEFAULT_SESSION_KEY): string | null {
    return userSessions.get(sessionKey)?.token || null;
  }

  /**
   * Retrieves safe user profile for API responses (token is omitted).
   */
  getUserProfile(sessionKey: string = DEFAULT_SESSION_KEY): GitHubUserProfile | null {
    return userSessions.get(sessionKey)?.profile || null;
  }

  /**
   * Clears user session upon disconnect.
   */
  clearSession(sessionKey: string = DEFAULT_SESSION_KEY): void {
    userSessions.delete(sessionKey);
  }

  /**
   * Exchanges an OAuth code for a GitHub User Access Token.
   * Keeps token server-side.
   */
  async exchangeCodeForToken(code: string): Promise<{ token: string; profile: GitHubUserProfile }> {
    const config = getGitHubAppConfig();
    if (!config.clientId || !config.clientSecret) {
      const error: SanitizedGitHubError = {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 400,
        message: 'GitHub OAuth Client is not configured. Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET.',
      };
      throw error;
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const error: SanitizedGitHubError = {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: tokenRes.status,
        message: 'Failed to exchange authorization code with GitHub OAuth.',
      };
      throw error;
    }

    const tokenData = (await tokenRes.json()) as any;
    if (tokenData.error || !tokenData.access_token) {
      const error: SanitizedGitHubError = {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 401,
        message: tokenData.error_description || 'Invalid authorization code or OAuth grant.',
      };
      throw error;
    }

    const userAccessToken = tokenData.access_token;

    // Fetch user profile from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'COSInput-Server/0.2.1',
      },
    });

    if (!userRes.ok) {
      const error: SanitizedGitHubError = {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: userRes.status,
        message: 'Failed to retrieve authenticated user profile from GitHub.',
      };
      throw error;
    }

    const userData = (await userRes.json()) as any;
    const profile: GitHubUserProfile = {
      id: String(userData.id),
      login: userData.login,
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url || '',
      authSource: 'oauth',
      authenticatedAt: new Date().toISOString(),
    };

    return { token: userAccessToken, profile };
  }
}

export const userAuthStore = new UserAuthStore();
