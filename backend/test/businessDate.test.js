const test = require('node:test');
const assert = require('node:assert/strict');

const {
  addDays,
  excelSerialToDateString,
  formatDateInTimeZone,
  getBusinessTimeZone,
  parseBusinessDate,
} = require('../src/utils/businessDate');

test('business timezone defaults to China unless explicitly overridden', () => {
  const oldAppTimeZone = process.env.APP_TIMEZONE;
  const oldBusinessTimeZone = process.env.BUSINESS_TIMEZONE;
  delete process.env.APP_TIMEZONE;
  delete process.env.BUSINESS_TIMEZONE;
  assert.equal(getBusinessTimeZone(), 'Asia/Shanghai');
  process.env.BUSINESS_TIMEZONE = 'UTC';
  assert.equal(getBusinessTimeZone(), 'UTC');
  if (oldAppTimeZone === undefined) delete process.env.APP_TIMEZONE;
  else process.env.APP_TIMEZONE = oldAppTimeZone;
  if (oldBusinessTimeZone === undefined) delete process.env.BUSINESS_TIMEZONE;
  else process.env.BUSINESS_TIMEZONE = oldBusinessTimeZone;
});

test('formatDateInTimeZone uses China business day instead of UTC date', () => {
  const utcEvening = new Date('2026-05-21T16:30:00.000Z');
  assert.equal(formatDateInTimeZone(utcEvening, 'Asia/Shanghai'), '2026-05-22');
  assert.equal(formatDateInTimeZone(utcEvening, 'UTC'), '2026-05-21');
});

test('parseBusinessDate keeps common business date inputs stable', () => {
  assert.equal(parseBusinessDate('2026-05-07'), '2026-05-07');
  assert.equal(parseBusinessDate('2026年5月7日'), '2026-05-07');
  assert.equal(parseBusinessDate('2026年5月'), '2026-05-01');
  assert.equal(excelSerialToDateString(46143), '2026-05-01');
});

test('addDays performs calendar-date arithmetic', () => {
  assert.equal(addDays('2026-05-01', -1), '2026-04-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
