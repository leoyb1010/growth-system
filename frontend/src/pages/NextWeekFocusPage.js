import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, InputNumber, Select, message, Tag, Drawer, Descriptions, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import DepartmentSelect from '../components/DepartmentSelect';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

function NextWeekFocusPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  const { isAdmin, user } = useAuth();

  // 计算下周的日期范围
  const getNextWeekRange = () => {
    const today = moment();
    const dayOfWeek = today.isoWeekday(); // 1=周一, 7=周日
    const nextMonday = today.clone().add(8 - dayOfWeek, 'days');
    const nextSunday = nextMonday.clone().add(6, 'days');
    return { start: nextMonday.format('YYYY-MM-DD'), end: nextSunday.format('YYYY-MM-DD') };
  };
  const nextWeek = getNextWeekRange();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 复用 projects 接口，筛选 type=下周重点 的记录
      const res = await api.get('/projects', { params: { type: '下周重点' } });
      if (res.code === 0) setData(res.data);
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        type: '下周重点',
        due_date: nextWeek.end,
        status: values.status || '进行中',
        progress_pct: values.progress_pct || 0,
        quarter: values.quarter || (moment().quarter() <= 4 ? `Q${moment().quarter()}` : 'Q4'),
      };
      if (editingRecord) {
        await api.put(`/projects/${editingRecord.id}`, payload);
        message.success('更新成功');
      } else {
        await api.post('/projects', payload);
        message.success('录入成功');
      }
      setModalVisible(false); setEditingRecord(null); form.resetFields(); fetchData();
    } catch (err) { message.error(err?.response?.data?.message || err?.message || '操作失败'); }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/projects/${id}`); message.success('删除成功'); fetchData(); }
    catch (err) { message.error(err?.response?.data?.message || err?.message || '删除失败'); }
  };

  const getStatusColor = (status) => {
    const map = { '进行中': 'blue', '完成': 'green', '风险': 'red', '未启动': 'default' };
    return map[status] || 'default';
  };

  const currentQuarter = moment().quarter();
  const defaultQuarter = `Q${currentQuarter}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>下周重点工作</h2>
          <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>
            📅 下周：{nextWeek.start} ~ {nextWeek.end}
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingRecord(null);
          form.resetFields();
          form.setFieldsValue({ dept_id: 1, status: '进行中', progress_pct: 0, quarter: defaultQuarter });
          setModalVisible(true);
        }}>
          录入下周重点
        </Button>
      </div>

      {data.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#bfbfbf' }}>
          <ThunderboltOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
          暂无下周重点工作，点击右上角录入
        </div>
      )}

      <Row gutter={[16, 16]}>
        {data.map(item => {
          const statusColor = getStatusColor(item.status);
          const borderColor = item.status === '风险' ? '#ff4d4f' : item.status === '完成' ? '#52c41a' : '#1677ff';
          return (
            <Col xs={24} sm={12} lg={8} key={item.id}>
              <Card
                hoverable
                style={{
                  borderRadius: 12,
                  borderLeft: `4px solid ${borderColor}`,
                  height: '100%',
                }}
                bodyStyle={{ padding: 20 }}
                onClick={() => { setDetailRecord(item); setDrawerVisible(true); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#262626', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <Tag color={statusColor}>{item.status}</Tag>
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#8c8c8c', marginBottom: 12 }}>
                  <span>📂 {item.Department?.name || '-'}</span>
                  <span>👤 {item.owner_name || '-'}</span>
                </div>

                {item.goal && (
                  <div style={{ fontSize: 13, color: '#595959', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.goal}
                  </div>
                )}

                {item.weekly_progress && (
                  <div style={{ background: '#f6f8fa', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#595959', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    💡 {item.weekly_progress}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>截止 {item.due_date || nextWeek.end}</span>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button size="small" type="link" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(item); }} />
                      <Popconfirm title="确定删除该项目？" onConfirm={() => handleDelete(item.id)} okType="danger"><Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} /></Popconfirm>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 详情抽屉 */}
      <Drawer
        title={detailRecord?.name || '工作详情'}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDetailRecord(null); }}
        width={480}
        extra={isAdmin && detailRecord ? (
          <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailRecord); }}>编辑</Button>
        ) : null}
      >
        {detailRecord && (
          <Descriptions column={1} bordered size="small" labelStyle={{ fontWeight: 600, background: '#fafafa', width: 100 }}>
            <Descriptions.Item label="项目名称">{detailRecord.name}</Descriptions.Item>
            <Descriptions.Item label="部门">{detailRecord.Department?.name}</Descriptions.Item>
            <Descriptions.Item label="负责人">{detailRecord.owner_name}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={getStatusColor(detailRecord.status)}>{detailRecord.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="工作目标">{detailRecord.goal || '-'}</Descriptions.Item>
            <Descriptions.Item label="本周进展">{detailRecord.weekly_progress || '-'}</Descriptions.Item>
            <Descriptions.Item label="下周重点工作">{detailRecord.next_week_focus || '-'}</Descriptions.Item>
            <Descriptions.Item label="风险与问题">{detailRecord.risk_desc || '-'}</Descriptions.Item>
            <Descriptions.Item label="截止日期">{detailRecord.due_date || nextWeek.end}</Descriptions.Item>
            <Descriptions.Item label="季度">{detailRecord.quarter}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 录入弹窗 */}
      <Modal
        title={editingRecord ? '编辑下周重点' : '录入下周重点工作'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
        width={640}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dept_id" label="部门" rules={[{ required: true }]} initialValue={1}>
                <DepartmentSelect />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}>
                <Input placeholder="负责人" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="工作名称" rules={[{ required: true }]}>
            <Input placeholder="下周重点推进的工作" />
          </Form.Item>
          <Form.Item name="goal" label="工作目标">
            <TextArea rows={3} placeholder="预期达成的目标" />
          </Form.Item>
          <Form.Item name="weekly_progress" label="当前进展/计划">
            <TextArea rows={3} placeholder="当前进展或下周具体计划" />
          </Form.Item>
          <Form.Item name="next_week_focus" label="下周重点工作">
            <TextArea rows={3} placeholder="下周计划推进的重点工作" />
          </Form.Item>
          <Form.Item name="risk_desc" label="风险与问题">
            <TextArea rows={3} placeholder="可能的风险或障碍" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="进行中">
                <Select>
                  <Option value="未启动">未启动</Option>
                  <Option value="进行中">进行中</Option>
                  <Option value="风险">风险</Option>
                  <Option value="完成">完成</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quarter" label="所属季度" initialValue={defaultQuarter}>
                <Select>
                  <Option value="Q1">Q1</Option><Option value="Q2">Q2</Option>
                  <Option value="Q3">Q3</Option><Option value="Q4">Q4</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

export default NextWeekFocusPage;
