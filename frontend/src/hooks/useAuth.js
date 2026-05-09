import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = process.env.REACT_APP_API_URL || '';
let refreshPromise = null;

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 10000,
});

// 请求拦截器：自动附加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一处理错误
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config || {};
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login') && !originalRequest.url?.includes('/auth/refresh')) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        originalRequest._retry = true;
        try {
          if (!refreshPromise) {
            refreshPromise = axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken })
              .then((res) => res.data)
              .finally(() => { refreshPromise = null; });
          }
          const res = await refreshPromise;
          if (res.code === 0 && res.data?.token && res.data?.refreshToken) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('refreshToken', res.data.refreshToken);
            originalRequest.headers = {
              ...(originalRequest.headers || {}),
              Authorization: `Bearer ${res.data.token}`,
            };
            return api(originalRequest);
          }
        } catch (refreshError) {
          // fall through to clear local auth state
        }
      }
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (error.response?.data?.error_type === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new CustomEvent('password-change-required', {
        detail: { message: error.response.data.message }
      }));
    }
    // SQLITE_READONLY 专用提示：数据库只读时给用户明确的告警
    if (error.response?.data?.error_type === 'DB_READONLY') {
      // 触发全局事件，让 App 层显示告警条
      window.dispatchEvent(new CustomEvent('db-readonly', {
        detail: { message: error.response.data.message }
      }));
    }
    return Promise.reject(error.response?.data || { message: '请求失败' });
  }
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // 验证 token 有效性
      api.get('/auth/me')
        .then((res) => {
          if (res.code === 0) {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.code === 0) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    }
    return res;
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const role = user?.role || 'dept_staff';
  const roleLevel = user?.roleLevel ?? 2;
  const isAdmin = roleLevel === 0;
  const isDeptManager = roleLevel <= 1;
  const isDeptStaff = roleLevel === 2;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isDeptManager, isDeptStaff, role, roleLevel, loading, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { api };
