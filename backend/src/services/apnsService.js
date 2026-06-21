/**
 * APNs 推送服务（token-based，HTTP/2 + JWT(ES256)）
 * ------------------------------------------------------------------
 * 设计：
 *  - 凭证全部走环境变量，账号/证书相关由运维(你)配置，代码不内置任何密钥。
 *  - 未配置凭证时 isConfigured()=false，所有发送优雅空跑，绝不影响线上其它功能。
 *  - JWT token 缓存 ~50 分钟（APNs 要求 < 60 分钟）。
 *  - 410 Unregistered 的设备 token 交由上层失活，避免反复推送死 token。
 *
 * 需要的环境变量（在各机 .env 自维护）：
 *  APNS_KEY_PATH   .p8 私钥文件绝对路径
 *  APNS_KEY_ID     Key ID（10位）
 *  APNS_TEAM_ID    Apple Team ID（10位）
 *  APNS_BUNDLE_ID  App Bundle ID（apns-topic）
 *  APNS_ENV        production | sandbox（默认 sandbox）
 */
const fs = require('fs');
const http2 = require('http2');
const jwt = require('jsonwebtoken');

const CFG = {
  keyPath: process.env.APNS_KEY_PATH || '',
  keyId: process.env.APNS_KEY_ID || '',
  teamId: process.env.APNS_TEAM_ID || '',
  bundleId: process.env.APNS_BUNDLE_ID || '',
  env: (process.env.APNS_ENV || 'sandbox').toLowerCase(),
};

const HOST = CFG.env === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';

let cachedKey = null;
let cachedToken = null;
let cachedTokenAt = 0;

function isConfigured() {
  if (!CFG.keyPath || !CFG.keyId || !CFG.teamId || !CFG.bundleId) return false;
  try {
    if (!cachedKey) cachedKey = fs.readFileSync(CFG.keyPath, 'utf8');
    return !!cachedKey;
  } catch (e) {
    return false;
  }
}

// 生成/复用 provider JWT（APNs 按 iat 判 1 小时有效期；不能带 exp，否则可能被拒）
function getProviderToken() {
  const now = Date.now();
  if (cachedToken && now - cachedTokenAt < 50 * 60 * 1000) return cachedToken;
  cachedToken = jwt.sign({}, cachedKey, {
    algorithm: 'ES256',
    issuer: CFG.teamId,
    keyid: CFG.keyId,   // 设置 JWT header 的 kid
    // 不设 expiresIn：APNs 要求 token 仅含 iss + iat（iat 由库自动添加）
  });
  cachedTokenAt = now;
  return cachedToken;
}

function buildPayload({ title, body, badge, sound = 'default', data = {} }) {
  const aps = { alert: { title, body }, sound };
  if (badge != null) aps.badge = badge;
  return JSON.stringify({ aps, ...data });
}

// 向单个 session 发一条；resolve { token, ok, status, reason }
function postOne(session, providerToken, deviceToken, payload, collapseId) {
  return new Promise((resolve) => {
    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken}`,
      'apns-topic': CFG.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    };
    if (collapseId) headers['apns-collapse-id'] = String(collapseId).slice(0, 64);

    const req = session.request(headers);
    let status = 0;
    let respBody = '';
    req.on('response', (h) => { status = Number(h[':status']) || 0; });
    req.setEncoding('utf8');
    req.on('data', (c) => { respBody += c; });
    req.on('end', () => {
      let reason = null;
      if (status !== 200) { try { reason = JSON.parse(respBody).reason; } catch (e) { reason = respBody || `HTTP ${status}`; } }
      resolve({ token: deviceToken, ok: status === 200, status, reason });
    });
    req.on('error', (err) => resolve({ token: deviceToken, ok: false, status: 0, reason: err.message }));
    req.write(payload);
    req.end();
  });
}

/**
 * 给一组设备 token 发同一条通知。
 * @returns {Promise<{sent:number, failed:number, invalidTokens:string[], skipped?:boolean, results?:Array}>}
 */
async function sendToTokens(tokens, notification) {
  const list = (tokens || []).filter(Boolean);
  if (!list.length) return { sent: 0, failed: 0, invalidTokens: [] };
  if (!isConfigured()) return { sent: 0, failed: 0, invalidTokens: [], skipped: true };

  const providerToken = getProviderToken();
  const payload = buildPayload(notification);
  const collapseId = notification.collapseId;

  const session = http2.connect(HOST);
  // 持久 error 监听：连接建立后若再报错（如对端断开），避免变成未捕获异常拖垮进程
  session.on('error', (e) => console.error('APNs session error:', e.message));
  const results = [];
  try {
    await new Promise((resolve, reject) => {
      session.once('connect', resolve);
      session.once('error', reject);
      setTimeout(() => reject(new Error('APNs 连接超时')), 8000);
    });
    for (const t of list) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await postOne(session, providerToken, t, payload, collapseId));
    }
  } catch (e) {
    return { sent: 0, failed: list.length, invalidTokens: [], error: e.message };
  } finally {
    try { session.close(); } catch (e) { /* noop */ }
  }

  const invalidTokens = results.filter(r => r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered').map(r => r.token);
  return {
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    invalidTokens,
    results,
  };
}

module.exports = { isConfigured, sendToTokens, _config: CFG };
