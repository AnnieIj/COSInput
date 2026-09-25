import React from 'react';
import type { FailureClassificationCard } from '../../data/mock/types';

interface FailureClassificationsStripProps {
  cards: FailureClassificationCard[];
}

export const FailureClassificationsStrip: React.FC<FailureClassificationsStripProps> = ({ cards }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 border border-surface-container shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 gap-2 border-b border-surface-container-low mb-3">
        <div>
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">rule</span>
            <span>Four Failure Classification Invariants</span>
          </h2>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            COSInput strictly enforces semantic boundaries: automated repairs are non-destructive and isolated.
          </p>
        </div>
        <span className="font-code-sm text-code-sm text-secondary bg-surface-container px-2.5 py-1 rounded">
          Specification RFC-081
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          return (
            <div
              key={c.id}
              className={`p-4 rounded-lg transition-all ${
                c.highlighted
                  ? 'bg-error-container/20 border border-error/40 hover:bg-error-container/30'
                  : 'bg-surface-container-low border border-surface-container hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 font-headline-sm text-headline-sm font-semibold ${
                    c.highlighted ? 'text-error' : 'text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {c.id === 'code-failure'
                      ? 'code_off'
                      : c.id === 'ci-failure'
                      ? 'cloud_off'
                      : c.id === 'auth-failure'
                      ? 'key_off'
                      : 'block'}
                  </span>
                  <span>{c.title}</span>
                </span>
                <span
                  className={`font-label-caps text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                    c.highlighted
                      ? 'bg-error-container text-error'
                      : 'bg-surface-container-highest text-secondary'
                  }`}
                >
                  {c.badge}
                </span>
              </div>

              <p
                className={`font-body-sm text-body-sm leading-relaxed ${
                  c.highlighted ? 'text-on-surface' : 'text-secondary'
                }`}
              >
                {c.description}
              </p>

              <div
                className={`mt-3 font-code-sm text-code-sm flex items-center gap-1 font-medium ${
                  c.highlighted ? 'text-error font-bold' : 'text-primary'
                }`}
              >
                <span>{c.actionLabel}</span>
                <span className="material-symbols-outlined text-[14px]">{c.actionIcon}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
