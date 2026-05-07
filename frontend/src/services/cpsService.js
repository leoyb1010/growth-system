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
  // 字典
  getChannels: () => api.get('/cps/channels'),
  createChannel: (data) => api.post('/cps/channels', data),
  updateChannel: (id, data) => api.put(`/cps/channels/${id}`, data),
  getProducts: () => api.get('/cps/products'),
  createProduct: (data) => api.post('/cps/products', data),
  updateProduct: (id, data) => api.put(`/cps/products/${id}`, data),
  // 预警规则
  getAlertRules: () => api.get('/cps/alert-rules'),
  upsertAlertRule: (data) => api.post('/cps/alert-rules', data),
  deleteAlertRule: (id) => api.delete(`/cps/alert-rules/${id}`),
};
