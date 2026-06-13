import SwiftUI

@MainActor
final class ProjectsVM: ObservableObject {
    @Published var projects: [Project] = []
    @Published var loading = false
    @Published var error: String?
    @Published var search = ""
    @Published var statusFilter: String? = nil

    func load() async {
        loading = projects.isEmpty; error = nil
        do { projects = try await API.projects() }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }

    var sorted: [Project] {
        let q = search.trimmingCharacters(in: .whitespaces)
        var base = projects
        if !q.isEmpty { base = base.filter { $0.name.contains(q) || ($0.owner_name ?? "").contains(q) || $0.deptName.contains(q) } }
        if let s = statusFilter { base = base.filter { $0.status == s } }
        return base.sorted { rank($0) < rank($1) }
    }
    private func rank(_ p: Project) -> Int {
        switch p.status { case "风险": return 0; case "阻塞中": return 1; default: break }
        if p.progress_pct < 60 { return 2 }
        return 3
    }
    var statusCounts: [(String, Int)] {
        Dictionary(grouping: projects, by: { $0.status }).map { ($0.key, $0.value.count) }.sorted { $0.1 > $1.1 }
    }
}

struct ProjectsView: View {
    @StateObject private var vm = ProjectsVM()

    var body: some View {
        NavigationStack {
            ScrollView {
                LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                    VStack(spacing: 14) {
                        filterChips
                        ForEach(vm.sorted) { p in
                            NavigationLink { ProjectDetailView(projectId: p.id) } label: {
                                CardView { ProjectRow(project: p) }
                            }.buttonStyle(.plain)
                        }
                        if vm.sorted.isEmpty { EmptyHint(icon: "folder", text: "没有匹配的项目") }
                        Color.clear.frame(height: 80)
                    }.padding(16)
                }
            }
            .background(Theme.bgLayout)
            .navigationTitle("项目推进")
            .searchable(text: $vm.search, prompt: "搜索项目 / 负责人 / 部门")
            .refreshable { await vm.load() }
            .task { if vm.projects.isEmpty { await vm.load() } }
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip("全部", vm.projects.count, active: vm.statusFilter == nil) { vm.statusFilter = nil }
                ForEach(vm.statusCounts, id: \.0) { s, n in
                    chip(s, n, active: vm.statusFilter == s, color: Theme.statusColor(s)) { vm.statusFilter = (vm.statusFilter == s ? nil : s) }
                }
            }
        }
    }
    private func chip(_ label: String, _ n: Int, active: Bool, color: Color = Theme.primary, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: 5) {
                Text(label).font(.caption.weight(.medium))
                Text("\(n)").font(.caption2.weight(.bold))
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(active ? color : color.opacity(0.10))
            .foregroundStyle(active ? .white : color)
            .clipShape(Capsule())
        }
    }
}

struct ProjectRow: View {
    let project: Project
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(project.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                Spacer()
                StatusTag(project.status)
            }
            HStack(spacing: 10) {
                if !project.deptName.isEmpty {
                    Label(project.deptName, systemImage: "building.2").font(.caption2).foregroundStyle(Theme.textSecondary)
                }
                if let owner = project.owner_name, !owner.isEmpty {
                    Label(owner, systemImage: "person").font(.caption2).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Text("\(project.progress_pct)%").font(.caption.weight(.bold)).foregroundStyle(Theme.rateColor(Double(project.progress_pct))).monospacedDigit()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.border).frame(height: 6)
                    Capsule().fill(Theme.statusColor(project.status)).frame(width: geo.size.width * CGFloat(min(project.progress_pct,100))/100, height: 6)
                }
            }.frame(height: 6)
        }
    }
}
