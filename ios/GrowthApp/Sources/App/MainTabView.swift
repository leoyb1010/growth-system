import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var session: SessionManager

    init() {
        // TabBar 外观：毛玻璃 + 选中主色
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView {
                DashboardView()
                    .tabItem { Label("总览", systemImage: "square.grid.2x2.fill") }
                ProjectsView()
                    .tabItem { Label("项目", systemImage: "folder.fill") }
                MetricsView()
                    .tabItem { Label("指标", systemImage: "chart.bar.xaxis") }
                BusinessView()
                    .tabItem { Label("业务", systemImage: "bolt.horizontal.fill") }
                ProfileView()
                    .tabItem { Label("我的", systemImage: "person.crop.circle.fill") }
            }
            .tint(Theme.primary)

            // 全局悬浮 AI（覆盖在 Tab 之上）
            FloatingAIOverlay()
                .allowsHitTesting(true)
        }
    }
}
