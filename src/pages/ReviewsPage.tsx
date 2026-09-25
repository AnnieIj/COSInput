import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockRun8f92a10c } from '../data/mock';
import { ReviewComments } from '../components/common/ReviewComments';

export const ReviewsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);

  const review = mockRun8f92a10c.reviewData;

  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 font-code-sm text-code-sm text-secondary">
            <span
              onClick={() => navigate(`/contributions/${id || '381'}`)}
              className="hover:text-primary cursor-pointer"
            >
              Contribution #{id || '381'}
            </span>
            <span>/</span>
            <span className="text-on-surface font-semibold">Maintainer Reviews</span>
          </nav>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight pt-1">
            Maintainer Feedback & Governance Inbox
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Human maintainer review threads, non-destructive patch suggestions, and signed author replies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/contributions/${id || '381'}/guardian`)}
            className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold border border-surface-container shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px] text-tertiary">security</span>
            <span>Return to Guardian Cockpit</span>
          </button>
        </div>
      </div>

      {/* Reviewer Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col">
          <span className="font-label-caps text-[10px] text-secondary uppercase font-bold">
            Maintainer Latency
          </span>
          <span className="font-headline-md text-headline-md font-semibold text-on-surface mt-1">
            {review.metrics.maintainerLatency}
          </span>
          <span className="font-code-sm text-code-sm text-tertiary">
            {review.metrics.maintainerLatencySub}
          </span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col">
          <span className="font-label-caps text-[10px] text-secondary uppercase font-bold">
            Merge Risk Index
          </span>
          <span className="font-headline-md text-headline-md font-semibold text-tertiary mt-1">
            {review.metrics.mergeRiskIndex}
          </span>
          <span className="font-code-sm text-code-sm text-secondary">
            {review.metrics.mergeRiskSub}
          </span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container shadow-sm flex flex-col">
          <span className="font-label-caps text-[10px] text-secondary uppercase font-bold">
            CI Check Health
          </span>
          <span className="font-headline-md text-headline-md font-semibold text-on-surface mt-1">
            {review.metrics.ciCheckHealth}
          </span>
          <span className="font-code-sm text-code-sm text-secondary">
            {review.metrics.ciCheckSub}
          </span>
        </div>
      </div>

      {/* Review Comment Unit */}
      <ReviewComments
        reviewer={review.reviewer}
        reviewerRole={review.reviewerRole}
        timeAgo={review.timeAgo}
        badge={review.badge}
        comment={review.comment}
        proposedResolution={review.proposedResolution}
        onApplyPatch={() => {
          alert("Applied BigInt units scaling patch to branch cosinput/381-verification-stake!");
        }}
        onDraftReply={() => setShowReplyBox(true)}
      />

      {/* Reply Drafting Box */}
      {showReplyBox && (
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-surface-container shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
              <span>Draft Maintainer Response</span>
            </h3>
            <span className="font-label-caps text-[10px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-bold">
              Requires User Approval
            </span>
          </div>

          <textarea
            rows={4}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write clear maintainer response explaining the unit conversion fix..."
            className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setReplyText(
                  `Thank you @charlie-maintainer for the review! We have updated the parseUnits scaling to 18 decimals and ensured raw float strings like "10.50" are converted gracefully before BigInt serialization. Also updated the wallet test fixtures.`
                );
              }}
              className="text-primary hover:underline font-code-sm text-code-sm font-medium"
            >
              Use Suggested Draft Response
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReplyBox(false)}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-secondary hover:text-on-surface font-label-md text-label-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert("Reply queued for transmission upon explicit GitHub token signoff.");
                  setShowReplyBox(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold shadow-sm"
              >
                Approve & Post to GitHub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
