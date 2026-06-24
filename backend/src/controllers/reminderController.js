/**
 * 每日提醒：按当前用户归属聚合"需要关注"的信号，供前端每日首次打开弹一次。
 * 归属范围：
 *   - 管理员(super_admin/admin) → 全局
 *   - 部门经理(dept_manager/dept) → 本部门
 *   - 其他成员 → 本人(自己负责/创建/动作负责的项目)
 * 触发：风险项目 / 进度未更新(>3天) / 动作项临期(3天内)或逾期 / 我负责的业务(CPS)预警
 */
const { Op } = require('sequelize');
const moment = require('moment');
const { Project, Department, ActionItem, CpsAlertEvent, CpsChannel } = require('../models');
const { success, error } = require('../utils/response');

function currentQuarter() {
  const m = new Date().getMonth();
  return m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
}

function projectScope(user) {
  const role = user.role;
  if (role === 'admin' || role === 'super_admin') return {};
  if ((role === 'dept_manager' || role === 'dept') && user.dept_id) return { dept_id: user.dept_id };
  return { [Op.or]: [{ owner_user_id: user.id }, { creator_id: user.id }, { action_owner_user_id: user.id }] };
}

async function getDailyReminders(req, res) {
  try {
    const user = req.user;
    const quarter = currentQuarter();
    const scope = projectScope(user);
    const staleDate = moment().subtract(3, 'days').toDate();
    const dueLimit = moment().add(3, 'days').endOf('day').toDate();
    const today = moment().startOf('day');

    const deptInclude = [{ model: Department, attributes: ['id', 'name'] }];

    // 1) 风险项目
    const riskProjects = await Project.findAll({
      where: { ...scope, quarter, status: '风险' },
      include: deptInclude,
      attributes: ['id', 'name', 'dept_id', 'progress_pct', 'updated_at'],
      order: [['updated_at', 'ASC']],
      limit: 30,
    });

    // 2) 进度未更新(>3天、未完成)
    const staleProjects = await Project.findAll({
      where: { ...scope, quarter, status: { [Op.ne]: '完成' }, updated_at: { [Op.lt]: staleDate } },
      include: deptInclude,
      attributes: ['id', 'name', 'dept_id', 'updated_at'],
      order: [['updated_at', 'ASC']],
      limit: 30,
    });

    // 3) 动作项临期/逾期(本人 owner，待办/进行中，截止<=今天+3)
    const actionItems = await ActionItem.findAll({
      where: {
        owner_id: user.id,
        status: { [Op.in]: ['pending', 'in_progress'] },
        due_date: { [Op.ne]: null, [Op.lte]: dueLimit },
      },
      attributes: ['id', 'title', 'due_date', 'priority'],
      order: [['due_date', 'ASC']],
      limit: 30,
    });

    // 4) 我负责的业务(CPS)预警
    let cpsAlerts = [];
    const cpsRole = user.cps_role;
    const isCpsChannel = user.role === 'cps_channel_user' || cpsRole === 'channel_user';
    const canSeeAllCps = ['admin', 'super_admin'].includes(user.role) || ['cps_admin', 'cps_ops'].includes(cpsRole);
    if (isCpsChannel && user.cps_channel_id) {
      cpsAlerts = await CpsAlertEvent.findAll({
        where: { status: 'open', channel_id: user.cps_channel_id },
        include: [{ model: CpsChannel, as: 'channel', attributes: ['id', 'name'] }],
        attributes: ['id', 'title', 'level', 'channel_id', 'stat_date'],
        order: [['created_at', 'DESC']], limit: 30,
      });
    } else if (canSeeAllCps) {
      cpsAlerts = await CpsAlertEvent.findAll({
        where: { status: 'open' },
        include: [{ model: CpsChannel, as: 'channel', attributes: ['id', 'name'] }],
        attributes: ['id', 'title', 'level', 'channel_id', 'stat_date'],
        order: [['created_at', 'DESC']], limit: 30,
      });
    }

    const groups = [];
    if (riskProjects.length) {
      groups.push({
        type: 'risk', title: '风险项目', count: riskProjects.length,
        items: riskProjects.map(p => ({ id: p.id, name: p.name, dept: p.Department?.name || '', progress_pct: p.progress_pct, link: `/projects?focus=${p.id}` })),
      });
    }
    if (staleProjects.length) {
      groups.push({
        type: 'stale', title: '进度未更新（超3天）', count: staleProjects.length,
        items: staleProjects.map(p => ({ id: p.id, name: p.name, dept: p.Department?.name || '', days: moment().diff(moment(p.updated_at), 'days'), link: `/week` })),
      });
    }
    if (actionItems.length) {
      groups.push({
        type: 'action_due', title: '动作项临期/逾期', count: actionItems.length,
        items: actionItems.map(a => {
          const overdue = moment(a.due_date).isBefore(today);
          return { id: a.id, name: a.title, due_date: a.due_date, overdue, priority: a.priority, link: `/action-items` };
        }),
      });
    }
    if (cpsAlerts.length) {
      groups.push({
        type: 'cps_alert', title: '业务预警（CPS）', count: cpsAlerts.length,
        items: cpsAlerts.map(a => ({ id: a.id, name: a.title, level: a.level, channel: a.channel?.name || '', link: `/cps` })),
      });
    }

    const count = groups.reduce((s, g) => s + g.count, 0);
    return success(res, { date: moment().format('YYYY-MM-DD'), count, groups });
  } catch (err) {
    console.error('getDailyReminders error:', err);
    return error(res, err.message || '获取每日提醒失败');
  }
}

module.exports = { getDailyReminders };
