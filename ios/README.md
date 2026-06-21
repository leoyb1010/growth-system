# 增长系统 · iOS 原生 App（SwiftUI）

纯原生 iOS 客户端（非 PWA），连接现有线上后端（REST + SSE），复用全部业务能力与权限。

## 技术栈
- Swift 5.9 / SwiftUI，最低 **iOS 16**
- URLSession + async/await（自研 APIClient：Bearer 注入、401 自动刷新、`{code,data,message}` 解析、SSE 流式）
- Keychain 存令牌；Swift Charts 画图；PhotosPicker 选图；UIActivityViewController 系统分享
- 无第三方依赖；工程由 **XcodeGen** 从 `project.yml` 生成

## 已实现（一期）
- 登录 / 首登强制改密 / 退出（令牌存 Keychain，重启免登）
- 总览驾驶舱：KPI 卡、目标进度、项目状态分布图、本周关注、今日变化、即将到期（下拉刷新）
- 项目：列表（管理优先级排序 + 搜索）、360 详情（动作/风险/成果/月度）、**就地快速更新**（进度/状态/本周进展）
- 周报：查看最新 / 一键生成 / **按项目配图（拍照或相册→压缩→上传）** / **导出 PNG 系统分享**（存相册、发飞书微信）
- AI 副驾：SSE 流式问答（打字机效果，可中断）
- 我的：账号信息、改密、服务器地址切换、版本

## 已实现（v1.21.0 新增）
- **重点业务**：ASO / CPS 看板 + CPS 区入口
- **CPS 经营预测**：本季度/下季度/本半年度/本年度 的中性值 + 区间 + 置信度（接 `/cps/forecast`）；**新签情景模拟**（停投/腰斩/维持/加投 + N天后恢复 + 续费衰减）实时看各周期缺口；实际→预测分叉图；渠道筛选
- **CPS 渠道日报录入**：手机端上报当日签约/退款/客诉（接 `/cps/channel-entry`，channel_id 由后端按数据范围强制注入）
- **APNs 推送注册**：登录后申请通知授权并上报 device token（接 `/push/devices`）；登出注销。**需在 Xcode 启用 Push Notifications 能力 + 后端配 `APNS_*` 凭证才会真实下发；未配则空跑、不影响其它功能**

## 在真机上运行（需一台装有完整 Xcode 的 Mac）

> ⚠️ **真机部署/签名必须有完整 Xcode**（App Store 安装）。只有 Command Line Tools 无法 `xcodebuild`、无法签名、无法装真机——这是 Apple 的硬性要求，没有命令行绕过。

### 0. 拉取最新代码
```bash
git clone https://github.com/leoyb1010/growth-system.git   # 已有则：git checkout main && git pull
cd growth-system/ios
```

### 1. 生成并打开工程
```bash
brew install xcodegen          # 如未装
xcodegen generate              # 新增的 ForecastView/ChannelEntryView/PushManager 等按目录自动纳入
open GrowthApp.xcodeproj
```

### 2. 配置后端地址（重要）
编辑 `GrowthApp/Sources/Core/AppConfig.swift`，把占位符改成你的生产隧道域名：
```swift
static let defaultBaseURL = "https://你的Cloudflare隧道域名"   // 默认值是占位符 REPLACE-WITH-YOUR-TUNNEL-DOMAIN
```
> 必须是 **HTTPS**（满足 iOS ATS）。也可装上后在 App「我的 → 服务器设置」里切换。
> **覆盖安装会保留 UserDefaults**：若这台 iPhone 之前在 App 内设过服务器地址，覆盖后通常仍生效，可不用改默认值。

### 3. 签名（账号相关）
选中 `GrowthApp` target → **Signing & Capabilities** → 勾 **Automatically manage signing**，**Team** 选你的 Apple ID（免费个人账号即可真机调试）。
> 要 APNs 真实推送：再加 **Push Notifications** 能力（需付费开发者账号）。不加也能正常跑，推送链路空跑、不影响预测等功能。

### 4. 推真机（覆盖现有 App）
1. Xcode 顶部选择你连接的 iPhone（数据线连接，首次需「信任此电脑」）。
2. 点 ▶︎ Run。**因为 bundle id 相同 (`com.growthsystem.app`)，会直接覆盖现有 App（数据/设置保留）。**
3. 首次安装后，在 iPhone「设置 → 通用 → VPN与设备管理」信任你的开发者证书。

> 免费 Apple ID 真机调试有效期 7 天；正式分发建议走 **TestFlight**（付费开发者账号，内部最多 100 人，零审核摩擦）。

## 验证记录
- 一期：`xcodebuild` 对 **iphonesimulator** 与 **iphoneos（arm64 真机 SDK）** 均 **BUILD SUCCEEDED**；模拟器安装 + 启动 + 登录页渲染正常
- v1.21.0 新增文件：已通过 `swiftc -parse` 语法校验；**完整 `xcodebuild` 编译需在装有 Xcode 的机器上跑**（开发机仅 Command Line Tools）。后端 `/cps/forecast`、`/cps/channel-entry`、`/push/devices` 均已在生产 v1.21.0 联调通过

## 工程结构
```
ios/
├─ project.yml                 # XcodeGen 工程定义（iOS16、权限说明、ATS）
└─ GrowthApp/Sources/
   ├─ App/                     # 入口、根视图、TabBar
   ├─ Core/                    # APIClient / TokenStore / Keychain / SessionManager / Services
   ├─ Models/                  # 与后端响应对齐的 Codable（宽松解析）
   ├─ Design/                  # Theme(色板对齐Web) / Components / ShareSheet
   └─ Features/                # Auth / Dashboard / Projects / WeeklyReport / AI / Profile
                               # Business（ASO+CPS看板 / ForecastView 预测 / ChannelEntryView 录入）
   # Core 另含 PushManager.swift（APNs 注册）+ AppDelegate 适配器
```

## 与后端的唯一依赖改动
后端 `M1`：`/auth/login` 与 `/auth/refresh` 在响应 body 返回 `refresh_token`（供 App 无 Cookie 鉴权）。
**Web 端不受影响**（仍走 httpOnly Cookie）。

## 后续可选
- ~~APNs 原生推送~~ ✅ 已接入注册与 CPS 预警触发（v1.21.0）；待 Xcode 开能力 + 后端配 `APNS_*` 凭证即可真实下发
- ~~CPS 渠道日报录入~~ ✅ 已实现（v1.21.0）
- 动作项/风险就地建改、离线缓存（SwiftData）、生物识别解锁、看板日期范围筛选、主屏 Widget
