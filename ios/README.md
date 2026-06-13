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

## 在真机上运行（三步）

### 1. 准备
```bash
# 安装 XcodeGen（如未装）
brew install xcodegen

# 生成 Xcode 工程
cd ios
xcodegen generate
open GrowthApp.xcodeproj
```

### 2. 配置后端地址（重要）
编辑 `GrowthApp/Sources/Core/AppConfig.swift`：
```swift
static let defaultBaseURL = "https://你的Cloudflare隧道域名"
```
> 必须是 **HTTPS**（满足 iOS ATS）。也可在 App 登录页「服务器设置」里临时切换，便于联调。

### 3. 真机部署
1. Xcode 顶部选择你的 iPhone（用数据线连接，首次需「信任此电脑」）。
2. 选中 `GrowthApp` target → **Signing & Capabilities** → 勾选 **Automatically manage signing**，**Team** 选你的 Apple ID（免费个人账号即可真机调试）。
3. 点 ▶︎ 运行。首次安装后，在 iPhone 上「设置 → 通用 → VPN与设备管理」信任你的开发者证书。

> 免费 Apple ID 真机调试有效期 7 天；正式分发建议走 **TestFlight**（付费开发者账号，内部最多 100 人，零审核摩擦）。

## 验证记录
- `xcodebuild` 对 **iphonesimulator** 与 **iphoneos（arm64 真机 SDK）** 均 **BUILD SUCCEEDED**
- 模拟器安装 + 启动 + 登录页渲染正常（品牌色、布局、交互无崩溃）

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
```

## 与后端的唯一依赖改动
后端 `M1`：`/auth/login` 与 `/auth/refresh` 在响应 body 返回 `refresh_token`（供 App 无 Cookie 鉴权）。
**Web 端不受影响**（仍走 httpOnly Cookie）。

## 二期可选
- APNs 原生推送（临期/风险/预警/周报就绪）——需后端新增设备注册与发送
- CPS 渠道日报录入、动作项/风险建改、离线缓存（SwiftData）、生物识别解锁
