/**
 * COSInput - Server API Routes for GitHub Integration
 */

import { Router } from 'express';
import { getGitHubAppConfig } from './config';
import { githubServerClient } from './githubClient';
import { verifyGitHubWebhookSignature, processVerifiedWebhook } from './webhookHandler';
import { getRecentWebhookEvents } from './eventStore';
import { assignmentSyncService } from './assignmentSyncService';
import { userAuthStore } from './userAuthStore';

export const githubRouter = Router();

/**
 * GET /api/github/status
 * Returns current GitHub App connection state and health.
 */
githubRouter.get('/status', async (_req, res) => {
  try {
    const status = await githubServerClient.getConnectionStatus();
    res.json(status);
  } catch (err: any) {
    if (err && err.classification === 'AUTHENTICATION_FAILURE') {
      return res.status(401).json({
        configured: true,
        state: 'AUTH_FAILED',
        error: err,
      });
    }
    res.status(500).json({
      configured: false,
      state: 'API_UNAVAILABLE',
      error: {
        classification: 'GITHUB_SERVICE_FAILURE',
        statusCode: 500,
        message: 'Error checking GitHub connection status',
      },
    });
  }
});

/**
 * GET /api/github/auth-url
 * Returns the GitHub App installation URL or OAuth authorization URL.
 */
githubRouter.get('/auth-url', (_req, res) => {
  const config = getGitHubAppConfig();
  if (!config.appSlug) {
    return res.status(400).json({
      error: 'GitHub App Slug is not configured in GITHUB_APP_SLUG.',
    });
  }

  // GitHub App installation URL format
  const installationUrl = `https://github.com/apps/${config.appSlug}/installations/new`;
  res.json({
    installationUrl,
    appSlug: config.appSlug,
  });
});

/**
 * GET /api/github/installations
 * Returns installations of the GitHub App.
 */
githubRouter.get('/installations', async (_req, res) => {
  try {
    const installations = await githubServerClient.listInstallations();
    res.json({ installations });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err });
  }
});

/**
 * GET /api/github/repositories
 * Lists repositories authorized for the primary or specified installation.
 */
githubRouter.get('/repositories', async (req, res) => {
  try {
    let installationId = req.query.installationId ? parseInt(req.query.installationId as string, 10) : undefined;

    if (!installationId) {
      const installations = await githubServerClient.listInstallations();
      if (installations.length === 0) {
        return res.status(404).json({
          error: {
            classification: 'NOT_FOUND',
            statusCode: 404,
            message: 'No GitHub App installation found. Please install COSInput on your GitHub account.',
          },
        });
      }
      installationId = installations[0].id;
    }

    const data = await githubServerClient.listInstallationRepositories(installationId);
    res.json(data);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err });
  }
});

/**
 * GET /api/github/issues
 * Returns issues for an authorized repository or across authorized repositories.
 */
githubRouter.get('/issues', async (req, res) => {
  try {
    const owner = req.query.owner as string | undefined;
    const repo = req.query.repo as string | undefined;
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'open';
    const labels = req.query.labels as string | undefined;

    const installations = await githubServerClient.listInstallations();
    if (installations.length === 0) {
      return res.status(404).json({
        error: {
          classification: 'NOT_FOUND',
          statusCode: 404,
          message: 'No GitHub App installation found.',
        },
      });
    }

    const activeInstallation = installations[0];

    if (owner && repo) {
      const issues = await githubServerClient.listRepositoryIssues(
        activeInstallation.id,
        owner,
        repo,
        { state, labels }
      );
      return res.json({ issues, totalCount: issues.length });
    }

    // Otherwise, fetch repositories and aggregate issues across the first few repos
    const reposData = await githubServerClient.listInstallationRepositories(activeInstallation.id);
    const issuesResults: any[] = [];

    // Query up to 3 repositories concurrently to avoid rate limits
    const reposToQuery = reposData.repositories.slice(0, 3);
    for (const r of reposToQuery) {
      try {
        const repoIssues = await githubServerClient.listRepositoryIssues(
          activeInstallation.id,
          r.owner,
          r.name,
          { state, labels }
        );
        issuesResults.push(...repoIssues);
      } catch {
        // Continue to other repos if one fails
      }
    }

    res.json({ issues: issuesResults, totalCount: issuesResults.length });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err });
  }
});

/**
 * GET /api/github/issues/:owner/:repo/:number
 * Retrieves a single issue by repository and number.
 */
githubRouter.get('/issues/:owner/:repo/:number', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const issueNumber = parseInt(number, 10);

    const userToken = userAuthStore.getUserToken();
    let installationId: number | null = null;
    try {
      const installations = await githubServerClient.listInstallations();
      if (installations.length > 0) {
        installationId = installations[0].id;
      }
    } catch {
      // Continue with user token if installation list fails
    }

    const issue = await githubServerClient.getIssue(installationId, owner, repo, issueNumber, userToken || undefined);
    res.json({ issue });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err });
  }
});

/**
 * GET /api/github/issues/:owner/:repo/:number/comments
 * Retrieves comments for an issue.
 */
githubRouter.get('/issues/:owner/:repo/:number/comments', async (req, res) => {
  try {
    const { owner, repo, number } = req.params;
    const issueNumber = parseInt(number, 10);

    const userToken = userAuthStore.getUserToken();
    let installationId: number | null = null;
    try {
      const installations = await githubServerClient.listInstallations();
      if (installations.length > 0) {
        installationId = installations[0].id;
      }
    } catch {
      // Continue with user token
    }

    const comments = await githubServerClient.listIssueComments(installationId, owner, repo, issueNumber, userToken || undefined);
    res.json({ comments });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err });
  }
});

/**
 * GET /api/github/repos/:owner/:repo/content
 * Read-only file inspector.
 */
githubRouter.get('/repos/:owner/:repo/content', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const path = (req.query.path as string) || '';
    const ref = req.query.ref as string | undefined;

    const installations = await githubServerClient.listInstallations();
    if (installations.length === 0) {
      return res.status(404).json({ error: { classification: 'NOT_FOUND', statusCode: 404, message: 'No installation found.' } });
    }

    const file = await githubServerClient.getFileContent(installations[0].id, owner, repo, path, ref);
    res.json(file);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err });
  }
});

/**
 * GET /api/github/repos/:owner/:repo/dir
 * Read-only directory listing.
 */
githubRouter.get('/repos/:owner/:repo/dir', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const path = (req.query.path as string) || '';
    const ref = req.query.ref as string | undefined;

    const installations = await githubServerClient.listInstallations();
    if (installations.length === 0) {
      return res.status(404).json({ error: { classification: 'NOT_FOUND', statusCode: 404, message: 'No installation found.' } });
    }

    const contents = await githubServerClient.getDirectoryContents(installations[0].id, owner, repo, path, ref);
    res.json({ contents });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err });
  }
});

/**
 * POST /api/github/webhooks
 * GitHub Webhook endpoint. Verifies HMAC SHA-256 signature and records safe metadata.
 */
githubRouter.post('/webhooks', (req: any, res) => {
  const config = getGitHubAppConfig();
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const eventName = req.headers['x-github-event'] as string | undefined;
  const deliveryId = (req.headers['x-github-delivery'] as string) || 'unknown-delivery';

  if (!config.webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret is not configured on the server.' });
  }

  // Use rawBody buffer captured by express.json verify hook
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const isValid = verifyGitHubWebhookSignature(rawBody, signature, config.webhookSecret);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  if (!eventName) {
    return res.status(400).json({ error: 'Missing X-GitHub-Event header.' });
  }

  const record = processVerifiedWebhook(deliveryId, eventName, req.body);
  res.status(202).json({ received: true, eventId: record.id, classification: record.classification });
});

/**
 * GET /api/github/webhooks/events
 * Returns recent safe webhook events for the Guardian surveillance view.
 */
githubRouter.get('/webhooks/events', (_req, res) => {
  const events = getRecentWebhookEvents(30);
  res.json({ events });
});

/**
 * POST /api/github/assignments/sync
 * Manually synchronizes assigned GitHub issues across public and authorized repositories.
 * Strictly read-only: never modifies any repository or triggers AI coding runs.
 */
githubRouter.post('/assignments/sync', async (req, res) => {
  try {
    const targetUser = req.body?.username as string | undefined;
    const result = await assignmentSyncService.syncAssignments(targetUser);
    res.json(result);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.classification ? err : {
        classification: 'GITHUB_SERVICE_FAILURE',
        statusCode: status,
        message: err.message || 'Failed to synchronize assigned GitHub issues.',
      },
    });
  }
});

/**
 * GET /api/github/assignments
 * Returns the latest discovered assignments grouped by repository.
 */
githubRouter.get('/assignments', async (_req, res) => {
  try {
    const result = await assignmentSyncService.getAssignments();
    res.json(result);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.classification ? err : {
        classification: 'GITHUB_SERVICE_FAILURE',
        statusCode: status,
        message: err.message || 'Failed to retrieve assigned GitHub issues.',
      },
    });
  }
});

/**
 * GET /api/github/user/auth-url
 * Returns GitHub App user authorization (OAuth) URL.
 */
githubRouter.get('/user/auth-url', (_req, res) => {
  const config = getGitHubAppConfig();
  if (!config.clientId) {
    return res.status(400).json({
      error: {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 400,
        message: 'GitHub OAuth Client ID is not configured (GITHUB_CLIENT_ID).',
      },
    });
  }

  const state = Math.random().toString(36).substring(2, 15);
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${config.clientId}&scope=read:user&state=${state}`;

  res.json({ authUrl, state });
});

/**
 * GET /api/github/user/callback
 * Exchanges code for token server-side and stores token in server memory.
 * Never returns the token to the browser.
 */
githubRouter.get('/user/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).send('Missing code parameter.');
    }

    const { profile } = await userAuthStore.exchangeCodeForToken(code);
    // Automatically trigger initial assignment sync for the newly authorized user
    await assignmentSyncService.syncAssignments(profile.login).catch(() => {});

    // Safe redirect back to issues page
    res.redirect('/issues?auth=success');
  } catch (err: any) {
    res.redirect(`/issues?auth=error&message=${encodeURIComponent(err.message || 'Authorization failed')}`);
  }
});

/**
 * GET /api/github/user/me
 * Returns current authenticated contributor profile without exposing secrets.
 */
githubRouter.get('/user/me', async (_req, res) => {
  const oauthProfile = userAuthStore.getUserProfile();
  if (oauthProfile) {
    return res.json({
      authenticated: true,
      user: oauthProfile,
    });
  }

  // Fall back to connected GitHub App installation account
  const appStatus = await githubServerClient.getConnectionStatus();
  if (appStatus.activeInstallation) {
    return res.json({
      authenticated: true,
      user: {
        id: String(appStatus.activeInstallation.id),
        login: appStatus.activeInstallation.accountLogin,
        name: appStatus.activeInstallation.accountLogin,
        avatarUrl: appStatus.activeInstallation.accountAvatarUrl,
        authSource: 'installation_account',
        authenticatedAt: appStatus.activeInstallation.updatedAt,
      },
    });
  }

  res.json({
    authenticated: false,
    user: null,
  });
});

/**
 * POST /api/github/user/disconnect
 * Clears user session.
 */
githubRouter.post('/user/disconnect', (_req, res) => {
  userAuthStore.clearSession();
  res.json({ success: true, message: 'User session cleared.' });
});
