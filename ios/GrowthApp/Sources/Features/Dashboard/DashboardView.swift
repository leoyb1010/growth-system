import SwiftUI
import Charts

@MainActor
final class DashboardVM: ObservableObject {
    @Published var data: DashboardData?
    @Published var loading = false
    @Published var error: String?

    func load(mode: String = "quarter") async {
        loading = (data == nil)
        error = nil
        do { data = try await API.dashboard(mode: mode) }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }
}

struct DashboardView: View {
    @EnvironmentObject var session: SessionManager
    @StateObject private var vm = DashboardVM()

    var body: some View {
        NavigationStack {
            ScrollView {
                LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                    if let d = vm.data {
                        VStack(spacing: 16) {
                            headerCards(d)
                            if let cards = d.kpi_cards { kpiSection(cards) }
                            if let dist = d.project_status_distribution, !dist.isEmpty { statusChart(dist) }
                            if let focus = d.week_focus?.items, !focus.isEmpty { weekFocus(focus) }
                            if let changes = d.today_changes, !changes.isEmpty { todayChanges(changes) }
                            if let due = d.due_soon_projects, !due.isEmpty { dueSoon(due) }
                        }
                        .padding(16)
                    }
                }
            }
            .background(Theme.bgLayout)
            .navigationTitle(session.user?.isAdmin == true ? "管理驾驶舱" : "我的工作台")
            .refreshable { await vm.load() }
            .task { if vm.data == nil { await vm.load() } }
        }
    }

    private func headerCards(_ d: DashboardData) -> some View {
        let cards = d.kpi_cards
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricCard(label: "GMV 完成率", value: pct(cards?.total_gmv_rate ?? 0), color: Theme.rateColor(cards?.total_gmv_rate ?? 0))
            MetricCard(label: "利润完成率", value: pct(cards?.total_profit_rate ?? 0), color: Theme.rateColor(cards?.total_profit_rate ?? 0))
            MetricCard(label: "风险项目", value: "\(cards?.risk_project_count ?? 0)", sub: (cards?.risk_project_count ?? 0) > 0 ? "需要关注" : "一切正常", color: (cards?.risk_project_count ?? 0) > 0 ? Theme.danger : Theme.success)
            MetricCard(label: "本周待收口", value: "\(cards?.due_this_week_count ?? 0)", color: Theme.warning)
        }
    }

    private func kpiSection(_ cards: KpiCards) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle(text: "目标进度")
                progressRow("GMV", actual: cards.total_gmv_actual, target: cards.total_gmv_target, rate: cards.total_gmv_rate)
                progressRow("利润", actual: cards.total_profit_actual, target: cards.total_profit_target, rate: cards.total_profit_rate)
            }
        }
    }

    private func progressRow(_ label: String, actual: Double, target: Double, rate: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label).font(.subheadline).bold()
                Spacer()
                Text("\(money(actual)) / \(money(target))").font(.caption).foregroundStyle(Theme.textSecondary)
                Text(pct(rate)).font(.caption).bold().foregroundStyle(Theme.rateColor(rate))
            }
            ProgressView(value: min(rate, 100), total: 100).tint(Theme.rateColor(rate))
        }
    }

    private func statusChart(_ dist: [StatusCount]) -> some View {
        // 横向条形图（iOS16 兼容；不用 iOS17 的 SectorMark 饼图）
        CardView {
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle(text: "项目状态分布")
                Chart(dist) { item in
                    BarMark(
                        x: .value("数量", item.count),
                        y: .value("状态", item.status)
                    )
                    .foregroundStyle(Theme.statusColor(item.status))
                    .annotation(position: .trailing) {
                        Text("\(item.count)").font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                }
                .frame(height: max(120, CGFloat(dist.count) * 36))
                .chartXAxis(.hidden)
            }
        }
    }

    private func weekFocus(_ items: [WeekFocusItem]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                SectionTitle(text: "⚡ 本周关注")
                ForEach(items) { item in
                    HStack(alignment: .top, spacing: 8) {
                        Circle().fill(focusColor(item.type)).frame(width: 7, height: 7).padding(.top, 6)
                        Text(item.text ?? "").font(.subheadline)
                        Spacer()
                    }
                }
            }
        }
    }

    private func todayChanges(_ changes: [TodayChange]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                SectionTitle(text: "📋 今日变化")
                ForEach(changes.prefix(8)) { c in
                    HStack {
                        Text(c.operator_name ?? "某人").font(.caption).bold()
                        Text(actionLabel(c.action)).font(.caption).foregroundStyle(Theme.textSecondary)
                        Text(c.table_name ?? "").font(.caption2).foregroundStyle(Theme.textSecondary)
                        Spacer()
                    }
                }
            }
        }
    }

    private func dueSoon(_ ps: [ProjectBrief]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                SectionTitle(text: "⏰ 即将到期")
                ForEach(ps.prefix(8)) { p in
                    HStack {
                        Text(p.name ?? "—").font(.subheadline).lineLimit(1)
                        Spacer()
                        if let d = p.days_until { Text(d < 0 ? "已逾期\(-d)天" : "剩\(d)天").font(.caption).foregroundStyle(d < 0 ? Theme.danger : Theme.warning) }
                    }
                }
            }
        }
    }

    // helpers
    private func pct(_ v: Double) -> String { "\(Int(v.rounded()))%" }
    private func money(_ v: Double) -> String { abs(v) >= 10000 ? String(format: "%.1f万", v/10000) : String(format: "%.0f", v) }
    private func focusColor(_ t: String?) -> Color {
        switch t { case "risk": return Theme.danger; case "progress": return Theme.success; case "deviation": return Theme.warning; default: return Theme.primary }
    }
    private func actionLabel(_ a: String?) -> String {
        switch a { case "create": return "新增了"; case "update": return "更新了"; case "delete": return "删除了"; default: return "操作了" }
    }
}
