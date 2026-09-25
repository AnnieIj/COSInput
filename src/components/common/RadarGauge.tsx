import React from 'react';

interface ChecklistItem {
  title: string;
  status: string;
  variant: 'success' | 'error' | 'neutral';
}

interface RadarGaugeProps {
  score: number;
  isReady?: boolean;
  statusText?: string;
  statusSubtext?: string;
  checklist?: ChecklistItem[];
}

export const RadarGauge: React.FC<RadarGaugeProps> = ({
  score = 60,
  isReady = false,
  statusText = 'NOT MERGE READY',
  statusSubtext = 'Blocked by 1 failing CI check & maintainer changes requested.',
  checklist = [],
}) => {
  // SVG circular calculation: circumference = 2 * PI * r = 2 * 3.14159 * 42 = ~263.89
  const circumference = 264;
  const strokeDashoffset = circumference - (circumference * score) / 100;

  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 border border-surface-container shadow-sm flex flex-col justify-between gap-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-label-caps text-[10px] uppercase text-secondary font-bold tracking-wider">
              Cockpit Gauge
            </span>
            <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Merge Readiness Radar
            </h3>
          </div>
          <span
            className={`p-2 rounded-lg flex items-center justify-center ${
              isReady ? 'bg-tertiary-container/30 text-tertiary' : 'bg-error-container text-error'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isReady ? 'verified_user' : 'gpp_maybe'}
            </span>
          </span>
        </div>

        {/* Circular Gauge Graphic & Status */}
        <div className="p-4 rounded-xl bg-surface-container-low flex flex-col items-center text-center relative overflow-hidden border border-surface-container">
          <div className="relative w-36 h-36 my-1">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-surface-container"
                cx="50"
                cy="50"
                fill="none"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
              />
              <circle
                className={isReady ? 'text-tertiary' : 'text-error'}
                cx="50"
                cy="50"
                fill="none"
                r="42"
                stroke="currentColor"
                strokeDasharray="264"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="8"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline-xl text-headline-xl font-extrabold text-on-surface leading-none">
                {score}%
              </span>
              <span className="font-label-caps text-[10px] uppercase tracking-wider text-secondary mt-1">
                Readiness
              </span>
            </div>
          </div>

          <div className="mt-2">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-headline-sm text-headline-sm font-bold ${
                isReady
                  ? 'bg-tertiary-container text-on-tertiary-container'
                  : 'bg-error-container text-error'
              }`}
            >
              {!isReady && <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>}
              {isReady && <span className="w-2 h-2 rounded-full bg-tertiary"></span>}
              <span>{statusText}</span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mt-1.5 max-w-xs">{statusSubtext}</p>
          </div>
        </div>

        {/* Detailed Invariants Checklist */}
        {checklist.length > 0 && (
          <div className="space-y-1.5">
            <span className="font-label-caps text-[10px] uppercase text-secondary font-bold tracking-wider">
              Invariants Checklist
            </span>
            <div className="space-y-1.5 font-body-sm text-body-sm">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded border ${
                    item.variant === 'error'
                      ? 'bg-error-container/20 border-error/30'
                      : item.variant === 'success'
                      ? 'bg-surface-container-low border-surface-container-high/40'
                      : 'bg-surface-container-low border-surface-container-high/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[16px] shrink-0 ${
                        item.variant === 'success'
                          ? 'text-tertiary'
                          : item.variant === 'error'
                          ? 'text-error'
                          : 'text-secondary'
                      }`}
                    >
                      {item.variant === 'success'
                        ? 'check_circle'
                        : item.variant === 'error'
                        ? 'cancel'
                        : 'pending'}
                    </span>
                    <span
                      className={`truncate ${
                        item.variant === 'error'
                          ? 'text-on-surface font-semibold'
                          : item.variant === 'neutral'
                          ? 'text-secondary'
                          : 'text-on-surface'
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  <span
                    className={`font-code-sm text-code-sm font-bold shrink-0 ${
                      item.variant === 'success'
                        ? 'text-tertiary'
                        : item.variant === 'error'
                        ? 'text-error'
                        : 'text-secondary'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Strict Policy Banner */}
      <div className="p-3 rounded-lg bg-surface-container-high text-on-surface space-y-1 border border-surface-container-highest">
        <div className="flex items-center gap-1.5 text-primary font-bold font-headline-sm text-headline-sm">
          <span className="material-symbols-outlined text-[16px]">lock</span>
          <span>Strict Non-Circumvention Policy</span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary leading-snug">
          Strict Rule: COSInput will never automatically merge or claim merge readiness while checks or reviews remain unresolved.
        </p>
      </div>
    </div>
  );
};
