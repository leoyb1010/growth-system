import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var session: SessionManager
    @State private var showChangePassword = false
    @State private var showSettings = false
    @AppStorage("appearance") private var appearance = "system" // system / light / dark

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    profileCard
                    if session.user?.isAdmin == true { adminSection }
                    moreModules
                    appearanceCard
                    accountSection
                    appSection
                    Button(role: .destructive) { Task { await session.logout() } } label: {
                        Text("退出登录").font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity)
                    }.buttonStyle(.bordered).tint(Theme.danger)
                    Color.clear.frame(height: 80)
                }.padding(16)
            }
            .background(Theme.bgLayout)
            .navigationTitle("我的")
            .sheet(isPresented: $showChangePassword) { ChangePasswordView(forced: false) }
            .sheet(isPresented: $showSettings) { ServerSettingsView() }
        }
    }

    private var profileCard: some View {
        CardView {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(Theme.heroGradient).frame(width: 62, height: 62)
                        .shadow(color: Theme.primary.opacity(0.4), radius: 10, y: 4)
                    Text(initials).font(.title2.weight(.bold)).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text(session.user?.name ?? "—").font(.title3.weight(.bold))
                    HStack(spacing: 6) {
                        StatusTag(session.user?.displayRole ?? "", color: Theme.primary)
                        if let dept = session.user?.department?.name { Text(dept).font(.caption).foregroundStyle(Theme.textSecondary) }
                    }
                    Text("@\(session.user?.username ?? "")").font(.caption2).foregroundStyle(Theme.textTertiary)
                }
                Spacer()
            }
        }
    }

    private var adminSection: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                SectionTitle(text: "系统管理")
                NavigationLink { UsersAdminView() } label: { row("用户管理", "person.2.fill", Theme.primary) }
                Divider()
                NavigationLink { DeptsAdminView() } label: { row("部门管理", "building.2.fill", Theme.teal) }
                Divider()
                NavigationLink { AuditLogView() } label: { row("审计日志", "doc.plaintext.fill", Theme.warning) }
            }
        }
    }

    private var moreModules: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                SectionTitle(text: "业务模块")
                NavigationLink { MonthlyAchievementView() } label: { row("沉淀（月度 / 成果）", "tray.full.fill", Theme.purple) }
                Divider()
                NavigationLink { RiskListView() } label: { row("风险台账", "exclamationmark.triangle.fill", Theme.danger) }
                Divider()
                NavigationLink { ActionItemsView() } label: { row("动作项", "checklist", Theme.success) }
                Divider()
                NavigationLink { WeeklyReportView() } label: { row("周报与复盘", "doc.text.fill", Theme.primary) }
            }
        }
    }

    private var appearanceCard: some View {
        CardView {
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle(text: "外观")
                Picker("外观", selection: $appearance) {
                    Text("跟随系统").tag("system"); Text("浅色").tag("light"); Text("深色").tag("dark")
                }.pickerStyle(.segmented)
            }
        }
    }

    private var accountSection: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                SectionTitle(text: "账号")
                Button { showChangePassword = true } label: { row("修改密码", "key.fill", Theme.warning) }
            }
        }
    }

    private var appSection: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                SectionTitle(text: "应用")
                Button { showSettings = true } label: { row("服务器设置", "server.rack", Theme.teal) }
                Divider()
                HStack { Text("版本").font(.subheadline).foregroundStyle(Theme.textSecondary); Spacer(); Text(appVersion).font(.subheadline) }.padding(.vertical, 6)
            }
        }
    }

    private func row(_ title: String, _ icon: String, _ color: Color) -> some View {
        HStack(spacing: 12) {
            ZStack { RoundedRectangle(cornerRadius: 9).fill(color.opacity(0.14)).frame(width: 34, height: 34)
                Image(systemName: icon).font(.system(size: 14)).foregroundStyle(color) }
            Text(title).font(.subheadline).foregroundStyle(Theme.textPrimary)
            Spacer()
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(Theme.textTertiary)
        }.padding(.vertical, 6).contentShape(Rectangle())
    }

    private var initials: String { String((session.user?.name ?? "U").prefix(1)) }
    private var appVersion: String { "v" + ((Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "2.0") }
}
