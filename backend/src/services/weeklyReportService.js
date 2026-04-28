const { Kpi, Project, Performance, MonthlyTask, Achievement, WeeklyReport, Department } = require('../models');
const moment = require('moment');
const { Op } = require('sequelize');
const { sendWeeklyReportToFeishu } = require('./feishuService');
const { getQuarterTimeProgress, getProgressStatus } = require('../utils/timeProgress');

// ===== 数值格式化工具 =====

/**
 * 按单位类型格式化数值（仅影响展示，不改变数据库值）
 * - 万元/元/百分比/个/人/次 → 取整
 * - 其他 → 保留2位小数
 */
function fmtNum(value, unit) {
  const n = parseFloat(value) || 0;
  const intUnits = ['万元', '元', '百分比', '%', '个', '人', '次', '万'];
  if (intUnits.includes(unit)) return Math.round(n);
  return parseFloat(n.toFixed(2));
}

/**
 * 清洗单位显示：百分比 → %
 */
function displayUnit(unit) {
  if (unit === '百分比') return '%';
  return unit || '';
}

/**
 * 生成周报数据
 * @param {Date} weekStart - 本周开始日期
 * @param {Date} weekEnd - 本周结束日期
 */
async function generateWeeklyReportData(weekStart, weekEnd, deptFilter = null, isAdmin = true) {
  const weekStartStr = moment(weekStart).format('YYYY-MM-DD');
  const weekEndStr = moment(weekEnd).format('YYYY-MM-DD');
  const lastWeekStart = moment(weekStart).subtract(7, 'days').format('YYYY-MM-DD');
  const lastWeekEnd = moment(weekEnd).subtract(7, 'days').format('YYYY-MM-DD');

  const currentQuarter = moment(weekStart).quarter();
  const currentYear = moment(weekStart).year();
  const quarterLabel = `Q${currentQuarter}`;

  // 预加载部门映射表，避免硬编码 dept_id → dept_name
  const allDepartments = await Department.findAll({ attributes: ['id', 'name', 'type'] });
  const deptMap = {};
  allDepartments.forEach(d => { deptMap[d.id] = d.name; });

  // 袁博组权限隔离：非 admin 排除 type=manager 的部门数据
  const managerDeptIds = allDepartments.filter(d => d.type === 'manager').map(d => d.id);
  const excludeDeptIds = isAdmin ? [] : managerDeptIds;

  // 1. 本周数据摘要（对比上周）
  const kpiWhere = { quarter: quarterLabel };
  if (deptFilter) kpiWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) kpiWhere.dept_id = { [Op.notIn]: excludeDeptIds };
  const currentKpis = await Kpi.findAll({
    where: kpiWhere
  });

  const kpiSummary = currentKpis.map(kpi => {
    const rate = kpi.target > 0 ? parseFloat(((kpi.actual / kpi.target) * 100).toFixed(0)) : 0;
    const dUnit = displayUnit(kpi.unit);
    return {
      dept_id: kpi.dept_id,
      dept_name: deptMap[kpi.dept_id] || '未知部门',
      indicator: kpi.indicator_name,
      target: fmtNum(kpi.target, kpi.unit),
      actual: fmtNum(kpi.actual, kpi.unit),
      completion_rate: rate,
      unit: dUnit
    };
  });

  // KPI 分层分组：Row1 部门级 GMV+利润，Row2 各组 GMV，Row3 其他业务指标
  const gmvKpis = kpiSummary.filter(k => k.indicator === 'GMV');
  const profitKpis = kpiSummary.filter(k => ['利润', '净利润'].includes(k.indicator));
  const otherKpis = kpiSummary.filter(k => !['GMV', '利润', '净利润'].includes(k.indicator));

  // 计算部门汇总 GMV 和利润
  const totalGmvTarget = gmvKpis.reduce((s, k) => s + (k.target || 0), 0);
  const totalGmvActual = gmvKpis.reduce((s, k) => s + (k.actual || 0), 0);
  const totalGmvRate = totalGmvTarget > 0 ? Math.round((totalGmvActual / totalGmvTarget) * 100) : 0;

  const totalProfitTarget = profitKpis.reduce((s, k) => s + (k.target || 0), 0);
  const totalProfitActual = profitKpis.reduce((s, k) => s + (k.actual || 0), 0);
  const totalProfitRate = totalProfitTarget > 0 ? Math.round((totalProfitActual / totalProfitTarget) * 100) : 0;

  const kpiSummaryGrouped = {
    time_progress: Math.round(getQuarterTimeProgress(quarterLabel, currentYear)),
    row1: [
      { label: '部门 GMV', rate: totalGmvRate, target: totalGmvTarget, actual: totalGmvActual, unit: '万元', indicator: 'GMV' },
      { label: '部门利润', rate: totalProfitRate, target: totalProfitTarget, actual: totalProfitActual, unit: '万元', indicator: '利润' },
    ].filter(item => item.target > 0 || item.actual > 0),
    row2: gmvKpis.map(k => ({ label: `${k.dept_name} GMV`, ...k })),
    row3: otherKpis.map(k => ({ label: `${k.dept_name} · ${k.indicator}`, ...k })),
  };

  // 2. 重点工作进展（本周有更新的项目）
  const projectWhere = {
    updated_at: { [Op.between]: [weekStart, weekEnd] }
  };
  if (deptFilter) projectWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) projectWhere.dept_id = { [Op.notIn]: excludeDeptIds };
  const updatedProjects = await Project.findAll({
    where: projectWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['updated_at', 'DESC']]
  });

  // 按部门排序：袁博(3) → 拓展(1) → 运营(2)
  const deptOrder = { 3: 0, 1: 1, 2: 2 };
  const sortByDept = (a, b) => (deptOrder[a.dept_id] ?? 99) - (deptOrder[b.dept_id] ?? 99);

  const projectProgress = updatedProjects.map(p => ({
    id: p.id,
    dept_id: p.dept_id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    weekly_progress: p.weekly_progress,
    progress_pct: p.progress_pct,
    status: p.status,
    updated_at: moment(p.updated_at).format('YYYY-MM-DD HH:mm')
  })).sort(sortByDept);

  // 3. 风险与预警
  // 修复：除了 status='风险'，也包含有风险描述的项目
  const riskWhere = {
    [Op.or]: [
      { status: '风险' },
      { risk_desc: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }, { [Op.ne]: '暂无' }] } }
    ]
  };
  if (deptFilter) riskWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) riskWhere.dept_id = { [Op.notIn]: excludeDeptIds };
  const riskProjects = await Project.findAll({
    where: riskWhere,
    include: [{ model: Department, attributes: ['name'] }]
  });

  const riskList = riskProjects.map(p => ({
    id: p.id,
    dept_id: p.dept_id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    risk_desc: p.risk_desc,
    progress_pct: p.progress_pct
  })).sort(sortByDept);

  // 严重预警指标 — 优先从 KPI 数据提取，降级到 Performance 表
  let severeWarnings = [];

  // 优先从 KPI 数据中提取完成率低于时间进度的指标
  const currentTimeProgress = getQuarterTimeProgress(quarterLabel, currentYear);
  kpiSummary.forEach(k => {
    if (k.completion_rate < currentTimeProgress * 0.7 && k.completion_rate < 60) {
      severeWarnings.push({
        dept_id: k.dept_id,
        dept_name: k.dept_name,
        business_type: '-',
        indicator: k.indicator,
        completion_rate: k.completion_rate,
        gap: Math.round(k.target - k.actual),
        source: 'KPI'
      });
    }
  });

  // 降级：Performance 表有数据时补充
  if (severeWarnings.length === 0) {
    const perfWhere = {};
    if (deptFilter) perfWhere.dept_id = deptFilter;
    else if (excludeDeptIds.length) perfWhere.dept_id = { [Op.notIn]: excludeDeptIds };
    const performances = await Performance.findAll({
      where: perfWhere,
      include: [{ model: Department, attributes: ['name'] }]
    });
    performances.forEach(p => {
      const totalTarget = parseFloat(p.q1_target) + parseFloat(p.q2_target) + parseFloat(p.q3_target) + parseFloat(p.q4_target);
      const totalActual = parseFloat(p.q1_actual) + parseFloat(p.q2_actual) + parseFloat(p.q3_actual) + parseFloat(p.q4_actual);
      if (totalTarget > 0) {
        const rate = (totalActual / totalTarget) * 100;
        if (rate < 60) {
          severeWarnings.push({
            dept_id: p.dept_id,
            dept_name: p.Department?.name || '',
            business_type: p.business_type,
            indicator: p.indicator,
            completion_rate: Math.round(rate),
            gap: Math.round(totalTarget - totalActual),
            source: 'Performance'
          });
        }
      }
    });
  }

  // 4. 下周重点工作（基于项目填写的 next_week_focus 字段，而非 due_date 时间）
  const focusWhere = {
    next_week_focus: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
  };
  if (deptFilter) focusWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) focusWhere.dept_id = { [Op.notIn]: excludeDeptIds };
  const focusProjects = await Project.findAll({
    where: focusWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['updated_at', 'DESC']]
  });

  // 本周关注：高优先级项目 + 需决策项目 + 风险项目（管理层关注焦点）
  const attentionWhere = {
    [Op.or]: [
      { priority: '高' },
      { decision_needed: true },
      { status: '风险' },
    ]
  };
  if (deptFilter) attentionWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) attentionWhere.dept_id = { [Op.notIn]: excludeDeptIds };
  const attentionProjects = await Project.findAll({
    where: attentionWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['updated_at', 'DESC']]
  });

  const weekAttention = attentionProjects.map(p => ({
    id: p.id,
    dept_id: p.dept_id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    status: p.status,
    priority: p.priority,
    decision_needed: p.decision_needed,
    risk_desc: p.risk_desc,
    progress_pct: p.progress_pct,
    next_action: p.next_action,
  })).sort(sortByDept);

  const nextWeekKeyWork = focusProjects.map(p => ({
    id: p.id,
    dept_id: p.dept_id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    next_week_focus: p.next_week_focus,
    progress_pct: p.progress_pct,
    status: p.status
  })).sort(sortByDept);

  // D表下月跟进非空事项
  const currentMonth = moment(weekStart).format('YYYY-MM');
  const taskWhere = {
    month: currentMonth,
    next_month_plan: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
  };
  if (deptFilter) taskWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) taskWhere.dept_id = { [Op.notIn]: excludeDeptIds };
  const followUpTasks = await MonthlyTask.findAll({
    where: taskWhere,
    include: [{ model: Department, attributes: ['name'] }]
  });

  const followUps = followUpTasks.map(t => ({
    id: t.id,
    dept_id: t.dept_id,
    dept_name: t.Department?.name || '',
    task: t.task,
    owner_name: t.owner_name,
    next_month_plan: t.next_month_plan
  }));

  // 5. 新增成果
  const achievementWhere = {
    created_at: { [Op.between]: [weekStart, weekEnd] }
  };
  if (deptFilter) achievementWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) achievementWhere.dept_id = { [Op.notIn]: excludeDeptIds };
  const newAchievements = await Achievement.findAll({
    where: achievementWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['created_at', 'DESC']]
  });

  const achievementList = newAchievements.map(a => ({
    id: a.id,
    dept_id: a.dept_id,
    dept_name: a.Department?.name || '',
    project_name: a.project_name,
    owner_name: a.owner_name,
    achievement_type: a.achievement_type,
    quantified_result: a.quantified_result,
    priority: a.priority
  }));

  return {
    week_start: weekStartStr,
    week_end: weekEndStr,
    generated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
    // ===== 新增：本周结论（规则驱动） =====
    week_conclusion: generateWeekConclusion(kpiSummary, riskList, severeWarnings, updatedProjects),
    // ===== 新增：关键变化 =====
    key_changes: extractKeyChanges(kpiSummary, updatedProjects, riskList),
    summary: {
      kpi_summary: kpiSummary,
      total_updated_projects: updatedProjects.length,
      total_risk_projects: riskProjects.length,
      total_severe_warnings: severeWarnings.length,
      total_next_week_key_work: focusProjects.length,
      total_new_achievements: newAchievements.length
    },
    kpi_summary: kpiSummary,
    kpi_summary_grouped: kpiSummaryGrouped,
    project_progress: projectProgress,
    risk_and_warnings: {
      risk_projects: riskList,
      severe_warnings: severeWarnings
    },
    next_week_key_work: nextWeekKeyWork,
    week_attention: weekAttention,
    new_achievements: achievementList
  };
}

/**
 * 规则驱动生成周报结论
 */
function generateWeekConclusion(kpiSummary, riskList, severeWarnings, updatedProjects) {
  const conclusions = [];
  
  // 1. 整体完成率判断（基于时间进度）
  const totalTarget = kpiSummary.reduce((s, k) => s + parseFloat(k.target || 0), 0);
  const totalActual = kpiSummary.reduce((s, k) => s + parseFloat(k.actual || 0), 0);
  const totalRate = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  const timeProgress = getQuarterTimeProgress(currentQuarter, currentYear);
  const overallStatus = getProgressStatus(totalRate, timeProgress);

  if (overallStatus === 'ahead') {
    conclusions.push(`整体完成率${totalRate.toFixed(0)}%，超过时间进度（${timeProgress.toFixed(0)}%），进度良好。`);
  } else if (overallStatus === 'on_track') {
    conclusions.push(`整体完成率${totalRate.toFixed(0)}%，与时间进度（${timeProgress.toFixed(0)}%）基本持平，需持续保持。`);
  } else {
    conclusions.push(`整体完成率${totalRate.toFixed(0)}%，低于时间进度（${timeProgress.toFixed(0)}%），需重点关注和加速追赶。`);
  }

  // 2. 落后于时间进度的指标
  const lowKpis = kpiSummary.filter(k => {
    const status = getProgressStatus(k.completion_rate, timeProgress);
    return status === 'behind';
  });
  if (lowKpis.length > 0) {
    const worst = lowKpis.sort((a, b) => a.completion_rate - b.completion_rate)[0];
    conclusions.push(`${worst.dept_name}${worst.indicator}完成率最低（${worst.completion_rate}%），偏差最大。`);
  }

  // 3. 风险项
  if (riskList.length > 0) {
    conclusions.push(`当前有${riskList.length}个风险项目需关注。`);
  }

  // 4. 严重预警
  if (severeWarnings.length > 0) {
    conclusions.push(`${severeWarnings.length}项业务线指标严重预警。`);
  }

  // 5. 本周活跃度
  if (updatedProjects.length === 0) {
    conclusions.push('本周无项目更新，请各负责人及时录入进展。');
  }

  return conclusions.join('；').replace(/。；/g, '；');
}

/**
 * 提取关键变化（基于时间进度判断，非硬阈值）
 */
function extractKeyChanges(kpiSummary, updatedProjects, riskList) {
  const changes = [];

  // 计算当前时间进度
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  const timeProgress = getQuarterTimeProgress(currentQuarter, currentYear);

  // 状态变更 -> 风险的项目
  riskList.forEach(p => {
    changes.push({ type: 'risk', text: `${p.dept_name}·${p.name} 状态变为风险` });
  });

  // 进度有推进的项目
  updatedProjects.forEach(p => {
    if (p.progress_pct >= 80) {
      changes.push({ type: 'progress', text: `${p.name} 进度达${p.progress_pct}%` });
    }
  });

  // KPI 偏差（基于时间进度判断，而非硬阈值60%）
  kpiSummary.forEach(k => {
    const status = getProgressStatus(k.completion_rate, timeProgress);
    if (status === 'behind') {
      // 落后于时间进度才标记为偏差
      changes.push({ type: 'deviation', text: `${k.dept_name}·${k.indicator} 完成率${k.completion_rate}%（低于时间进度${timeProgress.toFixed(0)}%）` });
    } else if (status === 'ahead') {
      // 超前于时间进度
      changes.push({ type: 'achieved', text: `${k.dept_name}·${k.indicator} 完成率${k.completion_rate}%（超前时间进度）` });
    }
    // on_track 的不列入关键变化，避免噪音
  });

  return changes;
}

module.exports = { generateWeeklyReportData };
