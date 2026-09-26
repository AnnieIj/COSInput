/**
 * COSInput Foundation v0.3 — Contribution Session Store
 * Manages local contribution-analysis sessions without modifying GitHub.
 * Strictly read-only relative to GitHub.
 */

import type {
  ContributionSession,
  AnalysisStatus,
  RepositoryAccessStatus,
  ActivityTimelineItem,
} from './types';

class ContributionSessionStore {
  private sessions: Map<string, ContributionSession> = new Map();

  generateSessionId(owner: string, repo: string, issueNumber: number): string {
    const cleanOwner = owner.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanRepo = repo.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return `contrib-${cleanOwner}-${cleanRepo}-${issueNumber}`;
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
