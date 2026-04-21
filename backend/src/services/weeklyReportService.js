const { Kpi, Project, Performance, MonthlyTask, Achievement, WeeklyReport, Department } = require('../models');
const moment = require('moment');
const { Op } = require('sequelize');
const { sendWeeklyReportToFeishu } = require('./feishuService');

/**
 * 生成周报数据
 * @param {Date} weekStart - 本周开始日期
 * @param {Date} weekEnd - 本周结束日期
 */
async function generateWeeklyReportData(weekStart, weekEnd) {
  const weekStartStr = moment(weekStart).format('YYYY-MM-DD');
  const weekEndStr = moment(weekEnd).format('YYYY-MM-DD');
  const lastWeekStart = moment(weekStart).subtract(7, 'days').format('YYYY-MM-DD');
  const lastWeekEnd = moment(weekEnd).subtract(7, 'days').format('YYYY-MM-DD');

  const currentQuarter = moment(weekStart).quarter();
  const quarterLabel = `Q${currentQuarter}`;

  // 1. 本周数据摘要（对比上周）
  const currentKpis = await Kpi.findAll({
    where: { quarter: quarterLabel }
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
  const updatedProjects = await Project.findAll({
    where: {
      updated_at: { [Op.between]: [weekStart, weekEnd] }
    },
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
  const riskProjects = await Project.findAll({
    where: { status: '风险' },
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
  const performances = await Performance.findAll({
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

  // 4. 下周焦点
  const nextWeekStart = moment(weekEnd).add(1, 'days').format('YYYY-MM-DD');
  const nextWeekEnd = moment(weekEnd).add(7, 'days').format('YYYY-MM-DD');

  const upcomingProjects = await Project.findAll({
    where: {
      due_date: { [Op.between]: [nextWeekStart, nextWeekEnd] },
      status: { [Op.ne]: '完成' }
    },
    include: [{ model: Department, attributes: ['name'] }]
  });

  const nextWeekFocus = upcomingProjects.map(p => ({
    id: p.id,
    dept_name: p.Department?.name || '',
    name: p.name,
    owner_name: p.owner_name,
    due_date: p.due_date,
    progress_pct: p.progress_pct
  }));

  // D表下月跟进非空事项
  const currentMonth = moment(weekStart).format('YYYY-MM');
  const followUpTasks = await MonthlyTask.findAll({
    where: {
      month: currentMonth,
      next_month_plan: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    },
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
  const newAchievements = await Achievement.findAll({
    where: {
      created_at: { [Op.between]: [weekStart, weekEnd] }
    },
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
    summary: {
      kpi_summary: kpiSummary,
      total_updated_projects: updatedProjects.length,
      total_risk_projects: riskProjects.length,
      total_severe_warnings: severeWarnings.length,
      total_upcoming: upcomingProjects.length,
      total_new_achievements: newAchievements.length
    },
    kpi_summary: kpiSummary,
    project_progress: projectProgress,
    risk_and_warnings: {
      risk_projects: riskList,
      severe_warnings: severeWarnings
    },
    next_week_focus: {
      upcoming_projects: nextWeekFocus,
      follow_up_items: followUps
    },
    new_achievements: achievementList
  };
}

module.exports = { generateWeeklyReportData };
