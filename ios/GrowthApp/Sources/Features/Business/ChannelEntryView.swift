import SwiftUI

@MainActor
final class ChannelEntryVM: ObservableObject {
    @Published var products: [CpsDictItem] = []
    @Published var productId: Int? = nil
    @Published var date = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
    @Published var unitPrice: Double = 0

    @Published var newSign = 0
    @Published var newTerminate = 0
    @Published var newRefund = 0
    @Published var renewal = 0
    @Published var renewalRefund = 0
    @Published var afterSaleRefund = 0
    @Published var complaint = 0

    @Published var saving = false
    @Published var toast: String?
    @Published var toastOK = true

    private let df: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); return f
    }()

    func loadProducts() async {
        products = (try? await API.cpsProducts()) ?? []
    }

    func pickProduct(_ id: Int) {
        productId = id
        if let p = products.first(where: { $0.id == id }), p.unit_price > 0 { unitPrice = p.unit_price }
    }

    func submit() async {
        guard let pid = productId else { toastOK = false; toast = "请先选择产品"; return }
        saving = true; toast = nil
        let body: [String: AnyCodable] = [
            "stat_date": AnyCodable(df.string(from: date)),
            "product_id": AnyCodable(pid),
            "unit_price": AnyCodable(unitPrice),
            "new_sign_count": AnyCodable(newSign),
            "new_terminate_count": AnyCodable(newTerminate),
            "new_refund_count": AnyCodable(newRefund),
            "renewal_count": AnyCodable(renewal),
            "renewal_refund_count": AnyCodable(renewalRefund),
            "after_sale_refund_count": AnyCodable(afterSaleRefund),
            "complaint_count": AnyCodable(complaint),
            "source": AnyCodable("channel_entry"),
        ]
        do {
            let r = try await API.cpsChannelEntry(body)
            toastOK = true
            toast = "已提交！有效签约 \(r.effective_count)，有效收入 ¥\(Fmt.money(r.effective_amount))"
        } catch let e as APIError {
            toastOK = false; toast = e.message
        } catch {
            toastOK = false; toast = "提交失败"
        }
        saving = false
    }
}

struct ChannelEntryView: View {
    @StateObject private var vm = ChannelEntryVM()

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                CardView {
                    VStack(alignment: .leading, spacing: 14) {
                        SectionTitle(text: "渠道日报录入")
                        DatePicker("数据日期", selection: $vm.date, displayedComponents: .date)
                            .font(.subheadline)

                        VStack(alignment: .leading, spacing: 6) {
                            Text("产品").font(.caption).foregroundStyle(Theme.textSecondary)
                            Menu {
                                ForEach(vm.products) { p in
                                    Button("\(p.name)（¥\(Fmt.money(p.unit_price))）") { vm.pickProduct(p.id) }
                                }
                            } label: {
                                HStack {
                                    Text(vm.products.first(where: { $0.id == vm.productId })?.name ?? "选择产品")
                                        .foregroundStyle(vm.productId == nil ? Theme.textTertiary : Theme.textPrimary)
                                    Spacer()
                                    Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(Theme.textTertiary)
                                }
                                .padding(10).background(Theme.bgLayout).clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }

                        stepperRow("产品金额(单价)", value: $vm.unitPrice)
                    }
                }

                CardView {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(text: "签约 / 退款")
                        intRow("新签数", $vm.newSign)
                        intRow("解约数", $vm.newTerminate)
                        intRow("新签退款数", $vm.newRefund)
                        intRow("续费数", $vm.renewal)
                        intRow("续费退款数", $vm.renewalRefund)
                        intRow("售后退款数", $vm.afterSaleRefund)
                        intRow("客诉数", $vm.complaint)
                    }
                }

                if let toast = vm.toast {
                    Text(toast).font(.caption).foregroundStyle(vm.toastOK ? Theme.success : Theme.danger)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button { Task { await vm.submit() } } label: {
                    HStack { if vm.saving { ProgressView().tint(.white) }; Text(vm.saving ? "提交中…" : "提交数据").fontWeight(.semibold) }
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent).tint(Theme.primary).controlSize(.large)
                .disabled(vm.saving)

                Color.clear.frame(height: 30)
            }.padding(16)
        }
        .background(Theme.bgLayout)
        .navigationTitle("日报录入")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadProducts() }
    }

    private func intRow(_ label: String, _ value: Binding<Int>) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundStyle(Theme.textSecondary)
            Spacer()
            Stepper(value: value, in: 0...100000) {
                Text("\(value.wrappedValue)").font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(Theme.textPrimary)
            }.labelsHidden()
            Text("\(value.wrappedValue)").font(.subheadline.weight(.bold)).monospacedDigit()
                .frame(width: 64, alignment: .trailing).foregroundStyle(Theme.textPrimary)
        }
    }

    private func stepperRow(_ label: String, value: Binding<Double>) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundStyle(Theme.textSecondary)
            Spacer()
            TextField("0", value: value, format: .number)
                .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                .frame(width: 100).padding(8).background(Theme.bgLayout).clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}
