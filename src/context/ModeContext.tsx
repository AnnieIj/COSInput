import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { githubService } from '../services/github.service';
import type { GitHubConnectionState, SanitizedGitHubError, GitHubUser, GitHubUserProfile } from '../services/types';

export type AppDataMode = 'live' | 'demo';

interface ModeContextType {
  mode: AppDataMode;
  setMode: (mode: AppDataMode) => void;
  connectionState: GitHubConnectionState;
  statusData: {
    configured: boolean;
    state: GitHubConnectionState;
    installationsCount: number;
    appSlug: string | null;
    activeInstallation?: any;
    error?: SanitizedGitHubError;
  } | null;
  currentUser: GitHubUser | null;
  connectedUser: GitHubUserProfile | null;
  loadingStatus: boolean;
  refreshStatus: () => Promise<void>;
  connectUserByUsername: (username: string) => Promise<any>;
  disconnectUser: () => Promise<void>;
  isLive: boolean;
  isDemo: boolean;
  isGitHubSynced: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Stored in session/localStorage so the engineer can explicitly test Demo Mode vs Live Mode
  const [mode, setModeState] = useState<AppDataMode>(() => {
    const saved = localStorage.getItem('cosinput_mode');
    return saved === 'demo' ? 'demo' : 'live';
  });

  const [connectionState, setConnectionState] = useState<GitHubConnectionState>('NOT_CONNECTED');
  const [statusData, setStatusData] = useState<ModeContextType['statusData']>(null);
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);
  const [connectedUser, setConnectedUser] = useState<GitHubUserProfile | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  const setMode = (newMode: AppDataMode) => {
    setModeState(newMode);
    localStorage.setItem('cosinput_mode', newMode);
  };

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const [status, userMe] = await Promise.all([
        githubService.getConnectionStatus(),
        githubService.getUserMe().catch(() => ({ authenticated: false, user: null })),
      ]);

      setStatusData(status);
      setConnectionState(status.state);

      if (userMe.authenticated && userMe.user) {
        setConnectedUser(userMe.user);
        setCurrentUser({
          id: userMe.user.id,
          login: userMe.user.login,
          name: userMe.user.name,
          avatarUrl: userMe.user.avatarUrl,
          authorized: true,
          syncedAt: userMe.user.authenticatedAt || new Date().toISOString(),
        });
      } else if (status.state === 'APP_INSTALLED' && status.activeInstallation) {
        const inst = status.activeInstallation;
        setConnectedUser(null);
        setCurrentUser({
          id: String(inst.id),
          login: inst.accountLogin,
          name: inst.accountLogin,
          avatarUrl: inst.accountAvatarUrl,
          authorized: true,
          syncedAt: inst.updatedAt || new Date().toISOString(),
        });
      } else {
        setConnectedUser(null);
        setCurrentUser(null);
      }
    } catch (err: any) {
      setConnectionState('API_UNAVAILABLE');
      setStatusData({
        configured: false,
        state: 'API_UNAVAILABLE',
        installationsCount: 0,
        appSlug: null,
        error: {
          classification: 'NETWORK_FAILURE',
          statusCode: 0,
          message: err.message || 'Failed to query GitHub status endpoint',
        },
      });
      setConnectedUser(null);
      setCurrentUser(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const connectUserByUsername = useCallback(async (username: string) => {
    const res = await githubService.connectUserByUsername(username);
    if (res.success && res.user) {
      setConnectedUser(res.user);
      setCurrentUser({
        id: res.user.id,
        login: res.user.login,
        name: res.user.name,
        avatarUrl: res.user.avatarUrl,
        authorized: true,
        syncedAt: res.user.authenticatedAt || new Date().toISOString(),
      });
    }
    return res;
  }, []);

  const disconnectUser = useCallback(async () => {
    await githubService.disconnectUser().catch(() => {});
    setConnectedUser(null);
    await refreshStatus();
  }, [refreshStatus]);

  // Listen for OAuth popup postMessage callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin if not localhost or run.app
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        refreshStatus();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshStatus]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const isLive = mode === 'live';
  const isDemo = mode === 'demo';

  // Strict Rule: Never show "GitHub Synced" unless real authenticated user or installation succeeded in live mode
  const isGitHubSynced = isLive && (Boolean(connectedUser) || (connectionState === 'APP_INSTALLED' && Boolean(currentUser)));

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        connectionState,
        statusData,
        currentUser,
        connectedUser,
        loadingStatus,
        refreshStatus,
        connectUserByUsername,
        disconnectUser,
        isLive,
        isDemo,
        isGitHubSynced,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
};

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
