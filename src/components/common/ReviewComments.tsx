import React, { useState } from 'react';

interface ReviewCommentsProps {
  reviewer: string;
  reviewerRole: string;
  timeAgo: string;
  badge: string;
  comment: string;
  proposedResolution?: string;
  onApplyPatch?: () => void;
  onDraftReply?: () => void;
}

export const ReviewComments: React.FC<ReviewCommentsProps> = ({
  reviewer,
  reviewerRole,
  timeAgo,
  badge,
  comment,
  proposedResolution,
  onApplyPatch,
  onDraftReply,
}) => {
  const [patchApplied, setPatchApplied] = useState(false);

  const handleApply = () => {
    setPatchApplied(true);
    onApplyPatch?.();
  };

  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-surface-container flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center font-code-sm font-semibold text-on-secondary-container">
            {reviewer.slice(1, 3).toUpperCase()}
          </div>
          <div>
            <span className="font-body-md text-body-md font-semibold text-on-surface">
              {reviewer}
            </span>
            <span className="font-label-caps text-[10px] bg-secondary-fixed text-on-secondary-fixed px-1.5 py-0.5 rounded ml-1 font-semibold">
              {reviewerRole}
            </span>
            <span className="font-code-sm text-code-sm text-secondary ml-2">left review {timeAgo}</span>
          </div>
        </div>
        <span className="font-label-caps text-[10px] bg-surface-container-high text-on-surface px-2.5 py-1 rounded font-semibold tracking-wider">
          {badge}
        </span>
      </div>

      {/* Review Comment Body */}
      <div className="bg-surface-container-lowest p-4 rounded-lg font-body-md text-body-md text-on-surface border border-surface-container-low shadow-sm">
        <p className="leading-relaxed">{comment}</p>
      </div>

      {/* Proposed Non-Destructive Resolution */}
      {proposedResolution && (
        <div className="flex flex-col gap-2 bg-surface-container-lowest p-4 rounded-lg border border-surface-container-low shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-primary font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
              COSINPUT GUARDIAN PROPOSED RESOLUTION
            </span>
            <span className="font-code-sm text-code-sm text-secondary font-medium">Ready to patch</span>
          </div>
          <pre className="bg-inverse-surface text-inverse-on-surface rounded-lg p-3 font-code-sm text-code-sm overflow-x-auto leading-relaxed">
            <code>{proposedResolution}</code>
          </pre>
        </div>
      )}

      {/* Action Buttons & Governance Guard */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={patchApplied}
            onClick={handleApply}
            className={`px-3.5 py-1.5 font-label-md text-label-md rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
              patchApplied
                ? 'bg-tertiary-container text-on-tertiary-container font-semibold'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {patchApplied ? 'check' : 'code'}
            </span>
            <span>{patchApplied ? 'Patch Applied to Branch' : 'Apply Patch to Branch'}</span>
          </button>
          <button
            type="button"
            onClick={onDraftReply}
            className="px-3.5 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-surface-container shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Draft Reply</span>
          </button>
        </div>
        <span className="font-code-sm text-[11px] text-secondary italic">
          Strict policy: COSInput will NOT automatically transmit review replies without user sign-off.
        </span>
      </div>
    </div>
  );
};
