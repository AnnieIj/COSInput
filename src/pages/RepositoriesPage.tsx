import React from 'react';
import { mockRepositories } from '../data/mock';
import { RepositoryCard } from '../components/common/RepositoryCard';

export const RepositoriesPage: React.FC = () => {
  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
            Authorized Repositories
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Repositories connected via GitHub App authorization with AST indexing and Guardian watching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert("GitHub App authorization dialog will connect new repositories in Phase 2.")}
            className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Connect Repository</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockRepositories.map((repo) => (
          <RepositoryCard key={repo.id} repo={repo} />
        ))}
      </div>
    </div>
  );
};
