import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Tag, Progress, Tabs, Badge, Tooltip, Spin, Empty, Input, message, Drawer, Descriptions, Checkbox } from 'antd';
import { ClockCircleOutlined, AlertOutlined, ExclamationCircleOutlined, ThunderboltOutlined, EditOutlined, CalendarOutlined, WarningOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { STATUS_COLORS, getStatusStyle, getProgressColor } from '../utils/constants';
import { RobotOutlined } from '@ant-design/icons';

function WeekPage() {
  const { isDeptManager, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weekSummary, setWeekSummary] = useState(null);
  const [todayChanges, setTodayChanges] = useState([]);
  const [weekFocus, setWeekFocus] = useState([]);
  const [projects, setProjects] = useState([]);
  const [staleProjects, setStaleProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [quickEditVisible, setQuickEditVisible] = useState(false);
  const [quickEditItem, setQuickEditItem] = useState(null);
  const [quickProgress, setQuickProgress] = useState('');
  const [quickSyncMonthly, setQuickSyncMonthly] = useState(false);
  const [quickSyncAchievement, setQuickSyncAchievement] = useState(false);

  // 本周日期范围
  const getWeekRange = () => {
    const today = moment();
    const dayOfWeek = today.isoWeekday();
    const monday = today.clone().subtract(dayOfWeek - 1, 'days');
    const sunday = monday.clone().add(6, 'days');
    return { start: monday, end: sunday, label: `${monday.format('M/D')} ~ ${sunday.format('M/D')}` };
  };
  const weekRange = getWeekRange();

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [summaryRes, changesRes, focusRes, projectsRes, staleRes] = await Promise.all([
        api.get('/dashboard/week-summary'),
        api.get('/dashboard/today-changes'),
        api.get('/dashboard/week-focus'),
        api.get('/projects', { params: { quarter: getCurrentQuarter() } }),
        api.get('/projects/stale', { params: { days: 3 } }),
      ]);
      if (summaryRes.code === 0) setWeekSummary(summaryRes.data);
      if (changesRes.code === 0) setTodayChanges(changesRes.data);
      if (focusRes.code === 0) setWeekFocus(focusRes.data);
      if (projectsRes.code === 0) setProjects(projectsRes.data);
      if (staleRes.code === 0) setStaleProjects(staleRes.data);
    } catch (err) {
      message.error('加载本周数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentQuarter = () => {
    const m = new Date().getMonth();
    return m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
  };

  // 每日更新
  const handleQuickUpdate = async () => {
    if (!quickEditItem || !quickProgress.trim()) return;
    try {
      await api.put(`/projects/${quickEditItem.id}/quick-update`, {
        weekly_progress: quickProgress,
        sync_to_monthly: quickSyncMonthly,
        sync_to_achievement: quickSyncAchievement,
      });
      message.success('每日更新成功');
      setQuickEditVisible(false);
      setQuickEditItem(null);
      setQuickProgress('');
      setQuickSyncMonthly(false);
      setQuickSyncAchievement(false);
      fetchAllData();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || '更新失败');
    }
  };

  // 本周重点工作 — 按管理优先级排序
  const sortedProjects = [...projects]
    .filter(p => p.type !== '下周重点')
    .sort((a, b) => {
      // 风险 > 临期 > 落后于时间进度 > 长期未更新 > 其他
      const getPriority = (p) => {
        if (p.is_risk) return 0;
        if (p.is_due_soon) return 1;
        if (p.progress_status === 'behind' && p.status !== '完成') return 2;
        if (staleProjects.some(s => s.id === p.id)) return 3;
        return 4;
      };
      return getPriority(a) - getPriority(b);
    });

  const nextWeekProjects = projects.filter(p => p.type === '下周重点');
  const riskProjects = sortedProjects.filter(p => p.is_risk);
  const dueSoonProjects = sortedProjects.filter(p => p.is_due_soon);

  // 今日变化渲染
  const renderTodayChanges = () => {
    if (todayChanges.length === 0) {
      return <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}><ClockCircleOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block', opacity: 0.4 }} />今日暂无数据变更</div>;
    }
    return todayChanges.slice(0, 20).map((c, idx) => {
      const tableLabel = { projects: '项目', kpis: '指标', performances: '业绩', monthly_tasks: '月度', achievements: '成果' }[c.table_name] || c.table_name;
      const actionConfig = { create: { label: '新增', tag: 'success' }, update: { label: '更新', tag: 'processing' }, delete: { label: '删除', tag: 'error' } }[c.action] || { label: c.action, tag: 'default' };
      return (
        <div key={c.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
          <Tag color={actionConfig.tag} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{actionConfig.label}</Tag>
          <span style={{ fontSize: 13, color: '#111827' }}>{tableLabel}</span>
          {c.operator_name && <span className="subtle-text" style={{ fontSize: 11 }}>by {c.operator_name}</span>}
          <span className="subtle-text" style={{ marginLeft: 'auto', fontSize: 11 }}>{moment(c.created_at).format('HH:mm')}</span>
        </div>
      );
    });
  };

  // 项目卡片
  const renderProjectCard = (item) => {
    const sc = getStatusStyle(item.status);
    return (
      <Card
        key={item.id}
        className="surface-card hover-lift"
        style={{ borderLeft: `3px solid ${sc.border}` }}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1, marginRight: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          </div>
          <Tag color={sc.tag} style={{ flexShrink: 0 }}>{item.status}</Tag>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
          <span>👤 {item.owner_name || '-'}</span>
          {item.days_until_due !== undefined && (
            <Tag color={item.days_until_due < 0 ? 'error' : item.days_until_due <= 3 ? 'warning' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
              {item.days_until_due < 0 ? `逾期${Math.abs(item.days_until_due)}天` : item.days_until_due === 0 ? '今天到期' : `剩${item.days_until_due}天`}
            </Tag>
          )}
        </div>
        <Progress percent={item.progress_pct} strokeColor={getProgressColor(item.progress_pct)} trailColor="#F1F5F9" size="small" style={{ marginBottom: 6 }} />
        {item.weekly_progress && (
          <div style={{ fontSize: 12, color: '#6B7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 6 }}>
            📝 {item.weekly_progress}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
          <span className="subtle-text" style={{ fontSize: 11 }}>🕐 {moment(item.updated_at).fromNow()}</span>
          {isDeptManager && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setQuickEditItem(item); setQuickProgress(item.weekly_progress || ''); setQuickSyncMonthly(false); setQuickSyncAchievement(false); setQuickEditVisible(true); }}>
              每日更新
            </Button>
          )}
        </div>
      </Card>
    );
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div className="app-page">
      <PageHeader
        title="本周管理"
        subtitle={`${weekRange.label} · 过程管理 · 以下内容均为项目推进页数据的自动汇总，无需重复填写`}
        extra={[
          <Button key="ai_closure" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.openDrawer('risk_closure')}>闭环检查</Button>,
          <Button key="ai_meeting" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.runAction('prepare_meeting')}>准备周会</Button>,
          <Button key="refresh" onClick={fetchAllData}>刷新</Button>,
        ]}
      />

      {/* 本周摘要指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">本周更新</div>
            <div className="metric-value" style={{ color: '#3B5AFB' }}>{weekSummary?.updated_count || 0}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>项目</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">本周完成</div>
            <div className="metric-value" style={{ color: '#16A34A' }}>{weekSummary?.completed_count || 0}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>项目</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">风险项</div>
            <div className="metric-value" style={{ color: riskProjects.length > 0 ? '#DC2626' : '#16A34A' }}>{riskProjects.length}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>{riskProjects.length > 0 ? '需关注' : '无风险'}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">待更新</div>
            <div className="metric-value" style={{ color: staleProjects.length > 0 ? '#F59E0B' : '#16A34A' }}>{staleProjects.length}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>超3天未更新</div>
          </Card>
        </Col>
      </Row>

      {/* Tab 切换 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'overview',
          label: '📋 本周概览',
          children: (
            <div>
              {/* 本周关注点 */}
              {weekFocus.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <PanelCard title={<span><AlertOutlined style={{ color: '#F59E0B', marginRight: 8 }} />本周关注</span>}>
                    {weekFocus.map((f, idx) => {
                      const iconMap = { due_soon: '⏰', risk: '🔴', stale: '💤', deviation: '📉' };
                      const bgMap = { due_soon: '#FFFBEB', risk: '#FEF2F2', stale: '#F9FAFB', deviation: '#F5F3FF' };
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, background: bgMap[f.type] || '#F9FAFB', borderRadius: 8 }}>
                          <span style={{ fontSize: 18 }}>{iconMap[f.type] || '📌'}</span>
                          <div style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{f.text}</div>
                          <Tag color={f.type === 'risk' ? 'error' : f.type === 'due_soon' ? 'warning' : 'default'}>{f.count}</Tag>
                        </div>
                      );
                    })}
                  </PanelCard>
                </div>
              )}

              {/* 风险 + 临期（2列） */}
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                  <PanelCard title={<span><WarningOutlined style={{ color: '#DC2626', marginRight: 8 }} />风险项目</span>}>
                    {riskProjects.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>暂无风险项目 ✌️</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {riskProjects.slice(0, 5).map(p => renderProjectCard(p))}
                      </div>
                    )}
                  </PanelCard>
                </Col>
                <Col xs={24} lg={12}>
                  <PanelCard title={<span><ClockCircleOutlined style={{ color: '#F59E0B', marginRight: 8 }} />临期事项</span>} subtitle="短周期 · 7天内到期">
                    {dueSoonProjects.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>暂无临期项目</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dueSoonProjects.slice(0, 5).map(p => renderProjectCard(p))}
                      </div>
                    )}
                  </PanelCard>
                </Col>
              </Row>

              {/* 本周全部项目 */}
              <PanelCard title="本周重点工作">
                <Row gutter={[12, 12]}>
                  {sortedProjects.length === 0 ? (
                    <Col span={24}><Empty description="暂无本周重点" /></Col>
                  ) : sortedProjects.map(p => (
                    <Col xs={24} sm={12} lg={8} key={p.id}>{renderProjectCard(p)}</Col>
                  ))}
                </Row>
              </PanelCard>
            </div>
          ),
        },
        {
          key: 'today',
          label: '📝 今日更新',
          children: (
            <div>
              {/* 今日变更流 */}
              <PanelCard title={<span><ClockCircleOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />今日变更</span>} style={{ marginBottom: 16 }}>
                {renderTodayChanges()}
              </PanelCard>

              {/* 今日待更新 */}
              <PanelCard
                title={<span><ExclamationCircleOutlined style={{ color: '#F59E0B', marginRight: 8 }} />今日待更新</span>}
                subtitle="超过3天未更新的项目"
                style={{ marginBottom: 16 }}
              >
                {staleProjects.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>所有项目均近期更新 ✌️</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {staleProjects.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8 }}>
                        <span style={{ fontSize: 14 }}>💤</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                          <div className="subtle-text" style={{ fontSize: 11 }}>{p.Department?.name} · {p.owner_name} · {p.days_since_update}天未更新</div>
                        </div>
                        {isDeptManager && (
                          <Button type="link" size="small" onClick={() => { setQuickEditItem(p); setQuickProgress(p.weekly_progress || ''); setQuickSyncMonthly(false); setQuickSyncAchievement(false); setQuickEditVisible(true); }}>
                            每日更新
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>

              {/* 今日到期 */}
              <PanelCard title={<span><AlertOutlined style={{ color: '#DC2626', marginRight: 8 }} />今日到期</span>}>
                {(() => {
                  const todayDue = sortedProjects.filter(p => p.days_until_due === 0 && p.status !== '完成');
                  if (todayDue.length === 0) return <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>今日无到期项目</div>;
                  return todayDue.map(p => renderProjectCard(p));
                })()}
              </PanelCard>
            </div>
          ),
        },
        {
          key: 'nextweek',
          label: (
            <span>
              <ThunderboltOutlined /> 下周重点
              <span className="subtle-text" style={{ fontSize: 11, marginLeft: 6 }}>{nextWeekProjects.length}</span>
            </span>
          ),
          children: (
            <PanelCard title="下周重点工作安排">
              {nextWeekProjects.length === 0 ? (
                <Empty description="暂无下周重点，请在项目推进页面录入" />
              ) : (
                <Row gutter={[12, 12]}>
                  {nextWeekProjects.map(p => renderProjectCard(p))}
                </Row>
              )}
            </PanelCard>
          ),
        },
      ]} />

      {/* 每日更新抽屉 */}
      <Drawer
        title={quickEditItem ? `每日更新：${quickEditItem.name}` : '每日更新'}
        open={quickEditVisible}
        onClose={() => { setQuickEditVisible(false); setQuickEditItem(null); setQuickProgress(''); setQuickSyncMonthly(false); setQuickSyncAchievement(false); }}
        width={480}
        extra={<Button type="primary" onClick={handleQuickUpdate}>保存</Button>}
      >
        {quickEditItem && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <Tag color={getStatusStyle(quickEditItem.status).tag}>{quickEditItem.status}</Tag>
              <Tag>{quickEditItem.Department?.name}</Tag>
              <span className="subtle-text">{quickEditItem.owner_name}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Progress percent={quickEditItem.progress_pct} strokeColor={getProgressColor(quickEditItem.progress_pct)} />
            </div>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>📝 今日进展</div>
            <Input.TextArea
              rows={4}
              value={quickProgress}
              onChange={(e) => setQuickProgress(e.target.value)}
              placeholder="输入今日进展（追加模式，不会覆盖已有内容）..."
            />
            {/* 同步选项 */}
            <div style={{ marginTop: 16, background: '#F8FAFC', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Checkbox
                  checked={quickSyncMonthly}
                  onChange={(e) => setQuickSyncMonthly(e.target.checked)}
                />
                <span style={{ fontSize: 13, color: '#334155' }}>同步进展到本月月度任务</span>
                <Tooltip title="开启后，本次进展内容将追加到该项目关联的月度任务「实际完成情况」中">
                  <QuestionCircleOutlined style={{ color: '#9CA3AF', cursor: 'help' }} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox
                  checked={quickSyncAchievement}
                  onChange={(e) => setQuickSyncAchievement(e.target.checked)}
                />
                <span style={{ fontSize: 13, color: '#334155' }}>同步进展到本季季度成果</span>
                <Tooltip title="开启后，本次进展内容将追加到该项目关联的季度成果「成果描述」中">
                  <QuestionCircleOutlined style={{ color: '#9CA3AF', cursor: 'help' }} />
                </Tooltip>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default WeekPage;
