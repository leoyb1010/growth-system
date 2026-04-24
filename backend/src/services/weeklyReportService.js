const { Kpi, Project, Performance, MonthlyTask, Achievement, WeeklyReport, Department } = require('../models');
const moment = require('moment');
const { Op } = require('sequelize');
const { sendWeeklyReportToFeishu } = require('./feishuService');
const { getQuarterTimeProgress, getProgressStatus } = require('../utils/timeProgress');

/**
 * 生成周报数据
 * @param {Date} weekStart - 本周开始日期
 * @param {Date} weekEnd - 本周结束日期
 */
async function generateWeeklyReportData(weekStart, weekEnd, deptFilter = null) {
  const weekStartStr = moment(weekStart).format('YYYY-MM-DD');
  const weekEndStr = moment(weekEnd).format('YYYY-MM-DD');
  const lastWeekStart = moment(weekStart).subtract(7, 'days').format('YYYY-MM-DD');
  const lastWeekEnd = moment(weekEnd).subtract(7, 'days').format('YYYY-MM-DD');

  const currentQuarter = moment(weekStart).quarter();
  const quarterLabel = `Q${currentQuarter}`;

  // 1. 本周数据摘要（对比上周）
  const kpiWhere = { quarter: quarterLabel };
  if (deptFilter) kpiWhere.dept_id = deptFilter;
  const currentKpis = await Kpi.findAll({
    where: kpiWhere
  });

  const kpiSummary = currentKpis.map(kpi => {
    const rate = kpi.target > 0 ? parseFloat(((kpi.actual / kpi.target) * 100).toFixed(2)) : 0;
    return {
      dept_name: kpi.dept_id === 1 ? '拓展组' : '运营组',
      indicator: kpi.indicator_name,
      target: kpi.target,
      actual: kpi.actual,
      completion_rate: rate,
      unit: kpi.unit
    };
  });

  // 2. 重点工作进展（本周有更新的项目）
  const projectWhere = {
    updated_at: { [Op.between]: [weekStart, weekEnd] }
  };
  if (deptFilter) projectWhere.dept_id = deptFilter;
  const updatedProjects = await Project.findAll({
    where: projectWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['updated_at', 'DESC']]
  });

  const projectProgress = updatedProjects.map(p => ({
    id: p.id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    weekly_progress: p.weekly_progress,
    progress_pct: p.progress_pct,
    status: p.status,
    updated_at: moment(p.updated_at).format('YYYY-MM-DD HH:mm')
  }));

  // 3. 风险与预警
  const riskWhere = { status: '风险' };
  if (deptFilter) riskWhere.dept_id = deptFilter;
  const riskProjects = await Project.findAll({
    where: riskWhere,
    include: [{ model: Department, attributes: ['name'] }]
  });

  const riskList = riskProjects.map(p => ({
    id: p.id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    risk_desc: p.risk_desc,
    progress_pct: p.progress_pct
  }));

  // 严重预警指标
  const perfWhere = {};
  if (deptFilter) perfWhere.dept_id = deptFilter;
  const performances = await Performance.findAll({
    where: perfWhere,
    include: [{ model: Department, attributes: ['name'] }]
  });

  const severeWarnings = [];
  performances.forEach(p => {
    const totalTarget = parseFloat(p.q1_target) + parseFloat(p.q2_target) + parseFloat(p.q3_target) + parseFloat(p.q4_target);
    const totalActual = parseFloat(p.q1_actual) + parseFloat(p.q2_actual) + parseFloat(p.q3_actual) + parseFloat(p.q4_actual);
    if (totalTarget > 0) {
      const rate = (totalActual / totalTarget) * 100;
      if (rate < 60) {
        severeWarnings.push({
          dept_name: p.Department?.name || '',
          business_type: p.business_type,
          indicator: p.indicator,
          completion_rate: parseFloat(rate.toFixed(2)),
          gap: parseFloat((totalTarget - totalActual).toFixed(2))
        });
      }
    }
  });

  // 4. 下周重点工作（基于项目填写的 next_week_focus 字段，而非 due_date 时间）
  const focusWhere = {
    next_week_focus: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
  };
  if (deptFilter) focusWhere.dept_id = deptFilter;
  const focusProjects = await Project.findAll({
    where: focusWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['updated_at', 'DESC']]
  });

  const nextWeekKeyWork = focusProjects.map(p => ({
    id: p.id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    next_week_focus: p.next_week_focus,
    progress_pct: p.progress_pct,
    status: p.status
  }));

  // D表下月跟进非空事项
  const currentMonth = moment(weekStart).format('YYYY-MM');
  const taskWhere = {
    month: currentMonth,
    next_month_plan: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
  };
  if (deptFilter) taskWhere.dept_id = deptFilter;
  const followUpTasks = await MonthlyTask.findAll({
    where: taskWhere,
    include: [{ model: Department, attributes: ['name'] }]
  });

  const followUps = followUpTasks.map(t => ({
    id: t.id,
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
  const newAchievements = await Achievement.findAll({
    where: achievementWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['created_at', 'DESC']]
  });

  const achievementList = newAchievements.map(a => ({
    id: a.id,
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
    project_progress: projectProgress,
    risk_and_warnings: {
      risk_projects: riskList,
      severe_warnings: severeWarnings
    },
    next_week_key_work: nextWeekKeyWork,
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

  return conclusions.join(' ');
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
