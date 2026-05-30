const moment = require('moment');
const { Project, ProjectUpdateLog, ActionItem, RiskRegister, AgentOperationEffect } = require('../models');
const { logAudit } = require('./auditLogService');
const { isArchived } = require('./archiveCheckService');

const PROJECT_FIELDS = ['weekly_progress', 'risk_desc', 'next_action', 'block_reason'];

function operatorFromUser(user) {
  return { id: user.id, name: user.name || user.username };
}

function canModifyProject(project, user) {
  const roleLevel = user.roleLevel;
  if (roleLevel === 0) return true;
  if (roleLevel === 1) return project.dept_id === user.dept_id;
  return project.owner_user_id === user.id || project.creator_id === user.id || project.owner_name === user.name;
}

function appendTodayProgress(existing, incoming) {
  if (!incoming) return existing;
  const today = moment().format('MM/DD');
  const content = String(incoming).slice(0, 1000);
  if ((existing || '').includes(`[${today}]`)) {
    const regex = new RegExp(`\\[${today}\\][\\s\\S]*?(?=\\[\\d{2}/\\d{2}\\]|$)`, 'g');
    return (existing || '').replace(regex, `[${today}] ${content}`);
  }
  return `[${today}] ${content}\n${existing || ''}`;
}

function filterProjectPayload(payload, project) {
  const updateData = {};
  PROJECT_FIELDS.forEach(f => {
    if (payload[f] !== undefined && payload[f] !== null) updateData[f] = payload[f];
  });
  if (payload.progress_pct !== undefined) {
    updateData.progress_pct = Math.max(0, Math.min(100, Number(payload.progress_pct) || 0));
  }
  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }
  if (updateData.weekly_progress) {
    updateData.weekly_progress = appendTodayProgress(project.weekly_progress || '', updateData.weekly_progress);
  }
  updateData.updater_id = payload.user_id || null;
  return updateData;
}

async function executeProjectQuickUpdate(draft, user) {
  const project = await Project.findByPk(draft.target_id);
  if (!project) throw new Error('项目不存在');
  if (!canModifyProject(project, user)) throw new Error('无权更新此项目');

  const archived = await isArchived('projects', project.quarter, project.year);
  if (archived) throw new Error('该季度已归档，禁止更新');

  const oldValues = project.toJSON();
  const updateData = filterProjectPayload({ ...draft.payload, user_id: user.id }, project);
  const [affected] = await Project.update(updateData, {
    where: { id: project.id, updated_at: oldValues.updated_at },
    individualHooks: false,
  });
  if (affected === 0) throw new Error('数据已被他人修改，请重新生成草稿');
  await project.reload();

  await ProjectUpdateLog.create({
    project_id: project.id,
    update_date: moment().format('YYYY-MM-DD'),
    progress_content: draft.payload.weekly_progress || oldValues.weekly_progress || '',
    status: draft.payload.status || oldValues.status,
    progress_pct: draft.payload.progress_pct !== undefined ? draft.payload.progress_pct : oldValues.progress_pct,
    risk_desc: draft.payload.risk_desc !== undefined ? draft.payload.risk_desc : oldValues.risk_desc || '',
    next_action: draft.payload.next_action || '',
    created_by: user.id,
  });

  await logAudit('projects', project.id, 'update', operatorFromUser(user), oldValues, project.toJSON());
  await AgentOperationEffect.create({
    draft_id: draft.id,
    table_name: 'projects',
    record_id: project.id,
    action: 'update',
    old_values: oldValues,
    new_values: project.toJSON(),
  });
  return project;
}

async function executeActionCreate(draft, user) {
  const payload = draft.payload || {};
  const item = await ActionItem.create({
    title: String(payload.title || 'Agent 创建的行动项').slice(0, 200),
    description: payload.description ? String(payload.description).slice(0, 2000) : null,
    owner_id: payload.owner_id || user.id,
    priority: ['low', 'medium', 'high', 'urgent'].includes(payload.priority) ? payload.priority : 'medium',
    status: 'pending',
    due_date: payload.due_date || null,
    source_type: 'agent',
    source_id: draft.id,
    created_by_ai: true,
    confirmed_by_user: true,
    created_by: user.id,
    updated_by: user.id,
  });
  await logAudit('action_items', item.id, 'create', operatorFromUser(user), null, item.toJSON());
  await AgentOperationEffect.create({ draft_id: draft.id, table_name: 'action_items', record_id: item.id, action: 'create', old_values: null, new_values: item.toJSON() });
  return item;
}

async function executeRiskCreate(draft, user) {
  const payload = draft.payload || {};
  const risk = await RiskRegister.create({
    title: String(payload.title || 'Agent 记录的风险').slice(0, 200),
    description: payload.description ? String(payload.description).slice(0, 2000) : null,
    risk_level: ['low', 'medium', 'high', 'critical'].includes(payload.risk_level) ? payload.risk_level : 'medium',
    risk_type: payload.risk_type || null,
    impact: payload.impact || null,
    probability: ['low', 'medium', 'high'].includes(payload.probability) ? payload.probability : 'medium',
    mitigation_plan: payload.mitigation_plan || null,
    owner_id: payload.owner_id || user.id,
    project_id: draft.target_type === 'project' ? draft.target_id : (payload.project_id || null),
    status: 'open',
    detected_by: 'agent',
    source_type: 'agent',
    source_id: draft.id,
    created_by: user.id,
    updated_by: user.id,
  });
  await logAudit('risk_register', risk.id, 'create', operatorFromUser(user), null, risk.toJSON());
  await AgentOperationEffect.create({ draft_id: draft.id, table_name: 'risk_register', record_id: risk.id, action: 'create', old_values: null, new_values: risk.toJSON() });
  return risk;
}

async function executeDraft(draft, user) {
  if (draft.status !== 'pending') throw new Error('草稿状态不可执行');
  if (new Date(draft.expires_at).getTime() < Date.now()) {
    await draft.update({ status: 'expired' });
    throw new Error('草稿已过期，请重新输入');
  }

  let result;
  if (draft.operation_type === 'project.quick_update') result = await executeProjectQuickUpdate(draft, user);
  else if (draft.operation_type === 'action_item.create') result = await executeActionCreate(draft, user);
  else if (draft.operation_type === 'risk_register.create') result = await executeRiskCreate(draft, user);
  else throw new Error('不支持的 Agent 操作');

  await draft.update({ status: 'executed', executed_at: new Date() });
  return result;
}

module.exports = { executeDraft, canModifyProject, filterProjectPayload };
