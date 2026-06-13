import SwiftUI

@MainActor
final class ProjectDetailVM: ObservableObject {
    @Published var relations: ProjectRelations?
    @Published var loading = false
    @Published var error: String?
    @Published var saving = false
    let projectId: Int
    init(projectId: Int) { self.projectId = projectId }

    func load() async {
        loading = (relations == nil); error = nil
        do { relations = try await API.projectRelations(projectId) }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }

    func quickUpdate(progress: Int?, status: String?, weeklyProgress: String?) async -> String? {
        saving = true; defer { saving = false }
        var fields: [String: AnyCodable] = [:]
        if let progress { fields["progress_pct"] = AnyCodable(progress) }
        if let status { fields["status"] = AnyCodable(status) }
        if let weeklyProgress, !weeklyProgress.isEmpty { fields["weekly_progress"] = AnyCodable(weeklyProgress) }
        guard !fields.isEmpty else { return nil }
        do { try await API.quickUpdateProject(projectId, fields: fields); await load(); return nil }
        catch let e as APIError { return e.message }
        catch let err { return err.localizedDescription }
    }
}

struct ProjectDetailView: View {
    @StateObject private var vm: ProjectDetailVM
    @State private var showUpdate = false
    init(projectId: Int) { _vm = StateObject(wrappedValue: ProjectDetailVM(projectId: projectId)) }

    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                if let rel = vm.relations {
                    VStack(spacing: 16) {
                        header(rel.project)
                        if let c = rel.counts { countsBar(c) }
                        if let items = rel.action_items, !items.isEmpty { actionItems(items) }
                        if let risks = rel.risks, !risks.isEmpty { risksSection(risks) }
                        if let achs = rel.achievements, !achs.isEmpty { achievements(achs) }
                    }.padding(16)
                }
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle(vm.relations?.project.name ?? "项目详情")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showUpdate = true } label: { Label("更新", systemImage: "square.and.pencil") }
                    .disabled(vm.relations == nil)
            }
        }
        .sheet(isPresented: $showUpdate) {
            if let p = vm.relations?.project { QuickUpdateSheet(project: p, vm: vm) }
        }
        .task { if vm.relations == nil { await vm.load() } }
    }

    private func header(_ p: Project) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 10) {
                HStack { StatusTag(p.status); if let pr = p.priority { StatusTag(pr, color: Theme.priorityColor(pr)) }; Spacer(); Text("\(p.progress_pct)%").bold().foregroundStyle(Theme.rateColor(Double(p.progress_pct))) }
                ProgressView(value: Double(min(p.progress_pct, 100)), total: 100).tint(Theme.statusColor(p.status))
                if let owner = p.owner_name { infoRow("负责人", owner) }
                if let due = p.due_date { infoRow("截止", due) }
                if let g = p.goal, !g.isEmpty { infoRow("目标", g) }
                if let w = p.weekly_progress, !w.isEmpty { infoRow("本周进展", w) }
                if let n = p.next_action, !n.isEmpty { infoRow("下一步", n) }
                if let r = p.risk_desc, !r.isEmpty { infoRow("风险", r, color: Theme.danger) }
                if let b = p.block_reason, !b.isEmpty { infoRow("阻塞", b, color: Theme.danger) }
            }
        }
    }

    private func infoRow(_ label: String, _ value: String, color: Color = Theme.textPrimary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
            Text(value).font(.subheadline).foregroundStyle(color)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private func countsBar(_ c: RelationCounts) -> some View {
        HStack {
            countPill("动作", c.action_items, "checklist")
            countPill("风险", c.risks, "exclamationmark.triangle")
            countPill("成果", c.achievements, "trophy")
            countPill("月度", c.monthly_tasks, "calendar")
        }
    }
    private func countPill(_ label: String, _ n: Int, _ icon: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon).foregroundStyle(Theme.primary)
            Text("\(n)").font(.headline)
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
        }.frame(maxWidth: .infinity).padding(.vertical, 10).background(Theme.bgCard).clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall))
    }

    private func actionItems(_ items: [ActionItem]) -> some View {
        CardView { VStack(alignment: .leading, spacing: 8) {
            SectionTitle(text: "关联动作项")
            ForEach(items) { i in
                HStack { Text(i.title).font(.subheadline); Spacer(); if let s = i.status { StatusTag(actionStatusLabel(s)) } }
            }
        }}
    }
    private func risksSection(_ risks: [RiskItem]) -> some View {
        CardView { VStack(alignment: .leading, spacing: 8) {
            SectionTitle(text: "关联风险")
            ForEach(risks) { r in
                HStack { Text(r.title).font(.subheadline); Spacer(); if let l = r.risk_level { StatusTag(l, color: Theme.danger) } }
            }
        }}
    }
    private func achievements(_ achs: [AchievementItem]) -> some View {
        CardView { VStack(alignment: .leading, spacing: 8) {
            SectionTitle(text: "关联成果")
            ForEach(achs) { a in
                VStack(alignment: .leading) {
                    Text(a.achievement_type ?? "成果").font(.subheadline).bold()
                    if let q = a.quantified_result { Text(q).font(.caption).foregroundStyle(Theme.textSecondary) }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }}
    }
    private func actionStatusLabel(_ s: String) -> String {
        switch s { case "pending": return "待办"; case "in_progress": return "进行中"; case "done": return "完成"; case "cancelled": return "取消"; default: return s }
    }
}

struct QuickUpdateSheet: View {
    let project: Project
    @ObservedObject var vm: ProjectDetailVM
    @Environment(\.dismiss) var dismiss
    @State private var progress: Double
    @State private var status: String
    @State private var weeklyProgress: String = ""
    @State private var error: String?

    private let statuses = ["未启动", "进行中", "合作中", "阻塞中", "风险", "完成"]

    init(project: Project, vm: ProjectDetailVM) {
        self.project = project; self.vm = vm
        _progress = State(initialValue: Double(project.progress_pct))
        _status = State(initialValue: project.status)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("进度 \(Int(progress))%") {
                    Slider(value: $progress, in: 0...100, step: 5)
                }
                Section("状态") {
                    Picker("状态", selection: $status) {
                        ForEach(statuses, id: \.self) { Text($0).tag($0) }
                    }.pickerStyle(.menu)
                }
                Section("追加本周进展（可选）") {
                    TextEditor(text: $weeklyProgress).frame(minHeight: 80)
                }
                if let error { Section { Text(error).foregroundStyle(Theme.danger).font(.caption) } }
            }
            .navigationTitle("更新项目")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        Task {
                            let err = await vm.quickUpdate(progress: Int(progress), status: status, weeklyProgress: weeklyProgress)
                            if let err { error = err } else { dismiss() }
                        }
                    }.disabled(vm.saving)
                }
            }
        }
    }
}
