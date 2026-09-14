-- ============================================================================
-- E8 - ENGLISH CENTER PARENT / STUDENT ENGAGEMENT
-- ============================================================================
-- Product: Bella English Center
-- Phase: E8
-- Purpose: Product-owned engagement templates, communication snapshots,
-- delivery state, and acknowledgement/response tracking.
-- Architecture: Product-level extension; student identity goes through
-- Education OS contracts and parent/guardian identity through Platform Party.
-- Compliance: Education OS Constitution, additive migration only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_engagement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.org_units(id) ON DELETE RESTRICT,
  code VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('attendance', 'progress', 'tuition', 'general')),
  default_channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_engagement_template_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.english_center_engagement_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  template_id UUID REFERENCES public.english_center_engagement_templates(id) ON DELETE SET NULL,
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('attendance', 'progress', 'tuition', 'manual')),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  english_enrollment_id UUID NOT NULL REFERENCES public.english_center_enrollments(id) ON DELETE CASCADE,
  student_party_id UUID NOT NULL,
  content_snapshot JSONB NOT NULL,
  recipient_snapshot JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'partially_sent', 'failed', 'cancelled')),
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  acknowledgement_status VARCHAR(30) NOT NULL DEFAULT 'not_required' CHECK (acknowledgement_status IN ('not_required', 'pending', 'acknowledged', 'declined')),
  idempotency_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_engagement_message_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.english_center_engagement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.english_center_engagement_messages(id) ON DELETE CASCADE,
  party_id UUID NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('student', 'parent', 'guardian')),
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'zalo_oa', 'push')),
  address_snapshot JSONB DEFAULT '{}'::jsonb,
  consent_status VARCHAR(20) NOT NULL CHECK (consent_status IN ('granted', 'denied', 'unknown')),
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  notification_id TEXT,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_engagement_recipient_channel UNIQUE (tenant_id, message_id, party_id, channel)
);

CREATE TABLE IF NOT EXISTS public.english_center_engagement_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.english_center_engagement_messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.english_center_engagement_recipients(id) ON DELETE CASCADE,
  response_type VARCHAR(30) NOT NULL CHECK (response_type IN ('acknowledgement', 'decline', 'reply')),
  body TEXT,
  actor_party_id UUID NOT NULL,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- zero-downtime: allow blocking-index - new E8 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_engagement_templates_scope
  ON public.english_center_engagement_templates(tenant_id, branch_id, category, is_active);

-- zero-downtime: allow blocking-index - new E8 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_engagement_messages_scope
  ON public.english_center_engagement_messages(tenant_id, branch_id, trigger_type, created_at DESC);

-- zero-downtime: allow blocking-index - new E8 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_engagement_messages_enrollment
  ON public.english_center_engagement_messages(tenant_id, english_enrollment_id, created_at DESC);

-- zero-downtime: allow blocking-index - new E8 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_engagement_recipients_message
  ON public.english_center_engagement_recipients(tenant_id, message_id, delivery_status);

-- zero-downtime: allow blocking-index - new E8 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_engagement_responses_message
  ON public.english_center_engagement_responses(tenant_id, message_id, responded_at DESC);

ALTER TABLE public.english_center_engagement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_engagement_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_engagement_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_engagement_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS english_center_engagement_templates_tenant_branch_isolation
  ON public.english_center_engagement_templates;

CREATE POLICY english_center_engagement_templates_tenant_branch_isolation
  ON public.english_center_engagement_templates
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND (
      branch_id IS NULL
      OR branch_id IN (
        SELECT org_unit_id
        FROM public.user_org_unit_access
        WHERE user_id = COALESCE(
          auth.uid(),
          NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
        )
          AND tenant_id = COALESCE(
            public.get_auth_tenant_id(),
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
          )
      )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND (
      branch_id IS NULL
      OR branch_id IN (
        SELECT org_unit_id
        FROM public.user_org_unit_access
        WHERE user_id = COALESCE(
          auth.uid(),
          NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
        )
          AND tenant_id = COALESCE(
            public.get_auth_tenant_id(),
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
          )
      )
    )
  );

DROP POLICY IF EXISTS english_center_engagement_messages_tenant_branch_isolation
  ON public.english_center_engagement_messages;

CREATE POLICY english_center_engagement_messages_tenant_branch_isolation
  ON public.english_center_engagement_messages
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

DROP POLICY IF EXISTS english_center_engagement_recipients_tenant_branch_isolation
  ON public.english_center_engagement_recipients;

CREATE POLICY english_center_engagement_recipients_tenant_branch_isolation
  ON public.english_center_engagement_recipients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.english_center_engagement_messages messages
      WHERE messages.id = english_center_engagement_recipients.message_id
        AND messages.tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
        AND messages.branch_id IN (
          SELECT org_unit_id
          FROM public.user_org_unit_access
          WHERE user_id = COALESCE(
            auth.uid(),
            NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
          )
            AND tenant_id = COALESCE(
              public.get_auth_tenant_id(),
              NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
            )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.english_center_engagement_messages messages
      WHERE messages.id = english_center_engagement_recipients.message_id
        AND messages.tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
        AND messages.branch_id IN (
          SELECT org_unit_id
          FROM public.user_org_unit_access
          WHERE user_id = COALESCE(
            auth.uid(),
            NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
          )
            AND tenant_id = COALESCE(
              public.get_auth_tenant_id(),
              NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
            )
        )
    )
  );

DROP POLICY IF EXISTS english_center_engagement_responses_tenant_branch_isolation
  ON public.english_center_engagement_responses;

CREATE POLICY english_center_engagement_responses_tenant_branch_isolation
  ON public.english_center_engagement_responses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.english_center_engagement_messages messages
      WHERE messages.id = english_center_engagement_responses.message_id
        AND messages.tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
        AND messages.branch_id IN (
          SELECT org_unit_id
          FROM public.user_org_unit_access
          WHERE user_id = COALESCE(
            auth.uid(),
            NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
          )
            AND tenant_id = COALESCE(
              public.get_auth_tenant_id(),
              NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
            )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.english_center_engagement_messages messages
      WHERE messages.id = english_center_engagement_responses.message_id
        AND messages.tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
        AND messages.branch_id IN (
          SELECT org_unit_id
          FROM public.user_org_unit_access
          WHERE user_id = COALESCE(
            auth.uid(),
            NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
          )
            AND tenant_id = COALESCE(
              public.get_auth_tenant_id(),
              NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
            )
        )
    )
  );

COMMENT ON TABLE public.english_center_engagement_templates IS
  'E8 product-owned English Center engagement template catalog.';
COMMENT ON TABLE public.english_center_engagement_messages IS
  'E8 product-owned immutable communication snapshots and message state.';
COMMENT ON TABLE public.english_center_engagement_recipients IS
  'E8 product-owned per-recipient channel delivery state.';
COMMENT ON TABLE public.english_center_engagement_responses IS
  'E8 product-owned acknowledgement and response tracking.';
