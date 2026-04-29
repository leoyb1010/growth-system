/**
 * AI 输出格式化工具
 */

/**
 * 格式化卡片输出
 */
function formatInsightCard(card) {
  return {
    id: card.id || `card_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: card.type || 'info', // info / warning / danger / success / action
    title: card.title || '',
    description: card.description || '',
    icon: card.icon || '',
    tags: card.tags || [],
    actions: (card.actions || []).map(a => ({
      key: a.key,
      label: a.label,
      type: a.type || 'default' // default / primary / danger
    })),
    meta: card.meta || {} // 额外数据
  };
}

/**
 * 格式化快捷动作
 */
function formatAction(action) {
  return {
    key: action.key,
    label: action.label,
    icon: action.icon || '',
    mode: action.mode || '', // 触发的 AI 模式
    params: action.params || {} // 额外参数
  };
}

/**
 * 统一 AI 响应格式
 */
function formatAIResponse(data) {
  return {
    headline: data.headline || '',
    badgeCount: data.badgeCount || 0,
    mode: data.mode || '',
    cards: (data.cards || []).map(formatInsightCard),
    actions: (data.actions || []).map(formatAction),
    rawAnalysis: data.rawAnalysis || null, // LLM 原始输出（可选）
    isMock: data.isMock || false,
    sources: (data.sources || []).map(s => ({
      type: s.type || 'unknown',
      id: s.id ?? null,
      title: s.title || ''
    })),
    suggestedActions: (data.suggestedActions || []).map(a => ({
      key: a.key || '',
      label: a.label || '',
      params: a.params || {},
      confirmRequired: a.confirmRequired || false
    })),
    confidence: data.confidence ?? 0.5
  };
}

/**
 * 格式化聊天响应
 */
function formatChatResponse(data) {
  // Resolve confidenceLevel (string "高"/"中"/"低") and numeric confidence
  let confidenceLevel = '中';
  let numericConfidence = 0.5;
  if (typeof data.confidence === 'number') {
    numericConfidence = data.confidence;
    // Derive confidenceLevel from numeric value
    confidenceLevel = numericConfidence >= 0.8 ? '高' : numericConfidence >= 0.5 ? '中' : '低';
  } else if (typeof data.confidence === 'string') {
    confidenceLevel = data.confidence;
    // Derive numeric from string
    numericConfidence = confidenceLevel === '高' ? 0.85 : confidenceLevel === '低' ? 0.3 : 0.5;
  }
  if (data.confidenceLevel && typeof data.confidenceLevel === 'string') {
    confidenceLevel = data.confidenceLevel;
  }
  return {
    answer: data.answer || '',
    sources: data.sources || [],
    sourceLabels: (data.sources || []).map(s => typeof s === 'string' ? s : s.title).filter(Boolean),
    suggestedFollowUps: data.suggestedFollowUps || [],
    confidence: numericConfidence,
    confidenceLevel,
    isMock: data.isMock || false,
    suggestedActions: (data.suggestedActions || []).map(a => ({
      key: a.key || '',
      label: a.label || '',
      params: a.params || {},
      confirmRequired: a.confirmRequired || false
    }))
  };
}

/**
 * 格式化简报响应
 */
function formatBriefingResponse(data) {
  return {
    type: data.type || 'brief', // brief / agenda / summary
    title: data.title || '',
    content: data.content || '',
    sections: data.sections || [], // 分段内容
    actions: (data.actions || []).map(formatAction),
    isMock: data.isMock || false
  };
}

module.exports = {
  formatInsightCard,
  formatAction,
  formatAIResponse,
  formatChatResponse,
  formatBriefingResponse
};
