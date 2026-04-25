/**
 * LLM Provider 抽象层
 * 支持 DeepSeek / OpenAI 兼容接口
 */

const axios = require('axios');

const LLM_CONFIG = {
  provider: process.env.AI_LLM_PROVIDER || 'deepseek',
  apiKey: process.env.AI_LLM_API_KEY || '',
  model: process.env.AI_LLM_MODEL || 'deepseek-v4-pro',
  baseUrl: process.env.AI_LLM_BASE_URL || 'https://api.deepseek.com',
  maxTokens: parseInt(process.env.AI_LLM_MAX_TOKENS) || 800,
  temperature: parseFloat(process.env.AI_LLM_TEMPERATURE) || 0.5,
};

/**
 * 检查 LLM 是否可用
 */
function isAvailable() {
  return !!LLM_CONFIG.apiKey;
}

/**
 * 调用 LLM
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPrompt - 用户提示词
 * @param {Object} options - 可选参数
 * @returns {Promise<string>} LLM 回复内容
 */
async function call(systemPrompt, userPrompt, options = {}) {
  if (!isAvailable()) {
    throw new Error('LLM API Key 未配置');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const requestBody = {
    model: options.model || LLM_CONFIG.model,
    messages,
    max_tokens: options.maxTokens || LLM_CONFIG.maxTokens,
    temperature: options.temperature !== undefined ? options.temperature : LLM_CONFIG.temperature,
  };

  const url = `${LLM_CONFIG.baseUrl}/v1/chat/completions`;

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
      },
      timeout: 30000, // 30s timeout (chat model is fast)
    });

    const choice = response.data?.choices?.[0];
    if (!choice) throw new Error('LLM 返回空结果');

    // DeepSeek Reasoner 返回 reasoning_content + content
    const content = choice.message?.content || '';
    return content;
  } catch (err) {
    if (err.response) {
      console.error('LLM API 错误:', err.response.status, err.response.data);
      throw new Error(`LLM API 错误: ${err.response.status}`);
    }
    throw err;
  }
}

/**
 * 流式调用 LLM（SSE）
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {Object} options
 * @param {Function} onChunk - 每收到一个 chunk 调用 onChunk(text)
 * @returns {Promise<string>} 完整的 LLM 回复
 */
async function callStream(systemPrompt, userPrompt, options = {}, onChunk = null) {
  if (!isAvailable()) {
    throw new Error('LLM API Key 未配置');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const requestBody = {
    model: options.model || LLM_CONFIG.model,
    messages,
    max_tokens: options.maxTokens || LLM_CONFIG.maxTokens,
    temperature: options.temperature !== undefined ? options.temperature : LLM_CONFIG.temperature,
    stream: true,
  };

  const url = `${LLM_CONFIG.baseUrl}/v1/chat/completions`;

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
      },
      timeout: 60000, // 流式调用 timeout 更长
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      let fullContent = '';
      const stream = response.data;

      stream.on('data', (chunk) => {
        const text = chunk.toString();
        // 解析 SSE 格式: data: {...}\n\n
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              if (onChunk) onChunk(delta);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      });

      stream.on('end', () => {
        resolve(fullContent);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  } catch (err) {
    if (err.response) {
      console.error('LLM Stream API 错误:', err.response.status);
      throw new Error(`LLM Stream API 错误: ${err.response.status}`);
    }
    throw err;
  }
}

module.exports = {
  isAvailable,
  call,
  callStream,
  LLM_CONFIG
};
