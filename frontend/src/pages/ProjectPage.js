import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, InputNumber, Select, message, Tag, Progress, Drawer, Descriptions, Badge, Tabs, Tooltip, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, EyeOutlined, UnorderedListOutlined, AppstoreOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { STATUS_COLORS, defaultStatusColor, getStatusStyle, getProgressColor } from '../utils/constants';

const { Option } = Select;
const { TextArea } = Input;

function ProjectPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [activeTab, setActiveTab] = useState('current');
  const [sortMode, setSortMode] = useState('priority'); // priority | time
  const [form] = Form.useForm();
  const { isAdmin, user } = useAuth();
  // 就地更新状态
  const [editingProgressId, setEditingProgressId] = useState(null);
  const [editingProgressValue, setEditingProgressValue] = useState(0);
  const [quickUpdateVisible, setQuickUpdateVisible] = useState(false);
  const [quickUpdateItem, setQuickUpdateItem] = useState(null);
  const [quickWeeklyProgress, setQuickWeeklyProgress] = useState('');

  const now = new Date();
  const currentQuarter = now.getMonth() < 3 ? 'Q1' : now.getMonth() < 6 ? 'Q2' : now.getMonth() < 9 ? 'Q3' : 'Q4';
  const [filters, setFilters] = useState({ quarter: currentQuarter });

  const getNextWeekRange = () => {
    const today = moment();
    const dayOfWeek = today.isoWeekday();
    const nextMonday = today.clone().add(8 - dayOfWeek, 'days');
    const nextSunday = nextMonday.clone().add(6, 'days');
    return { start: nextMonday.format('YYYY-MM-DD'), end: nextSunday.format('YYYY-MM-DD') };
  };
  const nextWeek = getNextWeekRange();

  useEffect(() => { fetchData(); }, [filters, activeTab, sortMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (activeTab === 'nextweek') {
        params.type = '下周重点';
      }
      if (sortMode === 'priority') {
        params.sort = 'priority';
      }
      const res = await api.get('/projects', { params });
      if (res.code === 0) setData(res.data);
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const isNextWeek = activeTab === 'nextweek';
      const payload = {
        ...values,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : (isNextWeek ? nextWeek.end : null),
        ...(isNextWeek && !editingRecord ? { type: '下周重点', status: values.status || '进行中', progress_pct: values.progress_pct || 0 } : {}),
      };
      // 清理辅助字段
      delete payload.is_monthly_focus;
      delete payload.is_quarter_achievement;
      delete payload.achievement_type;
      delete payload.achievement_result;

      if (editingRecord) {
        await api.put(`/projects/${editingRecord.id}`, payload);
        message.success('更新成功');
      } else {
        await api.post('/projects', payload);
        message.success('项目创建成功');

        // 如果勾选了"标记为月度重点工作"，同时创建月度任务
        if (values.is_monthly_focus) {
          try {
            const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            await api.post('/monthly-tasks', {
              dept_id: values.dept_id,
              month: currentMonth,
              quarter: values.quarter,
              owner_name: values.owner_name,
              category: values.type || '项目关联',
              task: values.name,
              goal: values.goal || '',
              status: '进行中',
              completion_rate: values.progress_pct || 0,
            });
            message.success('已同步创建月度重点工作');
          } catch (err) {
            message.warning('月度重点工作创建失败，请手动补充');
          }
        }

        // 如果勾选了"标记为季度成果"，同时创建季度成果
        if (values.is_quarter_achievement) {
          try {
            await api.post('/achievements', {
              dept_id: values.dept_id,
              quarter: values.quarter,
              owner_name: values.owner_name,
              project_name: values.name,
              achievement_type: values.achievement_type || '项目关联成果',
              priority: '中',
              description: values.goal || '',
              quantified_result: values.achievement_result || '',
            });
            message.success('已同步创建季度成果');
          } catch (err) {
            message.warning('季度成果创建失败，请手动补充');
          }
        }
      }
      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData();
    } catch (err) { message.error('操作失败'); }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, due_date: record.due_date ? moment(record.due_date) : null });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/projects/${id}`); message.success('删除成功'); fetchData(); }
    catch (err) { message.error('删除失败'); }
  };

  const showDetail = (record) => {
    setDetailRecord(record);
    setDrawerVisible(true);
  };

  // 进度条点击就地更新
  const handleProgressClick = (item) => {
    if (!isAdmin) return;
    setEditingProgressId(item.id);
    setEditingProgressValue(item.progress_pct);
  };

  const handleProgressSave = async (id) => {
    try {
      await api.put(`/projects/${id}/quick-update`, { progress_pct: editingProgressValue });
      message.success('进度更新成功');
      setEditingProgressId(null);
      fetchData();
    } catch (err) {
      message.error('更新失败');
    }
  };

  // 快速更新本周进展
  const handleQuickUpdate = async () => {
    if (!quickUpdateItem || !quickWeeklyProgress.trim()) return;
    try {
      await api.put(`/projects/${quickUpdateItem.id}/quick-update`, { weekly_progress: quickWeeklyProgress });
      message.success('本周进展更新成功');
      setQuickUpdateVisible(false);
      setQuickUpdateItem(null);
      setQuickWeeklyProgress('');
      fetchData();
    } catch (err) {
      message.error('更新失败');
    }
  };

  const isNextWeek = activeTab === 'nextweek';

  // ===== 卡片视图 — 更像项目面板 =====
  const renderCardView = () => (
    <Row gutter={[16, 16]}>
      {data.length === 0 && (
        <Col span={24}>
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
            {isNextWeek ? <ThunderboltOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} /> : null}
            {isNextWeek ? '暂无下周重点工作，点击右上角录入' : '暂无数据'}
          </div>
        </Col>
      )}
      {data.map(item => {
        const sc = getStatusStyle(item.status);
        return (
          <Col xs={24} sm={12} lg={8} xl={6} key={item.id}>
            <Card
              className="surface-card hover-lift"
              style={{ borderLeft: `3px solid ${sc.border}`, height: '100%' }}
              bodyStyle={{ padding: 20 }}
              actions={[
                <EyeOutlined key="view" onClick={() => showDetail(item)} />,
                ...(isAdmin ? [
                  <EditOutlined key="edit" onClick={() => handleEdit(item)} />,
                  <DeleteOutlined key="del" style={{ color: '#DC2626' }} onClick={() => handleDelete(item.id)} />
                ] : [])
              ]}
            >
              {/* 项目名 + 状态 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ flex: 1, marginRight: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                </div>
                <Tag color={sc.tag}>{item.status}</Tag>
              </div>

              {/* 负责人 + 截止 — 2个核心信息 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: 13 }}>
                <span className="subtle-text">👤 {item.owner_name || '-'}</span>
                {item.due_date && (
                  <span className="subtle-text" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    截止 {item.due_date}
                    {item.days_until_due !== undefined && (
                      <Tag color={item.days_until_due < 0 ? 'error' : item.days_until_due <= 3 ? 'warning' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                        {item.days_until_due < 0 ? `逾期${Math.abs(item.days_until_due)}天` : item.days_until_due === 0 ? '今天到期' : `剩${item.days_until_due}天`}
                      </Tag>
                    )}
                  </span>
                )}
              </div>

              {/* 进度条（本周）— 点击可就地编辑 */}
              {!isNextWeek && (
                editingProgressId === item.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <InputNumber
                      min={0} max={100}
                      value={editingProgressValue}
                      onChange={(v) => setEditingProgressValue(v)}
                      size="small"
                      style={{ width: 70 }}
                      onPressEnter={() => handleProgressSave(item.id)}
                    />
                    <span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
                    <Button type="link" size="small" onClick={() => handleProgressSave(item.id)}>保存</Button>
                    <Button type="link" size="small" onClick={() => setEditingProgressId(null)}>取消</Button>
                  </div>
                ) : (
                  <Tooltip title={isAdmin ? '点击编辑进度' : ''}>
                    <div onClick={() => handleProgressClick(item)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>
                      <Progress
                        percent={item.progress_pct}
                        strokeColor={getProgressColor(item.progress_pct)}
                        trailColor="#F1F5F9"
                        size="small"
                        style={{ marginBottom: 10 }}
                      />
                    </div>
                  </Tooltip>
                )
              )}

              {/* 本周进展摘要 — 点击可快速更新 */}
              {!isNextWeek && item.weekly_progress && (
                <Tooltip title={isAdmin ? '点击快速更新' : ''}>
                  <div
                    onClick={() => isAdmin && (setQuickUpdateItem(item), setQuickWeeklyProgress(item.weekly_progress || ''), setQuickUpdateVisible(true))}
                    style={{ background: '#F5F7FB', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#6B7280', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: isAdmin ? 'pointer' : 'default' }}
                  >
                    📝 {item.weekly_progress}
                  </div>
                </Tooltip>
              )}
              {!isNextWeek && !item.weekly_progress && isAdmin && (
                <Button type="dashed" size="small" block style={{ marginBottom: 8, fontSize: 12 }} onClick={() => { setQuickUpdateItem(item); setQuickWeeklyProgress(''); setQuickUpdateVisible(true); }}>
                  + 补充本周进展
                </Button>
              )}

              {/* 目标 — 一行概括 */}
              {item.goal && (
                <div className="subtle-text" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎯 {item.goal}
                </div>
              )}

              {/* 下周计划摘要 */}
              {item.weekly_progress && isNextWeek && (
                <div style={{ background: '#F5F7FB', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#6B7280', marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {item.weekly_progress}
                </div>
              )}

              {/* 底部时间标签行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {item.updated_at && (
                    <span className="subtle-text" style={{ fontSize: 11 }}>
                      🕐 {moment(item.updated_at).fromNow()}
                    </span>
                  )}
                  {/* 长期未更新提醒 — 替代纯"7天内到期"逻辑 */}
                  {item.updated_at && (() => {
                    const daysSince = moment().diff(moment(item.updated_at), 'days');
                    if (daysSince >= 14 && item.status !== '完成') return <Tag color="error" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>🚨 {daysSince}天未更新</Tag>;
                    if (daysSince >= 10 && item.status !== '完成') return <Tag color="orange" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>⚠ {daysSince}天未更新</Tag>;
                    if (daysSince >= 7 && item.status !== '完成') return <Tag color="default" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>💤 {daysSince}天未更新</Tag>;
                    return null;
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {item.is_risk && <Tag color="error" style={{ margin: 0, fontSize: 11 }}><WarningOutlined /> 风险</Tag>}
                  {item.is_due_soon && !item.is_risk && <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>⏰ 临期</Tag>}
                </div>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );

  // ===== 表格视图 =====
  const columns = [
    { title: '部门', dataIndex: ['Department', 'name'], key: 'dept', width: 90 },
    ...(isNextWeek ? [] : [{ title: '类型', dataIndex: 'type', key: 'type', width: 110 }]),
    { title: '项目名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '负责人', dataIndex: 'owner_name', key: 'owner', width: 80 },
    ...(isNextWeek ? [] : [{ title: '进度', dataIndex: 'progress_pct', key: 'progress', width: 140, render: (pct) => <Progress percent={pct} strokeColor={getProgressColor(pct)} size="small" /> }]),
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s) => <Tag color={getStatusStyle(s).tag}>{s}</Tag> },
    { title: '截止', dataIndex: 'due_date', key: 'due', width: 100 },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right',
      render: (_, r) => (
        <span>
          <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(r)}>详情</Button>
          {isAdmin && <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>}
          {isAdmin && <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>删除</Button>}
        </span>
      )
    }
  ];

  return (
    <div className="app-page">
      <PageHeader
        title="项目推进"
        subtitle="项目数据的唯一维护入口 · 其他页面的项目信息均自动引用此处数据"
        extra={[
          <Select key="q" value={filters.quarter} onChange={(v) => setFilters({ ...filters, quarter: v })} style={{ width: 100 }}>
            <Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option>
          </Select>,
          <Select key="sort" value={sortMode} onChange={(v) => setSortMode(v)} style={{ width: 120 }}>
            <Option value="priority">管理优先级</Option>
            <Option value="time">更新时间</Option>
          </Select>,
          <Button
            key="view"
            icon={viewMode === 'card' ? <UnorderedListOutlined /> : <AppstoreOutlined />}
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
          >
            {viewMode === 'card' ? '列表' : '卡片'}
          </Button>,
          isAdmin && (
            <Button key="add" type="primary" icon={isNextWeek ? <ThunderboltOutlined /> : <PlusOutlined />} onClick={() => {
              setEditingRecord(null);
              form.resetFields();
              if (isNextWeek) {
                form.setFieldsValue({ dept_id: 1, status: '进行中', progress_pct: 0, quarter: currentQuarter });
              }
              setModalVisible(true);
            }}>
              {isNextWeek ? '录入下周重点' : '新增项目'}
            </Button>
          ),
        ]}
      />

      {/* Tab 切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'current',
            label: '📋 本周重点',
          },
          {
            key: 'nextweek',
            label: (
              <span>
                <ThunderboltOutlined /> 下周重点
                <span className="subtle-text" style={{ fontSize: 11, marginLeft: 6 }}>
                  {nextWeek.start} ~ {nextWeek.end}
                </span>
              </span>
            ),
          },
        ]}
      />

      {viewMode === 'card' ? renderCardView() : (
        <PanelCard>
          <div className="ant-table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{columns.map(c => <th key={c.key} style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>{c.title}</th>)}</tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #EEF2F7' }}>
                    {columns.map(c => (
                      <td key={c.key} style={{ padding: '10px 8px', fontSize: 13 }}>
                        {c.render ? c.render(item[c.dataIndex], item) : (c.dataIndex instanceof Array ? item[c.dataIndex[0]]?.[c.dataIndex[1]] : item[c.dataIndex])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}

      {/* 详情抽屉 */}
      <Drawer
        title={detailRecord?.name || '项目详情'}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDetailRecord(null); }}
        width={560}
        extra={isAdmin && detailRecord ? (
          <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailRecord); }}>编辑</Button>
        ) : null}
      >
        {detailRecord && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Badge color={getStatusStyle(detailRecord.status).dot} />
              <Tag color={getStatusStyle(detailRecord.status).tag} style={{ fontSize: 14, padding: '2px 12px' }}>{detailRecord.status}</Tag>
              <Tag>{detailRecord.Department?.name}</Tag>
              <span className="subtle-text">{detailRecord.owner_name}</span>
            </div>

            {!isNextWeek && (
              <Progress percent={detailRecord.progress_pct} strokeColor={getProgressColor(detailRecord.progress_pct)} style={{ marginBottom: 24 }} />
            )}

            <Descriptions column={2} bordered size="small" labelStyle={{ fontWeight: 600, background: '#F8FAFC', color: '#334155' }}>
              <Descriptions.Item label="项目类型" span={1}>{detailRecord.type}</Descriptions.Item>
              <Descriptions.Item label="预计完成" span={1}>
                {detailRecord.due_date || '-'}
                {detailRecord.days_until_due !== undefined && (
                  <Tag color={detailRecord.days_until_due < 0 ? 'error' : detailRecord.days_until_due <= 3 ? 'warning' : 'default'} style={{ marginLeft: 8, fontSize: 11 }}>
                    {detailRecord.days_until_due < 0 ? `逾期${Math.abs(detailRecord.days_until_due)}天` : detailRecord.days_until_due === 0 ? '今天到期' : `剩${detailRecord.days_until_due}天`}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="工作目标" span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.goal || '-'}</div>
              </Descriptions.Item>
              <Descriptions.Item label={isNextWeek ? '计划/进展' : '本周进展'} span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.weekly_progress || '-'}</div>
              </Descriptions.Item>
              {!isNextWeek && (
                <>
                  <Descriptions.Item label="本月累计" span={2}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.monthly_progress || '-'}</div>
                  </Descriptions.Item>
                  <Descriptions.Item label="本季进展" span={2}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.quarterly_progress || '-'}</div>
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="风险与问题" span={2}>
                <div style={{ whiteSpace: 'pre-wrap', color: detailRecord.risk_desc ? '#DC2626' : '#9CA3AF' }}>
                  {detailRecord.risk_desc || '无'}
                </div>
              </Descriptions.Item>
              {/* 闭环信息行 */}
              <Descriptions.Item label="上次更新" span={1}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{detailRecord.updated_at ? moment(detailRecord.updated_at).fromNow() : '-'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="状态标记" span={1}>
                <span>
                  {detailRecord.is_risk && <Tag color="error" style={{ marginRight: 4 }}>🔴 风险</Tag>}
                  {detailRecord.is_due_soon && <Tag color="warning" style={{ marginRight: 4 }}>⏰ 临期</Tag>}
                  {detailRecord.severe_warning && <Tag color="error">⚠ 严重预警</Tag>}
                  {!detailRecord.is_risk && !detailRecord.is_due_soon && !detailRecord.severe_warning && <Tag>正常</Tag>}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑项目' : (isNextWeek ? '录入下周重点工作' : '新增项目')}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
        width={700}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dept_id" label="部门" rules={[{ required: true }]} initialValue={1}>
                <Select><Option value={1}>拓展组</Option><Option value={2}>运营组</Option></Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quarter" label="所属季度" rules={[{ required: true }]} initialValue={currentQuarter}>
                <Select><Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option></Select>
              </Form.Item>
            </Col>
          </Row>
          {!isNextWeek && (
            <Form.Item name="type" label="项目类型" rules={[{ required: true }]}>
              <Input placeholder="如：新客拓展、渠道合作" />
            </Form.Item>
          )}
          <Form.Item name="name" label={isNextWeek ? '工作名称' : '项目名称'} rules={[{ required: true }]}>
            <Input placeholder={isNextWeek ? '下周重点推进的工作' : '项目名称'} />
          </Form.Item>
          <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="goal" label="工作目标"><TextArea rows={3} placeholder="预期达成的目标" /></Form.Item>
          <Form.Item name="weekly_progress" label={isNextWeek ? '当前进展/计划' : '本周进展'}>
            <TextArea rows={3} placeholder={isNextWeek ? '当前进展或下周具体计划' : '本周进展'} />
          </Form.Item>
          {!isNextWeek && (
            <>
              <Form.Item name="monthly_progress" label="本月累计"><TextArea rows={3} /></Form.Item>
              <Form.Item name="quarterly_progress" label="本季进展"><TextArea rows={3} /></Form.Item>
            </>
          )}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="progress_pct" label="进度%" initialValue={0}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" initialValue="进行中">
                <Select><Option value="未启动">未启动</Option><Option value="进行中">进行中</Option><Option value="风险">风险</Option><Option value="完成">完成</Option></Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="due_date" label="预计完成时间">
                {isNextWeek ? (
                  <Input disabled value={nextWeek.end} />
                ) : (
                  <Input disabled value="" />
                )}
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="risk_desc" label="风险与问题"><TextArea rows={3} /></Form.Item>
          {/* 月度/季度关联 — 仅新增时显示 */}
          {!editingRecord && !isNextWeek && (
            <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 16, marginTop: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#3B5AFB', marginBottom: 12 }}>📋 数据关联（可选）</div>
              <Form.Item name="is_monthly_focus" valuePropName="checked" initialValue={false} style={{ marginBottom: 8 }}>
                <Checkbox>同步创建为<strong>月度重点工作</strong></Checkbox>
              </Form.Item>
              <Form.Item name="is_quarter_achievement" valuePropName="checked" initialValue={false} style={{ marginBottom: 8 }}>
                <Checkbox>同步创建为<strong>季度成果</strong></Checkbox>
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.is_quarter_achievement !== cur.is_quarter_achievement}>
                {({ getFieldValue }) => getFieldValue('is_quarter_achievement') ? (
                  <div style={{ paddingLeft: 24 }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="achievement_type" label="成果类型" style={{ marginBottom: 8 }}>
                          <Input placeholder="如：流程优化、工具开发" size="small" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="achievement_result" label="量化结果" style={{ marginBottom: 8 }}>
                          <Input placeholder="如：签约周期缩短40%" size="small" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ) : null}
              </Form.Item>
              <div className="subtle-text" style={{ fontSize: 11, marginTop: 4 }}>
                💡 勾选后系统会自动在对应模块创建关联记录，无需重复录入
              </div>
            </div>
          )}
        </Form>
      </Modal>

      {/* 快速更新本周进展抽屉 */}
      <Drawer
        title={quickUpdateItem ? `快速更新：${quickUpdateItem.name}` : '快速更新'}
        open={quickUpdateVisible}
        onClose={() => { setQuickUpdateVisible(false); setQuickUpdateItem(null); setQuickWeeklyProgress(''); }}
        width={480}
        extra={<Button type="primary" onClick={handleQuickUpdate}>保存</Button>}
      >
        {quickUpdateItem && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <Tag color={getStatusStyle(quickUpdateItem.status).tag}>{quickUpdateItem.status}</Tag>
              <Tag>{quickUpdateItem.Department?.name}</Tag>
              <span className="subtle-text">{quickUpdateItem.owner_name}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Progress percent={quickUpdateItem.progress_pct} strokeColor={getProgressColor(quickUpdateItem.progress_pct)} />
            </div>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>本周进展</div>
            <TextArea
              rows={4}
              value={quickWeeklyProgress}
              onChange={(e) => setQuickWeeklyProgress(e.target.value)}
              placeholder="输入本周进展..."
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default ProjectPage;
