import SwiftUI

@MainActor
final class DashForecastVM: ObservableObject {
    @Published var forecast: DashForecast?
    @Published var loading = false
    @Published var error: String?

    @Published var scenario = "neutral"
    @Published var growth: Double = 0      // 季度环比增速 %
    @Published var season: Double = 100    // 季节系数 %
    @Published var event: Double = 0       // 事件加成 %

    private var reloadTask: Task<Void, Never>?

    func factors() -> DashFactors {
        DashFactors(scenario: scenario, global_growth: growth, season_factor: season / 100, event_pct: event)
    }

    func load() async {
        loading = (forecast == nil); error = nil
        do { forecast = try await API.dashboardForecast(factors()) }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }

    func scheduleReload() {
        reloadTask?.cancel()
        reloadTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            if Task.isCancelled { return }
            await load()
        }
    }
}

struct DashboardForecastView: View {
    @StateObject private var vm = DashForecastVM()

    var body: some View {
        ScrollView {
            LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                content
            }
            Color.clear.frame(height: 40)
        }
        .background(Theme.bgLayout)
        .navigationTitle("经营预测")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private var content: some View {
        VStack(spacing: 14) {
            factorCard
            if let f = vm.forecast {
                HStack {
                    Text("锚点 \(f.as_of ?? "—") · 本季 \(f.current_quarter ?? "")").font(.caption2).foregroundStyle(Theme.textSecondary)
                    Spacer()
                    Text("时间进度 \(Int(f.quarter_time_progress_pct))%").font(.caption2).foregroundStyle(Theme.textTertiary)
                }
                ForEach(f.indicators ?? []) { ind in IndicatorCardView(ind: ind) }
                if let cps = f.cps_linkage { cpsLinkageCard(cps) }
                Text("* KPI 为季度快照口径，本季已过越多越准；越靠后的季度越依赖外推与因素假设，请按“情景参考”看待。")
                    .font(.caption2).foregroundStyle(Theme.textTertiary).frame(maxWidth: .infinity, alignment: .leading)
            }
        }.padding(16)
    }

    private var factorCard: some View {
        CardView {
            VStack(alignment: .leading, spacing: 12) {
                SectionTitle(text: "影响因素")
                VStack(alignment: .leading, spacing: 6) {
                    Text("情景").font(.caption).foregroundStyle(Theme.textSecondary)
                    Picker("情景", selection: $vm.scenario) {
                        Text("保守").tag("conservative"); Text("中性").tag("neutral"); Text("乐观").tag("optimistic")
                    }.pickerStyle(.segmented).onChange(of: vm.scenario) { _ in Task { await vm.load() } }
                }
                sliderRow(title: "季度环比增速", value: $vm.growth, range: -50...100, step: 5, suffix: "%")
                sliderRow(title: "季节系数", value: $vm.season, range: 50...150, step: 5, suffix: "%", display: { String(format: "%.2f×", $0 / 100) })
                sliderRow(title: "事件加成", value: $vm.event, range: -50...50, step: 5, suffix: "%")
            }
        }
    }

    private func sliderRow(title: String, value: Binding<Double>, range: ClosedRange<Double>, step: Double, suffix: String, display: ((Double) -> String)? = nil) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(.caption).foregroundStyle(Theme.textSecondary)
                Spacer()
                Text(display?(value.wrappedValue) ?? "\(value.wrappedValue > 0 ? "+" : "")\(Int(value.wrappedValue))\(suffix)")
                    .font(.caption.weight(.semibold)).foregroundStyle(Theme.textPrimary)
            }
            Slider(value: value, in: range, step: step) { editing in if !editing { Task { await vm.load() } } }.tint(Theme.primary)
        }
    }

    private func cpsLinkageCard(_ cps: DashCpsLinkage) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle(text: "CPS 业务联动")
                Text("真实日流速 · 续费日均 ¥\(Fmt.money(cps.renewal_daily)) / 新签日均 ¥\(Fmt.money(cps.newsign_daily))")
                    .font(.caption2).foregroundStyle(Theme.textTertiary)
                HStack(spacing: 8) {
                    ForEach(cps.horizons ?? []) { h in
                        VStack(spacing: 2) {
                            Text(h.label ?? "").font(.caption2).foregroundStyle(Theme.textSecondary)
                            Text("¥\(Fmt.money(h.p50))").font(.footnote.weight(.bold)).foregroundStyle(Theme.textPrimary).minimumScaleFactor(0.6).lineLimit(1)
                        }.frame(maxWidth: .infinity).padding(.vertical, 6).background(Theme.bgLayout).clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        }
    }
}

private struct IndicatorCardView: View {
    let ind: DashIndicator
    private func conf(_ c: String?) -> (String, Color) {
        switch c { case "high": return ("高", Theme.success); case "medium": return ("中", Theme.warning); default: return ("低", Theme.textTertiary) }
    }
    private func money(_ v: Double, _ unit: String?) -> String {
        let u = unit ?? ""
        return abs(v) >= 10000 ? String(format: "%.1f万%@", v / 10000, u) : "\(Int(v))\(u)"
    }
    var body: some View {
        CardView(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(ind.name ?? "—").font(.subheadline.weight(.bold)).foregroundStyle(Theme.textPrimary)
                    Text(ind.unit ?? "").font(.caption2).foregroundStyle(Theme.textTertiary)
                    Spacer()
                    if let b = ind.basis {
                        Text("本季实际\(Int(b.current_actual))/目标\(Int(b.current_target))").font(.caption2).foregroundStyle(Theme.textTertiary)
                    }
                }
                let cols = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
                LazyVGrid(columns: cols, spacing: 8) {
                    ForEach(ind.horizons ?? []) { h in
                        let cf = conf(h.confidence)
                        VStack(spacing: 2) {
                            Text(h.label ?? "").font(.caption2).foregroundStyle(Theme.textSecondary)
                            Text(money(h.p50, ind.unit)).font(.footnote.weight(.bold)).foregroundStyle(Theme.textPrimary).minimumScaleFactor(0.5).lineLimit(1)
                            Text(cf.0).font(.system(size: 10).weight(.semibold)).foregroundStyle(cf.1)
                        }.frame(maxWidth: .infinity).padding(.vertical, 6).background(Theme.bgLayout).clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        }
    }
}
