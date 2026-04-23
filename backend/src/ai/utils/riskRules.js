/**
 * 风险规则引擎
 * 规则+LLM混合：规则先提炼，LLM再润色
 */

const RISK_KEYWORDS = ['等待', '延期', '协调', '未确认', '资源不足', '卡住', '阻塞', '停滞', '无法推进', '待定', '不确定', '风险'];

/**
 * 计算项目风险信号
 * @param {Object} project - 项目对象
 * @param {Object} derivedSignals - 衍生信号 { staleDays, dueInDays, progressRisk, textualRiskSignals }
 * @returns {Object} { riskLevel, riskSources }
 */
function evaluateProjectRisk(project, derivedSignals) {
  const sources = [];

  // 规则1：截止时间临近
  if (derivedSignals.dueInDays !== null) {
    if (derivedSignals.dueInDays <= 0 && project.status !== '完成') {
      sources.push({ type: 'overdue', severity: 'high', desc: `已逾期${Math.abs(derivedSignals.dueInDays)}天` });
    } else if (derivedSignals.dueInDays <= 3 && project.status !== '完成') {
      sources.push({ type: 'due_soon', severity: 'high', desc: `距截止日仅${derivedSignals.dueInDays}天` });
    } else if (derivedSignals.dueInDays <= 7 && project.status !== '完成') {
      sources.push({ type: 'due_approaching', severity: 'medium', desc: `距截止日${derivedSignals.dueInDays}天` });
    }
  }

  // 规则2：长时间未更新
  if (derivedSignals.staleDays >= 7) {
    sources.push({ type: 'stale_high', severity: 'high', desc: `已${derivedSignals.staleDays}天未更新` });
  } else if (derivedSignals.staleDays >= 3) {
    sources.push({ type: 'stale_medium', severity: 'medium', desc: `${derivedSignals.staleDays}天未更新` });
  }

  // 规则3：状态标记
  if (project.status === '风险' || project.status === '阻塞中') {
    sources.push({ type: 'status_risk', severity: 'high', desc: `项目状态：${project.status}` });
  }

  // 规则4：进度落后于时间
  if (derivedSignals.progressRisk === 'behind') {
    sources.push({ type: 'progress_behind', severity: 'high', desc: '进度严重落后于时间进度' });
  } else if (derivedSignals.progressRisk === 'on_track') {
    sources.push({ type: 'progress_warning', severity: 'medium', desc: '进度略落后于时间进度' });
  }

  // 规则5：文本风险词
  if (derivedSignals.textualRiskSignals && derivedSignals.textualRiskSignals.length > 0) {
    sources.push({
      type: 'textual_risk',
      severity: 'medium',
      desc: `文本含风险词：${derivedSignals.textualRiskSignals.join('、')}`
    });
  }

  // 规则6：高优先级但状态异常
  if (project.priority === '高' && project.status !== '完成' && project.status !== '进行中' && project.status !== '合作中') {
    sources.push({ type: 'priority_mismatch', severity: 'medium', desc: `高优先级项目状态为${project.status}` });
  }

  // 规则7：需要决策但无人负责
  if (project.decision_needed && !project.decision_owner_user_id) {
    sources.push({ type: 'decision_gap', severity: 'medium', desc: '需要决策但未指定决策人' });
  }

  // 汇总风险等级
  const hasHigh = sources.some(s => s.severity === 'high');
  const hasMedium = sources.some(s => s.severity === 'medium');
  const riskLevel = hasHigh ? 'high' : hasMedium ? 'medium' : 'low';

  return { riskLevel, riskSources: sources };
}

/**
 * 检测文本中的风险词
 */
function detectRiskKeywords(text) {
  if (!text) return [];
  return RISK_KEYWORDS.filter(kw => text.includes(kw));
}

/**
 * 负责人负载分析
 * @param {Array} projects - 项目列表
 * @returns {Object} { ownerLoads: { [ownerName]: { total, highRisk } } }
 */
function analyzeOwnerLoad(projects) {
  const loads = {};
  projects.forEach(p => {
    const owner = p.owner_name || '未知';
    if (!loads[owner]) loads[owner] = { total: 0, highRisk: 0, projects: [] };
    loads[owner].total++;
    if (p.status === '风险' || p.status === '阻塞中' || p.priority === '高') {
      loads[owner].highRisk++;
    }
    loads[owner].projects.push(p.name);
  });
  return loads;
}

module.exports = {
  evaluateProjectRisk,
  detectRiskKeywords,
  analyzeOwnerLoad,
  RISK_KEYWORDS
};
