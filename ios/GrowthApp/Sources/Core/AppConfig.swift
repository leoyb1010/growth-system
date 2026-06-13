import Foundation

/// 全局配置。baseURL 指向线上 Cloudflare 隧道域名；可在「我的→设置」里切换以便联调。
enum AppConfig {
    /// 默认线上 API 根地址。⚠️ 上线前替换为你的实际隧道域名（必须 HTTPS，满足 ATS）。
    /// 例如：https://growth.yourdomain.com
    static let defaultBaseURL = "https://REPLACE-WITH-YOUR-TUNNEL-DOMAIN"

    /// 当前生效的 baseURL（可被用户在设置里覆盖，存 UserDefaults）。
    static var baseURL: String {
        get { UserDefaults.standard.string(forKey: "api_base_url") ?? defaultBaseURL }
        set { UserDefaults.standard.set(newValue, forKey: "api_base_url") }
    }

    /// API 前缀。后端所有业务接口都在 /api 下。
    static var apiRoot: String { baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api" }

    static let accessTokenKey = "growth.accessToken"
    static let refreshTokenKey = "growth.refreshToken"
}
