/**
 * AI Agent Service Boundary (Interface & Stub)
 * Initial stub for COSInput Foundation v0.1. Real LLM planning and AST synthesis will be wired in Phase 2.
 */

import type { AgentPlanStep, StagedFileChange } from './types';

export interface IAIAgentService {
  analyzeIssueSpec(issueBody: string): Promise<{ summary: string; techStack: string[]; acceptanceCriteriaDraft: string[] }>;
  generateImplementationPlan(issueNumber: number, contextSummary: string): Promise<AgentPlanStep[]>;
  synthesizeCodeFix(filePath: string, errorDiagnosis: string): Promise<StagedFileChange | null>;
  generateMaintainerReply(maintainerComment: string, resolvedCodeSummary: string): Promise<string>;
  synthesizeConflictResolution(hunkId: string, ours: string, theirs: string): Promise<string>;
}

export class AIAgentServiceStub implements IAIAgentService {
  async analyzeIssueSpec(_issueBody: string): Promise<{ summary: string; techStack: string[]; acceptanceCriteriaDraft: string[] }> {
    throw new Error('AI Agent service not connected. Autonomous agent engine planned for Phase 2.');
  }

  async generateImplementationPlan(_issueNumber: number, _contextSummary: string): Promise<AgentPlanStep[]> {
    throw new Error('AI Agent service not connected. Autonomous agent engine planned for Phase 2.');
  }

  async synthesizeCodeFix(_filePath: string, _errorDiagnosis: string): Promise<StagedFileChange | null> {
    throw new Error('AI Agent service not connected. Autonomous agent engine planned for Phase 2.');
  }

  async generateMaintainerReply(_maintainerComment: string, _resolvedCodeSummary: string): Promise<string> {
    throw new Error('AI Agent service not connected. Autonomous agent engine planned for Phase 2.');
  }

  async synthesizeConflictResolution(_hunkId: string, _ours: string, _theirs: string): Promise<string> {
    throw new Error('AI Agent service not connected. Autonomous agent engine planned for Phase 2.');
  }
}

export const agentService = new AIAgentServiceStub();
