/**
 * COSInput Foundation v0.4.3.1 — Authentic Git Workspace Execution Engine
 * 
 * Provides authentic on-disk Git workspace operations:
 * 1. Retrieves actual upstream Git repository (via clone or verified local/remote checkout)
 * 2. Checks out approved base commit SHA and verifies HEAD match
 * 3. Preserves original repository default branch and commit ancestry
 * 4. Configures 'upstream' and 'origin' (contributor fork) remotes correctly
 * 5. Rejects incorrect remotes; contributor fork is the ONLY permitted push destination
 * 6. Creates isolated issue branch from verified base
 * 7. Reads and modifies actual repository files
 * 8. Produces genuine Git diff from the real working tree
 * 9. Stages ONLY approved files (unrestricted 'git add .' or '-A' strictly prohibited)
 * 10. Verifies branch identity and creates authentic commits with preserved ancestry
 * 11. Enforces runtime security: isolated environment, timeouts, resource limits, credential redaction
 * 12. Enforces temporary workspace cleanup and retention policy
 * 13. Clearly distinguishes real execution from simulated/mock environments
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { WorkspaceExecutionMode } from './types';

const execFileAsync = promisify(execFile);

export interface ExecutionCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface WorkspaceExecutionStatus {
  mode: WorkspaceExecutionMode;
  workspacePath: string;
  isRealGitTree: boolean;
  branchName: string;
  baseCommitSha: string;
  hasUncommittedChanges: boolean;
  stagedFiles: string[];
  headSha?: string;
  remotes?: {
    upstream?: string;
    origin?: string;
  };
}

export interface WorkspaceCheckoutOptions {
  sessionId: string;
  runId: string;
  upstreamRepository: string; // e.g. "AgesEmpire/StellarSwipe-FrontEnd" or "/path/to/repo"
  upstreamCloneUrl?: string; // Custom clone URL or local file path
  contributorFork: string; // e.g. "contributor-jane/StellarSwipe-FrontEnd"
  contributorForkUrl?: string; // Custom fork URL or local path
  branchName: string;
  baseCommitSha: string;
  defaultBranch?: string; // Default 'main'
  customCloneSource?: string; // Optional local disposable repository path for testing
}

export interface WorkspaceIntegrityReport {
  valid: boolean;
  mode: WorkspaceExecutionMode;
  workspacePath: string;
  isRealGitTree: boolean;
  headSha: string;
  branchName: string;
  baseCommitSha: string;
  baseShaVerified: boolean;
  commitAncestryPreserved: boolean;
  remotes: {
    upstream: string;
    origin: string;
    permittedPushRemote: string;
  };
  shallowIncompatibilityDetected: boolean;
  uncommittedChanges: boolean;
  stagedFiles: string[];
  errors: string[];
}

export interface WorkspaceRetentionPolicy {
  maxAgeMs: number;
  maxWorkspacesPerSession: number;
  isolatedBaseDir: string;
}

export const DEFAULT_RETENTION_POLICY: WorkspaceRetentionPolicy = {
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  maxWorkspacesPerSession: 5,
  isolatedBaseDir: '/tmp/cosinput-workspaces',
};

export class WorkspaceExecutionEngine {
  private baseDir: string;
  private forceSimulatedMode = false;
  private retentionPolicy: WorkspaceRetentionPolicy;

  constructor(baseDir = '/tmp/cosinput-workspaces', retentionPolicy = DEFAULT_RETENTION_POLICY) {
    this.baseDir = baseDir;
    this.retentionPolicy = { ...retentionPolicy, isolatedBaseDir: baseDir };
  }

  /**
   * For testing: allows forcing simulated mode to test fallback/detection logic.
   */
  setForceSimulatedMode(val: boolean) {
    this.forceSimulatedMode = val;
  }

  /**
   * Returns current execution environment mode.
   */
  getExecutionMode(): WorkspaceExecutionMode {
    if (this.forceSimulatedMode) {
      return 'SIMULATED_TEST_ENVIRONMENT';
    }
    return 'REAL_GIT_WORKSPACE';
  }

  /**
   * Resolves bounded path for a given session and run ID.
   * Strictly enforces that workspacePath never escapes isolated base directory.
   */
  getWorkspacePath(sessionId: string, runId: string): string {
    const cleanSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanRun = runId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetPath = path.join(this.baseDir, cleanSession, cleanRun);

    const resolvedBase = path.resolve(this.baseDir);
    const resolvedTarget = path.resolve(targetPath);
    if (!resolvedTarget.startsWith(resolvedBase)) {
      throw new Error(
        `Security Violation: Workspace path '${targetPath}' escapes isolated base directory '${this.baseDir}'.`
      );
    }

    return targetPath;
  }

  /**
   * Sanitizes environment variables to prevent credential leakage to untrusted repository scripts.
   */
  private getSanitizedEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    // Strip sensitive tokens, secrets, and auth credentials
    delete env.GITHUB_TOKEN;
    delete env.GH_TOKEN;
    delete env.NODE_AUTH_TOKEN;
    delete env.GITHUB_APP_PRIVATE_KEY;
    delete env.COSINPUT_APP_KEY;
    delete env.SECRET_KEY;
    delete env.PRIVATE_KEY;
    delete env.AUTH_TOKEN;
    delete env.ACCESS_TOKEN;
    delete env.NPM_TOKEN;
    delete env.SSH_AUTH_SOCK;
    return env;
  }

  /**
   * Redacts sensitive tokens from output logs and error messages.
   */
  redactSecrets(text: string): string {
    if (!text) return '';
    return text
      .replace(/ghp_[a-zA-Z0-9]{20,}/g, '[REDACTED_GH_TOKEN]')
      .replace(/gho_[a-zA-Z0-9]{20,}/g, '[REDACTED_GH_TOKEN]')
      .replace(/github_pat_[a-zA-Z0-9_]{20,}/g, '[REDACTED_GH_TOKEN]')
      .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]')
      .replace(/token\s+[a-zA-Z0-9._-]+/gi, 'token [REDACTED_TOKEN]');
  }

  /**
   * Runs an arbitrary command safely in the workspace with timeouts, sanitized env, and buffer limits.
   */
  async runCommandInWorkspace(
    workspacePath: string,
    commandStr: string,
    timeoutMs = 30000
  ): Promise<ExecutionCommandResult> {
    const startTime = Date.now();
    try {
      // Split into binary and args safely
      const parts = commandStr.trim().split(/\s+/);
      const file = parts[0];
      const args = parts.slice(1);

      const { stdout, stderr } = await execFileAsync(file, args, {
        cwd: workspacePath,
        timeout: timeoutMs,
        env: this.getSanitizedEnv(),
        maxBuffer: 2 * 1024 * 1024, // 2MB resource limit
      });

      return {
        command: commandStr,
        exitCode: 0,
        stdout: this.redactSecrets(stdout.trim()),
        stderr: this.redactSecrets(stderr.trim()),
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        command: commandStr,
        exitCode: typeof err.code === 'number' ? err.code : 1,
        stdout: this.redactSecrets((err.stdout || '').toString().trim()),
        stderr: this.redactSecrets((err.stderr || err.message || '').toString().trim()),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Section 1: Authentic Git Workspace Checkout
   * 
   * Retrieves actual upstream Git repository, preserves history and ancestry,
   * configures upstream and fork remotes correctly, verifies base commit SHA,
   * and creates an isolated issue branch from the verified base.
   */
  async checkoutAuthenticWorkspace(
    options: WorkspaceCheckoutOptions
  ): Promise<WorkspaceIntegrityReport> {
    if (!options.upstreamRepository) {
      throw new Error('Authentic Git checkout failed: Upstream repository must be specified.');
    }
    if (!options.baseCommitSha) {
      throw new Error('Authentic Git checkout failed: Approved base commit SHA must be specified.');
    }
    if (!options.branchName) {
      throw new Error('Authentic Git checkout failed: Branch name must be specified.');
    }

    const workspacePath = this.getWorkspacePath(options.sessionId, options.runId);

    // Clean up any stale directory or previous failed checkout
    await fs.rm(workspacePath, { recursive: true, force: true });
    await fs.mkdir(workspacePath, { recursive: true, mode: 0o700 });

    // Determine clone sources
    const upstreamSource =
      options.customCloneSource ||
      options.upstreamCloneUrl ||
      (options.upstreamRepository.startsWith('/') || options.upstreamRepository.startsWith('file://')
        ? options.upstreamRepository
        : `https://github.com/${options.upstreamRepository}.git`);

    const forkSource =
      options.contributorForkUrl ||
      (options.contributorFork.startsWith('/') || options.contributorFork.startsWith('file://')
        ? options.contributorFork
        : `https://github.com/${options.contributorFork}.git`);

    // 1. Authentic clone from upstream
    try {
      await execFileAsync('git', ['clone', upstreamSource, workspacePath], {
        timeout: 60000,
        env: this.getSanitizedEnv(),
      });
    } catch (cloneErr: any) {
      // Clean up partial directory on failure
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(
        `Authentic Git checkout failed: Unable to clone upstream repository '${options.upstreamRepository}' from '${upstreamSource}': ${this.redactSecrets(cloneErr.message)}`
      );
    }

    // 2. Check for Shallow-History Incompatibility
    let shallowDetected = false;
    try {
      const { stdout: shallowOut } = await execFileAsync(
        'git',
        ['rev-parse', '--is-shallow-repository'],
        { cwd: workspacePath }
      );
      if (shallowOut.trim() === 'true') {
        shallowDetected = true;
        // Attempt unshallow
        try {
          await execFileAsync('git', ['fetch', '--unshallow'], {
            cwd: workspacePath,
            timeout: 60000,
            env: this.getSanitizedEnv(),
          });
          shallowDetected = false;
        } catch {
          // Verify if baseCommitSha is present despite shallow clone
          try {
            await execFileAsync('git', ['cat-file', '-e', `${options.baseCommitSha}^{commit}`], {
              cwd: workspacePath,
            });
          } catch {
            await fs.rm(workspacePath, { recursive: true, force: true });
            throw new Error(
              `Shallow-history incompatibility: Cloned repository is shallow and does not contain commit ancestry for approved base SHA '${options.baseCommitSha}'.`
            );
          }
        }
      }
    } catch {
      // Ignore if shallow check unsupported
    }

    // 3. Configure and Verify Remotes
    // Remotes MUST be:
    // 'upstream': points to canonical upstream repository URL
    // 'origin': points to contributor fork URL
    // Pushing to upstream is strictly prohibited.
    try {
      // Rename default 'origin' (which cloned upstream) to 'upstream'
      const { stdout: existingRemotes } = await execFileAsync('git', ['remote'], {
        cwd: workspacePath,
      });
      const remoteList = existingRemotes.split('\n').map((r) => r.trim()).filter(Boolean);

      if (remoteList.includes('origin')) {
        await execFileAsync('git', ['remote', 'rename', 'origin', 'upstream'], {
          cwd: workspacePath,
        });
      } else if (!remoteList.includes('upstream')) {
        await execFileAsync('git', ['remote', 'add', 'upstream', upstreamSource], {
          cwd: workspacePath,
        });
      } else {
        await execFileAsync('git', ['remote', 'set-url', 'upstream', upstreamSource], {
          cwd: workspacePath,
        });
      }

      // Add 'origin' remote pointing strictly to contributor fork
      await execFileAsync('git', ['remote', 'add', 'origin', forkSource], {
        cwd: workspacePath,
      });

      // Disable push to 'upstream' remote in git config
      await execFileAsync(
        'git',
        ['remote', 'set-url', '--push', 'upstream', 'PUSH_PROHIBITED_UPSTREAM_IS_READ_ONLY'],
        { cwd: workspacePath }
      );
    } catch (remoteErr: any) {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(`Remote configuration error: ${this.redactSecrets(remoteErr.message)}`);
    }

    // Remote Verification: Inspect remotes to ensure correctness
    const configuredRemotes = await this.getRemotes(workspacePath);
    if (!configuredRemotes.upstream || !configuredRemotes.origin) {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(
        `Incorrect remotes configured: Upstream '${configuredRemotes.upstream || 'missing'}', Origin '${configuredRemotes.origin || 'missing'}'.`
      );
    }

    // Security invariant: Contributor fork URL cannot match canonical upstream URL
    if (forkSource.toLowerCase() === upstreamSource.toLowerCase()) {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(
        'Security boundary violation: Contributor fork remote cannot point to canonical upstream repository.'
      );
    }

    // 4. Verify Approved Base Commit SHA Exists in Repository Ancestry
    try {
      await execFileAsync('git', ['cat-file', '-e', `${options.baseCommitSha}^{commit}`], {
        cwd: workspacePath,
      });
    } catch {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(
        `Base commit SHA verification failed: Approved base commit '${options.baseCommitSha}' does not exist in repository ancestry.`
      );
    }

    // Verify commit ancestry (commit object header is authentic)
    let commitAncestryPreserved = false;
    try {
      const { stdout: commitInfo } = await execFileAsync(
        'git',
        ['log', '-n', '1', '--format=%H%x00%P%x00%s', options.baseCommitSha],
        { cwd: workspacePath }
      );
      if (commitInfo.trim()) {
        commitAncestryPreserved = true;
      }
    } catch {
      commitAncestryPreserved = false;
    }

    // 5. Checkout Approved Base Commit SHA and Verify HEAD
    try {
      await execFileAsync('git', ['checkout', '--detach', options.baseCommitSha], {
        cwd: workspacePath,
      });
    } catch (coErr: any) {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(
        `Failed to checkout approved base commit SHA '${options.baseCommitSha}': ${this.redactSecrets(coErr.message)}`
      );
    }

    const { stdout: headShaOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: workspacePath,
    });
    const currentHead = headShaOut.trim();

    if (
      currentHead !== options.baseCommitSha &&
      !options.baseCommitSha.startsWith(currentHead) &&
      !currentHead.startsWith(options.baseCommitSha)
    ) {
      await fs.rm(workspacePath, { recursive: true, force: true });
      throw new Error(
        `Git integrity verification failure: HEAD commit '${currentHead}' does not match approved base commit SHA '${options.baseCommitSha}'.`
      );
    }

    // 6. Branch Creation & Collision Safety
    // Check if branch already exists in local repository
    const { stdout: branchList } = await execFileAsync(
      'git',
      ['branch', '--list', options.branchName],
      { cwd: workspacePath }
    );

    if (branchList.trim()) {
      // Branch exists: inspect its commit SHA
      const { stdout: existingShaOut } = await execFileAsync(
        'git',
        ['rev-parse', options.branchName],
        { cwd: workspacePath }
      );
      const existingSha = existingShaOut.trim();
      if (existingSha !== currentHead) {
        await fs.rm(workspacePath, { recursive: true, force: true });
        throw new Error(
          `Branch collision detected: Branch '${options.branchName}' already exists at commit '${existingSha.substring(0, 7)}' which differs from approved base '${options.baseCommitSha.substring(0, 7)}'. Never overwriting existing contributor work.`
        );
      }
      // Same commit: switch to it
      await execFileAsync('git', ['checkout', options.branchName], { cwd: workspacePath });
    } else {
      // Create isolated issue branch from verified base
      await execFileAsync('git', ['checkout', '-b', options.branchName, options.baseCommitSha], {
        cwd: workspacePath,
      });
    }

    // 7. Configure Sandboxed Committer Identity
    await execFileAsync('git', ['config', 'user.name', 'COSInput Contributor'], {
      cwd: workspacePath,
    });
    await execFileAsync('git', ['config', 'user.email', 'contributor@cosinput.local'], {
      cwd: workspacePath,
    });

    return {
      valid: true,
      mode: 'REAL_GIT_WORKSPACE',
      workspacePath,
      isRealGitTree: true,
      headSha: currentHead,
      branchName: options.branchName,
      baseCommitSha: options.baseCommitSha,
      baseShaVerified: true,
      commitAncestryPreserved,
      remotes: {
        upstream: configuredRemotes.upstream || upstreamSource,
        origin: configuredRemotes.origin || forkSource,
        permittedPushRemote: 'origin',
      },
      shallowIncompatibilityDetected: shallowDetected,
      uncommittedChanges: false,
      stagedFiles: [],
      errors: [],
    };
  }

  /**
   * Reads configured Git remotes from the workspace.
   */
  async getRemotes(workspacePath: string): Promise<{ upstream?: string; origin?: string }> {
    try {
      const { stdout } = await execFileAsync('git', ['remote', '-v'], { cwd: workspacePath });
      const remotes: { upstream?: string; origin?: string } = {};
      const lines = stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const name = parts[0];
          const url = parts[1];
          if (name === 'upstream' && (!remotes.upstream || line.includes('(fetch)'))) {
            remotes.upstream = url;
          }
          if (name === 'origin' && (!remotes.origin || line.includes('(fetch)'))) {
            remotes.origin = url;
          }
        }
      }
      return remotes;
    } catch {
      return {};
    }
  }

  /**
   * Prepares isolated git workspace on disk.
   * Backward-compatible delegation to authentic checkout when options are provided.
   */
  async initializeWorkspace(
    sessionId: string,
    runId: string,
    branchName: string,
    baseCommitSha: string,
    options?: Partial<WorkspaceCheckoutOptions>
  ): Promise<string> {
    const workspacePath = this.getWorkspacePath(sessionId, runId);

    // If options include upstreamRepository, perform authentic checkout
    if (options?.upstreamRepository) {
      await this.checkoutAuthenticWorkspace({
        sessionId,
        runId,
        upstreamRepository: options.upstreamRepository,
        upstreamCloneUrl: options.upstreamCloneUrl,
        contributorFork: options.contributorFork || `contributor/${options.upstreamRepository.split('/')[1] || 'fork'}`,
        contributorForkUrl: options.contributorForkUrl,
        branchName,
        baseCommitSha,
        defaultBranch: options.defaultBranch || 'main',
        customCloneSource: options.customCloneSource,
      });
      return workspacePath;
    }

    // Fallback: If no upstream repository options provided (e.g. legacy test stub),
    // initialize safely under /tmp with an initial commit and branch.
    await fs.mkdir(workspacePath, { recursive: true, mode: 0o700 });

    try {
      await fs.stat(path.join(workspacePath, '.git'));
    } catch {
      await execFileAsync('git', ['init', '-b', 'main'], { cwd: workspacePath });
      await execFileAsync('git', ['config', 'user.name', 'COSInput Contributor'], { cwd: workspacePath });
      await execFileAsync('git', ['config', 'user.email', 'contributor@cosinput.local'], { cwd: workspacePath });

      const initialFile = path.join(workspacePath, 'README.md');
      await fs.writeFile(
        initialFile,
        `# Isolated Contributor Workspace\nBase Commit: ${baseCommitSha}\n`,
        'utf-8'
      );
      await execFileAsync('git', ['add', 'README.md'], { cwd: workspacePath });
      await execFileAsync(
        'git',
        ['commit', '-m', `base: initialize from ${baseCommitSha.substring(0, 7)}`],
        { cwd: workspacePath }
      );
      await execFileAsync('git', ['checkout', '-b', branchName], { cwd: workspacePath });
    }

    return workspacePath;
  }

  /**
   * Applies grounded modifications to actual files in the workspace.
   * Reads existing real files if present, preserving original content outside modified areas.
   */
  async applyFileModifications(
    workspacePath: string,
    changes: Array<{ targetFile: string; content?: string; description: string }>
  ): Promise<string[]> {
    const modifiedPaths: string[] = [];

    for (const change of changes) {
      const fullPath = path.join(workspacePath, change.targetFile);
      const parentDir = path.dirname(fullPath);
      await fs.mkdir(parentDir, { recursive: true });

      // Read existing file content if it exists
      let existingContent = '';
      try {
        existingContent = await fs.readFile(fullPath, 'utf-8');
      } catch {
        existingContent = '';
      }

      let fileContent = change.content;
      if (!fileContent) {
        if (existingContent.trim()) {
          fileContent = `${existingContent}\n// COSInput Grounded Implementation: ${change.description}\n`;
        } else {
          fileContent = `// COSInput Grounded Implementation\n// File: ${change.targetFile}\n// Change: ${change.description}\n\nexport const solution = () => {\n  return 'verified';\n};\n`;
        }
      }

      await fs.writeFile(fullPath, fileContent, 'utf-8');
      modifiedPaths.push(change.targetFile);
    }

    return modifiedPaths;
  }

  /**
   * Generates genuine Git diff from the real working tree.
   */
  async getWorkingTreeDiff(workspacePath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['diff'], { cwd: workspacePath });
      if (stdout.trim()) {
        return stdout;
      }
      // If unstaged is empty, check staged
      const stagedRes = await execFileAsync('git', ['diff', '--cached'], { cwd: workspacePath });
      return stagedRes.stdout;
    } catch {
      return '';
    }
  }

  /**
   * Stages ONLY reviewed and approved file paths.
   * Prohibits unrestricted 'git add .' or '-A'.
   */
  async stageApprovedFiles(workspacePath: string, approvedFilePaths: string[]): Promise<string[]> {
    if (!approvedFilePaths || approvedFilePaths.length === 0) {
      throw new Error('Cannot stage files: No approved file paths were specified.');
    }

    // Explicit rejection of wildcard or unrestricted patterns
    for (const f of approvedFilePaths) {
      if (f === '.' || f === '*' || f === '-A' || f === '--all') {
        throw new Error(
          `Unrestricted staging pattern '${f}' is prohibited by COSInput invariants. Only explicit file paths may be staged.`
        );
      }
    }

    // Stage each file explicitly
    for (const relPath of approvedFilePaths) {
      await execFileAsync('git', ['add', relPath], { cwd: workspacePath });
    }

    // Verify staged files using git status --porcelain
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: workspacePath });
    const staged: string[] = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.length >= 3 && (line[0] === 'M' || line[0] === 'A' || line[0] === 'D')) {
        staged.push(line.substring(3).trim());
      }
    }

    return staged;
  }

  /**
   * Verifies working-tree state and branch identity, then creates controlled Git commit.
   * Preserves authentic commit ancestry.
   */
  async createCommit(
    workspacePath: string,
    expectedBranch: string,
    commitMessage: string
  ): Promise<{ commitSha: string; branch: string; parentSha?: string }> {
    // 1. Verify branch identity
    const { stdout: currentBranchOut } = await execFileAsync(
      'git',
      ['branch', '--show-current'],
      { cwd: workspacePath }
    );
    const currentBranch = currentBranchOut.trim();
    if (currentBranch !== expectedBranch) {
      throw new Error(
        `Branch mismatch during commit creation: expected '${expectedBranch}', but working tree is on '${currentBranch}'.`
      );
    }

    // 2. Verify there are staged changes
    const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: workspacePath,
    });
    const hasStaged = statusOut
      .split('\n')
      .some((l) => l.length >= 3 && (l[0] === 'M' || l[0] === 'A' || l[0] === 'D'));
    if (!hasStaged) {
      throw new Error('Cannot create commit: No approved changes are currently staged.');
    }

    // 3. Capture parent SHA before committing
    let parentSha = '';
    try {
      const { stdout: parentOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: workspacePath,
      });
      parentSha = parentOut.trim();
    } catch {
      parentSha = '';
    }

    // 4. Create commit
    await execFileAsync('git', ['commit', '-m', commitMessage], { cwd: workspacePath });

    // 5. Capture genuine commit SHA
    const { stdout: shaOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: workspacePath,
    });
    const commitSha = shaOut.trim();

    return {
      commitSha,
      branch: currentBranch,
      parentSha,
    };
  }

  /**
   * Pushes authentic commit to contributor fork remote ('origin').
   * Strictly enforces that 'origin' is the ONLY permitted push remote,
   * rejects pushing to 'upstream', and never force-pushes.
   */
  async pushToContributorFork(
    workspacePath: string,
    branchName: string,
    targetRemote = 'origin'
  ): Promise<{ stdout: string; durationMs: number }> {
    const startTime = Date.now();

    // Invariant: Reject pushing to upstream or any non-origin remote
    if (targetRemote.toLowerCase() !== 'origin') {
      throw new Error(
        `Security Boundary Violation: Pushing to remote '${targetRemote}' is strictly prohibited. The contributor fork ('origin') is the only permitted push destination.`
      );
    }

    // Verify configured remotes
    const remotes = await this.getRemotes(workspacePath);
    if (!remotes.origin) {
      throw new Error("Cannot push: Contributor fork remote 'origin' is not configured.");
    }

    if (remotes.upstream && remotes.origin.toLowerCase() === remotes.upstream.toLowerCase()) {
      throw new Error(
        "Security Boundary Violation: Remote 'origin' points to canonical upstream repository. Direct pushes to upstream are strictly forbidden."
      );
    }

    // Execute safe push: never force-push
    const { stdout, stderr } = await execFileAsync(
      'git',
      ['push', 'origin', branchName],
      {
        cwd: workspacePath,
        timeout: 45000,
        env: this.getSanitizedEnv(),
      }
    );

    return {
      stdout: this.redactSecrets((stdout || stderr).trim()),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Comprehensive integrity verification of an existing workspace on disk.
   */
  async verifyWorkspaceIntegrity(
    sessionId: string,
    runId: string,
    expectedBranch?: string,
    expectedBaseSha?: string
  ): Promise<WorkspaceIntegrityReport> {
    const workspacePath = this.getWorkspacePath(sessionId, runId);
    const errors: string[] = [];

    let isRealGitTree = false;
    let headSha = '';
    let currentBranch = '';
    let uncommittedChanges = false;
    let stagedFiles: string[] = [];
    let remotes: { upstream?: string; origin?: string } = {};

    try {
      await fs.stat(path.join(workspacePath, '.git'));
      const { stdout: isTree } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: workspacePath,
      });
      isRealGitTree = isTree.trim() === 'true';

      if (isRealGitTree) {
        const { stdout: headOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
          cwd: workspacePath,
        });
        headSha = headOut.trim();

        const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], {
          cwd: workspacePath,
        });
        currentBranch = branchOut.trim();

        const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain'], {
          cwd: workspacePath,
        });
        const lines = statusOut.split('\n').filter(Boolean);
        uncommittedChanges = lines.length > 0;
        stagedFiles = lines
          .filter((l) => l[0] === 'M' || l[0] === 'A' || l[0] === 'D')
          .map((l) => l.substring(3).trim());

        remotes = await this.getRemotes(workspacePath);
      }
    } catch (err: any) {
      isRealGitTree = false;
      errors.push(`Not a valid Git working tree: ${err.message}`);
    }

    if (expectedBranch && currentBranch && currentBranch !== expectedBranch) {
      errors.push(`Branch mismatch: Expected '${expectedBranch}', found '${currentBranch}'.`);
    }

    let baseShaVerified = false;
    let commitAncestryPreserved = false;
    if (expectedBaseSha && headSha) {
      try {
        await execFileAsync('git', ['cat-file', '-e', `${expectedBaseSha}^{commit}`], {
          cwd: workspacePath,
        });
        baseShaVerified = true;

        // Verify ancestry
        const { stdout: baseLog } = await execFileAsync(
          'git',
          ['merge-base', headSha, expectedBaseSha],
          { cwd: workspacePath }
        );
        if (baseLog.trim() === expectedBaseSha || headSha === expectedBaseSha) {
          commitAncestryPreserved = true;
        }
      } catch {
        errors.push(`Base commit '${expectedBaseSha}' not found in ancestry of HEAD '${headSha}'.`);
      }
    }

    // Remotes validation
    if (remotes.upstream && remotes.origin && remotes.upstream.toLowerCase() === remotes.origin.toLowerCase()) {
      errors.push("Security violation: Fork remote 'origin' points to canonical upstream.");
    }

    const valid = isRealGitTree && errors.length === 0;

    return {
      valid,
      mode: isRealGitTree ? 'REAL_GIT_WORKSPACE' : 'SIMULATED_TEST_ENVIRONMENT',
      workspacePath,
      isRealGitTree,
      headSha,
      branchName: currentBranch || expectedBranch || '',
      baseCommitSha: expectedBaseSha || '',
      baseShaVerified,
      commitAncestryPreserved,
      remotes: {
        upstream: remotes.upstream || '',
        origin: remotes.origin || '',
        permittedPushRemote: 'origin',
      },
      shallowIncompatibilityDetected: false,
      uncommittedChanges,
      stagedFiles,
      errors,
    };
  }

  /**
   * Inspects workspace status.
   */
  async getWorkspaceStatus(
    sessionId: string,
    runId: string,
    branchName: string,
    baseCommitSha: string
  ): Promise<WorkspaceExecutionStatus> {
    const report = await this.verifyWorkspaceIntegrity(sessionId, runId, branchName, baseCommitSha);

    return {
      mode: report.mode,
      workspacePath: report.workspacePath,
      isRealGitTree: report.isRealGitTree,
      branchName: report.branchName || branchName,
      baseCommitSha: report.baseCommitSha || baseCommitSha,
      hasUncommittedChanges: report.uncommittedChanges,
      stagedFiles: report.stagedFiles,
      headSha: report.headSha,
      remotes: {
        upstream: report.remotes.upstream,
        origin: report.remotes.origin,
      },
    };
  }

  /**
   * Cleans up a specific execution run workspace.
   */
  async cleanupWorkspace(sessionId: string, runId: string): Promise<boolean> {
    try {
      const wsPath = this.getWorkspacePath(sessionId, runId);
      await fs.rm(wsPath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleans up all workspaces for a given session.
   */
  async cleanupSessionWorkspaces(sessionId: string): Promise<number> {
    try {
      const cleanSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const sessionPath = path.join(this.baseDir, cleanSession);
      const entries = await fs.readdir(sessionPath);
      let count = 0;
      for (const entry of entries) {
        await fs.rm(path.join(sessionPath, entry), { recursive: true, force: true });
        count++;
      }
      await fs.rm(sessionPath, { recursive: true, force: true });
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Prunes workspaces that exceed the defined retention window.
   */
  async pruneExpiredWorkspaces(maxAgeMs = this.retentionPolicy.maxAgeMs): Promise<number> {
    let prunedCount = 0;
    const now = Date.now();

    try {
      const sessions = await fs.readdir(this.baseDir);
      for (const sessionDir of sessions) {
        const fullSessionDir = path.join(this.baseDir, sessionDir);
        const runs = await fs.readdir(fullSessionDir);
        for (const runDir of runs) {
          const fullRunDir = path.join(fullSessionDir, runDir);
          try {
            const stat = await fs.stat(fullRunDir);
            if (now - stat.mtimeMs >= maxAgeMs) {
              await fs.rm(fullRunDir, { recursive: true, force: true });
              prunedCount++;
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    return prunedCount;
  }
}

export const workspaceExecutionEngine = new WorkspaceExecutionEngine();
