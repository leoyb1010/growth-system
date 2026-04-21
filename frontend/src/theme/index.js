/**
 * 统一视觉主题配置
 * 所有 Ant Design token 集中在此，自定义样式走 index.css 的 CSS 变量
 */
export const appTheme = {
  token: {
    colorPrimary: '#3B5AFB',
    colorSuccess: '#16A34A',
    colorWarning: '#F59E0B',
    colorError: '#DC2626',
    colorInfo: '#3B5AFB',

    colorText: '#111827',
    colorTextSecondary: '#6B7280',
    colorBorder: '#E5E7EB',
    colorBgLayout: '#F5F7FB',
    colorBgContainer: '#FFFFFF',

    borderRadius: 14,
    fontSize: 14,
    controlHeight: 40,

    boxShadow: '0 6px 24px rgba(15, 23, 42, 0.06)',
    boxShadowSecondary: '0 2px 12px rgba(15, 23, 42, 0.04)',
  },
  components: {
    Layout: {
      bodyBg: '#F5F7FB',
      headerBg: '#FFFFFF',
      siderBg: '#0F172A',
      triggerBg: '#0F172A',
    },
    Card: {
      borderRadiusLG: 18,
    },
    Button: {
      borderRadius: 10,
      controlHeight: 38,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Table: {
      headerBg: '#F8FAFC',
      borderColor: '#EEF2F7',
      headerColor: '#334155',
    },
    Menu: {
      darkItemBg: '#0F172A',
      darkSubMenuItemBg: '#111827',
      darkItemSelectedBg: 'rgba(59, 90, 251, 0.18)',
      darkItemSelectedColor: '#FFFFFF',
      darkItemHoverBg: 'rgba(255,255,255,0.06)',
    },
  },
};
