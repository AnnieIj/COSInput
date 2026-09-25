import React, { useState, useEffect } from 'react';
import { useMode } from '../context/ModeContext';
import { githubService } from '../services/github.service';

export const SettingsPage: React.FC = () => {
  const {
    mode,
    setMode,
    connectionState,
    statusData,
    currentUser,
    loadingStatus,
    refreshStatus,
  } = useMode();

  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [repoCount, setRepoCount] = useState<number>(0);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);

  useEffect(() => {
    // Attempt to load installation URL
    githubService
      .getAuthUrl()
      .then((res) => setInstallUrl(res.installationUrl))
      .catch(() => setInstallUrl(null));

    // Attempt to fetch real repository count if connected in Live mode
    if (mode === 'live' && connectionState === 'APP_INSTALLED') {
      setLoadingRepos(true);
      githubService
        .listRepositories()
        .then((repos) => setRepoCount(repos.length))
        .catch(() => setRepoCount(0))
        .finally(() => setLoadingRepos(false));
    }

    // Load recent webhook events
    fetch('/api/github/webhooks/events')
      .then((res) => res.json())
      .then((data) => setWebhookEvents(data.events || []))
      .catch(() => setWebhookEvents([]));
  }, [mode, connectionState]);

  const handleInstallClick = () => {
    if (installUrl) {
      window.open(installUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert(
        'GITHUB_APP_SLUG is not configured on the server. Please define GITHUB_APP_SLUG in your environment variables.'
      );
    }
  };

  const getConnectionStateBadge = () => {
    switch (connectionState) {
      case 'APP_INSTALLED':
        return (
          <span className="px-2.5 py-1 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-code-sm font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            GitHub App Installed & Connected
          </span>
        );
      case 'APP_NOT_INSTALLED':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-900 font-code-sm text-code-sm font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            App Registered, Not Installed on User Account
          </span>
        );
      case 'AUTH_FAILED':
        return (
          <span className="px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-code-sm text-code-sm font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
            Authorization Failed (Invalid App Key/JWT)
          </span>
        );
      case 'API_UNAVAILABLE':
        return (
          <span className="px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-code-sm text-code-sm font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error"></span>
            GitHub API Unavailable / Network Error
          </span>
        );
      case 'INSTALLATION_REVOKED':
        return (
          <span className="px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-code-sm text-code-sm font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error"></span>
            Installation Revoked or Suspended
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-code-sm text-code-sm font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-outline"></span>
            GitHub Not Connected (Credentials Unset)
          </span>
        );
    }
  };

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
          System Settings & GitHub Connectivity
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          COSInput Foundation v0.2 real GitHub App integration, data source isolation, and safety invariants.
        </p>
      </div>

      {/* 1. Mode Switcher (Demo Mode vs Live Mode) */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Data Source Environment
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Switch between isolated development mock fixtures and real live GitHub App integration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-surface-container-low rounded-lg border border-surface-container">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`px-3.5 py-1.5 rounded-md font-code-sm text-code-sm font-semibold transition-all ${
                mode === 'live'
                  ? 'bg-primary-container text-on-primary shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              LIVE GITHUB MODE
            </button>
            <button
              type="button"
              onClick={() => setMode('demo')}
              className={`px-3.5 py-1.5 rounded-md font-code-sm text-code-sm font-semibold transition-all ${
                mode === 'demo'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              DEMO MODE
            </button>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface-container-low text-body-sm font-body-sm text-secondary border border-surface-container">
          <strong className="text-on-surface">Invariant:</strong> COSInput never silently falls back from Live GitHub Mode to mock fixtures. If GitHub is unconfigured or returns an error, the real connection state is surfaced explicitly.
        </div>
      </div>

      {/* 2. Real GitHub App Connection Flow */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container-low">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">link</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                GitHub App Authorization & Installation
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Connect via GitHub App architecture. No Personal Access Tokens (PATs) required.
              </p>
            </div>
          </div>
          <div>{getConnectionStateBadge()}</div>
        </div>

        {/* Real Authenticated Profile & Installation Details (when connected) */}
        {currentUser && (
          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.login}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-primary shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-base shrink-0">
                  {currentUser.login.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    @{currentUser.login}
                  </h3>
                  <span className="font-code-sm text-[11px] bg-tertiary-fixed text-on-tertiary-fixed px-2 py-0.5 rounded font-semibold">
                    Authorized
                  </span>
                </div>
                <span className="font-code-sm text-code-sm text-secondary font-mono mt-0.5">
                  Installation ID: #{currentUser.id} • Synced: {new Date(currentUser.syncedAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-code-sm font-code-sm shrink-0">
              <div className="flex flex-col">
                <span className="text-secondary text-[10px] uppercase font-bold">Authorized Repositories</span>
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {loadingRepos ? 'Loading...' : `${repoCount} repos`}
                </span>
              </div>
              <button
                type="button"
                onClick={refreshStatus}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium border border-surface-container shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        )}

        {/* Real Error Diagnostic Box (when error present) */}
        {statusData?.error && (
          <div className="p-4 rounded-xl bg-error-container/20 border border-error/40 flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-[22px] mt-0.5 shrink-0">
              error
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-error font-bold">
                  {statusData.error.classification}
                </span>
                <span className="font-code-sm text-code-sm text-secondary font-mono">
                  (Status Code: {statusData.error.statusCode})
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface">
                {statusData.error.message}
              </p>
              {statusData.error.retryAfterSeconds && (
                <span className="font-code-sm text-code-sm text-secondary">
                  Rate limit resets in {statusData.error.retryAfterSeconds} seconds.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-5 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">extension</span>
              <span>Install / Configure COSInput GitHub App</span>
            </button>
            <button
              type="button"
              disabled={loadingStatus}
              onClick={refreshStatus}
              className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm font-medium border border-surface-container shadow-sm transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">
                {loadingStatus ? 'sync' : 'refresh'}
              </span>
              <span>{loadingStatus ? 'Checking...' : 'Check Connection'}</span>
            </button>
          </div>

          <span className="font-body-sm text-body-sm text-secondary">
            Supports selecting <strong>All repositories</strong> or <strong>Selected repositories</strong>.
          </span>
        </div>

        {/* GitHub App Configuration Reference for Developer Setup */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container space-y-3 font-code-sm text-code-sm">
          <div className="flex items-center gap-2 font-headline-sm text-headline-sm font-semibold text-on-surface font-sans">
            <span className="material-symbols-outlined text-primary text-[18px]">settings_applications</span>
            <span>GitHub App Configuration Checklist (RFC-081)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-secondary text-[12px] font-mono">
            <div className="p-3 rounded bg-surface-container-lowest border border-surface-container">
              <span className="text-on-surface font-bold block mb-1 font-sans">Required App Permissions:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Repository metadata: <strong>Read-only</strong></li>
                <li>Issues: <strong>Read-only</strong></li>
                <li>Pull requests: <strong>Read-only</strong></li>
                <li>Repository contents: <strong>Read-only</strong></li>
                <li>Checks & Workflows: <strong>Read-only</strong></li>
              </ul>
            </div>

            <div className="p-3 rounded bg-surface-container-lowest border border-surface-container">
              <span className="text-on-surface font-bold block mb-1 font-sans">Callback & Webhook URLs:</span>
              <div className="space-y-1 text-on-surface font-mono text-[11px]">
                <div>
                  <span className="text-secondary block">Webhook URL:</span>
                  <code className="bg-surface-container px-1 py-0.5 rounded select-all break-all">
                    https://ais-dev-emj5m3hlxkg4zdyx5xi245-359578166784.europe-west2.run.app/api/github/webhooks
                  </code>
                </div>
                <div>
                  <span className="text-secondary block">Callback URL:</span>
                  <code className="bg-surface-container px-1 py-0.5 rounded select-all break-all">
                    https://ais-dev-emj5m3hlxkg4zdyx5xi245-359578166784.europe-west2.run.app/api/github/callback
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Event-Driven Guardian Webhook Log */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">webhook</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Event-Driven Webhook Foundation
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Verified incoming webhooks (HMAC SHA-256). Zero automatic repository modifications.
              </p>
            </div>
          </div>
          <span className="font-code-sm text-code-sm bg-surface-container text-secondary px-2.5 py-1 rounded">
            {webhookEvents.length} Recent Events Captured
          </span>
        </div>

        {webhookEvents.length === 0 ? (
          <div className="p-6 rounded-lg bg-surface-container-low text-center text-secondary font-body-sm text-body-sm border border-surface-container">
            No webhook events recorded yet. Webhooks delivered by GitHub will be cryptographically verified and recorded here.
          </div>
        ) : (
          <div className="space-y-2">
            {webhookEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex items-center justify-between font-code-sm text-code-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">done</span>
                  <span className="font-semibold text-on-surface font-mono">{evt.safeSummary}</span>
                </div>
                <div className="flex items-center gap-3 text-secondary text-[11px] shrink-0 font-mono">
                  <span>Delivery: {evt.deliveryId.slice(0, 8)}</span>
                  <span>•</span>
                  <span>{new Date(evt.receivedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
