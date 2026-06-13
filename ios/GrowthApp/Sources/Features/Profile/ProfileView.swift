import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var session: SessionManager
    @State private var showChangePassword = false
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    profileCard
                    moreModules
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
                    Circle().fill(Theme.heroGradient).frame(width: 60, height: 60)
                    Text(initials).font(.title2.weight(.bold)).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text(session.user?.name ?? "—").font(.title3.weight(.bold))
                    HStack(spacing: 6) {
                        StatusTag(session.user?.displayRole ?? "", color: Theme.primary)
                        if let dept = session.user?.department?.name { Text(dept).font(.caption).foregroundStyle(Theme.textSecondary) }
                    }
                }
                Spacer()
            }
        }
    }

    private var moreModules: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                SectionTitle(text: "更多模块")
                NavigationLink { MonthlyAchievementView() } label: { row("沉淀（月度 / 成果）", "tray.full", Theme.purple) }
                Divider()
                NavigationLink { RiskListView() } label: { row("风险台账", "exclamationmark.triangle", Theme.danger) }
                Divider()
                NavigationLink { WeeklyReportView() } label: { row("周报与复盘", "doc.text", Theme.primary) }
            }
        }
    }

    private var accountSection: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                SectionTitle(text: "账号")
                infoRow("用户名", session.user?.username ?? "—")
                Divider()
                Button { showChangePassword = true } label: { row("修改密码", "key", Theme.warning) }
            }
        }
    }

    private var appSection: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                SectionTitle(text: "应用")
                Button { showSettings = true } label: { row("服务器设置", "server.rack", Theme.teal) }
                Divider()
                infoRow("版本", appVersion)
            }
        }
    }

    private func row(_ title: String, _ icon: String, _ color: Color) -> some View {
        HStack(spacing: 12) {
            ZStack { RoundedRectangle(cornerRadius: 8).fill(color.opacity(0.12)).frame(width: 32, height: 32)
                Image(systemName: icon).font(.caption).foregroundStyle(color) }
            Text(title).font(.subheadline).foregroundStyle(Theme.textPrimary)
            Spacer()
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(Theme.textTertiary)
        }.padding(.vertical, 6).contentShape(Rectangle())
    }
    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack { Text(label).font(.subheadline).foregroundStyle(Theme.textSecondary); Spacer(); Text(value).font(.subheadline) }.padding(.vertical, 6)
    }

    private var initials: String { String((session.user?.name ?? "U").prefix(1)) }
    private var appVersion: String { "v" + ((Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "2.0") }
}
