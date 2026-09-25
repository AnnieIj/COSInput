import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockIssues } from '../data/mock';

export const IssueDetailPage: React.FC = () => {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();

  const issue = mockIssues.find((i) => String(i.number) === issueId) || mockIssues[0];

  return (
    <div className="w-full px-4 lg:px-8 py-6 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary">
        <button
          type="button"
          onClick={() => navigate('/issues')}
          className="hover:text-primary transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Issues</span>
        </button>
        <span>/</span>
        <span className="text-on-surface font-semibold">{issue.repository}</span>
        <span>/</span>
        <span className="text-primary font-bold">#{issue.number}</span>
      </div>

      {/* Main Issue Card Header */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-code-sm text-code-sm text-secondary font-medium">
                {issue.repository} #{issue.number}
              </span>
              <span className="font-code-sm text-code-sm text-outline">•</span>
              <span className="font-code-sm text-code-sm text-secondary">
                Opened by {issue.author} {issue.createdAt}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-code-sm text-[11px] font-semibold">
                {issue.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              {issue.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/contributions/${issue.number}`)}
              className="px-4 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">terminal</span>
              <span>Launch Workspace</span>
            </button>
          </div>
        </div>

        {/* Labels Strip */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {issue.labels.map((lbl) => (
            <span
              key={lbl.text}
              className={`px-2.5 py-0.5 rounded-full font-code-sm text-[11px] font-semibold ${lbl.color}`}
            >
              {lbl.text}
            </span>
          ))}
        </div>
      </div>

      {/* Two Column Spec & AST Indexing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Issue Spec & Requirements */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                <span>Issue Description & Scope</span>
              </h2>
              <span className="font-code-sm text-code-sm text-secondary">Markdown Spec</span>
            </div>

            <div className="p-4 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface leading-relaxed">
              <p>{issue.summary}</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Extracted Acceptance Criteria ({issue.acceptanceCriteriaCount})
              </h3>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-tertiary text-[18px] mt-0.5">check_circle</span>
                  <span className="font-body-md text-body-md text-on-surface">
                    Verification form UI renders input validation with reactive balance checks.
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-tertiary text-[18px] mt-0.5">check_circle</span>
                  <span className="font-body-md text-body-md text-on-surface">
                    Stake amount serialized cleanly to BigInt units before contract dispatch.
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-tertiary text-[18px] mt-0.5">check_circle</span>
                  <span className="font-body-md text-body-md text-on-surface">
                    Web3 wallet signature verification hook invokes cryptographic proof verification.
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">block</span>
                  <span className="font-body-md text-body-md text-on-surface">
                    Canonical contract configuration (Strict Rule: No mock addresses allowed).
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: AST Context & Invariant Ledger */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
              <span>AST Indexing Context</span>
            </h3>
            <p className="font-body-sm text-body-sm text-secondary">
              Pre-computed by Tree-sitter AST parser on repository main branch.
            </p>

            <div className="flex flex-col gap-2 font-code-sm text-code-sm">
              <div className="p-2.5 rounded bg-surface-container-low flex justify-between">
                <span className="text-secondary">Indexed Files:</span>
                <span className="font-semibold text-on-surface">42 files</span>
              </div>
              <div className="p-2.5 rounded bg-surface-container-low flex justify-between">
                <span className="text-secondary">Exported Symbols:</span>
                <span className="font-semibold text-on-surface">184 symbols</span>
              </div>
              <div className="p-2.5 rounded bg-surface-container-low flex justify-between">
                <span className="text-secondary">Test Harness:</span>
                <span className="font-semibold text-tertiary">Vitest v3.4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
