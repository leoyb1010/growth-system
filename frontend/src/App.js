import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';

// 代码分割：懒加载页面组件
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const TodayPage = React.lazy(() => import('./pages/TodayPage'));
const WeekPage = React.lazy(() => import('./pages/WeekPage'));
const KpiPage = React.lazy(() => import('./pages/KpiPage'));
const ProjectPage = React.lazy(() => import('./pages/ProjectPage'));
const PerformancePage = React.lazy(() => import('./pages/PerformancePage'));
const MonthlyTaskPage = React.lazy(() => import('./pages/MonthlyTaskPage'));
const AchievementPage = React.lazy(() => import('./pages/AchievementPage'));
const SettlementPage = React.lazy(() => import('./pages/SettlementPage'));
const WeeklyReportPage = React.lazy(() => import('./pages/WeeklyReportPage'));
const DataEntryPage = React.lazy(() => import('./pages/DataEntryPage'));
const UserPage = React.lazy(() => import('./pages/UserPage'));
const DepartmentPage = React.lazy(() => import('./pages/DepartmentPage'));
const AuditLogPage = React.lazy(() => import('./pages/AuditLogPage'));
const ArchivePage = React.lazy(() => import('./pages/ArchivePage'));

// 页面加载 Spinner
const PageLoading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
      <div>加载中...</div>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<ErrorBoundary><Suspense fallback={<PageLoading />}><DashboardPage /></Suspense></ErrorBoundary>} />
            <Route path="today" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><TodayPage /></Suspense></ErrorBoundary>} />
            <Route path="week" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><WeekPage /></Suspense></ErrorBoundary>} />
            <Route path="kpis" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><KpiPage /></Suspense></ErrorBoundary>} />
            <Route path="projects" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><ProjectPage /></Suspense></ErrorBoundary>} />
            <Route path="performances" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><PerformancePage /></Suspense></ErrorBoundary>} />
            <Route path="monthly-tasks" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><MonthlyTaskPage /></Suspense></ErrorBoundary>} />
            <Route path="achievements" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><AchievementPage /></Suspense></ErrorBoundary>} />
            <Route path="settlement" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><SettlementPage /></Suspense></ErrorBoundary>} />
            <Route path="weekly-reports" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><WeeklyReportPage /></Suspense></ErrorBoundary>} />
            <Route path="data-entry" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><DataEntryPage /></Suspense></ErrorBoundary>} />
            <Route path="users" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><UserPage /></Suspense></ErrorBoundary>} />
            <Route path="departments" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><DepartmentPage /></Suspense></ErrorBoundary>} />
            <Route path="audit-logs" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><AuditLogPage /></Suspense></ErrorBoundary>} />
            <Route path="archives" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><ArchivePage /></Suspense></ErrorBoundary>} />
          </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
