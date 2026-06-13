import { api } from '../hooks/useAuth';

/**
 * 项目相关 API（轻量补充；ProjectPage 现有调用仍直接用 api，本服务用于新增的关联视图）
 */
export const projectApi = {
  // 项目 360 关联视图：项目 + 动作项 / 风险 / 成果 / 月度任务 / 更新日志
  getRelations: (projectId) => api.get(`/projects/${projectId}/relations`),
};
