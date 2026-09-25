/**
 * Runner Service Boundary (Interface & Stub)
 * Initial stub for COSInput Foundation v0.1. Real Firecracker / Container sandbox runners will be wired in Phase 2.
 */

import type { SandboxExecutionResult } from './types';

export interface IRunnerService {
  createSandboxWorkspace(repoFullName: string, branch: string): Promise<{ sandboxId: string; status: 'ready' | 'failed' }>;
  runCommand(sandboxId: string, command: string, env?: Record<string, string>): Promise<SandboxExecutionResult>;
  runLocalTypecheck(sandboxId: string): Promise<SandboxExecutionResult>;
  runLocalTests(sandboxId: string, testFilter?: string): Promise<SandboxExecutionResult>;
  terminateWorkspace(sandboxId: string): Promise<void>;
}

export class RunnerServiceStub implements IRunnerService {
  async createSandboxWorkspace(_repoFullName: string, _branch: string): Promise<{ sandboxId: string; status: 'ready' | 'failed' }> {
    throw new Error('Runner service not connected. Sandbox execution worker planned for Phase 2.');
  }

  async runCommand(_sandboxId: string, _command: string): Promise<SandboxExecutionResult> {
    throw new Error('Runner service not connected. Sandbox execution worker planned for Phase 2.');
  }

  async runLocalTypecheck(_sandboxId: string): Promise<SandboxExecutionResult> {
    throw new Error('Runner service not connected. Sandbox execution worker planned for Phase 2.');
  }

  async runLocalTests(_sandboxId: string, _testFilter?: string): Promise<SandboxExecutionResult> {
    throw new Error('Runner service not connected. Sandbox execution worker planned for Phase 2.');
  }

  async terminateWorkspace(_sandboxId: string): Promise<void> {
    // no-op stub
  }
}

export const runnerService = new RunnerServiceStub();
