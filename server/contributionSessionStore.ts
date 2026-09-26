/**
 * COSInput Foundation v0.3 — Contribution Session Store
 * Manages local contribution-analysis sessions without modifying GitHub.
 * Strictly read-only relative to GitHub.
 * Enforces atomic analysis attempts, concurrency protection, and historical plan archiving.
 */

import type {
  ContributionSession,
  RepositoryAccessStatus,
  ActivityTimelineItem,
  ImplementationPlan,
  AcceptanceCriterion,
  RelevantFile,
  BlockerItem,
  IssueIntelligenceData,
  RepositoryIntelligenceData,
  DependencyConfigAnalysis,
  VerifiedRepositorySnapshot,
  HistoricalPlanRecord,
} from './types';

class ContributionSessionStore {
  private sessions: Map<string, ContributionSession> = new Map();

  generateSessionId(owner: string, repo: string, issueNumber: number): string {
    const cleanOwner = owner.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanRepo = repo.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return `contrib-${cleanOwner}-${cleanRepo}-${issueNumber}`;
  }

  generateAttemptId(): string {
    return `attempt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  createSession(params: {
    repositoryOwner: string;
    repositoryName: string;
    issueNumber: number;
    issueTitle: string;
    issueUrl: string;
    contributorUsername: string;
    repositoryAccessStatus: RepositoryAccessStatus;
  }): ContributionSession {
    const id = this.generateSessionId(
      params.repositoryOwner,
      params.repositoryName,
      params.issueNumber
    );

    // If an existing session exists for this issue, return it with refreshed access status
    const existing = this.sessions.get(id);
    if (existing) {
      existing.repositoryAccessStatus = params.repositoryAccessStatus;
      existing.updatedTimestamp = new Date().toISOString();
      return existing;
    }

    const now = new Date().toISOString();
    const initialTimeline: ActivityTimelineItem[] = [
      {
        id: 'timeline-created',
        stage: 'Session Initialized',
        timestamp: now,
        detail: `Contribution analysis context prepared for #${params.issueNumber} in ${params.repositoryOwner}/${params.repositoryName}. Zero GitHub writes.`,
        completed: true,
      },
    ];

    const session: ContributionSession = {
      id,
      repositoryOwner: params.repositoryOwner,
      repositoryName: params.repositoryName,
      upstreamRepository: `${params.repositoryOwner}/${params.repositoryName}`,
      issueNumber: params.issueNumber,
      issueTitle: params.issueTitle,
      issueUrl: params.issueUrl,
      contributorUsername: params.contributorUsername,
      repositoryAccessStatus: params.repositoryAccessStatus,
      analysisStatus: 'NOT_STARTED',
      createdTimestamp: now,
      updatedTimestamp: now,
      currentAttemptId: undefined,
      currentAttemptStatus: 'NOT_STARTED',
      lastVerifiedSnapshot: null,
      historicalPlans: [],
      repositoryIntelligence: null,
      issueIntelligence: null,
      acceptanceCriteria: [],
      relevantFiles: [],
      dependenciesAndConfig: null,
      blockers: [],
      implementationPlan: null,
      humanApproval: {
        status: 'pending',
      },
      activityTimeline: initialTimeline,
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): ContributionSession | null {
    return this.sessions.get(id) || null;
  }

  listSessions(): ContributionSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedTimestamp).getTime() - new Date(a.updatedTimestamp).getTime()
    );
  }

  updateSession(id: string, updates: Partial<ContributionSession>): ContributionSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Contribution session '${id}' not found.`);
    }

    Object.assign(session, updates, {
      updatedTimestamp: new Date().toISOString(),
    });

    return session;
  }

  /**
   * Starts a new isolated analysis attempt with a unique attempt ID.
   * Concurrency invariant: Any older running attempt will be rejected when completing.
   */
  startAnalysisAttempt(id: string): string {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Contribution session '${id}' not found.`);
    }

    const attemptId = this.generateAttemptId();
    session.currentAttemptId = attemptId;
    session.currentAttemptStatus = 'RUNNING';
    session.analysisStatus = 'REPOSITORY_INSPECTION';
    session.errorMessage = undefined;
    session.updatedTimestamp = new Date().toISOString();

    // Reset non-governance timeline events for this attempt
    this.resetAnalysisAttempt(id);

    return attemptId;
  }

  /**
   * Commits analysis results atomically ONLY when all stages succeed.
   * If a previous plan existed, archives it to historicalPlans.
   * Rejects stale/superseded attempts.
   */
  commitAnalysisAttempt(
    id: string,
    attemptId: string,
    data: {
      repositoryIntelligence: RepositoryIntelligenceData;
      dependencyConfig: DependencyConfigAnalysis;
      issueIntelligence: IssueIntelligenceData;
      acceptanceCriteria: AcceptanceCriterion[];
      relevantFiles: RelevantFile[];
      blockers: BlockerItem[];
      implementationPlan: ImplementationPlan;
      isBlocked: boolean;
    }
  ): ContributionSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Contribution session '${id}' not found.`);
    }

    // Stale/concurrent check: ensure this is still the active attempt
    if (session.currentAttemptId && session.currentAttemptId !== attemptId) {
      throw new Error(
        `Attempt '${attemptId}' is stale. Superseded by newer attempt '${session.currentAttemptId}'.`
      );
    }

    const now = new Date().toISOString();

    // If an existing plan existed, archive it to historicalPlans before publishing new one
    if (session.implementationPlan) {
      if (!session.historicalPlans) session.historicalPlans = [];
      session.historicalPlans.push({
        attemptId: session.currentAttemptId || 'prev',
        completedAt: session.updatedTimestamp,
        plan: session.implementationPlan,
        acceptanceCriteria: session.acceptanceCriteria || [],
        status: 'superseded',
      });
    }

    // Update verified repository snapshot
    session.lastVerifiedSnapshot = {
      timestamp: now,
      repositoryIntelligence: data.repositoryIntelligence,
      dependencyConfig: data.dependencyConfig,
      status: 'verified',
    };

    const finalStatus = data.isBlocked ? 'BLOCKED' : 'PLAN_READY';

    session.repositoryIntelligence = data.repositoryIntelligence;
    session.dependenciesAndConfig = data.dependencyConfig;
    session.issueIntelligence = data.issueIntelligence;
    session.acceptanceCriteria = data.acceptanceCriteria;
    session.relevantFiles = data.relevantFiles;
    session.blockers = data.blockers;
    session.implementationPlan = data.implementationPlan;
    session.analysisStatus = finalStatus;
    session.currentAttemptStatus = 'SUCCEEDED';
    session.errorMessage = undefined;
    session.updatedTimestamp = now;

    return session;
  }

  /**
   * Fails the current attempt atomically.
   * Disables plan approval and preserves previous successful plan as historical data.
   */
  failAnalysisAttempt(id: string, attemptId: string, errorMsg: string): ContributionSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Contribution session '${id}' not found.`);
    }

    // Ignore failure notifications from stale attempts
    if (session.currentAttemptId && session.currentAttemptId !== attemptId) {
      return session;
    }

    const now = new Date().toISOString();

    // Preserve previous plan as historical data if not already archived
    if (session.implementationPlan) {
      if (!session.historicalPlans) session.historicalPlans = [];
      const alreadyArchived = session.historicalPlans.some((h) => h.plan === session.implementationPlan);
      if (!alreadyArchived) {
        session.historicalPlans.push({
          attemptId: 'historical-verified',
          completedAt: session.updatedTimestamp,
          plan: session.implementationPlan,
          acceptanceCriteria: session.acceptanceCriteria || [],
          status: 'historical',
        });
      }
    }

    // Do NOT present partial or previous plan as current/approval-ready
    session.implementationPlan = null;
    session.currentAttemptStatus = 'FAILED';
    session.analysisStatus = 'FAILED';
    session.errorMessage = errorMsg;
    session.humanApproval = { status: 'pending' };
    session.updatedTimestamp = now;

    return session;
  }

  resetAnalysisAttempt(id: string) {
    const session = this.sessions.get(id);
    if (!session) return;

    // Retain session initialization and human governance events
    const retained = session.activityTimeline.filter(
      (ev) =>
        ev.stage === 'Session Initialized' ||
        ev.stage.includes('Approved') ||
        ev.stage.includes('Revision') ||
        ev.stage.includes('Cancelled')
    );
    session.activityTimeline = retained.length > 0 ? retained : [
      {
        id: 'timeline-init',
        stage: 'Session Initialized',
        timestamp: new Date().toISOString(),
        detail: `Contribution analysis context prepared for #${session.issueNumber} in ${session.upstreamRepository}. Zero GitHub writes.`,
        completed: true,
      },
    ];
    session.updatedTimestamp = new Date().toISOString();
  }

  addTimelineEvent(id: string, stage: string, detail: string, completed = true, active = false) {
    const session = this.sessions.get(id);
    if (!session) return;

    // Deduplicate by stage: update existing event instead of appending duplicate
    const existingIndex = session.activityTimeline.findIndex((ev) => ev.stage === stage);
    if (existingIndex !== -1) {
      session.activityTimeline[existingIndex] = {
        ...session.activityTimeline[existingIndex],
        timestamp: new Date().toISOString(),
        detail,
        completed,
        active,
      };
      session.updatedTimestamp = new Date().toISOString();
      return;
    }

    session.activityTimeline.push({
      id: `timeline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stage,
      timestamp: new Date().toISOString(),
      detail,
      completed,
      active,
    });
    session.updatedTimestamp = new Date().toISOString();
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  clearAll(): void {
    this.sessions.clear();
  }
}

export const contributionSessionStore = new ContributionSessionStore();
