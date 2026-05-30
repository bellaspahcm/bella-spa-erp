-- Add missing TT133 template for salary expenses that are entered through
-- the SIMPLE finance form instead of the salary_records workflow.

INSERT INTO public.accounting_event_templates (
    tenant_id, standard_profile, business_event_type, template_name, description,
    source_module, template_lines, required_fields, auto_post_allowed, requires_review, is_system
) VALUES (
    NULL,
    'TT133',
    'EXPENSE_SALARY',
    'Chi phí lương nhập qua module thu chi',
    'Khoản chi lương vận hành; ưu tiên dùng SALARY_ACCRUAL/SALARY_PAYMENT khi có salary_record.',
    'finance',
    '[
       {"side":"DEBIT","account_code":"6421","amount_source":"amount"},
       {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
     ]'::JSONB,
    ARRAY['amount','payment_method','expense_date'],
    true,
    true,
    true
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
