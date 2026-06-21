import SwiftUI
import Charts

@MainActor
final class ForecastVM: ObservableObject {
    @Published var forecast: CpsForecast?
    @Published var loading = false
    @Published var error: String?

    // 维度
    @Published var channels: [CpsDictItem] = []
    @Published var products: [CpsDictItem] = []
    @Published var selChannel: Int? = nil    // 单选，nil=全部（移动端从简）
    @Published var selProduct: Int? = nil

    // 新签情景
    @Published var factor: Double = 100      // 新签强度 %
    @Published var recover = false
    @Published var recoverDays = 14
    @Published var decay: Double = 0         // 续费衰减 %/月

    private var reloadTask: Task<Void, Never>?

    var scenarioActive: Bool { factor != 100 || decay > 0 }

    func loadDicts() async {
        async let ch = try? API.cpsChannels()
        async let pr = try? API.cpsProducts()
        channels = (await ch) ?? []
        products = (await pr) ?? []
    }

    private func query() -> [String: String] {
        var q: [String: String] = [:]
        if let c = selChannel { q["channel_ids"] = String(c) }
        if let p = selProduct { q["product_ids"] = String(p) }
        q["new_sign_factor"] = String(factor / 100)
        if recover { q["recover_after_days"] = String(recoverDays) }
        if decay > 0 { q["renewal_decay_monthly"] = String(decay / 100) }
        return q
    }

    func load() async {
        loading = (forecast == nil); error = nil
        do { forecast = try await API.cpsForecast(query: query()) }
        catch let e as APIError { error = e.message }
        catch { error = error.localizedDescription }
        loading = false
    }

    /// 拖动滑块时防抖，避免每一步都打接口
    func scheduleReload() {
        reloadTask?.cancel()
        reloadTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            if Task.isCancelled { return }
            await load()
        }
    }
}

struct ForecastView: View {
    @StateObject private var vm = ForecastVM()

    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                if vm.forecast?.insufficient_data == true {
                    EmptyHint(icon: "chart.line.flattrend.xyaxis", text: vm.forecast?.message ?? "连续日数据不足，无法预测")
                } else {
                    content
                }
            }
            Color.clear.frame(height: 40)
        }
        .background(Theme.bgLayout)
        .navigationTitle("经营预测")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button("全部渠道") { vm.selChannel = nil; Task { await vm.load() } }
                    ForEach(vm.channels) { ch in
                        Button(ch.name) { vm.selChannel = ch.id; Task { await vm.load() } }
                    }
                } label: {
                    Label(vm.channels.first(where: { $0.id == vm.selChannel })?.name ?? "全部渠道", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.caption)
                }
            }
        }
        .task { await vm.loadDicts(); await vm.load() }
        .refreshable { await vm.load() }
    }

    private var content: some View {
        VStack(spacing: 16) {
            scenarioCard
            modelMeta
            horizonGrid
            forkChart
            Text("* 预测为统计模型推演，越长周期不确定性越大；本年度等长周期请按“情景参考”看待。")
                .font(.caption2).foregroundStyle(Theme.textTertiary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }.padding(16)
    }

    // MARK: 新签情景
    private var scenarioCard: some View {
        CardView {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "新签情景模拟")
                Text("续费(连包)是稳定地板，波动主要来自新签。拨动新签强度，看对各周期的冲击。")
                    .font(.caption).foregroundStyle(Theme.textSecondary)

                HStack {
                    Text("新签强度").font(.subheadline)
                    Spacer()
                    Text("\(Int(vm.factor))%").font(.subheadline.weight(.bold))
                        .foregroundStyle(vm.factor < 100 ? Theme.danger : vm.factor > 100 ? Theme.success : Theme.textPrimary)
                }
                HStack(spacing: 8) {
                    ForEach([("停投", 0.0), ("腰斩", 50.0), ("维持", 100.0), ("加投", 150.0)], id: \.0) { item in
                        Button(item.0) { vm.factor = item.1; Task { await vm.load() } }
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(vm.factor == item.1 ? Theme.primary.opacity(0.14) : Theme.bgLayout)
                            .foregroundStyle(vm.factor == item.1 ? Theme.primary : Theme.textSecondary)
                            .clipShape(Capsule())
                    }
                }
                Slider(value: $vm.factor, in: 0...300, step: 10) { editing in if !editing { Task { await vm.load() } } }
                    .tint(Theme.primary)

                Divider()

                Toggle(isOn: $vm.recover) { Text("设定恢复").font(.subheadline) }
                    .onChange(of: vm.recover) { _ in Task { await vm.load() } }
                if vm.recover {
                    Stepper("\(vm.recoverDays) 天后恢复到正常", value: $vm.recoverDays, in: 1...180, step: 1)
                        .font(.caption)
                        .onChange(of: vm.recoverDays) { _ in vm.scheduleReload() }
                }

                HStack {
                    Text("续费延迟衰减").font(.subheadline)
                    Spacer()
                    Text("\(Int(vm.decay))%/月").font(.subheadline.weight(.semibold))
                }
                Text("连包特性：今天的新签是未来续费来源，新签走弱续费地板会延迟下塌。")
                    .font(.caption2).foregroundStyle(Theme.textTertiary)
                Slider(value: $vm.decay, in: 0...20, step: 1) { editing in if !editing { Task { await vm.load() } } }
                    .tint(Theme.warning)
            }
        }
    }

    // MARK: 模型口径
    private var modelMeta: some View {
        Group {
            if let m = vm.forecast?.model {
                CardView(padding: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Label("锚点 \(vm.forecast?.as_of ?? "—")", systemImage: "calendar").font(.caption2).foregroundStyle(Theme.textSecondary)
                            Spacer()
                            Text("连续数据 \(vm.forecast?.data_days ?? 0) 天").font(.caption2).foregroundStyle(Theme.textTertiary)
                        }
                        HStack(spacing: 14) {
                            metaItem("续费日均", Fmt.money(m.renewal_daily))
                            metaItem("新签日均", Fmt.money(m.newsign_daily))
                            metaItem("续费占比", "\(Int(m.renewal_share_pct))%")
                        }
                    }
                }
            }
        }
    }
    private func metaItem(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(Theme.textTertiary)
            Text(value).font(.footnote.weight(.bold)).foregroundStyle(Theme.textPrimary)
        }
    }

    // MARK: 周期卡
    private var horizonGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(vm.forecast?.horizons ?? []) { h in
                HorizonCard(h: h, scenarioActive: vm.scenarioActive)
            }
        }
    }

    // MARK: 分叉图
    private var forkChart: some View {
        Group {
            let weeks = vm.forecast?.series_weekly ?? []
            if weeks.count > 1 {
                CardView {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(text: "周实收：实际 → 预测")
                        Chart {
                            ForEach(weeks) { w in
                                if let a = w.actual {
                                    LineMark(x: .value("周", w.week ?? ""), y: .value("实收", a), series: .value("类型", "历史实际"))
                                        .foregroundStyle(Theme.primary)
                                        .interpolationMethod(.catmullRom)
                                }
                            }
                            ForEach(weeks) { w in
                                if let b = w.baseline {
                                    LineMark(x: .value("周", w.week ?? ""), y: .value("实收", b), series: .value("类型", "基准预测"))
                                        .foregroundStyle(Theme.success)
                                        .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 3]))
                                        .interpolationMethod(.catmullRom)
                                }
                            }
                            if vm.scenarioActive {
                                ForEach(weeks) { w in
                                    if let s = w.scenario {
                                        LineMark(x: .value("周", w.week ?? ""), y: .value("实收", s), series: .value("类型", "情景预测"))
                                            .foregroundStyle(Theme.danger)
                                            .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 3]))
                                            .interpolationMethod(.catmullRom)
                                    }
                                }
                            }
                        }
                        .frame(height: 200)
                        .chartXAxis(.hidden)
                        chartLegend
                    }
                }
            }
        }
    }
    private var chartLegend: some View {
        HStack(spacing: 14) {
            legendDot(Theme.primary, "实际")
            legendDot(Theme.success, "基准")
            if vm.scenarioActive { legendDot(Theme.danger, "情景") }
        }.font(.caption2).foregroundStyle(Theme.textSecondary)
    }
    private func legendDot(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 4) { Circle().fill(color).frame(width: 7, height: 7); Text(text) }
    }
}

// MARK: - 周期卡片
private struct HorizonCard: View {
    let h: ForecastHorizon
    let scenarioActive: Bool

    private var confColor: Color {
        switch h.confidence {
        case "high": return Theme.success
        case "medium": return Theme.warning
        default: return Theme.textTertiary
        }
    }
    private var confLabel: String {
        switch h.confidence {
        case "high": return "高置信"
        case "medium": return "中置信"
        default: return "低·参考"
        }
    }

    var body: some View {
        CardView(padding: 14) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(h.label ?? "—").font(.subheadline.weight(.bold)).foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Text(confLabel).font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(confColor.opacity(0.14)).foregroundStyle(confColor).clipShape(Capsule())
                }
                Text("¥\(Fmt.money(h.baseline?.p50 ?? 0))")
                    .font(.system(size: 22, weight: .bold, design: .rounded)).foregroundStyle(Theme.textPrimary)
                    .monospacedDigit().minimumScaleFactor(0.7).lineLimit(1)
                Text("区间 \(Fmt.money(h.baseline?.p25 ?? 0))~\(Fmt.money(h.baseline?.p75 ?? 0))")
                    .font(.caption2).foregroundStyle(Theme.textTertiary)
                Text("已落袋 ¥\(Fmt.money(h.actual_to_date)) · 待预测 \(h.projected_days)天")
                    .font(.caption2).foregroundStyle(Theme.textTertiary)

                if scenarioActive, let delta = h.delta {
                    Divider().padding(.vertical, 2)
                    let neg = delta.amount < 0
                    HStack {
                        Text("情景").font(.caption2).foregroundStyle(Theme.textSecondary)
                        Spacer()
                        Text("¥\(Fmt.money(h.scenario?.p50 ?? 0))").font(.footnote.weight(.bold)).foregroundStyle(Theme.textPrimary)
                    }
                    Text("\(neg ? "▼" : (delta.amount > 0 ? "▲" : "")) ¥\(Fmt.money(abs(delta.amount)))（\(delta.pct.map { String(format: "%+.1f%%", $0) } ?? "—")）")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(delta.amount == 0 ? Theme.textTertiary : (neg ? Theme.danger : Theme.success))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
        }
    }
}
