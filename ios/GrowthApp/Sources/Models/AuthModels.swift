import Foundation

struct LoginResponse: Decodable {
    let token: String
    let refresh_token: String?
    let user: CurrentUser
}

struct CurrentUser: Decodable, Identifiable {
    let id: Int
    let username: String
    let name: String
    let role: String
    let roleLevel: Int?
    let dept_id: Int?
    let cps_channel_id: Int?
    let cps_role: String?
    let aso_role: String?
    let status: String?
    let must_change_password: Bool?
    let department: Department?

    var displayRole: String {
        switch role {
        case "admin", "super_admin": return "管理员"
        case "dept", "dept_manager", "department_manager": return "部门负责人"
        case "dept_staff", "department_member": return "部门成员"
        case "cps_channel_user": return "渠道账号"
        case "supervisor": return "监督者"
        default: return role
        }
    }
    var isAdmin: Bool { role == "admin" || role == "super_admin" || (roleLevel ?? 9) == 0 }
}

struct Department: Decodable, Identifiable, Hashable {
    let id: Int
    let name: String
}
