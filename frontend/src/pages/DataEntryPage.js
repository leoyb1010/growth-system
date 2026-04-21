import React from 'react';
import {
  Card, Tabs, Form, Input, InputNumber, Select, DatePicker, Button, message, Row, Col, Checkbox
} from 'antd';
import {
  BarChartOutlined, ProjectOutlined, TrophyOutlined, CalendarOutlined, StarOutlined, SaveOutlined
} from '@ant-design/icons';
import { api } from '../hooks/useAuth';
import moment from 'moment';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

function DataEntryPage() {
  const [kpiForm] = Form.useForm();
  const [projectForm] = Form.useForm();
  const [performanceForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [achievementForm] = Form.useForm();

  const currentQuarter = moment().quarter();
  const quarterMap = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };
  const defaultQuarter = quarterMap[currentQuarter] || 'Q2';
  const currentMonth = moment().format('YYYY-MM');

  const handleSubmit = async (endpoint, form, values, extraTransform = null) => {
    try {
      let payload = { ...values };
      if (extraTransform) {
        payload = extraTransform(payload);
      }
      await api.post(endpoint, payload);
      message.success('录入成功');
      form.resetFields();
    } catch (err) {
      message.error('录入失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const deptSelect = (
    <Select placeholder="请选择部门">
      <Option value={1}>拓展组</Option>
      <Option value={2}>运营组</Option>
    </Select>
  );

  const quarterSelect = (
    <Select placeholder="请选择季度">
      <Option value="Q1">Q1</Option>
      <Option value="Q2">Q2</Option>
      <Option value="Q3">Q3</Option>
      <Option value="Q4">Q4</Option>
    </Select>
  );

  const statusSelect = (
    <Select placeholder="请选择状态">
      <Option value="未启动">未启动</Option>
      <Option value="进行中">进行中</Option>
      <Option value="风险">风险</Option>
      <Option value="完成">完成</Option>
    </Select>
  );

  const prioritySelect = (
    <Select placeholder="请选择优先级">
      <Option value="高">高</Option>
      <Option value="中">中</Option>
      <Option value="低">低</Option>
    </Select>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>数据录入</h2>
          <p style={{ margin: '4px 0 0 0', color: '#8c8c8c', fontSize: 14 }}>
            按模块逐项填写数据，提交后自动清空可继续录入
          </p>
        </div>
      </div>

      <Tabs type="card" size="large">
        {/* 核心指标 */}
        <TabPane
          tab={<span><BarChartOutlined /> 核心指标</span>}
          key="kpi"
        >
          <Card style={{ maxWidth: 700 }}>
            <Form
              form={kpiForm}
              layout="vertical"
              onFinish={(values) => handleSubmit('/kpis', kpiForm, values)}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="dept_id" label="部门" rules={[{ required: true }]}>
                    {deptSelect}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="quarter" label="季度" rules={[{ required: true }]} initialValue={defaultQuarter}>
                    {quarterSelect}
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="indicator_name" label="指标名称" rules={[{ required: true }]}>
                <Input placeholder="如：GMV、净利润、新客数" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="target" label="目标值" rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} placeholder="目标值" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="actual" label="完成值" rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} placeholder="完成值" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="unit" label="单位" initialValue="万元">
                <Input placeholder="如：万元、个、%" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" size="large">
                  提交录入
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* 重点工作 */}
        <TabPane
          tab={<span><ProjectOutlined /> 重点工作</span>}
          key="project"
        >
          <Card style={{ maxWidth: 800 }}>
            <Form
              form={projectForm}
              layout="vertical"
              onFinish={(values) => handleSubmit('/projects', projectForm, values, (p) => ({
                ...p,
                due_date: p.due_date ? p.due_date.format('YYYY-MM-DD') : null
              }))}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="dept_id" label="部门" rules={[{ required: true }]}>
                    {deptSelect}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="quarter" label="所属季度" rules={[{ required: true }]} initialValue={defaultQuarter}>
                    {quarterSelect}
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="type" label="项目类型" rules={[{ required: true }]}>
                <Input placeholder="如：新客拓展、渠道合作、产品迭代" />
              </Form.Item>
              <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="goal" label="工作目标">
                <TextArea rows={4} placeholder="描述项目的整体目标" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="weekly_progress" label="本周进展">
                    <TextArea rows={4} placeholder="本周具体进展" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="monthly_progress" label="本月累计">
                    <TextArea rows={4} placeholder="本月累计完成情况" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="quarterly_progress" label="本季进展">
                <TextArea rows={4} placeholder="本季度整体进展" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="progress_pct" label="进度%" rules={[{ required: true }]} initialValue={0}>
                    <InputNumber min={0} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="未启动">
                    {statusSelect}
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="risk_desc" label="风险与问题">
                <TextArea rows={4} placeholder="如有风险或问题请详细描述" />
              </Form.Item>
              <Form.Item name="due_date" label="预计完成时间">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" size="large">
                  提交录入
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* 业务线业绩 */}
        <TabPane
          tab={<span><TrophyOutlined /> 业务线业绩</span>}
          key="performance"
        >
          <Card style={{ maxWidth: 800 }}>
            <Form
              form={performanceForm}
              layout="vertical"
              onFinish={(values) => handleSubmit('/performances', performanceForm, values)}
            >
              <Form.Item name="dept_id" label="部门" rules={[{ required: true }]}>
                {deptSelect}
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="business_type" label="业务类型" rules={[{ required: true }]}>
                    <Input placeholder="如：SaaS订阅、广告收入" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="indicator" label="指标" rules={[{ required: true }]}>
                    <Input placeholder="如：订阅收入、广告营收" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="unit" label="单位" initialValue="万元">
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="q1_target" label="Q1目标" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="q1_actual" label="Q1完成" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="q2_target" label="Q2目标" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="q2_actual" label="Q2完成" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="q3_target" label="Q3目标" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="q3_actual" label="Q3完成" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="q4_target" label="Q4目标" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="q4_actual" label="Q4完成" initialValue={0}>
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" size="large">
                  提交录入
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* 月度工作 */}
        <TabPane
          tab={<span><CalendarOutlined /> 月度工作</span>}
          key="monthly-task"
        >
          <Card style={{ maxWidth: 800 }}>
            <Form
              form={taskForm}
              layout="vertical"
              onFinish={(values) => handleSubmit('/monthly-tasks', taskForm, values)}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="dept_id" label="部门" rules={[{ required: true }]}>
                    {deptSelect}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="month" label="月份" rules={[{ required: true }]} initialValue={currentMonth}>
                    <Input placeholder="格式：2026-04" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="category" label="工作类别" rules={[{ required: true }]}>
                    <Input placeholder="如：客户拓展、内容运营" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="task" label="工作事项" rules={[{ required: true }]}>
                <TextArea rows={4} placeholder="具体工作事项描述" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="goal" label="工作目标">
                    <TextArea rows={4} placeholder="预期目标" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="actual_result" label="实际完成情况">
                    <TextArea rows={4} placeholder="实际完成情况" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="output" label="成果/产出">
                <TextArea rows={4} placeholder="具体成果或产出物" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="completion_rate" label="完成度" rules={[{ required: true }]} initialValue={0}>
                    <InputNumber min={0} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="status" label="状态" rules={[{ required: true }]} initialValue="未启动">
                    {statusSelect}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="quarter" label="所属季度" rules={[{ required: true }]} initialValue={defaultQuarter}>
                    {quarterSelect}
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="highlights" label="亮点与问题">
                <TextArea rows={4} placeholder="工作亮点或遇到的问题" />
              </Form.Item>
              <Form.Item name="next_month_plan" label="下月跟进">
                <TextArea rows={4} placeholder="下月计划或跟进事项" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" size="large">
                  提交录入
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* 季度成果 */}
        <TabPane
          tab={<span><StarOutlined /> 季度成果</span>}
          key="achievement"
        >
          <Card style={{ maxWidth: 800 }}>
            <Form
              form={achievementForm}
              layout="vertical"
              onFinish={(values) => handleSubmit('/achievements', achievementForm, values, (p) => ({
                ...p,
                completed_at: p.completed_at ? p.completed_at.format('YYYY-MM-DD') : null
              }))}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="dept_id" label="部门" rules={[{ required: true }]}>
                    {deptSelect}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="quarter" label="所属季度" rules={[{ required: true }]} initialValue={defaultQuarter}>
                    {quarterSelect}
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="achievement_type" label="成果类型" rules={[{ required: true }]}>
                    <Input placeholder="如：流程优化、工具开发、方法论" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="project_name" label="项目/工作名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="成果描述">
                <TextArea rows={4} placeholder="成果详细描述" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="quantified_result" label="量化结果">
                    <TextArea rows={4} placeholder="如：签约周期缩短40%" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="business_value" label="业务价值">
                    <TextArea rows={4} placeholder="对业务的价值和影响" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="reusable_content" label="沉淀/可复用内容">
                <TextArea rows={4} placeholder="可沉淀或可复用的内容" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="priority" label="优先级" rules={[{ required: true }]} initialValue="中">
                    {prioritySelect}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="completed_at" label="完成时间">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="archive_owner" label="沉淀负责人">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="include_next_quarter" valuePropName="checked" initialValue={false}>
                <Checkbox>纳入下季计划</Checkbox>
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" size="large">
                  提交录入
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}

export default DataEntryPage;
