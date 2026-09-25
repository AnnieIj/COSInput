import React, { useState } from 'react';

interface ApprovalActionsProps {
  onApprove?: () => void;
  onDiscard?: () => void;
  onEdit?: () => void;
  approveLabel?: string;
  discardLabel?: string;
  editLabel?: string;
  isCompleted?: boolean;
  completedMessage?: string;
}

export const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  onApprove,
  onDiscard,
  onEdit,
  approveLabel = 'Approve & Push Fix to PR #405',
  discardLabel = 'Discard Repair',
  editLabel = 'Edit Proposed Fix',
  isCompleted = false,
  completedMessage = 'Fix Pushed & CI Re-triggered',
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(isCompleted);

  const handleApprove = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      onApprove?.();
    }, 1000);
  };

  return (
    <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {onDiscard && (
          <button
            type="button"
            onClick={onDiscard}
            className="px-3.5 py-2 rounded-lg bg-surface-container text-error hover:bg-error-container hover:text-on-error-container font-headline-sm text-headline-sm font-medium transition-all text-center w-full sm:w-auto flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">delete_outline</span>
            <span>{discardLabel}</span>
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="px-3.5 py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-headline-sm text-headline-sm font-medium border border-surface-container shadow-sm transition-all text-center w-full sm:w-auto flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>{editLabel}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          disabled={loading || success}
          onClick={handleApprove}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-headline-sm text-headline-sm font-semibold shadow-md transition-all ${
            success
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-primary-container text-on-primary hover:bg-primary'
          }`}
        >
          {loading && (
            <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
          )}
          {success && (
            <span className="material-symbols-outlined text-[18px]">done</span>
          )}
          {!loading && !success && (
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
          )}
          <span>{success ? completedMessage : loading ? 'Pushing patch...' : approveLabel}</span>
        </button>
      </div>
    </div>
  );
};
