const express = require('express');
const multer = require('multer');
const path = require('path');

const { authenticate, requireAdmin, requireDeptAccess } = require('../middleware/auth');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
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

const router = express.Router();

// 文件上传配置
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp/'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ==================== 认证路由 ====================
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.getCurrentUser);
router.post('/auth/change-password', authenticate, authController.changePassword);

// ==================== 用户管理（管理员） ====================
router.get('/users', authenticate, requireAdmin, userController.getUsers);
router.post('/users', authenticate, requireAdmin, userController.createUser);
router.put('/users/:id', authenticate, requireAdmin, userController.updateUser);
router.delete('/users/:id', authenticate, requireAdmin, userController.deleteUser);

// ==================== A表：核心指标 ====================
router.get('/kpis', authenticate, requireDeptAccess, kpiController.getKpis);
router.get('/kpis/dashboard', authenticate, kpiController.getDashboardKpis);
router.post('/kpis', authenticate, requireDeptAccess, kpiController.createKpi);
router.put('/kpis/:id', authenticate, requireDeptAccess, kpiController.updateKpi);
router.delete('/kpis/:id', authenticate, requireAdmin, kpiController.deleteKpi);

// ==================== B表：重点工作 ====================
router.get('/projects', authenticate, requireDeptAccess, projectController.getProjects);
router.get('/projects/dashboard', authenticate, projectController.getProjectStats);
router.get('/projects/stale', authenticate, requireDeptAccess, projectController.getStaleProjects);
router.post('/projects', authenticate, requireDeptAccess, projectController.createProject);
router.put('/projects/:id', authenticate, requireDeptAccess, projectController.updateProject);
router.put('/projects/:id/quick-update', authenticate, requireDeptAccess, projectController.quickUpdateProject);
router.get('/projects/:id/update-logs', authenticate, requireDeptAccess, projectController.getProjectUpdateLogs);
router.delete('/projects/:id', authenticate, requireDeptAccess, projectController.deleteProject);

// ==================== C表：业务线业绩 ====================
router.get('/performances', authenticate, requireDeptAccess, performanceController.getPerformances);
router.get('/performances/dashboard', authenticate, performanceController.getPerformanceStats);
router.post('/performances', authenticate, requireDeptAccess, performanceController.createPerformance);
router.put('/performances/:id', authenticate, requireDeptAccess, performanceController.updatePerformance);
router.delete('/performances/:id', authenticate, requireAdmin, performanceController.deletePerformance);

// ==================== D表：月度工作 ====================
router.get('/monthly-tasks', authenticate, requireDeptAccess, monthlyTaskController.getMonthlyTasks);
router.post('/monthly-tasks', authenticate, requireDeptAccess, monthlyTaskController.createMonthlyTask);
router.put('/monthly-tasks/:id', authenticate, requireDeptAccess, monthlyTaskController.updateMonthlyTask);
router.delete('/monthly-tasks/:id', authenticate, requireAdmin, monthlyTaskController.deleteMonthlyTask);

// ==================== E表：季度成果 ====================
router.get('/achievements', authenticate, requireDeptAccess, achievementController.getAchievements);
router.post('/achievements', authenticate, requireDeptAccess, achievementController.createAchievement);
router.put('/achievements/:id', authenticate, requireDeptAccess, achievementController.updateAchievement);
router.delete('/achievements/:id', authenticate, requireAdmin, achievementController.deleteAchievement);

// ==================== 仪表盘 ====================
router.get('/dashboard', authenticate, dashboardController.getDashboard);
router.get('/dashboard/today-changes', authenticate, dashboardController.getTodayChanges);
router.get('/dashboard/week-focus', authenticate, dashboardController.getWeekFocus);
router.get('/dashboard/week-summary', authenticate, dashboardController.getWeekSummary);

// ==================== 周报 ====================
router.post('/weekly-reports/generate', authenticate, requireDeptAccess, weeklyReportController.generateReport);
router.get('/weekly-reports', authenticate, requireDeptAccess, weeklyReportController.getReports);
router.get('/weekly-reports/latest', authenticate, requireDeptAccess, weeklyReportController.getLatestReport);
router.get('/weekly-reports/:id', authenticate, requireDeptAccess, weeklyReportController.getReportById);
router.put('/weekly-reports/:id/html', authenticate, requireDeptAccess, weeklyReportController.saveReportHtml);
router.put('/weekly-reports/:id/files', authenticate, requireDeptAccess, weeklyReportController.saveReportFiles);

// ==================== 导入导出 ====================
router.post('/import/excel', authenticate, requireAdmin, upload.single('file'), importController.importExcel);
router.get('/export/:module', authenticate, exportController.exportModule);

// ==================== 季度归档 ====================
router.get('/archives', authenticate, requireAdmin, archiveController.getArchives);
router.post('/archives', authenticate, requireAdmin, archiveController.createArchive);
router.delete('/archives/:id', authenticate, requireAdmin, archiveController.deleteArchive);
router.get('/archives/check', authenticate, archiveController.checkArchiveStatus);

// ==================== 审计日志 ====================
router.get('/audit-logs', authenticate, requireAdmin, auditLogController.getAuditLogs);
router.get('/audit-logs/:table_name/:record_id', authenticate, auditLogController.getRecordHistory);

// ==================== 全局搜索 ====================
router.get('/search', authenticate, requireDeptAccess, searchController.globalSearch);

module.exports = router;
