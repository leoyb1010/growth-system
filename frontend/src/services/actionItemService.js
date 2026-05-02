/**
 * 行动项 API 服务
 */
import { api } from '../hooks/useAuth';

export async function fetchActionItems(params = {}) {
  const res = await api.get('/action-items', { params });
  return res;
}

export async function createActionItem(data) {
  const res = await api.post('/action-items', data);
  return res;
}

export async function updateActionItem(id, data) {
  const res = await api.patch(`/action-items/${id}`, data);
  return res;
}

export async function deleteActionItem(id) {
  const res = await api.delete(`/action-items/${id}`);
  return res;
}
