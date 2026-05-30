const { Project, ActionItem, RiskRegister, AgentOperationEffect } = require('../models');
const { logAudit } = require('./auditLogService');

const RESTORE_PROJECT_FIELDS = ['progress_pct', 'status', 'weekly_progress', 'next_week_focus', 'risk_desc', 'next_action', 'block_reason', 'updater_id'];

function operatorFromUser(user) {
  return { id: user.id, name: user.name || user.username };
}

async function revertEffect(effect, user) {
  if (effect.reverted_at) throw new Error('该影响已撤销，不能重复撤销');

  if (effect.table_name === 'projects' && effect.action === 'update') {
    const project = await Project.findByPk(effect.record_id);
    if (!project) throw new Error('项目不存在，无法撤销');
    const oldValues = effect.old_values || {};
    const restore = {};
    RESTORE_PROJECT_FIELDS.forEach(f => {
      if (oldValues[f] !== undefined) restore[f] = oldValues[f];
    });
    const before = project.toJSON();
    await project.update(restore);
    await logAudit('projects', project.id, 'update', operatorFromUser(user), before, project.toJSON());
  } else if (effect.table_name === 'action_items' && effect.action === 'create') {
    const item = await ActionItem.findByPk(effect.record_id);
    if (item) {
      const before = item.toJSON();
      await item.update({ status: 'cancelled', updated_by: user.id });
      await logAudit('action_items', item.id, 'delete', operatorFromUser(user), before, item.toJSON());
    }
  } else if (effect.table_name === 'risk_register' && effect.action === 'create') {
    const risk = await RiskRegister.findByPk(effect.record_id);
    if (risk) {
      const before = risk.toJSON();
      await risk.update({ status: 'closed', updated_by: user.id, resolved_at: new Date() });
      await logAudit('risk_register', risk.id, 'delete', operatorFromUser(user), before, risk.toJSON());
    }
  } else {
    throw new Error('暂不支持撤销该类型操作');
  }

  await effect.update({ reverted_at: new Date(), reverted_by: user.id });
  return effect;
}

async function revertDraft(draft, user) {
  const effects = await AgentOperationEffect.findAll({ where: { draft_id: draft.id } });
  if (!effects.length) throw new Error('没有可撤销的执行记录');
  for (const effect of effects) {
    await revertEffect(effect, user);
  }
  await draft.update({ status: 'reverted' });
  return effects;
}

module.exports = { revertDraft, revertEffect };
