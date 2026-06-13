import Foundation

struct ManagedUser: Decodable, Identifiable {
    let id: Int
    let username: String
    let name: String
    let role: String
    let status: String?
    let email: String?
    let mobile: String?
    let last_login_at: String?
    let cps_role: String?
    let aso_role: String?
    let Department: Department?
    var deptName: String { Department?.name ?? "—" }
    var displayRole: String {
        switch role {
        case "admin", "super_admin": return "管理员"
        case "dept", "dept_manager", "department_manager": return "部门负责人"
        case "dept_staff", "department_member": return "部门成员"
        case "cps_channel_user": return "渠道账号"
        case "supervisor": return "监督者"
        case "cps_admin": return "CPS管理"; case "cps_ops": return "CPS运营"
        case "aso_admin": return "ASO管理"; case "aso_ops": return "ASO运营"; case "aso_viewer": return "ASO查看"
        default: return role
        }
    }
    var isActive: Bool { (status ?? "active") == "active" }
}

struct DeptFull: Decodable, Identifiable {
    let id: Int
    let name: String
    let status: String?
    let type: String?
    @FlexibleInt var user_count: Int
    enum CodingKeys: String, CodingKey { case id, name, status, type, user_count }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        id = c.decodeFlexInt(.id)
        name = (try? c.decode(String.self, forKey: .name)) ?? "—"
        status = try? c.decode(String.self, forKey: .status)
        type = try? c.decode(String.self, forKey: .type)
        _user_count = (try? c.decode(FlexibleInt.self, forKey: .user_count)) ?? .init(wrappedValue: 0)
    }
}

struct AuditLogItem: Decodable, Identifiable {
    let id: Int
    let table_name: String?
    let record_id: Int?
    let action: String?
    let operator_name: String?
    let created_at: String?
}
