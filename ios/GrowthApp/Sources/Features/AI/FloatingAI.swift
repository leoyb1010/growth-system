import SwiftUI

// MARK: - 全局悬浮 AI 副驾

struct BadgeSummary: Decodable {
    let highRiskCount: Int?
    let unclosedCount: Int?
    let staleCount: Int?
    let totalBadge: Int?
}

@MainActor
final class FloatingAIVM: ObservableObject {
    @Published var open = false
    @Published var badge = 0

    func loadBadge() async {
        if let b: BadgeSummary = try? await APIClient.shared.request("/ai/badge-summary", as: BadgeSummary.self) {
            badge = b.totalBadge ?? 0
        }
    }
}

/// 覆盖在整个 App 之上的悬浮球 + 展开聊天面板
struct FloatingAIOverlay: View {
    @StateObject private var vm = FloatingAIVM()
    @State private var offset = CGSize.zero
    @State private var drag = CGSize.zero

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottomTrailing) {
                Color.clear
                bubble
                    .offset(x: offset.width + drag.width, y: offset.height + drag.height)
                    .padding(.trailing, 18)
                    .padding(.bottom, 96) // 避开 TabBar
                    .gesture(
                        DragGesture()
                            .onChanged { drag = $0.translation }
                            .onEnded { _ in offset.width += drag.width; offset.height += drag.height; drag = .zero }
                    )
            }
        }
        .ignoresSafeArea(.keyboard)
        .sheet(isPresented: $vm.open) { AIChatPanel() }
        .task { await vm.loadBadge() }
    }

    private var bubble: some View {
        Button { vm.open = true } label: {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    // 用品牌 logo 作为悬浮按钮：圆形裁切 + 蓝色发光描边，边缘干净
                    Image("AILogo")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 60, height: 60)
                        .clipShape(Circle())
                        .overlay(
                            Circle().strokeBorder(
                                LinearGradient(colors: [Theme.primaryLight, Theme.primary], startPoint: .top, endPoint: .bottom),
                                lineWidth: 2)
                        )
                        .shadow(color: Theme.primary.opacity(0.55), radius: 14, x: 0, y: 5)
                        .shadow(color: .black.opacity(0.25), radius: 4, x: 0, y: 2)
                }
                if vm.badge > 0 {
                    Text("\(min(vm.badge,99))")
                        .font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Theme.danger).clipShape(Capsule())
                        .overlay(Capsule().stroke(.white, lineWidth: 1.5))
                        .offset(x: 6, y: -4)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 聊天面板

struct ChatMessage: Identifiable {
    let id = UUID(); let isUser: Bool; var text: String
}

@MainActor
final class AIChatVM: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var input = ""
    @Published var streaming = false
    @Published var page = "dashboard"
    private var task: Task<Void, Never>?
    struct Body: Encodable { let query: String; let currentPage: String }

    let suggestions = ["本周哪些项目有风险？", "GMV 为什么落后？", "帮我总结本周重点", "哪些事项需要今天收口？"]

    func send(_ text: String? = nil) {
        let q = (text ?? input).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !streaming else { return }
        input = ""
        messages.append(ChatMessage(isUser: true, text: q))
        let idx = messages.count
        messages.append(ChatMessage(isUser: false, text: ""))
        streaming = true
        task = Task {
            do {
                for try await ev in APIClient.shared.stream("/ai/chat-stream", body: Body(query: q, currentPage: page)) {
                    if ev.type == "content", let t = ev.text { messages[idx].text += t }
                    else if ev.type == "error" { messages[idx].text += "\n⚠️ " + (ev.message ?? "AI 暂时不可用") }
                }
            } catch {
                if messages[idx].text.isEmpty { messages[idx].text = "⚠️ 连接失败：" + error.localizedDescription }
            }
            streaming = false
        }
    }
    func stop() { task?.cancel(); streaming = false }
}

struct AIChatPanel: View {
    @StateObject private var vm = AIChatVM()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if vm.messages.isEmpty { intro }
                            ForEach(vm.messages) { Bubble(message: $0).id($0.id) }
                        }.padding(16)
                    }
                    .onChange(of: vm.messages.count) { _ in
                        if let last = vm.messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                    }
                }
                if vm.messages.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(vm.suggestions, id: \.self) { s in
                                Button { vm.send(s) } label: {
                                    Text(s).font(.caption).padding(.horizontal, 12).padding(.vertical, 8)
                                        .background(Theme.primary.opacity(0.08)).foregroundStyle(Theme.primary)
                                        .clipShape(Capsule())
                                }
                            }
                        }.padding(.horizontal, 16)
                    }.padding(.bottom, 8)
                }
                Divider()
                HStack(spacing: 8) {
                    TextField("问问 AI 副驾…", text: $vm.input, axis: .vertical)
                        .lineLimit(1...4).padding(10).background(Theme.bgLayout).clipShape(RoundedRectangle(cornerRadius: 18))
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
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        }
        .presentationDetents([.large, .medium])
        .presentationDragIndicator(.visible)
    }

    private var intro: some View {
        CardView {
            VStack(alignment: .leading, spacing: 8) {
                HStack { Image(systemName: "sparkles").foregroundStyle(Theme.primary); Text("AI 副驾").font(.headline) }
                Text("基于你当前可见的业务数据回答。可以问风险、偏差归因、本周重点等。")
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
            }
        }
    }
}

struct Bubble: View {
    let message: ChatMessage
    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 40) }
            Text(message.text.isEmpty && !message.isUser ? "思考中…" : message.text)
                .font(.subheadline)
                .foregroundStyle(message.isUser ? .white : Theme.textPrimary)
                .padding(12)
                .background(message.isUser ? AnyShapeStyle(Theme.heroGradient) : AnyShapeStyle(Theme.bgCard))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(message.isUser ? nil : RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
            if !message.isUser { Spacer(minLength: 40) }
        }
    }
}
