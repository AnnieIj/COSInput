import React, { useState } from 'react';
import { mockIssues } from '../data/mock';
import { IssueCard } from '../components/common/IssueCard';

export const IssuesPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'active_contribution' | 'review' | 'triage'>('all');
  const [search, setSearch] = useState('');

  const filteredIssues = mockIssues.filter((issue) => {
    if (filter !== 'all' && issue.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        issue.title.toLowerCase().includes(q) ||
        issue.summary.toLowerCase().includes(q) ||
        issue.repository.toLowerCase().includes(q) ||
        String(issue.number).includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full px-4 lg:px-8 py-6 flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
            Repository Issues
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Triaged and indexed issue queue from authorized open-source repositories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-medium border border-surface-container shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Sync GitHub Issues</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-primary-container text-on-primary'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            All Issues ({mockIssues.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('active_contribution')}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
              filter === 'active_contribution'
                ? 'bg-primary-container text-on-primary'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            Active Contributions (1)
          </button>
          <button
            type="button"
            onClick={() => setFilter('review')}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
              filter === 'review'
                ? 'bg-primary-container text-on-primary'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            Under Review (1)
          </button>
          <button
            type="button"
            onClick={() => setFilter('triage')}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md font-semibold transition-colors ${
              filter === 'triage'
                ? 'bg-primary-container text-on-primary'
                : 'text-secondary hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            Triage Ready (1)
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">
            filter_list
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter issues..."
            className="w-full h-8 pl-8 pr-3 bg-surface-container-low rounded-lg font-code-sm text-code-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Issues List */}
      <div className="flex flex-col gap-3">
        {filteredIssues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
};
