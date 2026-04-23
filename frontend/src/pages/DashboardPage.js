import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Table, Tag, Button, message, Progress, Segmented, Drawer, Input, Badge, Spin, Empty, Tooltip } from 'antd';
import { WarningOutlined, FileTextOutlined, FundOutlined, RiseOutlined, DollarOutlined, TeamOutlined, ClockCircleOutlined, AlertOutlined, ExclamationCircleOutlined, EditOutlined, ThunderboltOutlined, RocketOutlined, CheckCircleOutlined, FlagOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../hooks/useAuth';
import { can, getCanonicalRole } from '../permissions/ability';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { getStatusStyle, getProgressColor } from '../utils/constants';
import useAIAssistant from '../hooks/useAIAssistant';
import useAIContext from '../hooks/useAIContext';

function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('quarter');
  const [staleProjects, setStaleProjects] = useState([]);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const role = user?.role || 'dept_staff';
  const canonicalRole = getCanonicalRole(role);
  const isMember = canonicalRole === 'department_member';

  // 今日更新 Drawer
  const [todayDrawerVisible, setTodayDrawerVisible] = useState(false);
  const [todayChanges, setTodayChanges] = useState([]);
  const [todayStale, setTodayStale] = useState([]);
  const [todayProjects, setTodayProjects] = useState([]);

  useEffect(() => {
    fetchDashboard();
    fetchStaleProjects();
  }, [viewMode]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard?mode=${viewMode}`);
      if (res.code === 0) setData(res.data);
    } catch (err) {
      message.error('获取仪表盘数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaleProjects = async () => {
    try {
      const res = await api.get('/projects/stale', { params: { days: 7 } });
      if (res.code === 0) setStaleProjects(res.data);
    } catch (err) { /* 静默 */ }
  };

  // 打开今日更新 Drawer 并加载数据
  const openTodayDrawer = async () => {
    setTodayDrawerVisible(true);
    try {
      const [changesRes, staleRes, projectsRes] = await Promise.all([
        api.get('/dashboard/today-changes'),
        api.get('/projects/stale', { params: { days: 3 } }),
        api.get('/projects', { params: { sort: 'priority' } }),
      ]);
      if (changesRes.code === 0) setTodayChanges(changesRes.data);
      if (staleRes.code === 0) setTodayStale(staleRes.data);
      if (projectsRes.code === 0) setTodayProjects(projectsRes.data);
    } catch (err) {
      message.error('加载今日数据失败');
    }
  };

  const handleGenerateReport = async () => {
    try {
      const res = await api.post('/weekly-reports/generate', {});
      if (res.code === 0) {
        message.success('周报生成成功，可在周报与复盘页面查看');
        navigate('/weekly-reports');
      } else {
        message.error(res.message || '生成周报失败');
      }
    } catch (err) {
      console.error('生成周报失败:', err);
      message.error(typeof err === 'string' ? err : '生成周报失败，请稍后重试');
    }
  };

  if (loading && !data) return <div style={{ textAlign: 'center', padding: 80, fontSize: 16, color: '#8c8c8c' }}><Spin size="large" /></div>;

  // 兜底：data 为 null 时显示空状态而非卡死
  if (!data) return (
    <div className="app-page">
      <PageHeader title="总览" subtitle="数据加载异常" extra={[
        <Button key="retry" type="primary" onClick={() => { setData(null); fetchDashboard(); }}>重新加载</Button>
      ]} />
      <div style={{ textAlign: 'center', padding: 80, color: '#9CA3AF' }}>
        <AlertOutlined style={{ fontSize: 40, marginBottom: 16, display: 'block' }} />
        <div>仪表盘数据加载失败，请稍后重试</div>
      </div>
    </div>
  );

  const modeLabel = viewMode === 'year' ? '全年累计' : `${data.current_quarter} 季度`;
  const riskCount = data.kpi_cards?.risk_project_count || 0;
  const showQuarterFallback = data.quarter_fallback && viewMode !== 'year';

  // 长期未更新项目分级
  const getStaleLevel = (days) => {
    if (days >= 14) return { label: `${days}天`, level: 'critical', color: '#DC2626', bg: '#FEF2F2' };
    if (days >= 10) return { label: `${days}天`, level: 'warning', color: '#EA580C', bg: '#FFF7ED' };
    return { label: `${days}天`, level: 'caution', color: '#D97706', bg: '#FFFBEB' };
  };

  // KPI 指标行
  const timeProgress = data.time_progress || 0;
  const kpiCards = [
    {
      title: '部门 GMV', value: `${data.kpi_cards?.total_gmv_rate || 0}%`, suffix: '完成率',
      hint: `目标 ${(data.kpi_cards?.total_gmv_target || 0).toLocaleString()} 万 · 实际 ${(data.kpi_cards?.total_gmv_actual || 0).toLocaleString()} 万 · 时间进度 ${timeProgress.toFixed(0)}%`,
      status: data.kpi_cards?.total_gmv_status || 'error',
      icon: <TeamOutlined style={{ fontSize: 20, color: '#3B5AFB' }} />,
    },
    {
      title: '部门利润', value: `${data.kpi_cards?.total_profit_rate || 0}%`, suffix: '完成率',
      hint: `目标 ${(data.kpi_cards?.total_profit_target || 0).toLocaleString()} 万 · 实际 ${(data.kpi_cards?.total_profit_actual || 0).toLocaleString()} 万 · 时间进度 ${timeProgress.toFixed(0)}%`,
      status: data.kpi_cards?.total_profit_status || 'error',
      icon: <DollarOutlined style={{ fontSize: 20, color: '#16A34A' }} />,
    },
    // 动态渲染各部门 GMV 卡片
    ...(data.kpi_cards?.dept_cards || []).map((dept, idx) => ({
      title: `${dept.dept_name} GMV`, value: `${dept.gmv_rate}%`, suffix: '完成率',
      hint: `目标 ${dept.gmv_target.toLocaleString()} 万 · 实际 ${dept.gmv_actual.toLocaleString()} 万 · 时间进度 ${timeProgress.toFixed(0)}%`,
      status: dept.gmv_status || 'error',
      icon: idx % 2 === 0 ? <FundOutlined style={{ fontSize: 20, color: '#7C3AED' }} /> : <RiseOutlined style={{ fontSize: 20, color: '#0891B2' }} />,
    })),
  ];

  // 工作状态分布饼图
  const statusChartOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}个 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [{
      name: '状态', type: 'pie', radius: ['42%', '72%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{c}个', fontSize: 12 },
      data: (data.project_status_distribution || []).map(item => ({
        name: item.status, value: item.count,
        itemStyle: { color: item.status === '完成' ? '#16A34A' : item.status === '进行中' ? '#3B5AFB' : item.status === '风险' ? '#DC2626' : '#9CA3AF' }
      }))
    }]
  };

  // 今日变化渲染（Drawer 内复用）
  const renderChangeItem = (c, idx, total) => {
    const tableLabel = { projects: '项目', kpis: '指标', performances: '业绩', monthly_tasks: '月度', achievements: '成果' }[c.table_name] || c.table_name;
    const actionConfig = { create: { label: '新增', color: '#16A34A', tag: 'success' }, update: { label: '更新', color: '#3B5AFB', tag: 'processing' }, delete: { label: '删除', color: '#DC2626', tag: 'error' } }[c.action] || { label: c.action, color: '#9CA3AF', tag: 'default' };
    return (
      <div key={c.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: idx < total - 1 ? '1px solid #F1F5F9' : 'none' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: actionConfig.color, marginTop: 7, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag color={actionConfig.tag} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>{actionConfig.label}</Tag>
            <span>{tableLabel}</span>
            {c.operator_name && <span className="subtle-text" style={{ marginLeft: 4 }}>by {c.operator_name}</span>}
          </div>
          <div className="subtle-text" style={{ fontSize: 11, marginTop: 2 }}>{moment(c.created_at).format('HH:mm')}</div>
        </div>
      </div>
    );
  };

  // ===== 角色化首页渲染 =====
  // 普通成员首页：自己的项目 + 快捷更新 + 个人待办
  if (isMember) {
    return (
      <div className="app-page">
        <PageHeader
          title="我的工作台"
          subtitle={`${data.current_year}年 · ${modeLabel} · 我负责的项目与待办`}
          extra={[
            <Segmented
              key="mode" value={viewMode} onChange={(v) => setViewMode(v)}
              options={[{ label: `${data.current_quarter} 季度`, value: 'quarter' }, { label: '全年累计', value: 'year' }]}
            />,
            <Button key="today" type="primary" ghost icon={<EditOutlined />} onClick={openTodayDrawer}>快速更新</Button>,
          ]}
        />

        {/* 成员区：我的项目概览 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {(() => {
            const myProjects = (data.recent_projects || []).filter(p => p.owner_name === user?.name);
            const riskCount = myProjects.filter(p => p.is_risk).length;
            const dueCount = myProjects.filter(p => p.is_due_soon).length;
            const completedCount = myProjects.filter(p => p.status === '完成').length;
            const myKpiRate = data.kpi_cards?.total_gmv_rate || 0;
            return [
              { title: '我负责的项目', value: myProjects.length, icon: <RocketOutlined style={{ fontSize: 20, color: '#3B5AFB' }} />, color: '#3B5AFB' },
              { title: '风险项目', value: riskCount, icon: <WarningOutlined style={{ fontSize: 20, color: '#DC2626' }} />, color: riskCount > 0 ? '#DC2626' : '#16A34A' },
              { title: '即将到期', value: dueCount, icon: <ClockCircleOutlined style={{ fontSize: 20, color: '#F59E0B' }} />, color: dueCount > 0 ? '#F59E0B' : '#16A34A' },
              { title: '已完成', value: completedCount, icon: <CheckCircleOutlined style={{ fontSize: 20, color: '#16A34A' }} />, color: '#16A34A' },
            ].map((card, idx) => (
              <Col xs={12} sm={12} xl={6} key={idx}>
                <Card className="surface-card hover-lift" bodyStyle={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div className="metric-label">{card.title}</div>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F7FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {card.icon}
                    </div>
                  </div>
                  <div className="metric-value" style={{ color: card.color }}>{card.value}</div>
                </Card>
              </Col>
            ));
          })()}
        </Row>

        {/* 成员区：我的项目列表 + 快捷更新 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={14}>
            <PanelCard
              title={<span><RocketOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />我的项目</span>}
              subtitle="我负责的项目 · 点击可快速更新"
              extra={<Button type="link" size="small" onClick={() => navigate('/projects')}>项目推进 →</Button>}
            >
              {(() => {
                const myProjects = (data.recent_projects || []).filter(p => p.owner_name === user?.name);
                if (myProjects.length === 0) {
                  return <Empty description="暂无负责的项目" />;
                }
                return myProjects.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, background: p.status === '风险' ? '#FEF2F2' : '#F9FAFB', borderRadius: 8 }}>
                    {p.status === '风险' && <Tag color="error" style={{ margin: 0, fontSize: 11 }}>风险</Tag>}
                    {p.is_due_soon && <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>临期</Tag>}
                    <span style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{p.name}</span>
                    <Progress type="circle" percent={p.progress_pct} size={32} strokeColor={getProgressColor(p.progress_pct)} />
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={openTodayDrawer}>更新</Button>
                  </div>
                ));
              })()}
            </PanelCard>
          </Col>
          <Col xs={24} lg={10}>
            <PanelCard
              title={<span><ClockCircleOutlined style={{ color: '#F59E0B', marginRight: 8 }} />我的待办</span>}
              subtitle="到期/风险/待更新"
            >
              {(() => {
                const myProjects = (data.recent_projects || []).filter(p => p.owner_name === user?.name);
                const todos = [];
                // 风险
                myProjects.filter(p => p.is_risk).forEach(p => todos.push({ text: `🔴 ${p.name}`, type: 'risk' }));
                // 临期
                myProjects.filter(p => p.is_due_soon && !p.is_risk).forEach(p => todos.push({ text: `⏰ ${p.name} 即将到期`, type: 'due' }));
                // 待更新
                const staleItems = staleProjects.filter(p => p.owner_name === user?.name);
                staleItems.forEach(p => todos.push({ text: `💤 ${p.name} ${p.days_since_update}天未更新`, type: 'stale' }));
                if (todos.length === 0) {
                  return <Empty description="暂无待办 ✌️" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
                }
                return todos.map((t, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', marginBottom: 6, background: t.type === 'risk' ? '#FEF2F2' : t.type === 'due' ? '#FFFBEB' : '#F9FAFB', borderRadius: 6, fontSize: 13 }}>
                    {t.text}
                  </div>
                ));
              })()}
            </PanelCard>
          </Col>
        </Row>

        {/* 成员区：快捷操作 */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <PanelCard title="快捷入口" subtitle="常用功能快速到达">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {[
                  { label: '项目推进', icon: '🚀', path: '/projects', color: '#7C3AED' },
                  { label: '月度任务', icon: '📋', path: '/monthly-tasks', color: '#0891B2' },
                  { label: '季度成果', icon: '⭐', path: '/achievements', color: '#16A34A' },
                  { label: '周报复盘', icon: '📊', path: '/weekly-reports', color: '#3B5AFB' },
                ].map(item => (
                  <Card key={item.label} className="surface-card hover-lift" bodyStyle={{ padding: 16, cursor: 'pointer', textAlign: 'center' }} onClick={() => navigate(item.path)}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: item.color }}>{item.label}</div>
                  </Card>
                ))}
              </div>
            </PanelCard>
          </Col>
        </Row>

        {/* 今日更新 Drawer（成员版） */}
        <Drawer
          title={<span><EditOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />快速更新 · {moment().format('M月D日')}</span>}
          open={todayDrawerVisible}
          onClose={() => setTodayDrawerVisible(false)}
          width={720}
          extra={<Button onClick={() => setTodayDrawerVisible(false)}>关闭</Button>}
        >
          {/* 今日摘要卡片 */}
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Card className="surface-card" bodyStyle={{ padding: 14 }}>
                <div className="metric-label">风险项目</div>
                <div className="metric-value" style={{ fontSize: 24, color: todayProjects.filter(p => p.is_risk && p.owner_name === user?.name).length > 0 ? '#DC2626' : '#16A34A' }}>{todayProjects.filter(p => p.is_risk && p.owner_name === user?.name).length}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card className="surface-card" bodyStyle={{ padding: 14 }}>
                <div className="metric-label">待更新</div>
                <div className="metric-value" style={{ fontSize: 24, color: todayStale.filter(p => p.owner_name === user?.name).length > 0 ? '#F59E0B' : '#16A34A' }}>{todayStale.filter(p => p.owner_name === user?.name).length}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card className="surface-card" bodyStyle={{ padding: 14 }}>
                <div className="metric-label">今日变更</div>
                <div className="metric-value" style={{ fontSize: 24, color: '#9CA3AF' }}>{todayChanges.length}</div>
              </Card>
            </Col>
          </Row>

          {/* 待更新项目 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ 待更新项目
            </div>
            {(() => {
              const myStale = todayStale.filter(p => p.owner_name === user?.name);
              if (myStale.length === 0) return <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 10 }}>所有项目均近期更新 ✌️</div>;
              return myStale.map(p => {
                const sl = getStaleLevel(p.days_since_update);
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, background: sl.bg, borderRadius: 8 }}>
                    <span style={{ fontSize: 14 }}>💤</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                    </div>
                    <Tag color={sl.level === 'critical' ? 'error' : sl.level === 'warning' ? 'orange' : 'warning'} style={{ fontSize: 11 }}>{sl.label}</Tag>
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setTodayDrawerVisible(false); navigate('/projects'); }}>前往更新</Button>
                  </div>
                );
              });
            })()}
          </div>

          {/* 快捷入口 */}
          <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#3B5AFB', marginBottom: 8 }}>📌 快捷入口</div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 2 }}>
              <div>📝 <strong>项目推进</strong>：维护项目进度、状态、风险 — <Button type="link" size="small" onClick={() => { setTodayDrawerVisible(false); navigate('/projects'); }}>前往 →</Button></div>
              <div>📋 <strong>月度任务</strong>：更新月度工作进展 — <Button type="link" size="small" onClick={() => { setTodayDrawerVisible(false); navigate('/monthly-tasks'); }}>前往 →</Button></div>
              <div>⭐ <strong>季度成果</strong>：录入和更新成果 — <Button type="link" size="small" onClick={() => { setTodayDrawerVisible(false); navigate('/achievements'); }}>前往 →</Button></div>
            </div>
          </div>
        </Drawer>
      </div>
    );
  }

  // ===== 管理员/部门负责人首页（原有仪表盘） =====
  return (
    <div className="app-page">
      <PageHeader
        title={canonicalRole === 'super_admin' ? '管理驾驶舱' : '部门仪表盘'}
        subtitle={`${data.current_year}年 · ${modeLabel} · 本周状态、待办事项与风险一览`}
        extra={[
          <Segmented
            key="mode" value={viewMode} onChange={(v) => setViewMode(v)}
            options={[{ label: `${data.current_quarter} 季度`, value: 'quarter' }, { label: '全年累计', value: 'year' }]}
          />,
          <Button key="today" type="primary" ghost icon={<ClockCircleOutlined />} onClick={openTodayDrawer}>今日更新</Button>,
          <Button key="ai" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.openDrawer('today_judgment')}>AI 分析</Button>,
          can(role, 'weekly_report.generate') && <Button key="report" type="primary" icon={<FileTextOutlined />} onClick={handleGenerateReport}>生成周报</Button>,
        ]}
      />

      {/* ===== 区块1：本周概览（4个KPI） ===== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpiCards.map((card, idx) => (
          <Col xs={24} sm={12} xl={6} key={idx}>
            <Card className="surface-card hover-lift" bodyStyle={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div className="metric-label">{card.title}</div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F7FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span className="metric-value">{card.value}</span>
                <span className="subtle-text" style={{ fontSize: 13 }}>{card.suffix}</span>
              </div>
              <Progress percent={Math.min(parseFloat(card.value), 100)} strokeColor={card.status === 'success' ? '#16A34A' : card.status === 'warning' ? '#F59E0B' : '#DC2626'} trailColor="#F1F5F9" showInfo={false} strokeWidth={6} style={{ marginBottom: 10 }} />
              <div className="subtle-text" style={{ fontSize: 12 }}>{card.hint}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 季度回退提示 */}
      {showQuarterFallback && (
        <div style={{ marginBottom: 24, padding: '12px 20px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertOutlined style={{ fontSize: 18, color: '#D97706' }} />
          <span style={{ fontSize: 14, color: '#92400E' }}>
            当前季度（{data.current_quarter}）暂无数据，已自动切换至 <strong>{data.effective_quarter}</strong> 季度数据
          </span>
        </div>
      )}

      {/* ===== 区块2：今日提醒 + 本周关注（双列） ===== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><ClockCircleOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />今日提醒</span>}
            subtitle="工作相关提醒 · 自动筛选"
            extra={<Button type="link" size="small" onClick={openTodayDrawer}>查看详情 →</Button>}
          >
            {(() => {
              // 工作内容提醒：到期、风险、待更新、偏差，不含操作行为
              const reminders = [];
              // 今日到期
              const todayDue = (data.recent_projects || []).filter(p => p.is_due_soon && p.due_date && moment().diff(moment(p.due_date), 'days') === 0 && p.status !== '完成');
              if (todayDue.length > 0) reminders.push({ type: 'due_today', text: `${todayDue.length}个项目今日到期`, count: todayDue.length });
              // 本周到期
              const dueSoon = data.due_soon_projects || [];
              if (dueSoon.length > 0) reminders.push({ type: 'due_soon', text: `${dueSoon.length}个项目7天内到期`, count: dueSoon.length });
              // 风险项目
              const riskCount = data.kpi_cards?.risk_project_count || 0;
              if (riskCount > 0) reminders.push({ type: 'risk', text: `${riskCount}个项目存在风险`, count: riskCount });
              // 待更新
              const staleCount = staleProjects.length;
              if (staleCount > 0) reminders.push({ type: 'stale', text: `${staleCount}个项目超过7天未更新`, count: staleCount });
              // KPI偏差（基于时间进度检测）
              const deviationItems = (data.kpi_cards?.dept_cards || [])
                .filter(d => d.gmv_status === 'error')
                .map(d => `${d.dept_name}GMV`);
              if (deviationItems.length > 0) reminders.push({ type: 'deviation', text: `${deviationItems.join('、')}完成率偏差较大`, count: deviationItems.length });

              if (reminders.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
                    <ClockCircleOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block', opacity: 0.4 }} />
                    <div style={{ fontSize: 13 }}>今日暂无工作提醒</div>
                  </div>
                );
              }
              const iconMap = { due_today: '🔴', due_soon: '⏰', risk: '⚠️', stale: '💤', deviation: '📉' };
              const bgMap = { due_today: '#FEF2F2', due_soon: '#FFFBEB', risk: '#FEF2F2', stale: '#F9FAFB', deviation: '#F5F3FF' };
              return (
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {reminders.map((r, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: idx < reminders.length - 1 ? 8 : 0, background: bgMap[r.type] || '#F9FAFB', borderRadius: 8 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{iconMap[r.type] || '📌'}</span>
                      <div style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{r.text}</div>
                      <Tag color={r.type === 'risk' || r.type === 'due_today' ? 'error' : r.type === 'due_soon' ? 'warning' : 'default'} style={{ flexShrink: 0 }}>{r.count}</Tag>
                    </div>
                  ))}
                </div>
              );
            })()}
          </PanelCard>
        </Col>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><AlertOutlined style={{ color: '#F59E0B', marginRight: 8 }} />本周关注</span>}
            subtitle="系统自动筛选"
            extra={data.week_focus?.length > 0 && <span className="subtle-text" style={{ fontSize: 12 }}>{data.week_focus.reduce((s, f) => s + f.count, 0)} 项</span>}
          >
            {(!data.week_focus || data.week_focus.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
                <AlertOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block', opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>本周暂无特别关注事项</div>
              </div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {data.week_focus.map((f, idx) => {
                  const iconMap = { due_soon: '⏰', risk: '🔴', stale: '💤', deviation: '📉' };
                  const bgMap = { due_soon: '#FFFBEB', risk: '#FEF2F2', stale: '#F9FAFB', deviation: '#F5F3FF' };
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: idx < data.week_focus.length - 1 ? 8 : 0, background: bgMap[f.type] || '#F9FAFB', borderRadius: 8 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{iconMap[f.type] || '📌'}</span>
                      <div style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{f.text}</div>
                      <Tag color={f.type === 'risk' ? 'error' : f.type === 'due_soon' ? 'warning' : 'default'} style={{ flexShrink: 0 }}>{f.count}</Tag>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelCard>
        </Col>
      </Row>

      {/* ===== 区块3：重点推进事项 + 长期未更新项目（双列） ===== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><ThunderboltOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />重点推进事项</span>}
            subtitle="来源于项目推进 · 系统自动筛选"
            extra={<Button type="link" size="small" onClick={() => navigate('/projects')}>项目推进 →</Button>}
          >
            {(() => {
              const focusProjects = (data.recent_projects || [])
                .filter(p => p.status === '风险' || p.is_due_soon || p.progress_status === 'behind' || p.priority === '高')
                .slice(0, 6);
              if (focusProjects.length === 0) return <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>暂无重点推进事项</div>;
              return focusProjects.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, background: p.status === '风险' ? '#FEF2F2' : '#F9FAFB', borderRadius: 8 }}>
                  {p.status === '风险' && <Tag color="error" style={{ margin: 0, fontSize: 11 }}>风险</Tag>}
                  {p.priority === '高' && p.status !== '风险' && <Tag color="red" style={{ margin: 0, fontSize: 11 }}>🔥 高优先</Tag>}
                  {p.is_due_soon && !p.is_risk && <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>临期</Tag>}
                  {p.progress_status === 'behind' && p.status !== '风险' && !p.is_due_soon && <Tag color="default" style={{ margin: 0, fontSize: 11 }}>落后</Tag>}
                  <span style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{p.name}</span>
                  <span className="subtle-text" style={{ fontSize: 11 }}>{p.owner_name}</span>
                  <Progress type="circle" percent={p.progress_pct} size={32} strokeColor={p.progress_pct >= 80 ? '#16A34A' : p.progress_pct >= 60 ? '#F59E0B' : '#DC2626'} />
                </div>
              ));
            })()}
          </PanelCard>
        </Col>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><ExclamationCircleOutlined style={{ color: '#EA580C', marginRight: 8 }} />长期未更新项目</span>}
            subtitle="来源于项目推进 · 系统自动检测"
            extra={<Button type="link" size="small" onClick={openTodayDrawer}>今日更新 →</Button>}
          >
            {staleProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>所有项目近期均有更新 ✌️</div>
            ) : (
              staleProjects.slice(0, 6).map(p => {
                const sl = getStaleLevel(p.days_since_update);
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, background: sl.bg, borderRadius: 8 }}>
                    <span style={{ fontSize: 14 }}>💤</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                      <div className="subtle-text" style={{ fontSize: 11 }}>{p.Department?.name} · {p.owner_name}</div>
                    </div>
                    <Tag color={sl.level === 'critical' ? 'error' : sl.level === 'warning' ? 'orange' : 'warning'} style={{ fontSize: 11 }}>{sl.label}</Tag>
                  </div>
                );
              })
            )}
          </PanelCard>
        </Col>
      </Row>

      {/* ===== 区块4：风险/阻塞摘要 ===== */}
      {riskCount > 0 && (
        <div style={{ marginBottom: 24, padding: '12px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertOutlined style={{ fontSize: 18, color: '#DC2626' }} />
          <span style={{ fontSize: 14, color: '#991B1B' }}>
            当前有 <strong>{riskCount}</strong> 个风险项目需要关注
          </span>
          <Button type="link" size="small" onClick={() => navigate('/projects')} style={{ padding: 0, height: 'auto', fontWeight: 600 }}>项目推进 →</Button>
        </div>
      )}

      {/* ===== 区块5：图表区 ===== */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <PanelCard title="重点工作状态分布" subtitle="系统自动统计">
            <ReactECharts option={statusChartOption} style={{ height: 260 }} />
          </PanelCard>
        </Col>
        <Col xs={24} lg={12}>
          <PanelCard title="快捷操作" subtitle="日常管理常用入口">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '今日更新', icon: '📋', desc: '查看变更与待办', action: openTodayDrawer, color: '#3B5AFB' },
                { label: '项目推进', icon: '🚀', desc: '维护项目数据（唯一入口）', path: '/projects', color: '#7C3AED' },
                { label: '本周管理', icon: '📅', desc: '过程管理（自动汇总）', path: '/week', color: '#0891B2' },
                { label: '周报与复盘', icon: '📊', desc: '结果输出（自动生成）', path: '/weekly-reports', color: '#16A34A' },
              ].map(item => (
                <Card key={item.label} className="surface-card hover-lift" bodyStyle={{ padding: 16, cursor: 'pointer' }} onClick={() => item.action ? item.action() : navigate(item.path)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: item.color }}>{item.label}</span>
                  </div>
                  <div className="subtle-text" style={{ fontSize: 12 }}>{item.desc}</div>
                </Card>
              ))}
            </div>
          </PanelCard>
        </Col>
      </Row>

      {/* ===== 今日更新 Drawer（从驾驶舱弹出） ===== */}
      <Drawer
        title={<span><ClockCircleOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />今日更新 · {moment().format('M月D日 dddd')}</span>}
        open={todayDrawerVisible}
        onClose={() => setTodayDrawerVisible(false)}
        width={720}
        extra={<Button onClick={() => setTodayDrawerVisible(false)}>关闭</Button>}
      >
        {/* 今日摘要卡片 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col span={8}>
            <Card className="surface-card" bodyStyle={{ padding: 14 }}>
              <div className="metric-label">风险项目</div>
              <div className="metric-value" style={{ fontSize: 24, color: todayProjects.filter(p => p.is_risk).length > 0 ? '#DC2626' : '#16A34A' }}>{todayProjects.filter(p => p.is_risk).length}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>{todayProjects.filter(p => p.is_risk).length > 0 ? '需关注' : '无风险'}</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card className="surface-card" bodyStyle={{ padding: 14 }}>
              <div className="metric-label">待更新</div>
              <div className="metric-value" style={{ fontSize: 24, color: todayStale.length > 0 ? '#F59E0B' : '#16A34A' }}>{todayStale.length}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>超3天未更新</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card className="surface-card" bodyStyle={{ padding: 14 }}>
              <div className="metric-label">数据变更</div>
              <div className="metric-value" style={{ fontSize: 24, color: '#9CA3AF' }}>{todayChanges.length}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>条操作记录</div>
            </Card>
          </Col>
        </Row>

        {/* 今日变更流 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            📝 今日变更
            {todayChanges.length > 0 && <Badge count={todayChanges.length} style={{ backgroundColor: '#3B5AFB' }} />}
          </div>
          {todayChanges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 10 }}>
              <ClockCircleOutlined style={{ fontSize: 24, marginBottom: 6, display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 12 }}>今日暂无数据变更</div>
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto', background: '#F9FAFB', borderRadius: 10, padding: '8px 12px' }}>
              {todayChanges.slice(0, 30).map((c, idx) => renderChangeItem(c, idx, Math.min(todayChanges.length, 30)))}
            </div>
          )}
        </div>

        {/* 待更新项目 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ 待更新项目
            {todayStale.length > 0 && <Badge count={todayStale.length} style={{ backgroundColor: '#F59E0B' }} />}
          </div>
          {todayStale.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 10 }}>所有项目均近期更新 ✌️</div>
          ) : (
            todayStale.map(p => {
              const sl = getStaleLevel(p.days_since_update);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, background: sl.bg, borderRadius: 8 }}>
                  <span style={{ fontSize: 14 }}>💤</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                    <div className="subtle-text" style={{ fontSize: 11 }}>{p.Department?.name} · {p.owner_name}</div>
                  </div>
                  <Tag color={sl.level === 'critical' ? 'error' : sl.level === 'warning' ? 'orange' : 'warning'} style={{ fontSize: 11 }}>
                    {sl.label}
                  </Tag>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setTodayDrawerVisible(false); navigate('/projects'); }}>
                    前往更新
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* 快捷录入入口 */}
        <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#3B5AFB', marginBottom: 8 }}>📌 快捷录入</div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 2 }}>
            <div>📝 <strong>项目推进</strong>：维护项目进度、状态、风险（唯一填写入口） — 
              <Button type="link" size="small" onClick={() => { setTodayDrawerVisible(false); navigate('/projects'); }}>前往 →</Button>
            </div>
            <div>📋 <strong>本周管理</strong>：查看本周重点与风险汇总（自动生成） — 
              <Button type="link" size="small" onClick={() => { setTodayDrawerVisible(false); navigate('/week'); }}>前往 →</Button>
            </div>
            <div>📊 <strong>周报与复盘</strong>：输出本周总结（自动生成，可补充管理评语） — 
              <Button type="link" size="small" onClick={() => { setTodayDrawerVisible(false); navigate('/weekly-reports'); }}>前往 →</Button>
            </div>
          </div>
        </div>
      </Drawer>

    </div>
  );
}

export default DashboardPage;
