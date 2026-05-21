const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const { success, error } = require('../utils/response');
const { logAudit } = require('../services/auditLogService');
const { generateAccessToken, generateRefreshToken, verifyAndRotateRefreshToken, revokeAllUserTokens } = require('../services/refreshTokenService');
const { validatePasswordStrength } = require('../utils/passwordPolicy');

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  const cookies = header.split(';').map(part => part.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const index = cookie.indexOf('=');
    if (index === -1) continue;
    const key = cookie.slice(0, index);
    if (key === name) return decodeURIComponent(cookie.slice(index + 1));
  }
  return null;
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  };
}

function setRefreshTokenCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/refresh',
  });
}

function getRoleLevel(role) {
  if (role === 'admin' || role === 'super_admin') return 0;
  if (role === 'dept_manager' || role === 'dept' || role === 'cps_admin') return 1;
  return 2;
}

/**
 * 用户登录
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return error(res, '用户名和密码不能为空');
    }

    const user = await User.findOne({
      where: { username },
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });

    if (!user) {
      return error(res, '用户名或密码错误', 1, 401);
    }

    // V4: 检查账号状态（disabled 和 pending 都不允许登录）
    if (user.status === 'disabled') {
      return error(res, '账号已被禁用，请联系管理员', 1, 403);
    }
    if (user.status === 'pending') {
      return error(res, '账号待审核，请联系管理员激活', 1, 403);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return error(res, '用户名或密码错误', 1, 401);
    }

    // V4: 更新最后登录时间
    await user.update({ last_login_at: new Date() });

    // 计算角色层级
    const roleLevel = getRoleLevel(user.role);

    const token = generateAccessToken(user);

    // 生成 refresh token
    const refreshToken = await generateRefreshToken(user);
    setRefreshTokenCookie(res, refreshToken);

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLevel,
        dept_id: user.dept_id,
        cps_channel_id: user.cps_channel_id,
        cps_role: user.cps_role,
        aso_role: user.aso_role,
        status: user.status,
        must_change_password: user.must_change_password,
        department: user.Department
      }
    }, '登录成功');
  } catch (err) {
    console.error('登录失败:', err);
    error(res, '登录失败，请稍后重试', 1, 500);
  }
}

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Department, attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash'] }
    });
    if (!user) {
      return error(res, '用户不存在', 1, 404);
    }
    // 禁用或待审核用户不允许访问
    if (user.status === 'disabled') {
      return error(res, '账号已被禁用', 1, 403);
    }
    if (user.status === 'pending') {
      return error(res, '账号待审核', 1, 403);
    }
    // 注入 roleLevel
    const roleLevel = getRoleLevel(user.role);
    const userData = user.toJSON();
    userData.roleLevel = roleLevel;
    success(res, userData);
  } catch (err) {
    error(res, '获取用户信息失败', 1, 500);
  }
}

/**
 * 修改密码（仅限当前登录用户修改自己密码）
 * POST /api/auth/change-password
 * 必须提供 old_password + new_password
 */
async function changePassword(req, res) {
  try {
    const { old_password, new_password } = req.body;
    const currentUser = req.user;

    const passwordError = validatePasswordStrength(new_password);
    if (passwordError) {
      return error(res, passwordError);
    }

    if (!old_password) {
      return error(res, '请提供旧密码');
    }

    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return error(res, '用户不存在');
    }

    const isValid = await bcrypt.compare(old_password, user.password_hash);
    if (!isValid) {
      return error(res, '旧密码错误');
    }

    const newHash = await bcrypt.hash(new_password, 10);
    const oldValues = user.toJSON();
    // 修改密码后递增 token_version，强制其他设备重新登录
    await user.update({
      password_hash: newHash,
      must_change_password: false,
      token_version: (user.token_version || 0) + 1
    });
    await revokeAllUserTokens(user.id);
    await logAudit('users', user.id, 'update', { id: currentUser.id, name: currentUser.name || currentUser.username }, oldValues, { change_password: true });

    success(res, null, '密码修改成功');
  } catch (err) {
    console.error('修改密码失败:', err);
    error(res, '修改密码失败', 1, 500);
  }
}

/**
 * 用户注册
 * POST /api/auth/register
 * 默认关闭公开注册，需设置 ENABLE_PUBLIC_REGISTER=true 才开放
 *
 * 当前密码策略（v1）：最少8位，必须包含字母和数字，拒绝常见弱密码。
 * TODO v2：增强密码策略 — 添加大小写区分、特殊字符要求、密码历史检查。
 */
async function register(req, res) {
  try {
    // 检查是否开放公开注册
    if (process.env.ENABLE_PUBLIC_REGISTER !== 'true') {
      return error(res, '当前系统不开放公开注册，请联系管理员创建账号', 1, 403);
    }

    const { username, name, password } = req.body;

    if (!username || !name || !password) {
      return error(res, '用户名、姓名和密码不能为空');
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return error(res, passwordError);
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return error(res, '用户名已存在');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      name,
      role: 'dept_staff',   // 注册账号默认普通成员
      password_hash: passwordHash,
      status: 'pending',    // 公开注册默认待审核，不自动 active
      must_change_password: false,
    });

    await logAudit('users', user.id, 'create', { id: user.id, name: user.name, system: true }, null, { username: user.username, role: user.role, register: true });

    // 不自动登录，需管理员审核激活后才能登录
    success(res, {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        dept_id: user.dept_id,
        status: user.status,
      }
    }, '注册成功，请等待管理员审核激活');
  } catch (err) {
    console.error('注册失败:', err);
    error(res, '注册失败，请稍后重试', 1, 500);
  }
}

/**
 * 刷新 Token
 * POST /api/auth/refresh
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken: legacyBodyToken } = req.body || {};
    const token = getCookie(req, REFRESH_COOKIE_NAME) || legacyBodyToken;
    if (!token) return error(res, '缺少 refreshToken', 1, 400);

    const result = await verifyAndRotateRefreshToken(token);
    if (!result) return error(res, 'refreshToken 无效或已过期', 1, 401);

    const { user, refreshToken: newRefreshToken } = result;
    const accessToken = generateAccessToken(user);
    setRefreshTokenCookie(res, newRefreshToken);

    success(res, {
      token: accessToken
    }, 'Token 刷新成功');
  } catch (err) {
    console.error('刷新 Token 失败:', err);
    error(res, '刷新 Token 失败', 1, 500);
  }
}

/**
 * 登出（撤销所有 refresh token）
 * POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    await revokeAllUserTokens(req.user.id);
    clearRefreshTokenCookie(res);
    success(res, null, '登出成功');
  } catch (err) {
    console.error('登出失败:', err);
    error(res, '登出失败', 1, 500);
  }
}

module.exports = { login, getCurrentUser, changePassword, register, refreshToken, logout };
