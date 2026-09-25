import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { RepositoryItem } from '../../data/mock/types';

interface RepositoryCardProps {
  repo: RepositoryItem;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repo }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container hover:border-outline-variant hover:shadow-md transition-all flex flex-col justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-primary text-[22px]">source</span>
            <h3
              onClick={() => navigate(`/issues?repo=${encodeURIComponent(repo.fullName)}`)}
              className="font-headline-sm text-headline-sm text-on-surface font-semibold hover:text-primary transition-colors cursor-pointer truncate"
            >
              {repo.fullName}
            </h3>
          </div>
          {repo.isWatching && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-code-sm text-[11px] font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              Guardian Active
            </span>
          )}
        </div>

        <p className="font-body-md text-body-md text-secondary line-clamp-2">
          {repo.description}
        </p>

        {/* Tech Stack Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {repo.techStack.map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 rounded bg-surface-container font-code-sm text-[11px] text-on-surface font-medium"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-surface-container-low text-secondary font-code-sm text-code-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">star</span>
            {repo.stars.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">adjust</span>
            {repo.openIssuesCount} issues
          </span>
          <span className="flex items-center gap-1 text-primary font-medium">
            <span className="material-symbols-outlined text-[15px]">call_merge</span>
            {repo.activePRsCount} PRs
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/issues')}
          className="text-primary hover:underline font-semibold flex items-center gap-1"
        >
          <span>View Issues</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
