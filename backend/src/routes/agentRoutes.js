const express = require('express');
const { authenticate, injectAccessContext, requirePermission } = require('../middleware/auth');
const agentController = require('../controllers/agentController');

const router = express.Router();
const auth = [authenticate, injectAccessContext];

router.post('/bind/start', ...auth, requirePermission('agent.use'), agentController.startBind);
router.post('/bind/complete', agentController.completeBind);
router.post('/inbound', agentController.inbound);
router.post('/drafts/:id/confirm', ...auth, requirePermission('agent.use'), agentController.confirmDraft);
router.get('/requests', ...auth, requirePermission('agent.use'), agentController.listRequests);
router.get('/drafts', ...auth, requirePermission('agent.use'), agentController.listDrafts);
router.post('/drafts/:id/revert', ...auth, requirePermission('agent.use'), agentController.revert);
router.get('/identities', ...auth, requirePermission('agent.use'), agentController.listIdentities);
router.post('/identities/:id/disable', ...auth, requirePermission('agent.use'), agentController.disableIdentity);

module.exports = router;
