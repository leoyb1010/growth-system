import { api } from '../hooks/useAuth';

const listeners = new Set();

export const asoBus = {
  emit(event, payload) {
    listeners.forEach(fn => { try { fn(event, payload); } catch (e) {} });
  },
  on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const asoApi = {
  // 看板
  getDashboard: (params) => api.get('/aso/dashboard', { params }),
  // 日报明细
  getDailyMetrics: (params) => api.get('/aso/daily-metrics', { params }),
  upsertDailyMetric: async (data) => {
    const res = await api.post('/aso/daily-metrics', data);
    if (res.code === 0) asoBus.emit('daily-metrics:changed', res.data);
    return res;
  },
  updateDailyMetric: async (id, data) => {
    const res = await api.put(`/aso/daily-metrics/${id}`, data);
    if (res.code === 0) asoBus.emit('daily-metrics:changed', res.data);
    return res;
  },
  deleteDailyMetric: async (id) => {
    const res = await api.delete(`/aso/daily-metrics/${id}`);
    if (res.code === 0) asoBus.emit('daily-metrics:changed', { id });
    return res;
  },
  getSnapshots: (id) => api.get(`/aso/daily-metrics/${id}/snapshots`),
  // 导入导出
  importDailyMetrics: async (formData) => {
    const res = await api.post('/aso/import/daily-metrics', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (res.code === 0) {
      asoBus.emit('daily-metrics:changed', res.data);
      asoBus.emit('products:changed', res.data);
    }
    return res;
  },
  exportDailyMetrics: (params) => api.get('/aso/export/daily-metrics', { params }),
  importKeywords: async (formData) => {
    const res = await api.post('/aso/admin/keywords/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (res.code === 0) asoBus.emit('products:changed', res.data);
    return res;
  },
  importBaselineMetrics: async (formData) => {
    const res = await api.post('/aso/baseline-metrics/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (res.code === 0) asoBus.emit('products:changed', res.data);
    return res;
  },
  // 产品字典
  getProducts: () => api.get('/aso/products'),
  createProduct: async (data) => {
    const res = await api.post('/aso/products', data);
    if (res.code === 0) asoBus.emit('products:changed', res.data);
    return res;
  },
  updateProduct: async (id, data) => {
    const res = await api.put(`/aso/products/${id}`, data);
    if (res.code === 0) asoBus.emit('products:changed', res.data);
    return res;
  },
  // 关键词字典
  getKeywords: (params) => api.get('/aso/keywords', { params }),
  createKeyword: (data) => api.post('/aso/keywords', data),
  updateKeyword: (id, data) => api.put(`/aso/keywords/${id}`, data),
  // 计划
  getCampaigns: (params) => api.get('/aso/campaigns', { params }),
  createCampaign: (data) => api.post('/aso/campaigns', data),
  updateCampaign: (id, data) => api.put(`/aso/campaigns/${id}`, data),
  deleteCampaign: (id) => api.delete(`/aso/campaigns/${id}`),
  // 模板下载
  downloadDailyTemplate: () => api.get('/aso/template/daily-import', { responseType: 'blob' }),
  // 元数据版本
  getMetadataVersions: (params) => api.get('/aso/metadata-versions', { params }),
  createMetadataVersion: (data) => api.post('/aso/metadata-versions', data),
  updateMetadataVersion: (id, data) => api.put(`/aso/metadata-versions/${id}`, data),
  // AI 洞察（推理模型单次约 15-25s，需放宽超时，避免默认 10s 误判失败）
  dailyInsight: (data) => api.post('/aso/ai/daily-insight', data, { timeout: 60000 }),
  // 产品基础指标
  getBaselineMetrics: (params) => api.get('/aso/baseline-metrics', { params }),
  upsertBaselineMetric: (data) => api.post('/aso/baseline-metrics', data),
};
