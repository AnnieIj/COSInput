/**
 * Acceptance Verification Service Boundary (Interface & Stub)
 * Initial stub for COSInput Foundation v0.1. Real AST fixture & test harness verification will be wired in Phase 2.
 */

import type { AcceptanceCriterionResult } from './types';

export interface IAcceptanceVerificationService {
  extractAcceptanceCriteria(issueNumber: number): Promise<string[]>;
  verifyCriterion(sandboxId: string, criterionId: string): Promise<AcceptanceCriterionResult>;
  runVerificationSuite(sandboxId: string, issueNumber: number): Promise<{
    passedCount: number;
    blockedCount: number;
    results: AcceptanceCriterionResult[];
  }>;
}

export class AcceptanceVerificationServiceStub implements IAcceptanceVerificationService {
  async extractAcceptanceCriteria(_issueNumber: number): Promise<string[]> {
    return [];
  }

  async verifyCriterion(_sandboxId: string, _criterionId: string): Promise<AcceptanceCriterionResult> {
    throw new Error('Acceptance verification service not connected. Harness planned for Phase 2.');
  }

  async runVerificationSuite(_sandboxId: string, _issueNumber: number): Promise<{
    passedCount: number;
    blockedCount: number;
    results: AcceptanceCriterionResult[];
  }> {
    throw new Error('Acceptance verification service not connected. Harness planned for Phase 2.');
  }
}

export const acceptanceService = new AcceptanceVerificationServiceStub();
