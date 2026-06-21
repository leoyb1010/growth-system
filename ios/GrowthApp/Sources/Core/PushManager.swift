import UIKit
import UserNotifications

/// APNs 推送管理：申请授权 → 注册远程通知 → 拿到 device token 上报后端。
/// 需在 Xcode「Signing & Capabilities」启用 Push Notifications 能力（账号相关，由你操作）。
@MainActor
final class PushManager: NSObject, ObservableObject {
    static let shared = PushManager()
    private var lastToken: String?

    /// 登录成功后调用：请求通知授权并注册远程通知。
    func requestAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
        }
    }

    /// AppDelegate 拿到 APNs token 时回调。
    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        lastToken = hex
        Task { await upload(hex) }
    }

    private func upload(_ token: String) async {
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        try? await API.registerDevice(token: token, bundleId: Bundle.main.bundleIdentifier, env: env)
    }

    /// 登出时注销（best-effort）。
    func unregister() async {
        guard let t = lastToken else { return }
        try? await API.unregisterDevice(token: t)
        lastToken = nil
    }
}

/// SwiftUI App 的 UIKit 适配器：接收 APNs 注册回调。
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushManager.shared.didRegister(deviceToken: deviceToken) }
    }
    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("APNs 注册失败:", error.localizedDescription)
    }
}
