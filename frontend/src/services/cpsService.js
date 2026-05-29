import { api } from '../hooks/useAuth';

const listeners = new Set();

export const cpsBus = {
  emit(event, payload) {
    listeners.forEach(fn => { try { fn(event, payload); } catch (e) {} });
  },
  on(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const cpsApi = {
  // 看板
  getDashboard: (params) => api.get('/cps/dashboard', { params }),
  // 明细
  getMetrics: (params) => api.get('/cps/metrics', { params }),
  upsertMetric: async (data) => {
    const res = await api.post('/cps/metrics', data);
    if (res.code === 0) cpsBus.emit('metrics:changed', res.data);
    return res;
  },
  updateMetric: async (id, data) => {
    const res = await api.put(`/cps/metrics/${id}`, data);
    if (res.code === 0) cpsBus.emit('metrics:changed', res.data);
    return res;
  },
  deleteMetric: async (id) => {
    const res = await api.delete(`/cps/metrics/${id}`);
    if (res.code === 0) cpsBus.emit('metrics:changed', { id });
    return res;
  },
  getSnapshots: (id) => api.get(`/cps/metrics/${id}/snapshots`),
  // 导入导出
  importMetrics: async (formData) => {
    const res = await api.post('/cps/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (res.code === 0) cpsBus.emit('metrics:changed', res.data);
    return res;
  },
  exportMetrics: (params) => api.get('/cps/export', { params, responseType: 'blob' }),
  // 预警
  getAlerts: (params) => api.get('/cps/alerts', { params }),
  ackAlert: async (id) => {
    const res = await api.post(`/cps/alerts/${id}/ack`);
    if (res.code === 0) cpsBus.emit('alerts:changed', res.data);
    return res;
  },
  checkAlertsNow: (date) => api.post('/cps/alerts/check', {}, { params: date ? { date } : undefined }),
  // 字典
  getChannels: () => api.get('/cps/channels'),
  createChannel: (data) => api.post('/cps/channels', data),
  updateChannel: (id, data) => api.put(`/cps/channels/${id}`, data),
  getProducts: () => api.get('/cps/products'),
  createProduct: (data) => api.post('/cps/products', data),
  updateProduct: (id, data) => api.put(`/cps/products/${id}`, data),
  // 渠道录入（cps_channel_user 专属，channel_id 由后端强制从 data scope 取）
  channelEntry: async (data) => {
    const res = await api.post('/cps/channel-entry', data);
    if (res.code === 0) cpsBus.emit('metrics:changed', res.data);
    return res;
  },
  // 渠道 Excel 导入（cps_channel_user 专属，channel_id 由后端强制取 dataScope）
  channelImportMetrics: async (formData) => {
    const res = await api.post('/cps/channel-import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (res.code === 0) cpsBus.emit('metrics:changed', res.data);
    return res;
  },
  // AI 洞察
  dailyInsight: (data) => api.post('/cps/ai/daily-insight', data),
  periodAnalysis: (data) => api.post('/cps/ai/period-analysis', data),
  // 预警规则
  getAlertRules: () => api.get('/cps/alert-rules'),
  upsertAlertRule: (data) => api.post('/cps/alert-rules', data),
  deleteAlertRule: (id) => api.delete(`/cps/alert-rules/${id}`),
};
