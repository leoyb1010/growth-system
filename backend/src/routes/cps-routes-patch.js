// ============================================================
// PATCH for backend/src/routes/index.js
// ============================================================
// These are the additions to be made to the existing routes file.

// --- Top of file: add imports ---
const rateLimit = require('express-rate-limit');
const cpsController = require('../controllers/cpsController');
const cpsAdminController = require('../controllers/cpsAdminController');
const cpsPublicController = require('../controllers/cpsPublicController');
const cpsAiController = require('../ai/controllers/cpsAiController');

// --- After auth routes, before business routes: add public routes ---
const cpsPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/cps-public/context', cpsPublicLimiter, cpsPublicController.getPublicContext);
router.post('/cps-public/upload', cpsPublicLimiter, cpsPublicController.uploadByToken);

// --- In business route section: add CPS routes ---
// ==================== CPS 连包投流 ====================
router.get('/cps/dashboard', ...auth, requirePermission('cps.read'), cpsController.getDashboard);
router.get('/cps/metrics', ...auth, requirePermission('cps.read'), cpsController.getMetrics);
router.post('/cps/metrics', ...auth, requirePermission('cps.write'), cpsController.upsertMetric);
router.put('/cps/metrics/:id', ...auth, requirePermission('cps.write'), cpsController.updateMetric);
router.delete('/cps/metrics/:id', ...auth, requirePermission('cps.admin'), cpsController.deleteMetric);
router.get('/cps/metrics/:id/snapshots', ...auth, requirePermission('cps.read'), cpsController.getMetricSnapshots);

router.post('/cps/metrics/import', ...auth, requirePermission('cps.write'), upload.single('file'), cpsController.importMetrics);
router.get('/cps/metrics/export', ...auth, requirePermission('cps.read'), cpsController.exportMetrics);

router.get('/cps/channels', ...auth, requirePermission('cps.read'), cpsAdminController.getChannels);
router.post('/cps/channels', ...auth, requirePermission('cps.admin'), cpsAdminController.createChannel);
router.put('/cps/channels/:id', ...auth, requirePermission('cps.admin'), cpsAdminController.updateChannel);

router.get('/cps/products', ...auth, requirePermission('cps.read'), cpsAdminController.getProducts);
router.post('/cps/products', ...auth, requirePermission('cps.admin'), cpsAdminController.createProduct);
router.put('/cps/products/:id', ...auth, requirePermission('cps.admin'), cpsAdminController.updateProduct);

router.get('/cps/alerts', ...auth, requirePermission('cps.read'), cpsController.getAlerts);
router.post('/cps/alerts/:id/ack', ...auth, requirePermission('cps.write'), cpsController.ackAlert);

router.get('/cps/alert-rules', ...auth, requirePermission('cps.admin'), cpsAdminController.getAlertRules);
router.put('/cps/alert-rules/:id', ...auth, requirePermission('cps.admin'), cpsAdminController.updateAlertRule);

router.post('/cps/ai/daily-insight', ...auth, requirePermission('cps.read'), requirePermission('ai.use'), cpsAiController.dailyInsight);
router.post('/cps/ai/period-analysis', ...auth, requirePermission('cps.read'), requirePermission('ai.use'), cpsAiController.periodAnalysis);
