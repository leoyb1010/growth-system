/**
 * 闭环规则引擎
 * 检查承诺追踪、重复拖延、闭环完整性
 */

/**
 * 检查项目闭环完整性
 * @param {Object} project - 项目对象
 * @returns {Object} { closureGaps, isComplete }
 */
function checkClosureCompleteness(project) {
  const gaps = [];

  // 缺下一步动作
  if (!project.next_action && project.status !== '完成' && project.status !== '未启动') {
    gaps.push({ type: 'missing_action', severity: 'medium', desc: '缺下一步动作' });
  }

  // 缺动作负责人
  if (project.next_action && !project.action_owner_user_id && project.status !== '完成') {
    gaps.push({ type: 'missing_action_owner', severity: 'medium', desc: '有下一步动作但缺负责人' });
  }

  // 缺动作截止日
  if (project.next_action && !project.action_due_date && project.status !== '完成') {
    gaps.push({ type: 'missing_due_date', severity: 'low', desc: '下一步动作缺截止日' });
  }

  // 需要决策但无决策人
  if (project.decision_needed && !project.decision_owner_user_id) {
    gaps.push({ type: 'missing_decision_owner', severity: 'high', desc: '需要决策但无决策人' });
  }

  // 状态风险但无风险描述
  if ((project.status === '风险' || project.status === '阻塞中') && !project.risk_desc) {
    gaps.push({ type: 'missing_risk_desc', severity: 'high', desc: `${project.status}状态但无风险说明` });
  }

  return { closureGaps: gaps, isComplete: gaps.length === 0 };
}

/**
 * 检查未闭环事项（基于更新日志）
 * @param {Array} updateLogs - 项目更新日志列表（按日期倒序）
 * @returns {Array} 未闭环事项列表
 */
function checkUnclosedPromises(updateLogs) {
  if (!updateLogs || updateLogs.length < 2) return [];

  const unclosed = [];
  const ACTION_PATTERNS = /(?:下周|计划|预计|准备|将|要|会|待|需要|必须)[^\s,，。；;]+/g;

  // 取倒数第二条（上周）的next_action作为"承诺"
  const lastWeek = updateLogs[1]; // 假设按日期倒序
  const thisWeek = updateLogs[0];

  if (lastWeek && lastWeek.next_action) {
    const promises = lastWeek.next_action.split(/[;；\n]/).map(s => s.trim()).filter(Boolean);
    if (promises.length > 0) {
      // 检查本周进展是否提到了这些承诺的完成
      const thisWeekContent = (thisWeek?.progress_content || '') + (thisWeek?.next_action || '');
      const unfulfilled = promises.filter(p => {
        // 简单关键词匹配：如果本周内容包含承诺的关键词，视为已推进
        const keywords = p.replace(/^(下周|计划|预计|准备|将|要|会|待|需要|必须)\s*/, '').substring(0, 10);
        return keywords && !thisWeekContent.includes(keywords);
      });
      if (unfulfilled.length > 0) {
        unclosed.push({
          type: 'unfulfilled_promise',
          promises: unfulfilled,
          from: lastWeek.update_date,
          severity: 'medium'
        });
      }
    }
  }

  return unclosed;
}

/**
 * 检测重复拖延（同类事项连续出现）
 * @param {Array} updateLogs - 更新日志
 * @returns {Array} 重复拖延事项
 */
function detectRepeatedDelays(updateLogs) {
  if (!updateLogs || updateLogs.length < 2) return [];
  const repeated = [];

  // 检查连续两条日志中相同的next_action
  for (let i = 0; i < updateLogs.length - 1; i++) {
    const curr = updateLogs[i];
    const prev = updateLogs[i + 1];
    if (curr.next_action && prev.next_action) {
      const currActions = curr.next_action.split(/[;；\n]/).map(s => s.trim()).filter(Boolean);
      const prevActions = prev.next_action.split(/[;；\n]/).map(s => s.trim()).filter(Boolean);

      currActions.forEach(ca => {
        const match = prevActions.find(pa => {
          const kw = ca.substring(0, Math.min(8, ca.length));
          return pa.includes(kw) && kw.length >= 3;
        });
        if (match) {
          repeated.push({
            type: 'repeated_action',
            action: ca,
            dates: [prev.update_date, curr.update_date],
            severity: 'high',
            desc: `连续两周出现类似动作："${ca.substring(0, 20)}"`
          });
        }
      });
    }
  }

  return repeated;
}

/**
 * 综合闭环检查
 * @param {Array} projects - 项目列表
 * @param {Object} updateLogsMap - { [projectId]: [logs] }
 * @returns {Object} { unclosedItems, repeatedDelays, closureGaps }
 */
function comprehensiveClosureCheck(projects, updateLogsMap) {
  const unclosedItems = [];
  const repeatedDelays = [];
  const closureGaps = [];

  projects.forEach(p => {
    // 闭环完整性检查
    const { closureGaps: gaps } = checkClosureCompleteness(p);
    if (gaps.length > 0) {
      closureGaps.push({ project: p.name, projectId: p.id, gaps });
    }

    // 基于更新日志的闭环检查
    const logs = updateLogsMap[p.id] || [];
    const unclosed = checkUnclosedPromises(logs);
    if (unclosed.length > 0) {
      unclosedItems.push({ project: p.name, projectId: p.id, items: unclosed });
    }

    // 重复拖延检测
    const repeated = detectRepeatedDelays(logs);
    if (repeated.length > 0) {
      repeatedDelays.push({ project: p.name, projectId: p.id, items: repeated });
    }
  });

  return { unclosedItems, repeatedDelays, closureGaps };
}

module.exports = {
  checkClosureCompleteness,
  checkUnclosedPromises,
  detectRepeatedDelays,
  comprehensiveClosureCheck
};
