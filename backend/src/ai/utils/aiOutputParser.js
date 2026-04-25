/**
 * LLM 输出解析器
 * 将 LLM 的自由文本输出解析为结构化数据
 */

/**
 * 尝试从 LLM 输出中提取 JSON 块
 * LLM 有时会用 ```json ... ``` 包裹 JSON
 * @param {string} text
 * @returns {Object|null}
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // 尝试1：整体就是 JSON
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    // 继续尝试
  }

  // 尝试2：从 ```json ... ``` 代码块中提取
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch (e) {
      // 继续尝试
    }
  }

  // 尝试3：找到第一个 { 和最后一个 }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch (e) {
      // 放弃
    }
  }

  return null;
}

/**
 * 解析 free_ask 模式的 LLM 输出
 * @param {string} llmOutput - LLM 原始输出
 * @returns {Object} { answer, sources, confidence }
 */
function parseChatOutput(llmOutput) {
  if (!llmOutput) return { answer: '', sources: [], confidence: '中' };

  // 先尝试 JSON 解析
  const json = extractJSON(llmOutput);
  if (json) {
    return {
      answer: json.answer || json.response || json.content || llmOutput,
      sources: json.sources || [],
      confidence: json.confidence || '中',
      suggestedFollowUps: json.suggestedFollowUps || json.follow_ups || [],
    };
  }

  // 纯文本：提取置信度标记
  let confidence = '中';
  let answer = llmOutput;
  const confMatch = llmOutput.match(/置信度[：:]\s*(高|中|低)/);
  if (confMatch) {
    confidence = confMatch[1];
    answer = llmOutput.replace(confMatch[0], '').trim();
  }

  return { answer, sources: [], confidence };
}

/**
 * 解析 panel 模式的 LLM 输出（今日判断/风险/汇报）
 * @param {string} llmOutput - LLM 原始输出
 * @param {string} mode - 模式
 * @returns {Object} { headline, items }
 */
function parsePanelOutput(llmOutput, mode) {
  if (!llmOutput) return { headline: '', items: [], rawAnalysis: llmOutput };

  // 尝试 JSON 解析
  const json = extractJSON(llmOutput);
  if (json) {
    return {
      headline: json.headline || '',
      items: json.cards || json.items || json.riskItems || json.unclosedItems || [],
      rawAnalysis: llmOutput,
    };
  }

  // 纯文本：尝试提取 headline
  const lines = llmOutput.split('\n').filter(l => l.trim());
  const headline = lines[0] ? lines[0].replace(/^[#\-*•]\s*/, '').substring(0, 30) : '';

  return {
    headline,
    items: [],
    rawAnalysis: llmOutput,
  };
}

/**
 * 清理 LLM 输出中的残留格式标记
 * @param {string} text
 * @returns {string}
 */
function cleanLLMOutput(text) {
  if (!text) return '';
  return text
    .replace(/```(?:json|markdown|md)?\s*\n?/g, '')
    .replace(/```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1') // 去掉 markdown 粗体
    .replace(/\*(.*?)\*/g, '$1')      // 去掉 markdown 斜体
    .trim();
}

module.exports = {
  extractJSON,
  parseChatOutput,
  parsePanelOutput,
  cleanLLMOutput
};
