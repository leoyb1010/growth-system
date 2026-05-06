// ============================================================
// PATCH for backend/src/middleware/auth.js
// ============================================================
// These are the additions/modifications to the existing auth middleware.

// --- In super_admin ROLE_PERMISSIONS, add: ---
// 'cps.read', 'cps.write', 'cps.admin', 'ai.use',

// --- Add new roles in ROLE_PERMISSIONS ---
cps_admin: [
  'dashboard.read',
  'cps.read', 'cps.write', 'cps.admin',
  'ai.use', 'export.data', 'search.use',
],

cps_ops: [
  'dashboard.read',
  'cps.read', 'cps.write',
  'ai.use', 'export.data', 'search.use',
],

// --- In ROLE_COMPAT, add: ---
const ROLE_COMPAT = {
  admin: 'super_admin',
  dept: 'department_manager',
  dept_manager: 'department_manager',
  dept_staff: 'department_member',
  cps_admin: 'cps_admin',
  cps_ops: 'cps_ops',
};

// --- In DATA_SCOPE_MAP, add: ---
cps_admin: { type: 'all', value: null },
cps_ops: { type: 'all', value: null },
