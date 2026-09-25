/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ModeProvider } from './context/ModeContext';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { IssuesPage } from './pages/IssuesPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { GuardianCockpitPage } from './pages/GuardianCockpitPage';
import { CIGuardianPage } from './pages/CIGuardianPage';
import { MergeConflictPage } from './pages/MergeConflictPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { LiveRunPage } from './pages/LiveRunPage';
import { PullRequestsPage } from './pages/PullRequestsPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <ModeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* Landing Screen */}
            <Route path="/" element={<LandingPage />} />

            {/* Operations Dashboard */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Issues Directory & Details */}
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/issues/:issueId" element={<IssueDetailPage />} />

            {/* Live Agent Runs & Continuous Execution Pipeline */}
            <Route path="/runs/:runId" element={<LiveRunPage />} />

            {/* Contribution Workspace Engine & Sub-Guardians */}
            <Route path="/contributions/:id" element={<WorkspacePage />} />
            <Route path="/contributions/:id/guardian" element={<GuardianCockpitPage />} />
            <Route path="/contributions/:id/ci" element={<CIGuardianPage />} />
            <Route path="/contributions/:id/conflicts" element={<MergeConflictPage />} />
            <Route path="/contributions/:id/reviews" element={<ReviewsPage />} />

            {/* Pull Requests & Repositories */}
            <Route path="/pull-requests" element={<PullRequestsPage />} />
            <Route path="/repositories" element={<RepositoriesPage />} />

            {/* Settings & Invariant Configuration */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* Fallback Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ModeProvider>
  );
}
