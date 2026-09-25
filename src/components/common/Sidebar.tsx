import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { COSInputLogo } from './COSInputLogo';
import { useMode } from '../../context/ModeContext';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const navigate = useNavigate();
  const { mode, currentUser, isGitHubSynced, connectionState, statusData } = useMode();

  const getProfileInfo = () => {
    if (mode === 'demo') {
      return {
        username: '@alex-chen-dev',
        badge: 'Demo Account (Authorized)',
        statusText: 'Synced',
        statusColor: 'bg-tertiary-fixed text-tertiary-fixed',
        id: '884920',
      };
    }

    if (currentUser) {
      return {
        username: `@${currentUser.login}`,
        badge: 'GitHub App Connected',
        statusText: 'Synced',
        statusColor: 'bg-tertiary-fixed text-tertiary-fixed',
        id: currentUser.id,
      };
    }

    let statusText = 'Not Connected';
    let statusColor = 'bg-secondary text-secondary';
    if (connectionState === 'AUTH_FAILED') {
      statusText = 'Auth Failed';
      statusColor = 'bg-error text-error';
    } else if (connectionState === 'APP_NOT_INSTALLED') {
      statusText = 'Not Installed';
      statusColor = 'bg-amber-400 text-amber-400';
    }

    return {
      username: 'GitHub App',
      badge: 'Configure in Settings',
      statusText,
      statusColor,
      id: statusData?.appSlug ? `@${statusData.appSlug}` : 'Unlinked',
    };
  };

  const profile = getProfileInfo();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Persistent Left Navigation Spine */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-inverse-surface text-inverse-on-surface z-50 flex flex-col justify-between select-none shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Top Brand Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                navigate('/');
                onCloseMobile?.();
              }}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity text-left"
            >
              <COSInputLogo size={32} showText={true} />
            </button>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-primary text-on-primary font-code-sm text-[10px] font-semibold">
                v2.4 Pro
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1 text-outline-variant hover:text-white"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Active Repository Card Dropdown */}
          <div className="px-3 py-1">
            <div
              onClick={() => {
                navigate('/repositories');
                onCloseMobile?.();
              }}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container-highest/10 hover:bg-surface-container-highest/20 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 overflow-hidden min-w-0">
                <span className="material-symbols-outlined text-inverse-primary text-[18px] shrink-0">
                  folder_code
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-caps text-[10px] text-outline-variant uppercase tracking-wider">
                    {mode === 'demo' ? 'Active Repository' : isGitHubSynced ? 'Authorized Repository' : 'Repository Setup'}
                  </span>
                  <span className="font-code-sm text-code-sm text-surface-container-lowest truncate font-medium">
                    {mode === 'demo'
                      ? 'DigiNodes / truthbounty-frontend'
                      : isGitHubSynced
                      ? 'Authorized via App'
                      : 'Connect in Settings'}
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline-variant text-[16px] shrink-0 group-hover:text-white">
                unfold_more
              </span>
            </div>
          </div>

          {/* Section: Workspace Engine */}
          <div className="px-4 pt-4 pb-1">
            <span className="font-label-caps text-[10px] uppercase text-secondary-fixed-dim tracking-wider font-semibold">
              Workspace Engine
            </span>
          </div>

          <nav className="flex flex-col gap-1 px-3">
            <NavLink
              to="/dashboard"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                <span className="font-body-md text-body-md">Dashboard</span>
              </div>
            </NavLink>

            <NavLink
              to="/issues"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">adjust</span>
                <span className="font-body-md text-body-md">Issues</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high/30 text-surface-container-lowest font-code-sm text-code-sm">
                {mode === 'demo' ? '14' : isGitHubSynced ? 'Real' : '0'}
              </span>
            </NavLink>

            <NavLink
              to="/contributions/381"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                <span className="font-body-md text-body-md">Workspace / Runs</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-code-sm text-code-sm flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
                1 Active
              </span>
            </NavLink>

            <NavLink
              to="/pull-requests"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">call_merge</span>
                <span className="font-body-md text-body-md">Pull Requests</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high/30 text-surface-container-lowest font-code-sm text-code-sm">
                {mode === 'demo' ? '3' : 'Live'}
              </span>
            </NavLink>

            <NavLink
              to="/repositories"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">account_tree</span>
                <span className="font-body-md text-body-md">Repositories</span>
              </div>
            </NavLink>

            {/* Section: Auditing */}
            <div className="px-2 pt-3 pb-1">
              <div className="h-px bg-white/10 w-full mb-2"></div>
              <span className="font-label-caps text-[10px] uppercase text-secondary-fixed-dim tracking-wider font-semibold">
                Auditing & Surveillance
              </span>
            </div>

            <NavLink
              to="/contributions/381/guardian"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex flex-col gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-tertiary-fixed">
                    verified_user
                  </span>
                  <span className="font-body-md text-body-md">Guardian</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-pulse"></span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-code-sm pl-7 text-inverse-primary">
                <span>Watching PR #405</span>
                <span className="px-1.5 py-0.2 rounded bg-tertiary-container text-on-tertiary-container font-semibold">
                  Active
                </span>
              </div>
            </NavLink>

            <NavLink
              to="/runs/run_8f92a10c"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">terminal</span>
                <span className="font-body-md text-body-md">Live Agent Run</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-tertiary-fixed/20 text-tertiary-fixed font-code-sm text-[10px]">
                Run #8f
              </span>
            </NavLink>

            {/* Section: System */}
            <div className="px-2 pt-3 pb-1">
              <div className="h-px bg-white/10 w-full mb-2"></div>
              <span className="font-label-caps text-[10px] uppercase text-secondary-fixed-dim tracking-wider font-semibold">
                System
              </span>
            </div>

            <NavLink
              to="/settings"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-semibold'
                    : 'text-secondary-fixed-dim hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">settings</span>
                <span className="font-body-md text-body-md">Settings</span>
              </div>
            </NavLink>
          </nav>
        </div>

        {/* Bottom User Profile Section */}
        <div
          onClick={() => navigate('/settings')}
          className="p-3 m-3 rounded-xl bg-surface-container-highest/10 border border-white/5 shadow-sm cursor-pointer hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.login}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center font-code-sm text-code-sm font-semibold text-on-primary shrink-0">
                  {profile.username.slice(1, 3).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-headline-sm text-surface-container-lowest leading-none truncate font-medium">
                  {profile.username}
                </span>
                <span className="font-label-caps text-[10px] text-outline-variant mt-0.5 truncate">
                  {profile.badge}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${profile.statusColor.split(' ')[0]}`}></span>
              <span className="font-code-sm text-code-sm text-tertiary-fixed">
                {profile.statusText}
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-secondary-fixed-dim font-mono">
              ID: {profile.id}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
