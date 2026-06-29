const { Kpi, Project, Performance, MonthlyTask, Achievement, WeeklyReport, Department, ProjectUpdateLog } = require('../models');
const moment = require('moment');
const { Op } = require('sequelize');
const { sendWeeklyReportToFeishu } = require('./feishuService');
const { getQuarterTimeProgress, getProgressStatus } = require('../utils/timeProgress');
const asoDashboardService = require('./asoDashboardService');
const cpsDashboardService = require('./cpsDashboardService');

// ===== 业务常量 =====
// 部门排序优先级（数字越小越靠前）
const DEPT_SORT_ORDER = { 3: 0, 1: 1, 2: 2 };
// 严重预警阈值
const SEVERE_WARNING_TIME_RATIO = 0.7;   // 完成率低于时间进度此比例视为严重
const SEVERE_WARNING_MAX_RATE = 60;      // 完成率低于此百分比视为严重
// 项目进度达成阈值
const PROJECT_HIGH_PROGRESS_PCT = 80;    // 进度达80%视为高进度

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

function round(value, digits = 0) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

function deltaValue(current, compare, digits = 0) {
  return round(Number(current || 0) - Number(compare || 0), digits);
}

function deltaRate(current, compare) {
  return round((Number(current || 0) - Number(compare || 0)) * 100, 2);
}

function normalizeAsoSummary(dashboard) {
  const s = dashboard?.summary || {};
  return {
    optimized_keywords: Number(s.optimized_keywords) || 0,
    t1_keywords: Number(s.t1_2_keywords) || 0,
    t3_keywords: Number(s.t3_keywords) || 0,
    t3_rate: Number(s.t3_rate) || 0,
    t1_rate: Number(s.t1_2_rate) || 0,
    total_volume: Number(s.total_volume) || 0,
    total_cost: round(s.total_cost, 2),
  };
}

function normalizeCpsSummary(dashboard) {
  const p = dashboard?.period || {};
  return {
    actual_amount: round(p.actual_amount, 2),
    actual_count: Number(p.actual_count) || 0,
    effective_amount: round(p.effective_amount, 2),
    effective_count: Number(p.effective_count) || 0,
    new_sign: Number(p.new_sign) || 0,
    renewal: Number(p.renewal) || 0,
    refund_count: (Number(p.new_refund) || 0) + (Number(p.renewal_refund) || 0),
    after_sale_refund: Number(p.after_sale_refund) || 0,
    refund_rate: Number(p.refund_rate) || 0,
    complaint_rate: Number(p.complaint_rate) || 0,
    complaints: Number(p.complaints) || 0,
    alert_count: Number(dashboard?.alert_count) || 0,
  };
}

function normalizeCpsDayOverDay(dashboard) {
  const d = dashboard?.day_over_day || {};
  const toPct = value => (value == null ? null : round(Number(value) * 100, 2));
  return {
    current_date: d.current_date || null,
    compare_date: d.compare_date || null,
    actual_amount: round(d.actual_amount, 2),
    actual_count: Number(d.actual_count) || 0,
    refund_count: Number(d.refund_count) || 0,
    actual_amount_delta: round(d.actual_amount_delta, 2),
    actual_amount_delta_pct: toPct(d.actual_amount_delta_pct),
    actual_count_delta: Number(d.actual_count_delta) || 0,
    actual_count_delta_pct: toPct(d.actual_count_delta_pct),
    refund_count_delta: Number(d.refund_count_delta) || 0,
    refund_count_delta_pct: toPct(d.refund_count_delta_pct),
  };
}

function emptyKeywordChanges() {
  return { new_t1: [], new_t3: [], lost_t1: [], lost_t3: [] };
}

async function buildBusinessSummary(weekStartStr, weekEndStr, options = {}) {
  const prevWeekStart = moment(weekStartStr).subtract(7, 'days').format('YYYY-MM-DD');
  const prevWeekEnd = moment(weekEndStr).subtract(7, 'days').format('YYYY-MM-DD');
  const businessSummary = {};

  if (options.includeAso) {
    try {
      const [currentAso, compareAso] = await Promise.all([
        asoDashboardService.getDashboard({ start_date: weekStartStr, end_date: weekEndStr }),
        asoDashboardService.getDashboard({ start_date: prevWeekStart, end_date: prevWeekEnd }),
      ]);
      const current = normalizeAsoSummary(currentAso);
      const compare = normalizeAsoSummary(compareAso);
      const trend = Array.isArray(currentAso?.trend) ? currentAso.trend : [];
      businessSummary.aso = {
        enabled: true,
        period: { start: weekStartStr, end: weekEndStr },
        has_data: trend.length > 0 || current.optimized_keywords > 0 || current.total_volume > 0,
        current,
        compare,
        delta: {
          optimized_keywords: deltaValue(current.optimized_keywords, compare.optimized_keywords),
          t1_keywords: deltaValue(current.t1_keywords, compare.t1_keywords),
          t3_keywords: deltaValue(current.t3_keywords, compare.t3_keywords),
          total_volume: deltaValue(current.total_volume, compare.total_volume),
          total_cost: deltaValue(current.total_cost, compare.total_cost, 2),
          t3_rate_pt: deltaRate(current.t3_rate, compare.t3_rate),
        },
        trend_7d: trend.map(item => ({
          date: item.date,
          t3_keywords: Number(item.t3_keywords) || 0,
          total_volume: Number(item.total_volume) || 0,
          avg_rank: item.avg_rank,
        })),
        keyword_changes: currentAso?.keyword_changes || emptyKeywordChanges(),
      };
    } catch (err) {
      console.error('周报 ASO 数据聚合失败:', err);
      businessSummary.aso = { enabled: true, has_data: false, error: 'ASO 数据读取失败' };
    }
  } else {
    businessSummary.aso = { enabled: false, has_data: false, reason: '当前账号无 ASO 查看权限' };
  }

  if (options.includeCps) {
    try {
      const cpsBaseQuery = options.cpsChannelId ? { channel_ids: String(options.cpsChannelId) } : {};
      const [currentCps, compareCps] = await Promise.all([
        cpsDashboardService.getDashboard({ ...cpsBaseQuery, start_date: weekStartStr, end_date: weekEndStr, granularity: 'day' }),
        cpsDashboardService.getDashboard({ ...cpsBaseQuery, start_date: prevWeekStart, end_date: prevWeekEnd, granularity: 'day' }),
      ]);
      const current = normalizeCpsSummary(currentCps);
      const compare = normalizeCpsSummary(compareCps);
      const trend = Array.isArray(currentCps?.trend) ? currentCps.trend : [];
      businessSummary.cps = {
        enabled: true,
        period: { start: weekStartStr, end: weekEndStr },
        has_data: trend.length > 0 || current.actual_amount > 0 || current.actual_count > 0,
        current,
        compare,
        delta: {
          actual_amount: deltaValue(current.actual_amount, compare.actual_amount, 2),
          actual_count: deltaValue(current.actual_count, compare.actual_count),
          effective_amount: deltaValue(current.effective_amount, compare.effective_amount, 2),
          new_sign: deltaValue(current.new_sign, compare.new_sign),
          renewal: deltaValue(current.renewal, compare.renewal),
          refund_count: deltaValue(current.refund_count, compare.refund_count),
          complaints: deltaValue(current.complaints, compare.complaints),
        },
        trend_7d: trend.map(item => ({
          date: item.date,
          amount: round(item.amount, 2),
          count: Number(item.count) || 0,
          new_sign: Number(item.new_sign) || 0,
          renewal: Number(item.renewal) || 0,
          refund: Number(item.refund) || 0,
          complaints: Number(item.complaints) || 0,
        })),
        top_channels: currentCps?.top_channels || [],
        day_over_day: normalizeCpsDayOverDay(currentCps),
        alerts: {
          alert_count: Number(currentCps?.alert_count) || 0,
        },
      };
    } catch (err) {
      console.error('周报 CPS 数据聚合失败:', err);
      businessSummary.cps = { enabled: true, has_data: false, error: 'CPS 投流数据读取失败' };
    }
  } else {
    businessSummary.cps = { enabled: false, has_data: false, reason: '当前账号无 CPS 查看权限' };
  }

  return businessSummary;
}

/**
 * 生成周报数据
 * @param {Date} weekStart - 本周开始日期
 * @param {Date} weekEnd - 本周结束日期
 */
async function generateWeeklyReportData(weekStart, weekEnd, deptFilter = null, isAdmin = true, options = {}) {
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
  // 仅汇总行「GMV」进入部门GMV合计与各组GMV，拆分行(私域/学习会员等)归入 Row3，避免重复计入
  const gmvKpis = kpiSummary.filter(k => k.indicator === 'GMV');
  const profitKpis = kpiSummary.filter(k => k.indicator.includes('利润'));
  const otherKpis = kpiSummary.filter(k => k.indicator !== 'GMV' && !k.indicator.includes('利润'));

  // 计算部门汇总 GMV 和利润
  const totalGmvTarget = gmvKpis.reduce((s, k) => s + (k.target || 0), 0);
  const totalGmvActual = gmvKpis.reduce((s, k) => s + (k.actual || 0), 0);
  const totalGmvRate = totalGmvTarget > 0 ? Math.round((totalGmvActual / totalGmvTarget) * 100) : 0;

  const totalProfitTarget = profitKpis.reduce((s, k) => s + (k.target || 0), 0);
  const totalProfitActual = profitKpis.reduce((s, k) => s + (k.actual || 0), 0);
  const totalProfitRate = totalProfitTarget > 0 ? Math.round((totalProfitActual / totalProfitTarget) * 100) : 0;

  const reportTimeProgress = Math.round(getQuarterTimeProgress(quarterLabel, currentYear));
  const kpiSummaryGrouped = {
    time_progress: reportTimeProgress,
    row1: [
      { label: '部门 GMV', rate: totalGmvRate, target: totalGmvTarget, actual: totalGmvActual, unit: '万元', indicator: 'GMV' },
      { label: '部门利润', rate: totalProfitRate, target: totalProfitTarget, actual: totalProfitActual, unit: '万元', indicator: '利润' },
    ].filter(item => item.target > 0 || item.actual > 0),
    row2: gmvKpis.map(k => ({ label: `${k.dept_name} GMV`, ...k })),
    row3: otherKpis.map(k => ({ label: `${k.dept_name} · ${k.indicator}`, ...k })),
  };

  // 按部门排序：袁博(3) → 拓展(1) → 运营(2)
  const sortByDept = (a, b) => (DEPT_SORT_ORDER[a.dept_id] ?? 99) - (DEPT_SORT_ORDER[b.dept_id] ?? 99);

  // 2. 重点工作进展
  // 优先按项目更新日志归属到周报周期，避免周一编辑 next_week_focus 覆盖 Project.updated_at 后丢失上周进展。
  const projectScopeWhere = {};
  if (deptFilter) projectScopeWhere.dept_id = deptFilter;
  else if (excludeDeptIds.length) projectScopeWhere.dept_id = { [Op.notIn]: excludeDeptIds };

  const updateLogs = await ProjectUpdateLog.findAll({
    where: {
      update_date: { [Op.between]: [weekStartStr, weekEndStr] },
      progress_content: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    },
    include: [{
      model: Project,
      required: true,
      where: projectScopeWhere,
      include: [{ model: Department, attributes: ['name'] }]
    }],
    order: [['update_date', 'DESC'], ['created_at', 'DESC']]
  });

  const projectProgressById = new Map();
  updateLogs.forEach(log => {
    const p = log.Project;
    if (!p || projectProgressById.has(p.id)) return;
    projectProgressById.set(p.id, {
      id: p.id,
      dept_id: p.dept_id,
      dept_name: p.Department?.name || '',
      name: p.name,
      owner_name: p.owner_name,
      weekly_progress: log.progress_content || p.weekly_progress,
      progress_pct: log.progress_pct ?? p.progress_pct,
      status: log.status || p.status,
      updated_at: moment(log.update_date).format('YYYY-MM-DD')
    });
  });

  const fallbackWhere = {
    ...projectScopeWhere,
    updated_at: { [Op.between]: [weekStart, weekEnd] },
    weekly_progress: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
  };
  const loggedProjectIds = Array.from(projectProgressById.keys());
  if (loggedProjectIds.length) fallbackWhere.id = { [Op.notIn]: loggedProjectIds };
  const fallbackProjects = await Project.findAll({
    where: fallbackWhere,
    include: [{ model: Department, attributes: ['name'] }],
    order: [['updated_at', 'DESC']]
  });

  fallbackProjects.forEach(p => {
    projectProgressById.set(p.id, {
      id: p.id,
      dept_id: p.dept_id,
      dept_name: p.Department?.name || '',
      name: p.name,
      owner_name: p.owner_name,
      weekly_progress: p.weekly_progress,
      progress_pct: p.progress_pct,
      status: p.status,
      updated_at: moment(p.updated_at).format('YYYY-MM-DD HH:mm')
    });
  });

  const projectProgress = Array.from(projectProgressById.values()).sort(sortByDept);

  // 3. 风险与预警
  // 风险项目：只认 status='风险'（risk_desc 是风险备注，不是风险声明）
  const riskWhere = {
    status: '风险'
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
    if (k.completion_rate < currentTimeProgress * SEVERE_WARNING_TIME_RATIO && k.completion_rate < SEVERE_WARNING_MAX_RATE) {
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
      const totalTarget = (parseFloat(p.q1_target) || 0) + (parseFloat(p.q2_target) || 0) + (parseFloat(p.q3_target) || 0) + (parseFloat(p.q4_target) || 0);
      const totalActual = (parseFloat(p.q1_actual) || 0) + (parseFloat(p.q2_actual) || 0) + (parseFloat(p.q3_actual) || 0) + (parseFloat(p.q4_actual) || 0);
      if (totalTarget !== 0) {
        const rate = (totalActual / totalTarget) * 100;
        if (rate < SEVERE_WARNING_MAX_RATE) {
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

  const businessSummary = await buildBusinessSummary(weekStartStr, weekEndStr, options);

  return {
    week_start: weekStartStr,
    week_end: weekEndStr,
    generated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
    // ===== 新增：本周结论（规则驱动） =====
    week_conclusion: generateWeekConclusion(kpiSummary, riskList, severeWarnings, projectProgress, reportTimeProgress, businessSummary),
    // ===== 新增：关键变化 =====
    key_changes: extractKeyChanges(kpiSummary, projectProgress, riskList, reportTimeProgress, businessSummary),
    summary: {
      kpi_summary: kpiSummary,
      total_updated_projects: projectProgress.length,
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
    new_achievements: achievementList,
    business_summary: businessSummary,
    aso_summary: businessSummary.aso,
    cps_summary: businessSummary.cps,
  };
}

/**
 * 规则驱动生成周报结论
 */
function generateWeekConclusion(kpiSummary, riskList, severeWarnings, updatedProjects, timeProgress, businessSummary = {}) {
  const conclusions = [];
  
  // 1. 整体完成率判断（基于时间进度）
  const totalTarget = kpiSummary.reduce((s, k) => s + parseFloat(k.target || 0), 0);
  const totalActual = kpiSummary.reduce((s, k) => s + parseFloat(k.actual || 0), 0);
  const totalRate = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;
  
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

  const aso = businessSummary.aso;
  if (aso?.enabled && aso.has_data && Math.abs(aso.delta?.t3_keywords || 0) > 0) {
    const direction = aso.delta.t3_keywords > 0 ? '增加' : '减少';
    conclusions.push(`ASO 到榜 T3 关键词较上周${direction}${Math.abs(aso.delta.t3_keywords)}个。`);
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
function extractKeyChanges(kpiSummary, updatedProjects, riskList, timeProgress, businessSummary = {}) {
  const changes = [];

  // 状态变更 -> 风险的项目
  riskList.forEach(p => {
    changes.push({ type: 'risk', text: `${p.dept_name}·${p.name} 状态变为风险` });
  });

  // 进度有推进的项目
  updatedProjects.forEach(p => {
    if (p.progress_pct >= PROJECT_HIGH_PROGRESS_PCT) {
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

  const cps = businessSummary.cps;
  if (cps?.enabled && cps.has_data) {
    if (Math.abs(cps.delta?.actual_amount || 0) > 0) {
      changes.push({
        type: cps.delta.actual_amount >= 0 ? 'progress' : 'deviation',
        text: `CPS 投流实收较上周${cps.delta.actual_amount >= 0 ? '增加' : '减少'} ${Math.abs(cps.delta.actual_amount).toFixed(0)} 元`,
      });
    }
  }

  const aso = businessSummary.aso;
  if (aso?.enabled && aso.has_data && Math.abs(aso.delta?.t3_keywords || 0) > 0) {
    changes.push({
      type: aso.delta.t3_keywords >= 0 ? 'progress' : 'deviation',
      text: `ASO 到榜 T3 关键词较上周${aso.delta.t3_keywords >= 0 ? '增加' : '减少'} ${Math.abs(aso.delta.t3_keywords)} 个`,
    });
  }

  return changes;
}

module.exports = { generateWeeklyReportData };
