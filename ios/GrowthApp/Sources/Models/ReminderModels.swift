import Foundation

// 每日提醒（接 GET /me/daily-reminders）

struct DailyReminders: Decodable {
    let date: String?
    var count: Int
    let groups: [ReminderGroup]?
    enum CodingKeys: String, CodingKey { case date, count, groups }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        date = try? c.decode(String.self, forKey: .date)
        count = c.decodeFlexInt(.count)
        groups = try? c.decode([ReminderGroup].self, forKey: .groups)
    }
}

struct ReminderGroup: Decodable, Identifiable {
    let type: String?
    let title: String?
    var count: Int
    let items: [ReminderItem]?
    var id: String { type ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case type, title, count, items }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        type = try? c.decode(String.self, forKey: .type)
        title = try? c.decode(String.self, forKey: .title)
        count = c.decodeFlexInt(.count)
        items = try? c.decode([ReminderItem].self, forKey: .items)
    }
}

struct ReminderItem: Decodable, Identifiable {
    let refId: Int?
    let name: String?
    let days: Int?
    let level: String?
    let overdue: Bool?
    let dept: String?
    var id: String { "\(refId ?? 0)-\(name ?? "")" }
    enum CodingKeys: String, CodingKey { case refId = "id", name, days, level, overdue, dept }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        refId = try? c.decode(Int.self, forKey: .refId)
        name = try? c.decode(String.self, forKey: .name)
        days = try? c.decode(Int.self, forKey: .days)
        level = try? c.decode(String.self, forKey: .level)
        overdue = try? c.decode(Bool.self, forKey: .overdue)
        dept = try? c.decode(String.self, forKey: .dept)
    }
}
