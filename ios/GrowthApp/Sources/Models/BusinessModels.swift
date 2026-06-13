import Foundation

// MARK: - ASO
struct AsoDashboard: Decodable {
    let mode: String?
    let summary: AsoSummary?
    let trend: [AsoTrendPoint]?
    let keyword_changes: AsoKeywordChanges?
}
struct AsoSummary: Decodable {
    @FlexibleInt var optimized_keywords: Int
    @FlexibleInt var t3_keywords: Int
    @FlexibleDouble var t3_rate: Double
    @FlexibleInt var t1_2_keywords: Int
    @FlexibleDouble var t1_2_rate: Double
    @FlexibleInt var total_volume: Int
    @FlexibleDouble var total_cost: Double
    enum CodingKeys: String, CodingKey { case optimized_keywords, t3_keywords, t3_rate, t1_2_keywords, t1_2_rate, total_volume, total_cost }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        _optimized_keywords = (try? c.decode(FlexibleInt.self, forKey: .optimized_keywords)) ?? .init(wrappedValue: 0)
        _t3_keywords = (try? c.decode(FlexibleInt.self, forKey: .t3_keywords)) ?? .init(wrappedValue: 0)
        _t3_rate = (try? c.decode(FlexibleDouble.self, forKey: .t3_rate)) ?? .init(wrappedValue: 0)
        _t1_2_keywords = (try? c.decode(FlexibleInt.self, forKey: .t1_2_keywords)) ?? .init(wrappedValue: 0)
        _t1_2_rate = (try? c.decode(FlexibleDouble.self, forKey: .t1_2_rate)) ?? .init(wrappedValue: 0)
        _total_volume = (try? c.decode(FlexibleInt.self, forKey: .total_volume)) ?? .init(wrappedValue: 0)
        _total_cost = (try? c.decode(FlexibleDouble.self, forKey: .total_cost)) ?? .init(wrappedValue: 0)
    }
}
struct AsoTrendPoint: Decodable, Identifiable {
    let date: String?
    @FlexibleInt var t3_keywords: Int
    var id: String { date ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case date, t3_keywords }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        date = try? c.decode(String.self, forKey: .date)
        _t3_keywords = (try? c.decode(FlexibleInt.self, forKey: .t3_keywords)) ?? .init(wrappedValue: 0)
    }
}
struct AsoKeywordChanges: Decodable {
    let new_t1: [String]?
    let new_t3: [String]?
}

// MARK: - CPS
struct CpsDashboard: Decodable {
    let total: CpsMetrics?
    let daily: CpsMetrics?
    let day_over_day: CpsDoD?
    let trend: [CpsTrendPoint]?
    let top_channels: [CpsChannelRank]?
    @FlexibleInt var alert_count: Int
    @FlexibleInt var channel_count: Int
    enum CodingKeys: String, CodingKey { case total, daily, day_over_day, trend, top_channels, alert_count, channel_count }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        total = try? c.decode(CpsMetrics.self, forKey: .total)
        daily = try? c.decode(CpsMetrics.self, forKey: .daily)
        day_over_day = try? c.decode(CpsDoD.self, forKey: .day_over_day)
        trend = try? c.decode([CpsTrendPoint].self, forKey: .trend)
        top_channels = try? c.decode([CpsChannelRank].self, forKey: .top_channels)
        _alert_count = (try? c.decode(FlexibleInt.self, forKey: .alert_count)) ?? .init(wrappedValue: 0)
        _channel_count = (try? c.decode(FlexibleInt.self, forKey: .channel_count)) ?? .init(wrappedValue: 0)
    }
}
struct CpsMetrics: Decodable {
    @FlexibleInt var actual_count: Int
    @FlexibleDouble var actual_amount: Double
    @FlexibleInt var effective_count: Int
    @FlexibleDouble var effective_amount: Double
    @FlexibleInt var new_sign: Int
    @FlexibleInt var renewal: Int
    @FlexibleDouble var refund_rate: Double
    @FlexibleDouble var complaint_rate: Double
    @FlexibleInt var complaints: Int
    enum CodingKeys: String, CodingKey { case actual_count, actual_amount, effective_count, effective_amount, new_sign, renewal, refund_rate, complaint_rate, complaints }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        _actual_count = (try? c.decode(FlexibleInt.self, forKey: .actual_count)) ?? .init(wrappedValue: 0)
        _actual_amount = (try? c.decode(FlexibleDouble.self, forKey: .actual_amount)) ?? .init(wrappedValue: 0)
        _effective_count = (try? c.decode(FlexibleInt.self, forKey: .effective_count)) ?? .init(wrappedValue: 0)
        _effective_amount = (try? c.decode(FlexibleDouble.self, forKey: .effective_amount)) ?? .init(wrappedValue: 0)
        _new_sign = (try? c.decode(FlexibleInt.self, forKey: .new_sign)) ?? .init(wrappedValue: 0)
        _renewal = (try? c.decode(FlexibleInt.self, forKey: .renewal)) ?? .init(wrappedValue: 0)
        _refund_rate = (try? c.decode(FlexibleDouble.self, forKey: .refund_rate)) ?? .init(wrappedValue: 0)
        _complaint_rate = (try? c.decode(FlexibleDouble.self, forKey: .complaint_rate)) ?? .init(wrappedValue: 0)
        _complaints = (try? c.decode(FlexibleInt.self, forKey: .complaints)) ?? .init(wrappedValue: 0)
    }
}
struct CpsDoD: Decodable {
    let current_date: String?
    let compare_date: String?
    @FlexibleDouble var actual_amount_delta: Double
    @FlexibleInt var actual_count_delta: Int
    enum CodingKeys: String, CodingKey { case current_date, compare_date, actual_amount_delta, actual_count_delta }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        current_date = try? c.decode(String.self, forKey: .current_date)
        compare_date = try? c.decode(String.self, forKey: .compare_date)
        _actual_amount_delta = (try? c.decode(FlexibleDouble.self, forKey: .actual_amount_delta)) ?? .init(wrappedValue: 0)
        _actual_count_delta = (try? c.decode(FlexibleInt.self, forKey: .actual_count_delta)) ?? .init(wrappedValue: 0)
    }
}
struct CpsTrendPoint: Decodable, Identifiable {
    let stat_date: String?
    @FlexibleDouble var actual_amount: Double
    var id: String { stat_date ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case stat_date, actual_amount }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        stat_date = try? c.decode(String.self, forKey: .stat_date)
        _actual_amount = (try? c.decode(FlexibleDouble.self, forKey: .actual_amount)) ?? .init(wrappedValue: 0)
    }
}
struct CpsChannelRank: Decodable, Identifiable {
    let channel_id: Int?
    let channel_name: String?
    @FlexibleDouble var actual_amount: Double
    var id: Int { channel_id ?? Int.random(in: 1...99999) }
    enum CodingKeys: String, CodingKey { case channel_id, channel_name, actual_amount }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        channel_id = try? c.decode(Int.self, forKey: .channel_id)
        channel_name = try? c.decode(String.self, forKey: .channel_name)
        _actual_amount = (try? c.decode(FlexibleDouble.self, forKey: .actual_amount)) ?? .init(wrappedValue: 0)
    }
}
