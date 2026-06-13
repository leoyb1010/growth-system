import Foundation

struct DashboardData: Decodable {
    let current_quarter: String?
    let effective_quarter: String?
    let quarter_fallback: Bool?
    let view_mode: String?
    @FlexibleDouble var time_progress: Double
    let kpi_cards: KpiCards?
    let project_status_distribution: [StatusCount]?
    let recent_projects: [ProjectBrief]?
    let due_soon_projects: [ProjectBrief]?
    let today_changes: [TodayChange]?
    let week_focus: WeekFocus?

    enum CodingKeys: String, CodingKey {
        case current_quarter, effective_quarter, quarter_fallback, view_mode, time_progress
        case kpi_cards, project_status_distribution, recent_projects, due_soon_projects, today_changes, week_focus
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        current_quarter = try? c.decode(String.self, forKey: .current_quarter)
        effective_quarter = try? c.decode(String.self, forKey: .effective_quarter)
        quarter_fallback = try? c.decode(Bool.self, forKey: .quarter_fallback)
        view_mode = try? c.decode(String.self, forKey: .view_mode)
        _time_progress = (try? c.decode(FlexibleDouble.self, forKey: .time_progress)) ?? FlexibleDouble(wrappedValue: 0)
        kpi_cards = try? c.decode(KpiCards.self, forKey: .kpi_cards)
        project_status_distribution = try? c.decode([StatusCount].self, forKey: .project_status_distribution)
        recent_projects = try? c.decode([ProjectBrief].self, forKey: .recent_projects)
        due_soon_projects = try? c.decode([ProjectBrief].self, forKey: .due_soon_projects)
        today_changes = try? c.decode([TodayChange].self, forKey: .today_changes)
        week_focus = try? c.decode(WeekFocus.self, forKey: .week_focus)
    }
}

struct KpiCards: Decodable {
    @FlexibleDouble var total_gmv_rate: Double
    @FlexibleDouble var total_gmv_target: Double
    @FlexibleDouble var total_gmv_actual: Double
    @FlexibleDouble var total_profit_rate: Double
    @FlexibleDouble var total_profit_target: Double
    @FlexibleDouble var total_profit_actual: Double
    @FlexibleInt var risk_project_count: Int
    @FlexibleInt var due_this_week_count: Int
    let total_gmv_status: String?
    let total_profit_status: String?
    let dept_cards: [DeptCard]?
}

struct DeptCard: Decodable, Identifiable {
    let dept_id: Int
    let dept_name: String
    @FlexibleDouble var gmv_rate: Double
    @FlexibleDouble var gmv_target: Double
    @FlexibleDouble var gmv_actual: Double
    @FlexibleDouble var profit_rate: Double
    @FlexibleDouble var profit_target: Double
    @FlexibleDouble var profit_actual: Double
    var id: Int { dept_id }
}

struct StatusCount: Decodable, Identifiable {
    let status: String
    @FlexibleInt var count: Int
    var id: String { status }
}

struct ProjectBrief: Decodable, Identifiable {
    let id: Int
    let name: String?
    let owner_name: String?
    let status: String?
    @FlexibleInt var progress_pct: Int
    let dept_id: Int?
    let due_date: String?
    let days_until: Int?
    let updated_at: String?

    enum CodingKeys: String, CodingKey {
        case id, name, owner_name, status, progress_pct, dept_id, due_date, days_until, updated_at
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        name = try? c.decode(String.self, forKey: .name)
        owner_name = try? c.decode(String.self, forKey: .owner_name)
        status = try? c.decode(String.self, forKey: .status)
        _progress_pct = (try? c.decode(FlexibleInt.self, forKey: .progress_pct)) ?? FlexibleInt(wrappedValue: 0)
        dept_id = try? c.decode(Int.self, forKey: .dept_id)
        due_date = try? c.decode(String.self, forKey: .due_date)
        days_until = try? c.decode(Int.self, forKey: .days_until)
        updated_at = try? c.decode(String.self, forKey: .updated_at)
    }
}

struct TodayChange: Decodable, Identifiable {
    let id: Int
    let table_name: String?
    let action: String?
    let operator_name: String?
    let created_at: String?
}

struct WeekFocus: Decodable {
    let items: [WeekFocusItem]?
}
struct WeekFocusItem: Decodable, Identifiable {
    var id: String { (type ?? "") + (text ?? "") }
    let type: String?
    let text: String?
}
