# Growth System 全量产品 Review

Review 日期：2026-05-08  
Review 对象：`/Users/leo/WorkBuddy/20260421163042/growth-system`  
Review 范围：运行态、产品闭环、CPS 新板块、ASO 新板块、原有核心模块、权限与数据范围、安全与上线风险。  
Review 方式：只读审查。未修改业务代码，未修补任何问题。

## 0. 一句话结论

系统主干可以运行，但新增的 CPS、ASO 还没有达到可稳定交付给运营团队使用的状态。

- CPS 已经有真实渠道、产品、日报和预警数据，但渠道账号的菜单、权限、渠道绑定、录入接口链路存在阻断，渠道端闭环目前不可用。
- ASO 的表结构、接口和页面框架已经搭好，但运行库中 ASO 核心数据全为空，而且导入、手工新增、元数据维护、权限配置都有 P0 级阻断。
- 原有 KPI、项目、月度、成果、周报、行动项、风险台账等模块具备基础管理框架，但用户管理字段保存、统计聚合权限、密码重置安全语义存在明显缺口。
- 当前最应该做的是把权限、数据归属、导入/录入、导出范围、结算/归档口径打通，而不是继续堆新图表或 AI 能力。

## 1. 审查边界与运行态观察

### 1.1 本次没有做的事情

- 没有改业务代码。
- 没有改数据库数据。
- 没有重置账号密码。
- 没有提交 git commit。
- 尝试浏览器自动化打开本地页面时连接超时，因此没有完成登录后的视觉截图走查。

### 1.2 运行态确认

- 后端服务监听 `3001`，`GET /health` 返回健康，数据库可写。
- 后端处于 production 运行态，前端 build 由后端托管。
- 前端静态入口可访问，build 文件存在。
- 后端 JS 语法检查通过。
- 前端测试命令返回 `No tests found`，当前没有可执行的前端测试。

### 1.3 当前工作区状态

审查开始时已有未提交改动：

- `backend/src/services/cpsAlertService.js`
- `backend/src/services/cpsImportService.js`

本次 review 按工作区当前状态观察，但没有改动这些文件。

### 1.4 运行库数据快照

SQLite 当前核心表规模：

| 表 | 数量 |
|---|---:|
| users | 11 |
| cps_daily_metrics | 29 |
| cps_channels | 4 |
| cps_products | 15 |
| cps_alert_events | 12 |
| aso_products | 0 |
| aso_keywords | 0 |
| aso_daily_keyword_metrics | 0 |
| aso_campaigns | 0 |

CPS 渠道：

| id | 渠道 | 状态 |
|---:|---|---|
| 1 | 深圳指尖 | active |
| 2 | 中文测试渠道 | active |
| 3 | 山东谷本 | active |
| 4 | 杭州普推 | active |

CPS 预警状态：

| 状态 | 数量 |
|---|---:|
| ack | 8 |
| open | 4 |

关键账号观察：

- `guben`、`zhijian`、`putui`、`kedaxunfei` 四个账号角色均为 `cps_channel_user`。
- 这四个账号的 `cps_channel_id` 均为空。
- `Iris`、`suzehong` 在数据库中有 ASO admin 语义字段，但用户管理 UI 和用户保存接口无法完整管理 `aso_role`。

## 2. 优先级定义

- P0：阻断业务闭环、明显越权、误删/误写数据、核心角色不可用。
- P1：口径不一致、导出/统计/预警误导运营、上线后会造成大量人工排障。
- P2：体验、性能、文档、测试、可维护性问题。

## 3. CPS 板块 Review

### 3.1 CPS 产品定位判断

CPS 模块的目标看起来是管理渠道、产品、每日签约/续费/退款/售后/客诉数据，并形成收入看板、明细、导入、导出、预警、渠道自助录入。

从数据层看，CPS 已经比 ASO 更接近真实业务：有 4 个渠道、15 个产品、29 条日报、12 条预警。但从用户旅程看，最关键的渠道端录入和自有数据查看目前断掉。

### 3.2 P0：渠道账号看不到 CPS 菜单

证据：

- `frontend/src/permissions/ability.js:35-37`：`cps_channel_user` 只有 `cps.channel_upload`、`cps.channel_read_own`。
- `frontend/src/permissions/ability.js:131-145`：`/cps` 菜单要求 `cps.read`。
- `frontend/src/permissions/ability.js:65-70`：`CPS_ROLE_PERMS.channel_user` 也没有 `cps.read`。
- `backend/src/middleware/auth.js:25-27`：后端 `cps_channel_user` 同样没有 `cps.read`。
- `backend/src/routes/index.js:174-198`：CPS 产品、明细、预警、看板等大部分接口要求 `cps.read`。

影响：

- 渠道账号无法通过菜单进入 CPS 页面。
- 即使手动访问 `/cps`，关键接口也会 403。
- 这是 CPS 渠道自助录入的入口级阻断。

建议：

- 明确渠道账号最小权限：至少应允许读取自己录入所需的产品字典、自己的明细、自己的预警。
- 可以拆分权限：`cps.product_read_public`、`cps.channel_metric_read_own`、`cps.channel_upload`，不要简单给全量 `cps.read`。
- 前端菜单权限应支持“渠道用户可见 CPS 但只展示渠道录入/我的数据”。

### 3.3 P0：渠道录入页调用了错误接口

证据：

- `frontend/src/components/cps/CpsChannelEntryTab.js:19-20`：页面加载时调用 `cpsApi.getProducts()`。
- `frontend/src/components/cps/CpsChannelEntryTab.js:28`：提交时调用 `cpsApi.upsertMetric(...)`。
- `backend/src/routes/index.js:187`：`POST /cps/metrics` 要求 `cps.write`。
- `backend/src/routes/index.js:198`：实际存在 `POST /cps/channel-entry`，要求 `cps.channel_upload`。

影响：

- 渠道账号即使有 `cps.channel_upload`，也会因为前端走通用 `upsertMetric` 被后端拒绝。
- 现有专用渠道录入接口没有被前端使用。

建议：

- 前端 `CpsChannelEntryTab` 应改用 `cpsApi.channelEntry` 这类专用方法。
- 渠道录入接口应只允许写入当前用户绑定渠道，不信任前端传入 `channel_id`。
- 产品字典读取接口应为渠道账号开放，且只返回可售/启用产品。

### 3.4 P0：渠道账号没有绑定渠道，UI 也无法绑定

证据：

- 运行库中 4 个 `cps_channel_user` 的 `cps_channel_id` 都为空。
- `frontend/src/components/cps/CpsChannelEntryTab.js:17` 从 `user?.cps_channel_id` 取渠道。
- `frontend/src/components/cps/CpsChannelEntryTab.js:26` 无渠道时直接提示“未绑定渠道”。
- `frontend/src/pages/UserPage.js:255-263` 用户角色可选 CPS 角色，但没有渠道下拉。
- `frontend/src/pages/UserPage.js:274-279` 只有 `cps_role` 叠加字段，没有 `cps_channel_id`。
- `backend/src/controllers/userController.js:30-49` 创建用户支持 `cps_channel_id`，但前端没有传。
- `backend/src/controllers/userController.js:73-81` 更新用户支持 `cps_channel_id`，但前端无法编辑。

影响：

- 真实渠道账号无法知道自己属于哪个渠道。
- 渠道日报录入、我的数据、渠道预警全部无法形成闭环。
- 管理员无法通过后台修正绑定关系。

建议：

- 用户管理中为 `cps_channel_user` 增加渠道绑定字段。
- 列表中显示渠道绑定状态，未绑定账号给出明显标记。
- 后端创建/更新用户时校验：`role=cps_channel_user` 或 `cps_role=channel_user` 时必须绑定有效渠道。

### 3.5 P0：CPS 权限叠加与数据范围语义不一致

证据：

- `backend/src/middleware/auth.js:95-111`：`cps_role`、`aso_role` 只是叠加权限。
- `backend/src/middleware/auth.js:112`：数据范围仍只由主角色决定。
- `backend/src/middleware/auth.js:71-82`：`department_member` 是 self，`department_manager` 是 department，CPS 主角色才有 CPS 专属范围。
- `backend/src/controllers/cpsController.js:40-45`：CPS controller 只识别 `cps_channel` scope。
- `backend/src/controllers/cpsController.js:74-80`、`88-96`、`244-256`：只有渠道 scope 时才显式限制 channel。

影响：

- 一个普通部门账号如果通过 `cps_role=ops/admin` 获得 CPS 权限，数据范围仍可能是 department/self。
- CPS 表没有部门语义，department/self 范围无法正确约束 CPS 数据。
- 结果可能在不同接口间表现为：有的全量、有的报错、有的语义不清。

建议：

- CPS/ASO 权限和数据范围应分开建模，但必须有明确映射。
- `cps_role=ops/admin` 应明确是全量 CPS 范围还是指定渠道范围。
- 渠道账号和叠加渠道权限账号必须有 `cps_channel_id`。

### 3.6 P0：数据范围中间件 default 分支缺少 break

证据：

- `backend/src/middleware/auth.js:270-272`：`default` 设置 `dept_id` 后没有 `break`，会继续落入 `case 'cps_channel'`。

影响：

- 任何未知 data scope 都可能意外触发 CPS 渠道校验。
- 这属于基础权限中间件缺陷，未来新增角色或 scope 时容易产生隐蔽 bug。

建议：

- 给 `default` 补上明确 `break` 或直接返回错误。
- 对所有 scope 类型补单元测试。

### 3.7 P0：CPS 导出没有应用数据范围

证据：

- `backend/src/controllers/cpsController.js:235-237`：导出只传 `req.query` 给 `cpsExportService.exportToExcel`。
- `backend/src/services/cpsExportService.js:5-13`：导出只处理 `start_date/end_date`。
- `backend/src/services/cpsExportService.js:12-19`：查询没有接收/合并 `req.dataScope`。

影响：

- 渠道用户或受限用户一旦能访问导出，有可能导出全量 CPS 数据。
- 页面筛选了渠道/产品/source/status，导出结果也可能不一致。

建议：

- `exportMetrics` 应复用明细查询的 where 构造与数据范围逻辑。
- 导出必须接受并应用 `req.dataScope`。
- 导出文件顶部可以写入筛选条件和导出人，方便审计。

### 3.8 P1：CPS 预警计数不跟随时间窗口

证据：

- `backend/src/services/cpsDashboardService.js:119-133`：dashboard 主指标支持 `start_date/end_date`。
- `backend/src/services/cpsDashboardService.js:170-178`：`alertWhere` 只按 open、channel、product 统计，没有 stat_date 时间范围。

影响：

- 日/周/月视图下，预警数可能包含历史遗留 open 事件。
- 运营会误以为当前时间窗口内仍有风险。

建议：

- 当前周期预警和全量未处理预警分开展示。
- alert count 默认跟随当前 dashboard 时间窗口。
- 单独增加“历史未处理预警”指标。

### 3.9 P1：CPS 明细页静默吞错

证据：

- `frontend/src/components/cps/CpsMetricsTab.js:40-45`：拉取明细失败 catch 为空，只展示空态。

影响：

- 403、500、网络失败都会被用户理解为“没有数据”。
- 新增权限问题会被掩盖，排查成本高。

建议：

- 无权限显示“当前账号无权查看该数据范围”。
- 接口异常显示错误提示和重试按钮。
- 空数据与接口失败必须区分。

### 3.10 P1：CPS 预警历史存在重复与噪音风险

运行库观察：

- `cps_alert_events` 当前 12 条，open 4 条，ack 8 条。
- 之前观察到同一规则、同一日期、同一渠道/产品有重复 ack 历史。
- 有 0 值数据触发预警的迹象，可能源于阈值配置或历史测试数据。

影响：

- 如果预警规则不能按“规则 + 日期 + 渠道 + 产品 + 指标”去重，运营会被重复预警打扰。
- 如果阈值允许误配置为 0 或异常值，预警中心会失去可信度。

建议：

- 预警事件加唯一业务键。
- 预警规则增加阈值合法性校验。
- 预警中心区分测试数据、正式数据、导入数据。

### 3.11 CPS 综合判断

CPS 的数据模型和核心计算已经有可用基础，但渠道端闭环是当前最大缺口。建议优先顺序：

1. 修正渠道账号菜单和最小读权限。
2. 给渠道账号绑定 `cps_channel_id`。
3. 渠道录入页改走 `/cps/channel-entry`。
4. 导出应用数据范围。
5. 预警计数跟随时间窗口。
6. 明细页区分空态、无权限和接口错误。
7. 增加渠道账号端到端 smoke test。

## 4. ASO 板块 Review

### 4.1 ASO 产品定位判断

ASO 模块目标看起来是管理 App Store 产品、关键词、关键词日报、排名/到榜、消耗、活动、元数据版本、基线指标，并最终形成优化效果看板。

从代码结构看，功能拆分较完整；从运行库看，ASO 核心表全为空，当前还没有真实运营数据闭环。更关键的是：即使现在让运营初始化数据，导入、手工新增、元数据维护、权限管理都会遇到阻断。

### 4.2 P0：ASO 权限无法通过用户管理配置

证据：

- `frontend/src/pages/UserPage.js:9-19`：角色映射没有 ASO 角色。
- `frontend/src/pages/UserPage.js:255-263`：角色 Select 没有 `aso_admin`、`aso_ops`、`aso_viewer`。
- `frontend/src/pages/UserPage.js:274-279`：只提供 CPS 权限叠加，没有 ASO 权限叠加。
- `backend/src/controllers/userController.js:30-49`：创建用户不接收/保存 `aso_role`。
- `backend/src/controllers/userController.js:73-81`：更新用户不接收/保存 `aso_role`。

影响：

- 管理员无法从 UI 创建 ASO 管理员、运营、只读账号。
- 现有数据库里的 ASO 权限字段无法被可靠维护。
- 编辑已有用户时，容易把未展示/未管理的 ASO 权限状态变成不可控状态。

建议：

- 用户管理补 ASO 主角色或 ASO 权限叠加字段。
- 后端 create/update 明确支持 `aso_role`。
- 列表展示 ASO 权限状态。
- 增加角色/权限矩阵文档，避免 CPS/ASO 两套权限继续分叉。

### 4.3 P0：登录返回用户字段不完整，菜单可能首次加载异常

证据：

- `backend/src/controllers/authController.js:61-72`：登录响应 user 只返回 id、username、name、role、roleLevel、dept_id、department。
- `backend/src/middleware/auth.js:166-205`：认证中间件实际会从 DB 读取 `cps_channel_id`、`cps_role`、`aso_role`。
- `backend/src/controllers/authController.js:84-104`：`/auth/me` 会返回完整 user。

影响：

- 登录后的初始前端状态缺少 `cps_role`、`cps_channel_id`、`aso_role`。
- 菜单和按钮权限依赖这些字段时，可能出现“刚登录看不到，刷新或重新拉 me 后才看到”。

建议：

- 登录响应与 `/auth/me` 返回字段对齐。
- 前端登录后强制拉取 `/auth/me`，或直接使用完整 login user。

### 4.4 P0：ASO 日报手工新增/编辑不可用

证据：

- `frontend/src/components/aso/AsoKeywordsTab.js:18-19`：存在 `products` 和 `keywords` state。
- `frontend/src/components/aso/AsoKeywordsTab.js:27`：只加载 products。
- `frontend/src/components/aso/AsoKeywordsTab.js:141`：关键词下拉使用 `keywords.map(...)`，但 `keywords` 从未加载。

影响：

- 新增日报时关键词下拉为空。
- 编辑日报时也无法可靠选择/变更关键词。
- 在 ASO 数据为空的情况下，手工初始化日报被阻断。

建议：

- 页面初始化或产品变化时调用 `asoApi.getKeywords`。
- 关键词下拉应按产品过滤。
- 产品为空时引导先创建产品和关键词。

### 4.5 P0：ASO 元数据版本新增/编辑保存会失败

证据：

- `frontend/src/components/aso/AsoMetadataTab.js:38-42`：保存时调用 `vals.version_date.format('YYYY-MM-DD')`。
- `frontend/src/components/aso/AsoMetadataTab.js:82`：表单控件是普通 `<Input>`。
- `frontend/src/components/aso/AsoMetadataTab.js:35`：编辑时又把 dayjs 对象塞给 Input。

影响：

- 新建时 `version_date` 是字符串，没有 `format` 方法，保存失败。
- 编辑时 Input 承载 dayjs 对象，也不是正确控件。

建议：

- 改成 DatePicker，或保存逻辑兼容字符串。
- 日期格式校验应在前端和后端都做。

### 4.6 P0：ASO 关键词停用会误调用日报删除接口

证据：

- `frontend/src/components/aso/AsoAdminTab.js:48`：`deleteKeyword(id)` 先调用 `asoApi.deleteDailyMetric(id)`。
- `frontend/src/components/aso/AsoAdminTab.js:51`：然后才调用 `updateKeyword(id, { status: 'inactive' })`。

影响：

- 这里的 id 是关键词 id，不是日报 metric id。
- 如果某条日报的 id 恰好等于关键词 id，会被误删。
- 这是数据破坏风险，属于 P0。

建议：

- 移除对 `deleteDailyMetric` 的调用。
- 后端提供明确的 `DELETE /aso/keywords/:id` 或软停用接口。
- 停用关键词前检查是否有关联日报，并给出影响提示。

### 4.7 P0：ASO 导入模板和上传格式不一致

证据：

- `frontend/src/components/aso/AsoDailyImportTab.js:23-27`：上传 input 只接受 `.xlsx,.xls`。
- `frontend/src/components/aso/AsoDailyImportTab.js:52-60`：下载模板生成 CSV，文件名 `ASO日报导入模板.csv`。
- `frontend/src/components/aso/AsoDailyImportTab.js:73-74`：按钮文案是“上传 Excel 导入”和“下载标准模板”。

影响：

- 用户下载模板后按 CSV 填好，上传选择器默认选不到这个文件。
- 运营会认为导入功能坏了。

建议：

- 要么生成真正的 XLSX 模板。
- 要么上传 accept 支持 `.csv`，后端导入也支持 CSV。
- 模板格式、按钮文案、后端解析能力必须一致。

### 4.8 P0：ASO 导入只认第一行产品

证据：

- `backend/src/services/asoImportService.js:46-55`：只从 `rows[0]` 读取 productName/productCode 并确定一个 product。
- `backend/src/services/asoImportService.js:63-70`：循环每一行时复用这个 product。
- `backend/src/services/asoImportService.js:110`：where 使用同一个 `product.id`。
- `frontend/src/components/aso/AsoDailyImportTab.js:83-84`：页面说明“产品列填写产品名称或编码”，暗示每行产品有效。

影响：

- 多产品导入文件会被全部归到第一行产品。
- 这是严重数据归属错误。

建议：

- 每行都解析产品列。
- 对产品不存在时自动创建或报错的策略必须明确。
- 导入结果预览中展示产品归属，供运营复核。

### 4.9 P1：T1-2 指标实际只统计 T1

证据：

- `backend/src/services/asoCalcService.js:31`：`is_t1` 定义为 `rank === 1`。
- `backend/src/services/asoDashboardService.js:53-58`：`t1_2_keywords` 使用 `is_t1: true` 统计。
- `backend/src/services/asoDashboardService.js:64-65`：输出字段名是 `t1_2_keywords`、`t1_2_rate`。

影响：

- 页面展示的 T1-2 到榜词数实际只包含第 1 名。
- 运营复盘会高估或低估 ASO 进展，取决于团队对 T1-2 的定义。

建议：

- 如果指标叫 T1-2，应按 `rank <= 2`。
- 如果业务只看第 1 名，应改名为 T1。
- 指标名、字段名、计算逻辑、页面文案要统一。

### 4.10 P1：ASO 空库状态下缺少初始化引导

运行库观察：

- `aso_products = 0`
- `aso_keywords = 0`
- `aso_daily_keyword_metrics = 0`
- `aso_campaigns = 0`

影响：

- 新模块首次进入时应有清晰初始化路径。
- 当前导入和手工新增都有阻断，导致 ASO 很难形成第一批数据。

建议：

- ASO 首页空态应引导三步：创建产品、导入关键词/日报、查看看板。
- 导入前检查产品/关键词状态。
- 提供一个真实 XLSX 样例模板。

### 4.11 ASO 综合判断

ASO 当前不建议交给运营正式使用。建议优先顺序：

1. 补齐 ASO 权限管理。
2. 修复登录返回字段不完整。
3. 修复日报新增关键词下拉。
4. 修复元数据日期控件。
5. 移除关键词停用误删日报调用。
6. 统一导入模板和上传格式。
7. 按每行解析产品，避免多产品导入错归属。
8. 统一 T1/T1-2 指标口径。
9. 做一套 ASO 初始化 smoke test。

## 5. 原有模块 Review

### 5.1 用户管理：表单字段和后端保存字段不一致

证据：

- `frontend/src/pages/UserPage.js:241-299`：表单展示 email、mobile、status、must_change_password、cps_role 等字段。
- `backend/src/controllers/userController.js:30-49`：创建用户只保存 username、name、role、dept_id、cps_channel_id、cps_role、password。
- `backend/src/controllers/userController.js:73-81`：更新用户只保存 name、role、dept_id、cps_channel_id、cps_role。

影响：

- 管理员以为邮箱、手机号、账号状态、首次登录改密已经保存，实际没有保存。
- 用户管理的可信度下降。

建议：

- 前后端字段对齐。
- 对未实现字段不要先展示，或明确标记为不可用。
- 用户保存接口应有字段白名单和校验。

### 5.2 密码重置语义不完整

证据：

- `backend/src/controllers/userController.js:125-129`：注释写“设置 must_change_password = true”。
- `backend/src/controllers/userController.js:144-146`：实际只更新 `password_hash`。
- `backend/src/middleware/auth.js:183-188`：token_version 可用于旧 token 失效，但 reset password 没有递增。

影响：

- 管理员重置密码后，用户不一定被强制改密。
- 旧 access token 不会因重置密码立即失效。
- 注释和实现不一致，容易产生安全误判。

建议：

- 重置密码时设置 `must_change_password=true`。
- 同时递增 `token_version`，让旧 token 失效。
- 前端登录后检测 `must_change_password` 并跳转改密。

### 5.3 行动项 aggregate 统计绕过数据范围

证据：

- `backend/src/controllers/actionItemController.js:26-29`：普通列表会合并 `req.dataScope.where`。
- `backend/src/controllers/actionItemController.js:31-43`：aggregate 模式 raw SQL 直接查 `action_items WHERE deleted_at IS NULL`，没有合并数据范围。

影响：

- 普通成员或部门负责人可能看到全局行动项统计。
- 列表和统计数字不一致。

建议：

- aggregate 统计复用列表 where。
- 尽量避免 raw SQL 绕过 ORM 的权限过滤。
- 对 self/department/all 三类 scope 补 API 测试。

### 5.4 风险台账 aggregate 统计绕过数据范围

证据：

- `backend/src/controllers/riskRegisterController.js:21-24`：普通列表会合并 `req.dataScope.where`。
- `backend/src/controllers/riskRegisterController.js:26-38`：aggregate raw SQL 查全表，没有合并数据范围。

影响：

- 部门用户可能看到全局风险统计。
- 风险数量和列表内容不一致。

建议：

- aggregate 统计复用列表 where。
- 风险统计必须按权限范围输出。

### 5.5 self 数据范围可能引用不存在字段

证据：

- `backend/src/middleware/auth.js:252-260`：对 `project`、`action_item` 使用 `owner_user_id`、`owner_id`、`created_by`。
- ActionItem 当前 controller 使用的是 `owner_id` 和 `created_by`，并未体现 `owner_user_id` 字段。

影响：

- 如果 ORM 将不存在字段带入查询，可能导致 SQL 错误。
- 即使当前路径没有触发，也说明数据范围中间件和模型字段没有严格对齐。

建议：

- 每个 resourceType 单独定义可用 owner 字段。
- 不要在通用中间件里猜字段。

### 5.6 季度归档未覆盖 CPS/ASO

证据：

- `backend/src/models/index.js:220-229`：`QuarterArchive.module` 只支持 `kpis`、`projects`、`performances`、`monthly_tasks`、`achievements`。

影响：

- CPS/ASO 这类每日运营/结算属性强的数据没有归档、封账或周期锁定。
- 后期补结算时，历史数据可能被继续编辑，影响收入或投放复盘。

建议：

- 为 CPS 增加月度/季度结算锁定。
- 为 ASO 增加周期复盘口径锁定。
- 明确哪些角色可在封账后更正数据，以及更正审计流程。

### 5.7 文档与运行态不一致

观察：

- README/V4 文档中仍有默认账号密码、启动说明、版本说明等和当前 production 运行态不完全一致的信息。
- `admin/123456` 在当前运行态登录失败，说明文档里的默认账号说明已经不能直接作为运维依据。

影响：

- 新接手的人会按过时文档排障。
- 线上紧急场景下，默认账号/环境变量说明错误会浪费时间。

建议：

- README 分开写：本地开发默认值、生产部署注意事项、真实账号由管理员创建。
- 删除或标记过期的默认密码说明。

## 6. 安全与运维 Review

### 6.1 `.env` 中存在生产类敏感配置

观察：

- 工作区 `.env` 中包含 JWT secret、AI LLM API key 等敏感配置。
- 本文不记录具体值。

影响：

- 如果目录被同步、打包、提交或共享，密钥泄露风险高。

建议：

- 确认 `.env` 已在 `.gitignore`。
- 生产密钥改由部署平台或 secret manager 管理。
- 对已经暴露过的 key 做轮换。

### 6.2 静态资源缓存策略过于保守

证据：

- `backend/src/app.js:116-123`：`/static` 强制 `no-cache, no-store`。

影响：

- 解决了 CDN/边缘缓存导致 chunk 版本不一致的问题。
- 但牺牲了 hashed 静态资源的缓存性能。

建议：

- `index.html` 使用 no-cache。
- hashed JS/CSS 资源可以使用长缓存。
- 如果接 Cloudflare，用构建 hash 和 cache purge 管理版本。

### 6.3 测试覆盖不足

观察：

- 前端测试命令没有发现测试文件。
- 后端只做了语法检查，未见针对权限、导入、导出、数据范围的自动化测试。

影响：

- CPS/ASO 这种权限和数据归属复杂模块，靠手工回归很容易漏。

建议：

- 至少补 API smoke tests：
  - CPS 渠道账号只能看/写自己渠道。
  - CPS 导出只包含授权范围。
  - ASO 导入多产品不会错归属。
  - ASO 权限角色菜单和接口一致。
  - action/risk aggregate 不越权。

## 7. 产品体验与信息架构建议

### 7.1 CPS

建议的信息架构：

- 管理端：
  - CPS 看板
  - 日报明细
  - 预警中心
  - 导入/导出
  - 渠道管理
  - 产品管理
  - 预警规则
- 渠道端：
  - 渠道日报录入
  - 我的历史数据
  - 我的预警
  - 数据提交说明

关键体验要求：

- 渠道账号不应该看到全量渠道筛选。
- 渠道录入成功后应显示当天、渠道、产品、有效签约、有效收入。
- 同一天同渠道同产品二次提交应明确是覆盖还是版本更新。
- 预警要能解释“为什么触发”，包括指标值、阈值、规则名、触发数据。

### 7.2 ASO

建议的信息架构：

- ASO 看板
  - 优化关键词数
  - T3 到榜
  - T1/T2 或 T1-2 到榜
  - 总量级
  - 总消耗
  - 排名趋势
- 关键词日报
  - 日常维护主表
  - 支持导入、手工新增、编辑、快照
- 字典管理
  - 产品
  - 关键词
- 活动管理
  - 优化活动、负责人、周期、预算、目标
- 元数据版本
  - 关键词串调整前后、语言、版本日期、预期/实际效果
- 基线指标
  - 产品下载、排名、曝光等基础指标

关键体验要求：

- ASO 空库时不要只展示空表，应引导创建产品和导入模板。
- 导入后必须有复核页面，清楚展示成功、跳过、错误、归属产品、关键词。
- T1、T2、T3、T10 这类指标要在页面上有一致口径。

## 8. 建议上线门槛

### 8.1 CPS 上线门槛

必须全部通过：

- 管理员可创建渠道账号并绑定渠道。
- 渠道账号登录后可看到 CPS 入口。
- 渠道账号只能看到渠道录入、我的数据、我的预警。
- 渠道账号产品下拉能加载。
- 渠道账号提交日报成功。
- 同日同渠道同产品重复提交生成版本快照。
- 渠道账号无法提交其他渠道数据。
- 渠道账号导出只包含自己渠道数据。
- 管理员导出按页面筛选范围导出。
- 预警数可区分当前窗口和历史未处理。

### 8.2 ASO 上线门槛

必须全部通过：

- 管理员可创建 ASO admin、ops、viewer 或配置 ASO 权限叠加。
- ASO admin 可创建产品。
- ASO admin 可创建关键词。
- 日报新增可选择产品和关键词。
- 元数据版本日期保存正常。
- 关键词停用不会删除日报。
- 下载模板与上传格式一致。
- 多产品导入时每行归属正确。
- T1/T1-2 指标口径和页面文案一致。
- 空库状态有初始化引导。

### 8.3 原有模块回归门槛

必须覆盖：

- 用户管理创建/编辑字段和后端保存一致。
- 禁用用户旧 token 失效。
- 重置密码后旧 token 失效，并强制用户改密。
- 行动项 aggregate 和列表权限范围一致。
- 风险台账 aggregate 和列表权限范围一致。
- 周报、KPI、项目、月度、成果核心页面在管理员和部门账号下 smoke 通过。

## 9. 建议修复路线

### 第一阶段：阻断修复

目标：CPS/ASO 能完成基础业务闭环。

1. CPS 渠道账号权限、菜单、渠道绑定、渠道录入接口。
2. ASO 权限配置、日报新增、元数据日期、关键词停用误删。
3. 登录返回完整 user 字段。
4. 用户管理字段保存对齐。

### 第二阶段：数据安全与口径

目标：避免越权、错导、错统计。

1. CPS 导出应用数据范围。
2. ASO 导入按每行产品归属。
3. ASO 模板格式统一。
4. T1/T1-2 指标统一。
5. action/risk aggregate 应用数据范围。
6. reset password token 失效。

### 第三阶段：运营化

目标：减少运营解释成本，提升可维护性。

1. CPS 预警去重、规则校验、预警解释。
2. CPS/ASO 周期封账或归档。
3. ASO 空态初始化流程。
4. smoke tests 和权限矩阵文档。
5. 文档与生产运行态同步。

## 10. 最高风险清单

按业务影响排序：

1. CPS 渠道账号无法完成自助录入。
2. CPS 渠道账号没有绑定渠道。
3. CPS 导出可能不受数据范围约束。
4. ASO 权限无法从后台管理。
5. ASO 手工新增日报关键词下拉为空。
6. ASO 停用关键词可能误删日报。
7. ASO 导入多产品错归属。
8. 用户管理字段展示但不保存。
9. 行动项/风险聚合统计可能越权。
10. 密码重置不强制旧 token 失效。

## 11. 本次 Review 结论

这个系统不是“不能用”，而是新增 CPS/ASO 的关键闭环还没收口。

主系统已经有部门管理、项目/KPI、周报、行动项、风险台账的基础结构；CPS 也已经有真实数据基础。但只要渠道账号不可用、ASO 初始化不可用、导出和聚合统计存在权限风险，就不适合把 CPS/ASO 作为正式运营系统宣称上线。

建议把后续工作定义为一次“权限和数据闭环收口”，而不是普通 bugfix。完成上面的 P0 和上线门槛后，CPS 可以进入试运营；ASO 至少需要先跑通一套真实产品、关键词、日报、元数据版本、看板复盘样例，再进入正式使用。
