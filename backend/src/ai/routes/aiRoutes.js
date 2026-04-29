/**
 * AI 路由
 */

const express = require('express');
const { authenticate, injectAccessContext, requirePermission } = require('../../middleware/auth');
const aiController = require('../controllers/aiController');

const router = express.Router();

// 公共中间件：认证 + 上下文注入
const auth = [authenticate, injectAccessContext];

// 所有 AI 接口需要 ai.use 权限（实际执行，非仅声明）
const aiPermission = requirePermission('ai.use');

// 输入校验中间件
const { validateAiRequest } = require('../../middleware/validateAiRequest');

// POST /api/ai/panel - 打开助手栏时获取结构化内容
router.post('/panel', ...auth, aiPermission, validateAiRequest('panel'), aiController.getPanel);

// POST /api/ai/analyze - 页面内快捷动作
router.post('/analyze', ...auth, aiPermission, validateAiRequest('analyze'), aiController.analyze);

// POST /api/ai/chat - 自由问答
router.post('/chat', ...auth, aiPermission, validateAiRequest('chat'), aiController.chat);

// POST /api/ai/briefing - 生成简报
router.post('/briefing', ...auth, aiPermission, validateAiRequest('briefing'), aiController.generateBriefing);

// GET /api/ai/badge-summary - 角标数据（轻量接口，无需严格校验）
router.get('/badge-summary', ...auth, aiPermission, aiController.getBadgeSummary);

// POST /api/ai/chat-stream - 流式自由问答（SSE）
router.post('/chat-stream', ...auth, aiPermission, validateAiRequest('chat-stream'), aiController.streamChat);

// POST /api/ai/action - AI 可操作输出（白名单+审计）
router.post('/action', ...auth, aiPermission, validateAiRequest('action'), aiController.executeAction);

module.exports = router;
