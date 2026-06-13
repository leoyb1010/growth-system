import SwiftUI

// 风险台账列表（『我的→风险台账』入口用，独立 risk-register 数据）
@MainActor
final class RiskListVM: ObservableObject {
    @Published var risks: [RiskItem] = []
    @Published var loading = false
    @Published var error: String?
    func load() async {
        loading = risks.isEmpty; error = nil
        do { risks = try await API.risks() }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }
}

struct RiskListView: View {
    @StateObject private var vm = RiskListVM()
    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                if vm.risks.isEmpty {
                    EmptyHint(icon: "checkmark.shield", text: "暂无风险项").padding(.top, 60)
                } else {
                    VStack(spacing: 12) {
                        ForEach(vm.risks) { r in
                            CardView {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Text(r.title).font(.subheadline.weight(.semibold))
                                        Spacer()
                                        if let l = r.risk_level { StatusTag(riskLevelLabel(l), color: Theme.priorityColor(l)) }
                                    }
                                    if let d = r.description, !d.isEmpty { Text(d).font(.caption).foregroundStyle(Theme.textSecondary) }
                                    if let s = r.status { StatusTag(riskStatusLabel(s)) }
                                }
                            }
                        }
                        Color.clear.frame(height: 40)
                    }.padding(16)
                }
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle("风险台账")
        .navigationBarTitleDisplayMode(.inline)
        .task { if vm.risks.isEmpty { await vm.load() } }
    }
    private func riskLevelLabel(_ l: String) -> String {
        switch l { case "critical": return "严重"; case "high": return "高"; case "medium": return "中"; case "low": return "低"; default: return l }
    }
    private func riskStatusLabel(_ s: String) -> String {
        switch s { case "open": return "未处理"; case "monitoring": return "监控中"; case "mitigated": return "已缓解"; case "closed": return "已关闭"; default: return s }
    }
}

// MARK: - 驾驶舱钻取：基于「项目」同一数据源过滤，保证数量与内容一致

enum ProjectFilterKind {
    case risk      // 状态=风险（与驾驶舱 risk_project_count 口径一致）
    case dueSoon   // 7天内到期且未完成（与 due_this_week_count 同口径，宽松到7天）
    case stale     // 久未更新（>=7天）
    case all

    var title: String {
        switch self { case .risk: return "风险项目"; case .dueSoon: return "即将到期"; case .stale: return "久未更新"; case .all: return "全部项目" }
    }
}

@MainActor
final class FilteredProjectsVM: ObservableObject {
    @Published var all: [Project] = []
    @Published var loading = false
    @Published var error: String?
    /// 与驾驶舱计数同口径：按生效季度过滤（nil 表示不限季度）
    var quarter: String?
    func load() async {
        loading = all.isEmpty; error = nil
        do { all = try await API.projects(quarter: quarter) }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }
    func filtered(_ kind: ProjectFilterKind) -> [Project] {
        switch kind {
        case .risk: return all.filter { $0.status == "风险" }
        case .dueSoon: return all.filter { p in
            guard let due = p.due_date, p.status != "完成" else { return false }
            return daysUntil(due).map { $0 <= 7 } ?? false
        }
        case .stale: return all.filter { let d = staleDays($0.updated_at); return d >= 3 && d < 999 }
        case .all: return all
        }
    }
}

func daysUntil(_ dateStr: String?) -> Int? {
    guard let s = dateStr else { return nil }
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    guard let d = f.date(from: String(s.prefix(10))) else { return nil }
    return Calendar.current.dateComponents([.day], from: Date(), to: d).day
}
func staleDays(_ dateStr: String?) -> Int {
    guard let s = dateStr else { return 999 }
    let f = ISO8601DateFormatter()
    let d = f.date(from: s) ?? {
        let g = DateFormatter(); g.dateFormat = "yyyy-MM-dd"; return g.date(from: String(s.prefix(10)))
    }()
    guard let date = d else { return 999 }
    return Calendar.current.dateComponents([.day], from: date, to: Date()).day ?? 999
}

struct FilteredProjectsView: View {
    let kind: ProjectFilterKind
    var quarter: String? = nil
    @StateObject private var vm = FilteredProjectsVM()
    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                let list = vm.filtered(kind)
                VStack(spacing: 10) {
                    if list.isEmpty {
                        EmptyHint(icon: "checkmark.circle", text: "没有\(kind.title)").padding(.top, 40)
                    }
                    ForEach(list) { p in
                        NavigationLink { ProjectDetailView(projectId: p.id) } label: {
                            CardView {
                                VStack(alignment: .leading, spacing: 6) {
                                    ProjectRow(project: p)
                                    if kind == .dueSoon, let due = p.due_date, let d = daysUntil(due) {
                                        Text(d < 0 ? "已逾期\(-d)天" : "剩 \(d) 天").font(.caption2).foregroundStyle(d < 0 ? Theme.danger : Theme.warning)
                                    }
                                    if kind == .stale {
                                        let sd = staleDays(p.updated_at)
                                        Text(sd < 999 ? "\(sd) 天未更新" : "从未更新").font(.caption2).foregroundStyle(Theme.textTertiary)
                                    }
                                }
                            }
                        }.pressable()
                    }
                    Color.clear.frame(height: 40)
                }.padding(16)
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle(kind.title)
        .navigationBarTitleDisplayMode(.inline)
        .task { vm.quarter = quarter; if vm.all.isEmpty { await vm.load() } }
    }
}
