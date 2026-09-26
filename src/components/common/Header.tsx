import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode } from '../../context/ModeContext';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { mode, setMode, isGitHubSynced, connectionState, currentUser } = useMode();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/issues?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getConnectionBadge = () => {
    if (mode === 'demo') {
      return (
        <button
          type="button"
          onClick={() => setMode('live')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-900 rounded-full font-code-sm text-code-sm font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer"
          title="Click to switch to Live GitHub Mode"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Demo Mode</span>
        </button>
      );
    }

    if (isGitHubSynced) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-lowest border border-surface-container rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-tertiary"></span>
          <span className="font-code-sm text-code-sm text-tertiary font-semibold">GitHub Synced</span>
        </div>
      );
    }

    let label = 'GitHub Not Connected';
    let dotColor = 'bg-secondary';
    if (connectionState === 'APP_NOT_INSTALLED') {
      label = 'App Not Installed';
      dotColor = 'bg-amber-500';
    } else if (connectionState === 'AUTH_FAILED') {
      label = 'Auth Failed';
      dotColor = 'bg-error';
    } else if (connectionState === 'API_UNAVAILABLE') {
      label = 'API Unavailable';
      dotColor = 'bg-error';
    }

    return (
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low border border-surface-container rounded-full hover:bg-surface-container text-secondary font-code-sm text-code-sm transition-colors cursor-pointer"
        title="Configure GitHub Connection"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
        <span>{label}</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-surface/90 backdrop-blur-xl border-b border-surface-container flex items-center justify-between px-4 lg:px-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Left: Mobile Toggle & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container"
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-9 pl-9 pr-14 bg-surface-container-low rounded-lg font-code-sm text-code-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm hover:bg-surface-container transition-all"
            placeholder="Search issues, PRs, diff nodes, branches... (Press ⌘K)"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-label-caps text-label-caps bg-surface-container text-secondary px-1.5 py-0.5 rounded font-semibold select-none">
            ⌘K
          </kbd>
        </div>

        {/* GitHub Connection Badge & Mode Switcher */}
        <div className="hidden xl:flex items-center gap-2">
          {getConnectionBadge()}
          <button
            type="button"
            onClick={() => setMode(mode === 'live' ? 'demo' : 'live')}
            className="text-[11px] font-code-sm px-2 py-0.5 rounded border border-surface-container text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            {mode === 'live' ? 'Switch to Demo' : 'Switch to Live'}
          </button>
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/contributions/381')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-medium transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>New Contribution</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="relative p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          aria-label="View settings & notifications"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>

        {/* Profile Avatar */}
        <div
          onClick={() => navigate('/settings')}
          className="flex items-center pl-1 cursor-pointer"
          title="Account & GitHub App Settings"
        >
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.login}
              className="w-8 h-8 rounded-full ring-2 ring-surface-container object-cover shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-container ring-2 ring-surface-container flex items-center justify-center font-bold text-on-primary text-xs shadow-sm overflow-hidden font-mono">
              {currentUser ? currentUser.login.slice(0, 2).toUpperCase() : 'CO'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
