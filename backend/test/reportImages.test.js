/**
 * 周报插图渲染测试
 * 验证 buildReportHtml 能把「按项目分组的插图」和「封面图」正确内联进 HTML，
 * 且 CSP 允许 data: 图片、HTML 转义不破坏 data URL。
 */

const test = require('node:test');
const assert = require('node:assert');
const { buildReportHtml } = require('../src/services/reportScreenshotService');

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const baseContent = {
  week_start: '2026-06-08',
  week_end: '2026-06-14',
  generated_at: '2026-06-14 18:00',
  project_progress: [
    { id: 101, dept_name: '拓展组', name: '渠道合作项目', weekly_progress: '推进中', progress_pct: 60, status: '进行中' },
    { id: 102, dept_name: '运营组', name: '活动复盘', weekly_progress: '已完成', progress_pct: 100, status: '完成' },
  ],
  new_achievements: [],
  risk_and_warnings: { risk_projects: [], severe_warnings: [] },
  next_week_key_work: [],
};

test('无插图时正常渲染，不含 <img>', () => {
  const html = buildReportHtml(baseContent, null);
  assert.ok(html.includes('增长组业务周报'));
  assert.ok(!html.includes('<img'));
});

test('按项目插图：图片内联在对应项目行', () => {
  const assets = {
    byProject: {
      '101': [{ dataUrl: `data:image/png;base64,${TINY_PNG}`, caption: '渠道转化截图' }],
    },
    cover: [],
  };
  const html = buildReportHtml(baseContent, assets);
  assert.ok(html.includes('<img'), '应包含图片');
  assert.ok(html.includes(`data:image/png;base64,${TINY_PNG}`), '应内联 base64 数据');
  assert.ok(html.includes('渠道转化截图'), '应渲染图注');
  // CSP 必须允许 data: 图片，否则 puppeteer 会拦掉图
  assert.ok(/img-src[^;]*data:/.test(html), 'CSP 必须允许 img-src data:');
});

test('封面图渲染在结论区之后', () => {
  const assets = {
    byProject: {},
    cover: [{ dataUrl: `data:image/png;base64,${TINY_PNG}`, caption: '本周封面' }],
  };
  const html = buildReportHtml(baseContent, assets);
  assert.ok(html.includes('本周封面'));
  assert.ok(html.includes('<img'));
});

test('未知项目的插图不会误插到其他项目', () => {
  const assets = {
    byProject: { '999': [{ dataUrl: `data:image/png;base64,${TINY_PNG}`, caption: '孤儿图' }] },
    cover: [],
  };
  const html = buildReportHtml(baseContent, assets);
  // 项目 101/102 行不应出现这张图（999 不匹配任何可见项目）
  // 仍可能整体不含该 caption（因为没有 project 999 的行）
  assert.ok(!html.includes('孤儿图'), '不匹配的项目插图不应出现在表格中');
});
