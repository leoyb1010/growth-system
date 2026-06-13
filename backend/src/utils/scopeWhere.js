/**
 * 数据范围 where 构造 —— 单一事实源
 * ------------------------------------------------------------------
 * 背景：项目里「根据用户数据范围拼 where」的逻辑此前散落在
 *   - middleware/auth.js (applyDataScope)
 *   - ai/services/aiContextService.js (buildScopeWhere)
 *   - 各 controller / exportService 局部实现
 * 多处实现极易在某条路径（尤其导出）漏掉过滤造成越权。
 *
 * 本模块把「范围 → where」收敛为一个纯函数，所有读/写/删/导出路径统一复用。
 * 行为与既有 applyDataScope 完全一致（本次只做收敛，不改变任何访问语义）。
 *
 * scope 形如：{ type, value, deptId, userId }
 *   type: 'all' | 'department' | 'self' | 'cps_channel'
 */

const { Op } = require('sequelize');

/**
 * @param {string} resourceType  资源类型：project / action_item / risk_register / cps / cps_metric / cps_alert / kpi / performance / ...
 * @param {object} scope         { type, value, deptId, userId }
 * @returns {object} sequelize where 片段（可直接展开进 where）
 * @throws {Error}  当 scope.type 未知时抛错（调用方应转 403），避免「未知范围被当成无过滤」造成越权
 */
function buildScopeWhere(resourceType, scope) {
  if (!scope || !scope.type) {
    const err = new Error('数据范围未初始化');
    err.scopeError = true;
    return throwScope(err);
  }

  const { type, value, deptId, userId } = scope;
  const where = {};

  switch (type) {
    case 'all':
      // 不加任何过滤
      return where;

    case 'department':
      where.dept_id = deptId;
      return where;

    case 'self':
      where.dept_id = deptId;
      if (resourceType === 'project') {
        where[Op.or] = [{ owner_user_id: userId }, { creator_id: userId }];
      } else if (resourceType === 'action_item') {
        where[Op.or] = [{ owner_id: userId }, { created_by: userId }];
      } else if (resourceType === 'risk_register') {
        where[Op.or] = [{ owner_id: userId }, { created_by: userId }];
      }
      // 其它资源（kpi/performance 等无 owner 列）仅按 dept_id 约束
      return where;

    case 'cps_channel':
      if (!value) {
        const err = new Error('当前账号未绑定CPS渠道，禁止访问渠道数据');
        err.scopeError = true;
        return throwScope(err);
      }
      if (['cps', 'cps_metric', 'cps_alert'].includes(resourceType)) {
        where.channel_id = value;
      } else {
        where.dept_id = deptId;
      }
      return where;

    default: {
      const err = new Error('数据范围配置异常，请联系管理员');
      err.scopeError = true;
      return throwScope(err);
    }
  }
}

function throwScope(err) {
  throw err;
}

module.exports = { buildScopeWhere };
