/**
 * M1 契约测试：/auth/refresh 支持「body 传 refresh_token」并在 body 回传轮转后的 refresh_token。
 * 这是原生 App（无 Cookie）的鉴权刚需；Web 的 Cookie 路径不受影响。
 *
 * 用 mock 替换 refreshTokenService，避免依赖数据库，专注验证控制器对「来源/出参」的契约。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// —— 拦截 require，给 authController 注入可控的依赖 ——
const realLoad = Module._load;
const fakeUser = { id: 1, username: 'admin', role: 'admin', dept_id: null };
const stubs = {
  '../services/refreshTokenService': {
    generateAccessToken: () => 'NEW_ACCESS',
    generateRefreshToken: async () => 'RT_LOGIN',
    verifyAndRotateRefreshToken: async (tok) => {
      if (tok === 'RT_VALID') return { user: fakeUser, refreshToken: 'RT_ROTATED' };
      return null; // 无效/已用过
    },
    revokeAllUserTokens: async () => {},
  },
};

let authController;
{
  const path = require('node:path');
  const ctrlPath = path.resolve(__dirname, '../src/controllers/authController.js');
  Module._load = function (request, parent, isMain) {
    if (parent && parent.filename === ctrlPath && stubs[request]) return stubs[request];
    return realLoad.apply(this, arguments);
  };
  delete require.cache[ctrlPath];
  authController = require(ctrlPath);
  Module._load = realLoad;
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    cookie(name, val) { this.cookies.push({ name, val }); return this; },
    clearCookie() { return this; },
  };
}

test('refresh: 从 body.refresh_token 读取并回传轮转后的 refresh_token', async () => {
  const req = { body: { refresh_token: 'RT_VALID' }, headers: {} };
  const res = mockRes();
  await authController.refreshToken(req, res);
  assert.equal(res.body.code, 0, '应成功');
  assert.equal(res.body.data.token, 'NEW_ACCESS', '应返回新 access token');
  assert.equal(res.body.data.refresh_token, 'RT_ROTATED', '应在 body 回传轮转后的 refresh_token');
});

test('refresh: 兼容旧的 camelCase refreshToken 字段', async () => {
  const req = { body: { refreshToken: 'RT_VALID' }, headers: {} };
  const res = mockRes();
  await authController.refreshToken(req, res);
  assert.equal(res.body.code, 0);
  assert.equal(res.body.data.token, 'NEW_ACCESS');
});

test('refresh: 缺少 token → 400', async () => {
  const req = { body: {}, headers: {} };
  const res = mockRes();
  await authController.refreshToken(req, res);
  assert.equal(res.statusCode, 400);
});

test('refresh: 无效 token → 401', async () => {
  const req = { body: { refresh_token: 'RT_USED' }, headers: {} };
  const res = mockRes();
  await authController.refreshToken(req, res);
  assert.equal(res.statusCode, 401);
});
