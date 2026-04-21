import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, InputNumber, Select, DatePicker, message, Tag, Progress, Drawer, Descriptions, Badge } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, EyeOutlined, UnorderedListOutlined, AppstoreOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import moment from 'moment';

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
  const [form] = Form.useForm();
  const { isAdmin, user } = useAuth();

  const now = new Date();
  const currentQuarter = now.getMonth() < 3 ? 'Q1' : now.getMonth() < 6 ? 'Q2' : now.getMonth() < 9 ? 'Q3' : 'Q4';
  const [filters, setFilters] = useState({ quarter: currentQuarter });

  useEffect(() => { fetchData(); }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects', { params: filters });
      if (res.code === 0) setData(res.data);
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = { ...values, due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null };
      if (editingRecord) {
        await api.put(`/projects/${editingRecord.id}`, payload);
        message.success('更新成功');
      } else {
        await api.post('/projects', payload);
        message.success('创建成功');
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

  const getStatusColor = (status) => {
    switch (status) {
      case '完成': return 'success';
      case '进行中': return 'processing';
      case '风险': return 'error';
      default: return 'default';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case '完成': return 'green';
      case '进行中': return 'blue';
      case '风险': return 'red';
      default: return 'gray';
    }
  };

  const getProgressColor = (pct) => {
    if (pct >= 80) return '#52c41a';
    if (pct >= 60) return '#faad14';
    return '#ff4d4f';
  };

  // ===== 卡片视图 =====
  const renderCardView = () => (
    <Row gutter={[16, 16]}>
      {data.length === 0 && (
        <Col span={24}><div style={{ textAlign: 'center', padding: 40, color: '#bfbfbf' }}>暂无数据</div></Col>
      )}
      {data.map(item => (
        <Col xs={24} sm={12} lg={8} xl={6} key={item.id}>
          <Card
            hoverable
            style={{ borderRadius: 12, borderLeft: `4px solid ${item.status === '风险' ? '#ff4d4f' : item.status === '完成' ? '#52c41a' : item.status === '进行中' ? '#1677ff' : '#d9d9d9'}` }}
            bodyStyle={{ padding: 20 }}
            actions={[
              <EyeOutlined key="view" onClick={() => showDetail(item)} />,
              ...(isAdmin ? [
                <EditOutlined key="edit" onClick={() => handleEdit(item)} />,
                <DeleteOutlined key="del" style={{ color: '#ff4d4f' }} onClick={() => handleDelete(item.id)} />
              ] : [])
            ]}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, marginRight: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#262626', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item.type}</div>
              </div>
              <Tag color={getStatusColor(item.status)}>{item.status}</Tag>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Tag style={{ margin: 0 }}>{item.Department?.name || '-'}</Tag>
              <Tag style={{ margin: 0 }}>{item.owner_name || '-'}</Tag>
              {item.is_risk && <Tag color="error" style={{ margin: 0 }}><WarningOutlined /> 风险</Tag>}
            </div>

            <Progress
              percent={item.progress_pct}
              strokeColor={getProgressColor(item.progress_pct)}
              size="small"
              style={{ marginBottom: 8 }}
            />

            {item.goal && (
              <div style={{ fontSize: 12, color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🎯 {item.goal}
              </div>
            )}

            {item.due_date && (
              <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 6 }}>
                截止：{item.due_date}
              </div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );

  // ===== 表格视图 =====
  const columns = [
    { title: '部门', dataIndex: ['Department', 'name'], key: 'dept', width: 90 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 110 },
    { title: '项目名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '负责人', dataIndex: 'owner_name', key: 'owner', width: 80 },
    { title: '进度', dataIndex: 'progress_pct', key: 'progress', width: 140, render: (pct, r) => <Progress percent={pct} strokeColor={getProgressColor(pct)} size="small" /> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s) => <Tag color={getStatusColor(s)}>{s}</Tag> },
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>重点工作追踪</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select value={filters.quarter} onChange={(v) => setFilters({ ...filters, quarter: v })} style={{ width: 100 }}>
            <Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option>
          </Select>
          <Button
            icon={viewMode === 'card' ? <UnorderedListOutlined /> : <AppstoreOutlined />}
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
          >
            {viewMode === 'card' ? '列表' : '卡片'}
          </Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>
              新增项目
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'card' ? renderCardView() : (
        <Card style={{ borderRadius: 12 }}>
          <div className="ant-table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{columns.map(c => <th key={c.key} style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 13 }}>{c.title}</th>)}</tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
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
        </Card>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Badge color={getStatusBadge(detailRecord.status)} />
              <Tag color={getStatusColor(detailRecord.status)} style={{ fontSize: 14, padding: '2px 12px' }}>{detailRecord.status}</Tag>
              <Tag>{detailRecord.Department?.name}</Tag>
              <span style={{ color: '#8c8c8c' }}>{detailRecord.owner_name}</span>
            </div>

            <Progress percent={detailRecord.progress_pct} strokeColor={getProgressColor(detailRecord.progress_pct)} style={{ marginBottom: 24 }} />

            <Descriptions column={2} bordered size="small" labelStyle={{ fontWeight: 600, background: '#fafafa' }}>
              <Descriptions.Item label="项目类型" span={1}>{detailRecord.type}</Descriptions.Item>
              <Descriptions.Item label="预计完成" span={1}>{detailRecord.due_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="工作目标" span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.goal || '-'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="本周进展" span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.weekly_progress || '-'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="本月累计" span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.monthly_progress || '-'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="本季进展" span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.quarterly_progress || '-'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="风险与问题" span={2}>
                <div style={{ whiteSpace: 'pre-wrap', color: detailRecord.risk_desc ? '#cf1322' : '#8c8c8c' }}>
                  {detailRecord.risk_desc || '无'}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑项目' : '新增项目'}
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
          <Form.Item name="type" label="项目类型" rules={[{ required: true }]}>
            <Input placeholder="如：新客拓展、渠道合作" />
          </Form.Item>
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="goal" label="工作目标"><TextArea rows={4} /></Form.Item>
          <Form.Item name="weekly_progress" label="本周进展"><TextArea rows={4} /></Form.Item>
          <Form.Item name="monthly_progress" label="本月累计"><TextArea rows={4} /></Form.Item>
          <Form.Item name="quarterly_progress" label="本季进展"><TextArea rows={4} /></Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="progress_pct" label="进度%" rules={[{ required: true }]} initialValue={0}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="未启动">
                <Select><Option value="未启动">未启动</Option><Option value="进行中">进行中</Option><Option value="风险">风险</Option><Option value="完成">完成</Option></Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="due_date" label="预计完成时间">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="risk_desc" label="风险与问题"><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ProjectPage;
