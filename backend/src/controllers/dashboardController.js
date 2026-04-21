const { Kpi, Project, Performance, Department, sequelize } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const moment = require('moment');

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

    // 模式：quarter=当季, year=全年累计
    const mode = req.query.mode === 'year' ? 'year' : 'quarter';

    // ========== 1. KPI 卡片区数据 ==========
    let kpis;
    if (mode === 'year') {
      // 全年累计：取当年所有季度，按 (dept_id, indicator_name) 聚合
      kpis = await Kpi.findAll({
        where: { year: currentYear },
        include: [{ model: Department, attributes: ['id', 'name'] }],
        attributes: [
          'dept_id',
          'indicator_name',
          [sequelize.fn('SUM', sequelize.col('target')), 'target'],
          [sequelize.fn('SUM', sequelize.col('actual')), 'actual']
        ],
        group: ['dept_id', 'indicator_name', 'Department.id', 'Department.name']
      });
      // Sequelize 聚合后 target/actual 在 dataValues 中
      kpis = kpis.map(k => ({
        dept_id: k.dept_id,
        indicator_name: k.indicator_name,
        target: parseFloat(k.get('target')),
        actual: parseFloat(k.get('actual'))
      }));
    } else {
      // 当季：只取当前季度
      kpis = await Kpi.findAll({
        where: { quarter: currentQuarter, year: currentYear },
        include: [{ model: Department, attributes: ['id', 'name'] }]
      });
      kpis = kpis.map(k => ({
        dept_id: k.dept_id,
        indicator_name: k.indicator_name,
        target: parseFloat(k.target),
        actual: parseFloat(k.actual)
      }));
    }

    // 提取各指标
    const expandGmv = kpis.find(k => k.dept_id === 1 && k.indicator_name === 'GMV');
    const opsGmv = kpis.find(k => k.dept_id === 2 && k.indicator_name === 'GMV');
    const expandProfit = kpis.find(k => k.dept_id === 1 && k.indicator_name === '净利润');
    const opsProfit = kpis.find(k => k.dept_id === 2 && k.indicator_name === '净利润');

    // 计算完成率
    const calcRate = (actual, target) => target > 0 ? parseFloat(((actual / target) * 100).toFixed(2)) : 0;

    const expandGmvRate = calcRate(expandGmv?.actual || 0, expandGmv?.target || 0);
    const opsGmvRate = calcRate(opsGmv?.actual || 0, opsGmv?.target || 0);
    const expandProfitRate = calcRate(expandProfit?.actual || 0, expandProfit?.target || 0);
    const opsProfitRate = calcRate(opsProfit?.actual || 0, opsProfit?.target || 0);

    // 部门合计
    const totalGmvTarget = (expandGmv?.target || 0) + (opsGmv?.target || 0);
    const totalGmvActual = (expandGmv?.actual || 0) + (opsGmv?.actual || 0);
    const totalGmvRate = calcRate(totalGmvActual, totalGmvTarget);

    const totalProfitTarget = (expandProfit?.target || 0) + (opsProfit?.target || 0);
    const totalProfitActual = (expandProfit?.actual || 0) + (opsProfit?.actual || 0);
    const totalProfitRate = calcRate(totalProfitActual, totalProfitTarget);

    // ========== 2. 风险项目数 ==========
    const riskProjects = await Project.count({
      where: { status: '风险', quarter: currentQuarter }
    });

    // ========== 3. 重点工作状态分布 ==========
    const projectStatusStats = await Project.findAll({
      where: { quarter: currentQuarter },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status']
    });

    // ========== 4. 业务线业绩预警分布 ==========
    const performances = await Performance.findAll();
    const warningStats = { normal: 0, warning: 0, severe: 0 };
    performances.forEach(p => {
      const totalTarget = parseFloat(p.q1_target) + parseFloat(p.q2_target) + parseFloat(p.q3_target) + parseFloat(p.q4_target);
      const totalActual = parseFloat(p.q1_actual) + parseFloat(p.q2_actual) + parseFloat(p.q3_actual) + parseFloat(p.q4_actual);
      if (totalTarget > 0) {
        const rate = (totalActual / totalTarget) * 100;
        if (rate >= 90) warningStats.normal++;
        else if (rate >= 60) warningStats.warning++;
        else warningStats.severe++;
      }
    });

    // ========== 5. 最近更新项目 Top 10 ==========
    const recentProjects = await Project.findAll({
      where: { quarter: currentQuarter },
      include: [{ model: Department, attributes: ['name'] }],
      order: [['updated_at', 'DESC']],
      limit: 10
    });

    // ========== 6. 即将到期项目（7天内）==========
    const nextWeek = moment().add(7, 'days').format('YYYY-MM-DD');
    const today = moment().format('YYYY-MM-DD');
    const dueSoonProjects = await Project.findAll({
      where: {
        due_date: { [Op.between]: [today, nextWeek] },
        status: { [Op.ne]: '完成' }
      },
      include: [{ model: Department, attributes: ['name'] }],
      order: [['due_date', 'ASC']],
      limit: 10
    });

    // ========== 7. 季度对比柱状图数据 ==========
    const quarterComparison = [];
    if (mode === 'year') {
      // 全年模式：显示各季度分解
      const allKpis = await Kpi.findAll({
        where: { year: currentYear },
        attributes: ['quarter', 'dept_id', 'indicator_name', 'target', 'actual']
      });
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
        const qExpandGmv = allKpis.find(k => k.quarter === q && k.dept_id === 1 && k.indicator_name === 'GMV');
        const qOpsGmv = allKpis.find(k => k.quarter === q && k.dept_id === 2 && k.indicator_name === 'GMV');
        quarterComparison.push({
          quarter: q,
          expand_gmv_actual: qExpandGmv ? parseFloat(qExpandGmv.actual) : 0,
          ops_gmv_actual: qOpsGmv ? parseFloat(qOpsGmv.actual) : 0
        });
      });
    }

    success(res, {
      current_quarter: currentQuarter,
      current_year: currentYear,
      view_mode: mode,
      kpi_cards: {
        // 部门总 GMV
        total_gmv_rate: totalGmvRate,
        total_gmv_target: totalGmvTarget,
        total_gmv_actual: totalGmvActual,
        // 部门总利润
        total_profit_rate: totalProfitRate,
        total_profit_target: totalProfitTarget,
        total_profit_actual: totalProfitActual,
        // 拓展组 GMV
        expand_gmv_rate: expandGmvRate,
        expand_gmv_target: expandGmv?.target || 0,
        expand_gmv_actual: expandGmv?.actual || 0,
        // 运营组 GMV
        ops_gmv_rate: opsGmvRate,
        ops_gmv_target: opsGmv?.target || 0,
        ops_gmv_actual: opsGmv?.actual || 0,
        // 拓展组利润
        expand_profit_rate: expandProfitRate,
        expand_profit_target: expandProfit?.target || 0,
        expand_profit_actual: expandProfit?.actual || 0,
        // 运营组利润
        ops_profit_rate: opsProfitRate,
        ops_profit_target: opsProfit?.target || 0,
        ops_profit_actual: opsProfit?.actual || 0,
        // 风险项目
        risk_project_count: riskProjects
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
      }))
    });
  } catch (err) {
    console.error('获取仪表盘数据失败:', err);
    error(res, '获取仪表盘数据失败', 1, 500);
  }
}

module.exports = { getDashboard };
