-- =============================================================================
-- Migration: Enterprise Platform Phase C Baseline
-- Ngày: 2026-08-07
-- Phân kỳ: Phase C – TOGAF Enterprise Governance & Ecosystem
-- Cam kết: ADDITIVE ONLY – Zero Regression trên beauty_spa, babycare
-- =============================================================================

-- 1. Architecture Decision Records (ADR) Repository
CREATE TABLE IF NOT EXISTS public.arch_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adr_code TEXT NOT NULL,              -- e.g. 'ADR-001', 'ADR-002'
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'accepted', 'deprecated', 'superseded')),
    decision_type TEXT NOT NULL DEFAULT 'ADR'
        CHECK (decision_type IN ('ADR', 'BDR', 'SDR', 'TDR', 'AIDR')),
    context TEXT NOT NULL,               -- Bối cảnh & vấn đề
    decision TEXT NOT NULL,              -- Quyết định
    rationale TEXT NOT NULL,             -- Lý do
    consequences TEXT,                   -- Hệ quả
    superseded_by TEXT,                  -- Mã ADR thay thế
    tags TEXT[] DEFAULT '{}',
    author TEXT,
    reviewed_by TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    UNIQUE(adr_code)
);

-- 2. Architecture Review Board (ARB) Reviews
CREATE TABLE IF NOT EXISTS public.arch_arb_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adr_id UUID NOT NULL REFERENCES public.arch_decisions(id) ON DELETE CASCADE,
    reviewer_name TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('approved', 'rejected', 'needs_revision', 'abstain')),
    comments TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 3. Technical Debt Register
CREATE TABLE IF NOT EXISTS public.arch_tech_debt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_code TEXT NOT NULL,             -- e.g. 'TD-001'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'code'
        CHECK (category IN ('code', 'architecture', 'data', 'security', 'infra', 'test', 'doc')),
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    effort_days INTEGER NOT NULL DEFAULT 1,
    affected_module TEXT,               -- e.g. 'bella_healthcare', 'beauty_spa'
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'accepted_risk', 'wont_fix')),
    remediation_plan TEXT,
    target_quarter TEXT,                -- e.g. 'Q3-2026'
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    UNIQUE(debt_code)
);

-- 4. Platform Maturity Scorecard
CREATE TABLE IF NOT EXISTS public.arch_maturity_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    dimension TEXT NOT NULL,            -- 'architecture', 'security', 'performance', 'quality', 'observability', 'ai'
    score NUMERIC(4,1) NOT NULL CHECK (score >= 0 AND score <= 10),
    notes TEXT,
    assessed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    UNIQUE(assessment_date, dimension)
);

-- 5. Industry Pack Registry (Canonical Multi-Industry Registry)
CREATE TABLE IF NOT EXISTS public.platform_industry_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_code TEXT NOT NULL,            -- 'bella_healthcare', 'beauty_spa', 'babycare', 'bella_auto', 'real_estate'
    pack_name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'review', 'active', 'deprecated', 'sunset')),
    enabled_capabilities TEXT[] DEFAULT '{}',
    country_packs TEXT[] DEFAULT '{}',  -- e.g. ['VN', 'SG', 'MY']
    compliance_standards TEXT[] DEFAULT '{}', -- e.g. ['HIPAA', 'GDPR', 'ISO27001', 'BHYT_130']
    maturity_level INTEGER DEFAULT 1 CHECK (maturity_level BETWEEN 1 AND 5),
    is_frozen BOOLEAN DEFAULT false,
    frozen_reason TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    UNIQUE(pack_code, version)
);

-- 6. AI Agent Platform Registry
CREATE TABLE IF NOT EXISTS public.platform_ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_code TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    description TEXT,
    agent_type TEXT NOT NULL DEFAULT 'assistant'
        CHECK (agent_type IN ('assistant', 'autopilot', 'copilot', 'evaluator', 'orchestrator', 'classifier')),
    model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'deprecated', 'disabled')),
    skills TEXT[] DEFAULT '{}',
    avg_latency_ms INTEGER,
    total_calls INTEGER DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    monthly_cost_usd NUMERIC(10,4) DEFAULT 0,
    enabled_for_tenants TEXT[] DEFAULT '{}',  -- '*' = all tenants
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    UNIQUE(agent_code)
);

-- 7. AI Prompt Ledger (Token Cost Audit Trail)
CREATE TABLE IF NOT EXISTS public.platform_ai_prompt_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_code TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id),
    user_id UUID,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT true,
    called_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arch_decisions_status ON public.arch_decisions(status);
CREATE INDEX IF NOT EXISTS idx_arch_decisions_type ON public.arch_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_arch_tech_debt_severity ON public.arch_tech_debt(severity, status);
CREATE INDEX IF NOT EXISTS idx_arch_tech_debt_module ON public.arch_tech_debt(affected_module);
CREATE INDEX IF NOT EXISTS idx_platform_packs_status ON public.platform_industry_packs(status);
CREATE INDEX IF NOT EXISTS idx_platform_agents_status ON public.platform_ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_ledger_tenant ON public.platform_ai_prompt_ledger(tenant_id, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_arch_maturity_date ON public.arch_maturity_scores(assessment_date DESC);

-- RLS (no tenant isolation – Enterprise-level tables visible to super_admin only)
ALTER TABLE public.arch_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arch_arb_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arch_tech_debt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arch_maturity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_industry_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ai_prompt_ledger ENABLE ROW LEVEL SECURITY;

-- All enterprise tables: read for admins, full access for super_admin
DO $$ BEGIN
  DECLARE tbl TEXT;
  FOREACH tbl IN ARRAY ARRAY[
    'arch_decisions', 'arch_arb_reviews', 'arch_tech_debt',
    'arch_maturity_scores', 'platform_industry_packs',
    'platform_ai_agents', 'platform_ai_prompt_ledger'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_all" ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY "super_admin_all" ON public.%I FOR ALL TO authenticated USING (
         EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = ''super_admin'')
       )', tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS "admin_read" ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY "admin_read" ON public.%I FOR SELECT TO authenticated USING (
         EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN (''admin'', ''super_admin''))
       )', tbl
    );
  END LOOP;
END $$;

-- =============================================================================
-- Seed: Initial ADR Records (Enterprise Constitution ADRs)
-- =============================================================================
INSERT INTO public.arch_decisions (adr_code, title, status, decision_type, context, decision, rationale, tags, author)
VALUES
  ('ADR-001', 'Bella Host Enterprise Platform – Architecture Constitution v1.0', 'accepted', 'ADR',
   'Cần xác định hướng kiến trúc nền tảng dài hạn 15–20 năm cho Bella ERP đa ngành.',
   'Áp dụng TOGAF 10 + ISO/IEC/IEEE 42010 làm khung kiến trúc tham chiếu. Phân tách Host Platform → Industry Platform → Product Pack → Feature.',
   'Đây là kiến trúc Platform-of-Platforms mang tính scalable nhất, tránh vendor lock-in và cho phép mở rộng đa ngành.',
   ARRAY['togaf', 'iso42010', 'platform', 'constitution'], 'Enterprise Architecture Board'),

  ('ADR-002', 'Additive Migration Only – Zero Regression Invariant', 'accepted', 'ADR',
   'Cần đảm bảo mọi thay đổi database không phá vỡ tenant production đang chạy.',
   'Tất cả database migrations phải là ADDITIVE. Cấm tuyệt đối ALTER TABLE DROP COLUMN, NOT NULL constraint trên bảng cũ, hoặc DROP TABLE.',
   'Production tenants beauty_spa và babycare đang hoạt động liên tục. Zero Regression là cam kết pháp lý với khách hàng.',
   ARRAY['database', 'migration', 'zero-regression', 'beauty_spa', 'babycare'], 'Engineering Standards Board'),

  ('ADR-003', 'Strictly No `any` TypeScript Types Invariant', 'accepted', 'ADR',
   'Codebase TypeScript có xu hướng sử dụng `any` để bỏ qua type safety, gây ra runtime bugs khó truy vết.',
   'Cấm tuyệt đối explicit và implicit `any` type trong toàn bộ mã nguồn TypeScript. Sử dụng Generics, unknown, hoặc Supabase auto-generated schemas.',
   'Strict typing giúp phát hiện lỗi tại compile time thay vì runtime. Đây là điều kiện bắt buộc cho hệ thống y tế và tài chính.',
   ARRAY['typescript', 'type-safety', 'code-quality', 'constitution'], 'Engineering Standards Board'),

  ('ADR-004', 'Capability-First Enforcement – No Render Without Capability', 'accepted', 'ADR',
   'Các tính năng mới khi deploy có nguy cơ được render cho tất cả tenant kể cả tenant không có quyền.',
   'Core platform phải kiểm tra manifest.enabledCapabilities trước khi render bất kỳ menu, route hoặc provider nào. Default behavior là OFF.',
   'Prevents privilege escalation và đảm bảo tenant isolation. Beauty Spa không được thấy hospital features.',
   ARRAY['capability', 'rbac', 'tenant-isolation', 'constitution'], 'Platform Security Board'),

  ('ADR-005', 'Event-First Architecture – All State Changes Emit Domain Events', 'accepted', 'ADR',
   'Cần đảm bảo tính nhất quán dữ liệu và audit trail đầy đủ trong hệ thống đa tenant.',
   'Mọi thay đổi nghiệp vụ (booking, payment, session, clinical order) phải emit Domain Event bất biến vào Event Bus trước khi persist.',
   'Event sourcing giúp rebuild state, audit trail và tích hợp downstream services mà không tight coupling.',
   ARRAY['event-driven', 'domain-events', 'audit', 'saga'], 'Architecture Review Board')
ON CONFLICT (adr_code) DO NOTHING;

-- =============================================================================
-- Seed: Industry Pack Registry (Canonical)
-- =============================================================================
INSERT INTO public.platform_industry_packs (pack_code, pack_name, description, version, status, enabled_capabilities, country_packs, maturity_level, is_frozen)
VALUES
  ('bella_healthcare', 'Bella Healthcare Platform', 'Phân hệ y tế toàn diện: Clinic, Hospital, Dental, Pharmacy', '3.0.0', 'active',
   ARRAY['medical_clinic','dental','pharmacy','hospital_inpatient','bed_engine','smart_queue','break_glass_security','ancillary_integration','bhyt_connector'],
   ARRAY['VN'], ARRAY['HIPAA','BHYT_130','ISO27001'], 4, false),

  ('beauty_spa', 'Bella Beauty Spa', 'Phân hệ spa & beauty: Booking, KTV, Commission, Salary', '2.5.0', 'active',
   ARRAY['booking','session_management','ktv_management','commission_engine','salary_engine','inventory'],
   ARRAY['VN'], ARRAY['GDPR'], 4, true),

  ('babycare', 'Bella Babycare', 'Phân hệ chăm sóc mẹ và bé: Packages, Sessions, Nutrition', '1.8.0', 'active',
   ARRAY['package_management','session_tracking','ktv_management','nutrition_tracking'],
   ARRAY['VN'], ARRAY['GDPR'], 3, true),

  ('bella_auto', 'Bella Auto', 'Phân hệ bán lẻ & dịch vụ ô tô: Inventory, Service, CRM', '1.0.0', 'active',
   ARRAY['vehicle_inventory','service_orders','customer_crm','parts_management'],
   ARRAY['VN'], ARRAY[], 2, false),

  ('real_estate', 'Bella Real Estate', 'Phân hệ bất động sản: Project, Unit, Booking, Legal', '1.0.0', 'active',
   ARRAY['project_management','unit_inventory','buyer_crm','legal_docs'],
   ARRAY['VN'], ARRAY[], 2, false)
ON CONFLICT (pack_code, version) DO NOTHING;

-- =============================================================================
-- Seed: AI Agent Registry
-- =============================================================================
INSERT INTO public.platform_ai_agents (agent_code, agent_name, description, agent_type, model, status, skills, enabled_for_tenants)
VALUES
  ('ai-autopilot', 'Bella AI Autopilot', 'Quét vận hành hàng ngày, cảnh báo Telegram, gợi ý hành động', 'autopilot', 'gemini-2.0-flash', 'active',
   ARRAY['operations_scan','revenue_alert','attendance_alert','telegram_notify'], ARRAY['*']),

  ('ai-clinical-copilot', 'Bella Clinical AI Co-pilot', 'Hỗ trợ chẩn đoán lâm sàng, phát hiện chỉ số nguy kịch, gợi ý phác đồ', 'copilot', 'gemini-2.5-pro', 'active',
   ARRAY['lab_analysis','panic_value_detection','icd10_suggestion','drug_interaction_check'], ARRAY['bella_healthcare']),

  ('ai-salary-reconciler', 'Bella AI Salary Reconciler', 'Phát hiện sai lệch lương, gợi ý điều chỉnh và báo cáo kế toán', 'evaluator', 'gemini-2.0-flash', 'active',
   ARRAY['salary_diff_detect','kpi_sync','journal_reconcile'], ARRAY['beauty_spa','babycare']),

  ('ai-lead-qualifier', 'Bella AI Lead Qualifier', 'Phân loại và chấm điểm lead từ CRM, phân bổ theo SLA', 'classifier', 'gemini-2.0-flash', 'active',
   ARRAY['lead_scoring','crm_enrichment','rotation_assign'], ARRAY['bella_auto','real_estate'])
ON CONFLICT (agent_code) DO NOTHING;

-- =============================================================================
-- Seed: Tech Debt Register (Initial baseline)
-- =============================================================================
INSERT INTO public.arch_tech_debt (debt_code, title, description, category, severity, effort_days, affected_module, status, remediation_plan, target_quarter)
VALUES
  ('TD-001', 'Legacy `any` types in billing-actions.ts', 'Một số `any` cast còn tồn tại trong billing-actions.ts do Supabase client typing limitation', 'code', 'medium', 2, 'beauty_spa', 'open',
   'Migrate to Supabase generated Database<...> types, sử dụng type guards thay vì as any', 'Q3-2026'),

  ('TD-002', 'Missing E2E Tests for Hospital Bed Engine', 'BedEngineService chưa có E2E test chạy với real Supabase test instance', 'test', 'high', 3, 'bella_healthcare', 'open',
   'Thêm Playwright E2E test flow: Admit Patient → Assign Bed → Discharge → Verify Bed Status', 'Q3-2026'),

  ('TD-003', 'Accounting Outbox MANUAL_ENTRY type missing HEALTHCARE_INVOICE', 'accounting_outbox event_type constraint chưa bao gồm HEALTHCARE_INVOICE_CREATED event type', 'architecture', 'high', 1, 'bella_healthcare', 'open',
   'Thêm additive migration ALTER TABLE accounting_outbox ADD CHECK hoặc extend enum', 'Q3-2026'),

  ('TD-004', 'AI Agent Token Cost not tracked in production', 'Platform AI agents chưa ghi vết token usage vào platform_ai_prompt_ledger trong production flow', 'architecture', 'medium', 3, 'all', 'open',
   'Bọc tất cả AI calls trong AIPromptLedgerMiddleware ghi token count và cost trước khi return', 'Q4-2026')
ON CONFLICT (debt_code) DO NOTHING;

-- =============================================================================
-- Seed: Platform Maturity Scorecard (Initial Assessment)
-- =============================================================================
INSERT INTO public.arch_maturity_scores (assessment_date, dimension, score, notes, assessed_by)
VALUES
  (CURRENT_DATE, 'architecture', 9.6, 'TOGAF 10 + ISO 42010 compliant, 7-Volume EA Suite FROZEN v1.0.0', 'Chief Enterprise Architect'),
  (CURRENT_DATE, 'security', 8.8, 'Zero-Trust, ABAC, Break-Glass, RLS harden. Còn thiếu formal penetration test report', 'Platform Security Board'),
  (CURRENT_DATE, 'performance', 8.2, 'API < 200ms average, DB indexed. Chưa có formal load test với 1000 concurrent users', 'Engineering Standards Board'),
  (CURRENT_DATE, 'quality', 9.1, '181 critical tests passing. Strict TypeScript no-any enforced. Còn cần E2E coverage', 'Engineering Standards Board'),
  (CURRENT_DATE, 'observability', 7.5, 'Audit logs, AI Autopilot cron alerts. Chưa có Grafana/Prometheus production dashboard', 'Platform Engineering'),
  (CURRENT_DATE, 'ai', 8.5, 'AI Autopilot, Clinical Copilot, Salary Reconciler agents active. Chưa có formal AI governance review', 'AI Platform Board')
ON CONFLICT (assessment_date, dimension) DO NOTHING;
