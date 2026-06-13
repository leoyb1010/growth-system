import SwiftUI
import Charts

@MainActor
final class BusinessVM: ObservableObject {
    @Published var aso: AsoDashboard?
    @Published var cps: CpsDashboard?
    @Published var loadingAso = false
    @Published var loadingCps = false
    @Published var errAso: String?
    @Published var errCps: String?

    func loadAso() async {
        loadingAso = (aso == nil); errAso = nil
        do { aso = try await API.asoDashboard() } catch let e as APIError { errAso = e.message } catch let e { errAso = e.localizedDescription }
        loadingAso = false
    }
    func loadCps() async {
        loadingCps = (cps == nil); errCps = nil
        do { cps = try await API.cpsDashboard() } catch let e as APIError { errCps = e.message } catch let e { errCps = e.localizedDescription }
        loadingCps = false
    }
}

struct BusinessView: View {
    @EnvironmentObject var session: SessionManager
    @StateObject private var vm = BusinessVM()
    @State private var seg = 0

    private var canAso: Bool { let u = session.user; return u?.isAdmin == true || u?.aso_role != nil }
    private var canCps: Bool { let u = session.user; return u?.isAdmin == true || u?.cps_role != nil || u?.role == "cps_channel_user" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Segmented(items: ["ASO 优化", "CPS 投流"], selection: $seg)
                    if seg == 0 {
                        LoadStateView(isLoading: vm.loadingAso, error: vm.errAso, retry: { Task { await vm.loadAso() } }) { asoContent }
                    } else {
                        LoadStateView(isLoading: vm.loadingCps, error: vm.errCps, retry: { Task { await vm.loadCps() } }) { cpsContent }
                    }
                    Color.clear.frame(height: 80)
                }.padding(16)
            }
            .background(Theme.bgLayout)
            .navigationTitle("重点业务")
            .refreshable { if seg == 0 { await vm.loadAso() } else { await vm.loadCps() } }
            .task { await vm.loadAso() }
            .onChange(of: seg) { s in Task { if s == 1 && vm.cps == nil { await vm.loadCps() } } }
        }
    }

    // MARK: ASO
    private var asoContent: some View {
        VStack(spacing: 14) {
            if let s = vm.aso?.summary {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    StatTile(label: "优化词", value: "\(s.optimized_keywords)", color: Theme.primary, icon: "magnifyingglass")
                    StatTile(label: "T3 到榜", value: "\(s.t3_keywords)", sub: "\(Int(s.t3_rate))%", color: Theme.success, icon: "trophy")
                    StatTile(label: "T1-2 到榜", value: "\(s.t1_2_keywords)", sub: "\(Int(s.t1_2_rate))%", color: Theme.warning, icon: "star")
                    StatTile(label: "总消耗", value: "¥\(Fmt.money(s.total_cost))", color: Theme.purple, icon: "yensign.circle")
                }
            }
            if let trend = vm.aso?.trend, trend.count > 1 {
                CardView {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(text: "T3 到榜趋势")
                        Chart(trend) { p in
                            LineMark(x: .value("日期", p.date ?? ""), y: .value("T3", p.t3_keywords))
                                .foregroundStyle(Theme.success).interpolationMethod(.catmullRom)
                            AreaMark(x: .value("日期", p.date ?? ""), y: .value("T3", p.t3_keywords))
                                .foregroundStyle(LinearGradient(colors: [Theme.success.opacity(0.2), .clear], startPoint: .top, endPoint: .bottom))
                                .interpolationMethod(.catmullRom)
                        }.frame(height: 160).chartXAxis(.hidden)
                    }
                }
            }
            if let nt = vm.aso?.keyword_changes?.new_t1, !nt.isEmpty {
                CardView {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionTitle(text: "新到 T1 关键词")
                        FlowTags(tags: Array(nt.prefix(12)), color: Theme.success)
                    }
                }
            }
            if vm.aso?.summary == nil { EmptyHint(icon: "magnifyingglass", text: "暂无 ASO 数据") }
        }
    }

    // MARK: CPS
    private var cpsContent: some View {
        VStack(spacing: 14) {
            if let t = vm.cps?.total {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    StatTile(label: "实收金额", value: "¥\(Fmt.money(t.actual_amount))", color: Theme.success, icon: "creditcard")
                    StatTile(label: "签约单数", value: "\(t.actual_count)", color: Theme.primary, icon: "doc.text")
                    StatTile(label: "退款率", value: "\(String(format: "%.1f", t.refund_rate))%", color: Theme.warning, icon: "arrow.uturn.backward")
                    StatTile(label: "客诉率", value: "\(String(format: "%.1f", t.complaint_rate))%", color: Theme.danger, icon: "exclamationmark.bubble")
                }
            }
            if let dod = vm.cps?.day_over_day, dod.current_date != nil {
                CardView {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("较前一日").font(.caption).foregroundStyle(Theme.textSecondary)
                            Text(Fmt.signedMoney(dod.actual_amount_delta)).font(.title3.weight(.bold))
                                .foregroundStyle(dod.actual_amount_delta >= 0 ? Theme.success : Theme.danger)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            Text("签约 \(Fmt.signed(dod.actual_count_delta)) 单").font(.caption).foregroundStyle(Theme.textSecondary)
                            Text("\(dod.current_date ?? "") vs \(dod.compare_date ?? "")").font(.caption2).foregroundStyle(Theme.textTertiary)
                        }
                    }
                }
            }
            HStack(spacing: 12) {
                StatTile(label: "预警", value: "\(vm.cps?.alert_count ?? 0)", color: (vm.cps?.alert_count ?? 0) > 0 ? Theme.danger : Theme.success, icon: "bell")
                StatTile(label: "渠道数", value: "\(vm.cps?.channel_count ?? 0)", color: Theme.primary, icon: "point.3.connected.trianglepath.dotted")
            }
            if let trend = vm.cps?.trend, trend.count > 1 {
                CardView {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(text: "实收金额趋势")
                        Chart(trend) { p in
                            BarMark(x: .value("日期", p.date ?? ""), y: .value("实收", p.amount))
                                .foregroundStyle(Theme.heroGradient).cornerRadius(3)
                        }.frame(height: 150).chartXAxis(.hidden)
                    }
                }
            }
            if let top = vm.cps?.top_channels, !top.isEmpty {
                CardView {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(text: "渠道排行")
                        ForEach(top.prefix(5)) { ch in
                            HStack {
                                Text(ch.channel_name ?? "渠道\(ch.channel_id ?? 0)").font(.subheadline)
                                Spacer()
                                Text("¥\(Fmt.money(ch.actual_amount))").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.success)
                            }
                        }
                    }
                }
            }
            if vm.cps?.total == nil { EmptyHint(icon: "creditcard", text: "暂无 CPS 数据") }
        }
    }
}

// 标签流式布局
struct FlowTags: View {
    let tags: [String]
    var color: Color = Theme.primary
    var body: some View {
        FlexibleWrap(data: tags) { tag in
            Text(tag).font(.caption).padding(.horizontal, 10).padding(.vertical, 5)
                .background(color.opacity(0.12)).foregroundStyle(color).clipShape(Capsule())
        }
    }
}

struct FlexibleWrap<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let data: Data
    @ViewBuilder let content: (Data.Element) -> Content
    var body: some View {
        var width = CGFloat.zero
        var height = CGFloat.zero
        return GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(Array(data), id: \.self) { item in
                    content(item)
                        .padding(.trailing, 6).padding(.bottom, 6)
                        .alignmentGuide(.leading) { d in
                            if abs(width - d.width) > geo.size.width { width = 0; height -= d.height }
                            let result = width
                            if item == data.last { width = 0 } else { width -= d.width }
                            return result
                        }
                        .alignmentGuide(.top) { _ in
                            let result = height
                            if item == data.last { height = 0 }
                            return result
                        }
                }
            }
        }.frame(height: 80)
    }
}
