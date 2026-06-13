import SwiftUI

struct LoginView: View {
    @EnvironmentObject var session: SessionManager
    @State private var username = ""
    @State private var password = ""
    @State private var loading = false
    @State private var showSettings = false

    var body: some View {
        ZStack {
            LinearGradient(colors: [Theme.primary.opacity(0.9), Theme.primary.opacity(0.6)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
            VStack(spacing: 24) {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                        .font(.system(size: 56)).foregroundStyle(.white)
                    Text("增长系统").font(.largeTitle).bold().foregroundStyle(.white)
                    Text("团队业务工作台").font(.subheadline).foregroundStyle(.white.opacity(0.85))
                }
                VStack(spacing: 14) {
                    TextField("用户名", text: $username)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .padding().background(Theme.bgCard).clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall))
                    SecureField("密码", text: $password)
                        .padding().background(Theme.bgCard).clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall))
                    if let err = session.loginError {
                        Text(err).font(.caption).foregroundStyle(.white).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Button {
                        Task { loading = true; await session.login(username: username, password: password); loading = false }
                    } label: {
                        HStack { if loading { ProgressView().tint(.white) }; Text("登录").bold() }
                            .frame(maxWidth: .infinity).padding()
                            .background(Color.white.opacity(0.18))
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall))
                    }
                    .disabled(loading || username.isEmpty || password.isEmpty)
                }
                .padding(.horizontal, 28)
                Spacer()
                Button("服务器设置") { showSettings = true }
                    .font(.caption).foregroundStyle(.white.opacity(0.8))
            }
        }
        .sheet(isPresented: $showSettings) { ServerSettingsView() }
    }
}

/// 允许联调时切换 baseURL
struct ServerSettingsView: View {
    @Environment(\.dismiss) var dismiss
    @State private var url = AppConfig.baseURL
    var body: some View {
        NavigationStack {
            Form {
                Section("API 地址（必须 HTTPS）") {
                    TextField("https://...", text: $url)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                }
                Section {
                    Text("默认指向线上 Cloudflare 隧道域名。仅联调时需要修改。")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
            }
            .navigationTitle("服务器设置")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { AppConfig.baseURL = url; dismiss() }
                }
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
            }
        }
    }
}
