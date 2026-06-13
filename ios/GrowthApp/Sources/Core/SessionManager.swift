import Foundation
import SwiftUI

/// 全局会话状态：登录态、当前用户、登出。驱动根视图在 登录 / 主界面 间切换。
@MainActor
final class SessionManager: ObservableObject {
    enum State { case loading, loggedOut, needsPasswordChange, loggedIn }

    @Published var state: State = .loading
    @Published var user: CurrentUser?
    @Published var loginError: String?

    init() {
        APIClient.shared.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.forceLogout() }
        }
    }

    /// 启动时尝试恢复会话（有 refresh token → 拉 /auth/me）
    func bootstrap() async {
        guard await TokenStore.shared.hasSession else {
            state = .loggedOut; return
        }
        do {
            let me = try await API.me()
            user = me
            state = (me.must_change_password == true) ? .needsPasswordChange : .loggedIn
        } catch {
            // me 失败（刷新也失败时 APIClient 会触发 onUnauthorized）
            state = .loggedOut
        }
    }

    func login(username: String, password: String) async {
        loginError = nil
        do {
            let resp = try await API.login(username: username, password: password)
            await TokenStore.shared.save(access: resp.token, refresh: resp.refresh_token)
            user = resp.user
            state = (resp.user.must_change_password == true) ? .needsPasswordChange : .loggedIn
        } catch let e as APIError {
            loginError = e.message
        } catch {
            loginError = error.localizedDescription
        }
    }

    func changePassword(old: String, new: String) async -> String? {
        do {
            try await API.changePassword(old: old, new: new)
            // 改密后通常需重登（token_version 失效），这里直接登出回登录
            await logout()
            return nil
        } catch let e as APIError {
            return e.message
        } catch {
            return error.localizedDescription
        }
    }

    func logout() async {
        await API.logout()
        await TokenStore.shared.clear()
        user = nil
        state = .loggedOut
    }

    func forceLogout() {
        Task { await TokenStore.shared.clear() }
        user = nil
        state = .loggedOut
    }
}
