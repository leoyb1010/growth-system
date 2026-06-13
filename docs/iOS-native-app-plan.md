# 增长系统 · 原生 iOS App 方案（非 PWA）

> 评估基线：线上 v1.20.0（Express + Sequelize/SQLite + Cloudflare Tunnel + DeepSeek AI 侧车 + Agent 网关 + 飞书）
> 结论先行：**当前后端已具备支撑原生 iOS App 的几乎全部条件**——~130 个 REST 接口、统一响应封装、JWT(15min)+RefreshToken(7d) 双令牌、AI 走标准 SSE、Cloudflare 提供 HTTPS（满足 ATS）。**只需后端做 1 个必改 + 几个小增强**，前端用 SwiftUI 原生重写，复用全部现有服务与数据仓，不碰数据库结构。

---

## 一、全量现状评估（App 能直接吃到什么）

### 1.1 后端 API 能力（已上线，可直接复用）

| 域 | 关键接口 | App 用途 |
|---|---|---|
| 认证 | `/auth/login` `/auth/refresh` `/auth/me` `/auth/change-password` `/auth/logout` | 登录态、令牌刷新、改密 |
| 驾驶舱 | `/dashboard` `/dashboard/today-changes` `/dashboard/week-focus` `/dashboard/week-summary` `/dashboard/top3` | 首页「今天/本周」卡片 |
| 项目 | `/projects` `/projects/:id/quick-update` `/projects/:id/relations` `/projects/:id/update-logs` `/projects/stale` | 项目列表/看板/就地更新/360 视图 |
| 指标 | `/kpis` `/performances` `/kpis/dashboard` `/performances/dashboard` | 指标达成 |
| 沉淀 | `/monthly-tasks` `/achievements` | 月度/成果 |
| 周报 | `/weekly-reports` `/…/generate` `/…/:id/png` `/…/:id/assets*` | 周报查看/生成/配图/导出 |
| 闭环 | `/action-items` `/risk-register` | 动作项/风险台账 |
| CPS | `/cps/dashboard` `/cps/metrics` `/cps/channel-entry` `/cps/alerts` | 渠道看板/录入/预警 |
| ASO | `/aso/dashboard` `/aso/daily-metrics` `/aso/keywords` | ASO 看板/日报 |
| AI | `/ai/chat-stream`(SSE) `/ai/analyze` `/ai/briefing` `/ai/personal-digest` `/ai/badge-summary` `/ai/materialize-actions` | AI 副驾/简报/待办物化 |
| Agent | `/agent/*` | （管理向，App 一期可不做） |
| 平台 | `/search` `/audit-logs` `/users` `/departments` `/export/:module` | 搜索/审计/用户/导出 |

**统一约定**（对 App 极友好）：
- 响应封装一致：`{ code: 0, data, message }`，错误 `code != 0` + HTTP 状态码。
- 鉴权统一：`Authorization: Bearer <accessToken>`。
- 数据范围隔离已在后端落地（all/department/self/cps_channel），**App 不需要自己做权限过滤**，跟着接口返回即可。

### 1.2 认证机制（决定 App 安全架构）

- **Access Token**：JWT，`15min` 过期，登录后在 body `data.token` 返回 → 存 **iOS Keychain**。
- **Refresh Token**：`7d`，目前登录时**仅以 httpOnly Cookie**（path=`/api/auth/refresh`）下发。
- **关键发现**：`/auth/refresh` 已支持**从 body 读 refreshToken**（`legacyBodyToken` 兜底），但**登录响应不在 body 里返回 refreshToken**。
  → 这是 App 需要的**唯一一个后端必改点**（见 §三）。
- 安全相关已就绪：`token_version`（改密/强制重登即时失效旧令牌）、`must_change_password`（首登必改）、禁用/待审核拦截、登录限流 5/min。

### 1.3 AI / 实时

- `/ai/chat-stream` 是标准 **SSE**（`data: {type:'content'|'done'|'error', ...}\n\n`）→ iOS 用 `URLSession.bytes` 逐行解析即可做打字机效果。
- 其余 AI 接口是普通 JSON，含 mock/规则降级，**离线/LLM 不可用也有结果**。

### 1.4 网络 / 部署

- 公网入口走 **Cloudflare Tunnel**（TLS 由 CF 提供）→ 天然满足 iOS **ATS（强制 HTTPS）**，无需为 App 关闭 ATS。
- 端口 58931，前端静态由后端托管；App 直接打 `https://<你的隧道域名>/api/...`。

### 1.5 推送 / 数据规模

- 现有「推送」只有**飞书 webhook**（服务端→飞书），**没有 APNs**。原生推送是净新增（见 §六，可选）。
- 团队内部工具量级（~11 用户、数渠道），并发与数据量小 → App 端不需要复杂分页/虚拟化即可流畅。

### 1.6 适合 / 不适合放进 App 的功能

| 适合移动端（一期主推） | 放后置/仅 Web（二期或不做） |
|---|---|
| 驾驶舱「今天/本周」速览 | 批量 Excel 导入（`/import/excel`、CPS/ASO import） |
| 项目列表/看板/就地更新（quick-update） | 用户管理/部门管理/审计日志（管理向） |
| 周报查看 + 一键生成 + 配图 + 导出分享 | Agent 网关管理（高权限、低频） |
| AI 副驾问答（SSE）/ 备会简报 / 待办物化 | 大表格密集编辑（移动端体验差） |
| 动作项/风险 快速建与状态流转 | 复杂多列筛选导出 |
| CPS 渠道日报录入（渠道账号刚需，手机现场录） | |
| 个人摘要 / 红点（badge-summary） | |

---

## 二、技术选型（原生，非 PWA）

| 维度 | 选型 | 理由 |
|---|---|---|
| 语言/UI | **Swift 5.9+ / SwiftUI**（iOS 16+） | 原生、声明式、与现有「卡片/驾驶舱」UI 语言契合；iOS16 覆盖率足够 |
| 架构 | **MVVM + 单向数据流**（`@Observable` / `ObservableObject`） | 与 React 组件心智一致，便于把现有页面逻辑平移 |
| 网络 | **URLSession + async/await**，自研轻量 `APIClient` | 无需第三方；SSE 用 `URLSession.bytes`；统一注入 Bearer/刷新/错误码 |
| 令牌存储 | **Keychain**（access+refresh），内存态缓存 user | 安全合规，App 重启免登 |
| 持久化/离线 | **SwiftData**（iOS17+）或轻量 `Codable`+文件缓存 | 缓存驾驶舱/项目/周报，弱网可读；写操作走在线 |
| 图表 | **Swift Charts**（原生） | 替代 ECharts，KPI/趋势/sparkline 原生绘制，性能与质感好 |
| Markdown | **swift-markdown-ui** | 渲染 AI 输出与周报结论 |
| 图片 | PhotosPicker + 压缩 → 复用 `/weekly-reports/:id/assets`（base64 上传） | 周报配图直接打通现有接口 |
| 依赖管理 | **SPM**（Swift Package Manager） | 原生、无 CocoaPods |
| 推送（可选） | **APNs**（需后端新增，见 §六） | 临期/风险/预警/周报就绪提醒 |

**不引入** React Native / Flutter / Capacitor / PWA —— 按你的要求做**纯原生**，且现有 REST/SSE 契约让原生重写成本可控。

---

## 三、后端改造清单（最小必要，全部向后兼容、不动数据库结构）

> 原则同前：只增不改、带开关、可回退；不碰生产数据。

### 必改（1 项）
**M1. 登录/刷新在 body 返回 refreshToken（供原生 App 持有）**
- 现状：登录只下发 Cookie；`/auth/refresh` 已能读 body 的 refreshToken。
- 改法：`/auth/login` 与 `/auth/refresh` 的 `data` 增加 `refresh_token` 字段（**Web 端继续用 Cookie，不受影响**；App 用 body）。
- 兼容/安全：Cookie 路径与 httpOnly 保持不变；App 把 refresh_token 存 Keychain。
- 风险：极低（纯增量字段）。

### 建议增强（提升 App 体验，可分期）
- **M2. 设备级登出 / 令牌版本**：`/auth/logout` 支持仅吊销当前设备 refresh（已有 `revokeAllUserTokens`，补一个 per-token 吊销）。
- **M3. 轻量「移动首页聚合」接口**（可选）`GET /mobile/home`：一次性返回驾驶舱卡片 + 我的待办 + 红点，减少 App 冷启动请求数（也可一期直接并发调现有 4 个接口）。
- **M4. ETag/If-None-Match 或 `updated_since`**：列表接口支持增量，弱网省流量（一期可不做）。
- **M5.（若做推送）** APNs 设备注册接口 `POST /devices`（token、platform）+ 事件触发（临期/风险/预警/周报就绪）。
- **M6. CORS**：原生 App 不受 CORS 限制，**无需改**（记录备查）。

### App 版本治理
- 复用现有 `/api/changelog`：App 启动拉取 `latestVersion`，低于最低支持版本时提示去 App Store 更新（强制/建议更新开关）。

---

## 四、App 信息架构与页面（一期范围）

```
TabBar（底部 5 个）
├─ 总览        ← /dashboard + today-changes + week-focus + top3
├─ 项目        ← /projects（列表/看板切换）+ quick-update + 360 详情
├─ ＋（快捷）   ← 快速：更新项目进展 / 建动作项 / CPS 录入 / 问 AI
├─ 周报        ← /weekly-reports（看 + 生成 + 配图 + 导出分享）
└─ 我的        ← /auth/me + 个人摘要 + 设置 + 改密 + 登出
```

按角色自适应（跟随后端权限，菜单/操作随 `role`/`cps_role`/`aso_role` 显隐）：
- **管理者**：总览=管理驾驶舱，看全局。
- **部门负责人/成员**：总览=我的工作台，自动只看本部门/自己（后端已隔离）。
- **CPS 渠道账号**：进来直达「渠道日报录入 + 我的数据 + 预警」。

### 一期页面清单

| 页面 | 复用接口 | 移动端关键体验 |
|---|---|---|
| 登录 / 首登改密 | login / change-password | Face ID/Touch ID 解锁（本地生物识别保护 Keychain 令牌） |
| 总览驾驶舱 | dashboard 系列 | 「今天变了什么 / 本周必须做什么」卡片 + 下拉刷新 + Swift Charts 趋势 |
| 项目列表/看板 | /projects | 卡片流；左滑快捷「更新进展/标风险」；看板按状态分泳道 |
| 项目 360 详情 | /projects/:id/relations + update-logs | 一屏看到动作/风险/成果/月度/日志；就地 quick-update |
| 周报 | weekly-reports + assets + png | 阅读态优雅排版；**拍照/选图直接配到项目**；导出 PNG 走系统分享（存相册/发飞书/微信） |
| AI 副驾 | /ai/chat-stream | 全局悬浮入口；打字机流式；引用来源可点跳项目 |
| 动作项/风险 | action-items / risk-register | 建/改/状态流转；今日到期红点 |
| CPS 渠道录入 | /cps/products + /cps/channel-entry | 渠道账号刚需：现场手机录签约/退款等 |
| 我的 | auth/me + personal-digest + badge-summary | 个人本周摘要 + 红点 + 设置 |

---

## 五、关键技术实现要点

1. **APIClient（统一网络层）**
   - 注入 `Authorization: Bearer`；解析 `{code,data,message}`，`code!=0` 抛领域错误。
   - **401 自动刷新**：命中 401 → 用 Keychain 的 refresh_token 调 `/auth/refresh` → 拿新 access → 重放原请求；刷新失败 → 跳登录。
   - 处理后端特有的 `error_type: PASSWORD_CHANGE_REQUIRED` → 弹改密。
2. **SSE 流式 AI**：`URLSession.bytes(for:)` 逐行读 `data: {...}`，按 `type` 累加 content / 收 done / 报 error；支持中断取消。
3. **周报配图**：PhotosPicker/相机 → 客户端压缩到 ≤1600px → base64 → `POST /weekly-reports/:id/assets`（已做大小/类型校验）→ 列表/删除/图注/是否导出。
4. **周报导出分享**：拉 `/…/:id/png`（已 2x 高清）→ `UIActivityViewController` 系统分享（存相册、发飞书/微信/AirDrop），彻底解决「周会无法粘贴」。
5. **离线缓存**：总览/项目/最近周报落 SwiftData，冷启动先渲染缓存再后台刷新（stale-while-revalidate）。
6. **生物识别**：LocalAuthentication 在 App 启动/前台时校验，门控 Keychain 令牌读取。
7. **图表**：Swift Charts 画 KPI 完成率、CPS/ASO 趋势、sparkline。

---

## 六、原生推送（可选，二期）

价值：临期项目、新风险、CPS 预警、周报生成完成 → APNs 推送（比飞书 webhook 更贴「本人」）。
成本：需要
1. Apple 开发者账号 + APNs 证书/Key；
2. 后端新增设备注册表 + 发送服务（接现有 cron/预警/周报生成的触发点）；
3. App 申请通知权限 + 处理点击深链。
建议：**一期先不做**，用 App 内红点（`/ai/badge-summary`）+ 下拉刷新覆盖；二期再加 APNs。

---

## 七、上架与合规

- **Apple 开发者账号**：个人/公司（公司可用 App Store Connect 团队协作）。
- **分发方式**（按受众选）：
  - **TestFlight**（最快，内部 ≤100 人，适合团队内用，几乎零审核摩擦）— **推荐先走这条**；
  - **App Store 公开上架**（需完整审核、隐私清单、截图等）；
  - **Apple Business Manager 自定义 App / Ad Hoc**（企业内部分发）。
- **隐私合规**：填 Privacy Nutrition Label（采集：账号、业务数据）；提供隐私政策 URL；数据走自有 Cloudflare 域名。
- **ATS**：已满足（HTTPS）。
- **登录方式**：纯账号密码、非第三方社交登录 → 一般**无需** Sign in with Apple（仅当提供第三方社交登录时才强制）。

---

## 八、里程碑与工作量（估算）

| 阶段 | 内容 | 估时 |
|---|---|---|
| **0. 后端对接改造** | M1（refresh_token 入 body）+（可选 M3 聚合接口）+ 联调用例 | 0.5–1 天 |
| **1. App 地基** | 工程脚手架、APIClient（含 401 刷新）、Keychain、登录/改密、生物识别、设计 token（对齐现有色板） | 3–4 天 |
| **2. 核心只读** | 总览驾驶舱 + 项目列表/看板/360 详情 + 我的（Swift Charts、下拉刷新、离线缓存） | 4–5 天 |
| **3. 写操作闭环** | 项目 quick-update、动作项/风险建改、CPS 渠道录入 | 3–4 天 |
| **4. 周报 + 配图 + 导出分享** | 周报阅读/生成/配图（相机选图）/PNG 系统分享 | 3 天 |
| **5. AI 副驾** | SSE 流式问答 + 简报/备会 + 待办物化 | 2–3 天 |
| **6. 打磨 + TestFlight** | 动效、空/错/弱网态、版本门禁、内测分发 | 2–3 天 |
| **（可选）7. APNs 推送** | 后端注册/发送 + App 通知 + 深链 | 3–4 天 |

合计：**一期（不含推送）约 3–4 周**单人；后端改造极小、风险可控。

---

## 九、风险与对策

| 风险 | 对策 |
|---|---|
| 刷新令牌目前只在 Cookie | M1：登录/刷新在 body 返回 refresh_token（向后兼容，Web 不受影响） |
| Access Token 仅 15min | App 端 401 自动静默刷新 + 失败回登录；用户无感 |
| 隧道域名稳定性 | App 配置可切换的 baseURL；加载失败友好提示与重试；建议给隧道绑稳定自定义域名 |
| 移动端不适合的重操作（批量导入/管理） | 一期不做，引导回 Web；App 聚焦高频日常动作 |
| 后端是单实例 + SQLite | App 不放大并发压力；写操作沿用现有乐观锁/归档校验；不改数据层 |
| 版本碎片 | 复用 /api/changelog 做 App 最低版本门禁 |

---

## 十、落地建议（给你拍板）

1. **先做后端 M1**（半天、零风险、可单独上线）→ 让原生 App 能纯令牌鉴权。
2. **App 一期按 §八 阶段 1→5** 推进，分发先走 **TestFlight** 给团队内测，跑顺再决定是否公开上架。
3. **推送（APNs）放二期**，一期用 App 内红点 + 下拉刷新顶上。
4. 整个过程**不改数据库结构、不动现有 Web**，后端只做向后兼容的增量接口。

> 需要的话，我可以下一步：①先把后端 M1（refresh_token 入 body）按安全方式实现并验证上线；②产出 iOS 工程的 APIClient + 认证 + 总览页 的可编译骨架（SwiftUI）。你定。
