import React from 'react';
import type { ContinuousRunCheckpoint } from '../../data/mock/types';

interface RunStageItemProps {
  checkpoint: ContinuousRunCheckpoint;
}

export const RunStageItem: React.FC<RunStageItemProps> = ({ checkpoint }) => {
  const getIcon = () => {
    switch (checkpoint.status) {
      case 'completed':
      case 'done':
        return <span className="material-symbols-outlined text-[18px] text-tertiary">check_circle</span>;
      case 'failed':
        return <span className="material-symbols-outlined text-[18px] text-error">cancel</span>;
      case 'running':
        return <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>;
      case 'waiting':
        return <span className="material-symbols-outlined text-[18px] text-secondary">pending_actions</span>;
      default:
        return <span className="material-symbols-outlined text-[18px] text-outline">radio_button_unchecked</span>;
    }
  };

  const getTagBadgeClass = () => {
    switch (checkpoint.tagVariant) {
      case 'agent':
        return 'bg-primary-fixed text-primary';
      case 'github_verified':
        return 'bg-tertiary-fixed text-tertiary-container';
      case 'sandbox':
        return 'bg-primary-fixed text-primary';
      case 'user_approved':
        return 'bg-secondary-fixed text-on-secondary-fixed';
      case 'local_verified':
        return 'bg-surface-container-high text-on-surface';
      case 'maintainer':
        return 'bg-secondary-container text-on-secondary-fixed';
      default:
        return 'bg-surface-container text-secondary';
    }
  };

  const getContainerBg = () => {
    if (checkpoint.status === 'failed') return 'bg-error-container/30 border border-error/30';
    if (checkpoint.status === 'running') return 'bg-primary-fixed/30 border border-primary/20';
    return 'hover:bg-surface-container-low';
  };

  return (
    <div className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors ${getContainerBg()}`}>
      <div className="mt-0.5 shrink-0">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-body-md text-body-md font-semibold truncate ${
                checkpoint.status === 'failed'
                  ? 'text-error'
                  : checkpoint.status === 'running'
                  ? 'text-primary'
                  : 'text-on-surface'
              }`}
            >
              {checkpoint.title}
            </span>
            {checkpoint.status === 'failed' && (
              <span className="font-label-caps text-[9px] bg-error text-on-error px-1 py-0.2 rounded font-bold">
                FAILED
              </span>
            )}
            {checkpoint.status === 'done' && (
              <span className="font-label-caps text-[9px] bg-tertiary-fixed text-tertiary-container px-1 py-0.2 rounded font-bold">
                Done
              </span>
            )}
            {checkpoint.status === 'running' && (
              <span className="font-label-caps text-[9px] bg-primary text-on-primary px-1 py-0.2 rounded font-bold animate-pulse">
                RUNNING
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="font-code-sm text-code-sm text-outline">{checkpoint.duration}</span>
            <span className={`font-label-caps text-[10px] px-1.5 py-0.5 rounded font-medium ${getTagBadgeClass()}`}>
              {checkpoint.tag}
            </span>
          </div>
        </div>
        <p className="font-code-sm text-code-sm text-secondary truncate mt-0.5">
          {checkpoint.description}
        </p>
      </div>
    </div>
  );
};
