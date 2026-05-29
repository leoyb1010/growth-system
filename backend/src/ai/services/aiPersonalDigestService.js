const moment = require('moment');
const { Op } = require('sequelize');
const {
  AiUserDigest,
  AiUserDigestItem,
  Project,
  Kpi,
  ActionItem,
  RiskRegister,
} = require('../../models');
const aiContextService = require('./aiContextService');
const llmProvider = require('./aiLLMProvider');
const { createCacheKey, getCached, setCached, TASK_CACHE_TTL } = require('../../services/aiCacheService');

function isEnabled() {
  return process.env.AI_SIDE_CAR_ENABLED === 'true' && process.env.AI_PERSONAL_DIGEST_ENABLED === 'true';
}

async function generateForUser(currentUser) {
  if (!isEnabled()) {
    return { enabled: false, summary: 'AI 个人提醒未开启', items: [] };
  }

  const today = moment().format('YYYY-MM-DD');
  const cacheKey = createCacheKey('personal_digest', {
    userId: currentUser.id,
    date: today,
    role: currentUser.role,
    deptId: currentUser.deptId,
  });
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const context = await aiContextService.assembleContext({
    currentPage: 'dashboard',
    currentObject: {},
    currentUser,
  });

  const ruleItems = await buildRuleItems(context, currentUser);
  const polished = await polishItems(ruleItems, currentUser);
  const items = Array.isArray(polished?.items) && polished.items.length > 0 ? normalizeItems(polished.items, ruleItems) : ruleItems;
  const summary = polished?.summary || buildSummary(items);
  const result = {
    enabled: true,
    digest_date: today,
    summary,
    risk_count: items.filter(i => i.type === 'project_risk').length,
    action_count: items.filter(i => i.type === 'action_item' || i.type === 'closure').length,
    kpi_count: items.filter(i => i.type === 'kpi').length,
    items,
    generated_by: polished ? 'ai' : 'rule',
  };

  await persistDigest(currentUser.id, result);
  await setCached(cacheKey, 'personal_digest', result, TASK_CACHE_TTL.personal_digest);
  return result;
}

async function buildRuleItems(context, currentUser) {
  const items = [];
  const projectMap = new Map((context.pageData.projects || []).map(p => [p.id, p]));

  (context.derivedSignals.projectSignals || []).forEach(signal => {
    const project = projectMap.get(signal.projectId) || {};
    if (signal.riskLevel === 'high' || signal.riskLevel === 'medium') {
      items.push({
        type: 'project_risk',
        title: project.name || signal.name,
        description: signal.riskSources?.map(r => r.desc).join('；') || '项目存在风险信号',
        priority: signal.riskLevel === 'high' ? 'high' : 'medium',
        source_type: 'project',
        source_id: signal.projectId,
        suggested_action: project.next_action || '补充风险原因和下一步动作',
        due_date: project.due_date || null,
      });
    }

    if (signal.staleDays >= 3) {
      items.push({
        type: 'project_progress',
        title: project.name || signal.name,
        description: `已${signal.staleDays}天未更新进展`,
        priority: signal.staleDays >= 7 ? 'high' : 'medium',
        source_type: 'project',
        source_id: signal.projectId,
        suggested_action: '更新本周进展、风险和下一步动作',
        due_date: null,
      });
    }
  });

  (context.derivedSignals.kpiSignals || []).filter(k => k.isWarning).forEach(kpi => {
    items.push({
      type: 'kpi',
      title: kpi.name,
      description: `完成率${kpi.completionRate}%，低于季度时间进度`,
      priority: kpi.completionRate < 50 ? 'high' : 'medium',
      source_type: 'kpi',
      source_id: kpi.id,
      suggested_action: '补充偏差原因和追赶动作',
      due_date: null,
    });
  });

  (context.derivedSignals.closureGaps || []).slice(0, 8).forEach(gap => {
    items.push({
      type: 'closure',
      title: gap.project,
      description: gap.gaps.map(g => g.desc).join('；'),
      priority: 'medium',
      source_type: 'project',
      source_id: gap.projectId,
      suggested_action: '补齐闭环字段或明确责任人/截止日',
      due_date: null,
    });
  });

  const dueLimit = moment().add(3, 'days').format('YYYY-MM-DD');
  const actions = await ActionItem.findAll({
    where: {
      owner_id: currentUser.id,
      status: { [Op.in]: ['pending', 'in_progress'] },
      due_date: { [Op.lte]: dueLimit },
    },
    raw: true,
    limit: 10,
  });
  actions.forEach(action => {
    items.push({
      type: 'action_item',
      title: action.title,
      description: action.due_date ? `截止日 ${action.due_date}` : '待办未设置截止日',
      priority: action.priority || 'medium',
      source_type: 'action_item',
      source_id: action.id,
      suggested_action: '推进并更新待办状态',
      due_date: action.due_date || null,
    });
  });

  return items.slice(0, 20);
}

async function polishItems(ruleItems, currentUser) {
  if (!llmProvider.isAvailable() || ruleItems.length === 0) return null;

  try {
    return await llmProvider.chatJSON({
      systemPrompt: '你是增长业务个人提醒助手。只基于输入提醒做去重、排序和改写，不新增事实。',
      prompt: `请把以下提醒压缩成最多8条，输出 JSON：{"summary":"一句话摘要","items":[{"type":"原type","title":"标题","description":"50字内描述","priority":"low|medium|high|urgent","source_type":"原source_type","source_id":原source_id,"suggested_action":"建议动作","due_date":"原due_date或null"}]}

${JSON.stringify(ruleItems)}`,
      user: currentUser,
      taskType: 'personal_digest',
      fallback: null,
      maxTokens: 900,
    });
  } catch (err) {
    console.error('AI 个人提醒润色失败:', err.message);
    return null;
  }
}

function normalizeItems(aiItems, fallbackItems) {
  const fallbackBySource = new Map(fallbackItems.map(i => [`${i.source_type}:${i.source_id}:${i.type}`, i]));
  return aiItems.slice(0, 8).map(item => {
    const fallback = fallbackBySource.get(`${item.source_type}:${item.source_id}:${item.type}`) || {};
    return {
      type: item.type || fallback.type || 'project_progress',
      title: String(item.title || fallback.title || '').slice(0, 200),
      description: String(item.description || fallback.description || '').slice(0, 1000),
      priority: ['low', 'medium', 'high', 'urgent'].includes(item.priority) ? item.priority : (fallback.priority || 'medium'),
      source_type: item.source_type || fallback.source_type || null,
      source_id: item.source_id || fallback.source_id || null,
      suggested_action: item.suggested_action || fallback.suggested_action || '',
      due_date: item.due_date || fallback.due_date || null,
    };
  }).filter(i => i.title);
}

function buildSummary(items) {
  if (items.length === 0) return '今天暂无必须处理的 AI 提醒';
  const high = items.filter(i => i.priority === 'high' || i.priority === 'urgent').length;
  return `今天有${items.length}条提醒，其中${high}条高优先级`;
}

async function persistDigest(userId, digestResult) {
  const digest = await AiUserDigest.create({
    user_id: userId,
    digest_date: digestResult.digest_date,
    summary: digestResult.summary,
    risk_count: digestResult.risk_count,
    action_count: digestResult.action_count,
    kpi_count: digestResult.kpi_count,
    status: 'draft',
    generated_by: digestResult.generated_by,
  });

  if (digestResult.items.length > 0) {
    await AiUserDigestItem.bulkCreate(digestResult.items.map(item => ({
      digest_id: digest.id,
      user_id: userId,
      type: item.type,
      title: item.title,
      description: item.description,
      priority: item.priority,
      source_type: item.source_type,
      source_id: item.source_id,
      suggested_action: item.suggested_action,
      due_date: item.due_date,
      is_read: false,
    })));
  }
}

module.exports = { generateForUser, isEnabled };
