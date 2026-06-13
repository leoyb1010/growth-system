import Foundation

struct KpiItem: Decodable, Identifiable {
    let id: Int
    let indicator_name: String
    let unit: String?
    @FlexibleDouble var target: Double
    @FlexibleDouble var actual: Double
    @FlexibleDouble var completion_rate: Double
    @FlexibleDouble var time_progress: Double
    let progress_label: String?
    let progress_status: String?
    let quarter: String?
    let Department: Department?

    enum CodingKeys: String, CodingKey {
        case id, indicator_name, unit, target, actual, completion_rate, time_progress, progress_label, progress_status, quarter, Department
    }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        indicator_name = (try? c.decode(String.self, forKey: .indicator_name)) ?? "—"
        unit = try? c.decode(String.self, forKey: .unit)
        _target = (try? c.decode(FlexibleDouble.self, forKey: .target)) ?? .init(wrappedValue: 0)
        _actual = (try? c.decode(FlexibleDouble.self, forKey: .actual)) ?? .init(wrappedValue: 0)
        _completion_rate = (try? c.decode(FlexibleDouble.self, forKey: .completion_rate)) ?? .init(wrappedValue: 0)
        _time_progress = (try? c.decode(FlexibleDouble.self, forKey: .time_progress)) ?? .init(wrappedValue: 0)
        progress_label = try? c.decode(String.self, forKey: .progress_label)
        progress_status = try? c.decode(String.self, forKey: .progress_status)
        quarter = try? c.decode(String.self, forKey: .quarter)
        Department = try? c.decode(GrowthApp.Department.self, forKey: .Department)
    }
    var deptName: String { Department?.name ?? "" }
}

struct PerformanceItem: Decodable, Identifiable {
    let id: Int
    let business_type: String
    let indicator: String
    let unit: String?
    @FlexibleDouble var total_target: Double
    @FlexibleDouble var total_actual: Double
    @FlexibleDouble var gap: Double
    @FlexibleDouble var completion_rate: Double
    let warning_status: String?
    let Department: Department?

    enum CodingKeys: String, CodingKey {
        case id, business_type, indicator, unit, total_target, total_actual, gap, completion_rate, warning_status, Department
    }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        business_type = (try? c.decode(String.self, forKey: .business_type)) ?? "—"
        indicator = (try? c.decode(String.self, forKey: .indicator)) ?? "—"
        unit = try? c.decode(String.self, forKey: .unit)
        _total_target = (try? c.decode(FlexibleDouble.self, forKey: .total_target)) ?? .init(wrappedValue: 0)
        _total_actual = (try? c.decode(FlexibleDouble.self, forKey: .total_actual)) ?? .init(wrappedValue: 0)
        _gap = (try? c.decode(FlexibleDouble.self, forKey: .gap)) ?? .init(wrappedValue: 0)
        _completion_rate = (try? c.decode(FlexibleDouble.self, forKey: .completion_rate)) ?? .init(wrappedValue: 0)
        warning_status = try? c.decode(String.self, forKey: .warning_status)
        Department = try? c.decode(GrowthApp.Department.self, forKey: .Department)
    }
    var deptName: String { Department?.name ?? "" }
}

struct MonthlyTaskItem: Decodable, Identifiable {
    let id: Int
    let month: String?
    let owner_name: String?
    let category: String?
    let task: String?
    let actual_result: String?
    @FlexibleInt var completion_rate: Int
    let status: String?
    let Department: Department?
    enum CodingKeys: String, CodingKey { case id, month, owner_name, category, task, actual_result, completion_rate, status, Department }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        month = try? c.decode(String.self, forKey: .month)
        owner_name = try? c.decode(String.self, forKey: .owner_name)
        category = try? c.decode(String.self, forKey: .category)
        task = try? c.decode(String.self, forKey: .task)
        actual_result = try? c.decode(String.self, forKey: .actual_result)
        _completion_rate = (try? c.decode(FlexibleInt.self, forKey: .completion_rate)) ?? .init(wrappedValue: 0)
        status = try? c.decode(String.self, forKey: .status)
        Department = try? c.decode(GrowthApp.Department.self, forKey: .Department)
    }
}

struct AchievementFull: Decodable, Identifiable {
    let id: Int
    let project_name: String?
    let achievement_type: String?
    let quantified_result: String?
    let business_value: String?
    let priority: String?
    let owner_name: String?
    let Department: Department?
    enum CodingKeys: String, CodingKey { case id, project_name, achievement_type, quantified_result, business_value, priority, owner_name, Department }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        project_name = try? c.decode(String.self, forKey: .project_name)
        achievement_type = try? c.decode(String.self, forKey: .achievement_type)
        quantified_result = try? c.decode(String.self, forKey: .quantified_result)
        business_value = try? c.decode(String.self, forKey: .business_value)
        priority = try? c.decode(String.self, forKey: .priority)
        owner_name = try? c.decode(String.self, forKey: .owner_name)
        Department = try? c.decode(GrowthApp.Department.self, forKey: .Department)
    }
}
