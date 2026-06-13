import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var session: SessionManager
    @State private var showChangePassword = false
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Circle().fill(Theme.primary.opacity(0.15))
                            .frame(width: 56, height: 56)
                            .overlay(Text(initials).font(.title3).bold().foregroundStyle(Theme.primary))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(session.user?.name ?? "—").font(.headline)
                            HStack(spacing: 6) {
                                StatusTag(session.user?.displayRole ?? "", color: Theme.primary)
                                if let dept = session.user?.department?.name { Text(dept).font(.caption).foregroundStyle(Theme.textSecondary) }
                            }
                        }
                        Spacer()
                    }.padding(.vertical, 6)
                }

                Section("账号") {
                    LabeledContent("用户名", value: session.user?.username ?? "—")
                    Button { showChangePassword = true } label: { Label("修改密码", systemImage: "key") }
                }

                Section("应用") {
                    Button { showSettings = true } label: { Label("服务器设置", systemImage: "server.rack") }
                    LabeledContent("版本", value: appVersion)
                }

                Section {
                    Button(role: .destructive) { Task { await session.logout() } } label: {
                        Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("我的")
            .sheet(isPresented: $showChangePassword) { ChangePasswordView(forced: false) }
            .sheet(isPresented: $showSettings) { ServerSettingsView() }
        }
    }

    private var initials: String {
        let name = session.user?.name ?? "U"
        return String(name.prefix(1))
    }
    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        return "v\(v)"
    }
}
