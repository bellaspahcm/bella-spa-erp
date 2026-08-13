-- Migration: 20260813000010_rule_governance_tables.sql
-- Description: Phase H10 Clinical Governance & Rule Engine Schema

BEGIN;

-- 1. Create hc_governed_clinical_rules table
CREATE TABLE IF NOT EXISTS public.hc_governed_clinical_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_code TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    jurisdiction_code TEXT NOT NULL DEFAULT 'LOCAL',
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO', 'LOW')),
    enforcement TEXT NOT NULL CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
    conditions_dsl JSONB NOT NULL DEFAULT '{}'::jsonb,
    rule_checksum TEXT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    author_id TEXT NOT NULL,
    reviewer_id TEXT,
    approver_id TEXT,
    approver_role TEXT,
    approval_evidence JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index per tenant, rule_code, and rule_version
CREATE UNIQUE INDEX IF NOT EXISTS uq_hc_governed_rule_ver
    ON public.hc_governed_clinical_rules (tenant_id, rule_code, rule_version);

CREATE INDEX IF NOT EXISTS idx_hc_governed_rules_active_time
    ON public.hc_governed_clinical_rules (tenant_id, status, jurisdiction_code, effective_from, effective_to);


-- 2. Create hc_rule_governance_audit table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.hc_rule_governance_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_id UUID NOT NULL,
    action TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    role TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hc_rule_audit_rule_id
    ON public.hc_rule_governance_audit (tenant_id, rule_id);


-- 3. Non-Overlap Trigger (H10-04 / H10-07 Invariant)
CREATE OR REPLACE FUNCTION public.fn_prevent_active_rule_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_overlap_count INT;
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        SELECT COUNT(*)
        INTO v_overlap_count
        FROM public.hc_governed_clinical_rules
        WHERE tenant_id = NEW.tenant_id
          AND rule_code = NEW.rule_code
          AND jurisdiction_code = NEW.jurisdiction_code
          AND status = 'ACTIVE'
          AND id != NEW.id
          AND (
              NEW.effective_from <= COALESCE(effective_to, '9999-12-31'::timestamptz) AND
              COALESCE(NEW.effective_to, '9999-12-31'::timestamptz) >= effective_from
          );

        IF v_overlap_count > 0 THEN
            RAISE EXCEPTION 'Active rule time window overlap detected for rule_code % and jurisdiction %.', NEW.rule_code, NEW.jurisdiction_code;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hc_rule_non_overlap ON public.hc_governed_clinical_rules;
CREATE TRIGGER trg_hc_rule_non_overlap
    BEFORE INSERT OR UPDATE ON public.hc_governed_clinical_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_active_rule_overlap();


-- 4. Governance Role Authorization Trigger (H10-03 Invariant)
CREATE OR REPLACE FUNCTION public.fn_validate_governance_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('APPROVED', 'ACTIVE') AND OLD.status NOT IN ('APPROVED', 'ACTIVE') THEN
        IF NEW.enforcement IN ('BLOCK', 'ABSOLUTE_BLOCK') OR NEW.severity = 'CRITICAL' THEN
            IF NEW.approver_role IS NULL OR NEW.approver_role NOT IN ('chief_of_department', 'medical_director') THEN
                RAISE EXCEPTION 'Approval of BLOCK/ABSOLUTE_BLOCK rules requires chief_of_department or medical_director role.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hc_rule_governance_approval ON public.hc_governed_clinical_rules;
CREATE TRIGGER trg_hc_rule_governance_approval
    BEFORE UPDATE ON public.hc_governed_clinical_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validate_governance_approval();


-- 5. Immutability Trigger for Approved/Active/Superseded Rules (H10-02 Invariant)
CREATE OR REPLACE FUNCTION public.fn_prevent_governed_rule_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status != 'DRAFT' THEN
            RAISE EXCEPTION 'Non-DRAFT governed clinical rules cannot be deleted.';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED') THEN
            -- Only status, effective_to, and approval metadata may transition
            IF OLD.rule_checksum != NEW.rule_checksum OR
               OLD.conditions_dsl::text != NEW.conditions_dsl::text OR
               OLD.severity != NEW.severity OR
               OLD.enforcement != NEW.enforcement OR
               OLD.rule_code != NEW.rule_code OR
               OLD.rule_version != NEW.rule_version THEN
                RAISE EXCEPTION 'Approved or Active clinical rule artifacts are write-once immutable. Create a new rule version instead.';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hc_governed_rules_immutable ON public.hc_governed_clinical_rules;
CREATE TRIGGER trg_hc_governed_rules_immutable
    BEFORE UPDATE OR DELETE ON public.hc_governed_clinical_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_governed_rule_mutation();


-- 6. Resolve Active Rules PL/pgSQL Function
CREATE OR REPLACE FUNCTION public.resolve_active_rules_at(
    p_tenant_id UUID,
    p_target_time TIMESTAMPTZ,
    p_jurisdiction TEXT DEFAULT 'LOCAL'
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    rule_code TEXT,
    rule_version TEXT,
    jurisdiction_code TEXT,
    status TEXT,
    severity TEXT,
    enforcement TEXT,
    conditions_dsl JSONB,
    rule_checksum TEXT,
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    author_id TEXT,
    approver_id TEXT,
    approver_role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.tenant_id,
        r.rule_code,
        r.rule_version,
        r.jurisdiction_code,
        r.status,
        r.severity,
        r.enforcement,
        r.conditions_dsl,
        r.rule_checksum,
        r.effective_from,
        r.effective_to,
        r.author_id,
        r.approver_id,
        r.approver_role
    FROM public.hc_governed_clinical_rules r
    WHERE r.tenant_id = p_tenant_id
      AND (r.jurisdiction_code = p_jurisdiction OR r.jurisdiction_code = 'GLOBAL')
      AND r.status = 'ACTIVE'
      AND r.effective_from <= p_target_time
      AND (r.effective_to IS NULL OR r.effective_to >= p_target_time)
    ORDER BY r.effective_from DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
