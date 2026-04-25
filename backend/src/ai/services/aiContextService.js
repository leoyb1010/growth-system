/**
 * AI 上下文组装服务
 * 根据当前页面+用户权限，自动拉取并组装上下文数据
 * 计算衍生信号，不传原始数据给 LLM
 */

const { Project, Kpi, ProjectUpdateLog, Performance, WeeklyReport, Department, User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment');
const { getQuarterTimeProgress, getProgressStatus } = require('../../utils/timeProgress');
const { detectRiskKeywords, analyzeOwnerLoad } = require('../utils/riskRules');
const { checkClosureCompleteness, comprehensiveClosureCheck } = require('../utils/closureRules');

/**
 * 主入口：组装 AI 上下文
 * @param {Object} options
 * @param {string} options.currentPage - dashboard / week / kpis / projects / weekly_reports / project_detail
 * @param {Object} options.currentObject - { projectId, weekRange, ... }
 * @param {Object} options.currentUser - { id, role, deptId, dataScopeType, dataScopeValue }
 * @returns {Promise<Object>} { pageData, derivedSignals, currentPage, currentObject, currentUser }
 */
async function assembleContext(options) {
  const { currentPage, currentObject = {}, currentUser = {} } = options;

  try {
    // 构建数据范围过滤
    const scopeWhere = buildScopeWhere(currentUser);

    // 根据页面拉取不同数据
    const pageData = await fetchPageData(currentPage, currentObject, scopeWhere, currentUser);

    // 计算衍生信号
    const derivedSignals = await computeDerivedSignals(pageData, currentObject);

    return {
      pageData,
      derivedSignals,
      currentPage,
      currentObject,
      currentUser: {
        id: currentUser.id,
        role: currentUser.role,
        deptId: currentUser.deptId
      }
    };
  } catch (err) {
    console.error('[AI] assembleContext 失败，降级为空上下文:', err.message);
    // 降级：返回空上下文，让 AI 服务用 Mock 结果
    return {
      pageData: { projects: [], kpis: [], updateLogs: [] },
      derivedSignals: { projectSignals: [], kpiSignals: [], closureGaps: [], ownerLoads: {}, quarterTimeProgress: 0 },
      currentPage,
      currentObject,
      currentUser: { id: currentUser.id, role: currentUser.role, deptId: currentUser.deptId }
    };
  }
}

/**
 * 构建数据范围过滤条件
 */
function buildScopeWhere(user) {
  const where = {};
  if (!user) return where;

  const { dataScopeType, dataScopeValue, deptId } = user;
  switch (dataScopeType) {
    case 'all':
      break;
    case 'department':
      where.dept_id = deptId;
      break;
    case 'self':
      where.dept_id = deptId;
      where[Op.or] = [
        { owner_user_id: user.id },
        { creator_id: user.id }
      ];
      break;
    default:
      where.dept_id = deptId;
  }
  return where;
}

/**
 * 根据页面拉取数据
 */
async function fetchPageData(page, object, scopeWhere, user) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  const currentYear = now.getFullYear();

  const data = {};

  // 所有页面都需要项目数据
  data.projects = await Project.findAll({
    where: { quarter: currentQuarter, year: currentYear, ...scopeWhere },
    include: [{ model: Department, attributes: ['id', 'name'] }],
    order: [['updated_at', 'DESC']],
    raw: true,
    nest: true
  });

  // 所有页面都需要KPI数据
  data.kpis = await Kpi.findAll({
    where: { quarter: currentQuarter, year: currentYear, ...scopeWhere },
    include: [{ model: Department, attributes: ['id', 'name'] }],
    raw: true,
    nest: true
  });

  // 拉取项目的更新日志（最近7天）
  const projectIds = data.projects.map(p => p.id);
  if (projectIds.length > 0) {
    const sevenDaysAgo = moment().subtract(7, 'days').format('YYYY-MM-DD');
    data.updateLogs = await ProjectUpdateLog.findAll({
      where: {
        project_id: { [Op.in]: projectIds },
        update_date: { [Op.gte]: sevenDaysAgo }
      },
      order: [['update_date', 'DESC']],
      raw: true
    });
  } else {
    data.updateLogs = [];
  }

  // 页面特有数据
  switch (page) {
    case 'dashboard':
      // Dashboard 需要业绩数据
      data.performances = await Performance.findAll({
        where: { ...scopeWhere },
        raw: true
      });
      break;

    case 'week':
      // 本周页面需要下周重点
      data.nextWeekFocus = data.projects
        .filter(p => p.next_week_focus)
        .map(p => ({ projectId: p.id, name: p.name, focus: p.next_week_focus }));
      break;

    case 'project_detail':
      // 项目详情需要单项目完整日志
      if (object.projectId) {
        data.updateLogs = await ProjectUpdateLog.findAll({
          where: { project_id: object.projectId },
          order: [['update_date', 'DESC']],
          limit: 30,
          raw: true
        });
        // 单项目详情
        const detail = data.projects.find(p => p.id === parseInt(object.projectId));
        if (detail) data.projectDetail = detail;
      }
      break;

    case 'weekly_reports':
      // 周报页面需要最新周报
      const latestReport = await WeeklyReport.findOne({
        order: [['generated_at', 'DESC']],
        raw: true
      });
      data.latestReport = latestReport;
      break;
  }

  // 序列化项目数据（处理 Sequelize raw 结果）
  data.projects = data.projects.map(p => ({
    ...p,
    progress_pct: p.progress_pct || 0,
    target: p.target ? parseFloat(p.target) : 0,
    actual: p.actual ? parseFloat(p.actual) : 0,
  }));

  data.kpis = data.kpis.map(k => ({
    ...k,
    target: parseFloat(k.target) || 0,
    actual: parseFloat(k.actual) || 0,
  }));

  return data;
}

/**
 * 计算衍生信号
 */
async function computeDerivedSignals(pageData, currentObject) {
  const now = moment();
  const month = now.month() + 1;
  const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  const currentYear = now.year();
  const quarterTimeProgress = getQuarterTimeProgress(currentQuarter, currentYear);

  const signals = {
    projectSignals: [],
    kpiSignals: [],
    closureGaps: [],
    ownerLoads: {},
    quarterTimeProgress
  };

  // 项目信号计算
  const updateLogsMap = {};
  (pageData.updateLogs || []).forEach(log => {
    if (!updateLogsMap[log.project_id]) updateLogsMap[log.project_id] = [];
    updateLogsMap[log.project_id].push(log);
  });

  pageData.projects.forEach(p => {
    // staleDays
    const safeMoment = (v) => {
      if (!v) return null;
      try {
        // 处理带毫秒+时区的格式如 "2026-04-24 03:22:49.625 +00:00"
        const normalized = String(v).replace(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\.(\d+)\s*(\+\d{2}:\d{2})/, '$1T$2.$3$4');
        const m = moment(normalized);
        return m.isValid() ? m : null;
      } catch (e) {
        return null;
      }
    };
    const lastUpdate = p.updated_at && safeMoment(p.updated_at)?.isValid() ? safeMoment(p.updated_at) : null;
    const staleDays = lastUpdate ? now.diff(lastUpdate, 'days') : 999;

    // dueInDays
    const dueDate = p.due_date && safeMoment(p.due_date)?.isValid() ? safeMoment(p.due_date) : null;
    const dueInDays = dueDate ? dueDate.diff(now, 'days') : null;

    // progressRisk
    const progressRisk = p.progress_pct !== undefined
      ? getProgressStatus(p.progress_pct, quarterTimeProgress)
      : 'on_track';

    // textualRiskSignals
    const textContent = [p.weekly_progress, p.risk_desc, p.next_action, p.next_week_focus].filter(Boolean).join(' ');
    const textualRiskSignals = detectRiskKeywords(textContent);

    // 风险评估
    const derivedData = { staleDays, dueInDays, progressRisk, textualRiskSignals };
    const { evaluateProjectRisk } = require('../utils/riskRules');
    const riskResult = evaluateProjectRisk(p, derivedData);

    signals.projectSignals.push({
      projectId: p.id,
      name: p.name,
      staleDays,
      dueInDays,
      progressRisk,
      textualRiskSignals,
      riskLevel: riskResult.riskLevel,
      riskSources: riskResult.riskSources
    });

    // 闭环完整性
    const { closureGaps } = checkClosureCompleteness(p);
    if (closureGaps.length > 0) {
      signals.closureGaps.push({
        projectId: p.id,
        project: p.name,
        gaps: closureGaps
      });
    }
  });

  // KPI 信号计算
  pageData.kpis.forEach(k => {
    const completionRate = k.target > 0 ? (k.actual / k.target * 100) : 0;
    const gap = k.target - k.actual;
    signals.kpiSignals.push({
      id: k.id,
      name: k.indicator_name,
      target: k.target,
      actual: k.actual,
      completionRate: parseFloat(completionRate.toFixed(1)),
      gap: parseFloat(gap.toFixed(2)),
      isWarning: completionRate < quarterTimeProgress - 15
    });
  });

  // 负责人负载
  signals.ownerLoads = analyzeOwnerLoad(pageData.projects);

  return signals;
}

module.exports = {
  assembleContext,
  buildScopeWhere,
  fetchPageData,
  computeDerivedSignals
};
