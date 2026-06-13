import SwiftUI
import Charts

@MainActor
final class DashboardVM: ObservableObject {
    @Published var data: DashboardData?
    @Published var badge: BadgeSummary?
    @Published var loading = false
    @Published var error: String?
    @Published var mode = "quarter"

    func load() async {
        loading = (data == nil); error = nil
        async let d = API.dashboard(mode: mode)
        async let b = try? API.badge()
        do {
            data = try await d
            badge = await b
        } catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }
}

struct DashboardView: View {
    @EnvironmentObject var session: SessionManager
    @StateObject private var vm = DashboardVM()
    @State private var detail: DashDetail?

    var body: some View {
        NavigationStack {
            ScrollView {
                LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                    if let d = vm.data {
                        VStack(spacing: 18) {
                            modeSwitch
                            if let cards = d.kpi_cards { heroSection(cards) }
                            if let b = vm.badge { badgeStrip(b) }
                            if let cards = d.kpi_cards, let depts = cards.dept_cards, !depts.isEmpty { deptSection(depts) }
                            if let dist = d.project_status_distribution, !dist.isEmpty { statusSection(dist) }
                            if let focus = d.week_focus?.items, !focus.isEmpty { weekFocus(focus) }
                            if let changes = d.today_changes, !changes.isEmpty { todayChanges(changes) }
                            if let due = d.due_soon_projects, !due.isEmpty { dueSoon(due) }
                            Color.clear.frame(height: 80)
                        }.padding(16)
                    }
                }
            }
            .background(Theme.bgLayout)
            .navigationTitle(session.user?.isAdmin == true ? "经营驾驶舱" : "我的工作台")
            .refreshable { await vm.load() }
            .task { if vm.data == nil { await vm.load() } }
            .sheet(item: $detail) { DashDetailSheet(kind: $0) }
        }
    }

    private var modeSwitch: some View {
        HStack {
            Picker("", selection: $vm.mode) {
                Text("本季度").tag("quarter"); Text("全年累计").tag("year")
            }.pickerStyle(.segmented).onChange(of: vm.mode) { _ in Task { await vm.load() } }
        }
    }

    private func heroSection(_ c: KpiCards) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                HeroMetric(label: "GMV 完成率", rate: c.total_gmv_rate, actual: c.total_gmv_actual, target: c.total_gmv_target, icon: "dollarsign.circle")
                HeroMetric(label: "利润完成率", rate: c.total_profit_rate, actual: c.total_profit_actual, target: c.total_profit_target, icon: "chart.pie")
            }
            HStack(spacing: 12) {
                Button { detail = .risks } label: {
                    StatTile(label: "风险项目", value: "\(c.risk_project_count)", sub: c.risk_project_count > 0 ? "点击查看" : "一切正常", color: c.risk_project_count > 0 ? Theme.danger : Theme.success, icon: "exclamationmark.triangle.fill")
                }.buttonStyle(.plain)
                Button { detail = .dueSoon } label: {
                    StatTile(label: "本周待收口", value: "\(c.due_this_week_count)", sub: "点击查看", color: Theme.warning, icon: "clock.fill")
                }.buttonStyle(.plain)
            }
        }
    }

    private func badgeStrip(_ b: BadgeSummary) -> some View {
        HStack(spacing: 10) {
            badgePill("高风险", b.highRiskCount ?? 0, Theme.danger, "flame.fill")
            badgePill("待收口", b.unclosedCount ?? 0, Theme.warning, "tray.fill")
            badgePill("久未更新", b.staleCount ?? 0, Theme.textSecondary, "moon.zzz.fill")
        }
    }
    private func badgePill(_ label: String, _ n: Int, _ color: Color, _ icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.caption).foregroundStyle(color)
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
            Text("\(n)").font(.subheadline.weight(.bold)).foregroundStyle(color)
        }.frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(Theme.bgCard).clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.border))
    }

    private func deptSection(_ depts: [DeptCard]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 14) {
                SectionTitle(text: "各部门达成")
                ForEach(depts) { d in
                    HStack(spacing: 12) {
                        RingProgress(rate: d.gmv_rate, size: 48)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(d.dept_name).font(.subheadline.weight(.semibold))
                            HStack(spacing: 8) {
                                Text("GMV \(Int(d.gmv_rate))%").font(.caption).foregroundStyle(Theme.rateColor(d.gmv_rate))
                                Text("利润 \(Int(d.profit_rate))%").font(.caption).foregroundStyle(Theme.rateColor(d.profit_rate))
                            }
                            Text("\(Fmt.money(d.gmv_actual)) / \(Fmt.money(d.gmv_target))").font(.caption2).foregroundStyle(Theme.textTertiary)
                        }
                        Spacer()
                    }
                    if d.id != depts.last?.id { Divider() }
                }
            }
        }
    }

    private func statusSection(_ dist: [StatusCount]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "项目状态分布", action: { detail = .allProjects })
                Chart(dist) { item in
                    BarMark(x: .value("数量", item.count), y: .value("状态", item.status))
                        .foregroundStyle(Theme.statusColor(item.status))
                        .cornerRadius(5)
                        .annotation(position: .trailing) { Text("\(item.count)").font(.caption2.weight(.semibold)).foregroundStyle(Theme.textSecondary) }
                }
                .frame(height: max(110, CGFloat(dist.count) * 38))
                .chartXAxis(.hidden)
            }
        }
    }

    private func weekFocus(_ items: [WeekFocusItem]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "⚡ 本周关注")
                ForEach(items) { item in
                    HStack(alignment: .top, spacing: 10) {
                        Circle().fill(focusColor(item.type)).frame(width: 8, height: 8).padding(.top, 6)
                        Text(item.text ?? "").font(.subheadline).foregroundStyle(Theme.textPrimary)
                        Spacer()
                    }
                }
            }
        }
    }

    private func todayChanges(_ changes: [TodayChange]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "📋 今日动态")
                ForEach(changes.prefix(8)) { c in
                    HStack(spacing: 8) {
                        Circle().fill(Theme.primary.opacity(0.6)).frame(width: 6, height: 6)
                        Text(c.operator_name ?? "某人").font(.caption.weight(.semibold))
                        Text("\(actionLabel(c.action)) \(tableLabel(c.table_name))").font(.caption).foregroundStyle(Theme.textSecondary)
                        Spacer()
                    }
                }
            }
        }
    }

    private func dueSoon(_ ps: [ProjectBrief]) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "⏰ 即将到期", action: { detail = .dueSoon })
                ForEach(ps.prefix(6)) { p in
                    HStack {
                        Circle().fill(Theme.statusColor(p.status)).frame(width: 7, height: 7)
                        Text(p.name ?? "—").font(.subheadline).lineLimit(1)
                        Spacer()
                        if let d = p.days_until {
                            Text(d < 0 ? "逾期\(-d)天" : "剩\(d)天").font(.caption.weight(.semibold))
                                .foregroundStyle(d < 0 ? Theme.danger : Theme.warning)
                        }
                    }
                }
            }
        }
    }

    private func focusColor(_ t: String?) -> Color {
        switch t { case "risk": return Theme.danger; case "progress": return Theme.success; case "deviation": return Theme.warning; default: return Theme.primary }
    }
    private func actionLabel(_ a: String?) -> String {
        switch a { case "create": return "新增了"; case "update": return "更新了"; case "delete": return "删除了"; default: return "操作了" }
    }
    private func tableLabel(_ t: String?) -> String {
        switch t {
        case "projects": return "项目"; case "kpis": return "指标"; case "achievements": return "成果"
        case "monthly_tasks": return "月度任务"; case "action_items": return "动作项"; case "risk_register": return "风险"
        default: return t ?? "" }
    }
}

// MARK: - 详情 Sheet（驾驶舱钻取）

enum DashDetail: Identifiable {
    case risks, dueSoon, allProjects
    var id: Int { switch self { case .risks: return 0; case .dueSoon: return 1; case .allProjects: return 2 } }
}

struct DashDetailSheet: View {
    let kind: DashDetail
    var body: some View {
        NavigationStack {
            switch kind {
            case .risks: RiskListView()
            case .dueSoon, .allProjects: ProjectsListEmbed()
            }
        }.presentationDetents([.large, .medium]).presentationDragIndicator(.visible)
    }
}
