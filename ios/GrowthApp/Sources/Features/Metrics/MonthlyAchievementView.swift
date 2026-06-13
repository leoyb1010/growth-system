import SwiftUI

@MainActor
final class SettlementVM: ObservableObject {
    @Published var monthly: [MonthlyTaskItem] = []
    @Published var achievements: [AchievementFull] = []
    @Published var loading = false
    @Published var error: String?
    func load() async {
        loading = (monthly.isEmpty && achievements.isEmpty); error = nil
        async let m = try? API.monthlyTasks()
        async let a = try? API.achievements()
        monthly = await m ?? []
        achievements = await a ?? []
        loading = false
    }
}

struct MonthlyAchievementView: View {
    @StateObject private var vm = SettlementVM()
    @State private var seg = 0
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Segmented(items: ["月度工作", "季度成果"], selection: $seg)
                LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                    if seg == 0 { monthlyList } else { achList }
                }
                Color.clear.frame(height: 40)
            }.padding(16)
        }
        .background(Theme.bgLayout)
        .navigationTitle("沉淀")
        .navigationBarTitleDisplayMode(.inline)
        .task { if vm.monthly.isEmpty && vm.achievements.isEmpty { await vm.load() } }
    }

    private var monthlyList: some View {
        VStack(spacing: 12) {
            if vm.monthly.isEmpty { EmptyHint(icon: "calendar", text: "暂无月度工作") }
            ForEach(vm.monthly) { m in
                CardView {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(m.task ?? m.category ?? "—").font(.subheadline.weight(.semibold)).lineLimit(2)
                            Spacer()
                            if let s = m.status { StatusTag(s) }
                        }
                        HStack(spacing: 10) {
                            if let mo = m.month { Label(mo, systemImage: "calendar").font(.caption2).foregroundStyle(Theme.textTertiary) }
                            if let o = m.owner_name { Label(o, systemImage: "person").font(.caption2).foregroundStyle(Theme.textTertiary) }
                            Spacer()
                            Text("\(m.completion_rate)%").font(.caption.weight(.bold)).foregroundStyle(Theme.rateColor(Double(m.completion_rate)))
                        }
                        if let r = m.actual_result, !r.isEmpty { Text(r).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(3) }
                    }
                }
            }
        }
    }

    private var achList: some View {
        VStack(spacing: 12) {
            if vm.achievements.isEmpty { EmptyHint(icon: "trophy", text: "暂无成果") }
            ForEach(vm.achievements) { a in
                CardView {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(a.project_name ?? a.achievement_type ?? "成果").font(.subheadline.weight(.semibold))
                            Spacer()
                            if let p = a.priority { StatusTag(p, color: Theme.priorityColor(p)) }
                        }
                        if let q = a.quantified_result, !q.isEmpty {
                            Text(q).font(.caption).foregroundStyle(Theme.success)
                        }
                        if let v = a.business_value, !v.isEmpty {
                            Text(v).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(2)
                        }
                        HStack(spacing: 10) {
                            if let t = a.achievement_type { StatusTag(t, color: Theme.purple) }
                            if let o = a.owner_name { Text(o).font(.caption2).foregroundStyle(Theme.textTertiary) }
                        }
                    }
                }
            }
        }
    }
}
