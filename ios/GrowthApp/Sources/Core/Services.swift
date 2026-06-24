import Foundation

/// 业务 API 封装，按域分组。全部走 APIClient（自动 Bearer + 401 刷新 + 封装解析）。
enum API {
    // MARK: Auth
    static func login(username: String, password: String) async throws -> LoginResponse {
        try await APIClient.shared.request("/auth/login", method: "POST",
            body: ["username": username, "password": password], as: LoginResponse.self)
    }
    static func me() async throws -> CurrentUser {
        try await APIClient.shared.request("/auth/me", as: CurrentUser.self)
    }
    static func changePassword(old: String, new: String) async throws {
        _ = try await APIClient.shared.send("/auth/change-password", method: "POST",
            body: ["old_password": old, "new_password": new])
    }
    static func logout() async {
        _ = try? await APIClient.shared.send("/auth/logout", method: "POST")
    }

    // MARK: Dashboard
    static func dashboard(mode: String = "quarter") async throws -> DashboardData {
        try await APIClient.shared.request("/dashboard", query: ["mode": mode], as: DashboardData.self)
    }
    static func badge() async throws -> BadgeSummary {
        try await APIClient.shared.request("/ai/badge-summary", as: BadgeSummary.self)
    }
    /// 驾驶舱经营预测（自然季度 run-rate + 因子）
    static func dashboardForecast(_ factors: DashFactors) async throws -> DashForecast {
        try await APIClient.shared.request("/dashboard/forecast", method: "POST", body: DashForecastBody(factors: factors), as: DashForecast.self)
    }
    /// 每日提醒（按当前用户归属）
    static func dailyReminders() async throws -> DailyReminders {
        try await APIClient.shared.request("/me/daily-reminders", as: DailyReminders.self)
    }

    // MARK: 指标 KPI / 业绩
    static func kpis() async throws -> [KpiItem] {
        try await APIClient.shared.request("/kpis", as: [KpiItem].self)
    }
    static func performances() async throws -> [PerformanceItem] {
        try await APIClient.shared.request("/performances", as: [PerformanceItem].self)
    }

    // MARK: 业务 ASO / CPS
    static func asoDashboard() async throws -> AsoDashboard {
        try await APIClient.shared.request("/aso/dashboard", as: AsoDashboard.self)
    }
    static func cpsDashboard() async throws -> CpsDashboard {
        try await APIClient.shared.request("/cps/dashboard", as: CpsDashboard.self)
    }
    /// CPS 经营预测（含新签 What-if 情景）。query 透传维度与情景参数。
    static func cpsForecast(query: [String: String]) async throws -> CpsForecast {
        try await APIClient.shared.request("/cps/forecast", query: query.isEmpty ? nil : query, as: CpsForecast.self)
    }
    static func cpsChannels() async throws -> [CpsDictItem] {
        try await APIClient.shared.request("/cps/channels", as: [CpsDictItem].self)
    }
    static func cpsProducts() async throws -> [CpsDictItem] {
        try await APIClient.shared.request("/cps/products", as: [CpsDictItem].self)
    }
    /// 渠道日报录入（channel_id 由后端按数据范围强制注入，无需前端传）
    static func cpsChannelEntry(_ body: [String: AnyCodable]) async throws -> CpsEntryResult {
        try await APIClient.shared.request("/cps/channel-entry", method: "POST", body: body, as: CpsEntryResult.self)
    }

    // MARK: 推送（APNs 设备注册）
    static func registerDevice(token: String, bundleId: String?, env: String) async throws {
        var body: [String: AnyCodable] = ["token": AnyCodable(token), "platform": AnyCodable("ios"), "app_env": AnyCodable(env)]
        if let bundleId { body["bundle_id"] = AnyCodable(bundleId) }
        _ = try await APIClient.shared.send("/push/devices", method: "POST", body: body)
    }
    static func unregisterDevice(token: String) async throws {
        _ = try await APIClient.shared.send("/push/devices", method: "DELETE", body: ["token": AnyCodable(token)])
    }

    // MARK: 月度 / 成果
    static func monthlyTasks() async throws -> [MonthlyTaskItem] {
        try await APIClient.shared.request("/monthly-tasks", as: ListWrap<MonthlyTaskItem>.self).items
    }
    static func achievements() async throws -> [AchievementFull] {
        try await APIClient.shared.request("/achievements", as: [AchievementFull].self)
    }

    // MARK: Projects
    static func projects(quarter: String? = nil) async throws -> [Project] {
        var q: [String: String] = [:]
        if let quarter { q["quarter"] = quarter }
        let resp = try await APIClient.shared.request("/projects", query: q.isEmpty ? nil : q, as: ProjectListResponse.self)
        return resp.list
    }
    static func projectRelations(_ id: Int) async throws -> ProjectRelations {
        try await APIClient.shared.request("/projects/\(id)/relations", as: ProjectRelations.self)
    }
    static func quickUpdateProject(_ id: Int, fields: [String: AnyCodable]) async throws {
        _ = try await APIClient.shared.send("/projects/\(id)/quick-update", method: "PUT", body: fields)
    }

    // MARK: Weekly Reports
    static func weeklyReports() async throws -> [WeeklyReportSummary] {
        try await APIClient.shared.request("/weekly-reports", as: [WeeklyReportSummary].self)
    }
    static func latestReport() async throws -> WeeklyReportContent {
        try await APIClient.shared.request("/weekly-reports/latest", as: WeeklyReportContent.self)
    }
    static func report(_ id: Int) async throws -> WeeklyReportContent {
        try await APIClient.shared.request("/weekly-reports/\(id)", as: WeeklyReportContent.self)
    }
    static func generateReport() async throws -> WeeklyReportContent {
        try await APIClient.shared.request("/weekly-reports/generate", method: "POST", body: EmptyBody(), as: WeeklyReportContent.self)
    }
    static func reportAssets(_ id: Int) async throws -> [ReportAsset] {
        try await APIClient.shared.request("/weekly-reports/\(id)/assets", as: [ReportAsset].self)
    }
    static func uploadAsset(reportId: Int, projectId: Int?, section: String, base64: String, mime: String, caption: String?) async throws -> ReportAsset {
        var body: [String: AnyCodable] = [
            "section": AnyCodable(section),
            "data_base64": AnyCodable(base64),
            "mime_type": AnyCodable(mime),
        ]
        if let projectId { body["project_id"] = AnyCodable(projectId) }
        if let caption { body["caption"] = AnyCodable(caption) }
        return try await APIClient.shared.request("/weekly-reports/\(reportId)/assets", method: "POST", body: body, as: ReportAsset.self)
    }
    static func deleteAsset(reportId: Int, assetId: Int) async throws {
        _ = try await APIClient.shared.send("/weekly-reports/\(reportId)/assets/\(assetId)", method: "DELETE")
    }

    // MARK: 管理（admin）
    static func users() async throws -> [ManagedUser] {
        try await APIClient.shared.request("/users", as: ListWrap<ManagedUser>.self).items
    }
    static func departments() async throws -> [DeptFull] {
        try await APIClient.shared.request("/departments", as: [DeptFull].self)
    }
    static func auditLogs() async throws -> [AuditLogItem] {
        try await APIClient.shared.request("/audit-logs", as: ListWrap<AuditLogItem>.self).items
    }
    static func toggleUser(_ id: Int, enable: Bool) async throws {
        _ = try await APIClient.shared.send("/users/\(id)/\(enable ? "enable" : "disable")", method: "POST")
    }
    static func resetUserPassword(_ id: Int) async throws -> String? {
        struct R: Decodable { let new_password: String? }
        let r: R = try await APIClient.shared.request("/users/\(id)/reset-password", method: "POST", body: EmptyBody(), as: R.self)
        return r.new_password
    }

    // MARK: Action items / Risk
    static func actionItems() async throws -> [ActionItem] {
        try await APIClient.shared.request("/action-items", as: ListWrap<ActionItem>.self).items
    }
    static func risks() async throws -> [RiskItem] {
        try await APIClient.shared.request("/risk-register", as: ListWrap<RiskItem>.self).items
    }
}

/// 兼容「数组 或 {list/data,total}」两种列表返回
struct ListWrap<T: Decodable>: Decodable {
    let items: [T]
    init(from decoder: Decoder) throws {
        if let arr = try? decoder.singleValueContainer().decode([T].self) { items = arr; return }
        let c = try decoder.container(keyedBy: K.self)
        items = (try? c.decode([T].self, forKey: .list)) ?? (try? c.decode([T].self, forKey: .data)) ?? []
    }
    enum K: String, CodingKey { case list, data }
}

struct EmptyBody: Encodable {}

/// 可编码的任意值（用于动态 body）
struct AnyCodable: Encodable {
    let value: Any
    init(_ v: Any) { value = v }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case let v as Int: try c.encode(v)
        case let v as Double: try c.encode(v)
        case let v as Bool: try c.encode(v)
        case let v as String: try c.encode(v)
        default: try c.encodeNil()
        }
    }
}
