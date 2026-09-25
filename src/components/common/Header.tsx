import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/issues?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/90 backdrop-blur-xl border-b border-surface-container z-40 flex items-center justify-between px-4 lg:px-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
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

        {/* GitHub Synced & Repository Chip */}
        <div className="hidden xl:flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-lowest rounded-full border border-surface-container shadow-sm">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span className="font-code-sm text-code-sm text-tertiary font-semibold">GitHub Synced</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/pull-requests')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low hover:bg-surface-container transition-colors rounded-full cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-primary text-[14px]">merge_type</span>
            <span className="font-code-sm text-code-sm text-on-surface font-medium truncate max-w-[200px]">
              DigiNodes / truthbounty-frontend #405
            </span>
          </button>
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/contributions/381/conflicts')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md font-medium border border-surface-container shadow-sm transition-all"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">commit</span>
          <span>Cherry-pick</span>
        </button>

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
          className="relative p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          aria-label="View notifications"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error"></span>
        </button>

        {/* Profile Avatar */}
        <div className="flex items-center pl-1">
          <div className="w-8 h-8 rounded-full bg-primary-container ring-2 ring-surface-container flex items-center justify-center font-bold text-on-primary text-xs shadow-sm overflow-hidden">
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
          </div>
        </div>
      </div>
    </header>
  );
};
