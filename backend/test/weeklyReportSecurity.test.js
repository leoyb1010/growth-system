process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
process.env.DB_STORAGE = process.env.DB_STORAGE || ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const moment = require('moment');

const { __private } = require('../src/controllers/weeklyReportController');

test('weekly report file URLs must stay inside authenticated report downloads', () => {
  assert.equal(__private.isSafeWeeklyReportFileUrl('/api/files/weekly-reports/report.png', '.png'), true);
  assert.equal(__private.isSafeWeeklyReportFileUrl('/api/files/weekly-reports/report.pdf', '.pdf'), true);
  assert.equal(__private.isSafeWeeklyReportFileUrl('https://example.com/report.png', '.png'), false);
  assert.equal(__private.isSafeWeeklyReportFileUrl('/api/files/weekly-reports/../secret.png', '.png'), false);
  assert.equal(__private.isSafeWeeklyReportFileUrl('/api/files/weekly-reports/report.pdf', '.png'), false);
});

test('weekly report scope check detects other department data', () => {
  const content = {
    project_progress: [
      { dept_id: 1, dept_name: '拓展组', name: '允许' },
      { dept_id: 2, dept_name: '运营组', name: '拒绝' },
    ],
    risk_and_warnings: {
      risk_projects: [{ dept_id: 2, dept_name: '运营组' }],
    },
  };

  const out = __private.getOutOfScopeDeptData(content, 1, '拓展组');
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(item => item.path), [
    'project_progress[1]',
    'risk_and_warnings.risk_projects[0]',
  ]);
});

test('weekly report default range uses previous complete ISO week', () => {
  const now = moment('2026-05-25T10:00:00+08:00');
  const { start, end } = __private.resolveWeeklyReportRange({}, now);

  assert.equal(moment(start).format('YYYY-MM-DD HH:mm:ss'), '2026-05-18 00:00:00');
  assert.equal(moment(end).format('YYYY-MM-DD HH:mm:ss'), '2026-05-24 23:59:59');
});

test('weekly report explicit range keeps requested dates', () => {
  const { start, end } = __private.resolveWeeklyReportRange({
    week_start: '2026-05-04',
    week_end: '2026-05-10',
  }, moment('2026-05-25T10:00:00+08:00'));

  assert.equal(moment(start).format('YYYY-MM-DD HH:mm:ss'), '2026-05-04 00:00:00');
  assert.equal(moment(end).format('YYYY-MM-DD HH:mm:ss'), '2026-05-10 23:59:59');
});
