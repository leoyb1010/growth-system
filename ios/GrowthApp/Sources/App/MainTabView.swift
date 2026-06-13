import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var session: SessionManager

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("总览", systemImage: "square.grid.2x2.fill") }

            ProjectsView()
                .tabItem { Label("项目", systemImage: "folder.fill") }

            AIChatView()
                .tabItem { Label("AI 副驾", systemImage: "sparkles") }

            WeeklyReportView()
                .tabItem { Label("周报", systemImage: "doc.text.fill") }

            ProfileView()
                .tabItem { Label("我的", systemImage: "person.crop.circle.fill") }
        }
    }
}
