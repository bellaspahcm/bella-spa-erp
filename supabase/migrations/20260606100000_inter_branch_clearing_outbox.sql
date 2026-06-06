-- Add inter-branch clearing to the accounting outbox runtime.
-- A single clearing record must create one outbox event per tenant side
-- (debtor and creditor), so idempotency is scoped by tenant as well.

BEGIN;

ALTER TABLE public.accounting_outbox
  DROP CONSTRAINT IF EXISTS accounting_outbox_event_type_check;

ALTER TABLE public.accounting_outbox
  ADD CONSTRAINT accounting_outbox_event_type_check
  CHECK (event_type IN (
    'PACKAGE_SALE',
    'SESSION_DONE',
    'EXPENSE_RECORDED',
    'SALARY_PAID',
    'INVENTORY_CONSUMED',
    'REFUND_ISSUED',
    'INTER_BRANCH_CLEARING',
    'MANUAL_ENTRY'
  ));

ALTER TABLE public.accounting_outbox
  DROP CONSTRAINT IF EXISTS outbox_idempotency;

ALTER TABLE public.accounting_outbox
  ADD CONSTRAINT outbox_idempotency UNIQUE (tenant_id, event_type, reference_id);

CREATE OR REPLACE FUNCTION public.enqueue_accounting_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.accounting_outbox (
        tenant_id, event_type, reference_type, reference_id, payload
    ) VALUES (
        p_tenant_id, p_event_type, p_reference_type, p_reference_id, p_payload
    )
    ON CONFLICT (tenant_id, event_type, reference_id) DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.accounting_event_templates
SET
  description = 'Tu dong tao but toan cho hai phia khi doi soat lien chi nhanh da duoc gach no.',
  template_lines = '[
    {"side":"DEBIT","account_code":"632","amount_source":"amount","applies_to":"debtor"},
    {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount","applies_to":"debtor"},
    {"side":"DEBIT","account_code":"111_OR_112","amount_source":"amount","applies_to":"creditor"},
    {"side":"CREDIT","account_code":"5113","amount_source":"amount","applies_to":"creditor"}
  ]'::JSONB,
  required_fields = ARRAY['amount','payment_method','role','debtor_tenant_id','creditor_tenant_id'],
  auto_post_allowed = true,
  requires_review = false,
  updated_at = NOW()
WHERE business_event_type = 'INTER_BRANCH_CLEARING'
  AND standard_profile = 'TT133';

COMMIT;
