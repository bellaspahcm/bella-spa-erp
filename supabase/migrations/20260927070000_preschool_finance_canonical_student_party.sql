BEGIN;

ALTER TABLE public.edu_fin_student_discount_profiles
ADD COLUMN IF NOT EXISTS student_party_id UUID REFERENCES public.party_parties(id) ON DELETE RESTRICT;

ALTER TABLE public.edu_fin_invoices
ADD COLUMN IF NOT EXISTS student_party_id UUID REFERENCES public.party_parties(id) ON DELETE RESTRICT;

ALTER TABLE public.edu_fin_payments
ADD COLUMN IF NOT EXISTS student_party_id UUID REFERENCES public.party_parties(id) ON DELETE RESTRICT;

ALTER TABLE public.edu_fin_student_discount_profiles
ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.edu_fin_invoices
ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.edu_fin_payments
ALTER COLUMN student_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'edu_fin_student_discount_profiles_student_identity_check'
          AND conrelid = 'public.edu_fin_student_discount_profiles'::regclass
    ) THEN
        ALTER TABLE public.edu_fin_student_discount_profiles
        ADD CONSTRAINT edu_fin_student_discount_profiles_student_identity_check
        CHECK (student_id IS NOT NULL OR student_party_id IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'edu_fin_invoices_student_identity_check'
          AND conrelid = 'public.edu_fin_invoices'::regclass
    ) THEN
        ALTER TABLE public.edu_fin_invoices
        ADD CONSTRAINT edu_fin_invoices_student_identity_check
        CHECK (student_id IS NOT NULL OR student_party_id IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'edu_fin_payments_student_identity_check'
          AND conrelid = 'public.edu_fin_payments'::regclass
    ) THEN
        ALTER TABLE public.edu_fin_payments
        ADD CONSTRAINT edu_fin_payments_student_identity_check
        CHECK (student_id IS NOT NULL OR student_party_id IS NOT NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_edu_fin_discount_profiles_tenant_student_party
ON public.edu_fin_student_discount_profiles(tenant_id, student_party_id)
WHERE student_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edu_fin_invoices_tenant_student_party
ON public.edu_fin_invoices(tenant_id, student_party_id)
WHERE student_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_edu_fin_payments_tenant_student_party
ON public.edu_fin_payments(tenant_id, student_party_id)
WHERE student_party_id IS NOT NULL;

COMMENT ON COLUMN public.edu_fin_student_discount_profiles.student_party_id
IS 'Canonical Preschool Student Party identity for finance discount profile rows. Legacy student_id remains for historical compatibility.';

COMMENT ON COLUMN public.edu_fin_invoices.student_party_id
IS 'Canonical Preschool Student Party identity for invoice rows. Legacy student_id remains for historical compatibility.';

COMMENT ON COLUMN public.edu_fin_payments.student_party_id
IS 'Canonical Preschool Student Party identity for payment rows. Legacy student_id remains for historical compatibility.';

CREATE OR REPLACE FUNCTION public.fn_check_invoice_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.invoice_status IN ('ISSUED', 'VOID') THEN
        -- Allow updating settlement_status, paid_amount, outstanding_amount, sha256_checksum, and updated_at ONLY
        IF (OLD.invoice_number IS DISTINCT FROM NEW.invoice_number) OR
           (OLD.gross_amount IS DISTINCT FROM NEW.gross_amount) OR
           (OLD.discount_amount IS DISTINCT FROM NEW.discount_amount) OR
           (OLD.net_amount IS DISTINCT FROM NEW.net_amount) OR
           (OLD.student_id IS DISTINCT FROM NEW.student_id) OR
           (OLD.student_party_id IS DISTINCT FROM NEW.student_party_id) OR
           (OLD.billing_period_id IS DISTINCT FROM NEW.billing_period_id) THEN
            RAISE EXCEPTION 'INVOICE_PUBLISHED_IMMUTABLE_ERROR: Issued invoices are immutable and cannot have header amounts or core fields modified.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
