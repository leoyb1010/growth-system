const { success, error } = require('../utils/response');
const { AgentIdentity, AgentRequest, AgentOperationDraft, AgentOperationEffect, User } = require('../models');
const { Op } = require('sequelize');
const identityService = require('../services/agentIdentityService');
const { parseIntent } = require('../services/agentIntentService');
const { resolveProject } = require('../services/agentResolverService');
const { executeDraft } = require('../services/agentExecutorService');
const { revertDraft } = require('../services/agentRollbackService');

function isAgentEnabled() {
  return process.env.AGENT_FEATURE_ENABLED !== 'false';
}

function draftTtlMs() {
  const min = Number(process.env.AGENT_DRAFT_TTL_MINUTES) || 30;
  return min * 60 * 1000;
}

function confirmCode() {
  return String(require('crypto').randomInt(1000, 9999));
}

function isAdmin(req) {
  return req.access?.permissions?.includes('agent.admin') || req.user?.roleLevel === 0;
}

function publicDraft(draft) {
  return {
    id: draft.id,
    operation_type: draft.operation_type,
    target_type: draft.target_type,
    target_id: draft.target_id,
    payload: draft.payload,
    preview_text: draft.preview_text,
    status: draft.status,
    expires_at: draft.expires_at,
    executed_at: draft.executed_at,
    created_at: draft.created_at,
  };
}

async function startBind(req, res) {
  try {
    if (!isAgentEnabled()) return error(res, 'Agent 输入能力未开启', 1, 404);
    const { code, expiresInMinutes } = identityService.createBindCode(req.user);
    success(res, {
      code,
      expires_in_minutes: expiresInMinutes,
      usage: `在 Agent Skill/CLI 中输入：绑定 ${req.protocol}://${req.get('host')} ${code}`,
    }, '绑定码已生成');
  } catch (err) {
    error(res, err.message || '生成绑定码失败', 1, 500);
  }
}

async function completeBind(req, res) {
  try {
    if (!isAgentEnabled()) return error(res, 'Agent 输入能力未开启', 1, 404);
    const { code, provider = 'manual', external_user_id, external_username } = req.body;
    if (!code || !external_user_id) return error(res, '缺少绑定码或外部用户ID', 1, 400);
    const result = await identityService.completeBind({ code, provider, externalUserId: external_user_id, externalUsername: external_username });
    success(res, {
      provider,
      external_user_id,
      agent_token: result.agentToken,
      user: { id: result.user.id, name: result.user.name, username: result.user.username },
    }, '绑定成功，请妥善保存 agent_token');
  } catch (err) {
    error(res, err.message || '绑定失败', 1, 400);
  }
}

function buildPreview(operationType, target, payload) {
  if (operationType === 'project.quick_update') {
    const lines = [`将更新项目「${target.name}」`];
    if (payload.progress_pct !== undefined) lines.push(`进度：${payload.progress_pct}%`);
    if (payload.status) lines.push(`状态：${payload.status}`);
    if (payload.weekly_progress) lines.push(`进展：${payload.weekly_progress}`);
    if (payload.risk_desc !== undefined) lines.push(`风险：${payload.risk_desc || '暂无'}`);
    if (payload.next_action) lines.push(`下一步：${payload.next_action}`);
    return lines.join('\n');
  }
  if (operationType === 'action_item.create') {
    return `将创建行动项：${payload.title}\n优先级：${payload.priority || 'medium'}${payload.due_date ? `\n截止：${payload.due_date}` : ''}`;
  }
  if (operationType === 'risk_register.create') {
    return `将记录风险：${payload.title}\n等级：${payload.risk_level || 'medium'}${target?.name ? `\n关联项目：${target.name}` : ''}`;
  }
  return '将执行 Agent 操作';
}

async function createDraft({ request, user, operationType, targetType, targetId, payload, preview }) {
  return AgentOperationDraft.create({
    request_id: request.id,
    user_id: user.id,
    operation_type: operationType,
    target_type: targetType,
    target_id: targetId,
    payload,
    preview_text: preview,
    confirm_code: confirmCode(),
    status: 'pending',
    expires_at: new Date(Date.now() + draftTtlMs()),
  });
}

async function inbound(req, res) {
  let request;
  try {
    if (!isAgentEnabled()) return error(res, 'Agent 输入能力未开启', 1, 404);
    const { provider = 'manual', external_user_id, external_username, message_id, text, agent_token, selected_project_id } = req.body;
    if (!external_user_id || !text) return error(res, '缺少 external_user_id 或 text', 1, 400);

    request = await AgentRequest.create({
      provider,
      external_user_id: String(external_user_id),
      external_username: external_username || null,
      message_id: message_id || null,
      raw_text: text,
      status: 'received',
      ip: req.ip,
      user_agent: req.get('user-agent') || null,
    });

    const identity = await identityService.resolveIdentity({ provider, externalUserId: external_user_id, agentToken: agent_token });
    if (!identity || !identity.User) {
      await request.update({ status: 'rejected', error_message: 'Agent 未绑定或 token 无效' });
      return error(res, 'Agent 未绑定或 token 无效', 1, 401);
    }
    const userModel = identity.User;
    if (userModel.status !== 'active') {
      await request.update({ user_id: userModel.id, status: 'rejected', error_message: '系统账号不可用' });
      return error(res, '系统账号不可用', 1, 403);
    }

    const role = userModel.role || 'dept_staff';
    const roleLevel = (role === 'admin' || role === 'super_admin') ? 0 : (role === 'dept_manager' || role === 'dept' || role === 'cps_admin') ? 1 : 2;
    const user = { id: userModel.id, name: userModel.name, username: userModel.username, role, roleLevel, dept_id: userModel.dept_id };
    await request.update({ user_id: user.id });

    const parsed = parseIntent(text);
    await request.update({ parsed_intent: parsed.intent, parsed_payload: parsed.payload, status: 'parsed' });

    if (parsed.intent === 'query') {
      await request.update({ status: 'needs_clarification', match_result: { message: '查询类输入首版先记录，不直接返回业务数据' } });
      return success(res, { status: 'needs_clarification', message: '查询类输入已记录，首版请在系统内查看对应页面' });
    }

    let targetProject = null;
    let matchResult = null;
    if (parsed.intent === 'project.quick_update' || parsed.intent === 'risk_register.create') {
      if (selected_project_id) {
        targetProject = await require('../models').Project.findByPk(selected_project_id);
        matchResult = { status: targetProject ? 'matched' : 'no_match', selected_project_id };
      } else {
        matchResult = await resolveProject({ user, targetHint: parsed.targetHint, rawText: text });
        if (matchResult.status === 'matched') targetProject = matchResult.project;
      }
      await request.update({ match_result: matchResult });
      if (!targetProject && parsed.intent === 'project.quick_update') {
        await request.update({ status: matchResult.status === 'ambiguous' ? 'ambiguous' : 'needs_clarification' });
        return success(res, { status: request.status, message: matchResult.message, candidates: matchResult.candidates });
      }
    }

    const operationType = parsed.intent;
    const draft = await createDraft({
      request,
      user,
      operationType,
      targetType: targetProject ? 'project' : null,
      targetId: targetProject?.id || null,
      payload: parsed.payload,
      preview: buildPreview(operationType, targetProject, parsed.payload),
    });
    await request.update({ status: 'pending_confirm' });
    return success(res, { status: 'pending_confirm', draft: publicDraft(draft), confirm_code: draft.confirm_code }, '已生成待确认操作');
  } catch (err) {
    if (request) await request.update({ status: 'failed', error_message: err.message }).catch(() => {});
    return error(res, err.message || 'Agent 输入处理失败', 1, 500);
  }
}

async function confirmDraft(req, res) {
  try {
    const draft = await AgentOperationDraft.findByPk(req.params.id);
    if (!draft) return error(res, '草稿不存在', 1, 404);
    if (!isAdmin(req) && draft.user_id !== req.user.id) return error(res, '无权确认此草稿', 1, 403);
    if (String(req.body.confirm_code || '') !== String(draft.confirm_code)) return error(res, '确认码错误', 1, 400);
    const user = await User.findByPk(draft.user_id);
    const role = user.role || 'dept_staff';
    const execUser = { id: user.id, name: user.name, username: user.username, role, roleLevel: (role === 'admin' || role === 'super_admin') ? 0 : (role === 'dept_manager' || role === 'dept' || role === 'cps_admin') ? 1 : 2, dept_id: user.dept_id };
    const result = await executeDraft(draft, execUser);
    await AgentRequest.update({ status: 'executed' }, { where: { id: draft.request_id } });
    success(res, { draft: publicDraft(await AgentOperationDraft.findByPk(draft.id)), result }, '执行成功');
  } catch (err) {
    error(res, err.message || '确认执行失败', 1, 400);
  }
}

async function listRequests(req, res) {
  try {
    const { status, provider, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (provider) where.provider = provider;
    if (!isAdmin(req)) where.user_id = req.user.id;
    const limit = Math.min(Math.max(parseInt(pageSize), 1), 100);
    const offset = (Math.max(parseInt(page), 1) - 1) * limit;
    const { count, rows } = await AgentRequest.findAndCountAll({
      where,
      include: [{ model: User, attributes: ['id', 'name', 'username'] }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    success(res, { data: rows, pagination: { page: parseInt(page), pageSize: limit, total: count } });
  } catch (err) {
    error(res, '获取 Agent 请求日志失败', 1, 500);
  }
}

async function listDrafts(req, res) {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (!isAdmin(req)) where.user_id = req.user.id;
    const limit = Math.min(Math.max(parseInt(pageSize), 1), 100);
    const offset = (Math.max(parseInt(page), 1) - 1) * limit;
    const { count, rows } = await AgentOperationDraft.findAndCountAll({
      where,
      include: [{ model: AgentOperationEffect, as: 'Effects' }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    success(res, { data: rows, pagination: { page: parseInt(page), pageSize: limit, total: count } });
  } catch (err) {
    error(res, '获取 Agent 草稿失败', 1, 500);
  }
}

async function revert(req, res) {
  try {
    const draft = await AgentOperationDraft.findByPk(req.params.id);
    if (!draft) return error(res, '草稿不存在', 1, 404);
    if (!isAdmin(req) && draft.user_id !== req.user.id) return error(res, '无权撤销此操作', 1, 403);
    const effects = await revertDraft(draft, req.user);
    success(res, { count: effects.length }, '已撤销 Agent 输入影响');
  } catch (err) {
    error(res, err.message || '撤销失败', 1, 400);
  }
}

async function listIdentities(req, res) {
  try {
    const where = isAdmin(req) ? {} : { user_id: req.user.id };
    const rows = await AgentIdentity.findAll({ where, include: [{ model: User, attributes: ['id', 'name', 'username'] }], order: [['created_at', 'DESC']] });
    success(res, rows);
  } catch (err) {
    error(res, '获取 Agent 绑定失败', 1, 500);
  }
}

async function disableIdentity(req, res) {
  try {
    const identity = await AgentIdentity.findByPk(req.params.id);
    if (!identity) return error(res, '绑定不存在', 1, 404);
    if (!isAdmin(req) && identity.user_id !== req.user.id) return error(res, '无权禁用此绑定', 1, 403);
    await identity.update({ status: 'disabled' });
    success(res, null, '已禁用绑定');
  } catch (err) {
    error(res, '禁用绑定失败', 1, 500);
  }
}

module.exports = { startBind, completeBind, inbound, confirmDraft, listRequests, listDrafts, revert, listIdentities, disableIdentity };
