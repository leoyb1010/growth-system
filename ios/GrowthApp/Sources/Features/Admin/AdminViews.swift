import SwiftUI

// MARK: 用户管理
@MainActor
final class UsersVM: ObservableObject {
    @Published var users: [ManagedUser] = []
    @Published var loading = false
    @Published var error: String?
    @Published var toast: String?
    func load() async {
        loading = users.isEmpty; error = nil
        do { users = try await API.users() } catch let e as APIError { error = e.message } catch let e { error = e.localizedDescription }
        loading = false
    }
    func toggle(_ u: ManagedUser) async {
        do { try await API.toggleUser(u.id, enable: !u.isActive); await load() } catch { self.error = "操作失败" }
    }
    func resetPwd(_ u: ManagedUser) async {
        do { let p = try await API.resetUserPassword(u.id); toast = "已重置\(u.name)密码：\(p ?? "见后台")" } catch { toast = "重置失败" }
    }
}

struct UsersAdminView: View {
    @StateObject private var vm = UsersVM()
    @State private var search = ""
    var filtered: [ManagedUser] {
        let q = search.trimmingCharacters(in: .whitespaces)
        return q.isEmpty ? vm.users : vm.users.filter { $0.name.contains(q) || $0.username.contains(q) }
    }
    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                VStack(spacing: 10) {
                    ForEach(filtered) { u in
                        CardView {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(u.name).font(.subheadline.weight(.bold))
                                    Text("@\(u.username)").font(.caption2).foregroundStyle(Theme.textTertiary)
                                    Spacer()
                                    StatusTag(u.isActive ? "启用" : "禁用", color: u.isActive ? Theme.success : Theme.textTertiary)
                                }
                                HStack(spacing: 8) {
                                    StatusTag(u.displayRole, color: Theme.primary)
                                    Text(u.deptName).font(.caption2).foregroundStyle(Theme.textSecondary)
                                    if let cps = u.cps_role { StatusTag("CPS:\(cps)", color: Theme.teal) }
                                    if let aso = u.aso_role { StatusTag("ASO:\(aso)", color: Theme.purple) }
                                    Spacer()
                                }
                                if u.username != "admin" {
                                    HStack(spacing: 10) {
                                        Button(u.isActive ? "禁用" : "启用") { Task { await vm.toggle(u) } }
                                            .font(.caption).buttonStyle(.bordered).tint(u.isActive ? Theme.danger : Theme.success)
                                        Button("重置密码") { Task { await vm.resetPwd(u) } }
                                            .font(.caption).buttonStyle(.bordered).tint(Theme.warning)
                                    }
                                }
                            }
                        }
                    }
                    if filtered.isEmpty { EmptyHint(icon: "person.2", text: "没有用户") }
                    Color.clear.frame(height: 40)
                }.padding(16)
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle("用户管理")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "搜索用户")
        .refreshable { await vm.load() }
        .task { if vm.users.isEmpty { await vm.load() } }
        .alert("提示", isPresented: .constant(vm.toast != nil)) {
            Button("好") { vm.toast = nil }
        } message: { Text(vm.toast ?? "") }
    }
}

// MARK: 部门管理
struct DeptsAdminView: View {
    @State private var depts: [DeptFull] = []
    @State private var loading = false
    @State private var error: String?
    var body: some View {
        ScrollView {
            LoadStateView(isLoading: loading, error: error, retry: { Task { await load() } }) {
                VStack(spacing: 10) {
                    ForEach(depts) { d in
                        CardView {
                            HStack {
                                ZStack { RoundedRectangle(cornerRadius: 10).fill(Theme.primary.opacity(0.12)).frame(width: 40, height: 40)
                                    Image(systemName: "building.2.fill").foregroundStyle(Theme.primary) }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(d.name).font(.subheadline.weight(.semibold))
                                    Text(d.type == "manager" ? "管理组" : "业务组").font(.caption2).foregroundStyle(Theme.textTertiary)
                                }
                                Spacer()
                                VStack(alignment: .trailing) {
                                    Text("\(d.user_count)").font(.headline).foregroundStyle(Theme.primary)
                                    Text("成员").font(.caption2).foregroundStyle(Theme.textSecondary)
                                }
                            }
                        }
                    }
                    if depts.isEmpty { EmptyHint(icon: "building.2", text: "没有部门") }
                }.padding(16)
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle("部门管理")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }
    private func load() async {
        loading = depts.isEmpty; error = nil
        do { depts = try await API.departments() } catch let e as APIError { error = e.message } catch let e { error = e.localizedDescription }
        loading = false
    }
}

// MARK: 审计日志
struct AuditLogView: View {
    @State private var logs: [AuditLogItem] = []
    @State private var loading = false
    @State private var error: String?
    var body: some View {
        ScrollView {
            LoadStateView(isLoading: loading, error: error, retry: { Task { await load() } }) {
                VStack(spacing: 8) {
                    ForEach(logs) { l in
                        CardView(padding: 12) {
                            HStack(spacing: 10) {
                                Circle().fill(actionColor(l.action)).frame(width: 8, height: 8)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(l.operator_name ?? "某人") \(actionLabel(l.action)) \(tableLabel(l.table_name))").font(.caption.weight(.medium))
                                    if let t = l.created_at { Text(fmtTime(t)).font(.caption2).foregroundStyle(Theme.textTertiary) }
                                }
                                Spacer()
                            }
                        }
                    }
                    if logs.isEmpty { EmptyHint(icon: "doc.plaintext", text: "暂无审计记录") }
                    Color.clear.frame(height: 40)
                }.padding(16)
            }
        }
        .background(Theme.bgLayout)
        .navigationTitle("审计日志")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }
    private func load() async {
        loading = logs.isEmpty; error = nil
        do { logs = try await API.auditLogs() } catch let e as APIError { error = e.message } catch let e { error = e.localizedDescription }
        loading = false
    }
    private func actionColor(_ a: String?) -> Color {
        switch a { case "create": return Theme.success; case "delete": return Theme.danger; default: return Theme.primary }
    }
    private func actionLabel(_ a: String?) -> String {
        switch a { case "create": return "新增"; case "update": return "修改"; case "delete": return "删除"; default: return a ?? "操作" }
    }
    private func tableLabel(_ t: String?) -> String {
        switch t {
        case "projects": return "项目"; case "kpis": return "指标"; case "achievements": return "成果"
        case "monthly_tasks": return "月度任务"; case "users": return "用户"; case "action_items": return "动作项"
        case "risk_register": return "风险"; case "report_assets": return "周报配图"; default: return t ?? "" }
    }
    private func fmtTime(_ s: String) -> String { String(s.prefix(19).replacingOccurrences(of: "T", with: " ")) }
}
