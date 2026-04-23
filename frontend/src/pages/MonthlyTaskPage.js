import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, InputNumber, Select, message, Tag, Progress, Drawer, Descriptions, Badge, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { STATUS_COLORS, getStatusStyle, getProgressColor } from '../utils/constants';
import DepartmentSelect from '../components/DepartmentSelect';

const { Option } = Select;
const { TextArea } = Input;

function MonthlyTaskPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [form] = Form.useForm();
  const { isAdmin, isDeptManager } = useAuth();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentQuarter = now.getMonth() < 3 ? 'Q1' : now.getMonth() < 6 ? 'Q2' : now.getMonth() < 9 ? 'Q3' : 'Q4';
  const [filters, setFilters] = useState({ month: currentMonth });

  useEffect(() => { fetchData(); }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/monthly-tasks', { params: filters });
      if (res.code === 0) setData(res.data);
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingRecord) { await api.put(`/monthly-tasks/${editingRecord.id}`, values); message.success('更新成功'); }
      else { await api.post('/monthly-tasks', values); message.success('创建成功'); }
      setModalVisible(false); setEditingRecord(null); form.resetFields(); fetchData();
    } catch (err) { message.error('操作失败'); }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/monthly-tasks/${id}`); message.success('删除成功'); fetchData(); }
    catch (err) { message.error('删除失败'); }
  };

  const showDetail = (record) => { setDetailRecord(record); setDrawerVisible(true); };

  const getStatusColor = (status) => getStatusStyle(status).tag;
  const getCompletionColor = (rate) => getProgressColor(rate);

  // 卡片视图
  const renderCardView = () => (
    <Row gutter={[16, 16]}>
      {data.length === 0 && (
        <Col span={24}><div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>暂无数据</div></Col>
      )}
      {data.map(item => (
        <Col xs={24} sm={12} lg={8} key={item.id}>
          <Card
            className="surface-card hover-lift"
            style={{ borderLeft: `4px solid ${getStatusStyle(item.status).border}` }}
            bodyStyle={{ padding: 20 }}
            actions={[
              <EyeOutlined key="view" onClick={() => showDetail(item)} />,
              ...(isDeptManager ? [
                <EditOutlined key="edit" onClick={() => handleEdit(item)} />,
                <Popconfirm key="del" title="确定删除该月度任务？" onConfirm={() => handleDelete(item.id)} okType="danger"><DeleteOutlined style={{ color: '#DC2626', cursor: 'pointer' }} /></Popconfirm>
              ] : [])
            ]}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, marginRight: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.task}
                </div>
                <div className="subtle-text" style={{ fontSize: 12 }}>{item.category}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Tag color={getStatusColor(item.status)}>{item.status}</Tag>
                {item.needs_followup && <Tag color="error">需跟进</Tag>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Tag style={{ margin: 0 }}>{item.Department?.name || '-'}</Tag>
              <Tag style={{ margin: 0 }}>{item.owner_name}</Tag>
            </div>

            <Progress percent={item.completion_rate} strokeColor={getCompletionColor(item.completion_rate)} size="small" style={{ marginBottom: 8 }} />

            {item.output && (
              <div className="subtle-text" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📦 {item.output}
              </div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );

  return (
    <div className="app-page">
      <PageHeader
        title="月度重点工作"
        subtitle={`${filters.month} · 来源于项目推进的月度重点事项`}
        extra={[
          <Input
            key="month"
            placeholder="月份筛选"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            style={{ width: 130 }}
          />,
          <Button
            key="view"
            icon={viewMode === 'card' ? <UnorderedListOutlined /> : <AppstoreOutlined />}
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
          >
            {viewMode === 'card' ? '列表' : '卡片'}
          </Button>,
          isDeptManager && (
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>
              新增工作
            </Button>
          ),
        ]}
      />

      {viewMode === 'card' ? renderCardView() : (
        <PanelCard>
          <div className="ant-table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>部门</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>月份</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>负责人</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>类别</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>工作事项</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>完成度</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>状态</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>标记</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #EEF2F7' }}>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.Department?.name}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.month}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.owner_name}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.category}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.task}</td>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.completion_rate}%</td>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}><Tag color={getStatusColor(item.status)}>{item.status}</Tag></td>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}>
                      {item.needs_followup && <Tag color="error">需跟进</Tag>}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 13 }}>
                      <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(item)}>详情</Button>
                      {isDeptManager && <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(item)}>编辑</Button>}
                      {isDeptManager && <Popconfirm title="确定删除该月度任务？" onConfirm={() => handleDelete(item.id)} okType="danger"><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}

      {/* 详情抽屉 */}
      <Drawer
        title={detailRecord?.task || '工作详情'}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDetailRecord(null); }}
        width={560}
        extra={isDeptManager && detailRecord ? (
          <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailRecord); }}>编辑</Button>
        ) : null}
      >
        {detailRecord && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <Tag color={getStatusColor(detailRecord.status)} style={{ fontSize: 14, padding: '2px 12px' }}>{detailRecord.status}</Tag>
              {detailRecord.needs_followup && <Tag color="error" style={{ fontSize: 14, padding: '2px 12px' }}>需跟进</Tag>}
              <Tag>{detailRecord.Department?.name}</Tag>
              <span className="subtle-text">{detailRecord.owner_name}</span>
              <span className="subtle-text" style={{ fontSize: 12 }}>{detailRecord.month}</span>
            </div>

            <Progress percent={detailRecord.completion_rate} strokeColor={getCompletionColor(detailRecord.completion_rate)} style={{ marginBottom: 24 }} />

            <Descriptions column={1} bordered size="small" labelStyle={{ fontWeight: 600, background: '#F8FAFC', width: 120 }}>
              <Descriptions.Item label="工作类别">{detailRecord.category}</Descriptions.Item>
              <Descriptions.Item label="工作目标"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.goal || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="实际完成"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.actual_result || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="成果/产出"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.output || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="亮点与问题"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.highlights || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="下月跟进"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.next_month_plan || '-'}</div></Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑工作' : '新增工作'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
        width={700}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="dept_id" label="部门" rules={[{ required: true }]} initialValue={1}>
                <DepartmentSelect />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="month" label="月份" rules={[{ required: true }]} initialValue={currentMonth}>
                <Input placeholder="格式：2026-04" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quarter" label="所属季度" rules={[{ required: true }]} initialValue={currentQuarter}>
                <Select><Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option></Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="工作类别" rules={[{ required: true }]}><Input placeholder="如：客户拓展、内容运营" /></Form.Item>
          <Form.Item name="task" label="工作事项" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item>
          <Form.Item name="goal" label="工作目标"><TextArea rows={4} /></Form.Item>
          <Form.Item name="actual_result" label="实际完成情况"><TextArea rows={4} /></Form.Item>
          <Form.Item name="output" label="成果/产出"><TextArea rows={4} /></Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="completion_rate" label="完成度" rules={[{ required: true }]} initialValue={0}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="未启动">
                <Select><Option value="未启动">未启动</Option><Option value="进行中">进行中</Option><Option value="风险">风险</Option><Option value="完成">完成</Option></Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="highlights" label="亮点与问题"><TextArea rows={4} /></Form.Item>
          <Form.Item name="next_month_plan" label="下月跟进"><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default MonthlyTaskPage;
