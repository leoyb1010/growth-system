-- ============================================================
-- CPS Alert Rules Seed (PostgreSQL)
-- ============================================================
INSERT INTO cps_alert_rules
(code, name, level, metric, operator, threshold_value, min_base_value, enabled, remark)
VALUES
('complaint_rate_warning', '7日客诉率预警', 'warning', 'complaint_rate_7d', '>=', 0.008, 0, true, '客诉率达到 0.8%'),
('complaint_rate_critical', '7日客诉率严重', 'critical', 'complaint_rate_7d', '>=', 0.010, 0, true, '客诉率达到 1% 红线'),
('new_refund_rate_high', '新签退款率过高', 'warning', 'new_refund_rate', '>=', 0.100, 50, true, '新签退款率达到 10% 且新签 >= 50'),
('renewal_refund_rate_high', '续费退款率过高', 'warning', 'renewal_refund_rate', '>=', 0.080, 50, true, '续费退款率达到 8% 且续费 >= 50'),
('after_sale_refund_rate_high', '售后退款率过高', 'warning', 'after_sale_refund_rate', '>=', 0.050, 50, true, '售后退款率达到 5%')
ON CONFLICT (code) DO NOTHING;
