import SwiftUI

@main
struct GrowthSystemApp: App {
    @StateObject private var session = SessionManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .task { await session.bootstrap() }
                .tint(Theme.primary)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var session: SessionManager
    var body: some View {
        switch session.state {
        case .loading:
            VStack(spacing: 16) {
                ProgressView()
                Text("增长系统").font(.headline).foregroundStyle(Theme.textSecondary)
            }
        case .loggedOut:
            LoginView()
        case .needsPasswordChange:
            ChangePasswordView(forced: true)
        case .loggedIn:
            MainTabView()
        }
    }
}
