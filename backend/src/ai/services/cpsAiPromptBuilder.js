function buildDailyInsightPrompt(ctx) {
  return `你是 CPS 连续包月业务分析师。请基于我提供的已计算数据生成当日洞察。

【业务规则】
1. 客诉率红线为 1%，0.8% 以上需要预警。
2. 新签退款率、续费退款率越高，说明用户质量或链路告知可能有问题。
3. 退款和解约是动态回写指标，不要把历史退款回写误判为当天突然爆发。
4. 有效签约数 = 新签 + 续费 - 新签退款 - 续费退款。
5. 实际订单数 = 新签 + 续费 - 售后退款。
6. 严禁编造数据，只能引用下方 JSON 中存在的数据。

【输入数据】
${JSON.stringify(ctx, null, 2)}

【输出要求】
只输出 JSON，不要 Markdown，不要多余解释。

{
  "headline": "30字以内核心结论",
  "risk_level": "low|medium|high|critical",
  "summary": "整体表现总结",
  "key_findings": [
    { "type": "good|bad|neutral", "scope": "全局/渠道/产品", "metric": "指标", "detail": "发现" }
  ],
  "risks": [
    { "level": "medium|high|critical", "scope": "渠道-产品", "reason": "原因", "suggestion": "具体处理建议" }
  ],
  "actions": [
    { "owner": "运营/渠道/管理者", "action": "具体动作", "expected_effect": "预期效果" }
  ]
}`;
}

function buildPeriodAnalysisPrompt(ctx) {
  return `你是 CPS 连续包月业务分析师。请基于周期数据做经营分析。

【业务规则】
- 优先关注客诉率、新签退款率、续费退款率、有效收入、有效签约数。
- 分析必须落到具体渠道和具体产品。
- 不要写空泛建议，例如"加强优化"；要写成"暂停/复查/调整/联系渠道/核查素材/核查落地页告知"。
- 严禁编造数据。

【周期数据】
${JSON.stringify(ctx, null, 2)}

【输出 JSON】
{
  "headline": "周期核心结论",
  "performance": "整体表现",
  "channel_ranking": [
    { "channel": "渠道名", "conclusion": "表现结论", "reason": "原因" }
  ],
  "product_ranking": [
    { "product": "产品名", "conclusion": "表现结论", "reason": "原因" }
  ],
  "risk_focus": [
    { "scope": "渠道-产品", "risk": "风险", "suggestion": "动作" }
  ],
  "next_period_actions": [
    { "owner": "负责人", "action": "动作", "priority": "P0|P1|P2" }
  ]
}`;
}

module.exports = {
  buildDailyInsightPrompt,
  buildPeriodAnalysisPrompt,
};
