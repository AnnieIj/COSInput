import React from 'react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="w-full px-4 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
          System Settings & Safety Invariants
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          COSInput Foundation v0.1 configuration, governance rules, and service boundaries.
        </p>
      </div>

      {/* Safety Invariants Status Card */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">policy</span>
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Core Safety Invariants (Strict Enforcement)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">verified_user</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Rule: No Mock Addresses
              </span>
              <span className="font-body-sm text-body-sm text-secondary mt-0.5">
                COSInput never outputs zero address, placeholder, or fake hex contract addresses. Halts and requires maintainer specification.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">verified_user</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Autonomous Merging Strictly Forbidden
              </span>
              <span className="font-body-sm text-body-sm text-secondary mt-0.5">
                Every code push, PR open, and patch application requires explicit human author sign-off. System never claims merge readiness autonomously.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">verified_user</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Zero Code Loss Rebase Guarantee
              </span>
              <span className="font-body-sm text-body-sm text-secondary mt-0.5">
                3-way atomic preservation ensures neither upstream maintainer refactors nor author verification calculus are silently discarded.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">verified_user</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Remote GitHub CI Authority
              </span>
              <span className="font-body-sm text-body-sm text-secondary mt-0.5">
                Local sandbox check passing does NOT mark remote CI green. Guardian status only resolves when GitHub Actions finishes cleanly.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Service Boundaries */}
      <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">hub</span>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Service Boundaries (Foundation v0.1 Interfaces)
            </h2>
          </div>
          <span className="font-code-sm text-code-sm bg-surface-container text-secondary px-2.5 py-1 rounded">
            Clean Separation: Stubs Ready for Phase 2
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-code-sm text-code-sm">
          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-on-surface block font-sans">GitHub Integration</span>
              <span className="text-secondary text-[11px]">IGitHubService (/src/services/github.service.ts)</span>
            </div>
            <span className="font-label-caps text-[9px] bg-surface-container-high text-secondary px-2 py-0.5 rounded font-bold w-fit">
              Interface Prepared
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-on-surface block font-sans">AI Agent Engine</span>
              <span className="text-secondary text-[11px]">IAIAgentService (/src/services/agent.service.ts)</span>
            </div>
            <span className="font-label-caps text-[9px] bg-surface-container-high text-secondary px-2 py-0.5 rounded font-bold w-fit">
              Interface Prepared
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-on-surface block font-sans">Runner Sandbox</span>
              <span className="text-secondary text-[11px]">IRunnerService (/src/services/runner.service.ts)</span>
            </div>
            <span className="font-label-caps text-[9px] bg-surface-container-high text-secondary px-2 py-0.5 rounded font-bold w-fit">
              Interface Prepared
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-on-surface block font-sans">Acceptance Verification</span>
              <span className="text-secondary text-[11px]">IAcceptanceVerificationService (/src/services/acceptance.service.ts)</span>
            </div>
            <span className="font-label-caps text-[9px] bg-surface-container-high text-secondary px-2 py-0.5 rounded font-bold w-fit">
              Interface Prepared
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-on-surface block font-sans">Contribution Guardian</span>
              <span className="text-secondary text-[11px]">IContributionGuardianService (/src/services/guardian.service.ts)</span>
            </div>
            <span className="font-label-caps text-[9px] bg-surface-container-high text-secondary px-2 py-0.5 rounded font-bold w-fit">
              Interface Prepared
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-col justify-between gap-2">
            <div>
              <span className="font-semibold text-on-surface block font-sans">Demo Data Layer</span>
              <span className="text-secondary text-[11px]">Isolated mock data (/src/data/mock/)</span>
            </div>
            <span className="font-label-caps text-[9px] bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded font-bold w-fit">
              Isolated & Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
