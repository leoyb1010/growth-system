# V4 上线验收 Checklist

> 版本：v4-online-hardening  
> 日期：2026-04-22  
> 状态：✅ 全部通过

---

## P0 上线阻塞项（全部必须通过）

| # | 检查项 | 验证方式 | 状态 |
|---|--------|----------|------|
| 1 | **权限矩阵已定稿** | docs/V4-role-matrix.md 存在且三角色权限完整 | ✅ |
| 2 | **鉴权中间件三件套** | auth.js 导出 injectAccessContext + requirePermission + applyDataScope | ✅ |
| 3 | **Dashboard 数据隔离** | 4个controller函数全部读 req.deptFilter，非admin只能看本部门数据 | ✅ |
| 4 | **前端权限中心** | frontend/src/permissions/ability.js 存在，can() 函数可用 | ✅ |
| 5 | **Layout 菜单权限化** | 使用 can() 判断菜单可见性，系统管理仅 super_admin 可见 | ✅ |
| 6 | **改密/重置密码分离** | change-password（需旧密码，改自己）/ reset-password（管理员重置他人） | ✅ |
| 7 | **.env.example 存在** | 包含 JWT_SECRET / DB_DIALECT / NODE_ENV，无默认密码 | ✅ |
| 8 | **init.sql 与 model 严格一致** | 所有字段名、类型、约束完全匹配 | ✅ |

## P1 功能完整性

| # | 检查项 | 验证方式 | 状态 |
|---|--------|----------|------|
| 1 | **User 表 V4 字段** | email / mobile / status / must_change_password / last_login_at / data_scope_type | ✅ |
| 2 | **Project 闭环字段** | owner_user_id / priority / next_action / decision_needed / block_reason / closed_at | ✅ |
| 3 | **用户管理页** | 统计卡 + 状态管理 + 重置密码 + 启用/禁用 | ✅ |
| 4 | **数据范围模型** | super_admin=all / department_manager=department / department_member=self | ✅ |
| 5 | **搜索字段修复** | MonthlyTask.result → actual_result / Achievement.innovation_point → business_value | ✅ |
| 6 | **登录状态检查** | disabled 账号登录返回 403 | ✅ |

## P2 体验优化

| # | 检查项 | 验证方式 | 状态 |
|---|--------|----------|------|
| 1 | **角色化首页** | department_member 看到"我的工作台"，管理员看到"管理驾驶舱" | ✅ |
| 2 | **空态/季度回退** | 当前季度无数据时自动回退到最近有数据的季度，显示提示 | ✅ |
| 3 | **看板视图** | 项目页支持卡片/列表/看板三种视图，看板按状态分组 | ✅ |
| 4 | **闭环字段前端展示** | 卡片/详情/编辑/今日更新均展示 priority / next_action / decision_needed / block_reason | ✅ |
| 5 | **审计覆盖补全** | 所有 CUD 操作都有 logAudit，包括用户管理（创建/更新/删除/重置密码/启用/禁用）和改密 | ✅ |

## 安全验收

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | JWT_SECRET 不硬编码，走环境变量 | ✅ |
| 2 | admin 账号不可禁用/删除 | ✅ |
| 3 | dept_staff 不能创建/删除项目 | ✅ |
| 4 | 数据范围隔离：非admin看不到其他部门数据 | ✅ |
| 5 | 重置密码必须 admin 权限 | ✅ |
| 6 | 字段白名单：所有写入接口只接受预定义字段 | ✅ |

## 上线操作步骤

1. **数据库迁移**：对已有 SQLite 执行 ALTER TABLE 补列（参见下方 SQL）
2. **环境变量**：复制 .env.example → .env，填入 JWT_SECRET
3. **前端构建**：`cd frontend && npm run build`
4. **启动服务**：`cd backend && DB_DIALECT=sqlite NODE_ENV=production node src/app.js`
5. **验证登录**：admin / 123456 登录，检查首页数据正常
6. **验证权限**：分别用三种角色登录，确认数据隔离和菜单可见性

## SQLite 迁移 SQL（已有数据库执行）

```sql
-- User 表新增列
ALTER TABLE users ADD COLUMN email VARCHAR(100);
ALTER TABLE users ADD COLUMN mobile VARCHAR(20);
ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_at DATETIME;
ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(50);
ALTER TABLE users ADD COLUMN data_scope_type VARCHAR(20);
ALTER TABLE users ADD COLUMN data_scope_value TEXT;

-- Project 表新增列
ALTER TABLE projects ADD COLUMN owner_user_id INTEGER;
ALTER TABLE projects ADD COLUMN priority VARCHAR(2) NOT NULL DEFAULT '中';
ALTER TABLE projects ADD COLUMN next_action TEXT;
ALTER TABLE projects ADD COLUMN action_owner_user_id INTEGER;
ALTER TABLE projects ADD COLUMN action_due_date DATE;
ALTER TABLE projects ADD COLUMN decision_needed BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN decision_owner_user_id INTEGER;
ALTER TABLE projects ADD COLUMN closed_at DATETIME;
ALTER TABLE projects ADD COLUMN closed_by INTEGER;
ALTER TABLE projects ADD COLUMN block_reason TEXT;
```
