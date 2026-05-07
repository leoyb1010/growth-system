const crypto = require('crypto');

function normalizeAscii(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function randomSuffix() {
  return crypto.randomBytes(3).toString('hex');
}

function safeCode(input, prefix = 'cps') {
  const normalized = normalizeAscii(input);
  if (normalized) return normalized;
  return `${prefix}_${Date.now().toString(36)}_${randomSuffix()}`;
}

function isUniqueConstraintError(err) {
  return err && (
    err.name === 'SequelizeUniqueConstraintError' ||
    err.name === 'SequelizeDatabaseError' && /unique|UNIQUE/i.test(err.message || '')
  );
}

module.exports = { normalizeAscii, safeCode, isUniqueConstraintError };
