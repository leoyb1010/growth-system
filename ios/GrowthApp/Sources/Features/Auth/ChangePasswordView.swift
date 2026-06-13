import SwiftUI

struct ChangePasswordView: View {
    @EnvironmentObject var session: SessionManager
    @Environment(\.dismiss) var dismiss
    var forced: Bool = false

    @State private var oldPwd = ""
    @State private var newPwd = ""
    @State private var confirmPwd = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Form {
                if forced {
                    Section {
                        Text("首次登录需修改初始密码").foregroundStyle(Theme.warning)
                    }
                }
                Section("修改密码") {
                    SecureField("当前密码", text: $oldPwd)
                    SecureField("新密码（至少8位，含字母和数字）", text: $newPwd)
                    SecureField("确认新密码", text: $confirmPwd)
                }
                if let error { Section { Text(error).foregroundStyle(Theme.danger).font(.caption) } }
                Section {
                    Button {
                        submit()
                    } label: {
                        HStack { if loading { ProgressView() }; Text("确认修改") }
                    }
                    .disabled(loading || oldPwd.isEmpty || newPwd.count < 8 || newPwd != confirmPwd)
                }
            }
            .navigationTitle("修改密码")
            .toolbar {
                if !forced {
                    ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                } else {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("退出登录") { Task { await session.logout() } }
                    }
                }
            }
        }
    }

    private func submit() {
        guard newPwd == confirmPwd else { error = "两次输入的新密码不一致"; return }
        Task {
            loading = true
            let result = await session.changePassword(old: oldPwd, new: newPwd)
            loading = false
            if let result { error = result } else if !forced { dismiss() }
        }
    }
}
