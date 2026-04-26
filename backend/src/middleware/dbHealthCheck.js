/**
 * SQLite 只读检测 + 自动恢复中间件
 *
 * 问题：pm2 restart 会导致 SQLite 文件句柄残留，新进程无法写入
 * 解决：定期检测写入能力，发现只读时自动重连，并向客户端返回明确错误
 */

const sequelize = require('../../config/database');
const { Sequelize } = require('sequelize');

let dbReadOnly = false;
let lastCheckTime = 0;
const CHECK_INTERVAL = 30 * 1000; // 30秒检测一次
const RECONNECT_COOLDOWN = 60 * 1000; // 重连冷却60秒
let lastReconnectTime = 0;

/**
 * 检测数据库是否可写
 * 执行一个轻量级写操作（创建临时表 → 删除），判断 SQLITE_READONLY
 */
async function checkDbWritable() {
  try {
    // 用原始 SQL 做最小化写测试
    await sequelize.query('CREATE TEMP TABLE __health_check (id INTEGER); DROP TABLE IF EXISTS __health_check;');
    dbReadOnly = false;
    return true;
  } catch (err) {
    if (err.original && (err.original.code === 'SQLITE_READONLY' || err.message.includes('readonly'))) {
      console.error('[DB健康检查] ⚠️ 检测到 SQLITE_READONLY，数据库进入只读状态！');
      dbReadOnly = true;
      return false;
    }
    // 其他错误不算只读
    return true;
  }
}

/**
 * 尝试重连数据库
 */
async function tryReconnect() {
  const now = Date.now();
  if (now - lastReconnectTime < RECONNECT_COOLDOWN) {
    console.log('[DB健康检查] 重连冷却中，跳过');
    return false;
  }
  lastReconnectTime = now;

  try {
    console.log('[DB健康检查] 尝试关闭旧连接并重连...');
    await sequelize.close();

    // 等待一小段时间让文件句柄释放
    await new Promise(resolve => setTimeout(resolve, 1000));

    await sequelize.authenticate();
    console.log('[DB健康检查] ✅ 重连成功');

    // 重连后验证写入
    const writable = await checkDbWritable();
    if (writable) {
      dbReadOnly = false;
      console.log('[DB健康检查] ✅ 数据库写入恢复正常');
      return true;
    } else {
      console.error('[DB健康检查] ❌ 重连后仍然只读，可能需要 pm2 delete + start');
      return false;
    }
  } catch (err) {
    console.error('[DB健康检查] ❌ 重连失败:', err.message);
    return false;
  }
}

/**
 * 定期健康检查（作为后台任务）
 */
async function periodicCheck() {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL) return;
  lastCheckTime = now;

  const writable = await checkDbWritable();
  if (!writable) {
    await tryReconnect();
  }
}

/**
 * Express 中间件：拦截 SQLITE_READONLY 错误
 * 放在路由之前，作为全局错误拦截器
 */
function dbReadOnlyGuard(err, req, res, next) {
  if (err && (err.code === 'SQLITE_READONLY' ||
      (err.original && err.original.code === 'SQLITE_READONLY') ||
      (err.parent && err.parent.code === 'SQLITE_READONLY') ||
      err.message?.includes('readonly database'))) {

    console.error(`[DB只读拦截] ${req.method} ${req.url} → SQLITE_READONLY`);

    // 异步尝试重连（不阻塞响应）
    tryReconnect().catch(() => {});

    return res.status(503).json({
      code: 503,
      message: '数据库暂时无法写入，系统正在自动恢复中，请稍后重试。如果问题持续，请联系管理员执行 pm2 delete + start。',
      error_type: 'DB_READONLY',
      data: null
    });
  }
  next(err);
}

/**
 * 请求前置检查中间件：在写操作前检查数据库状态
 */
function dbWriteGuard(req, res, next) {
  // 只拦截写操作
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (dbReadOnly) {
      // 尝试重连
      tryReconnect().then(ok => {
        if (ok) {
          next();
        } else {
          return res.status(503).json({
            code: 503,
            message: '数据库暂时无法写入，系统正在自动恢复中，请稍后重试。',
            error_type: 'DB_READONLY',
            data: null
          });
        }
      }).catch(() => {
        return res.status(503).json({
          code: 503,
          message: '数据库暂时无法写入，请稍后重试。',
          error_type: 'DB_READONLY',
          data: null
        });
      });
      return;
    }

    // 周期性检查（不阻塞请求）
    periodicCheck().catch(() => {});
  }
  next();
}

/**
 * 获取当前 DB 只读状态
 */
function isDbReadOnly() {
  return dbReadOnly;
}

module.exports = {
  dbReadOnlyGuard,
  dbWriteGuard,
  checkDbWritable,
  isDbReadOnly,
  periodicCheck
};
