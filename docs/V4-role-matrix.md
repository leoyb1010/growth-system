# V4 角色模型与权限矩阵

> 版本：v4.0 | 更新日期：2026-04-22

## 1. 标准角色定义

| 角色代码 | 角色名称 | 角色层级 | 数据范围 | 说明 |
|---------|---------|---------|---------|------|
| `super_admin` | 超级管理员 | 0 | `all` | 全局管理，所有模块读写，系统管理 |
| `department_manager` | 部门负责人 | 1 | `department` | 本部门全部数据读写，不可跨部门 |
| `department_member` | 普通成员 | 2 | `self` | 本部门 + 仅自己负责/创建的数据 |

### 兼容映射

| 旧角色 | 新角色 | 说明 |
|-------|-------|------|
| `admin` | `super_admin` | 直接映射 |
| `dept_manager` | `department_manager` | 直接映射 |
| `dept` | `department_manager` | 旧兼容角色，等同 dept_manager |
| `dept_staff` | `department_member` | 直接映射 |

## 2. 菜单可见性矩阵

| 菜单项 | super_admin | department_manager | department_member |
|-------|:-----------:|:-----------------:|:----------------:|
| 总览 | ✅ | ✅ | ✅ |
| 本周 | ✅ | ✅ | ✅ |
| 指标与目标 | ✅ | ✅ | ✅ |
| 项目推进 | ✅ | ✅ | ✅ |
| 月度任务 | ✅ | ✅ | ✅ |
| 季度成果 | ✅ | ✅ | ✅ |
| 周报与复盘 | ✅ | ✅ | ✅ |
| 用户管理 | ✅ | ❌ | ❌ |
| 审计日志 | ✅ | ❌ | ❌ |
| 归档管理 | ✅ | ❌ | ❌ |
| 导入导出 | ✅ | ❌ | ❌ |
| 录入指引 | ✅ | ✅ | ❌ |

## 3. 页面访问权限矩阵

| 页面 | super_admin | department_manager | department_member |
|-----|:-----------:|:-----------------:|:----------------:|
| / (Dashboard) | 全局视图 | 本部门视图 | 我的视图 |
| /week | 全局 | 本部门 | 本部门(我的) |
| /kpis | 全部KPI | 本部门KPI | 本部门KPI(只读) |
| /projects | 全部项目 | 本部门项目 | 我负责的项目 |
| /monthly-tasks | 全部 | 本部门 | 我创建的 |
| /achievements | 全部 | 本部门 | 我创建的 |
| /weekly-reports | 全部周报 | 本部门周报 | 本部门周报(只读) |
| /users | ✅ | ❌ | ❌ |
| /audit-logs | ✅ | ❌ | ❌ |
| /archives | ✅ | ❌ | ❌ |

## 4. 按钮与操作权限矩阵

### 指标与目标 (KPI)

| 操作 | super_admin | department_manager | department_member |
|-----|:-----------:|:-----------------:|:----------------:|
| 查看指标 | ✅ | 本部门 | 本部门(只读) |
| 新增指标 | ✅ | 本部门 | ❌ |
| 编辑指标 | ✅ | 本部门 | ❌ |
| 删除指标 | ✅ | ❌ | ❌ |
| 导出指标 | ✅ | 本部门 | 本部门 |

### 项目推进 (Project)

| 操作 | super_admin | department_manager | department_member |
|-----|:-----------:|:-----------------:|:----------------:|
| 查看项目 | ✅ | 本部门 | 我负责/创建的 |
| 新增项目 | ✅ | 本部门 | ❌ |
| 编辑项目 | ✅ | 本部门 | 我负责/创建的 |
| 删除项目 | ✅ | ❌ | ❌ |
| 快速更新 | ✅ | 本部门 | 我负责/创建的 |
| 标记风险解除 | ✅ | 本部门 | 我负责的 |

### 月度任务 (MonthlyTask)

| 操作 | super_admin | department_manager | department_member |
|-----|:-----------:|:-----------------:|:----------------:|
| 查看 | ✅ | 本部门 | 我创建的 |
| 新增 | ✅ | 本部门 | 本部门 |
| 编辑 | ✅ | 本部门 | 我创建的 |
| 删除 | ✅ | ❌ | ❌ |

### 季度成果 (Achievement)

| 操作 | super_admin | department_manager | department_member |
|-----|:-----------:|:-----------------:|:----------------:|
| 查看 | ✅ | 本部门 | 我创建的 |
| 新增 | ✅ | 本部门 | 本部门 |
| 编辑 | ✅ | 本部门 | 我创建的 |
| 删除 | ✅ | ❌ | ❌ |

### 周报 (WeeklyReport)

| 操作 | super_admin | department_manager | department_member |
|-----|:-----------:|:-----------------:|:----------------:|
| 查看周报 | ✅ | 本部门 | 本部门(只读) |
| 生成周报 | ✅ | 本部门 | ❌ |
| 保存HTML | ✅ | 本部门 | ❌ |
| 导出周报 | ✅ | 本部门 | 本部门 |

### 系统管理

| 操作 | super_admin | department_manager | department_member |
|-----|:-----------:|:-----------------:|:----------------:|
| 用户管理CRUD | ✅ | ❌ | ❌ |
| 重置密码 | ✅ | ❌ | ❌ |
| 启用/禁用账号 | ✅ | ❌ | ❌ |
| 审计日志查看 | ✅ | ❌ | ❌ |
| 归档操作 | ✅ | ❌ | ❌ |
| 导入Excel | ✅ | ❌ | ❌ |
| 导出数据 | ✅ | 本部门 | 本部门 |

## 5. 数据范围模型

| 数据范围类型 | 代码 | 说明 |
|------------|------|------|
| 全部数据 | `all` | super_admin，不注入 deptFilter |
| 本部门 | `department` | 按 dept_id 过滤 |
| 仅自己 | `self` | 按 owner_user_id / creator_id 过滤 |
| 自定义 | `custom` | 预留，按 data_scope_value 中的 deptIds 过滤 |

### 数据范围映射

| 角色 | 默认数据范围 | 说明 |
|-----|-----------|------|
| super_admin | `all` | 不做任何数据过滤 |
| department_manager | `department` | where.dept_id = user.dept_id |
| department_member | `self` | where.dept_id = user.dept_id AND (owner_user_id = user.id OR creator_id = user.id) |

## 6. 接口权限声明

以下为所有 API 接口的权限要求，路由层直接绑定：

### 认证
| 接口 | 权限 |
|-----|------|
| POST /auth/login | public |
| GET /auth/me | authenticated |
| POST /auth/change-password | authenticated (仅改自己，需旧密码) |

### 用户管理
| 接口 | 权限 |
|-----|------|
| GET /users | user.read (super_admin) |
| POST /users | user.create (super_admin) |
| PUT /users/:id | user.update (super_admin) |
| DELETE /users/:id | user.update (super_admin) |
| POST /users/:id/reset-password | user.reset_password (super_admin) |
| POST /users/:id/enable | user.update (super_admin) |
| POST /users/:id/disable | user.update (super_admin) |

### KPI
| 接口 | 权限 | 数据范围 |
|-----|------|---------|
| GET /kpis | kpi.read | applyDataScope |
| GET /kpis/dashboard | kpi.read | applyDataScope |
| POST /kpis | kpi.create | department+ |
| PUT /kpis/:id | kpi.update | department+ |
| DELETE /kpis/:id | kpi.delete | super_admin |

### 项目
| 接口 | 权限 | 数据范围 |
|-----|------|---------|
| GET /projects | project.read | applyDataScope |
| GET /projects/dashboard | project.read | applyDataScope |
| GET /projects/stale | project.read | applyDataScope |
| POST /projects | project.create | department_manager+ |
| PUT /projects/:id | project.update | applyDataScope |
| PUT /projects/:id/quick-update | project.quick_update | applyDataScope |
| GET /projects/:id/update-logs | project.read | applyDataScope |
| DELETE /projects/:id | project.delete | super_admin |

### 业务线业绩
| 接口 | 权限 | 数据范围 |
|-----|------|---------|
| GET /performances | performance.read | applyDataScope |
| GET /performances/dashboard | performance.read | applyDataScope |
| POST /performances | performance.create | department+ |
| PUT /performances/:id | performance.update | department+ |
| DELETE /performances/:id | performance.delete | super_admin |

### 月度任务
| 接口 | 权限 | 数据范围 |
|-----|------|---------|
| GET /monthly-tasks | monthly_task.read | applyDataScope |
| POST /monthly-tasks | monthly_task.create | department+ |
| PUT /monthly-tasks/:id | monthly_task.update | applyDataScope |
| DELETE /monthly-tasks/:id | monthly_task.delete | super_admin |

### 季度成果
| 接口 | 权限 | 数据范围 |
|-----|------|---------|
| GET /achievements | achievement.read | applyDataScope |
| POST /achievements | achievement.create | department+ |
| PUT /achievements/:id | achievement.update | applyDataScope |
| DELETE /achievements/:id | achievement.delete | super_admin |

### Dashboard
| 接口 | 权限 | 数据范围 |
|-----|------|---------|
| GET /dashboard | dashboard.read | applyDataScope |
| GET /dashboard/today-changes | dashboard.read | applyDataScope |
| GET /dashboard/week-focus | dashboard.read | applyDataScope |
| GET /dashboard/week-summary | dashboard.read | applyDataScope |

### 周报
| 接口 | 权限 | 数据范围 |
|-----|------|---------|
| POST /weekly-reports/generate | weekly_report.generate | department_manager+ |
| GET /weekly-reports | weekly_report.read | applyDataScope |
| GET /weekly-reports/latest | weekly_report.read | applyDataScope |
| GET /weekly-reports/:id | weekly_report.read | applyDataScope |
| PUT /weekly-reports/:id/html | weekly_report.update | department_manager+ |
| PUT /weekly-reports/:id/files | weekly_report.update | department_manager+ |

### 搜索/导入导出/归档/审计
| 接口 | 权限 |
|-----|------|
| GET /search | authenticated + applyDataScope |
| POST /import/excel | super_admin |
| GET /export/:module | authenticated + applyDataScope |
| GET /archives | super_admin |
| POST /archives | super_admin |
| DELETE /archives/:id | super_admin |
| GET /audit-logs | super_admin |
