const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('../src/utils/jwt');
const { validatePasswordStrength } = require('../src/utils/passwordPolicy');
const { isArchived, MODULE_MAP } = require('../src/services/archiveCheckService');
const { hashToken } = require('../src/services/refreshTokenService');

// ==================== Password Hashing Tests ====================
test('bcrypt hash produces different values for same password', async () => {
  const password = 'SecurePass123';
  const hash1 = await bcrypt.hash(password, 10);
  const hash2 = await bcrypt.hash(password, 10);
  assert.notEqual(hash1, hash2, 'Hashes should include unique salt');
});

test('bcrypt.compare succeeds with correct password', async () => {
  const password = 'TestPass456';
  const hash = await bcrypt.hash(password, 10);
  const result = await bcrypt.compare(password, hash);
  assert.ok(result, 'bcrypt.compare should return true for correct password');
});

test('bcrypt.compare fails with wrong password', async () => {
  const password = 'CorrectPass789';
  const hash = await bcrypt.hash(password, 10);
  const result = await bcrypt.compare('WrongPassword', hash);
  assert.ok(!result, 'bcrypt.compare should return false for wrong password');
});

test('password policy rejects short passwords', () => {
  const err = validatePasswordStrength('Ab1');
  assert.ok(err, 'Should reject password shorter than 8 chars');
});

test('password policy requires letters and numbers', () => {
  const err1 = validatePasswordStrength('12345678');
  assert.ok(err1, 'Should reject numbers-only password');

  const err2 = validatePasswordStrength('abcdefgh');
  assert.ok(err2, 'Should reject letters-only password');
});

test('password policy accepts valid strong passwords', () => {
  const err = validatePasswordStrength('ValidPass123');
  assert.equal(err, null, 'Should accept valid password');
});

// ==================== Token Generation Tests ====================
test('JWT sign and verify round-trip', () => {
  const payload = { id: 1, username: 'testuser', role: 'admin' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  assert.ok(token, 'Token should be generated');

  const decoded = jwt.verify(token, JWT_SECRET);
  assert.equal(decoded.id, 1);
  assert.equal(decoded.username, 'testuser');
  assert.equal(decoded.role, 'admin');
});

test('JWT verification rejects tampered tokens', () => {
  const payload = { id: 1, username: 'test' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const tampered = token.slice(0, -5) + 'xxxxx';

  assert.throws(
    () => jwt.verify(tampered, JWT_SECRET),
    /invalid/,
    'Should reject tampered token'
  );
});

test('JWT verification rejects tokens signed with wrong secret', () => {
  const payload = { id: 1 };
  const token = jwt.sign(payload, 'wrong-secret-key', { expiresIn: '1h' });

  assert.throws(
    () => jwt.verify(token, JWT_SECRET),
    /invalid/,
    'Should reject token with wrong secret'
  );
});

test('refresh token hash produces consistent output', () => {
  const token = 'test-refresh-token-12345';
  const hash1 = hashToken(token);
  const hash2 = hashToken(token);
  assert.equal(hash1, hash2, 'Hash should be deterministic');
  assert.equal(hash1.length, 64, 'SHA-256 hash should be 64 hex chars');
});

// ==================== Archive Check Tests ====================
test('isArchived returns false for invalid inputs', async () => {
  const result = await isArchived(null, null, null);
  assert.equal(result, false, 'Should return false for null inputs');

  const result2 = await isArchived('', 'Q1', 2026);
  assert.equal(result2, false, 'Should return false for empty module');
});

test('MODULE_MAP contains all expected modules', () => {
  const expectedModules = ['kpis', 'projects', 'performances', 'monthly_tasks', 'achievements'];
  for (const mod of expectedModules) {
    assert.equal(MODULE_MAP[mod], mod, `MODULE_MAP should contain ${mod}`);
  }
});
