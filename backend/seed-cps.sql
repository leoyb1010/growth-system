-- ============================================================
-- CPS Alert Rules Seed (SQLite)
-- ============================================================
INSERT OR IGNORE INTO cps_alert_rules
(code, name, level, metric, operator, threshold_value, min_base_value, enabled, remark)
VALUES
('complaint_rate_warning', '7日客诉率预警', 'warning', 'complaint_rate_7d', '>=', 0.008, 0, 1, '客诉率达到 0.8%'),
('complaint_rate_critical', '7日客诉率严重', 'critical', 'complaint_rate_7d', '>=', 0.010, 0, 1, '客诉率达到 1% 红线'),
('new_refund_rate_high', '新签退款率过高', 'warning', 'new_refund_rate', '>=', 0.100, 50, 1, '新签退款率达到 10% 且新签 >= 50'),
('renewal_refund_rate_high', '续费退款率过高', 'warning', 'renewal_refund_rate', '>=', 0.080, 50, 1, '续费退款率达到 8% 且续费 >= 50'),
('after_sale_refund_rate_high', '售后退款率过高', 'warning', 'after_sale_refund_rate', '>=', 0.050, 50, 1, '售后退款率达到 5%');

-- ============================================================
-- CPS Products Seed (SQLite)
-- ============================================================
INSERT OR IGNORE INTO cps_products(code, name, product_type, unit_price, status)
VALUES
('dict_298', '词典产品29.8', '词典', 29.80, 'active'),
('echo_499', 'Echo49.9', 'Echo', 49.90, 'active'),
('echo_296', 'Echo29.6', 'Echo', 29.60, 'active'),
('study_499', '学习会员产品49.9', '学习会员', 49.90, 'active'),
('echo_295', 'echo29.5', 'Echo', 29.50, 'active'),
('echo_498', 'echo49.8', 'Echo', 49.80, 'active'),
('echo_497', 'echo49.7', 'Echo', 49.70, 'active'),
('dict_295', '词典29.5', '词典', 29.50, 'active'),
('dict_349', '词典34.9', '词典', 34.90, 'active');
