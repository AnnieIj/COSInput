import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { IssueItem } from '../../data/mock/types';

interface IssueCardProps {
  issue: IssueItem;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container hover:border-outline-variant hover:shadow-md transition-all flex flex-col justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">adjust</span>
            <span className="font-code-sm text-code-sm text-secondary font-medium">
              {issue.repository} #{issue.number}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {issue.status === 'active_contribution' && (
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm text-[11px] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                Active Contribution
              </span>
            )}
            {issue.labels.map((lbl) => (
              <span
                key={lbl.text}
                className={`px-2 py-0.5 rounded-full font-code-sm text-[11px] font-medium ${lbl.color}`}
              >
                {lbl.text}
              </span>
            ))}
          </div>
        </div>

        <h3
          onClick={() => navigate(`/issues/${issue.number}`)}
          className="font-headline-sm text-headline-sm text-on-surface font-semibold hover:text-primary transition-colors cursor-pointer"
        >
          {issue.title}
        </h3>

        <p className="font-body-md text-body-md text-secondary line-clamp-2">
          {issue.summary}
        </p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-surface-container-low font-code-sm text-code-sm text-secondary flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>By {issue.author}</span>
          <span>•</span>
          <span>{issue.createdAt}</span>
          <span>•</span>
          <span className="text-tertiary font-medium">
            {issue.acceptanceCriteriaCount} Acceptance Criteria
          </span>
        </div>

        <div className="flex items-center gap-2">
          {issue.activeContributionId ? (
            <button
              type="button"
              onClick={() => navigate(`/contributions/${issue.activeContributionId}`)}
              className="px-3 py-1 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">terminal</span>
              <span>Open Workspace</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/issues/${issue.number}`)}
              className="px-3 py-1 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center gap-1"
            >
              <span>Inspect Spec</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
