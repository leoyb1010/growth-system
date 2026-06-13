import Foundation

/// 令牌存取（封装 Keychain），并提供登出清理。
actor TokenStore {
    static let shared = TokenStore()

    func accessToken() -> String? { Keychain.get(AppConfig.accessTokenKey) }
    func refreshToken() -> String? { Keychain.get(AppConfig.refreshTokenKey) }

    func save(access: String, refresh: String?) {
        Keychain.set(access, for: AppConfig.accessTokenKey)
        if let refresh { Keychain.set(refresh, for: AppConfig.refreshTokenKey) }
    }

    func updateAccess(_ access: String, refresh: String?) {
        Keychain.set(access, for: AppConfig.accessTokenKey)
        if let refresh { Keychain.set(refresh, for: AppConfig.refreshTokenKey) }
    }

    func clear() {
        Keychain.remove(AppConfig.accessTokenKey)
        Keychain.remove(AppConfig.refreshTokenKey)
    }

    var hasSession: Bool { Keychain.get(AppConfig.refreshTokenKey) != nil }
}
