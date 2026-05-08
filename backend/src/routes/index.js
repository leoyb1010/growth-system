const express = require('express');
const multer = require('multer');
const path = require('path');

const { authenticate, injectAccessContext, requirePermission, applyDataScope, requireAdmin, requireDeptAccess } = require('../middleware/auth');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const departmentController = require('../controllers/departmentController');
const kpiController = require('../controllers/kpiController');
const projectController = require('../controllers/projectController');
const performanceController = require('../controllers/performanceController');
const monthlyTaskController = require('../controllers/monthlyTaskController');
const achievementController = require('../controllers/achievementController');
const dashboardController = require('../controllers/dashboardController');
const weeklyReportController = require('../controllers/weeklyReportController');
const importController = require('../controllers/importController');
const exportController = require('../controllers/exportController');
const archiveController = require('../controllers/archiveController');
const auditLogController = require('../controllers/auditLogController');
const searchController = require('../controllers/searchController');
const actionItemController = require('../controllers/actionItemController');
const riskRegisterController = require('../controllers/riskRegisterController');
const cpsController = require('../controllers/cpsController');
const cpsAdminController = require('../controllers/cpsAdminController');
const aiRoutes = require('../ai/routes/aiRoutes');
const fileRoutes = require('./fileRoutes');
const cpsUpload = multer({ dest: path.join(__dirname, '../../uploads/temp/cps/'), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

// 接收精细化限流器
module.exports = function({ loginLimiter, aiLimiter, aiStreamLimiter, importLimiter } = {}) {

// 文件上传配置
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp/'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// 公共中间件链：所有需认证的接口统一注入访问上下文
const auth = [authenticate, injectAccessContext];

// ==================== 更新日志（无需认证 · 内存缓存） ====================
let changelogCache = null;
router.get('/changelog', (req, res) => {
  const fallback = { code: 0, data: { latestVersion: '0.0.0', releases: [] }, message: 'ok' };
  try {
    if (changelogCache) return res.json({ code: 0, data: changelogCache, message: 'ok' });
    const fs = require('fs');
    const changelogPath = path.join(__dirname, '../../data/changelog.json');
    const data = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
    changelogCache = data;
    res.json({ code: 0, data, message: 'ok' });
  } catch (err) {
    res.json(fallback);
  }
});

// ==================== 认证路由 ====================
router.post('/auth/login', loginLimiter || [], authController.login);
router.post('/auth/register', authController.register);                         // 用户注册（公开）
router.get('/auth/me', authenticate, authController.getCurrentUser);
router.post('/auth/change-password', authenticate, authController.changePassword);
router.post('/auth/refresh', authController.refreshToken);                      // 刷新 Token
router.post('/auth/logout', authenticate, authController.logout);               // 登出

// ==================== 部门管理（super_admin） ====================
router.get('/departments', ...auth, requirePermission('department.read'), departmentController.getDepartments);
router.post('/departments', ...auth, requirePermission('department.create'), departmentController.createDepartment);
router.put('/departments/:id', ...auth, requirePermission('department.update'), departmentController.updateDepartment);
router.delete('/departments/:id', ...auth, requirePermission('department.delete'), departmentController.deleteDepartment);

// ==================== 用户管理（super_admin） ====================
router.get('/users', ...auth, requirePermission('user.read'), userController.getUsers);
router.post('/users', ...auth, requirePermission('user.create'), userController.createUser);
router.put('/users/:id', ...auth, requirePermission('user.update'), userController.updateUser);
router.delete('/users/:id', ...auth, requirePermission('user.update'), userController.deleteUser);
router.post('/users/:id/reset-password', ...auth, requirePermission('user.reset_password'), userController.resetPassword);
router.post('/users/:id/enable', ...auth, requirePermission('user.disable'), userController.enableUser);
router.post('/users/:id/disable', ...auth, requirePermission('user.disable'), userController.disableUser);

// ==================== A表：核心指标 ====================
router.get('/kpis', ...auth, requirePermission('kpi.read'), applyDataScope('kpi'), kpiController.getKpis);
router.get('/kpis/dashboard', ...auth, requirePermission('kpi.read'), applyDataScope('kpi'), kpiController.getDashboardKpis);
router.post('/kpis', ...auth, requirePermission('kpi.create'), applyDataScope('kpi'), kpiController.createKpi);
router.put('/kpis/:id', ...auth, requirePermission('kpi.update'), applyDataScope('kpi'), kpiController.updateKpi);
router.delete('/kpis/:id', ...auth, requirePermission('kpi.delete'), kpiController.deleteKpi);

// ==================== B表：重点工作 ====================
router.get('/projects', ...auth, requirePermission('project.read'), applyDataScope('project'), projectController.getProjects);
router.get('/projects/dashboard', ...auth, requirePermission('project.read'), applyDataScope('project'), projectController.getProjectStats);
router.get('/projects/stale', ...auth, requirePermission('project.read'), applyDataScope('project'), projectController.getStaleProjects);
router.post('/projects', ...auth, requirePermission('project.create'), applyDataScope('project'), projectController.createProject);
router.put('/projects/:id', ...auth, requirePermission('project.update'), applyDataScope('project'), projectController.updateProject);
router.put('/projects/:id/quick-update', ...auth, requirePermission('project.quick_update'), applyDataScope('project'), projectController.quickUpdateProject);
router.get('/projects/:id/update-logs', ...auth, requirePermission('project.read'), applyDataScope('project'), projectController.getProjectUpdateLogs);
router.delete('/projects/:id', ...auth, requirePermission('project.delete'), projectController.deleteProject);

// ==================== C表：业务线业绩 ====================
router.get('/performances', ...auth, requirePermission('performance.read'), applyDataScope('performance'), performanceController.getPerformances);
router.get('/performances/dashboard', ...auth, requirePermission('performance.read'), applyDataScope('performance'), performanceController.getPerformanceStats);
router.post('/performances', ...auth, requirePermission('performance.create'), applyDataScope('performance'), performanceController.createPerformance);
router.put('/performances/:id', ...auth, requirePermission('performance.update'), applyDataScope('performance'), performanceController.updatePerformance);
router.delete('/performances/:id', ...auth, requirePermission('performance.delete'), performanceController.deletePerformance);

// ==================== D表：月度工作 ====================
router.get('/monthly-tasks', ...auth, requirePermission('monthly_task.read'), applyDataScope('monthly_task'), monthlyTaskController.getMonthlyTasks);
router.post('/monthly-tasks', ...auth, requirePermission('monthly_task.create'), applyDataScope('monthly_task'), monthlyTaskController.createMonthlyTask);
router.put('/monthly-tasks/:id', ...auth, requirePermission('monthly_task.update'), applyDataScope('monthly_task'), monthlyTaskController.updateMonthlyTask);
router.delete('/monthly-tasks/:id', ...auth, requirePermission('monthly_task.delete'), monthlyTaskController.deleteMonthlyTask);

// ==================== E表：季度成果 ====================
router.get('/achievements', ...auth, requirePermission('achievement.read'), applyDataScope('achievement'), achievementController.getAchievements);
router.post('/achievements', ...auth, requirePermission('achievement.create'), applyDataScope('achievement'), achievementController.createAchievement);
router.put('/achievements/:id', ...auth, requirePermission('achievement.update'), applyDataScope('achievement'), achievementController.updateAchievement);
router.delete('/achievements/:id', ...auth, requirePermission('achievement.delete'), achievementController.deleteAchievement);

// ==================== 仪表盘 ====================
router.get('/dashboard', ...auth, requirePermission('dashboard.read'), applyDataScope('dashboard'), dashboardController.getDashboard);
router.get('/dashboard/today-changes', ...auth, requirePermission('dashboard.read'), applyDataScope('dashboard'), dashboardController.getTodayChanges);
router.get('/dashboard/week-focus', ...auth, requirePermission('dashboard.read'), applyDataScope('dashboard'), dashboardController.getWeekFocus);
router.get('/dashboard/week-summary', ...auth, requirePermission('dashboard.read'), applyDataScope('dashboard'), dashboardController.getWeekSummary);

// ==================== 周报 ====================
router.post('/weekly-reports/generate', ...auth, requirePermission('weekly_report.generate'), applyDataScope('weekly_report'), weeklyReportController.generateReport);
router.get('/weekly-reports', ...auth, requirePermission('weekly_report.read'), applyDataScope('weekly_report'), weeklyReportController.getReports);
router.get('/weekly-reports/latest', ...auth, requirePermission('weekly_report.read'), applyDataScope('weekly_report'), weeklyReportController.getLatestReport);
router.get('/weekly-reports/:id', ...auth, requirePermission('weekly_report.read'), applyDataScope('weekly_report'), weeklyReportController.getReportById);
router.put('/weekly-reports/:id/content', ...auth, requirePermission('weekly_report.update'), applyDataScope('weekly_report'), weeklyReportController.saveReportContent);
router.put('/weekly-reports/:id/html', ...auth, requirePermission('weekly_report.update'), applyDataScope('weekly_report'), weeklyReportController.saveReportHtml);
router.get('/weekly-reports/:id/png', ...auth, requirePermission('weekly_report.read'), applyDataScope('weekly_report'), weeklyReportController.exportReportPng);
router.put('/weekly-reports/:id/files', ...auth, requirePermission('weekly_report.update'), applyDataScope('weekly_report'), weeklyReportController.saveReportFiles);

// ==================== 导入导出 ====================
router.post('/import/excel', importLimiter || [], ...auth, requirePermission('import.excel'), applyDataScope('import'), upload.single('file'), importController.importExcel);
router.get('/export/:module', ...auth, requirePermission('export.data'), applyDataScope('export'), exportController.exportModule);

// ==================== 季度归档 ====================
router.get('/archives', ...auth, requirePermission('archive.read'), archiveController.getArchives);
router.post('/archives', ...auth, requirePermission('archive.create'), archiveController.createArchive);
router.delete('/archives/:id', ...auth, requirePermission('archive.delete'), archiveController.deleteArchive);
router.get('/archives/check', ...auth, archiveController.checkArchiveStatus);

// ==================== 审计日志 ====================
router.get('/audit-logs', ...auth, requirePermission('audit.read'), auditLogController.getAuditLogs);
router.get('/audit-logs/:table_name/:record_id', ...auth, requirePermission('audit.read'), auditLogController.getRecordHistory);

// ==================== 全局搜索 ====================
router.get('/search', ...auth, requirePermission('search.use'), applyDataScope('search'), searchController.globalSearch);

// ==================== 行动项 ====================
router.get('/action-items', ...auth, requirePermission('action_item.read'), applyDataScope('action_item'), actionItemController.list);
router.post('/action-items', ...auth, requirePermission('action_item.create'), applyDataScope('action_item'), actionItemController.create);
router.patch('/action-items/:id', ...auth, requirePermission('action_item.update'), applyDataScope('action_item'), actionItemController.update);
router.delete('/action-items/:id', ...auth, requirePermission('action_item.delete'), applyDataScope('action_item'), actionItemController.remove);

// ==================== 风险台账 ====================
router.get('/risk-register', ...auth, requirePermission('risk_register.read'), applyDataScope('risk_register'), riskRegisterController.list);
router.post('/risk-register', ...auth, requirePermission('risk_register.create'), applyDataScope('risk_register'), riskRegisterController.create);
router.patch('/risk-register/:id', ...auth, requirePermission('risk_register.update'), applyDataScope('risk_register'), riskRegisterController.update);

// ==================== 轻量用户选项（部门内可见用户，供行动项/风险选择负责人） ====================
router.get('/users/options', ...auth, userController.getUserOptions);

// ==================== Dashboard 增强 ====================
router.get('/dashboard/top3', ...auth, requirePermission('dashboard.read'), applyDataScope('dashboard'), dashboardController.getTop3Priorities);

// ==================== CPS 连包投流模块 ====================
// 字典查询 (cps.read 即可读渠道/产品列表，cps.admin 才能管理)
router.get('/cps/channels', ...auth, requirePermission('cps.read'), cpsAdminController.getChannels);
router.post('/cps/channels', ...auth, requirePermission('cps.admin'), cpsAdminController.createChannel);
router.put('/cps/channels/:id', ...auth, requirePermission('cps.admin'), cpsAdminController.updateChannel);
router.get('/cps/products', ...auth, requirePermission('cps.read'), cpsAdminController.getProducts);
router.post('/cps/products', ...auth, requirePermission('cps.admin'), cpsAdminController.createProduct);
router.put('/cps/products/:id', ...auth, requirePermission('cps.admin'), cpsAdminController.updateProduct);
// 预警规则
router.get('/cps/alert-rules', ...auth, requirePermission('cps.read'), cpsAdminController.getAlertRules);
router.post('/cps/alert-rules', ...auth, requirePermission('cps.admin'), cpsAdminController.upsertAlertRule);
router.delete('/cps/alert-rules/:id', ...auth, requirePermission('cps.admin'), cpsAdminController.deleteAlertRule);
// 看板 & 明细 (cps.read + 数据范围)
router.get('/cps/dashboard', ...auth, requirePermission('cps.read'), applyDataScope('cps'), cpsController.getDashboard);
router.get('/cps/metrics', ...auth, requirePermission('cps.read'), applyDataScope('cps_metric'), cpsController.getMetrics);
router.post('/cps/metrics', ...auth, requirePermission('cps.write'), applyDataScope('cps_metric'), cpsController.upsertMetric);
router.put('/cps/metrics/:id', ...auth, requirePermission('cps.write'), applyDataScope('cps_metric'), cpsController.updateMetric);
router.delete('/cps/metrics/:id', ...auth, requirePermission('cps.write'), applyDataScope('cps_metric'), cpsController.deleteMetric);
router.get('/cps/metrics/:id/snapshots', ...auth, requirePermission('cps.read'), applyDataScope('cps_metric'), cpsController.getMetricSnapshots);
router.post('/cps/import', ...auth, requirePermission('cps.write'), applyDataScope('cps_metric'), cpsUpload.single('file'), cpsController.importMetrics);
router.get('/cps/export', ...auth, requirePermission('cps.read'), applyDataScope('cps_metric'), cpsController.exportMetrics);
// 预警
router.get('/cps/alerts', ...auth, requirePermission('cps.read'), applyDataScope('cps_alert'), cpsController.getAlerts);
router.post('/cps/alerts/:id/ack', ...auth, requirePermission('cps.write'), applyDataScope('cps_alert'), cpsController.ackAlert);
// 渠道录入接口 (cps_channel_user 专属，只操作自己渠道)
router.post('/cps/channel-entry', ...auth, requirePermission('cps.channel_upload'), applyDataScope('cps_metric'), cpsController.upsertMetric);

// ==================== AI 助手 ====================
// 流式接口额外限流必须在 aiRoutes 之前挂载，否则被 aiRoutes 先拦截
if (aiStreamLimiter) {
  router.use('/ai/chat-stream', aiStreamLimiter);
}
router.use('/ai', aiLimiter || [], aiRoutes);

// ==================== 文件下载（鉴权） ====================
router.use('/files', fileRoutes);

  return router;
};
