/**
 * 风险台账 API 服务
 */
import { api } from '../hooks/useAuth';

export async function fetchRisks(params = {}) {
  const res = await api.get('/risk-register', { params });
  return res;
}

export async function createRisk(data) {
  const res = await api.post('/risk-register', data);
  return res;
}

export async function updateRisk(id, data) {
  const res = await api.patch(`/risk-register/${id}`, data);
  return res;
}
