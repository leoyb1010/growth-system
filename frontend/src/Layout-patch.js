// ============================================================
// PATCH for frontend/src/components/Layout.js
// ============================================================

// --- In AntD icon imports, add: ---
import {
  TransactionOutlined,
  WarningOutlined,
} from '@ant-design/icons';

// --- Modify businessMenuItems to include CPS menu group: ---
const cpsChildren = [
  { key: '/cps/dashboard', label: '业务看板' },
  { key: '/cps/data', label: '数据明细' },
  { key: '/cps/alerts', label: '业务预警' },
  { key: '/cps/channels', label: '渠道管理' },
  { key: '/cps/products', label: '产品管理' },
  { key: '/cps/settings', label: '预警规则' },
].filter(item => canSeeMenu(role, item.key));

const businessMenuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '总览' },
  { key: '/week', icon: <CalendarOutlined />, label: '本周' },
  { key: '/kpis', icon: <BarChartOutlined />, label: '指标与目标' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目推进' },
  { key: '/monthly-tasks', icon: <FormOutlined />, label: '月度任务' },
  { key: '/achievements', icon: <StarOutlined />, label: '季度成果' },
  { key: '/weekly-reports', icon: <FileTextOutlined />, label: '周报与复盘' },
  cpsChildren.length ? {
    key: 'cps-group',
    icon: <TransactionOutlined />,
    label: '连包投流',
    children: cpsChildren,
  } : null,
].filter(Boolean).filter(item => item.key === 'cps-group' || canSeeMenu(role, item.key));
