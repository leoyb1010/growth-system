function validatePasswordStrength(password) {
  if (typeof password !== 'string') {
    return '密码格式不正确';
  }

  if (password.length < 8) {
    return '密码长度不能少于8位';
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return '密码必须同时包含字母和数字';
  }

  const lowered = password.toLowerCase();
  const weakPasswords = new Set([
    '12345678',
    'password',
    'password1',
    'qwerty123',
    'admin123',
    'admin1234',
    'growth123',
  ]);

  if (weakPasswords.has(lowered)) {
    return '密码过于简单，请更换更强的密码';
  }

  return null;
}

module.exports = { validatePasswordStrength };
