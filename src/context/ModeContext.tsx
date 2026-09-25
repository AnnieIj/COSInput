import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { githubService } from '../services/github.service';
import type { GitHubConnectionState, SanitizedGitHubError, GitHubUser } from '../services/types';

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
  loadingStatus: boolean;
  refreshStatus: () => Promise<void>;
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
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  const setMode = (newMode: AppDataMode) => {
    setModeState(newMode);
    localStorage.setItem('cosinput_mode', newMode);
  };

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = await githubService.getConnectionStatus();
      setStatusData(status);
      setConnectionState(status.state);

      if (status.state === 'APP_INSTALLED' && status.activeInstallation) {
        const inst = status.activeInstallation;
        setCurrentUser({
          id: String(inst.id),
          login: inst.accountLogin,
          name: inst.accountLogin,
          avatarUrl: inst.accountAvatarUrl,
          authorized: true,
          syncedAt: inst.updatedAt || new Date().toISOString(),
        });
      } else {
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
      setCurrentUser(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const isLive = mode === 'live';
  const isDemo = mode === 'demo';

  // Strict Rule: Never show "GitHub Synced" unless real authenticated request succeeded in live mode
  const isGitHubSynced = isLive && connectionState === 'APP_INSTALLED' && Boolean(currentUser);

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        connectionState,
        statusData,
        currentUser,
        loadingStatus,
        refreshStatus,
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
