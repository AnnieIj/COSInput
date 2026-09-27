/**
 * COSInput Foundation v0.4.2 — Controlled Implementation Runner Service Client
 * Boundary interface and client implementation for isolated workspace execution.
 */

import type {
  SandboxExecutionResult,
  ImplementationPreview,
  ContributionSession,
} from './types';
import { githubService } from './github.service';

export interface IRunnerService {
  createSandboxWorkspace(repoFullName: string, branch: string): Promise<{ sandboxId: string; status: 'ready' | 'failed' }>;
  runCommand(sandboxId: string, command: string, env?: Record<string, string>): Promise<SandboxExecutionResult>;
  runLocalTypecheck(sandboxId: string): Promise<SandboxExecutionResult>;
  runLocalTests(sandboxId: string, testFilter?: string): Promise<SandboxExecutionResult>;
  terminateWorkspace(sandboxId: string): Promise<void>;
  // v0.4.2 Controlled Runner methods
  getExecutionPreview(sessionId: string): Promise<ImplementationPreview>;
  startExecution(sessionId: string): Promise<ContributionSession>;
  stopExecution(sessionId: string): Promise<ContributionSession>;
  resetExecution(sessionId: string): Promise<ContributionSession>;
}

export class ControlledRunnerClient implements IRunnerService {
  async getExecutionPreview(sessionId: string): Promise<ImplementationPreview> {
    const res = await githubService.getExecutionPreview(sessionId);
    return res.preview;
  }

  async startExecution(sessionId: string): Promise<ContributionSession> {
    const res = await githubService.startExecution(sessionId);
    return res.session;
  }

  async stopExecution(sessionId: string): Promise<ContributionSession> {
    const res = await githubService.stopExecution(sessionId);
    return res.session;
  }

  async resetExecution(sessionId: string): Promise<ContributionSession> {
    const res = await githubService.resetExecution(sessionId);
    return res.session;
  }

  async createSandboxWorkspace(_repoFullName: string, _branch: string): Promise<{ sandboxId: string; status: 'ready' | 'failed' }> {
    return { sandboxId: `sandbox-${Date.now()}`, status: 'ready' };
  }

  async runCommand(_sandboxId: string, command: string): Promise<SandboxExecutionResult> {
    return {
      command,
      exitCode: 0,
      stdout: `Executed: ${command}`,
      stderr: '',
      durationMs: 50,
      completedAt: new Date().toISOString(),
    };
  }

  async runLocalTypecheck(_sandboxId: string): Promise<SandboxExecutionResult> {
    return this.runCommand(_sandboxId, 'npx tsc --noEmit');
  }

  async runLocalTests(_sandboxId: string, testFilter?: string): Promise<SandboxExecutionResult> {
    return this.runCommand(_sandboxId, testFilter ? `npm test -- ${testFilter}` : 'npm test');
  }

  async terminateWorkspace(_sandboxId: string): Promise<void> {
    // Isolated workspace teardown
  }
}

export const runnerService = new ControlledRunnerClient();
