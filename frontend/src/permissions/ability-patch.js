// ============================================================
// PATCH for frontend/src/permissions/ability.js
// ============================================================

// --- In super_admin ROLE_PERMISSIONS, add: ---
// 'cps.read', 'cps.write', 'cps.admin', 'ai.use'

// --- Add new roles in ROLE_PERMISSIONS: ---
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

// --- In MENU_PERMISSIONS, add: ---
'/cps/dashboard': 'cps.read',
'/cps/data': 'cps.read',
'/cps/alerts': 'cps.read',
'/cps/channels': 'cps.admin',
'/cps/products': 'cps.admin',
'/cps/settings': 'cps.admin',
