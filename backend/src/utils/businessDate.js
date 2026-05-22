const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

function getBusinessTimeZone() {
  return process.env.APP_TIMEZONE || process.env.BUSINESS_TIMEZONE || DEFAULT_TIME_ZONE;
}

function formatDateInTimeZone(value = new Date(), timeZone = getBusinessTimeZone()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function todayString() {
  return formatDateInTimeZone(new Date());
}

function addDays(dateValue, days) {
  const parsed = parseBusinessDate(dateValue);
  const [year, month, day] = parsed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function yesterdayString() {
  return addDays(todayString(), -1);
}

function excelSerialToDateString(value) {
  const timestamp = Math.round((Number(value) - 25569) * 86400000);
  return new Date(timestamp).toISOString().slice(0, 10);
}

function parseBusinessDate(value, fallback = todayString()) {
  if (value === null || value === undefined || value === '') return fallback;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateInTimeZone(value);
  }

  if (typeof value === 'number' && value > 40000 && value < 60000) {
    return excelSerialToDateString(value);
  }

  const text = String(value).trim();

  const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  const mDay = text.match(/(\d{4})?[年\-\/]?(\d{1,2})[月\-\/](\d{1,2})[日号]?/);
  if (mDay && mDay[1]) {
    return `${mDay[1]}-${mDay[2].padStart(2, '0')}-${mDay[3].padStart(2, '0')}`;
  }
  if (mDay) {
    const year = formatDateInTimeZone(new Date()).slice(0, 4);
    return `${year}-${mDay[2].padStart(2, '0')}-${mDay[3].padStart(2, '0')}`;
  }

  const ym = text.match(/^(\d{4})?[年\-\/]?(\d{1,2})[月]?$/);
  if (ym && ym[1]) return `${ym[1]}-${ym[2].padStart(2, '0')}-01`;
  if (ym) {
    const year = formatDateInTimeZone(new Date()).slice(0, 4);
    return `${year}-${ym[2].padStart(2, '0')}-01`;
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return formatDateInTimeZone(date);

  return text.slice(0, 10);
}

module.exports = {
  DEFAULT_TIME_ZONE,
  getBusinessTimeZone,
  formatDateInTimeZone,
  todayString,
  yesterdayString,
  addDays,
  parseBusinessDate,
  excelSerialToDateString,
};
