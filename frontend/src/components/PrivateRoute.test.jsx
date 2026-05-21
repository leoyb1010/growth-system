import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PrivateRoute from './PrivateRoute';

const authState = vi.hoisted(() => ({ value: { user: null, loading: false } }));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState.value,
}));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PrivateRoute><div>受保护内容</div></PrivateRoute>} />
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PrivateRoute', () => {
  it('shows protected content for authenticated users', () => {
    authState.value = { user: { id: 1, username: 'admin' }, loading: false };
    renderProtected();
    expect(screen.getByText('受保护内容')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login without showing loading copy', () => {
    authState.value = { user: null, loading: false };
    renderProtected();
    expect(screen.getByText('登录页')).toBeInTheDocument();
    expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
  });
});
