import SwiftUI
import UIKit

@MainActor
final class WeeklyReportVM: ObservableObject {
    @Published var content: WeeklyReportContent?
    @Published var loading = false
    @Published var generating = false
    @Published var error: String?
    @Published var shareImage: UIImage?
    @Published var exporting = false

    func loadLatest() async {
        loading = (content == nil); error = nil
        do { content = try await API.latestReport() }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }

    func generate() async {
        generating = true; error = nil
        do { content = try await API.generateReport() }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        generating = false
    }

    func exportPng() async {
        guard let id = content?.id else { return }
        exporting = true; error = nil
        do {
            let data = try await APIClient.shared.downloadData("/weekly-reports/\(id)/png")
            if let img = UIImage(data: data) { shareImage = img }
            else { error = "PNG 生成异常" }
        } catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        exporting = false
    }
}

struct WeeklyReportView: View {
    @StateObject private var vm = WeeklyReportVM()
    @State private var showShare = false
    @State private var showImages = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LoadStateView(isLoading: vm.loading, error: vm.error, retry: { Task { await vm.loadLatest() } }) {
                    if let c = vm.content {
                        VStack(spacing: 16) {
                            headerCard(c)
                            if let conclusion = c.week_conclusion, !conclusion.isEmpty {
                                CardView { VStack(alignment: .leading, spacing: 6) {
                                    SectionTitle(text: "本周核心结论")
                                    Text(conclusion).font(.subheadline)
                                }}
                            }
                            if let projects = c.project_progress, !projects.isEmpty {
                                CardView { VStack(alignment: .leading, spacing: 10) {
                                    SectionTitle(text: "重点工作进展（\(projects.count)）")
                                    ForEach(projects) { p in projectRow(p) }
                                }}
                            }
                            if let achs = c.new_achievements, !achs.isEmpty {
                                CardView { VStack(alignment: .leading, spacing: 8) {
                                    SectionTitle(text: "新增成果（\(achs.count)）")
                                    ForEach(achs) { a in
                                        VStack(alignment: .leading) {
                                            Text(a.project_name ?? a.achievement_type ?? "成果").font(.subheadline).bold()
                                            if let q = a.quantified_result { Text(q).font(.caption).foregroundStyle(Theme.textSecondary) }
                                        }.frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                }}
                            }
                        }.padding(16)
                    } else {
                        emptyState
                    }
                }
            }
            .background(Theme.bgLayout)
            .navigationTitle("周报")
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    if vm.content?.id != nil {
                        Button { showImages = true } label: { Image(systemName: "photo.on.rectangle") }
                        Button { Task { await vm.exportPng(); if vm.shareImage != nil { showShare = true } } } label: {
                            if vm.exporting { ProgressView() } else { Image(systemName: "square.and.arrow.up") }
                        }.disabled(vm.exporting)
                    }
                    Button { Task { await vm.generate() } } label: {
                        if vm.generating { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }.disabled(vm.generating)
                }
            }
            .sheet(isPresented: $showShare) {
                if let img = vm.shareImage { ShareSheet(items: [img]) }
            }
            .sheet(isPresented: $showImages) {
                if let id = vm.content?.id {
                    ReportImagesView(reportId: id, projects: vm.content?.project_progress ?? [])
                }
            }
            .task { if vm.content == nil { await vm.loadLatest() } }
        }
    }

    private func headerCard(_ c: WeeklyReportContent) -> some View {
        CardView {
            VStack(alignment: .leading, spacing: 6) {
                Text("增长组业务周报").font(.title3).bold()
                Text("📅 \(c.week_start ?? "") 至 \(c.week_end ?? "")").font(.caption).foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private func projectRow(_ p: ReportProject) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                if let d = p.dept_name, !d.isEmpty { Text(d).font(.caption2).foregroundStyle(Theme.textSecondary) }
                Text(p.name ?? "—").font(.subheadline).bold()
                Spacer()
                StatusTag(p.status ?? "—")
            }
            if let w = p.weekly_progress, !w.isEmpty { Text(w).font(.caption).foregroundStyle(Theme.textSecondary) }
            Divider()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 4)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text").font(.largeTitle).foregroundStyle(Theme.textSecondary)
            Text("还没有周报").foregroundStyle(Theme.textSecondary)
            Button("生成本周周报") { Task { await vm.generate() } }.buttonStyle(.borderedProminent)
        }.frame(maxWidth: .infinity, minHeight: 300)
    }
}
