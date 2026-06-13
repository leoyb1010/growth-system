import SwiftUI

/// 通用卡片容器
struct CardView<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radius, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
    }
}

/// 指标卡
struct MetricCard: View {
    let label: String
    let value: String
    var sub: String? = nil
    var color: Color = Theme.textPrimary
    var body: some View {
        CardView {
            VStack(alignment: .leading, spacing: 4) {
                Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
                Text(value).font(.system(size: 28, weight: .bold)).foregroundStyle(color)
                if let sub { Text(sub).font(.caption2).foregroundStyle(Theme.textSecondary) }
            }
        }
    }
}

/// 状态标签
struct StatusTag: View {
    let text: String
    var color: Color
    init(_ text: String, color: Color? = nil) {
        self.text = text
        self.color = color ?? Theme.statusColor(text)
    }
    var body: some View {
        Text(text)
            .font(.caption2).bold()
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.12))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

/// 区块标题
struct SectionTitle: View {
    let text: String
    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2).fill(Theme.primary).frame(width: 4, height: 16)
            Text(text).font(.headline)
            Spacer()
        }
    }
}

/// 通用异步加载态包装
struct LoadStateView<Content: View>: View {
    let isLoading: Bool
    let error: String?
    var retry: (() -> Void)?
    @ViewBuilder var content: Content
    var body: some View {
        if isLoading {
            ProgressView().frame(maxWidth: .infinity, minHeight: 120)
        } else if let error {
            VStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle").font(.title2).foregroundStyle(Theme.warning)
                Text(error).font(.subheadline).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                if let retry { Button("重试", action: retry).buttonStyle(.borderedProminent) }
            }.frame(maxWidth: .infinity, minHeight: 160).padding()
        } else {
            content
        }
    }
}
