/**
 * Demo Presentation Data for Contribution Workspace
 * Matches the Google Stitch approved design for Issue #381 Build Verification and Stake Flow.
 */

import type { PipelineStep, ExecutionPlanItem, StagedFileItem, AcceptanceCriterionItem, SessionActivityItem } from './types';

export const mockContribution381 = {
  id: '381',
  issueNumber: 381,
  repository: 'DigiNodes / truthbounty-frontend',
  title: 'Build the Verification and Stake Flow',
  stageTag: 'Implementation',
  branch: 'cosinput/381-verification-stake',
  commitSha: 'c8f49a2',
  updatedAgo: '3m ago',
  currentStep: 4,
  totalSteps: 9,
  steps: [
    { number: 1, name: 'Issue', status: 'completed' },
    { number: 2, name: 'Analysis', status: 'completed' },
    { number: 3, name: 'Plan', status: 'completed' },
    { number: 4, name: 'Implementation', status: 'active', subtext: 'Step 4 of 9' },
    { number: 5, name: 'Tests', status: 'pending' },
    { number: 6, name: 'Acceptance', status: 'pending' },
    { number: 7, name: 'Pull Request', status: 'pending' },
    { number: 8, name: 'Guardian', status: 'pending' },
    { number: 9, name: 'Merge Ready', status: 'pending' },
  ] as PipelineStep[],

  safetyBlocker: {
    title: 'Maintainer Input Required — Canonical Contract Configuration',
    status: 'BLOCKED',
    affectedFile: 'contracts/bindings.ts',
    ruleText: 'Rule: No Mock Addresses',
    invariantMessage: 'COSInput cannot verify the canonical staking contract address from the repository AST or environment specs. In adherence to core safety principles, NO placeholder, zero address, or fake hex contract will ever be generated or dispatched.',
  },

  specContext: {
    description: 'Users need to submit staking transactions and verify cryptographic bounty proofs before token disbursement. Requires form validation, Web3 wallet signature triggers, and fallback state.',
    techStack: [
      { name: 'Next.js 14 App Router', color: 'bg-primary' },
      { name: 'TypeScript 5.4', color: 'bg-primary' },
      { name: 'Wagmi / Viem', color: 'bg-tertiary' },
      { name: 'TailwindCSS', color: 'bg-secondary' },
      { name: 'Vitest', color: 'bg-outline' },
    ],
    stats: '42 files indexed • 3 actively staged',
  },

  executionPlan: {
    progressLabel: '3 of 6 Completed',
    isApproved: true,
    steps: [
      {
        id: 'plan-1',
        order: 1,
        title: 'Inspect existing verification architecture',
        status: 'completed',
        statusLabel: 'COMPLETED',
        governanceTag: 'User Approved',
      },
      {
        id: 'plan-2',
        order: 2,
        title: 'Identify transaction-state patterns',
        status: 'completed',
        statusLabel: 'COMPLETED',
        governanceTag: 'User Approved',
      },
      {
        id: 'plan-3',
        order: 3,
        title: 'Implement verification form & UI state',
        status: 'in_progress',
        statusLabel: 'IN PROGRESS',
        governanceTag: 'AI Prepared',
      },
      {
        id: 'plan-4',
        order: 4,
        title: 'Add staking flow handler & transaction hooks',
        status: 'blocked',
        statusLabel: 'BLOCKED',
        governanceTag: 'by contract address',
        blockedReason: 'by contract address',
      },
      {
        id: 'plan-5',
        order: 5,
        title: 'Add unit and integration tests',
        status: 'pending',
        statusLabel: 'PENDING',
        governanceTag: '',
      },
      {
        id: 'plan-6',
        order: 6,
        title: 'Verify acceptance criteria with synthetic wallet fixtures',
        status: 'pending',
        statusLabel: 'PENDING',
        governanceTag: '',
      },
    ] as ExecutionPlanItem[],
  },

  stagedFiles: [
    {
      path: 'src/components/VerificationForm.tsx',
      additions: 84,
      deletions: 6,
      status: 'Modified',
    },
    {
      path: 'src/lib/staking.ts',
      additions: 40,
      deletions: 12,
      status: 'Modified',
    },
    {
      path: 'src/types/verification.ts',
      additions: 18,
      deletions: 0,
      status: 'New File',
    },
  ] as StagedFileItem[],

  governanceLedger: {
    aiSuggested: { count: 2, note: 'Non-binding' },
    aiPrepared: { count: 3, note: 'Awaiting review' },
    userApproved: { count: 1, note: 'Signed by Alex' },
    githubVerified: { count: 0, note: 'Pending check' },
    strictRule: 'COSInput requires explicit human approval before pushing code or opening PRs. Autonomous merging is strictly forbidden.',
  },

  acceptanceSummary: {
    status: 'NOT READY',
    passedCount: 4,
    blockedCount: 1,
    items: [
      {
        id: 'acc-1',
        title: 'Verification form implemented',
        status: 'Passed',
        evidencePath: 'src/components/VerificationForm.tsx',
      },
      {
        id: 'acc-2',
        title: 'Stake validation implemented',
        status: 'Passed',
        evidencePath: 'src/lib/staking.ts',
      },
      {
        id: 'acc-3',
        title: 'Client-side input sanitization',
        status: 'Passed',
        evidencePath: 'src/lib/validators.ts',
      },
      {
        id: 'acc-4',
        title: 'Error boundary state handling',
        status: 'Passed',
        evidencePath: 'src/components/ErrorBoundary.tsx',
      },
      {
        id: 'acc-5',
        title: 'Canonical contract configuration',
        status: 'Blocked',
        statusNote: 'Required deployment info unavailable',
      },
    ] as AcceptanceCriterionItem[],
  },

  sessionActivity: [
    { time: '10:21', text: 'Repository cloned & branch checked out', type: 'neutral' },
    { time: '10:22', text: 'Issue spec analyzed via AST', type: 'neutral' },
    { time: '10:23', text: '42 relevant files indexed', type: 'neutral' },
    { time: '10:25', text: 'Implementation plan generated', type: 'agent' },
    { time: '10:27', text: 'Plan approved by @alex-chen-dev', type: 'user' },
    { time: '10:30', text: 'StakeForm.tsx modified (+124 lines)', type: 'success' },
  ] as SessionActivityItem[],
};
