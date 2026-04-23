import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Tag, Progress, Spin, Empty, Input, message, Badge, Drawer } from 'antd';
import { ClockCircleOutlined, AlertOutlined, ExclamationCircleOutlined, EditOutlined, WarningOutlined, FormOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { getStatusStyle, getProgressColor } from '../utils/constants';

function TodayPage() {
  const { isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayChanges, setTodayChanges] = useState([]);
  const [staleProjects, setStaleProjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [quickEditVisible, setQuickEditVisible] = useState(false);
  const [quickEditItem, setQuickEditItem] = useState(null);
  const [quickProgress, setQuickProgress] = useState('');

  const today = moment().format('YYYY年M月D日 dddd');

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [changesRes, staleRes, projectsRes] = await Promise.all([
        api.get('/dashboard/today-changes'),
        api.get('/projects/stale', { params: { days: 3 } }),
        api.get('/projects', { params: { sort: 'priority' } }),
      ]);
      if (changesRes.code === 0) setTodayChanges(changesRes.data);
      if (staleRes.code === 0) setStaleProjects(staleRes.data);
      if (projectsRes.code === 0) setProjects(projectsRes.data);
    } catch (err) {
      message.error('加载今日数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 快速更新
  const handleQuickUpdate = async () => {
    if (!quickEditItem || !quickProgress.trim()) return;
    try {
      await api.put(`/projects/${quickEditItem.id}/quick-update`, { weekly_progress: quickProgress });
      message.success('更新成功');
      setQuickEditVisible(false);
      setQuickEditItem(null);
      setQuickProgress('');
      fetchAllData();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || '更新失败');
    }
  };

  // 今日到期项目
  const todayDueProjects = projects.filter(p => {
    if (!p.due_date || p.status === '完成') return false;
    return moment().diff(moment(p.due_date), 'days') >= 0 && moment().diff(moment(p.due_date), 'days') <= 0;
  });

  // 长期未更新项目 — 分级：7天/10天/14天/14天以上
  const getStaleLevel = (days) => {
    if (days >= 14) return { label: `${days}天未更新`, level: 'critical', color: '#DC2626', bg: '#FEF2F2' };
    if (days >= 10) return { label: `${days}天未更新`, level: 'warning', color: '#EA580C', bg: '#FFF7ED' };
    if (days >= 7) return { label: `${days}天未更新`, level: 'caution', color: '#D97706', bg: '#FFFBEB' };
    return { label: `${days}天未更新`, level: 'notice', color: '#6B7280', bg: '#F9FAFB' };
  };

  // 今日变化渲染
  const renderTodayChanges = () => {
    if (todayChanges.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
          <ClockCircleOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: 13 }}>今日暂无数据变更</div>
        </div>
      );
    }
    return todayChanges.slice(0, 30).map((c, idx) => {
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

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div className="app-page">
      <PageHeader
        title="今日更新"
        subtitle={`${today} · 日更新节奏 · 快速录入与提醒`}
        extra={[
          <Button key="refresh" onClick={fetchAllData}>刷新</Button>,
        ]}
      />

      {/* 今日提醒摘要 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">今日到期</div>
            <div className="metric-value" style={{ color: todayDueProjects.length > 0 ? '#DC2626' : '#16A34A' }}>{todayDueProjects.length}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>{todayDueProjects.length > 0 ? '需关注' : '无到期'}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">风险项目</div>
            <div className="metric-value" style={{ color: projects.filter(p => p.is_risk).length > 0 ? '#DC2626' : '#16A34A' }}>{projects.filter(p => p.is_risk).length}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>{projects.filter(p => p.is_risk).length > 0 ? '需关注' : '无风险'}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">待更新</div>
            <div className="metric-value" style={{ color: staleProjects.length > 0 ? '#F59E0B' : '#16A34A' }}>{staleProjects.length}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>超3天未更新</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <div className="metric-label">数据变更</div>
            <div className="metric-value" style={{ color: '#3B5AFB' }}>{todayChanges.length}</div>
            <div className="subtle-text" style={{ fontSize: 11 }}>条操作记录</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 左列：今日变更流 + 今日到期 */}
        <Col xs={24} lg={14}>
          {/* 今日变更 */}
          <PanelCard
            title={<span><ClockCircleOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />操作记录</span>}
            subtitle="系统操作日志 · 非工作提醒"
            extra={todayChanges.length > 0 && <Badge count={todayChanges.length} style={{ backgroundColor: '#9CA3AF' }} />}
            style={{ marginBottom: 16 }}
          >
            {renderTodayChanges()}
          </PanelCard>

          {/* 今日到期 */}
          {todayDueProjects.length > 0 && (
            <PanelCard
              title={<span><AlertOutlined style={{ color: '#DC2626', marginRight: 8 }} />今日到期</span>}
              subtitle="来源于项目截止日期"
              style={{ marginBottom: 16 }}
            >
              {todayDueProjects.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FEF2F2', borderRadius: 8, marginBottom: 8 }}>
                  <Tag color="error" style={{ margin: 0 }}>今日到期</Tag>
                  <span style={{ flex: 1, fontWeight: 500, color: '#111827' }}>{p.name}</span>
                  <span className="subtle-text">{p.owner_name}</span>
                </div>
              ))}
            </PanelCard>
          )}
        </Col>

        {/* 右列：待更新 + 长期未更新 */}
        <Col xs={24} lg={10}>
          {/* 今日待更新 */}
          <PanelCard
            title={<span><ExclamationCircleOutlined style={{ color: '#F59E0B', marginRight: 8 }} />待更新项目</span>}
            subtitle="超3天未更新 · 来源于项目推进"
            style={{ marginBottom: 16 }}
          >
            {staleProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>所有项目均近期更新 ✌️</div>
            ) : (
              staleProjects.map(p => {
                const sl = getStaleLevel(p.days_since_update);
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: sl.bg, borderRadius: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>💤</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                      <div className="subtle-text" style={{ fontSize: 11 }}>{p.Department?.name} · {p.owner_name}</div>
                    </div>
                    <Tag color={sl.level === 'critical' ? 'error' : sl.level === 'warning' ? 'orange' : 'warning'} style={{ fontSize: 11 }}>
                      {sl.label}
                    </Tag>
                    {isAdmin && (
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setQuickEditItem(p); setQuickProgress(p.weekly_progress || ''); setQuickEditVisible(true); }}>
                        更新
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </PanelCard>

          {/* 快捷操作提示 */}
          <PanelCard title={<span><FormOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />快捷操作</span>}>
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 2 }}>
              <div>📌 <strong>今日更新</strong>：查看变更、到期、待更新提醒</div>
              <div>📝 <strong>项目推进</strong>：维护项目进度、状态、风险（唯一填写入口）</div>
              <div>📋 <strong>本周管理</strong>：查看本周重点与风险汇总（自动生成）</div>
              <div>📊 <strong>周报与复盘</strong>：输出本周总结（自动生成，可补充管理评语）</div>
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#F0F4FF', borderRadius: 8, fontSize: 12, color: '#3B5AFB' }}>
              💡 标注"自动生成"的内容来源于项目推进页的维护数据，无需重复填写
            </div>
          </PanelCard>
        </Col>
      </Row>

      {/* 快速更新抽屉 */}
      <Drawer
        title={quickEditItem ? `快速更新：${quickEditItem.name}` : '快速更新'}
        open={quickEditVisible}
        onClose={() => { setQuickEditVisible(false); setQuickEditItem(null); setQuickProgress(''); }}
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
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>本周进展 <span className="subtle-text" style={{ fontWeight: 400, fontSize: 11 }}>（在项目推进页统一维护）</span></div>
            <Input.TextArea
              rows={4}
              value={quickProgress}
              onChange={(e) => setQuickProgress(e.target.value)}
              placeholder="输入本周进展..."
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default TodayPage;
