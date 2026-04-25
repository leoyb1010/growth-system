const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, injectAccessContext, requirePermission } = require('../middleware/auth');
const { error } = require('../utils/response');

const router = express.Router();

// 所有文件下载需要认证
const auth = [authenticate, injectAccessContext];

/**
 * 导出文件下载（需要 export.data 权限）
 * GET /api/files/exports/:filename
 */
router.get('/exports/:filename', ...auth, requirePermission('export.data'), (req, res) => {
  const filename = req.params.filename;

  // 安全校验：防止路径遍历
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return error(res, '非法文件名', 1, 400);
  }

  const filePath = path.join(__dirname, '../../uploads/exports', filename);

  if (!fs.existsSync(filePath)) {
    return error(res, '文件不存在或已过期', 1, 404);
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('文件下载失败:', err.message);
    }
  });
});

/**
 * 周报文件下载（需要 weekly_report.read 权限）
 * GET /api/files/weekly-reports/:filename
 */
router.get('/weekly-reports/:filename', ...auth, requirePermission('weekly_report.read'), (req, res) => {
  const filename = req.params.filename;

  // 安全校验：防止路径遍历
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return error(res, '非法文件名', 1, 400);
  }

  const filePath = path.join(__dirname, '../../weekly-reports', filename);

  if (!fs.existsSync(filePath)) {
    return error(res, '文件不存在或已过期', 1, 404);
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('周报文件下载失败:', err.message);
    }
  });
});

module.exports = router;
