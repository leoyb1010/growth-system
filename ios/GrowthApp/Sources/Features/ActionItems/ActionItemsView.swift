import SwiftUI

@MainActor
final class ActionItemsVM: ObservableObject {
    @Published var items: [ActionItem] = []
    @Published var loading = false
    @Published var error: String?
    func load() async {
        loading = items.isEmpty; error = nil
        do { items = try await API.actionItems() } catch let e as APIError { error = e.message } catch let e { error = e.localizedDescription }
        loading = false
    }
}

struct ActionItemsView: View {
    @StateObject private var vm = ActionItemsVM()
    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                VStack(spacing: 10) {
                    ForEach(vm.items) { i in
                        CardView {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(i.title).font(.subheadline.weight(.semibold))
                                    Spacer()
                                    if let s = i.status { StatusTag(statusLabel(s)) }
                                }
                                HStack(spacing: 8) {
                                    if let p = i.priority { StatusTag(priorityLabel(p), color: Theme.priorityColor(p)) }
                                    if let d = i.due_date { Label(d, systemImage: "calendar").font(.caption2).foregroundStyle(Theme.textTertiary) }
                                    Spacer()
                                }
                                if let d = i.description, !d.isEmpty { Text(d).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(2) }
                            }
                        }
                    }
                    if vm.items.isEmpty { EmptyHint(icon: "checklist", text: "暂无动作项") }
                    Color.clear.frame(height: 40)
                }.padding(16)
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle("动作项")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await vm.load() }
        .task { if vm.items.isEmpty { await vm.load() } }
    }
    private func statusLabel(_ s: String) -> String {
        switch s { case "pending": return "待办"; case "in_progress": return "进行中"; case "done": return "完成"; case "cancelled": return "取消"; default: return s }
    }
    private func priorityLabel(_ p: String) -> String {
        switch p { case "urgent": return "紧急"; case "high": return "高"; case "medium": return "中"; case "low": return "低"; default: return p }
    }
}
