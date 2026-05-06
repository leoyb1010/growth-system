// ============================================================
// PATCH for frontend/src/App.js
// ============================================================

// --- Top of file: add lazy imports ---
const CpsDashboardPage = lazy(() => import('./pages/cps/CpsDashboardPage'));
const CpsDataPage = lazy(() => import('./pages/cps/CpsDataPage'));
const CpsAlertPage = lazy(() => import('./pages/cps/CpsAlertPage'));
const CpsChannelPage = lazy(() => import('./pages/cps/CpsChannelPage'));
const CpsProductPage = lazy(() => import('./pages/cps/CpsProductPage'));
const CpsSettingsPage = lazy(() => import('./pages/cps/CpsSettingsPage'));
const CpsPublicUploadPage = lazy(() => import('./pages/cps/CpsPublicUploadPage'));

// --- Near login page routes, add public route: ---
<Route path="/cps-public/upload" element={
  <ErrorBoundary>
    <Suspense fallback={<PageLoading />}>
      <CpsPublicUploadPage />
    </Suspense>
  </ErrorBoundary>
} />

// --- Inside authenticated Layout routes, add: ---
<Route path="cps/dashboard" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><CpsDashboardPage /></Suspense></ErrorBoundary>} />
<Route path="cps/data" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><CpsDataPage /></Suspense></ErrorBoundary>} />
<Route path="cps/alerts" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><CpsAlertPage /></Suspense></ErrorBoundary>} />
<Route path="cps/channels" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><CpsChannelPage /></Suspense></ErrorBoundary>} />
<Route path="cps/products" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><CpsProductPage /></Suspense></ErrorBoundary>} />
<Route path="cps/settings" element={<ErrorBoundary><Suspense fallback={<PageLoading />}><CpsSettingsPage /></Suspense></ErrorBoundary>} />
