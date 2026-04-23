import React, { useEffect, useState } from 'react';
import { Select, message } from 'antd';
import { api } from '../hooks/useAuth';

const { Option } = Select;

/**
 * 部门选择器 - 自动从 API 加载部门列表
 * props 透传给 antd Select（如 placeholder, allowClear, initialValue 等）
 */
function DepartmentSelect(props) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments');
      if (res.code === 0) {
        setDepartments(res.data || []);
      }
    } catch (err) {
      message.error('加载部门列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 提取非 Select 的自定义 props
  const { ...selectProps } = props;

  return (
    <Select loading={loading} placeholder="请选择部门" {...selectProps}>
      {departments.map(dept => (
        <Option key={dept.id} value={dept.id}>{dept.name}</Option>
      ))}
    </Select>
  );
}

export default DepartmentSelect;

/**
 * 获取部门列表的 hook（供需要部门数据的场景使用）
 */
export function useDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get('/departments');
        if (res.code === 0) {
          setDepartments(res.data || []);
        }
      } catch (err) {
        console.error('加载部门列表失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { departments, loading };
}
