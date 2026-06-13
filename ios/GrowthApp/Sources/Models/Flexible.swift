import Foundation

/// 宽松数值：后端 DECIMAL 字段有时返回字符串，有时返回数字。统一解析为 Double。
@propertyWrapper
struct FlexibleDouble: Decodable {
    var wrappedValue: Double
    init(wrappedValue: Double) { self.wrappedValue = wrappedValue }
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let d = try? c.decode(Double.self) { wrappedValue = d }
        else if let s = try? c.decode(String.self), let d = Double(s) { wrappedValue = d }
        else if let i = try? c.decode(Int.self) { wrappedValue = Double(i) }
        else { wrappedValue = 0 }
    }
}

/// 宽松整数
@propertyWrapper
struct FlexibleInt: Decodable {
    var wrappedValue: Int
    init(wrappedValue: Int) { self.wrappedValue = wrappedValue }
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let i = try? c.decode(Int.self) { wrappedValue = i }
        else if let d = try? c.decode(Double.self) { wrappedValue = Int(d) }
        else if let s = try? c.decode(String.self), let i = Int(s) { wrappedValue = i }
        else { wrappedValue = 0 }
    }
}

extension KeyedDecodingContainer {
    func decodeFlexDouble(_ key: Key) -> Double {
        ((try? decode(FlexibleDouble.self, forKey: key)) ?? FlexibleDouble(wrappedValue: 0)).wrappedValue
    }
    func decodeFlexInt(_ key: Key) -> Int {
        ((try? decode(FlexibleInt.self, forKey: key)) ?? FlexibleInt(wrappedValue: 0)).wrappedValue
    }
}
