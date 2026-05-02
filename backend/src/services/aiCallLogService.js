const { AiCallLog } = require('../models');

/**
 * 记录 AI 调用日志
 */
async function logAICall({ userId, taskType, provider, success, latencyMs, usage, errorMessage, requestHash }) {
  try {
    await AiCallLog.create({
      user_id: userId || null,
      task_type: taskType,
      provider,
      success: !!success,
      latency_ms: latencyMs || null,
      prompt_tokens: usage?.prompt_tokens || usage?.promptTokens || null,
      completion_tokens: usage?.completion_tokens || usage?.completionTokens || null,
      total_tokens: usage?.total_tokens || usage?.totalTokens || null,
      error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
      request_hash: requestHash || null
    });
  } catch (err) {
    console.error('AI 调用日志记录失败:', err.message);
  }
}

module.exports = { logAICall };
