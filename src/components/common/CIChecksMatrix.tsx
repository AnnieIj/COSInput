import React from 'react';

export interface CICheckItem {
  id: string;
  name: string;
  tool: string;
  status: 'passed' | 'failed' | 'running' | 'blocked';
  passedSummary: string;
  secondarySummary?: string;
  duration?: string;
  verifiedTag: string;
  runTag?: string;
  isActiveFocus?: boolean;
}

interface CIChecksMatrixProps {
  checks: CICheckItem[];
  onSelectCheck?: (checkId: string) => void;
  selectedCheckId?: string;
}

export const CIChecksMatrix: React.FC<CIChecksMatrixProps> = ({
  checks,
  onSelectCheck,
  selectedCheckId,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {checks.map((check) => {
        const isSelected = selectedCheckId ? selectedCheckId === check.id : check.isActiveFocus;
        const isFailed = check.status === 'failed';
        const isPassed = check.status === 'passed';
        const isBlocked = check.status === 'blocked';

        return (
          <div
            key={check.id}
            onClick={() => onSelectCheck?.(check.id)}
            className={`p-4 rounded-xl flex flex-col justify-between gap-3 border transition-all cursor-pointer relative overflow-hidden ${
              isSelected
                ? 'bg-surface-container-lowest border-primary shadow-md ring-1 ring-primary'
                : isFailed
                ? 'bg-surface-container-lowest border-error/40 shadow-sm hover:border-error'
                : 'bg-surface-container-lowest border-surface-container shadow-sm hover:border-outline-variant'
            }`}
          >
            {isFailed && <div className="absolute top-0 left-0 right-0 h-1 bg-error"></div>}
            {isPassed && <div className="absolute top-0 left-0 right-0 h-1 bg-tertiary"></div>}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isPassed && (
                  <span className="material-symbols-outlined text-tertiary text-[18px]">
                    check_circle
                  </span>
                )}
                {isFailed && (
                  <span className="material-symbols-outlined text-error text-[18px]">cancel</span>
                )}
                {isBlocked && (
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    hourglass_empty
                  </span>
                )}
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  {check.name}
                </span>
              </div>
              <span className="font-label-caps text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-secondary">
                {check.tool}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between font-code-sm text-code-sm">
                <span className={`font-semibold ${isFailed ? 'text-error' : isPassed ? 'text-tertiary' : 'text-secondary'}`}>
                  {check.passedSummary}
                </span>
                {check.duration && (
                  <span className="text-secondary text-[11px]">{check.duration}</span>
                )}
              </div>
              <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full ${
                    isFailed ? 'bg-error w-full' : isPassed ? 'bg-tertiary-fixed-dim w-full' : 'bg-secondary/40 w-0'
                  }`}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between text-secondary pt-1 border-t border-surface-container-low text-[11px] font-code-sm">
              <span className={`font-label-caps flex items-center gap-1 ${isFailed ? 'text-error font-medium' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isFailed ? 'bg-error' : isPassed ? 'bg-tertiary' : 'bg-secondary'}`}></span>
                {check.verifiedTag}
              </span>
              <span>{check.runTag}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
