-- ============================================================================
-- BELLA PRESCHOOL OS: P6.1 PARENT COMMUNICATION & ENGAGEMENT SCHEMA
-- Migration: 20260909000056_p61_parent_communication.sql
-- Description: Core communication persistence foundation incorporating 5 architectural corrections:
--              1. Three independent lifecycles (Delivery, Ack, Consent Response)
--              2. P6 consent response is communication evidence (P4 owns medication authorization)
--              3. Canonical guardian-student relationship guard
--              4. NO CASCADE DELETE on audit/evidence records
--              5. Append-only delivery attempts & per-recipient immutable sent snapshots
-- ============================================================================

-- 1. Communication Threads
CREATE TABLE IF NOT EXISTS public.edu_comm_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    student_id UUID NOT NULL,
    guardian_party_id UUID NOT NULL,
    thread_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL', -- GENERAL, CARE_DIGEST, HEALTH_INCIDENT, PORTFOLIO, CONSENT_REQUEST
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Communication Notices (Projections)
CREATE TABLE IF NOT EXISTS public.edu_comm_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    thread_id UUID NOT NULL REFERENCES public.edu_comm_threads(id), -- NO CASCADE DELETE
    source_domain VARCHAR(50) NOT NULL, -- P3_CLASSROOM, P4_CARE, P5_LEARNING, SCHOOL_ADMIN
    source_entity_type VARCHAR(50) NOT NULL, -- CARE_DIGEST, HEALTH_INCIDENT, MEDICATION_AUTH, PORTFOLIO, ANNOUNCEMENT
    source_entity_id UUID NOT NULL,
    publication_snapshot_ref VARCHAR(255),
    notice_category VARCHAR(50) NOT NULL DEFAULT 'INFO', -- INFO, CRITICAL, CONSENT, FEEDBACK_REQ
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    requirement_type VARCHAR(50) NOT NULL DEFAULT 'NOTICE_ONLY', -- NOTICE_ONLY, REQUIRES_ACK, REQUIRES_CONSENT
    title VARCHAR(255) NOT NULL,
    body_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    due_at TIMESTAMPTZ, -- SLA cutoff timestamp for ack/consent
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Delivery Records (Current aggregate delivery status per recipient/channel)
CREATE TABLE IF NOT EXISTS public.edu_comm_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    notice_id UUID NOT NULL REFERENCES public.edu_comm_notices(id), -- NO CASCADE DELETE
    recipient_party_id UUID NOT NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP', -- IN_APP, PUSH, EMAIL, SMS
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT, READY, SENT, DELIVERED, READ, FAILED
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Delivery Attempt History (Append-Only Delivery Retry History)
CREATE TABLE IF NOT EXISTS public.edu_comm_delivery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    delivery_id UUID NOT NULL REFERENCES public.edu_comm_deliveries(id), -- NO CASCADE DELETE
    notice_id UUID NOT NULL REFERENCES public.edu_comm_notices(id), -- NO CASCADE DELETE
    attempt_number INT NOT NULL,
    channel VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL, -- SUCCESS, FAILED
    error_code VARCHAR(50),
    error_details TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Acknowledgements (Explicit parent read/confirm records)
CREATE TABLE IF NOT EXISTS public.edu_comm_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    notice_id UUID NOT NULL REFERENCES public.edu_comm_notices(id), -- NO CASCADE DELETE
    guardian_party_id UUID NOT NULL,
    acknowledgement_type VARCHAR(30) NOT NULL DEFAULT 'ACKNOWLEDGED',
    status VARCHAR(30) NOT NULL DEFAULT 'ACKNOWLEDGED', -- ACKNOWLEDGED, EXPIRED
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signature_note TEXT,
    ip_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Consent Responses (Parent permission decision evidence)
CREATE TABLE IF NOT EXISTS public.edu_comm_consent_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    notice_id UUID NOT NULL REFERENCES public.edu_comm_notices(id), -- NO CASCADE DELETE
    guardian_party_id UUID NOT NULL,
    consent_scope VARCHAR(100) NOT NULL, -- FIELD_TRIP, PHOTO_RELEASE, MEDICATION_ADMIN, MEDICAL_TREATMENT
    decision VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, DECLINED, EXPIRED, REVOKED
    decision_at TIMESTAMPTZ,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    conditions TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    revocation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Parent & Staff Responses
CREATE TABLE IF NOT EXISTS public.edu_comm_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    thread_id UUID NOT NULL REFERENCES public.edu_comm_threads(id), -- NO CASCADE DELETE
    notice_id UUID REFERENCES public.edu_comm_notices(id), -- NO CASCADE DELETE
    sender_party_id UUID NOT NULL,
    sender_role VARCHAR(30) NOT NULL DEFAULT 'PARENT', -- PARENT, TEACHER, SCHOOL_STAFF
    response_text TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Communication Exceptions (Staff Work Queue)
CREATE TABLE IF NOT EXISTS public.edu_comm_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    notice_id UUID NOT NULL REFERENCES public.edu_comm_notices(id), -- NO CASCADE DELETE
    student_id UUID NOT NULL,
    guardian_party_id UUID NOT NULL,
    exception_type VARCHAR(50) NOT NULL, -- OVERDUE_ACK, OVERDUE_CONSENT, DELIVERY_FAILED, CONSENT_DECLINED
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    assigned_role VARCHAR(50) NOT NULL DEFAULT 'TEACHER', -- TEACHER, NURSE, PRINCIPAL, ADMIN
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED, BYPASSED
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Immutable Per-Recipient Sent Snapshots
CREATE TABLE IF NOT EXISTS public.edu_comm_sent_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    notice_id UUID NOT NULL REFERENCES public.edu_comm_notices(id), -- NO CASCADE DELETE
    recipient_party_id UUID NOT NULL,
    delivery_id UUID NOT NULL REFERENCES public.edu_comm_deliveries(id), -- NO CASCADE DELETE
    channel VARCHAR(30) NOT NULL,
    payload_snapshot JSONB NOT NULL,
    payload_hash VARCHAR(128) NOT NULL, -- SHA-256 Fingerprint
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_edu_comm_threads_tenant_student ON public.edu_comm_threads(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_threads_guardian ON public.edu_comm_threads(guardian_party_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_notices_thread ON public.edu_comm_notices(thread_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_notices_source ON public.edu_comm_notices(source_domain, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_deliveries_notice ON public.edu_comm_deliveries(notice_id, recipient_party_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_delivery_attempts_delivery ON public.edu_comm_delivery_attempts(delivery_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_acknowledgements_notice ON public.edu_comm_acknowledgements(notice_id, guardian_party_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_consent_responses_notice ON public.edu_comm_consent_responses(notice_id, guardian_party_id);
CREATE INDEX IF NOT EXISTS idx_edu_comm_exceptions_tenant_status ON public.edu_comm_exceptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_edu_comm_sent_snapshots_notice_recipient ON public.edu_comm_sent_snapshots(notice_id, recipient_party_id);

-- Immutability DB Trigger for Dispatched Sent Snapshots
CREATE OR REPLACE FUNCTION public.fn_check_sent_snapshot_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SENT_SNAPSHOT_IMMUTABLE_ERROR: Dispatched communication snapshots are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_sent_snapshot_immutable ON public.edu_comm_sent_snapshots;
CREATE TRIGGER trg_check_sent_snapshot_immutable
BEFORE UPDATE OR DELETE ON public.edu_comm_sent_snapshots
FOR EACH ROW EXECUTE FUNCTION public.fn_check_sent_snapshot_immutable();

-- Enable Row-Level Security (RLS)
ALTER TABLE public.edu_comm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_consent_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_comm_sent_snapshots ENABLE ROW LEVEL SECURITY;

-- Standard Multi-Tenant RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_threads') THEN
        CREATE POLICY tenant_isolation_edu_comm_threads ON public.edu_comm_threads FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_notices') THEN
        CREATE POLICY tenant_isolation_edu_comm_notices ON public.edu_comm_notices FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_deliveries') THEN
        CREATE POLICY tenant_isolation_edu_comm_deliveries ON public.edu_comm_deliveries FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_delivery_attempts') THEN
        CREATE POLICY tenant_isolation_edu_comm_delivery_attempts ON public.edu_comm_delivery_attempts FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_acknowledgements') THEN
        CREATE POLICY tenant_isolation_edu_comm_acknowledgements ON public.edu_comm_acknowledgements FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_consent_responses') THEN
        CREATE POLICY tenant_isolation_edu_comm_consent_responses ON public.edu_comm_consent_responses FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_responses') THEN
        CREATE POLICY tenant_isolation_edu_comm_responses ON public.edu_comm_responses FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_exceptions') THEN
        CREATE POLICY tenant_isolation_edu_comm_exceptions ON public.edu_comm_exceptions FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_comm_sent_snapshots') THEN
        CREATE POLICY tenant_isolation_edu_comm_sent_snapshots ON public.edu_comm_sent_snapshots FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
END $$;
