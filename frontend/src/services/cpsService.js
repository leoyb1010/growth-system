import { api } from '../hooks/useAuth';

export const cpsApi = {
  // 看板
  getDashboard: (params) => api.get('/cps/dashboard', { params }),
  // 明细
  getMetrics: (params) => api.get('/cps/metrics', { params }),
  upsertMetric: (data) => api.post('/cps/metrics', data),
  updateMetric: (id, data) => api.put(`/cps/metrics/${id}`, data),
  deleteMetric: (id) => api.delete(`/cps/metrics/${id}`),
  getSnapshots: (id) => api.get(`/cps/metrics/${id}/snapshots`),
  // 导入导出
  importMetrics: (formData) => api.post('/cps/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  exportMetrics: (params) => api.get('/cps/export', { params, responseType: 'blob' }),
  // 预警
  getAlerts: (params) => api.get('/cps/alerts', { params }),
  ackAlert: (id) => api.post(`/cps/alerts/${id}/ack`),
  // 字典
  getChannels: () => api.get('/cps/channels'),
  createChannel: (data) => api.post('/cps/channels', data),
  updateChannel: (id, data) => api.put(`/cps/channels/${id}`, data),
  regenerateToken: (id) => api.post(`/cps/channels/${id}/regenerate-token`),
  getProducts: () => api.get('/cps/products'),
  createProduct: (data) => api.post('/cps/products', data),
  updateProduct: (id, data) => api.put(`/cps/products/${id}`, data),
  // 预警规则
  getAlertRules: () => api.get('/cps/alert-rules'),
  upsertAlertRule: (data) => api.post('/cps/alert-rules', data),
  deleteAlertRule: (id) => api.delete(`/cps/alert-rules/${id}`),
};
