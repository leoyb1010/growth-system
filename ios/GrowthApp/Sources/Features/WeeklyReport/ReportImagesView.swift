import SwiftUI
import PhotosUI
import UIKit

@MainActor
final class ReportImagesVM: ObservableObject {
    let reportId: Int
    @Published var assets: [ReportAsset] = []
    @Published var loading = false
    @Published var uploading = false
    @Published var error: String?
    init(reportId: Int) { self.reportId = reportId }

    func load() async {
        loading = assets.isEmpty; error = nil
        do { assets = try await API.reportAssets(reportId) }
        catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        loading = false
    }

    func upload(image: UIImage, projectId: Int?, section: String) async {
        uploading = true; error = nil
        // 压缩到最大边 1600，JPEG 质量 0.85，控制体积
        let resized = image.resized(maxDimension: 1600)
        guard let data = resized.jpegData(compressionQuality: 0.85) else { uploading = false; return }
        let base64 = data.base64EncodedString()
        do {
            _ = try await API.uploadAsset(reportId: reportId, projectId: projectId, section: section, base64: base64, mime: "image/jpeg", caption: nil)
            await load()
        } catch let e as APIError { error = e.message }
        catch let err { error = err.localizedDescription }
        uploading = false
    }

    func delete(_ asset: ReportAsset) async {
        do { try await API.deleteAsset(reportId: reportId, assetId: asset.id); assets.removeAll { $0.id == asset.id } }
        catch { self.error = "删除失败" }
    }
}

struct ReportImagesView: View {
    @StateObject private var vm: ReportImagesVM
    let projects: [ReportProject]
    @Environment(\.dismiss) var dismiss
    @State private var selectedScope: String = "cover" // "cover" 或 project id 字符串
    @State private var pickerItem: PhotosPickerItem?

    init(reportId: Int, projects: [ReportProject]) {
        _vm = StateObject(wrappedValue: ReportImagesVM(reportId: reportId))
        self.projects = projects
    }

    private var scopeOptions: [(String, String)] {
        var opts = [("cover", "📌 整报封面 / 通用图")]
        for p in projects { opts.append((String(p.id), "\(p.dept_name ?? "")\(p.dept_name != nil ? " · " : "")\(p.name ?? "项目")")) }
        return opts
    }

    private var currentAssets: [ReportAsset] {
        if selectedScope == "cover" { return vm.assets.filter { $0.section == "cover" || $0.project_id == nil } }
        return vm.assets.filter { String($0.project_id ?? -1) == selectedScope }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Picker("配图位置", selection: $selectedScope) {
                    ForEach(scopeOptions, id: \.0) { Text($0.1).tag($0.0) }
                }.pickerStyle(.menu).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal)

                PhotosPicker(selection: $pickerItem, matching: .images) {
                    HStack { Image(systemName: "plus"); Text("添加图片") }
                        .frame(maxWidth: .infinity).padding()
                        .background(Theme.primary.opacity(0.1)).foregroundStyle(Theme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall))
                }.padding(.horizontal)

                if vm.uploading { ProgressView("上传中…") }
                if let err = vm.error { Text(err).font(.caption).foregroundStyle(Theme.danger) }

                ScrollView {
                    if currentAssets.isEmpty {
                        Text("该位置暂无配图").foregroundStyle(Theme.textSecondary).padding(.top, 40)
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            ForEach(currentAssets) { asset in
                                assetCell(asset)
                            }
                        }.padding(.horizontal)
                    }
                }
            }
            .padding(.top)
            .navigationTitle("周报配图")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
            .task { if vm.assets.isEmpty { await vm.load() } }
            .onChange(of: pickerItem) { newItem in
                guard let newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self), let img = UIImage(data: data) {
                        let pid = selectedScope == "cover" ? nil : Int(selectedScope)
                        await vm.upload(image: img, projectId: pid, section: selectedScope == "cover" ? "cover" : "project")
                    }
                    pickerItem = nil
                }
            }
        }
    }

    private func assetCell(_ asset: ReportAsset) -> some View {
        VStack(spacing: 6) {
            AuthAsyncImage(path: asset.url)
                .frame(height: 110).frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            HStack {
                if let c = asset.caption, !c.isEmpty { Text(c).font(.caption2).lineLimit(1) }
                Spacer()
                Button(role: .destructive) { Task { await vm.delete(asset) } } label: {
                    Image(systemName: "trash").font(.caption)
                }
            }
        }
        .padding(8)
        .background(Theme.bgCard)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusSmall))
        .overlay(RoundedRectangle(cornerRadius: Theme.radiusSmall).strokeBorder(Theme.border))
    }
}

/// 带鉴权的异步图片（附件 raw 需要 Bearer）
struct AuthAsyncImage: View {
    let path: String
    @State private var image: UIImage?
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFill() }
            else { Rectangle().fill(Theme.bgLayout).overlay(ProgressView()) }
        }
        .clipped()
        .task {
            // path 形如 /api/weekly-reports/:id/assets/:assetId/raw → 去掉 /api 前缀给 downloadData
            let apiPath = path.hasPrefix("/api") ? String(path.dropFirst(4)) : path
            if let data = try? await APIClient.shared.downloadData(apiPath), let img = UIImage(data: data) {
                image = img
            }
        }
    }
}

extension UIImage {
    func resized(maxDimension: CGFloat) -> UIImage {
        let maxSide = max(size.width, size.height)
        guard maxSide > maxDimension else { return self }
        let scale = maxDimension / maxSide
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in draw(in: CGRect(origin: .zero, size: newSize)) }
    }
}
