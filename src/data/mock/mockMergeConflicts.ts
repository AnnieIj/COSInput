/**
 * Demo Presentation Data for Merge Conflict Guardian
 * Matches the approved Google Stitch design for Merge Conflict Guardian.
 */

export const mockMergeConflictsData = {
  prNumber: 405,
  sourceBranch: 'cosinput/381-verification-stake',
  targetBranch: 'main',
  conflictFilesCount: 2,
  protocol: 'Zero-Loss Guaranteed',
  synthesisStatus: '100% Ready',
  invariantBadge: 'Never silently discards upstream commits or contributor AST payloads.',
  engineVersion: 'Tree-Sitter & SemDiff v4.9',

  files: [
    {
      id: 'stakeform',
      path: 'src/components/StakeForm.tsx',
      hunksCount: 1,
      linesFocus: 'Lines 42-58',
      contextWindow: '8 lines',
      ourContribution: {
        title: 'Gas Estimate & Verification Checks',
        badge: 'Head Branch',
        description: 'Added cryptographic verification signature status check and transaction gas estimation hook invocation prior to dispatching user collateral stakes.',
        branchRef: 'cosinput/381-verification-stake',
        tag: '+2 Hooks',
      },
      upstreamMaintainer: {
        title: 'Wallet Refactor & Chain Enforcer',
        badge: 'commit f829a1b',
        description: 'Renamed core useWalletAccount to useActiveAccount across ecosystem and injected strict Arbitrum One chain verification.',
        mergeBase: '@maintainer (merge base)',
        tag: 'Chain guard',
      },
      resolutionSynthesis: {
        title: 'Cohesive Non-Destructive Interleave',
        badge: 'Auto-Merged',
        description: "Retains upstream's useActiveAccount architecture and Arbitrum banner while preserving verification gas calculus. Neither change discarded.",
        verificationTag: 'Verified Non-Colliding',
        statusTag: 'Ready to apply',
      },
      pane1Ours: [
        { num: 41, text: 'export function StakeForm({ bountyId }: StakeProps) {', type: 'ctx' },
        { num: 42, text: 'const { account } = useWalletAccount();', type: 'removed' },
        { num: 43, text: 'const { signature, isVerified } = useVerificationSignature();', type: 'added' },
        { num: 44, text: 'const { estimatedGas } = useStakeGasEstimate(amount);', type: 'added' },
        { num: 45, text: 'const [isSubmitting, setIsSubmitting] = useState(false);', type: 'ctx' },
        { num: 46, text: 'const queryClient = useQueryClient();', type: 'ctx' },
      ],
      pane2Theirs: [
        { num: 41, text: 'export function StakeForm({ bountyId }: StakeProps) {', type: 'ctx' },
        { num: 42, text: 'const { account, chainId } = useActiveAccount();', type: 'changed' },
        { num: 43, text: 'if (chainId !== ARBITRUM_CHAIN_ID) {', type: 'changed' },
        { num: 44, text: '  return <NetworkSwitchBanner targetChain="Arbitrum One" />;', type: 'changed' },
        { num: 45, text: '}', type: 'changed' },
        { num: 46, text: 'const [isSubmitting, setIsSubmitting] = useState(false);', type: 'ctx' },
      ],
      pane3Synthesized: [
        { num: 41, text: 'export function StakeForm({ bountyId }: StakeProps) {', type: 'ctx' },
        { num: 42, text: 'const { account, chainId } = useActiveAccount();', type: 'synthesized' },
        { num: 43, text: 'const { signature, isVerified } = useVerificationSignature();', type: 'synthesized_feature' },
        { num: 44, text: 'const { estimatedGas } = useStakeGasEstimate(amount);', type: 'synthesized_feature' },
        { num: 45, text: 'if (chainId !== ARBITRUM_CHAIN_ID) {', type: 'synthesized' },
        { num: 46, text: '  return <NetworkSwitchBanner targetChain="Arbitrum One" />;', type: 'synthesized' },
        { num: 47, text: '}', type: 'synthesized' },
        { num: 48, text: 'const [isSubmitting, setIsSubmitting] = useState(false);', type: 'ctx' },
      ],
    },
    {
      id: 'transactions',
      path: 'src/lib/transactions.ts',
      hunksCount: 1,
      linesFocus: 'Lines 18-32',
      contextWindow: '6 lines',
      ourContribution: {
        title: 'Transaction Payload Sanitization',
        badge: 'Head Branch',
        description: 'Added BigInt unit coercion and fallback telemetry handlers.',
        branchRef: 'cosinput/381-verification-stake',
        tag: '+1 Validator',
      },
      upstreamMaintainer: {
        title: 'Arbitrum Provider Bridge',
        badge: 'commit f829a1b',
        description: 'Switched RPC provider to WebSocket fallback cluster.',
        mergeBase: '@maintainer (merge base)',
        tag: 'Infra update',
      },
      resolutionSynthesis: {
        title: 'Non-colliding RPC & BigInt Binding',
        badge: 'Auto-Merged',
        description: 'Combines resilient WebSocket RPC provider with strict BigInt parameter validation.',
        verificationTag: 'Verified Non-Colliding',
        statusTag: 'Ready to apply',
      },
      pane1Ours: [
        { num: 18, text: 'export async function submitStakeTx(payload: StakePayload) {', type: 'ctx' },
        { num: 19, text: '  const validated = validateBigIntWei(payload.amount);', type: 'added' },
        { num: 20, text: '  return executeContractCall(validated);', type: 'ctx' },
      ],
      pane2Theirs: [
        { num: 18, text: 'export async function submitStakeTx(payload: StakePayload) {', type: 'ctx' },
        { num: 19, text: '  const client = getArbitrumWsClient();', type: 'changed' },
        { num: 20, text: '  return executeContractCall(payload);', type: 'ctx' },
      ],
      pane3Synthesized: [
        { num: 18, text: 'export async function submitStakeTx(payload: StakePayload) {', type: 'ctx' },
        { num: 19, text: '  const client = getArbitrumWsClient();', type: 'synthesized' },
        { num: 20, text: '  const validated = validateBigIntWei(payload.amount);', type: 'synthesized_feature' },
        { num: 21, text: '  return executeContractCall(client, validated);', type: 'synthesized' },
      ],
    },
  ],

  safetyGates: [
    {
      id: 'ast-schema',
      title: 'AST Schema',
      status: 'Passed',
      description: 'Both interfaces satisfied; no orphaned symbols or missing imports.',
      icon: 'account_tree',
    },
    {
      id: 'ts-compile',
      title: 'TypeScript v5.4',
      status: 'Passed',
      description: '0 diagnostics errors emitted. Strict null-checks pass.',
      icon: 'terminal',
    },
    {
      id: 'test-matrix',
      title: 'Test Matrix',
      status: '24 / 24',
      description: 'Vitest unit & hook mocks execute with zero regression.',
      icon: 'rule',
    },
    {
      id: 'history-safety',
      title: 'History Safety',
      status: 'Verified',
      description: 'Linear rebase preserves GPG signatures & patch authorship.',
      icon: 'history_edu',
    },
  ],

  strictPrinciple: 'Strict Guardian Principle: COSInput will never unilaterally enforce an automated choice between "ours" or "theirs". Examine the interleaved code block above and confirm the resolution.',
};
