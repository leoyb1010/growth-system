import { api } from '../hooks/useAuth';

/**
 * 周报附件/插图 API
 * 图片以 base64 经 JSON 上传，后端存 report_assets（随 sqlite 备份）。
 */
export const reportAssetApi = {
  list: (reportId) => api.get(`/weekly-reports/${reportId}/assets`),
  upload: (reportId, payload) => api.post(`/weekly-reports/${reportId}/assets`, payload),
  update: (reportId, assetId, patch) => api.put(`/weekly-reports/${reportId}/assets/${assetId}`, patch),
  remove: (reportId, assetId) => api.delete(`/weekly-reports/${reportId}/assets/${assetId}`),
};

/**
 * 把 File 读成 { data_base64, mime_type, filename, width, height }。
 * 自动按最大边压缩到 maxSize（默认 1600px），降低体积、避免超出后端 5MB 限制。
 */
export function fileToUploadPayload(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        const w = Math.round(width * scale);
        const h = Math.round(height * scale);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // PNG 保真（截图/图表场景），但大图转 JPEG 控制体积
          const useJpeg = file.size > 800 * 1024 && file.type !== 'image/png';
          const mime = useJpeg ? 'image/jpeg' : 'image/png';
          const dataUrl = canvas.toDataURL(mime, quality);
          const base64 = dataUrl.split(',')[1];
          resolve({
            data_base64: base64,
            mime_type: mime,
            filename: file.name,
            width: w,
            height: h,
          });
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
