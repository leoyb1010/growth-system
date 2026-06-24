import Foundation

// 驾驶舱经营预测（自然季度 run-rate + 因子，接 POST /dashboard/forecast）

struct DashForecast: Decodable {
    let as_of: String?
    let current_quarter: String?
    var quarter_time_progress_pct: Double
    var year_time_progress_pct: Double
    let indicators: [DashIndicator]?
    let cps_linkage: DashCpsLinkage?
    enum CodingKeys: String, CodingKey { case as_of, current_quarter, quarter_time_progress_pct, year_time_progress_pct, indicators, cps_linkage }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        as_of = try? c.decode(String.self, forKey: .as_of)
        current_quarter = try? c.decode(String.self, forKey: .current_quarter)
        quarter_time_progress_pct = c.decodeFlexDouble(.quarter_time_progress_pct)
        year_time_progress_pct = c.decodeFlexDouble(.year_time_progress_pct)
        indicators = try? c.decode([DashIndicator].self, forKey: .indicators)
        cps_linkage = try? c.decode(DashCpsLinkage.self, forKey: .cps_linkage)
    }
}

struct DashIndicator: Decodable, Identifiable {
    let name: String?
    let unit: String?
    let basis: DashBasis?
    let horizons: [DashHorizon]?
    var id: String { name ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case name, unit, basis, horizons }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        name = try? c.decode(String.self, forKey: .name)
        unit = try? c.decode(String.self, forKey: .unit)
        basis = try? c.decode(DashBasis.self, forKey: .basis)
        horizons = try? c.decode([DashHorizon].self, forKey: .horizons)
    }
}

struct DashBasis: Decodable {
    var current_actual: Double
    var current_target: Double
    var applied_growth_pct: Double
    var time_progress_pct: Double
    enum CodingKeys: String, CodingKey { case current_actual, current_target, applied_growth_pct, time_progress_pct }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        current_actual = c.decodeFlexDouble(.current_actual)
        current_target = c.decodeFlexDouble(.current_target)
        applied_growth_pct = c.decodeFlexDouble(.applied_growth_pct)
        time_progress_pct = c.decodeFlexDouble(.time_progress_pct)
    }
}

struct DashHorizon: Decodable, Identifiable {
    let key: String?
    let label: String?
    var p25: Double, p50: Double, p75: Double
    let confidence: String?
    var id: String { key ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case key, label, p25, p50, p75, confidence }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        key = try? c.decode(String.self, forKey: .key)
        label = try? c.decode(String.self, forKey: .label)
        p25 = c.decodeFlexDouble(.p25)
        p50 = c.decodeFlexDouble(.p50)
        p75 = c.decodeFlexDouble(.p75)
        confidence = try? c.decode(String.self, forKey: .confidence)
    }
}

struct DashCpsLinkage: Decodable {
    let as_of: String?
    var renewal_daily: Double
    var newsign_daily: Double
    let horizons: [DashHorizon]?
    enum CodingKeys: String, CodingKey { case as_of, renewal_daily, newsign_daily, horizons }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        as_of = try? c.decode(String.self, forKey: .as_of)
        renewal_daily = c.decodeFlexDouble(.renewal_daily)
        newsign_daily = c.decodeFlexDouble(.newsign_daily)
        horizons = try? c.decode([DashHorizon].self, forKey: .horizons)
    }
}

// 请求体（factors 为嵌套对象，用 Encodable 结构体）
struct DashFactors: Encodable {
    var scenario: String
    var global_growth: Double
    var season_factor: Double
    var event_pct: Double
}
struct DashForecastBody: Encodable { let factors: DashFactors }
