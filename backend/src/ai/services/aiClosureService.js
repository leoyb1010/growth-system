/**
 * 闭环检查服务
 */

const { comprehensiveClosureCheck } = require('../utils/closureRules');
const { formatAIResponse } = require('../utils/aiFormatters');

/**
 * 执行闭环检查
 * @param {Object} context - AI 上下文
 * @returns {Object} 格式化的闭环检查结果
 */
async function check(context) {
  const projects = context.pageData.projects || [];
  const updateLogsMap = {};

  (context.pageData.updateLogs || []).forEach(log => {
    if (!updateLogsMap[log.project_id]) updateLogsMap[log.project_id] = [];
    updateLogsMap[log.project_id].push(log);
  });

  const result = comprehensiveClosureCheck(projects, updateLogsMap);

  const unclosedCount = result.unclosedItems.length;
  const repeatedCount = result.repeatedDelays.length;
  const gapCount = result.closureGaps.length;

  const headline = unclosedCount > 0 || repeatedCount > 0 || gapCount > 0
    ? `发现 ${unclosedCount} 个未闭环、${repeatedCount} 个重复拖延、${gapCount} 个闭环缺口`
    : '闭环检查通过，所有事项推进正常';

  const cards = [];

  result.unclosedItems.forEach(item => {
    cards.push({
      type: 'warning',
      title: `未闭环：${item.project}`,
      description: item.items.map(i => `- ${i.promises?.join('、') || i.desc || ''}`).join('\n'),
      icon: '🔄',
      tags: ['未闭环'],
      meta: { projectId: item.projectId }
    });
  });

  result.repeatedDelays.forEach(item => {
    cards.push({
      type: 'danger',
      title: `重复拖延：${item.project}`,
      description: item.items.map(i => `- ${i.desc || i.action}`).join('\n'),
      icon: '🔁',
      tags: ['拖延'],
      meta: { projectId: item.projectId }
    });
  });

  result.closureGaps.forEach(g => {
    cards.push({
      type: 'info',
      title: `闭环缺口：${g.project}`,
      description: g.gaps.map(gap => `- ${gap.desc}`).join('\n'),
      icon: '📋',
      tags: ['缺口'],
      meta: { projectId: g.projectId }
    });
  });

  if (cards.length === 0) {
    cards.push({
      type: 'success',
      title: '闭环检查通过',
      description: '所有项目闭环完整，无未完成承诺',
      icon: '✅',
      tags: []
    });
  }

  return formatAIResponse({
    headline,
    mode: 'risk_closure',
    badgeCount: unclosedCount + repeatedCount + gapCount,
    cards,
    actions: [
      { key: 'fill_gaps', label: '补全闭环信息', mode: 'risk_closure' },
      { key: 'push_stale', label: '催更未更新项目', mode: 'risk_closure' },
    ]
  });
}

module.exports = { check };
