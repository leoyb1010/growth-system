import Foundation

struct WeeklyReportSummary: Decodable, Identifiable {
    let id: Int
    let week_start: String?
    let week_end: String?
    let generated_at: String?
}

/// 周报内容（content_json）——只取 App 展示需要的字段，宽松解析。
struct WeeklyReportContent: Decodable {
    let id: Int?
    let week_start: String?
    let week_end: String?
    let week_conclusion: String?
    let project_progress: [ReportProject]?
    let new_achievements: [ReportAchievement]?

    enum CodingKeys: String, CodingKey {
        case id, content, week_start, week_end, week_conclusion, project_progress, new_achievements
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // 后端可能返回 { id, ...content } 或 { id, content: {...} }
        let inner = (try? c.decode(InnerContent.self, forKey: .content))
        id = try? c.decode(Int.self, forKey: .id)
        week_start = (try? c.decode(String.self, forKey: .week_start)) ?? inner?.week_start
        week_end = (try? c.decode(String.self, forKey: .week_end)) ?? inner?.week_end
        week_conclusion = (try? c.decode(String.self, forKey: .week_conclusion)) ?? inner?.week_conclusion
        project_progress = (try? c.decode([ReportProject].self, forKey: .project_progress)) ?? inner?.project_progress
        new_achievements = (try? c.decode([ReportAchievement].self, forKey: .new_achievements)) ?? inner?.new_achievements
    }
    private struct InnerContent: Decodable {
        let week_start: String?
        let week_end: String?
        let week_conclusion: String?
        let project_progress: [ReportProject]?
        let new_achievements: [ReportAchievement]?
    }
}

struct ReportProject: Decodable, Identifiable {
    let id: Int
    let dept_name: String?
    let name: String?
    let weekly_progress: String?
    @FlexibleInt var progress_pct: Int
    let status: String?

    enum CodingKeys: String, CodingKey { case id, dept_name, name, weekly_progress, progress_pct, status }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        dept_name = try? c.decode(String.self, forKey: .dept_name)
        name = try? c.decode(String.self, forKey: .name)
        weekly_progress = try? c.decode(String.self, forKey: .weekly_progress)
        _progress_pct = (try? c.decode(FlexibleInt.self, forKey: .progress_pct)) ?? FlexibleInt(wrappedValue: 0)
        status = try? c.decode(String.self, forKey: .status)
    }
}

struct ReportAchievement: Decodable, Identifiable {
    var id: String { (project_name ?? "") + (quantified_result ?? "") }
    let project_name: String?
    let achievement_type: String?
    let quantified_result: String?
    let priority: String?
}

/// 周报附件（report_assets）
struct ReportAsset: Decodable, Identifiable {
    let id: Int
    let report_id: Int
    let project_id: Int?
    let section: String?
    let caption: String?
    @FlexibleInt var byte_size: Int
    let width: Int?
    let height: Int?
    let include_in_export: Bool?
    let url: String   // 形如 /api/weekly-reports/:id/assets/:assetId/raw

    enum CodingKeys: String, CodingKey {
        case id, report_id, project_id, section, caption, byte_size, width, height, include_in_export, url
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        report_id = c.decodeFlexInt(.report_id)
        project_id = try? c.decode(Int.self, forKey: .project_id)
        section = try? c.decode(String.self, forKey: .section)
        caption = try? c.decode(String.self, forKey: .caption)
        _byte_size = (try? c.decode(FlexibleInt.self, forKey: .byte_size)) ?? FlexibleInt(wrappedValue: 0)
        width = try? c.decode(Int.self, forKey: .width)
        height = try? c.decode(Int.self, forKey: .height)
        include_in_export = try? c.decode(Bool.self, forKey: .include_in_export)
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
    }
}
