/**
 * GitHub Integration Service Boundary (Interface & Stub)
 * Initial stub for COSInput Foundation v0.1. Real OAuth and Octokit calls will be wired in Phase 2.
 */

import type { GitHubUser, GitHubRepoSummary, GitHubIssueRef, GitHubPRRef } from './types';

export interface IGitHubService {
  getAuthenticatedUser(): Promise<GitHubUser | null>;
  getRepository(owner: string, repo: string): Promise<GitHubRepoSummary | null>;
  listIssues(owner: string, repo: string): Promise<GitHubIssueRef[]>;
  getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueRef | null>;
  getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPRRef | null>;
  listPullRequests(owner: string, repo: string): Promise<GitHubPRRef[]>;
  createBranch(owner: string, repo: string, branchName: string, baseSha: string): Promise<{ ref: string; sha: string }>;
  pushCommit(owner: string, repo: string, branch: string, message: string, changes: unknown[]): Promise<{ sha: string }>;
  retriggerWorkflowRun(owner: string, repo: string, runId: number): Promise<{ success: boolean; message: string }>;
}

export class GitHubServiceStub implements IGitHubService {
  private readonly isConfigured = false;

  async getAuthenticatedUser(): Promise<GitHubUser | null> {
    // Stub: returns null or unconfigured indicator when not authenticated
    return null;
  }

  async getRepository(_owner: string, _repo: string): Promise<GitHubRepoSummary | null> {
    return null;
  }

  async listIssues(_owner: string, _repo: string): Promise<GitHubIssueRef[]> {
    return [];
  }

  async getIssue(_owner: string, _repo: string, _issueNumber: number): Promise<GitHubIssueRef | null> {
    return null;
  }

  async getPullRequest(_owner: string, _repo: string, _prNumber: number): Promise<GitHubPRRef | null> {
    return null;
  }

  async listPullRequests(_owner: string, _repo: string): Promise<GitHubPRRef[]> {
    return [];
  }

  async createBranch(_owner: string, _repo: string, _branchName: string, _baseSha: string): Promise<{ ref: string; sha: string }> {
    throw new Error('GitHub service not connected. Integration planned for Phase 2.');
  }

  async pushCommit(_owner: string, _repo: string, _branch: string, _message: string, _changes: unknown[]): Promise<{ sha: string }> {
    throw new Error('GitHub service not connected. Integration planned for Phase 2.');
  }

  async retriggerWorkflowRun(_owner: string, _repo: string, _runId: number): Promise<{ success: boolean; message: string }> {
    throw new Error('GitHub service not connected. Integration planned for Phase 2.');
  }
}

export const githubService = new GitHubServiceStub();
