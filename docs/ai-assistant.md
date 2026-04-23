# AI 助手模块说明

## 概述

V6 新增统一 AI 副驾驶能力，为业务管理系统提供智能分析、风险预警、闭环检查、汇报辅助。

## 产品形态

### 入口
- **悬浮按钮**：右下角固定 AI 按钮，角标显示风险/未闭环数量
- **助手栏**：点击悬浮按钮展开右侧 Drawer，含4个模式 Tab
- **页面快捷按钮**：各核心页面顶部有 AI 快捷触发按钮

### 四个模式
1. **今日判断**：进入页面时的一句判断 + 结构化关注点
2. **风险与闭环**：风险项目识别 + 未闭环事项检查
3. **汇报与周会**：本周简报 / 周会议程 / 下周重点建议
4. **自由问答**：基于当前页面数据的对话式问答

## 后端架构

```
backend/src/ai/
  controllers/
    aiController.js         # 5个接口：panel/analyze/chat/briefing/badge-summary
  routes/
    aiRoutes.js             # 路由注册，复用 authenticate + injectAccessContext
  services/
    aiOrchestrator.js       # 统一编排器：模式路由
    aiContextService.js     # 上下文组装：数据拉取+衍生信号计算
    aiInsightService.js     # 今日判断
    aiRiskService.js        # 风险分析
    aiClosureService.js     # 闭环检查
    aiWeeklyBriefService.js # 简报生成
    aiMeetingService.js     # 周会辅助
    aiProjectDiagnosisService.js # 项目诊断
    aiPromptBuilder.js      # Prompt 分层构建
    aiLLMProvider.js        # LLM 调用抽象（DeepSeek）
    aiMockProvider.js       # Mock Fallback
  utils/
    riskRules.js            # 风险规则引擎
    closureRules.js         # 闭环规则引擎
    aiFormatters.js         # 输出格式化
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/ai/panel | 打开助手栏获取结构化内容 |
| POST | /api/ai/analyze | 页面内快捷动作 |
| POST | /api/ai/chat | 自由问答 |
| POST | /api/ai/briefing | 生成简报/周会 |
| GET | /api/ai/badge-summary | 角标数据 |

所有接口需要 `dashboard.read` 权限，自动注入数据范围控制。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| AI_LLM_PROVIDER | deepseek | LLM 提供商 |
| AI_LLM_API_KEY | (空) | API Key，留空走 Mock |
| AI_LLM_MODEL | deepseek-reasoner | 模型名 |
| AI_LLM_BASE_URL | https://api.deepseek.com | API 端点 |
| AI_LLM_MAX_TOKENS | 2000 | 最大 token |
| AI_LLM_TEMPERATURE | 0.7 | 温度 |

## 无 LLM Key 时

系统自动降级到 `aiMockProvider`，基于规则引擎输出结构化分析结果：
- 风险判断：基于 staleDays/dueInDays/进度状态/文本风险词
- 闭环检查：基于承诺追踪/重复拖延/闭环完整性
- 简报生成：基于模板拼接

**不会报错、不会崩**，只是输出缺少 LLM 润色。

## 页面接入

| 页面 | AI 按钮 | 默认模式 |
|------|---------|----------|
| Dashboard | AI 分析 | today_judgment |
| Week | 闭环检查 / 准备周会 | risk_closure |
| Projects | AI 风险 | risk_closure |
| Weekly Reports | AI 简报 / AI 周会议程 | briefing_meeting |

## 规则引擎

### 风险规则
- dueInDays ≤ 3 且非完成 → 高风险
- staleDays ≥ 7 → 高关注，≥ 3 → 待更新
- status = 风险/阻塞 → 高风险
- 进度落后于时间进度 → 进度风险
- 文本含"等待/延期/协调/未确认/资源不足" → 文本风险
- 高优先级但状态异常 → 优先级不匹配
- 需决策但无决策人 → 决策缺口

### 闭环规则
- 缺 next_action/action_owner/action_due_date → 闭环不完整
- 上周承诺无对应进展 → 未闭环
- 同类事项连续两周出现 → 重复拖延
- 风险状态但无风险说明 → 信息缺失

## 后续扩展

- 对话持久化（V2）
- 语音输入（V2）
- 嵌入式向量检索（V3）
- 主动推送预警（V3）
- 知识库沉淀（V3）
