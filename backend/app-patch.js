// ============================================================
// PATCH for backend/src/app.js
// ============================================================
// Add these lines near where other cron services are started:

const cpsCronService = require('./services/cpsCronService');
cpsCronService.start();
