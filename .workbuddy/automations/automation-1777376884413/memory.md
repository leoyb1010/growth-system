# 项目体检 - 业务管理平台 | 执行记录

## 最近执行历史

### 2026-05-01 05:30 | 评分: 95/100 🟡 A (优秀)

- **执行结果**: 基本正常，有2项警告
- **12项检查**: 17个分项 ✅正常 / 2个 ⚠️警告 / 0个 ❌异常
- **关键信息**:
  - pm2 进程: 在线（0分钟运行时，0次重启）
  - 端口3001: 正常监听
  - Health API: 正常，DB可写
  - 数据库: SQLite 656K，integrity_check=ok，WAL模式，WAL占比46%
  - 数据量: 11张表，users=6, projects=19, kpis=14, weekly_reports=63, audit_logs=170
  - 错误日志(24h): ⚠️ 4条（上次0条）
  - 备份: 今日已备份(768K)，integrity_check=ok，共8个备份文件
  - 磁盘: 已用15% (12Gi/228Gi，可用68Gi)
  - CF Tunnel: 在线(1x连接)（上次是2x）
  - Git: ⚠️ 1个未提交变更(main分支)，已与origin同步
  - 依赖安全: 0个高危/严重漏洞
  - 前端Build: 存在，JS=29个, CSS=1个
  - 环境配置: JWT已配置(64字符)，AI API Key已配置，飞书Webhook未配置
- **问题清单（1项）**:
  - 🟢 低: 错误日志中有 `Error: Cannot find module '../../services/auditService'`（4条）
- **自动修复**: 无（警告项不需自动修复）
- **飞书推送**: ✅ 成功（文字消息 + 截图PNG）
- **产物路径**:
  - Markdown: `/Users/leo/WorkBuddy/Claw/growth_health_20260501.md`
  - HTML: `/Users/leo/WorkBuddy/Claw/growth_health_20260501.html`
  - PNG截图: `/Users/leo/WorkBuddy/Claw/growth_health_20260501.png`

---

### 2026-04-29 05:30 | 评分: 100/100 🟢 A (优秀)

- **执行结果**: 全部通过，无问题
- **12项检查**: 全部 ✅ 通过
- **关键信息**:
  - pm2 进程: 在线（0分钟运行时，0次重启）
  - 端口3001: 正常监听
  - Health API: 正常，DB可写
  - 数据库: SQLite 656K，integrity_check=ok，WAL模式，WAL占比9%
  - 数据量: 11张表，users=6, projects=19, kpis=14, weekly_reports=61, audit_logs=159
  - 错误日志(24h): 0条
  - 备份: 今日已备份(704K)，integrity_check=ok，共6个备份文件
  - 磁盘: 已用25% (12Gi/228Gi)
  - CF Tunnel: 在线(2x连接)
  - Git: 4个未提交变更(main分支)，已与origin同步
  - 依赖安全: 0个高危/严重漏洞
  - 前端Build: 存在，JS=29个, CSS=1个
  - 环境配置: JWT已配置(64字符)，AI API Key已配置，飞书Webhook未配置
- **自动修复**: 无（无需修复）
- **飞书推送**: ✅ 成功（文字消息 + 截图PNG）
- **产物路径**:
  - Markdown: `/Users/leo/WorkBuddy/Claw/growth_health_20260429.md`
  - HTML: `/Users/leo/WorkBuddy/Claw/growth_health_20260429.html`
  - PNG截图: `/Users/leo/WorkBuddy/Claw/growth_health_20260429.png`

---
*本文件记录自动化任务的执行摘要，便于跨会话追踪趋势。详细报告请查看对应日期的HTML/PNG产物。*
