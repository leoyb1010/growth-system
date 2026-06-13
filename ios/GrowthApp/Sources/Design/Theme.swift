import SwiftUI

/// 100 分视觉设计系统：高级配色、渐变、深度、字阶、间距。
enum Theme {
    // 主色（品牌蓝，与 Web #3B5AFB 对齐但更精致）
    static let primary = Color(hex: 0x3B5AFB)
    static let primaryDeep = Color(hex: 0x2540E0)
    static let primaryLight = Color(hex: 0x6B82FF)

    static let success = Color(hex: 0x10B981)
    static let warning = Color(hex: 0xF59E0B)
    static let danger  = Color(hex: 0xEF4444)
    static let purple  = Color(hex: 0x8B5CF6)
    static let teal    = Color(hex: 0x06B6D4)
    static let pink    = Color(hex: 0xEC4899)

    // 文字
    static let textPrimary = Color(hex: 0x0F172A)
    static let textSecondary = Color(hex: 0x64748B)
    static let textTertiary = Color(hex: 0x94A3B8)

    // 背景与边框
    static let border = Color(hex: 0xEEF1F6)
    static let bgLayout = Color(hex: 0xF6F8FC)
    static let bgCard = Color.white
    static let bgElevated = Color(hex: 0xFBFCFE)

    static let radius: CGFloat = 18
    static let radiusSmall: CGFloat = 12
    static let radiusLarge: CGFloat = 24

    // MARK: 渐变
    static let heroGradient = LinearGradient(
        colors: [Color(hex: 0x3B5AFB), Color(hex: 0x6B46FE)],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let successGradient = LinearGradient(
        colors: [Color(hex: 0x10B981), Color(hex: 0x059669)],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let warningGradient = LinearGradient(
        colors: [Color(hex: 0xFBBF24), Color(hex: 0xF59E0B)],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let dangerGradient = LinearGradient(
        colors: [Color(hex: 0xF87171), Color(hex: 0xEF4444)],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let purpleGradient = LinearGradient(
        colors: [Color(hex: 0xA78BFA), Color(hex: 0x8B5CF6)],
        startPoint: .topLeading, endPoint: .bottomTrailing)

    static func gradient(for rate: Double) -> LinearGradient {
        if rate >= 90 { return successGradient }
        if rate >= 60 { return warningGradient }
        return dangerGradient
    }

    // MARK: 状态色
    static func statusColor(_ status: String?) -> Color {
        switch status {
        case "完成", "正常", "done", "已确认": return success
        case "进行中", "合作中", "in_progress", "monitoring": return primary
        case "风险", "预警", "阻塞中", "open", "high", "critical": return danger
        case "严重", "urgent": return danger
        case "未启动", "待开始", "pending", "草稿": return textTertiary
        default: return textSecondary
        }
    }

    static func priorityColor(_ p: String?) -> Color {
        switch p {
        case "高", "high", "urgent", "critical": return danger
        case "中", "medium": return warning
        default: return textTertiary
        }
    }

    static func rateColor(_ rate: Double) -> Color {
        if rate >= 90 { return success }
        if rate >= 60 { return warning }
        return danger
    }

    // 卡片阴影
    static let cardShadow = Color(hex: 0x1E293B).opacity(0.06)
    static let cardShadowStrong = Color(hex: 0x1E293B).opacity(0.10)
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(.sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha)
    }
}

// 数字格式化
enum Fmt {
    static func money(_ v: Double) -> String {
        let a = abs(v)
        if a >= 100_000_000 { return String(format: "%.2f亿", v/100_000_000) }
        if a >= 10_000 { return String(format: "%.1f万", v/10_000) }
        return String(format: "%.0f", v)
    }
    static func signedMoney(_ v: Double) -> String {
        (v > 0 ? "+" : v < 0 ? "-" : "") + "¥" + money(abs(v))
    }
    static func pct(_ v: Double) -> String { "\(Int(v.rounded()))%" }
    static func signed(_ v: Int) -> String { v > 0 ? "+\(v)" : "\(v)" }
}
