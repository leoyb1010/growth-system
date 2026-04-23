import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, Select, DatePicker, Checkbox, message, Tag, Drawer, Descriptions, Table, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, TrophyOutlined, AppstoreOutlined, UnorderedListOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import DepartmentSelect from '../components/DepartmentSelect';

const { Option } = Select;
const { TextArea } = Input;

function AchievementPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [archives, setArchives] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [form] = Form.useForm();
  const { isAdmin, isDeptManager } = useAuth();

  const now = new Date();
  const currentQuarter = now.getMonth() < 3 ? 'Q1' : now.getMonth() < 6 ? 'Q2' : now.getMonth() < 9 ? 'Q3' : 'Q4';
  const [filters, setFilters] = useState({ quarter: '', priority: '', owner_name: '' });

  useEffect(() => { fetchData(); }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.quarter) params.quarter = filters.quarter;
      if (filters.priority) params.priority = filters.priority;
      if (filters.owner_name) params.owner_name = filters.owner_name;
      const res = await api.get('/achievements', { params });
      if (res.code === 0) setData(res.data);
    } catch (err) { message.error('获取数据失败'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = { ...values, completed_at: values.completed_at ? values.completed_at.format('YYYY-MM-DD') : null };
      if (editingRecord) { await api.put(`/achievements/${editingRecord.id}`, payload); message.success('更新成功'); }
      else { await api.post('/achievements', payload); message.success('创建成功'); }
      setModalVisible(false); setEditingRecord(null); form.resetFields(); fetchData();
    } catch (err) { message.error(err?.response?.data?.message || err?.message || '操作失败'); }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, completed_at: record.completed_at ? moment(record.completed_at) : null });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/achievements/${id}`); message.success('删除成功'); fetchData(); }
    catch (err) { message.error(err?.response?.data?.message || err?.message || '删除失败'); }
  };

  const showDetail = (record) => { setDetailRecord(record); setDrawerVisible(true); };

  // 季度归档
  const fetchArchives = async () => {
    setArchiveLoading(true);
    try {
      const res = await api.get('/archives');
      if (res.code === 0) setArchives(res.data);
    } catch (err) { message.error('获取归档列表失败'); }
    finally { setArchiveLoading(false); }
  };

  const handleCreateArchive = async () => {
    try {
      const res = await api.post('/archives', {});
      if (res.code === 0) {
        message.success('归档创建成功');
        fetchArchives();
      }
    } catch (err) {
      message.error('归档失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteArchive = async (id) => {
    try {
      await api.delete(`/archives/${id}`);
      message.success('归档删除成功');
      fetchArchives();
    } catch (err) { message.error('删除失败'); }
  };

  const openArchiveModal = () => {
    setArchiveModalVisible(true);
    fetchArchives();
  };

  const getPriorityColor = (p) => p === '高' ? '#DC2626' : p === '中' ? '#F59E0B' : '#9CA3AF';
  const getPriorityTag = (p) => p === '高' ? 'error' : p === '中' ? 'warning' : 'default';

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
            style={{ borderLeft: `4px solid ${getPriorityColor(item.priority)}` }}
            bodyStyle={{ padding: 20 }}
            actions={[
              <EyeOutlined key="view" onClick={() => showDetail(item)} />,
              ...(isDeptManager ? [
                <EditOutlined key="edit" onClick={() => handleEdit(item)} />,
                <Popconfirm key="del" title="确定删除该成果？" onConfirm={() => handleDelete(item.id)} okType="danger"><DeleteOutlined style={{ color: '#DC2626', cursor: 'pointer' }} /></Popconfirm>
              ] : [])
            ]}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, marginRight: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.project_name}
                </div>
                <div className="subtle-text" style={{ fontSize: 12 }}>{item.achievement_type}</div>
              </div>
              <Tag color={getPriorityTag(item.priority)}>{item.priority}</Tag>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Tag style={{ margin: 0 }}>{item.Department?.name || '-'}</Tag>
              <Tag style={{ margin: 0 }}>{item.owner_name}</Tag>
              {item.include_next_quarter && <Tag color="success" style={{ margin: 0 }}>→ 下季</Tag>}
            </div>

            {item.quantified_result && (
              <div className="subtle-text" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📊 {item.quantified_result}
              </div>
            )}

            {item.completed_at && (
              <div className="subtle-text" style={{ fontSize: 11, marginTop: 6 }}>
                完成：{item.completed_at}
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
        title="季度成果沉淀"
        subtitle="来源于项目推进的季度成果记录"
        extra={[
          <Select key="q" placeholder="季度" allowClear value={filters.quarter || undefined} onChange={(v) => setFilters({ ...filters, quarter: v || '' })} style={{ width: 100 }}>
            <Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option>
          </Select>,
          <Select key="p" placeholder="优先级" allowClear value={filters.priority || undefined} onChange={(v) => setFilters({ ...filters, priority: v || '' })} style={{ width: 100 }}>
            <Option value="高">高</Option><Option value="中">中</Option><Option value="低">低</Option>
          </Select>,
          <Button key="view" icon={viewMode === 'card' ? <UnorderedListOutlined /> : <AppstoreOutlined />} onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}>
            {viewMode === 'card' ? '列表' : '卡片'}
          </Button>,
          isDeptManager && (
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>
              新增成果
            </Button>
          ),
          isDeptManager && (
            <Button key="archive" icon={<SafetyCertificateOutlined />} onClick={openArchiveModal}>
              季度归档
            </Button>
          ),
        ]}
      />

      {viewMode === 'card' ? renderCardView() : (
        <PanelCard>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>部门</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>项目</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>负责人</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>优先级</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>量化结果</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #EEF2F7' }}>
                  <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.Department?.name}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.project_name}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13 }}>{item.owner_name}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13 }}><Tag color={getPriorityTag(item.priority)}>{item.priority}</Tag></td>
                  <td style={{ padding: '10px 8px', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.quantified_result}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13 }}>
                    <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(item)}>详情</Button>
                    {isDeptManager && <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(item)}>编辑</Button>}
                    {isDeptManager && <Popconfirm title="确定删除该成果？" onConfirm={() => handleDelete(item.id)} okType="danger"><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PanelCard>
      )}

      {/* 详情抽屉 */}
      <Drawer
        title={detailRecord?.project_name || '成果详情'}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDetailRecord(null); }}
        width={560}
        extra={isDeptManager && detailRecord ? (
          <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailRecord); }}>编辑</Button>
        ) : null}
      >
        {detailRecord && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Tag color={getPriorityTag(detailRecord.priority)} style={{ fontSize: 14, padding: '2px 12px' }}>{detailRecord.priority}优先级</Tag>
              <Tag>{detailRecord.Department?.name}</Tag>
              <span className="subtle-text">{detailRecord.owner_name}</span>
              {detailRecord.include_next_quarter && <Tag color="success">纳入下季</Tag>}
            </div>

            <Descriptions column={1} bordered size="small" labelStyle={{ fontWeight: 600, background: '#F8FAFC', width: 120 }}>
              <Descriptions.Item label="成果类型">{detailRecord.achievement_type}</Descriptions.Item>
              <Descriptions.Item label="季度">{detailRecord.quarter}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{detailRecord.completed_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="成果描述"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.description || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="量化结果"><div style={{ whiteSpace: 'pre-wrap', color: '#3B5AFB', fontWeight: 500 }}>{detailRecord.quantified_result || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="业务价值"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.business_value || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="可复用内容"><div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.reusable_content || '-'}</div></Descriptions.Item>
              <Descriptions.Item label="沉淀负责人">{detailRecord.archive_owner || '-'}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑成果' : '新增成果'}
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
              <Form.Item name="quarter" label="季度" rules={[{ required: true }]} initialValue={currentQuarter}>
                <Select><Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option></Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true }]} initialValue="中">
                <Select><Option value="高">高</Option><Option value="中">中</Option><Option value="低">低</Option></Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="achievement_type" label="成果类型" rules={[{ required: true }]}><Input placeholder="如：流程优化、工具开发、方法论" /></Form.Item>
          <Form.Item name="project_name" label="项目/工作名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="成果描述"><TextArea rows={3} /></Form.Item>
          <Form.Item name="quantified_result" label="量化结果"><TextArea rows={2} placeholder="如：签约周期缩短40%" /></Form.Item>
          <Form.Item name="business_value" label="业务价值"><TextArea rows={2} /></Form.Item>
          <Form.Item name="reusable_content" label="沉淀/可复用内容"><TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="include_next_quarter" valuePropName="checked" initialValue={false}>
                <Checkbox>纳入下季计划</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="completed_at" label="完成时间"><DatePicker style={{ width: '100%' }} /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="archive_owner" label="沉淀负责人"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* 季度归档弹窗 */}
      <Modal
        title="季度归档管理"
        open={archiveModalVisible}
        onCancel={() => setArchiveModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setArchiveModalVisible(false)}>关闭</Button>,
          <Button key="create" type="primary" icon={<SafetyCertificateOutlined />} onClick={handleCreateArchive}>
            创建归档
          </Button>,
        ]}
        width={700}
      >
        <div style={{ marginBottom: 16, color: '#6B7280', fontSize: 13 }}>
          归档会将当前季度的成果数据快照保存，方便后续回顾和对比。
        </div>
        <Table
          dataSource={archives}
          rowKey="id"
          loading={archiveLoading}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: '归档名称', dataIndex: 'archive_name', key: 'name' },
            { title: '归档季度', dataIndex: 'quarter', key: 'quarter' },
            { title: '创建时间', dataIndex: 'created_at', key: 'created' },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                <Button size="small" type="link" danger onClick={() => handleDeleteArchive(record.id)}>删除</Button>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
}

export default AchievementPage;
