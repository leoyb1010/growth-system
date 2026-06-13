import SwiftUI

struct ChatMessage: Identifiable {
    let id = UUID()
    let isUser: Bool
    var text: String
}

@MainActor
final class AIChatVM: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var input = ""
    @Published var streaming = false
    private var streamTask: Task<Void, Never>?

    struct ChatBody: Encodable { let query: String; let currentPage: String }

    func send() {
        let q = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !streaming else { return }
        input = ""
        messages.append(ChatMessage(isUser: true, text: q))
        let aiIndex = messages.count
        messages.append(ChatMessage(isUser: false, text: ""))
        streaming = true

        streamTask = Task {
            do {
                let stream = APIClient.shared.stream("/ai/chat-stream", body: ChatBody(query: q, currentPage: "dashboard"))
                for try await event in stream {
                    switch event.type {
                    case "content":
                        if let t = event.text { messages[aiIndex].text += t }
                    case "error":
                        messages[aiIndex].text += "\n⚠️ " + (event.message ?? "AI 服务暂时不可用")
                    default: break
                    }
                }
            } catch {
                if messages[aiIndex].text.isEmpty {
                    messages[aiIndex].text = "⚠️ 连接失败：" + error.localizedDescription
                }
            }
            streaming = false
        }
    }

    func stop() { streamTask?.cancel(); streaming = false }
}

struct AIChatView: View {
    @StateObject private var vm = AIChatVM()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if vm.messages.isEmpty {
                                introCard
                            }
                            ForEach(vm.messages) { msg in
                                MessageBubble(message: msg).id(msg.id)
                            }
                        }.padding(16)
                    }
                    .onChange(of: vm.messages.count) { _ in
                        if let last = vm.messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                    }
                }
                Divider()
                HStack(spacing: 8) {
                    TextField("问问 AI 副驾…", text: $vm.input, axis: .vertical)
                        .lineLimit(1...4)
                        .padding(10)
                        .background(Theme.bgLayout)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                    if vm.streaming {
                        Button { vm.stop() } label: { Image(systemName: "stop.circle.fill").font(.title2).foregroundStyle(Theme.danger) }
                    } else {
                        Button { vm.send() } label: { Image(systemName: "arrow.up.circle.fill").font(.title2) }
                            .disabled(vm.input.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }.padding(12)
            }
            .background(Theme.bgLayout)
            .navigationTitle("AI 副驾")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var introCard: some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                Label("AI 副驾", systemImage: "sparkles").font(.headline).foregroundStyle(Theme.primary)
                Text("可以问我：本周哪些项目有风险？GMV 完成率为什么偏低？帮我总结本周重点。")
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
            }
        }
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 40) }
            Text(message.text.isEmpty && !message.isUser ? "思考中…" : message.text)
                .font(.subheadline)
                .foregroundStyle(message.isUser ? .white : Theme.textPrimary)
                .padding(12)
                .background(message.isUser ? Theme.primary : Theme.bgCard)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(message.isUser ? nil : RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.border))
            if !message.isUser { Spacer(minLength: 40) }
        }
    }
}
