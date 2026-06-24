/**
 * 统一视觉主题配置
 * 所有 Ant Design token 集中在此，自定义样式走 index.css 的 CSS 变量。
 * v1.22.2 视觉精修：原生字体栈(中文友好) + 分层柔和阴影 + 组件令牌统一化。
 */
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", system-ui, sans-serif';

export const appTheme = {
  token: {
    colorPrimary: '#3B5AFB',
    colorSuccess: '#16A34A',
    colorWarning: '#F59E0B',
    colorError: '#DC2626',
    colorInfo: '#3B5AFB',

    colorText: '#111827',
    colorTextSecondary: '#6B7280',
    colorTextTertiary: '#9CA3AF',
    colorBorder: '#E5E7EB',
    colorBorderSecondary: '#F1F5F9',
    colorBgLayout: '#F5F7FB',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',

    fontFamily: FONT_STACK,
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    fontSize: 14,
    controlHeight: 40,
    lineWidth: 1,
    wireframe: false,

    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
    boxShadowSecondary: '0 4px 16px rgba(15, 23, 42, 0.06)',
    boxShadowTertiary: '0 1px 2px rgba(15, 23, 42, 0.04)',
  },
  components: {
    Layout: {
      bodyBg: '#F5F7FB',
      headerBg: '#FFFFFF',
      siderBg: '#0F172A',
      triggerBg: '#0F172A',
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 20,
      boxShadowTertiary: '0 1px 3px rgba(15, 23, 42, 0.05)',
    },
    Button: {
      borderRadius: 8,
      controlHeight: 38,
      fontWeight: 500,
      primaryShadow: '0 1px 2px rgba(59, 90, 251, 0.12)',
      defaultShadow: 'none',
    },
    Input: { borderRadius: 8, controlHeight: 40 },
    Select: { borderRadius: 8, controlHeight: 40 },
    Table: {
      headerBg: '#F8FAFC',
      borderColor: '#EEF2F7',
      headerColor: '#334155',
      headerSplitColor: '#EEF2F7',
      rowHoverBg: '#F8FAFC',
      cellPaddingBlock: 12,
    },
    Tabs: {
      titleFontSize: 14,
      inkBarColor: '#3B5AFB',
      itemSelectedColor: '#3B5AFB',
      itemHoverColor: '#3B5AFB',
      horizontalItemGutter: 24,
    },
    Segmented: {
      borderRadius: 8,
      itemSelectedBg: '#FFFFFF',
      itemSelectedColor: '#3B5AFB',
      trackBg: '#EEF1F6',
      itemActiveBg: '#FFFFFF',
    },
    Tag: { borderRadiusSM: 6, defaultBg: '#F1F5F9', defaultColor: '#475569' },
    Modal: { borderRadiusLG: 14, headerBg: '#FFFFFF', titleFontSize: 16 },
    Drawer: { borderRadiusLG: 0 },
    Tooltip: { colorBgSpotlight: '#1E293B', borderRadius: 8 },
    Progress: { defaultColor: '#3B5AFB' },
    Menu: {
      darkItemBg: '#0F172A',
      darkSubMenuItemBg: '#111827',
      darkItemSelectedBg: 'rgba(59, 90, 251, 0.18)',
      darkItemSelectedColor: '#FFFFFF',
      darkItemHoverBg: 'rgba(255,255,255,0.06)',
      itemBorderRadius: 8,
      itemMarginInline: 8,
    },
  },
};
