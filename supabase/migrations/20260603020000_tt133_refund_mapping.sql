-- Align TT133 refund templates with service revenue accounting.
-- Runtime refund posting should not use 521 for TT133 service revenue.

UPDATE public.accounting_event_templates
SET
  template_lines = '[
    {"side":"DEBIT","account_code":"5113","amount_source":"revenue_reduction_amount"},
    {"side":"DEBIT","account_code":"3387","amount_source":"deferred_refund_amount","optional":true},
    {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
  ]'::JSONB,
  description = 'Hoan tien/giam doanh thu theo tinh huong: dich vu chua thuc hien giam 3387, dich vu da ghi nhan giam 5113.',
  updated_at = NOW()
WHERE standard_profile = 'TT133'
  AND business_event_type = 'REFUND_TO_CUSTOMER'
  AND is_active = true;

NOTIFY pgrst, 'reload schema';
