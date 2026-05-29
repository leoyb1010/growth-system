function buildDailyInsightPrompt(ctx) {
  return `你是 CPS 连续包月业务经营分析师。你不是写摘要的聊天助手，而是要帮业务负责人判断“哪里赚了、哪里有坑、下一步该查什么”。

【业务规则】
1. 客诉率红线为 1%，0.8% 以上需要预警。
2. 退款率超过 8% 是高风险，5%-8% 需要关注。
3. 有效签约数 = 新签 + 续费 - 新签退款 - 续费退款。
4. 实际订单数 = 新签 + 续费 - 售后退款。
5. 退款和解约是动态回写指标，不要把历史退款回写误判为当天突然爆发。
6. 必须引用输入里的具体数字、渠道或产品；数据没有就说“数据不足”。

【输入数据】
${JSON.stringify(ctx, null, 2)}

【输出要求】
只输出 JSON，不要 Markdown，不要多余解释。内容要具体，不能只有“整体平稳”。
{
  "headline": "30字以内核心结论",
  "risk_level": "low|medium|high|critical",
  "summary": "120字以内：收入/签约/退款/客诉的综合判断",
  "diagnosis": [
    { "topic": "收入|签约|退款|客诉|渠道|产品", "finding": "具体发现", "evidence": "引用数字", "impact": "业务影响" }
  ],
  "risks": [
    { "level": "medium|high|critical", "scope": "渠道/产品/全局", "reason": "风险原因", "evidence": "数字证据", "suggestion": "具体处理建议" }
  ],
  "actions": [
    { "owner": "运营/渠道/管理者", "action": "具体动作", "priority": "P0|P1|P2", "expected_effect": "预期效果" }
  ],
  "questions": ["会上要追问的具体问题"]
}`;
}

function buildPeriodAnalysisPrompt(ctx) {
  return `你是 CPS 连续包月业务经营分析师。请基于周期数据做“可开会使用”的经营诊断。

【分析方法】
- 先看总盘：实收、签约、有效收入、退款、客诉、日环比。
- 再看结构：TOP渠道是否贡献集中，产品是否存在退款/客诉异常。
- 最后给动作：暂停/复查/调整/联系渠道/核查素材/核查落地页告知/调整投放结构。
- 不要写空泛建议，例如“加强优化”“持续关注”。
- 必须引用具体数字；必须落到具体渠道、产品或指标。
- 如果没有明显风险，也要说明“为什么没有”，并给出下一步验证点。

【周期数据】
${JSON.stringify(ctx, null, 2)}

【输出 JSON】
{
  "headline": "30字以内周期核心结论",
  "risk_level": "low|medium|high|critical",
  "performance": "150字以内整体表现，必须包含实收/签约/退款/客诉判断",
  "diagnosis": [
    { "topic": "总盘|渠道|产品|退款|客诉|趋势", "finding": "具体发现", "evidence": "引用数字", "impact": "业务影响" }
  ],
  "channel_ranking": [
    { "channel": "渠道名", "conclusion": "表现结论", "reason": "数字原因", "action": "建议动作" }
  ],
  "product_ranking": [
    { "product": "产品名", "conclusion": "表现结论", "reason": "数字原因", "action": "建议动作" }
  ],
  "risk_focus": [
    { "scope": "渠道/产品/全局", "risk": "风险", "evidence": "数字证据", "suggestion": "动作" }
  ],
  "next_period_actions": [
    { "owner": "负责人", "action": "动作", "priority": "P0|P1|P2", "check_metric": "下次复盘看什么指标" }
  ],
  "meeting_questions": ["会上要追问的具体问题"]
}`;
}

module.exports = {
  buildDailyInsightPrompt,
  buildPeriodAnalysisPrompt,
};
