/**
 * 周报附件/插图控制器
 * - 图片以 base64 存 report_assets.data_base64，随 sqlite 备份，受数据范围隔离。
 * - 鉴权：能读该周报（deptFilter 命中）即可管理其附件；上传/列表都按周报访问权约束。
 * - 安全：仅允许图片 MIME；单图大小上限；防滥用的每报数量上限。
 */

const { WeeklyReport, ReportAsset } = require('../models');
const { success, error } = require('../utils/response');
const { logAudit } = require('../services/auditLogService');

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024; // 单图 5MB
const MAX_ASSETS_PER_REPORT = 80;

/**
 * 校验当前用户是否有权访问该周报（与 weeklyReportController 一致的 deptFilter 语义）。
 * 返回 report 实例或 null。
 */
async function loadAccessibleReport(req, reportId) {
  const report = await WeeklyReport.findByPk(reportId);
  if (!report) return { report: null, code: 404 };
  // deptFilter 为 null = admin/全量；否则需周报内含该部门数据才算可见
  const deptFilter = req.deptFilter || null;
  if (deptFilter) {
    // 复用 weeklyReportController 的过滤判定
    const { __private } = require('./weeklyReportController');
    const filtered = await __private.filterReportContentForDept(report.content_json, deptFilter);
    if (!filtered.hasData) return { report: null, code: 403 };
  }
  return { report, code: 0 };
}

function publicAsset(a) {
  // 列表默认不带 data_base64（体积大），只带元信息 + 缩略访问 URL
  return {
    id: a.id,
    report_id: a.report_id,
    project_id: a.project_id,
    section: a.section,
    filename: a.filename,
    mime_type: a.mime_type,
    byte_size: a.byte_size,
    width: a.width,
    height: a.height,
    caption: a.caption,
    sort_order: a.sort_order,
    include_in_export: a.include_in_export,
    created_at: a.created_at,
    url: `/api/weekly-reports/${a.report_id}/assets/${a.id}/raw`,
  };
}

/** GET /api/weekly-reports/:id/assets  列出该周报全部附图元信息 */
async function listAssets(req, res) {
  try {
    const { report, code } = await loadAccessibleReport(req, req.params.id);
    if (!report) return error(res, code === 404 ? '周报不存在' : '无权访问该周报', code, code);
    const assets = await ReportAsset.findAll({
      where: { report_id: report.id },
      order: [['project_id', 'ASC'], ['sort_order', 'ASC'], ['id', 'ASC']],
    });
    success(res, assets.map(publicAsset), '获取附件成功');
  } catch (err) {
    console.error('列出周报附件失败:', err);
    error(res, '获取附件失败', 1, 500);
  }
}

/** GET /api/weekly-reports/:id/assets/:assetId/raw  返回图片字节（鉴权后） */
async function getAssetRaw(req, res) {
  try {
    const { report, code } = await loadAccessibleReport(req, req.params.id);
    if (!report) return error(res, code === 404 ? '周报不存在' : '无权访问该周报', code, code);
    const asset = await ReportAsset.findOne({ where: { id: req.params.assetId, report_id: report.id } });
    if (!asset) return error(res, '附件不存在', 404, 404);
    const buf = Buffer.from(asset.data_base64, 'base64');
    res.set({
      'Content-Type': asset.mime_type || 'image/png',
      'Content-Length': buf.length,
      'Cache-Control': 'private, max-age=86400',
    });
    res.send(buf);
  } catch (err) {
    console.error('读取周报附件失败:', err);
    error(res, '读取附件失败', 1, 500);
  }
}

/**
 * POST /api/weekly-reports/:id/assets  上传一张附图
 * body: { project_id?, section?, caption?, filename?, mime_type, data_base64 }
 * 走 JSON（前端 FileReader → base64），避免再引入 multipart 复杂度。
 */
async function uploadAsset(req, res) {
  try {
    const { report, code } = await loadAccessibleReport(req, req.params.id);
    if (!report) return error(res, code === 404 ? '周报不存在' : '无权访问该周报', code, code);

    let { project_id, section, caption, filename, mime_type, data_base64, width, height } = req.body || {};

    if (!data_base64 || typeof data_base64 !== 'string') {
      return error(res, '缺少图片数据', 1, 400);
    }
    // 去掉可能的 data:url 前缀
    const m = data_base64.match(/^data:([\w/+.-]+);base64,(.*)$/s);
    if (m) {
      mime_type = mime_type || m[1];
      data_base64 = m[2];
    }
    mime_type = (mime_type || 'image/png').toLowerCase();
    if (!ALLOWED_MIME.has(mime_type)) {
      return error(res, '仅支持 PNG/JPEG/WebP/GIF 图片', 1, 400);
    }

    let buf;
    try {
      buf = Buffer.from(data_base64, 'base64');
    } catch {
      return error(res, '图片数据格式错误', 1, 400);
    }
    if (!buf || buf.length === 0) return error(res, '图片为空', 1, 400);
    if (buf.length > MAX_BYTES) return error(res, '单张图片不能超过 5MB', 1, 400);

    const count = await ReportAsset.count({ where: { report_id: report.id } });
    if (count >= MAX_ASSETS_PER_REPORT) {
      return error(res, `单份周报附图数量已达上限（${MAX_ASSETS_PER_REPORT}）`, 1, 400);
    }

    // 排序：同一项目下追加到末尾
    const maxSort = await ReportAsset.max('sort_order', {
      where: { report_id: report.id, project_id: project_id || null },
    });

    const asset = await ReportAsset.create({
      report_id: report.id,
      project_id: project_id != null ? Number(project_id) : null,
      section: section || 'project',
      filename: filename ? String(filename).slice(0, 255) : null,
      mime_type,
      byte_size: buf.length,
      width: width != null ? Number(width) : null,
      height: height != null ? Number(height) : null,
      caption: caption ? String(caption).slice(0, 200) : null,
      sort_order: (Number.isFinite(maxSort) ? maxSort : 0) + 1,
      include_in_export: true,
      data_base64,
      created_by: req.user?.id || null,
      dept_id: req.user?.dept_id || null,
    });

    await logAudit(req, {
      action: 'create',
      table_name: 'report_assets',
      record_id: asset.id,
      detail: `周报#${report.id} 插图（项目#${asset.project_id || '-'}, ${buf.length}B）`,
    }).catch(() => {});

    success(res, publicAsset(asset), '上传成功');
  } catch (err) {
    console.error('上传周报附件失败:', err);
    error(res, '上传失败', 1, 500);
  }
}

/** PUT /api/weekly-reports/:id/assets/:assetId  更新图注/排序/是否导出 */
async function updateAsset(req, res) {
  try {
    const { report, code } = await loadAccessibleReport(req, req.params.id);
    if (!report) return error(res, code === 404 ? '周报不存在' : '无权访问该周报', code, code);
    const asset = await ReportAsset.findOne({ where: { id: req.params.assetId, report_id: report.id } });
    if (!asset) return error(res, '附件不存在', 404, 404);

    const patch = {};
    if (req.body.caption !== undefined) patch.caption = req.body.caption ? String(req.body.caption).slice(0, 200) : null;
    if (req.body.sort_order !== undefined) patch.sort_order = Number(req.body.sort_order) || 0;
    if (req.body.include_in_export !== undefined) patch.include_in_export = !!req.body.include_in_export;
    if (req.body.project_id !== undefined) patch.project_id = req.body.project_id != null ? Number(req.body.project_id) : null;

    await asset.update(patch);
    success(res, publicAsset(asset), '更新成功');
  } catch (err) {
    console.error('更新周报附件失败:', err);
    error(res, '更新失败', 1, 500);
  }
}

/** DELETE /api/weekly-reports/:id/assets/:assetId */
async function deleteAsset(req, res) {
  try {
    const { report, code } = await loadAccessibleReport(req, req.params.id);
    if (!report) return error(res, code === 404 ? '周报不存在' : '无权访问该周报', code, code);
    const asset = await ReportAsset.findOne({ where: { id: req.params.assetId, report_id: report.id } });
    if (!asset) return error(res, '附件不存在', 404, 404);
    await asset.destroy();
    await logAudit(req, {
      action: 'delete',
      table_name: 'report_assets',
      record_id: Number(req.params.assetId),
      detail: `删除周报#${report.id} 插图`,
    }).catch(() => {});
    success(res, { id: Number(req.params.assetId) }, '删除成功');
  } catch (err) {
    console.error('删除周报附件失败:', err);
    error(res, '删除失败', 1, 500);
  }
}

/**
 * 供导出渲染使用：取某周报「要进导出」的附图，按 project_id 分组返回 base64 data URL。
 * @returns {Promise<{ byProject: Record<string, Array>, cover: Array }>}
 */
async function getExportableAssetsGrouped(reportId) {
  const assets = await ReportAsset.findAll({
    where: { report_id: reportId, include_in_export: true },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  const byProject = {};
  const cover = [];
  for (const a of assets) {
    const item = {
      dataUrl: `data:${a.mime_type};base64,${a.data_base64}`,
      caption: a.caption || '',
    };
    if (a.section === 'cover' || a.project_id == null) {
      cover.push(item);
    } else {
      const key = String(a.project_id);
      (byProject[key] = byProject[key] || []).push(item);
    }
  }
  return { byProject, cover };
}

module.exports = {
  listAssets,
  getAssetRaw,
  uploadAsset,
  updateAsset,
  deleteAsset,
  getExportableAssetsGrouped,
};
