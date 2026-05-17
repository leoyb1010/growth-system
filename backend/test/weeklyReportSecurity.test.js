process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
process.env.DB_STORAGE = process.env.DB_STORAGE || ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

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
