import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import KpiPage from './pages/KpiPage';
import ProjectPage from './pages/ProjectPage';
import PerformancePage from './pages/PerformancePage';
import MonthlyTaskPage from './pages/MonthlyTaskPage';
import AchievementPage from './pages/AchievementPage';
import WeeklyReportPage from './pages/WeeklyReportPage';
import DataEntryPage from './pages/DataEntryPage';
import UserPage from './pages/UserPage';
import AuditLogPage from './pages/AuditLogPage';
import ArchivePage from './pages/ArchivePage';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="kpis" element={<KpiPage />} />
            <Route path="projects" element={<ProjectPage />} />
            <Route path="performances" element={<PerformancePage />} />
            <Route path="monthly-tasks" element={<MonthlyTaskPage />} />
            <Route path="achievements" element={<AchievementPage />} />
            <Route path="weekly-reports" element={<WeeklyReportPage />} />
            <Route path="data-entry" element={<DataEntryPage />} />
            <Route path="users" element={<UserPage />} />
            <Route path="audit-logs" element={<AuditLogPage />} />
            <Route path="archives" element={<ArchivePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
