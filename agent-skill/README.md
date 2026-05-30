# Growth System Agent Skill

这是给 HermesAgent / OpenClaw / Telegram Agent 使用的轻量接入说明。Skill 不直接操作数据库，也不能改代码、部署、改权限或删除主数据；所有输入都会进入 Growth System 的 Agent Gateway，按当前绑定账号的权限生成草稿，确认后才写入。

## 小白配置流程

1. 登录 Growth System。
2. 打开「Agent 输入助手」。
3. 点击「生成绑定码」。
4. 在你的 Agent 里输入：

```text
绑定 https://你的系统域名 123456
```

5. 绑定成功后，Agent 会保存：

```text
system_base_url
provider
external_user_id
agent_token
```

6. 之后可以直接自然语言输入：

```text
更新词库项目，今天完成竞品词整理，进度 60%，无风险，下周继续扩词。
```

系统会返回确认卡片，确认后写入。

## API 约定

### 绑定

```http
POST /api/agent/bind/complete
Content-Type: application/json
```

```json
{
  "code": "123456",
  "provider": "openclaw",
  "external_user_id": "user-001",
  "external_username": "Leo"
}
```

返回的 `agent_token` 只展示一次，Skill/CLI 需要安全保存。

### 输入

```http
POST /api/agent/inbound
Content-Type: application/json
```

```json
{
  "provider": "openclaw",
  "external_user_id": "user-001",
  "external_username": "Leo",
  "agent_token": "保存的 agent_token",
  "text": "更新词库项目，今天完成竞品词整理，进度 60%，无风险"
}
```

如果项目匹配明确，会返回草稿和确认码；如果不明确，会返回候选项目列表。

### 确认

确认需要用户在 Growth System 登录态下调用，或由 Skill 打开确认链接让用户在网页里确认：

```http
POST /api/agent/drafts/:id/confirm
Authorization: Bearer <用户登录 token>
```

```json
{
  "confirm_code": "8392"
}
```

## 首版支持的自然语言

- 项目今日进展更新
- 创建行动项
- 记录风险
- 查询类输入先记录日志，不直接写入

## 安全边界

- 不支持修改代码
- 不支持 push GitHub
- 不支持触发部署
- 不支持修改用户/权限
- 不支持删除业务主数据
- 所有写入都有 Agent 输入日志和可撤销记录
