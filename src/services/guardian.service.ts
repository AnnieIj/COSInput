/**
 * Contribution Guardian Service Boundary (Interface & Stub)
 * Initial stub for COSInput Foundation v0.1. Real 24/7 post-PR polling and webhook surveillance will be wired in Phase 2.
 */

import type { GuardianAssessment } from './types';

export interface IContributionGuardianService {
  watchPullRequest(prNumber: number): Promise<{ watching: boolean; startedAt: string }>;
  pollGuardianRadar(prNumber: number): Promise<GuardianAssessment>;
  detectMergeConflicts(prNumber: number): Promise<{ hasConflicts: boolean; conflictingFiles: string[] }>;
  parseWorkflowLogs(runId: number): Promise<{ errorType: string; file: string; line: number; message: string }>;
  synthesizeNonDestructivePatch(prNumber: number, diagnosticCode: string): Promise<{ patchUnifiedDiff: string }>;
  requestHumanSignoff(prNumber: number, actionDescription: string): Promise<{ pending: boolean }>;
}

export class ContributionGuardianServiceStub implements IContributionGuardianService {
  async watchPullRequest(_prNumber: number): Promise<{ watching: boolean; startedAt: string }> {
    throw new Error('Guardian service not connected. Automated surveillance engine planned for Phase 2.');
  }

  async pollGuardianRadar(_prNumber: number): Promise<GuardianAssessment> {
    throw new Error('Guardian service not connected. Automated surveillance engine planned for Phase 2.');
  }

  async detectMergeConflicts(_prNumber: number): Promise<{ hasConflicts: boolean; conflictingFiles: string[] }> {
    throw new Error('Guardian service not connected. Automated surveillance engine planned for Phase 2.');
  }

  async parseWorkflowLogs(_runId: number): Promise<{ errorType: string; file: string; line: number; message: string }> {
    throw new Error('Guardian service not connected. Automated surveillance engine planned for Phase 2.');
  }

  async synthesizeNonDestructivePatch(_prNumber: number, _diagnosticCode: string): Promise<{ patchUnifiedDiff: string }> {
    throw new Error('Guardian service not connected. Automated surveillance engine planned for Phase 2.');
  }

  async requestHumanSignoff(_prNumber: number, _actionDescription: string): Promise<{ pending: boolean }> {
    throw new Error('Guardian service not connected. Automated surveillance engine planned for Phase 2.');
  }
}

export const guardianService = new ContributionGuardianServiceStub();
