const { Kpi, Project, Performance, Department, AuditLog, sequelize } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const moment = require('moment');
const { getQuarterTimeProgress, getYearTimeProgress, getProgressStatus, getWarningStatus, getProgressColorKey } = require('../utils/timeProgress');

/**
 * 获取仪表盘综合数据
 * GET /api/dashboard?mode=quarter|year
 */
async function getDashboard(req, res) {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
    const currentYear = now.getFullYear();

    // 数据范围过滤
    const scopeDeptId = req.deptFilter || null;
    const deptFilter = scopeDeptId ? { dept_id: scopeDeptId } : {};

    // 模式：quarter=当季, year=全年累计
    const mode = req.query.mode === 'year' ? 'year' : 'quarter';

    // ===== 空态/季度回退逻辑 =====
    // 检查当前季度是否有数据，无数据则回退到最近有数据的季度
    let effectiveQuarter = currentQuarter;
    let quarterFallback = false;
    if (mode === 'quarter') {
      const currentQuarterCount = await Project.count({ where: { quarter: currentQuarter, year: currentYear, ...deptFilter } });
      const currentKpiCount = await Kpi.count({ where: { quarter: currentQuarter, year: currentYear, ...deptFilter } });
      if (currentQuarterCount === 0 && currentKpiCount === 0) {
        // 尝试回退到最近有数据的季度
        const quarterOrder = ['Q4', 'Q3', 'Q2', 'Q1'];
        for (const q of quarterOrder) {
          if (q === currentQuarter) continue;
          const pCount = await Project.count({ where: { quarter: q, year: currentYear, ...deptFilter } });
          const kCount = await Kpi.count({ where: { quarter: q, year: currentYear, ...deptFilter } });
          if (pCount > 0 || kCount > 0) {
            effectiveQuarter = q;
            quarterFallback = true;
            break;
          }
        }
      }
    }

    // ========== 1. KPI 卡片区数据 ==========
    let kpis;
    if (mode === 'year') {
      kpis = await Kpi.findAll({
        where: { year: currentYear, ...deptFilter },
        include: [{ model: Department, attributes: ['id', 'name'] }],
        attributes: [
          'dept_id',
          'indicator_name',
          [sequelize.fn('SUM', sequelize.col('target')), 'target'],
          [sequelize.fn('SUM', sequelize.col('actual')), 'actual']
        ],
        group: ['dept_id', 'indicator_name', 'Department.id', 'Department.name']
      });
      kpis = kpis.map(k => ({
        dept_id: k.dept_id,
        indicator_name: k.indicator_name,
        target: parseFloat(k.get('target')),
        actual: parseFloat(k.get('actual'))
      }));
    } else {
      kpis = await Kpi.findAll({
        where: { quarter: effectiveQuarter, year: currentYear, ...deptFilter },
        include: [{ model: Department, attributes: ['id', 'name'] }]
      });
      kpis = kpis.map(k => ({
        dept_id: k.dept_id,
        indicator_name: k.indicator_name,
        target: parseFloat(k.target),
        actual: parseFloat(k.actual)
      }));
    }

    // 动态按部门分组 KPI，支持任意数量部门（受 deptFilter 约束）
    // ⚠️ 排除 type='manager' 的管理者部门：管理者不需要在驾驶舱显示独立的 GMV 卡片
    const deptWhere = { type: 'team' };
    if (scopeDeptId) deptWhere.id = scopeDeptId;
    const departments = await Department.findAll({ where: deptWhere, order: [['id', 'ASC']] });
    const deptKpiMap = {};
    departments.forEach(d => { deptKpiMap[d.id] = { name: d.name, gmv: null, profit: null }; });
    
    kpis.forEach(k => {
      if (!deptKpiMap[k.dept_id]) return;
      if (k.indicator_name === 'GMV') {
        deptKpiMap[k.dept_id].gmv = k;
      } else if (k.indicator_name === '净利润') {
        deptKpiMap[k.dept_id].profit = k;
      }
    });

    const calcRate = (actual, target) => target > 0 ? parseFloat(((actual / target) * 100).toFixed(2)) : 0;

    // 计算当前时间进度
    const quarterTimeProgress = getQuarterTimeProgress(effectiveQuarter, currentYear);
    const yearTimeProgress = getYearTimeProgress(currentYear);
    const activeTimeProgress = mode === 'year' ? yearTimeProgress : quarterTimeProgress;

    // 按部门生成 KPI 数据
    const deptKpiCards = departments.map(d => {
      const gmv = deptKpiMap[d.id]?.gmv;
      const profit = deptKpiMap[d.id]?.profit;
      const gmvRate = calcRate(gmv?.actual || 0, gmv?.target || 0);
      const profitRate = calcRate(profit?.actual || 0, profit?.target || 0);
      return {
        dept_id: d.id,
        dept_name: d.name,
        gmv_rate: gmvRate,
        gmv_target: gmv?.target || 0,
        gmv_actual: gmv?.actual || 0,
        gmv_status: getProgressColorKey(gmvRate, activeTimeProgress),
        profit_rate: profitRate,
        profit_target: profit?.target || 0,
        profit_actual: profit?.actual || 0,
        profit_status: getProgressColorKey(profitRate, activeTimeProgress),
      };
    });

    const totalGmvTarget = deptKpiCards.reduce((s, d) => s + d.gmv_target, 0);
    const totalGmvActual = deptKpiCards.reduce((s, d) => s + d.gmv_actual, 0);
    const totalGmvRate = calcRate(totalGmvActual, totalGmvTarget);

    const totalProfitTarget = deptKpiCards.reduce((s, d) => s + d.profit_target, 0);
    const totalProfitActual = deptKpiCards.reduce((s, d) => s + d.profit_actual, 0);
    const totalProfitRate = calcRate(totalProfitActual, totalProfitTarget);

    // 总体状态用时间进度判断
    const totalGmvStatus = getProgressColorKey(totalGmvRate, activeTimeProgress);
    const totalProfitStatus = getProgressColorKey(totalProfitRate, activeTimeProgress);

    // ========== 2. 风险项目数 ==========
    const riskProjects = await Project.count({
      where: { status: '风险', quarter: effectiveQuarter, ...deptFilter }
    });

    // ========== 3. 本周待收口事项数 ==========
    const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
    const dueThisWeekProjects = await Project.count({
      where: {
        due_date: { [Op.lte]: weekEnd },
        status: { [Op.ne]: '完成' },
        quarter: effectiveQuarter,
        ...deptFilter
      }
    });

    // ========== 4. 重点工作状态分布 ==========
    const projectStatusStats = await Project.findAll({
      where: { quarter: effectiveQuarter, ...deptFilter },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status']
    });

    // ========== 5. 业务线业绩预警分布 ==========
    const performances = await Performance.findAll({ where: deptFilter });
    const warningStats = { normal: 0, warning: 0, severe: 0 };
    const perfTimeProgress = mode === 'year' ? yearTimeProgress : quarterTimeProgress;
    performances.forEach(p => {
      const totalTarget = parseFloat(p.q1_target) + parseFloat(p.q2_target) + parseFloat(p.q3_target) + parseFloat(p.q4_target);
      const totalActual = parseFloat(p.q1_actual) + parseFloat(p.q2_actual) + parseFloat(p.q3_actual) + parseFloat(p.q4_actual);
      if (totalTarget > 0) {
        const rate = (totalActual / totalTarget) * 100;
        const status = getWarningStatus(rate, perfTimeProgress);
        if (status === '正常') warningStats.normal++;
        else if (status === '预警') warningStats.warning++;
        else warningStats.severe++;
      }
    });

    // ========== 6. 最近更新项目 Top 10 ==========
    const recentProjects = await Project.findAll({
      where: { quarter: effectiveQuarter, ...deptFilter },
      include: [{ model: Department, attributes: ['name'] }],
      order: [['updated_at', 'DESC']],
      limit: 10
    });

    // ========== 7. 即将到期项目（7天内）==========
    const nextWeek = moment().add(7, 'days').format('YYYY-MM-DD');
    const today = moment().format('YYYY-MM-DD');
    const dueSoonProjects = await Project.findAll({
      where: {
        due_date: { [Op.between]: [today, nextWeek] },
        status: { [Op.ne]: '完成' },
        ...deptFilter
      },
      include: [{ model: Department, attributes: ['name'] }],
      order: [['due_date', 'ASC']],
      limit: 10
    });

    // ========== 8. 季度对比柱状图数据 ==========
    const quarterComparison = [];
    if (mode === 'year') {
      const allKpis = await Kpi.findAll({
        where: { year: currentYear, ...deptFilter },
        attributes: ['quarter', 'dept_id', 'indicator_name', 'target', 'actual']
      });
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
        const quarterData = { quarter: q };
        departments.forEach(d => {
          const qKpi = allKpis.find(k => k.quarter === q && k.dept_id === d.id && k.indicator_name === 'GMV');
          quarterData[`dept_${d.id}_gmv_actual`] = qKpi ? parseFloat(qKpi.actual) : 0;
        });
        quarterComparison.push(quarterData);
      });
    }

    // ========== 9. 今日变化（读AuditLog）==========
    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();
    const todayChanges = await AuditLog.findAll({
      where: {
        created_at: { [Op.between]: [todayStart, todayEnd] },
        table_name: { [Op.in]: ['projects', 'kpis', 'performances', 'monthly_tasks', 'achievements'] }
      },
      order: [['created_at', 'DESC']],
      limit: 20
    });

    // 如果有部门过滤，过滤掉不属于当前部门的变更记录
    let filteredTodayChanges = todayChanges;
    if (scopeDeptId) {
      const modelMap = { projects: Project, kpis: Kpi, performances: Performance, monthly_tasks: require('../models').MonthlyTask, achievements: require('../models').Achievement };
      const validated = [];
      for (const c of todayChanges) {
        try {
          const Model = modelMap[c.table_name];
          if (Model) {
            const record = await Model.findByPk(c.record_id, { attributes: ['dept_id'] });
            if (record && record.dept_id === scopeDeptId) validated.push(c);
          }
        } catch (e) { /* 静默 */ }
      }
      filteredTodayChanges = validated;
    }

    // ========== 10. 本周关注（规则驱动）==========
    const weekFocus = [];
    // 本周需收口
    const dueThisWeek = await Project.findAll({
      where: {
        due_date: { [Op.lte]: weekEnd },
        status: { [Op.ne]: '完成' },
        quarter: effectiveQuarter,
        ...deptFilter
      },
      include: [{ model: Department, attributes: ['name'] }]
    });
    if (dueThisWeek.length > 0) {
      weekFocus.push({ type: 'due_soon', text: `${dueThisWeek.length}个项目本周到期`, count: dueThisWeek.length });
    }
    // 偏差较大指标（动态按部门检测，基于时间进度）
    deptKpiCards.forEach(d => {
      const status = getProgressStatus(d.gmv_rate, activeTimeProgress);
      if (status === 'behind') weekFocus.push({ type: 'deviation', text: `${d.dept_name}GMV完成率落后于时间进度`, count: 1 });
    });
    // 长期未更新（>3天）
    const staleDate = moment().subtract(3, 'days').toDate();
    const staleProjects = await Project.count({
      where: { updated_at: { [Op.lt]: staleDate }, status: { [Op.ne]: '完成' }, quarter: effectiveQuarter, ...deptFilter }
    });
    if (staleProjects > 0) {
      weekFocus.push({ type: 'stale', text: `${staleProjects}项重点工作超过3天未更新`, count: staleProjects });
    }

    success(res, {
      current_quarter: currentQuarter,
      effective_quarter: effectiveQuarter,
      quarter_fallback: quarterFallback,
      current_year: currentYear,
      view_mode: mode,
      time_progress: activeTimeProgress,
      kpi_cards: {
        total_gmv_rate: totalGmvRate,
        total_gmv_target: totalGmvTarget,
        total_gmv_actual: totalGmvActual,
        total_gmv_status: totalGmvStatus,
        total_profit_rate: totalProfitRate,
        total_profit_target: totalProfitTarget,
        total_profit_actual: totalProfitActual,
        total_profit_status: totalProfitStatus,
        dept_cards: deptKpiCards,
        risk_project_count: riskProjects,
        due_this_week_count: dueThisWeekProjects
      },
      quarter_comparison: quarterComparison,
      project_status_distribution: projectStatusStats.map(s => ({
        status: s.status,
        count: parseInt(s.get('count'))
      })),
      warning_distribution: warningStats,
      recent_projects: recentProjects,
      due_soon_projects: dueSoonProjects.map(p => ({
        ...p.toJSON(),
        days_until: moment(p.due_date).diff(moment(), 'days')
      })),
      today_changes: filteredTodayChanges.map(c => ({
        id: c.id,
        table_name: c.table_name,
        action: c.action,
        operator_name: c.operator_name,
        created_at: c.created_at
      })),
      week_focus: weekFocus
    });
  } catch (err) {
    console.error('获取仪表盘数据失败:', err);
    error(res, '获取仪表盘数据失败', 1, 500);
  }
}

/**
 * 获取今日数据变更
 * GET /api/dashboard/today-changes
 */
async function getTodayChanges(req, res) {
  try {
    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();
    const deptFilter = req.deptFilter || null;

    let changesWhere = {
      created_at: { [Op.between]: [todayStart, todayEnd] },
      table_name: { [Op.in]: ['projects', 'kpis', 'performances', 'monthly_tasks', 'achievements'] }
    };

    let changes = await AuditLog.findAll({
      where: changesWhere,
      order: [['created_at', 'DESC']],
      limit: 50
    });

    // 如果有部门过滤，需要根据变更记录关联的资源过滤部门
    // AuditLog 本身不含 dept_id，通过 record_id 和 table_name 关联查询
    if (deptFilter) {
      const filteredChanges = [];
      for (const c of changes) {
        let belongsToDept = false;
        try {
          if (['projects', 'kpis', 'performances', 'monthly_tasks', 'achievements'].includes(c.table_name)) {
            const models = { projects: Project, kpis: Kpi, performances: Performance, monthly_tasks: require('../models').MonthlyTask, achievements: require('../models').Achievement };
            const Model = models[c.table_name];
            if (Model) {
              const record = await Model.findByPk(c.record_id, { attributes: ['dept_id'] });
              if (record && record.dept_id === deptFilter) belongsToDept = true;
            }
          }
        } catch (e) { /* 静默 */ }
        if (belongsToDept) filteredChanges.push(c);
      }
      changes = filteredChanges;
    }

    success(res, changes.map(c => ({
      id: c.id,
      table_name: c.table_name,
      record_id: c.record_id,
      action: c.action,
      operator_name: c.operator_name,
      changed_fields: c.changed_fields,
      created_at: c.created_at
    })));
  } catch (err) {
    console.error('获取今日变更失败:', err);
    error(res, '获取今日变更失败', 1, 500);
  }
}

/**
 * 获取本周关注点
 * GET /api/dashboard/week-focus
 */
async function getWeekFocus(req, res) {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
    const currentYear = now.getFullYear();
    const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
    const staleDate = moment().subtract(3, 'days').toDate();
    const deptFilter = req.deptFilter ? { dept_id: req.deptFilter } : {};

    const focus = [];

    // 本周需收口
    const dueThisWeek = await Project.findAll({
      where: {
        due_date: { [Op.lte]: weekEnd },
        status: { [Op.ne]: '完成' },
        quarter: currentQuarter,
        ...deptFilter
      },
      include: [{ model: Department, attributes: ['name'] }],
      order: [['due_date', 'ASC']]
    });
    if (dueThisWeek.length > 0) {
      focus.push({
        type: 'due_soon',
        title: '本周需收口',
        count: dueThisWeek.length,
        items: dueThisWeek.map(p => ({ id: p.id, name: p.name, dept: p.Department?.name, due_date: p.due_date }))
      });
    }

    // 风险项目
    const riskProjects = await Project.findAll({
      where: { status: '风险', quarter: currentQuarter, ...deptFilter },
      include: [{ model: Department, attributes: ['name'] }]
    });
    if (riskProjects.length > 0) {
      focus.push({
        type: 'risk',
        title: '风险项目',
        count: riskProjects.length,
        items: riskProjects.map(p => ({ id: p.id, name: p.name, dept: p.Department?.name, owner: p.owner_name }))
      });
    }

    // 长期未更新
    const staleProjects = await Project.findAll({
      where: { updated_at: { [Op.lt]: staleDate }, status: { [Op.ne]: '完成' }, quarter: currentQuarter, ...deptFilter },
      include: [{ model: Department, attributes: ['name'] }],
      order: [['updated_at', 'ASC']]
    });
    if (staleProjects.length > 0) {
      focus.push({
        type: 'stale',
        title: '长期未更新',
        count: staleProjects.length,
        items: staleProjects.map(p => ({ id: p.id, name: p.name, dept: p.Department?.name, updated_at: p.updated_at }))
      });
    }

    // 偏差较大指标（基于时间进度）
    const kpis = await Kpi.findAll({
      where: { quarter: currentQuarter, ...deptFilter },
      include: [{ model: Department, attributes: ['name'] }]
    });
    const qTimeProgress = getQuarterTimeProgress(currentQuarter, currentYear);
    const deviations = [];
    kpis.forEach(k => {
      const rate = k.target > 0 ? (k.actual / k.target) * 100 : 0;
      const status = getProgressStatus(rate, qTimeProgress);
      if (status === 'behind') {
        deviations.push({
          dept: k.Department?.name,
          indicator: k.indicator_name,
          rate: parseFloat(rate.toFixed(2)),
          target: k.target,
          actual: k.actual,
          time_progress: qTimeProgress,
        });
      }
    });
    if (deviations.length > 0) {
      focus.push({ type: 'deviation', title: '指标偏差', count: deviations.length, items: deviations });
    }

    success(res, focus);
  } catch (err) {
    console.error('获取本周关注失败:', err);
    error(res, '获取本周关注失败', 1, 500);
  }
}

/**
 * 获取本周摘要统计
 * GET /api/dashboard/week-summary
 */
async function getWeekSummary(req, res) {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
    const weekStart = moment().startOf('isoWeek').toDate();
    const weekEnd = moment().endOf('isoWeek').toDate();
    const deptFilter = req.deptFilter ? { dept_id: req.deptFilter } : {};

    // 本周新增/更新项目数
    const updatedThisWeek = await Project.count({
      where: {
        updated_at: { [Op.between]: [weekStart, weekEnd] },
        quarter: currentQuarter,
        ...deptFilter
      }
    });

    // 本周完成项目数
    const completedThisWeek = await Project.count({
      where: {
        status: '完成',
        updated_at: { [Op.between]: [weekStart, weekEnd] },
        quarter: currentQuarter,
        ...deptFilter
      }
    });

    // 本周新增风险数
    const riskThisWeek = await Project.count({
      where: {
        status: '风险',
        updated_at: { [Op.between]: [weekStart, weekEnd] },
        quarter: currentQuarter,
        ...deptFilter
      }
    });

    success(res, {
      updated_count: updatedThisWeek,
      completed_count: completedThisWeek,
      risk_count: riskThisWeek,
      week_start: moment(weekStart).format('YYYY-MM-DD'),
      week_end: moment(weekEnd).format('YYYY-MM-DD')
    });
  } catch (err) {
    console.error('获取本周摘要失败:', err);
    error(res, '获取本周摘要失败', 1, 500);
  }
}

module.exports = { getDashboard, getTodayChanges, getWeekFocus, getWeekSummary };
