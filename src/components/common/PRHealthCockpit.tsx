import React from 'react';
import { Link } from 'react-router-dom';
import type { PRHealthStatusCard } from '../../data/mock/types';

interface PRHealthCockpitProps {
  cards: PRHealthStatusCard[];
}

export const PRHealthCockpit: React.FC<PRHealthCockpitProps> = ({ cards }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
      {cards.map((card) => {
        return (
          <div
            key={card.id}
            className="flex flex-col justify-between p-4 rounded-xl bg-surface-container-lowest border border-surface-container shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
          >
            {/* Top Indicator Stripe */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${card.topStripeColor}`}></div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-[10px] uppercase text-secondary font-semibold tracking-wider">
                  {card.title}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-code-sm text-[11px] font-semibold ${
                    card.badgeVariant === 'error'
                      ? 'bg-error-container text-error'
                      : card.badgeVariant === 'success'
                      ? 'bg-tertiary-container/20 text-tertiary'
                      : card.badgeVariant === 'info'
                      ? 'bg-secondary-container text-on-secondary-fixed'
                      : 'bg-surface-container text-secondary'
                  }`}
                >
                  {card.badgeVariant === 'error' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                  )}
                  {card.badgeText}
                </span>
              </div>

              <div className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight mb-1">
                {card.primaryValue}{' '}
                {card.primarySubtext && (
                  <span className="font-body-md text-body-md text-secondary font-normal">
                    {card.primarySubtext}
                  </span>
                )}
              </div>

              <p className="font-body-sm text-body-sm text-secondary mb-3 line-clamp-2">
                {card.description}
              </p>
            </div>

            {card.actionHref && card.actionText ? (
              <Link
                to={card.actionHref}
                className="inline-flex items-center justify-between text-primary font-code-sm text-code-sm font-semibold hover:underline pt-2 border-t border-surface-container-low"
              >
                <span>{card.actionText}</span>
                {card.actionIcon && (
                  <span className="material-symbols-outlined text-[15px]">{card.actionIcon}</span>
                )}
              </Link>
            ) : (
              <div className="flex items-center gap-1.5 font-code-sm text-code-sm text-secondary pt-2 border-t border-surface-container-low">
                {card.actionIcon && (
                  <span className="material-symbols-outlined text-[15px] text-tertiary">
                    {card.actionIcon}
                  </span>
                )}
                <span>{card.actionText}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
