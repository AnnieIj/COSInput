import React from 'react';
import type { AcceptanceCriterionItem } from '../../data/mock/types';

interface AcceptanceCriteriaListProps {
  items: AcceptanceCriterionItem[];
  statusHeadline?: string;
  passedCount?: number;
  blockedCount?: number;
}

export const AcceptanceCriteriaList: React.FC<AcceptanceCriteriaListProps> = ({
  items,
  statusHeadline = 'NOT READY',
  passedCount = 4,
  blockedCount = 1,
}) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
          <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Acceptance Verification
          </h4>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div
        className={`p-3 rounded-lg flex items-center justify-between ${
          blockedCount > 0
            ? 'bg-error-container/20 border border-error/30'
            : 'bg-tertiary-container/20 border border-tertiary/30'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              blockedCount > 0 ? 'bg-error animate-ping' : 'bg-tertiary'
            }`}
          ></span>
          <span
            className={`font-headline-sm text-headline-sm font-bold ${
              blockedCount > 0 ? 'text-error' : 'text-tertiary'
            }`}
          >
            {statusHeadline}
          </span>
        </div>
        <div className="flex items-center gap-2 font-code-sm text-code-sm">
          <span className="text-tertiary font-semibold">{passedCount} Passed</span>
          {blockedCount > 0 && (
            <>
              <span className="text-outline">•</span>
              <span className="text-error font-semibold">{blockedCount} Blocked</span>
            </>
          )}
        </div>
      </div>

      {/* Items Breakdown */}
      <div className="flex flex-col gap-1.5 mt-2">
        {items.map((item) => {
          const isPassed = item.status === 'Passed';
          const isBlocked = item.status === 'Blocked';

          return (
            <div
              key={item.id}
              className={`p-2.5 rounded-lg flex flex-col gap-0.5 border ${
                isBlocked
                  ? 'bg-error-container/30 border-error/30'
                  : 'bg-surface-container-low border-surface-container-high/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-body-sm text-body-sm flex items-center gap-1.5 font-medium ${
                    isBlocked ? 'text-error font-semibold' : 'text-on-surface'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[16px] ${
                      isBlocked ? 'text-error' : 'text-tertiary'
                    }`}
                  >
                    {isBlocked ? 'cancel' : 'check_circle'}
                  </span>
                  {item.title}
                </span>
                <span
                  className={`font-code-sm text-code-sm font-bold ${
                    isBlocked ? 'text-error' : 'text-tertiary'
                  }`}
                >
                  {item.status}
                </span>
              </div>

              {item.evidencePath && (
                <span className="font-code-sm text-[11px] text-secondary pl-5 truncate">
                  Evidence: {item.evidencePath}
                </span>
              )}
              {item.statusNote && (
                <span className="font-code-sm text-[11px] text-error pl-5">
                  Status: {item.statusNote}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
