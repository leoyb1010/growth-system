import SwiftUI

@MainActor
final class MetricsVM: ObservableObject {
    @Published var kpis: [KpiItem] = []
    @Published var perfs: [PerformanceItem] = []
    @Published var loading = false
    @Published var error: String?

    func load() async {
        loading = (kpis.isEmpty && perfs.isEmpty); error = nil
        async let k = try? API.kpis()
        async let p = try? API.performances()
        kpis = await k ?? []
        perfs = await p ?? []
        loading = false
    }
}

struct MetricsView: View {
    @StateObject private var vm = MetricsVM()
    @State private var seg = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Segmented(items: ["KPI 指标", "业务线业绩"], selection: $seg)
                    LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.load() } }) {
                        if seg == 0 { kpiList } else { perfList }
                    }
                    Color.clear.frame(height: 80)
                }.padding(16)
            }
            .background(Theme.bgLayout)
            .navigationTitle("指标与目标")
            .refreshable { await vm.load() }
            .task { if vm.kpis.isEmpty && vm.perfs.isEmpty { await vm.load() } }
        }
    }

    private var kpiList: some View {
        VStack(spacing: 12) {
            if vm.kpis.isEmpty { EmptyHint(icon: "target", text: "暂无 KPI 数据") }
            ForEach(vm.kpis) { k in
                CardView {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(k.indicator_name).font(.subheadline.weight(.bold))
                                Text(k.deptName).font(.caption2).foregroundStyle(Theme.textTertiary)
                            }
                            Spacer()
                            RingProgress(rate: k.completion_rate, size: 50)
                        }
                        HStack {
                            Text("\(Fmt.money(k.actual)) / \(Fmt.money(k.target)) \(k.unit ?? "")").font(.caption).foregroundStyle(Theme.textSecondary)
                            Spacer()
                            if let label = k.progress_label { StatusTag(label, color: statusKeyColor(k.progress_status)) }
                        }
                        progressBar(rate: k.completion_rate, time: k.time_progress)
                    }
                }
            }
        }
    }

    private var perfList: some View {
        VStack(spacing: 12) {
            if vm.perfs.isEmpty { EmptyHint(icon: "chart.bar", text: "暂无业绩数据") }
            ForEach(vm.perfs) { p in
                CardView {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(p.business_type) · \(p.indicator)").font(.subheadline.weight(.bold))
                                Text(p.deptName).font(.caption2).foregroundStyle(Theme.textTertiary)
                            }
                            Spacer()
                            if let w = p.warning_status { StatusTag(w) }
                        }
                        HStack {
                            Text("\(Fmt.money(p.total_actual)) / \(Fmt.money(p.total_target)) \(p.unit ?? "")").font(.caption).foregroundStyle(Theme.textSecondary)
                            Spacer()
                            Text("\(Int(p.completion_rate))%").font(.subheadline.weight(.bold)).foregroundStyle(Theme.rateColor(p.completion_rate))
                            if p.gap != 0 { Text("差 \(Fmt.money(abs(p.gap)))").font(.caption2).foregroundStyle(Theme.danger) }
                        }
                        progressBar(rate: p.completion_rate, time: nil)
                    }
                }
            }
        }
    }

    private func progressBar(rate: Double, time: Double?) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.border).frame(height: 8)
                Capsule().fill(Theme.gradient(for: rate)).frame(width: geo.size.width * min(rate,100)/100, height: 8)
                if let time { // 时间进度刻度线
                    Rectangle().fill(Theme.textTertiary).frame(width: 2, height: 12)
                        .offset(x: geo.size.width * min(time,100)/100 - 1)
                }
            }
        }.frame(height: 12)
    }

    private func statusKeyColor(_ key: String?) -> Color {
        switch key { case "success", "normal": return Theme.success; case "warning": return Theme.warning; case "error": return Theme.danger; default: return Theme.textSecondary }
    }
}
