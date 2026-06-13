import Foundation

struct Project: Decodable, Identifiable {
    let id: Int
    let dept_id: Int?
    let type: String?
    let name: String
    let owner_name: String?
    let goal: String?
    let weekly_progress: String?
    @FlexibleInt var progress_pct: Int
    let status: String
    let risk_desc: String?
    let next_week_focus: String?
    let next_action: String?
    let block_reason: String?
    let priority: String?
    let due_date: String?
    let quarter: String?
    let updated_at: String?
    let Department: Department?

    enum CodingKeys: String, CodingKey {
        case id, dept_id, type, name, owner_name, goal, weekly_progress, progress_pct
        case status, risk_desc, next_week_focus, next_action, block_reason, priority
        case due_date, quarter, updated_at, Department
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        dept_id = try? c.decode(Int.self, forKey: .dept_id)
        type = try? c.decode(String.self, forKey: .type)
        name = (try? c.decode(String.self, forKey: .name)) ?? "未命名项目"
        owner_name = try? c.decode(String.self, forKey: .owner_name)
        goal = try? c.decode(String.self, forKey: .goal)
        weekly_progress = try? c.decode(String.self, forKey: .weekly_progress)
        _progress_pct = (try? c.decode(FlexibleInt.self, forKey: .progress_pct)) ?? FlexibleInt(wrappedValue: 0)
        status = (try? c.decode(String.self, forKey: .status)) ?? "未启动"
        risk_desc = try? c.decode(String.self, forKey: .risk_desc)
        next_week_focus = try? c.decode(String.self, forKey: .next_week_focus)
        next_action = try? c.decode(String.self, forKey: .next_action)
        block_reason = try? c.decode(String.self, forKey: .block_reason)
        priority = try? c.decode(String.self, forKey: .priority)
        due_date = try? c.decode(String.self, forKey: .due_date)
        quarter = try? c.decode(String.self, forKey: .quarter)
        updated_at = try? c.decode(String.self, forKey: .updated_at)
        Department = try? c.decode(GrowthApp.Department.self, forKey: .Department)
    }

    var deptName: String { Department?.name ?? "" }
}

/// 项目列表分页响应（后端可能返回数组或 {list,total}，做兼容）
struct ProjectListResponse: Decodable {
    let list: [Project]
    let total: Int?
    init(from decoder: Decoder) throws {
        if let arr = try? decoder.singleValueContainer().decode([Project].self) {
            list = arr; total = arr.count; return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        list = (try? c.decode([Project].self, forKey: .list)) ?? (try? c.decode([Project].self, forKey: .data)) ?? []
        total = try? c.decode(Int.self, forKey: .total)
    }
    enum CodingKeys: String, CodingKey { case list, data, total }
}

/// 项目 360 关联视图
struct ProjectRelations: Decodable {
    let project: Project
    let action_items: [ActionItem]?
    let risks: [RiskItem]?
    let achievements: [AchievementItem]?
    let counts: RelationCounts?
}
struct RelationCounts: Decodable {
    @FlexibleInt var action_items: Int
    @FlexibleInt var risks: Int
    @FlexibleInt var achievements: Int
    @FlexibleInt var monthly_tasks: Int
    @FlexibleInt var update_logs: Int
}

struct ActionItem: Decodable, Identifiable {
    let id: Int
    let title: String
    let description: String?
    let status: String?
    let priority: String?
    let due_date: String?
}
struct RiskItem: Decodable, Identifiable {
    let id: Int
    let title: String
    let description: String?
    let risk_level: String?
    let status: String?
}
struct AchievementItem: Decodable, Identifiable {
    let id: Int
    let project_name: String?
    let achievement_type: String?
    let quantified_result: String?
    let priority: String?
}
