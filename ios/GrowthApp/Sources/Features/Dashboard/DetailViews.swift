import SwiftUI

// 风险台账列表（驾驶舱钻取 + 独立可用）
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

// 项目列表（嵌入 Sheet 复用 ProjectsView 的核心）
struct ProjectsListEmbed: View {
    @StateObject private var vm = ProjectsVM()
    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                VStack(spacing: 10) {
                    ForEach(vm.sorted) { p in
                        NavigationLink { ProjectDetailView(projectId: p.id) } label: {
                            CardView { ProjectRow(project: p) }
                        }.buttonStyle(.plain)
                    }
                }.padding(16)
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle("项目")
        .navigationBarTitleDisplayMode(.inline)
        .task { if vm.projects.isEmpty { await vm.load() } }
    }
}
