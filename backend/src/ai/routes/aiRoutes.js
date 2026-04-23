/**
 * AI 路由
 */

const express = require('express');
const { authenticate, injectAccessContext, requirePermission } = require('../../middleware/auth');
const aiController = require('../controllers/aiController');

const router = express.Router();

// 公共中间件：认证 + 上下文注入
const auth = [authenticate, injectAccessContext];

// 所有 AI 接口需要 dashboard.read 权限（最低权限门槛）
const aiPermission = requirePermission('dashboard.read');

// POST /api/ai/panel - 打开助手栏时获取结构化内容
router.post('/panel', ...auth, aiPermission, aiController.getPanel);

// POST /api/ai/analyze - 页面内快捷动作
router.post('/analyze', ...auth, aiPermission, aiController.analyze);

// POST /api/ai/chat - 自由问答
router.post('/chat', ...auth, aiPermission, aiController.chat);

// POST /api/ai/briefing - 生成简报
router.post('/briefing', ...auth, aiPermission, aiController.generateBriefing);

// GET /api/ai/badge-summary - 角标数据
router.get('/badge-summary', ...auth, aiPermission, aiController.getBadgeSummary);

module.exports = router;
