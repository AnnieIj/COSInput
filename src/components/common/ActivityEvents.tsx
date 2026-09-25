import React from 'react';
import type { AuditTimelineEvent } from '../../data/mock/types';

interface ActivityEventsProps {
  events: AuditTimelineEvent[];
  title?: string;
  showFilter?: boolean;
}

export const ActivityEvents: React.FC<ActivityEventsProps> = ({
  events,
  title = 'Guardian Activity Timeline & Audit Ledger',
  showFilter = true,
}) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 border border-surface-container shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">history</span>
            <span>{title}</span>
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Tamper-evident log of automated evaluations, webhook triggers, and human reviews.
          </p>
        </div>
        {showFilter && (
          <button
            type="button"
            className="inline-flex items-center gap-1 font-code-sm text-code-sm text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[15px]">filter_list</span>
            <span>Filter</span>
          </button>
        )}
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-4">
        {/* Track Line */}
        <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-surface-container-highest"></div>

        {events.map((evt) => (
          <div key={evt.id} className="relative flex items-start gap-3 group">
            {/* Timeline Icon Node */}
            <span
              className={`absolute -left-6 top-1 w-5 h-5 rounded-full ${evt.iconBg} ${evt.iconColor} flex items-center justify-center ring-4 ring-surface-container-lowest`}
            >
              <span className="material-symbols-outlined text-[12px]">{evt.icon}</span>
            </span>

            <div className="w-full p-3 rounded-lg bg-surface-container-low group-hover:bg-surface-container transition-colors">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  {evt.title}
                </span>
                <span className="font-code-sm text-code-sm text-secondary">{evt.time}</span>
              </div>

              <p className="font-body-md text-body-md text-secondary mt-1">
                {evt.description}
              </p>

              {evt.quote && (
                <div className="mt-2 p-2 rounded bg-surface-container-lowest text-secondary font-body-sm text-body-sm italic border-l-2 border-primary">
                  {evt.quote}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2">
                <span className="font-label-caps text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-secondary uppercase font-bold">
                  {evt.sourceBadge}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
