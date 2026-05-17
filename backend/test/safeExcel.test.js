const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeCellForWrite } = require('../src/utils/safeExcel');

test('sanitizeCellForWrite prefixes formula-like strings', () => {
  assert.equal(sanitizeCellForWrite('=cmd|A1'), "'=cmd|A1");
  assert.equal(sanitizeCellForWrite('+SUM(A1:A2)'), "'+SUM(A1:A2)");
  assert.equal(sanitizeCellForWrite('-10+20'), "'-10+20");
  assert.equal(sanitizeCellForWrite('@HYPERLINK("http://example.com")'), "'@HYPERLINK(\"http://example.com\")");
});

test('sanitizeCellForWrite leaves safe values unchanged', () => {
  assert.equal(sanitizeCellForWrite('项目进展'), '项目进展');
  assert.equal(sanitizeCellForWrite('  =not_formula_after_space'), '  =not_formula_after_space');
  assert.equal(sanitizeCellForWrite(100), 100);
  assert.equal(sanitizeCellForWrite(null), null);
});
