import SwiftUI

@MainActor
final class ProjectsVM: ObservableObject {
    @Published var projects: [Project] = []
    @Published var loading = false
    @Published var error: String?

    func load() async {
        loading = projects.isEmpty
        error = nil
        do { projects = try await API.projects() }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }
}

struct ProjectsView: View {
    @StateObject private var vm = ProjectsVM()
    @State private var search = ""

    var filtered: [Project] {
        // 管理优先级排序：风险 > 阻塞 > 临期低进度 > 其他
        let q = search.trimmingCharacters(in: .whitespaces)
        let base = q.isEmpty ? vm.projects : vm.projects.filter { $0.name.contains(q) || ($0.owner_name ?? "").contains(q) }
        return base.sorted { rank($0) < rank($1) }
    }
    private func rank(_ p: Project) -> Int {
        switch p.status { case "风险": return 0; case "阻塞中": return 1; default: break }
        if p.progress_pct < 60 { return 2 }
        return 3
    }

    var body: some View {
        NavigationStack {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                List {
                    ForEach(filtered) { p in
                        NavigationLink(value: p.id) {
                            ProjectRow(project: p)
                        }
                    }
                }
                .listStyle(.plain)
            }
            .background(Theme.bgLayout)
            .navigationTitle("项目推进")
            .searchable(text: $search, prompt: "搜索项目 / 负责人")
            .navigationDestination(for: Int.self) { id in ProjectDetailView(projectId: id) }
            .refreshable { await vm.load() }
            .task { if vm.projects.isEmpty { await vm.load() } }
        }
    }
}

struct ProjectRow: View {
    let project: Project
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(project.name).font(.subheadline).bold().lineLimit(1)
                Spacer()
                StatusTag(project.status)
            }
            HStack(spacing: 10) {
                if !project.deptName.isEmpty { Label(project.deptName, systemImage: "building.2").labelStyle(.titleAndIcon).font(.caption2).foregroundStyle(Theme.textSecondary) }
                if let owner = project.owner_name { Label(owner, systemImage: "person").font(.caption2).foregroundStyle(Theme.textSecondary) }
                Spacer()
                Text("\(project.progress_pct)%").font(.caption).bold().foregroundStyle(Theme.rateColor(Double(project.progress_pct)))
            }
            ProgressView(value: Double(min(project.progress_pct, 100)), total: 100)
                .tint(Theme.statusColor(project.status))
        }
        .padding(.vertical, 4)
    }
}
