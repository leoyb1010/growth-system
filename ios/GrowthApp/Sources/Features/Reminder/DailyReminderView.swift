import SwiftUI

@MainActor
final class ReminderManager: ObservableObject {
    @Published var reminders: DailyReminders?
    @Published var show = false
    private let key = "reminder_dismissed_date"

    private func todayKey() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }

    /// 每日首次打开检查：当天已弹过则跳过；否则有提醒就弹一次。
    func checkDaily() async {
        if UserDefaults.standard.string(forKey: key) == todayKey() { return }
        if let r = try? await API.dailyReminders(), r.count > 0 {
            reminders = r
            show = true
        }
    }

    func dismiss() {
        UserDefaults.standard.set(todayKey(), forKey: key)
        show = false
    }
}

struct DailyReminderView: View {
    let reminders: DailyReminders
    let onClose: () -> Void

    private func color(_ type: String?) -> Color {
        switch type {
        case "risk": return Theme.danger
        case "stale": return Theme.warning
        case "action_due": return Theme.primary
        case "cps_alert": return Theme.purple
        default: return Theme.textSecondary
        }
    }

    @ViewBuilder private func tag(_ type: String?, _ it: ReminderItem) -> some View {
        switch type {
        case "stale": pill("\(it.days ?? 0)天未更新", Theme.warning)
        case "action_due": pill(it.overdue == true ? "已逾期" : "临期", it.overdue == true ? Theme.danger : Theme.warning)
        case "cps_alert": pill(it.level ?? "预警", Theme.purple)
        case "risk": pill("风险", Theme.danger)
        default: EmptyView()
        }
    }

    private func pill(_ text: String, _ c: Color) -> some View {
        Text(text).font(.caption2.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 2)
            .background(c.opacity(0.14)).foregroundStyle(c).clipShape(Capsule())
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("仅展示与你相关的待关注项 · 每日首次打开提醒一次")
                        .font(.caption).foregroundStyle(Theme.textTertiary)
                    ForEach(reminders.groups ?? []) { g in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                Circle().fill(color(g.type)).frame(width: 8, height: 8)
                                Text(g.title ?? "").font(.subheadline.weight(.bold)).foregroundStyle(Theme.textPrimary)
                                Text("\(g.count)").font(.caption).foregroundStyle(Theme.textTertiary)
                            }
                            ForEach((g.items ?? []).prefix(8)) { it in
                                HStack {
                                    Text(it.name ?? "").font(.footnote).foregroundStyle(Theme.textPrimary).lineLimit(1)
                                    if let d = it.dept, !d.isEmpty { Text(d).font(.caption2).foregroundStyle(Theme.textTertiary) }
                                    Spacer(minLength: 8)
                                    tag(g.type, it)
                                }
                                .padding(10).background(Theme.bgLayout).clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            if g.count > 8 { Text("等 \(g.count) 项…").font(.caption2).foregroundStyle(Theme.textTertiary) }
                        }
                    }
                    Color.clear.frame(height: 20)
                }.padding(16)
            }
            .background(Theme.bgLayout)
            .navigationTitle("今日提醒 · \(reminders.count) 项")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("知道了") { onClose() } } }
        }
    }
}
