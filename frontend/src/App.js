import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TodayPage from './pages/TodayPage';
import WeekPage from './pages/WeekPage';
import KpiPage from './pages/KpiPage';
import ProjectPage from './pages/ProjectPage';
import PerformancePage from './pages/PerformancePage';
import MonthlyTaskPage from './pages/MonthlyTaskPage';
import AchievementPage from './pages/AchievementPage';
import SettlementPage from './pages/SettlementPage';
import WeeklyReportPage from './pages/WeeklyReportPage';
import DataEntryPage from './pages/DataEntryPage';
import UserPage from './pages/UserPage';
import DepartmentPage from './pages/DepartmentPage';
import AuditLogPage from './pages/AuditLogPage';
import ArchivePage from './pages/ArchivePage';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="today" element={<ErrorBoundary><TodayPage /></ErrorBoundary>} />
              <Route path="week" element={<ErrorBoundary><WeekPage /></ErrorBoundary>} />
              <Route path="kpis" element={<ErrorBoundary><KpiPage /></ErrorBoundary>} />
              <Route path="projects" element={<ErrorBoundary><ProjectPage /></ErrorBoundary>} />
              <Route path="performances" element={<ErrorBoundary><PerformancePage /></ErrorBoundary>} />
              <Route path="monthly-tasks" element={<ErrorBoundary><MonthlyTaskPage /></ErrorBoundary>} />
              <Route path="achievements" element={<ErrorBoundary><AchievementPage /></ErrorBoundary>} />
              <Route path="settlement" element={<ErrorBoundary><SettlementPage /></ErrorBoundary>} />
              <Route path="weekly-reports" element={<ErrorBoundary><WeeklyReportPage /></ErrorBoundary>} />
              <Route path="data-entry" element={<ErrorBoundary><DataEntryPage /></ErrorBoundary>} />
              <Route path="users" element={<ErrorBoundary><UserPage /></ErrorBoundary>} />
              <Route path="departments" element={<ErrorBoundary><DepartmentPage /></ErrorBoundary>} />
              <Route path="audit-logs" element={<ErrorBoundary><AuditLogPage /></ErrorBoundary>} />
              <Route path="archives" element={<ErrorBoundary><ArchivePage /></ErrorBoundary>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
