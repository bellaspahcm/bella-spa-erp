-- Migration: 20260813000011_clinical_audit_tables.sql
-- Description: Phase H11 Clinical Audit & Compliance Engine Schema

BEGIN;

-- 1. Create hc_clinical_audit_ledger table (Immutable Audit Ledger)
CREATE TABLE IF NOT EXISTS public.hc_clinical_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    encounter_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    performer_id TEXT NOT NULL,
    performer_role TEXT NOT NULL,
    h8_decision_id UUID,
    h9_snapshot_id UUID,
    h10_rule_code TEXT,
    h10_rule_version TEXT,
    h10_rule_checksum TEXT,
    compliance_status TEXT NOT NULL CHECK (compliance_status IN ('COMPLIANT', 'NON_COMPLIANT', 'EXCEPTION', 'REQUIRES_REVIEW')),
    evidence_integrity TEXT NOT NULL CHECK (evidence_integrity IN ('COMPLETE', 'PARTIAL', 'BROKEN', 'UNVERIFIABLE')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_audit_tenant_enc
    ON public.hc_clinical_audit_ledger (tenant_id, encounter_id);

CREATE INDEX IF NOT EXISTS idx_hc_audit_tenant_status
    ON public.hc_clinical_audit_ledger (tenant_id, compliance_status, evidence_integrity);


-- 2. Create hc_clinical_evidence_packages table (Immutable Evidence Packages)
CREATE TABLE IF NOT EXISTS public.hc_clinical_evidence_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    audit_id UUID NOT NULL UNIQUE REFERENCES public.hc_clinical_audit_ledger(id) ON DELETE CASCADE,
    schema_version TEXT NOT NULL DEFAULT '1.0.0',
    source_references JSONB NOT NULL DEFAULT '{}'::jsonb,
    canonical_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    fingerprint TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_evidence_packages_tenant
    ON public.hc_clinical_evidence_packages (tenant_id, audit_id);


-- 3. Create hc_compliance_exceptions table (Immutable Exceptions & Overrides Ledger)
CREATE TABLE IF NOT EXISTS public.hc_compliance_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    audit_id UUID NOT NULL UNIQUE REFERENCES public.hc_clinical_audit_ledger(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL,
    enforcement_level TEXT NOT NULL,
    override_reason TEXT NOT NULL,
    overridden_by TEXT NOT NULL,
    overrider_role TEXT NOT NULL,
    authorized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_exceptions_tenant_enc
    ON public.hc_compliance_exceptions (tenant_id, encounter_id);


-- 4. Append-Only Immutability Triggers (H11-01 Invariant)
CREATE OR REPLACE FUNCTION public.fn_prevent_clinical_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Clinical audit, evidence, and compliance exception ledgers are strictly write-once append-only. Mutation (UPDATE/DELETE) is prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hc_audit_ledger_immutable ON public.hc_clinical_audit_ledger;
CREATE TRIGGER trg_hc_audit_ledger_immutable
    BEFORE UPDATE OR DELETE ON public.hc_clinical_audit_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_clinical_audit_mutation();

DROP TRIGGER IF EXISTS trg_hc_evidence_packages_immutable ON public.hc_clinical_evidence_packages;
CREATE TRIGGER trg_hc_evidence_packages_immutable
    BEFORE UPDATE OR DELETE ON public.hc_clinical_evidence_packages
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_clinical_audit_mutation();

DROP TRIGGER IF EXISTS trg_hc_exceptions_immutable ON public.hc_compliance_exceptions;
CREATE TRIGGER trg_hc_exceptions_immutable
    BEFORE UPDATE OR DELETE ON public.hc_compliance_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_clinical_audit_mutation();


-- 5. PL/pgSQL Function: get_compliance_summary
CREATE OR REPLACE FUNCTION public.get_compliance_summary(
    p_tenant_id UUID,
    p_from TIMESTAMPTZ DEFAULT NULL,
    p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    tenant_id UUID,
    total_actions BIGINT,
    compliant_count BIGINT,
    non_compliant_count BIGINT,
    exception_count BIGINT,
    requires_review_count BIGINT,
    complete_integrity_count BIGINT,
    broken_integrity_count BIGINT,
    override_rate_percent NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT *
        FROM public.hc_clinical_audit_ledger a
        WHERE a.tenant_id = p_tenant_id
          AND (p_from IS NULL OR a.created_at >= p_from)
          AND (p_to IS NULL OR a.created_at <= p_to)
    )
    SELECT
        p_tenant_id AS tenant_id,
        COUNT(*)::BIGINT AS total_actions,
        COUNT(*) FILTER (WHERE compliance_status = 'COMPLIANT')::BIGINT AS compliant_count,
        COUNT(*) FILTER (WHERE compliance_status = 'NON_COMPLIANT')::BIGINT AS non_compliant_count,
        COUNT(*) FILTER (WHERE compliance_status = 'EXCEPTION')::BIGINT AS exception_count,
        COUNT(*) FILTER (WHERE compliance_status = 'REQUIRES_REVIEW')::BIGINT AS requires_review_count,
        COUNT(*) FILTER (WHERE evidence_integrity = 'COMPLETE')::BIGINT AS complete_integrity_count,
        COUNT(*) FILTER (WHERE evidence_integrity IN ('BROKEN', 'UNVERIFIABLE'))::BIGINT AS broken_integrity_count,
        CASE 
            WHEN COUNT(*) = 0 THEN 0.0
            ELSE ROUND((COUNT(*) FILTER (WHERE compliance_status = 'EXCEPTION')::NUMERIC / COUNT(*)::NUMERIC) * 100.0, 2)
        END AS override_rate_percent
    FROM filtered;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
