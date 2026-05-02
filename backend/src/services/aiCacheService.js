const crypto = require('crypto');
const { AiResultCache } = require('../models');

function createCacheKey(taskType, payload) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ taskType, payload }))
    .digest('hex');
  return `${taskType}:${hash}`;
}

async function getCached(cacheKey) {
  try {
    const row = await AiResultCache.findOne({ where: { cache_key: cacheKey } });
    if (!row || new Date(row.expires_at) < new Date()) return null;
    return JSON.parse(row.result_json);
  } catch (err) {
    console.error('AI 缓存读取失败:', err.message);
    return null;
  }
}

async function setCached(cacheKey, taskType, result, ttlSeconds) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await AiResultCache.upsert({
      cache_key: cacheKey,
      task_type: taskType,
      result_json: JSON.stringify(result),
      expires_at: expiresAt,
      created_at: new Date()
    });
  } catch (err) {
    console.error('AI 缓存写入失败:', err.message);
  }
}

const TASK_CACHE_TTL = {
  weekly_brief: 300,
  risk_analysis: 180,
  dashboard_insight: 300,
  project_diagnosis: 120,
  closure_review: 300
};

module.exports = { createCacheKey, getCached, setCached, TASK_CACHE_TTL };
