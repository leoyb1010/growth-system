import SwiftUI

/// 与 Web 端设计 token 对齐的颜色/样式系统。
enum Theme {
    static let primary = Color(hex: 0x3B5AFB)
    static let success = Color(hex: 0x16A34A)
    static let warning = Color(hex: 0xF59E0B)
    static let danger  = Color(hex: 0xDC2626)
    static let info    = Color(hex: 0x3B5AFB)

    static let textPrimary = Color(hex: 0x111827)
    static let textSecondary = Color(hex: 0x6B7280)
    static let border = Color(hex: 0xE5E7EB)
    static let bgLayout = Color(hex: 0xF5F7FB)
    static let bgCard = Color.white

    static let radius: CGFloat = 12
    static let radiusSmall: CGFloat = 8

    /// 项目/任务状态色（与 Web statusColors 对齐）
    static func statusColor(_ status: String?) -> Color {
        switch status {
        case "完成", "正常": return success
        case "进行中", "合作中": return primary
        case "风险", "预警", "阻塞中": return danger
        case "严重": return danger
        case "未启动", "待开始": return Color(hex: 0x9CA3AF)
        default: return textSecondary
        }
    }

    static func priorityColor(_ p: String?) -> Color {
        switch p {
        case "高", "high", "urgent": return danger
        case "中", "medium": return warning
        default: return textSecondary
        }
    }

    static func rateColor(_ rate: Double) -> Color {
        if rate >= 90 { return success }
        if rate >= 60 { return warning }
        return danger
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }
}
