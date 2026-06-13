import Foundation

/// 后端统一错误，附带可选 error_type（如 PASSWORD_CHANGE_REQUIRED）。
struct APIError: Error, LocalizedError {
    let code: Int
    let message: String
    let httpStatus: Int
    let errorType: String?

    var errorDescription: String? { message }

    var isUnauthorized: Bool { httpStatus == 401 }
    var requiresPasswordChange: Bool { errorType == "PASSWORD_CHANGE_REQUIRED" }

    static func network(_ underlying: Error) -> APIError {
        APIError(code: -1, message: underlying.localizedDescription, httpStatus: -1, errorType: nil)
    }
    static let decoding = APIError(code: -2, message: "数据解析失败", httpStatus: -1, errorType: nil)
}

/// 后端统一响应封装 { code, data, message }
struct APIEnvelope<T: Decodable>: Decodable {
    let code: Int
    let data: T?
    let message: String?
    let error_type: String?
}
