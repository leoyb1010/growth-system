import SwiftUI

// MARK: - 卡片

struct CardView<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.bgCard)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.radius, style: .continuous).strokeBorder(Theme.border, lineWidth: 1))
            .shadow(color: Theme.cardShadow, radius: 14, x: 0, y: 6)
    }
}

// MARK: - 数字滚动

struct CountUpText: View {
    let value: Double
    var format: (Double) -> String = { Fmt.pct($0) }
    var font: Font = .system(size: 30, weight: .bold, design: .rounded)
    var color: Color = Theme.textPrimary
    @State private var shown: Double = 0
    var body: some View {
        Text(format(shown))
            .font(font).foregroundStyle(color)
            .monospacedDigit()
            .onAppear { withAnimation(.easeOut(duration: 0.8)) { shown = value } }
            .onChange(of: value) { v in withAnimation(.easeOut(duration: 0.5)) { shown = v } }
    }
}

// MARK: - 渐变指标大卡（Hero）

struct HeroMetric: View {
    let label: String
    let rate: Double
    let actual: Double
    let target: Double
    var icon: String = "chart.line.uptrend.xyaxis"
    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: Theme.radius, style: .continuous).fill(Theme.gradient(for: rate))
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: icon).font(.system(size: 15, weight: .semibold))
                    Text(label).font(.subheadline.weight(.semibold))
                    Spacer()
                }.foregroundStyle(.white.opacity(0.95))
                CountUpText(value: rate, format: { Fmt.pct($0) }, font: .system(size: 34, weight: .heavy, design: .rounded), color: .white)
                Text("\(Fmt.money(actual)) / \(Fmt.money(target))")
                    .font(.caption).foregroundStyle(.white.opacity(0.85))
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.25)).frame(height: 6)
                        Capsule().fill(.white).frame(width: geo.size.width * min(rate,100)/100, height: 6)
                    }
                }.frame(height: 6).padding(.top, 2)
            }.padding(16)
        }
        .frame(height: 130)
        .shadow(color: Theme.rateColor(rate).opacity(0.25), radius: 12, x: 0, y: 6)
    }
}

// MARK: - 小指标瓷砖

struct StatTile: View {
    let label: String
    let value: String
    var sub: String? = nil
    var color: Color = Theme.textPrimary
    var icon: String? = nil
    var body: some View {
        CardView(padding: 14) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 5) {
                    if let icon { Image(systemName: icon).font(.caption2).foregroundStyle(color) }
                    Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
                }
                Text(value).font(.system(size: 22, weight: .bold, design: .rounded)).foregroundStyle(color).monospacedDigit()
                if let sub { Text(sub).font(.caption2).foregroundStyle(Theme.textTertiary) }
            }
        }
    }
}

// MARK: - 环形进度

struct RingProgress: View {
    let rate: Double
    var size: CGFloat = 56
    var body: some View {
        ZStack {
            Circle().stroke(Theme.border, lineWidth: 6)
            Circle().trim(from: 0, to: min(rate,100)/100)
                .stroke(Theme.rateColor(rate), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(rate))").font(.system(size: size*0.28, weight: .bold, design: .rounded)).foregroundStyle(Theme.rateColor(rate))
        }.frame(width: size, height: size)
    }
}

// MARK: - 迷你 sparkline

struct Sparkline: View {
    let data: [Double]
    var color: Color = Theme.primary
    var height: CGFloat = 36
    var body: some View {
        GeometryReader { geo in
            let pts = points(in: geo.size)
            ZStack {
                if pts.count > 1 {
                    Path { p in p.addLines(pts) }.stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    Path { p in
                        p.addLines(pts)
                        p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height))
                        p.addLine(to: CGPoint(x: 0, y: geo.size.height))
                        p.closeSubpath()
                    }.fill(LinearGradient(colors: [color.opacity(0.18), color.opacity(0.01)], startPoint: .top, endPoint: .bottom))
                }
            }
        }.frame(height: height)
    }
    private func points(in size: CGSize) -> [CGPoint] {
        guard data.count > 1 else { return [] }
        let mn = data.min() ?? 0, mx = data.max() ?? 1
        let range = mx - mn == 0 ? 1 : mx - mn
        return data.enumerated().map { i, v in
            CGPoint(x: size.width * CGFloat(i)/CGFloat(data.count-1),
                    y: size.height * (1 - CGFloat((v-mn)/range)))
        }
    }
}

// MARK: - 标签 / 标题

struct StatusTag: View {
    let text: String
    var color: Color
    init(_ text: String, color: Color? = nil) { self.text = text; self.color = color ?? Theme.statusColor(text) }
    var body: some View {
        Text(text).font(.caption2.weight(.semibold))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(color.opacity(0.12)).foregroundStyle(color)
            .clipShape(Capsule())
    }
}

struct SectionTitle: View {
    let text: String
    var action: (() -> Void)? = nil
    var actionLabel: String = "查看全部"
    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2).fill(Theme.heroGradient).frame(width: 4, height: 16)
            Text(text).font(.headline.weight(.bold)).foregroundStyle(Theme.textPrimary)
            Spacer()
            if let action {
                Button(action: action) { HStack(spacing: 2) { Text(actionLabel); Image(systemName: "chevron.right").font(.caption2) }.font(.caption).foregroundStyle(Theme.primary) }
            }
        }
    }
}

// MARK: - 加载/错误/空态

struct LoadStateView<Content: View>: View {
    let isLoading: Bool
    let error: String?
    var retry: (() -> Void)?
    @ViewBuilder var content: Content
    var body: some View {
        if isLoading {
            VStack(spacing: 12) { ProgressView().controlSize(.large); Text("加载中…").font(.caption).foregroundStyle(Theme.textTertiary) }
                .frame(maxWidth: .infinity, minHeight: 200)
        } else if let error {
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.icloud").font(.system(size: 36)).foregroundStyle(Theme.textTertiary)
                Text(error).font(.subheadline).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                if let retry { Button(action: retry) { Text("重试").font(.subheadline.weight(.semibold)) }.buttonStyle(.borderedProminent).tint(Theme.primary) }
            }.frame(maxWidth: .infinity, minHeight: 220).padding()
        } else { content }
    }
}

struct EmptyHint: View {
    let icon: String
    let text: String
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.system(size: 30)).foregroundStyle(Theme.textTertiary)
            Text(text).font(.subheadline).foregroundStyle(Theme.textTertiary)
        }.frame(maxWidth: .infinity, minHeight: 120)
    }
}

// 顶部分段控件
struct Segmented: View {
    let items: [String]
    @Binding var selection: Int
    @Namespace private var ns
    var body: some View {
        HStack(spacing: 4) {
            ForEach(items.indices, id: \.self) { i in
                let active = selection == i
                Text(items[i]).font(.subheadline.weight(active ? .bold : .medium))
                    .foregroundStyle(active ? .white : Theme.textSecondary)
                    .padding(.vertical, 8).frame(maxWidth: .infinity)
                    .background(ZStack { if active { RoundedRectangle(cornerRadius: 10).fill(Theme.heroGradient).matchedGeometryEffect(id: "seg", in: ns) } })
                    .contentShape(Rectangle())
                    .onTapGesture { withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { selection = i } }
            }
        }.padding(4).background(Theme.bgLayout).clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
