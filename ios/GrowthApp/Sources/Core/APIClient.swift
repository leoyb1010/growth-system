import Foundation

/// 统一网络层：
/// - 注入 Authorization: Bearer
/// - 解析 { code, data, message } 封装，code != 0 抛 APIError
/// - 401 自动用 refresh_token 刷新并重放原请求（单飞，避免并发刷新风暴）
/// - 暴露 SSE 流式接口供 AI 问答使用
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder = JSONDecoder()

    /// 刷新单飞：并发 401 共享同一次刷新
    private var refreshTask: Task<Void, Error>?
    private let refreshLock = NSLock()

    /// 登出回调（刷新失败时由上层跳登录）
    var onUnauthorized: (() -> Void)?

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30
        cfg.waitsForConnectivity = true
        // 原生 App 不依赖 Cookie 鉴权，禁用 Cookie 存储更干净
        cfg.httpShouldSetCookies = false
        cfg.httpCookieAcceptPolicy = .never
        session = URLSession(configuration: cfg)
    }

    // MARK: - 请求构建

    private func makeURL(_ path: String, query: [String: String]? = nil) -> URL? {
        let base = AppConfig.apiRoot + (path.hasPrefix("/") ? path : "/" + path)
        guard var comps = URLComponents(string: base) else { return nil }
        if let query, !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        return comps.url
    }

    private func authorizedRequest(_ url: URL, method: String, body: Data?) async -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = await TokenStore.shared.accessToken() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body
        return req
    }

    // MARK: - 核心请求（含 401 自动刷新）

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        query: [String: String]? = nil,
        body: Encodable? = nil,
        as type: T.Type = T.self,
        retryOn401: Bool = true
    ) async throws -> T {
        guard let url = makeURL(path, query: query) else { throw APIError.decoding }
        let bodyData = try body.map { try JSONEncoder().encode(AnyEncodable($0)) }
        let req = await authorizedRequest(url, method: method, body: bodyData)

        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await session.data(for: req)
        } catch {
            throw APIError.network(error)
        }
        let http = resp as? HTTPURLResponse
        let status = http?.statusCode ?? -1

        // 401 → 刷新后重放一次
        if status == 401, retryOn401 {
            do {
                try await refreshIfNeeded()
            } catch {
                await handleUnauthorized()
                throw decodeError(data: data, status: status)
            }
            return try await request(path, method: method, query: query, body: body, as: type, retryOn401: false)
        }

        let env: APIEnvelope<T>
        do {
            env = try decoder.decode(APIEnvelope<T>.self, from: data)
        } catch {
            // 非标准封装（极少数）→ 尝试直接解码 T
            if let direct = try? decoder.decode(T.self, from: data) { return direct }
            throw decodeError(data: data, status: status)
        }

        if env.code == 0 {
            guard let value = env.data else {
                // data 为空但语义成功（如 EmptyResponse）
                if let empty = EmptyResponse() as? T { return empty }
                throw APIError.decoding
            }
            return value
        }
        throw APIError(code: env.code, message: env.message ?? "请求失败", httpStatus: status, errorType: env.error_type)
    }

    /// 无返回体的请求（DELETE / 某些 POST）
    @discardableResult
    func send(_ path: String, method: String, query: [String: String]? = nil, body: Encodable? = nil) async throws -> EmptyResponse {
        try await request(path, method: method, query: query, body: body, as: EmptyResponse.self)
    }

    private func decodeError(data: Data, status: Int) -> APIError {
        if let env = try? decoder.decode(APIEnvelope<EmptyResponse>.self, from: data) {
            return APIError(code: env.code, message: env.message ?? "请求失败", httpStatus: status, errorType: env.error_type)
        }
        return APIError(code: -1, message: "请求失败(\(status))", httpStatus: status, errorType: nil)
    }

    // MARK: - 刷新（单飞）

    private func refreshIfNeeded() async throws {
        refreshLock.lock()
        if let task = refreshTask {
            refreshLock.unlock()
            try await task.value
            return
        }
        let task = Task { try await self.performRefresh() }
        refreshTask = task
        refreshLock.unlock()
        defer {
            refreshLock.lock(); refreshTask = nil; refreshLock.unlock()
        }
        try await task.value
    }

    private func performRefresh() async throws {
        guard let refresh = await TokenStore.shared.refreshToken() else {
            throw APIError(code: 401, message: "未登录", httpStatus: 401, errorType: nil)
        }
        guard let url = makeURL("/auth/refresh") else { throw APIError.decoding }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["refresh_token": refresh])

        let (data, resp) = try await session.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? -1
        guard status == 200,
              let env = try? decoder.decode(APIEnvelope<RefreshResult>.self, from: data),
              env.code == 0, let result = env.data else {
            throw APIError(code: 401, message: "刷新失败", httpStatus: status, errorType: nil)
        }
        await TokenStore.shared.updateAccess(result.token, refresh: result.refresh_token)
    }

    private func handleUnauthorized() async {
        await TokenStore.shared.clear()
        await MainActor.run { self.onUnauthorized?() }
    }

    // MARK: - 二进制下载（带鉴权，如周报 PNG / 附件原图）

    func downloadData(_ path: String, query: [String: String]? = nil, retryOn401: Bool = true) async throws -> Data {
        guard let url = makeURL(path, query: query) else { throw APIError.decoding }
        let req = await authorizedRequest(url, method: "GET", body: nil)
        let (data, resp) = try await session.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? -1
        if status == 401, retryOn401 {
            try await refreshIfNeeded()
            return try await downloadData(path, query: query, retryOn401: false)
        }
        guard (200...299).contains(status) else {
            throw APIError(code: -1, message: "下载失败(\(status))", httpStatus: status, errorType: nil)
        }
        return data
    }

    // MARK: - SSE 流式（AI 问答）

    /// 返回一个异步字节流的事件序列。每个事件是后端 `data: {...}` 解析后的 JSON 对象。
    func stream(_ path: String, body: Encodable) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    guard let url = makeURL(path) else { throw APIError.decoding }
                    var req = await authorizedRequest(url, method: "POST", body: try JSONEncoder().encode(AnyEncodable(body)))
                    req.setValue("text/event-stream", forHTTPHeaderField: "Accept")

                    let (bytes, resp) = try await session.bytes(for: req)
                    let status = (resp as? HTTPURLResponse)?.statusCode ?? -1
                    if status == 401 {
                        try await refreshIfNeeded()
                        // 刷新后重建请求重试一次
                        req = await authorizedRequest(url, method: "POST", body: req.httpBody)
                        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    }
                    let lines = status == 401 ? try await session.bytes(for: req).0.lines : bytes.lines
                    for try await line in lines {
                        guard line.hasPrefix("data:") else { continue }
                        let json = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                        guard let d = json.data(using: .utf8),
                              let event = try? JSONDecoder().decode(SSEEvent.self, from: d) else { continue }
                        continuation.yield(event)
                        if event.type == "done" || event.type == "error" {
                            continuation.finish()
                            return
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

/// 刷新结果
struct RefreshResult: Decodable {
    let token: String
    let refresh_token: String?
}

/// SSE 单个事件
struct SSEEvent: Decodable {
    let type: String          // content / done / error / warning
    let text: String?
    let message: String?
}

/// 空响应占位
struct EmptyResponse: Decodable { init() {} }

/// 把任意 Encodable 擦除为可编码值
struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { encodeFunc = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeFunc(encoder) }
}
