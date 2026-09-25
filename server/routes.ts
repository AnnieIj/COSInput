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
import { contributionSessionStore } from './contributionSessionStore';
import { repositoryIntelligenceService } from './repositoryIntelligenceService';
import { issueAnalysisService } from './issueAnalysisService';
import type { SanitizedGitHubError } from './types';

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
githubRouter.get('/user/auth-url', (req, res) => {
  const config = getGitHubAppConfig();
  if (!config.clientId) {
    return res.status(400).json({
      error: {
        classification: 'AUTHENTICATION_FAILURE',
        statusCode: 400,
        message: 'GitHub OAuth Client ID is not configured (GITHUB_CLIENT_ID). Set GITHUB_CLIENT_ID in your environment variables.',
      },
    });
  }

  const redirectUri = req.query.redirect_uri as string | undefined;
  const state = Math.random().toString(36).substring(2, 15);
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: 'read:user',
    state,
  });
  if (redirectUri) {
    params.set('redirect_uri', redirectUri);
  }

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({ authUrl, state });
});

/**
 * GET /api/github/user/callback
 * Exchanges code for token server-side and stores token in server memory.
 * Never returns the token to the browser.
 * Sends postMessage to opener for seamless popup-based OAuth.
 */
githubRouter.get(['/user/callback', '/user/callback/'], async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).send('Missing code parameter.');
    }

    const { profile } = await userAuthStore.exchangeCodeForToken(code);
    // Automatically trigger initial assignment sync for the newly authorized user
    await assignmentSyncService.syncAssignments(profile.login).catch(() => {});

    // Safe HTML response for popup communication or direct redirect fallback
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Authorization - COSInput</title>
          <meta charset="utf-8" />
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8f9ff; color: #0b1c30;">
          <h2 style="color: #3525cd;">GitHub Connected Successfully</h2>
          <p>Authenticated as <strong>@${profile.login}</strong>.</p>
          <p>Closing window...</p>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: { login: ${JSON.stringify(profile.login)} } }, '*');
                window.close();
              } else {
                window.location.href = '/issues?auth=success';
              }
            } catch (e) {
              window.location.href = '/issues?auth=success';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    const errorMsg = err.message || 'Authorization failed';
    res.status(err.statusCode || 500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authorization Failed - COSInput</title>
          <meta charset="utf-8" />
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8f9ff; color: #ba1a1a;">
          <h2>GitHub Authorization Error</h2>
          <p>${errorMsg}</p>
          <p>You can close this window and try again.</p>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: ${JSON.stringify(errorMsg)} }, '*');
                setTimeout(() => window.close(), 3000);
              } else {
                window.location.href = '/issues?auth=error&message=' + encodeURIComponent(${JSON.stringify(errorMsg)});
              }
            } catch (e) {}
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/github/user/connect-user
 * Connects a contributor by GitHub handle (verifying against public GitHub API).
 * Never uses PATs. Enables assignment discovery even before full OAuth app credentials are set up.
 */
githubRouter.post('/user/connect-user', async (req, res) => {
  try {
    const username = req.body?.username;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({
        error: {
          classification: 'AUTHENTICATION_FAILURE',
          statusCode: 400,
          message: 'GitHub username is required.',
        },
      });
    }

    const profile = await userAuthStore.connectByUsername(username.trim());
    const syncResult = await assignmentSyncService.syncAssignments(profile.login).catch(() => null);

    res.json({
      success: true,
      user: profile,
      syncResult,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.classification ? err : {
        classification: 'GITHUB_SERVICE_FAILURE',
        statusCode: status,
        message: err.message || 'Failed to connect GitHub user.',
      },
    });
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
 * Clears user session and resets assignment cache.
 */
githubRouter.post('/user/disconnect', (_req, res) => {
  userAuthStore.clearSession();
  assignmentSyncService.clearCache();
  res.json({ success: true, message: 'User session and assignment cache cleared.' });
});

/**
 * ============================================================================
 * COSInput Foundation v0.3 — Contribution Session & Intelligence Routes
 * Strictly read-only relative to GitHub.
 * ============================================================================
 */

/**
 * POST /api/github/contributions/session
 * Creates or retrieves a local contribution analysis session.
 * Starting a contribution MUST NOT modify GitHub.
 */
githubRouter.post(['/contributions/session', '/contributions'], async (req, res) => {
  try {
    const { owner, repo, issueNumber, issueTitle, issueUrl, repoAuthorizationStatus } = req.body;
    if (!owner || !repo || !issueNumber) {
      return res.status(400).json({
        error: {
          classification: 'AUTHENTICATION_FAILURE',
          statusCode: 400,
          message: 'owner, repo, and issueNumber are required to create a contribution session.',
        },
      });
    }

    const userProfile = userAuthStore.getUserProfile();
    const appStatus = await githubServerClient.getConnectionStatus().catch(() => ({ activeInstallation: null }));
    const contributorUsername = userProfile?.login || appStatus?.activeInstallation?.accountLogin || 'contributor';

    // Verify if repo is installed
    let authStatus = repoAuthorizationStatus || 'public_readable';
    if (!repoAuthorizationStatus) {
      try {
        const authorizedRepos = await assignmentSyncService.getAuthorizedRepositories();
        authStatus = authorizedRepos.has(`${owner}/${repo}`.toLowerCase()) ? 'app_authorized' : 'public_readable';
      } catch {
        authStatus = 'public_readable';
      }
    }

    const session = contributionSessionStore.createSession({
      repositoryOwner: owner,
      repositoryName: repo,
      issueNumber: Number(issueNumber),
      issueTitle: issueTitle || `Issue #${issueNumber}`,
      issueUrl: issueUrl || `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
      contributorUsername,
      repositoryAccessStatus: authStatus,
    });

    res.json({
      success: true,
      session,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.classification ? err : {
        classification: 'GITHUB_SERVICE_FAILURE',
        statusCode: status,
        message: err.message || 'Failed to create contribution session.',
      },
    });
  }
});

/**
 * GET /api/github/contributions/:id
 * Retrieves the full local contribution session state.
 */
githubRouter.get('/contributions/:id', (req, res) => {
  const session = contributionSessionStore.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({
      error: {
        classification: 'NOT_FOUND',
        statusCode: 404,
        message: `Contribution session '${req.params.id}' not found.`,
      },
    });
  }

  res.json({ success: true, session });
});

/**
 * POST /api/github/contributions/:id/analyze
 * Executes Repository Intelligence & Issue Analysis pipeline.
 * Strictly read-only relative to GitHub.
 */
githubRouter.post('/contributions/:id/analyze', async (req, res) => {
  const session = contributionSessionStore.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({
      error: {
        classification: 'NOT_FOUND',
        statusCode: 404,
        message: `Contribution session '${req.params.id}' not found.`,
      },
    });
  }

  try {
    // 1. Mark status: REPOSITORY_INSPECTION
    contributionSessionStore.updateSession(session.id, {
      analysisStatus: 'REPOSITORY_INSPECTION',
    });
    contributionSessionStore.addTimelineEvent(
      session.id,
      'Issue Loaded',
      `Targeted #${session.issueNumber} in ${session.upstreamRepository} for read-only inspection.`
    );

    // 2. Fetch live issue payload from GitHub
    const issuePayload = await githubServerClient
      .getIssue(
        null,
        session.repositoryOwner,
        session.repositoryName,
        session.issueNumber,
        userAuthStore.getUserToken() || undefined
      )
      .catch((err) => {
        // If error fetching issue details, return existing session title as body fallback
        return {
          title: session.issueTitle,
          body: '',
          labels: [],
        };
      });

    // 3. Inspect repository
    contributionSessionStore.addTimelineEvent(
      session.id,
      'Repository Inspected',
      `Scanning repository tree, instruction files (AGENTS.md, CONTRIBUTING.md), and configuration.`
    );

    const { repositoryIntelligence, dependencyConfig } =
      await repositoryIntelligenceService.inspectRepository(
        session.repositoryOwner,
        session.repositoryName
      );

    if (repositoryIntelligence.discoveredInstructions.length > 0) {
      contributionSessionStore.addTimelineEvent(
        session.id,
        'Instructions Found',
        `Discovered ${repositoryIntelligence.discoveredInstructions.length} repository instructions from ${repositoryIntelligence.discoveredInstructionFiles.join(', ')}.`
      );
    }

    // 4. Mark status: ISSUE_ANALYSIS
    contributionSessionStore.updateSession(session.id, {
      analysisStatus: 'ISSUE_ANALYSIS',
      repositoryIntelligence,
      dependenciesAndConfig: dependencyConfig,
    });

    // 5. Run Issue Analysis & Acceptance Criteria Engine & Blocker Detection
    const analysisResult = await issueAnalysisService.analyzeIssue({
      issueNumber: session.issueNumber,
      issueTitle: issuePayload.title || session.issueTitle,
      issueBody: issuePayload.body || '',
      issueLabels: issuePayload.labels || [],
      repositoryIntelligence,
      dependencyConfig,
      repositoryAccessStatus: session.repositoryAccessStatus,
    });

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Acceptance Criteria Generated',
      `Synthesized ${analysisResult.acceptanceCriteria.length} structured criteria across functional, test, and lint dimensions.`
    );

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Relevant Files Identified',
      `Identified ${analysisResult.relevantFiles.length} candidate files in repository tree.`
    );

    contributionSessionStore.addTimelineEvent(
      session.id,
      'Plan Generated',
      `Structured implementation plan ready for human review. Change surface estimated as ${analysisResult.implementationPlan.estimatedChangeSurface}.`
    );

    const finalStatus = analysisResult.isBlocked ? 'BLOCKED' : 'PLAN_READY';

    if (finalStatus === 'PLAN_READY') {
      contributionSessionStore.addTimelineEvent(
        session.id,
        'Waiting For Approval',
        'Implementation plan submitted to human contributor for verification before any coding phase.',
        true,
        true
      );
    }

    const updatedSession = contributionSessionStore.updateSession(session.id, {
      analysisStatus: finalStatus,
      issueIntelligence: analysisResult.issueIntelligence,
      acceptanceCriteria: analysisResult.acceptanceCriteria,
      relevantFiles: analysisResult.relevantFiles,
      blockers: analysisResult.blockers,
      implementationPlan: analysisResult.implementationPlan,
      errorMessage: undefined,
    });

    res.json({
      success: true,
      session: updatedSession,
    });
  } catch (err: any) {
    const errorMsg = err.message || 'Failed during repository and issue analysis.';
    contributionSessionStore.updateSession(session.id, {
      analysisStatus: 'FAILED',
      errorMessage: errorMsg,
    });
    contributionSessionStore.addTimelineEvent(
      session.id,
      'Analysis Failed',
      `Encountered failure: ${errorMsg}`
    );

    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.classification ? err : {
        classification: 'REPOSITORY_ANALYSIS_FAILURE',
        statusCode: status,
        message: errorMsg,
      },
    });
  }
});

/**
 * POST /api/github/contributions/:id/approve
 * Human Approval Gate: Approves the plan.
 * ONLY changes local contribution status to APPROVED.
 * Zero writes to GitHub.
 */
githubRouter.post('/contributions/:id/approve', (req, res) => {
  const session = contributionSessionStore.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({
      error: {
        classification: 'NOT_FOUND',
        statusCode: 404,
        message: `Contribution session '${req.params.id}' not found.`,
      },
    });
  }

  const now = new Date().toISOString();
  contributionSessionStore.addTimelineEvent(
    session.id,
    'Plan Approved',
    'Human contributor verified and approved the implementation plan. Implementation has not started.'
  );

  const updated = contributionSessionStore.updateSession(session.id, {
    analysisStatus: 'APPROVED',
    humanApproval: {
      status: 'approved',
      approvedAt: now,
      feedback: req.body?.feedback,
    },
  });

  res.json({
    success: true,
    session: updated,
    message: 'Plan approved. Implementation has not started.',
  });
});

/**
 * POST /api/github/contributions/:id/revision
 * Requests plan revision with contributor feedback.
 */
githubRouter.post('/contributions/:id/revision', (req, res) => {
  const session = contributionSessionStore.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({
      error: {
        classification: 'NOT_FOUND',
        statusCode: 404,
        message: `Contribution session '${req.params.id}' not found.`,
      },
    });
  }

  const feedback = req.body?.feedback || 'Contributor requested revision on plan.';
  contributionSessionStore.addTimelineEvent(
    session.id,
    'Revision Requested',
    `Feedback: "${feedback}"`
  );

  const updated = contributionSessionStore.updateSession(session.id, {
    analysisStatus: 'PLAN_READY',
    humanApproval: {
      status: 'revision_requested',
      feedback,
    },
  });

  res.json({
    success: true,
    session: updated,
  });
});

/**
 * POST /api/github/contributions/:id/cancel
 * Cancels the local contribution analysis.
 */
githubRouter.post('/contributions/:id/cancel', (req, res) => {
  const session = contributionSessionStore.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({
      error: {
        classification: 'NOT_FOUND',
        statusCode: 404,
        message: `Contribution session '${req.params.id}' not found.`,
      },
    });
  }

  contributionSessionStore.addTimelineEvent(
    session.id,
    'Contribution Cancelled',
    'Contributor cancelled this contribution session.'
  );

  const updated = contributionSessionStore.updateSession(session.id, {
    analysisStatus: 'NOT_STARTED',
    humanApproval: {
      status: 'cancelled',
    },
  });

  res.json({
    success: true,
    session: updated,
  });
});
