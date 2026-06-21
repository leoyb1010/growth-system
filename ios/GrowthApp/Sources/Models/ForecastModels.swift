import Foundation

// MARK: - CPS 经营预测（续费地板 + 新签弹性 + What-if 情景）

struct CpsForecast: Decodable {
    let as_of: String?
    let insufficient_data: Bool?
    let message: String?
    var data_days: Int
    let model: ForecastModel?
    let horizons: [ForecastHorizon]?
    let series_weekly: [ForecastWeek]?

    enum CodingKeys: String, CodingKey { case as_of, insufficient_data, message, data_days, model, horizons, series_weekly }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        as_of = try? c.decode(String.self, forKey: .as_of)
        insufficient_data = try? c.decode(Bool.self, forKey: .insufficient_data)
        message = try? c.decode(String.self, forKey: .message)
        data_days = c.decodeFlexInt(.data_days)
        model = try? c.decode(ForecastModel.self, forKey: .model)
        horizons = try? c.decode([ForecastHorizon].self, forKey: .horizons)
        series_weekly = try? c.decode([ForecastWeek].self, forKey: .series_weekly)
    }
}

struct ForecastModel: Decodable {
    var newsign_daily: Double
    var renewal_daily: Double
    var renewal_share_pct: Double
    var daily_volatility: Double
    var trend_r2: Double
    enum CodingKeys: String, CodingKey { case newsign_daily, renewal_daily, renewal_share_pct, daily_volatility, trend_r2 }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        newsign_daily = c.decodeFlexDouble(.newsign_daily)
        renewal_daily = c.decodeFlexDouble(.renewal_daily)
        renewal_share_pct = c.decodeFlexDouble(.renewal_share_pct)
        daily_volatility = c.decodeFlexDouble(.daily_volatility)
        trend_r2 = c.decodeFlexDouble(.trend_r2)
    }
}

struct ForecastBand: Decodable {
    var p25: Double, p50: Double, p75: Double
    enum CodingKeys: String, CodingKey { case p25, p50, p75 }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        p25 = c.decodeFlexDouble(.p25); p50 = c.decodeFlexDouble(.p50); p75 = c.decodeFlexDouble(.p75)
    }
}

struct ForecastDelta: Decodable {
    var amount: Double
    let pct: Double?
    enum CodingKeys: String, CodingKey { case amount, pct }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        amount = c.decodeFlexDouble(.amount)
        pct = try? c.decode(Double.self, forKey: .pct)
    }
}

struct ForecastBreakdown: Decodable {
    var renewal_floor: Double, newsign_baseline: Double, newsign_scenario: Double
    enum CodingKeys: String, CodingKey { case renewal_floor, newsign_baseline, newsign_scenario }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        renewal_floor = c.decodeFlexDouble(.renewal_floor)
        newsign_baseline = c.decodeFlexDouble(.newsign_baseline)
        newsign_scenario = c.decodeFlexDouble(.newsign_scenario)
    }
}

struct ForecastHorizon: Decodable, Identifiable {
    let key: String?
    let label: String?
    let confidence: String?
    var projected_days: Int
    var actual_to_date: Double
    let baseline: ForecastBand?
    let scenario: ForecastBand?
    let delta: ForecastDelta?
    let breakdown: ForecastBreakdown?
    var id: String { key ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case key, label, confidence, projected_days, actual_to_date, baseline, scenario, delta, breakdown }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        key = try? c.decode(String.self, forKey: .key)
        label = try? c.decode(String.self, forKey: .label)
        confidence = try? c.decode(String.self, forKey: .confidence)
        projected_days = c.decodeFlexInt(.projected_days)
        actual_to_date = c.decodeFlexDouble(.actual_to_date)
        baseline = try? c.decode(ForecastBand.self, forKey: .baseline)
        scenario = try? c.decode(ForecastBand.self, forKey: .scenario)
        delta = try? c.decode(ForecastDelta.self, forKey: .delta)
        breakdown = try? c.decode(ForecastBreakdown.self, forKey: .breakdown)
    }
}

struct ForecastWeek: Decodable, Identifiable {
    let week: String?
    let actual: Double?    // 历史实际（未来为 null）
    let baseline: Double?  // 基准预测（历史为 null）
    let scenario: Double?  // 情景预测（历史为 null）
    var id: String { week ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case week, actual, baseline, scenario }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        week = try? c.decode(String.self, forKey: .week)
        actual = try? c.decode(Double.self, forKey: .actual)
        baseline = try? c.decode(Double.self, forKey: .baseline)
        scenario = try? c.decode(Double.self, forKey: .scenario)
    }
}

// 字典：渠道 / 产品（用于筛选与录入）
struct CpsDictItem: Decodable, Identifiable {
    let id: Int
    let name: String
    let unit_price: Double
    enum CodingKeys: String, CodingKey { case id, name, unit_price }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(Int.self, forKey: .id)) ?? 0
        name = (try? c.decode(String.self, forKey: .name)) ?? "—"
        unit_price = c.decodeFlexDouble(.unit_price)
    }
}

// 渠道日报录入结果（后端回算的有效签约/收入）
struct CpsEntryResult: Decodable {
    let effective_count: Int
    let effective_amount: Double
    enum CodingKeys: String, CodingKey { case effective_count, effective_amount }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        effective_count = c.decodeFlexInt(.effective_count)
        effective_amount = c.decodeFlexDouble(.effective_amount)
    }
}
