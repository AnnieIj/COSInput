/**
 * Demo Presentation Data for CI Guardian Screen
 * Matches the approved Google Stitch design for CI Guardian — GitHub Actions Workflow #91024.
 */

export const mockCIGuardianWorkflow = {
  workflowNumber: 91024,
  repository: 'DigiNodes / truthbounty-frontend',
  prNumber: 405,
  overallStatus: 'CI Failed (1 of 4 Checks)',
  strictPolicyNote: 'Strict policy active: Guardian status never turns green until GitHub upstream re-verifies workflow runs.',

  checks: [
    {
      id: 'unit-tests',
      name: 'Unit Tests',
      tool: 'Vitest',
      status: 'passed',
      passedSummary: '24/24 Passed',
      duration: '4.2s',
      verifiedTag: 'GitHub Verified',
      runTag: '#run-771',
    },
    {
      id: 'lint',
      name: 'Lint Inspection',
      tool: 'ESLint',
      status: 'passed',
      passedSummary: '0 errors',
      secondarySummary: '2 warnings',
      duration: '',
      verifiedTag: 'GitHub Verified',
      runTag: '#run-772',
    },
    {
      id: 'typecheck',
      name: 'Typecheck',
      tool: 'tsc --noEmit',
      status: 'failed',
      passedSummary: 'TS2322 (1 error)',
      exitCode: 'Exit Code 2',
      duration: '8.9s',
      verifiedTag: 'Active Failure Focus',
      runTag: 'tsc --noEmit',
      isActiveFocus: true,
    },
    {
      id: 'build',
      name: 'Build Step',
      tool: 'Next.js',
      status: 'blocked',
      passedSummary: 'Waiting...',
      duration: '--',
      verifiedTag: 'Blocked by Typecheck',
      runTag: 'Queued',
    },
  ],

  stepperStages: [
    { number: 1, label: 'Step 01', title: 'Analyze CI Logs', completed: true },
    { number: 2, label: 'Step 02', title: 'Locate Fault Node', completed: true },
    { number: 3, label: 'Step 03', title: 'Draft Patch AST', completed: true },
    { number: 4, label: 'Step 04', title: 'Local Verification', completed: true },
    { number: 5, label: 'Step 05', title: 'Human Approval', active: true },
  ],

  terminalLog: {
    logPath: 'stdout / github-actions-runner-typecheck.log',
    lines: [
      { text: '$ npm run typecheck', color: 'text-surface-container-lowest opacity-70' },
      { text: '> truthbounty-frontend@0.1.0 typecheck', color: 'text-surface-variant opacity-60' },
      { text: '> tsc --noEmit', color: 'text-surface-variant opacity-60' },
      {
        highlight: true,
        header: 'src/components/StakeForm.tsx:87:11 - error TS2322: ',
        body: "Type 'string' is not assignable to type 'bigint'.",
      },
      {
        codeSnippet: [
          '85 |     try {',
          '86 |       await executeStakeTransaction({',
          '87 |         amount: stakeInputAmount,',
          '   |                 ~~~~~~~~~~~~~~~~',
          '88 |         validatorAddress: userAddress,',
          '89 |       });',
        ],
      },
      {
        origin: 'src/lib/staking.ts:14:3',
        prop: '14 |    amount: bigint;',
        note: "The expected type comes from property 'amount' which is declared here on type 'StakeTransactionPayload'",
      },
      { footer: 'Found 1 error in src/components/StakeForm.tsx at line 87.', color: 'text-error-container font-semibold mt-4' },
      { exit: 'Process exited with code 2. (Elapsed: 8.91s)', color: 'text-secondary' },
    ],
    workerInfo: 'Worker: runner-prod-eu-west-4c • RAM: 412MB / 7GB',
  },

  diagnosis: {
    confidence: '98% Confidence',
    anomalyType: 'TS2322: Type Incompatibility',
    fileLocation: 'src/components/StakeForm.tsx:87',
    explanation: "The transaction builder contract binding expects amount: bigint (in wei equivalent), but the form input state currently passes raw string from stakeInputAmount without calling BigInt() conversion or unit scaling.",
    safeInvariantNote: 'Code fix is completely isolated to input serialization. No public ABI interface or architectural hooks are affected. Zero state leak hazard.',
    diffEstimate: '+1 / -1 Line',
    riskVector: 'Lowest (Tier 0)',
    branchBuildHealth: '3 of 4 Passes (75%)',
  },

  unifiedDiff: {
    file: 'src/components/StakeForm.tsx',
    linesRange: 'Lines 84-91',
    patchTag: 'Proposed Autonomous Patch #AP-405-1',
    header: '@@ -84,7 +84,7 @@ export function StakeForm({ bountyId, requiredStake }: Props) {',
    hunks: [
      { oldLine: 84, newLine: 84, sign: ' ', text: '    setIsSubmitting(true);', type: 'ctx' },
      { oldLine: 85, newLine: 85, sign: ' ', text: '    try {', type: 'ctx' },
      { oldLine: 86, newLine: 86, sign: ' ', text: '      await executeStakeTransaction({', type: 'ctx' },
      { oldLine: 87, newLine: '--', sign: '-', text: '        amount: stakeInputAmount,', type: 'removed' },
      { oldLine: '--', newLine: 87, sign: '+', text: '        amount: BigInt(stakeInputAmount),', type: 'added' },
      { oldLine: 88, newLine: 88, sign: ' ', text: '        validatorAddress: userAddress,', type: 'ctx' },
      { oldLine: 89, newLine: 89, sign: ' ', text: '      });', type: 'ctx' },
    ],
    commitMessage: 'fix(staking): cast stakeInputAmount to bigint for contract payload',
    targetBranch: 'cosinput/381-verification-stake',
  },
};
