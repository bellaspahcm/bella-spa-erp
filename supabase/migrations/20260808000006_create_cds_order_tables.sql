-- ============================================================================
-- Bella Healthcare Platform — Phase C: Clinical Decision Support (CDS)
-- Migration: 20260808000006_create_cds_order_tables.sql
-- Governance: Clinical Intelligence Layer — Tier 3 Clinical Safety
-- Architecture: Global Clinical Knowledge + Tenant Policy + CPOE Orders
-- ============================================================================

-- ============================================================================
-- PART 1: UPGRADE hc_clinical_calculations
-- Add Phase C governance columns + immutability RULE
-- ============================================================================

-- Add new provenance columns for Phase C CDS governance
ALTER TABLE public.hc_clinical_calculations
  ADD COLUMN IF NOT EXISTS algorithm_category TEXT DEFAULT 'SCORE'
    CHECK (algorithm_category IN ('SCORE', 'CDS_CHECK', 'PROTOCOL_CHECK')),
  ADD COLUMN IF NOT EXISTS patient_id TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_base_version TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT,
  ADD COLUMN IF NOT EXISTS decision TEXT
    CHECK (decision IN ('PASSED', 'WARNED', 'BLOCKED', 'ABSOLUTE_BLOCKED')),
  ADD COLUMN IF NOT EXISTS enforcement TEXT
    CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL', 'N_A')),
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS causation_id UUID;

-- Extend algorithm_id CHECK to include CDS algorithms
ALTER TABLE public.hc_clinical_calculations
  DROP CONSTRAINT IF EXISTS hc_clinical_calculations_algorithm_id_check;

ALTER TABLE public.hc_clinical_calculations
  ADD CONSTRAINT hc_clinical_calculations_algorithm_id_check
  CHECK (algorithm_id IN (
    -- Phase B scoring algorithms
    'SOFA', 'APACHE_II', 'NEDOCS', 'ESI',
    -- Phase C CDS algorithms
    'DRUG_INTERACTION', 'ALLERGY_CHECK', 'PROTOCOL_ADHERENCE', 'CDS_SUMMARY'
  ));

-- Immutability: Block UPDATE and DELETE on hc_clinical_calculations
-- (critical for clinical decision audit trail)
CREATE OR REPLACE FUNCTION public.block_clinical_calculation_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'hc_clinical_calculations is an immutable audit ledger. UPDATE and DELETE are forbidden. (Constitution: Clinical Governance Rule)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_clinical_calculation_mutation ON public.hc_clinical_calculations;
CREATE TRIGGER trigger_block_clinical_calculation_mutation
  BEFORE UPDATE OR DELETE ON public.hc_clinical_calculations
  FOR EACH ROW EXECUTE FUNCTION public.block_clinical_calculation_mutation();

-- ============================================================================
-- PART 2: GLOBAL CLINICAL KNOWLEDGE TABLES
-- No tenant_id — governed centrally, append-only
-- ============================================================================

-- 1. Global Drug Catalog (ATC/WHO)
CREATE TABLE IF NOT EXISTS public.hc_drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_code TEXT NOT NULL UNIQUE,           -- ATC code: e.g. B01AC06 (Aspirin)
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  drug_class TEXT NOT NULL,                 -- 'ANTICOAGULANT', 'NSAID', 'ANTIBIOTIC', etc.
  atc_code TEXT,
  max_daily_dose_mg NUMERIC,
  weight_based_dosing BOOLEAN NOT NULL DEFAULT false,
  pediatric_contraindicated BOOLEAN NOT NULL DEFAULT false,
  pregnancy_category TEXT CHECK (pregnancy_category IN ('A', 'B', 'C', 'D', 'X')),
  kb_version TEXT NOT NULL DEFAULT '2026-08-01',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hc_drugs_code ON public.hc_drugs(drug_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hc_drugs_class ON public.hc_drugs(drug_class) WHERE is_active = true;

-- Immutability: Global KB is append-only
CREATE OR REPLACE FUNCTION public.block_global_kb_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Global Clinical Knowledge tables are append-only. Use is_active=false to deprecate records. (Clinical Governance Rule)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_hc_drugs_mutation ON public.hc_drugs;
CREATE TRIGGER trigger_block_hc_drugs_mutation
  BEFORE UPDATE OR DELETE ON public.hc_drugs
  FOR EACH ROW EXECUTE FUNCTION public.block_global_kb_mutation();

-- 2. Global Drug-Drug Interaction Knowledge Base
CREATE TABLE IF NOT EXISTS public.hc_drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Bidirectional: drug_a_code < drug_b_code (alphabetic) to prevent duplicates
  drug_a_code TEXT NOT NULL REFERENCES public.hc_drugs(drug_code) ON DELETE RESTRICT,
  drug_b_code TEXT NOT NULL REFERENCES public.hc_drugs(drug_code) ON DELETE RESTRICT,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
  enforcement TEXT NOT NULL CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  mechanism TEXT,                           -- 'CYP3A4 inhibition', 'QT prolongation', 'Additive bleeding risk'
  clinical_effect TEXT NOT NULL,
  management_guidance TEXT,
  evidence_level TEXT NOT NULL DEFAULT 'B' CHECK (evidence_level IN ('A', 'B', 'C')),
  source TEXT,                              -- 'Micromedex', 'Clinical Pharmacology', 'AHRQ'
  kb_version TEXT NOT NULL DEFAULT '2026-08-01',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforce canonical ordering (A ≤ B alphabetically) for bidirectional dedup
  CONSTRAINT unique_drug_interaction UNIQUE (drug_a_code, drug_b_code),
  CONSTRAINT drug_interaction_canonical_order CHECK (drug_a_code <= drug_b_code)
);

-- Index both directions for O(1) lookup: given drug X, find all interactions
CREATE INDEX IF NOT EXISTS idx_hc_ddi_drug_a ON public.hc_drug_interactions(drug_a_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hc_ddi_drug_b ON public.hc_drug_interactions(drug_b_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hc_ddi_severity ON public.hc_drug_interactions(severity, enforcement) WHERE is_active = true;

DROP TRIGGER IF EXISTS trigger_block_hc_drug_interactions_mutation ON public.hc_drug_interactions;
CREATE TRIGGER trigger_block_hc_drug_interactions_mutation
  BEFORE UPDATE OR DELETE ON public.hc_drug_interactions
  FOR EACH ROW EXECUTE FUNCTION public.block_global_kb_mutation();

-- 3. Global Clinical Protocols (Contraindications by patient context)
CREATE TABLE IF NOT EXISTS public.hc_clinical_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_code TEXT NOT NULL UNIQUE,
  drug_code TEXT REFERENCES public.hc_drugs(drug_code) ON DELETE RESTRICT,
  drug_class TEXT,                          -- applies to entire drug class if drug_code is NULL
  contraindication_type TEXT NOT NULL CHECK (
    contraindication_type IN ('AGE', 'WEIGHT', 'RENAL', 'HEPATIC', 'PREGNANCY', 'PEDIATRIC', 'DOSE_LIMIT')
  ),
  condition_spec JSONB NOT NULL,            -- e.g. {"max_age_years": 65} or {"min_weight_kg": 40}
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
  enforcement TEXT NOT NULL CHECK (enforcement IN ('ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  guideline_source TEXT,
  kb_version TEXT NOT NULL DEFAULT '2026-08-01',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hc_protocols_drug ON public.hc_clinical_protocols(drug_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hc_protocols_class ON public.hc_clinical_protocols(drug_class) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hc_protocols_type ON public.hc_clinical_protocols(contraindication_type) WHERE is_active = true;

DROP TRIGGER IF EXISTS trigger_block_hc_clinical_protocols_mutation ON public.hc_clinical_protocols;
CREATE TRIGGER trigger_block_hc_clinical_protocols_mutation
  BEFORE UPDATE OR DELETE ON public.hc_clinical_protocols
  FOR EACH ROW EXECUTE FUNCTION public.block_global_kb_mutation();

-- ============================================================================
-- PART 3: TENANT POLICY TABLES (RLS — customizable per tenant)
-- ============================================================================

-- 4. Tenant CDS Policy Overrides
-- Tenants may adjust global enforcement (e.g. BLOCK → ACKNOWLEDGE) for specific interactions
-- Constraint: Cannot downgrade ABSOLUTE_BLOCK to anything weaker
CREATE TABLE IF NOT EXISTS public.hc_tenant_cds_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  interaction_id UUID REFERENCES public.hc_drug_interactions(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES public.hc_clinical_protocols(id) ON DELETE CASCADE,
  override_enforcement TEXT NOT NULL
    CHECK (override_enforcement IN ('BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  -- ABSOLUTE_BLOCK cannot appear here — it cannot be overridden by any tenant
  override_reason TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'v1.0',
  approved_by TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Only one active override per tenant per interaction/protocol
  CONSTRAINT unique_tenant_cds_policy UNIQUE (tenant_id, interaction_id, protocol_id),
  -- Must reference either an interaction or a protocol, not both and not neither
  CONSTRAINT cds_policy_target_check CHECK (
    (interaction_id IS NOT NULL AND protocol_id IS NULL) OR
    (interaction_id IS NULL AND protocol_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_hc_tenant_cds_policies_tenant ON public.hc_tenant_cds_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_tenant_cds_policies_interaction ON public.hc_tenant_cds_policies(interaction_id);
CREATE INDEX IF NOT EXISTS idx_hc_tenant_cds_policies_protocol ON public.hc_tenant_cds_policies(protocol_id);

-- 5. Patient Allergies (Tenant-owned, encounter-referenced)
CREATE TABLE IF NOT EXISTS public.hc_patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  allergen_type TEXT NOT NULL CHECK (allergen_type IN ('DRUG', 'DRUG_CLASS', 'FOOD', 'ENVIRONMENT', 'CONTRAST')),
  allergen_code TEXT NOT NULL,             -- Drug ATC code, allergen identifier
  allergen_name TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (
    reaction_type IN ('ANAPHYLAXIS', 'ANGIOEDEMA', 'RASH', 'URTICARIA', 'GI', 'RESPIRATORY', 'OTHER')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('LIFE_THREATENING', 'SEVERE', 'MODERATE', 'MILD')),
  onset_date DATE,
  recorded_by TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hc_patient_allergies_patient ON public.hc_patient_allergies(tenant_id, patient_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hc_patient_allergies_encounter ON public.hc_patient_allergies(tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_patient_allergies_allergen ON public.hc_patient_allergies(tenant_id, allergen_code) WHERE is_active = true;

-- ============================================================================
-- PART 4: CPOE ORDER TABLES (RLS — tenant-owned)
-- ============================================================================

-- 6. Clinical Orders (CPOE master table)
CREATE TABLE IF NOT EXISTS public.hc_clinical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (
    order_type IN ('MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING')
  ),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    order_status IN ('PENDING', 'VALIDATED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DISCONTINUED', 'REJECTED')
  ),
  priority TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (priority IN ('STAT', 'URGENT', 'ROUTINE')),
  ordered_by TEXT NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  discontinued_by TEXT,
  discontinued_at TIMESTAMPTZ,
  discontinue_reason TEXT,
  cds_check_id UUID REFERENCES public.hc_clinical_calculations(id) ON DELETE SET NULL,
  cds_check_status TEXT CHECK (cds_check_status IN ('PASSED', 'WARNED', 'BLOCKED')),
  order_details JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_encounter ON public.hc_clinical_orders(tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_status ON public.hc_clinical_orders(tenant_id, order_status);
CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_type_status ON public.hc_clinical_orders(tenant_id, order_type, order_status);

-- 7. CDS Override Audit (Immutable — physicians justifying overrides)
CREATE TABLE IF NOT EXISTS public.hc_order_cds_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.hc_clinical_orders(id) ON DELETE CASCADE,
  cds_alert_id TEXT NOT NULL,              -- UUID from CdsAlert.alertId
  alert_type TEXT NOT NULL CHECK (alert_type IN ('DRUG_INTERACTION', 'ALLERGY', 'PROTOCOL')),
  alert_severity TEXT NOT NULL CHECK (alert_severity IN ('CRITICAL', 'WARNING', 'INFO')),
  alert_enforcement TEXT NOT NULL CHECK (alert_enforcement IN ('BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL')),
  -- ABSOLUTE_BLOCK cannot appear in overrides — it is physically impossible to override
  override_reason TEXT NOT NULL,
  overriding_clinician TEXT NOT NULL,
  overridden_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hc_order_cds_overrides_order ON public.hc_order_cds_overrides(order_id);
CREATE INDEX IF NOT EXISTS idx_hc_order_cds_overrides_tenant ON public.hc_order_cds_overrides(tenant_id);

-- Immutability: Override audit is write-once (chain of custody)
CREATE OR REPLACE FUNCTION public.block_cds_override_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'hc_order_cds_overrides is an immutable audit chain. UPDATE and DELETE are forbidden. (Clinical Governance Rule)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_cds_override_mutation ON public.hc_order_cds_overrides;
CREATE TRIGGER trigger_block_cds_override_mutation
  BEFORE UPDATE OR DELETE ON public.hc_order_cds_overrides
  FOR EACH ROW EXECUTE FUNCTION public.block_cds_override_mutation();

-- ============================================================================
-- PART 5: ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Global KB tables: No RLS (no tenant_id) — read by all authenticated
-- These are governed globally, writes are controlled at application layer
ALTER TABLE public.hc_drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_clinical_protocols ENABLE ROW LEVEL SECURITY;

-- Global KB read policy: all authenticated users can read
CREATE POLICY global_kb_read_all ON public.hc_drugs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY global_kb_read_all_ddi ON public.hc_drug_interactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY global_kb_read_all_protocols ON public.hc_clinical_protocols
  FOR SELECT TO authenticated USING (true);

-- Tenant tables: standard tenant isolation
ALTER TABLE public.hc_tenant_cds_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_clinical_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_order_cds_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cds_policies ON public.hc_tenant_cds_policies
  FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_patient_allergies ON public.hc_patient_allergies
  FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_clinical_orders ON public.hc_clinical_orders
  FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_cds_overrides ON public.hc_order_cds_overrides
  FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- ============================================================================
-- PART 6: GLOBAL KNOWLEDGE BASE SEED DATA
-- 10 clinically meaningful DDI pairs + 5 key drugs
-- ============================================================================

-- Seed global drug catalog
INSERT INTO public.hc_drugs (drug_code, drug_name, generic_name, drug_class, atc_code, max_daily_dose_mg, kb_version) VALUES
  ('B01AA03', 'Warfarin', 'warfarin sodium', 'ANTICOAGULANT', 'B01AA03', 15, '2026-08-01'),
  ('B01AC06', 'Aspirin', 'acetylsalicylic acid', 'NSAID_ANTIPLATELET', 'B01AC06', 4000, '2026-08-01'),
  ('A10BB03', 'Metformin', 'metformin hydrochloride', 'BIGUANIDE', 'A10BB03', 3000, '2026-08-01'),
  ('M01AE01', 'Ibuprofen', 'ibuprofen', 'NSAID', 'M01AE01', 3200, '2026-08-01'),
  ('C01AA05', 'Digoxin', 'digoxin', 'CARDIAC_GLYCOSIDE', 'C01AA05', 0.5, '2026-08-01'),
  ('C01BD01', 'Amiodarone', 'amiodarone hydrochloride', 'ANTIARRHYTHMIC', 'C01BD01', 400, '2026-08-01'),
  ('B01AE07', 'Dabigatran', 'dabigatran etexilate', 'ANTICOAGULANT_DOAC', 'B01AE07', 300, '2026-08-01'),
  ('N06AB06', 'Sertraline', 'sertraline hydrochloride', 'SSRI', 'N06AB06', 200, '2026-08-01'),
  ('N02AX02', 'Tramadol', 'tramadol hydrochloride', 'OPIOID_ANALGESIC', 'N02AX02', 400, '2026-08-01'),
  ('C07AB02', 'Metoprolol', 'metoprolol succinate', 'BETA_BLOCKER', 'C07AB02', 400, '2026-08-01')
ON CONFLICT (drug_code) DO NOTHING;

-- Seed 10 clinically meaningful DDI pairs (canonical order: A ≤ B alphabetically)
INSERT INTO public.hc_drug_interactions
  (drug_a_code, drug_b_code, severity, enforcement, mechanism, clinical_effect, management_guidance, evidence_level, source, kb_version)
VALUES
  -- 1. Warfarin + Aspirin (additive bleeding — BLOCK but overridable)
  ('B01AA03', 'B01AC06', 'CRITICAL', 'BLOCK',
   'Additive antiplatelet + anticoagulant effect; GI mucosal injury by Aspirin',
   'Significantly increased risk of major bleeding, particularly GI and intracranial hemorrhage',
   'Avoid combination unless clinically necessary (e.g. mechanical heart valve). If required, use lowest effective aspirin dose and monitor INR closely.',
   'A', 'Micromedex 2.0', '2026-08-01'),

  -- 2. Warfarin + Ibuprofen (NSAID bleeding risk — BLOCK)
  ('B01AA03', 'M01AE01', 'CRITICAL', 'BLOCK',
   'NSAIDs inhibit platelet aggregation and cause GI mucosal damage; displace warfarin from protein binding',
   'Increased risk of serious bleeding complications; warfarin INR may be unpredictably elevated',
   'Avoid NSAIDs in anticoagulated patients. Use paracetamol as analgesic alternative. If NSAID necessary, monitor INR daily.',
   'A', 'Micromedex 2.0', '2026-08-01'),

  -- 3. Metformin + Ibuprofen (renal — ACKNOWLEDGE)
  ('A10BB03', 'M01AE01', 'WARNING', 'ACKNOWLEDGE',
   'NSAIDs reduce renal blood flow, potentially reducing metformin clearance and increasing lactic acidosis risk',
   'Risk of metformin accumulation and lactic acidosis in patients with renal impairment',
   'Short-term use generally acceptable. Monitor renal function. Avoid in patients with CKD ≥3.',
   'B', 'Clinical Pharmacology', '2026-08-01'),

  -- 4. Digoxin + Amiodarone (toxicity — BLOCK)
  ('C01AA05', 'C01BD01', 'CRITICAL', 'BLOCK',
   'Amiodarone inhibits P-glycoprotein, increasing digoxin plasma levels by 70-100%',
   'Digoxin toxicity: bradycardia, AV block, ventricular arrhythmias, nausea, visual disturbances',
   'Reduce digoxin dose by 50% when initiating amiodarone. Monitor digoxin levels and ECG closely.',
   'A', 'Micromedex 2.0', '2026-08-01'),

  -- 5. Sertraline + Tramadol (serotonin syndrome — BLOCK)
  ('N02AX02', 'N06AB06', 'CRITICAL', 'BLOCK',
   'Combined serotonergic activity increases synaptic serotonin; tramadol also inhibits serotonin reuptake',
   'Serotonin syndrome: agitation, tremor, myoclonus, hyperthermia, diaphoresis — potentially fatal',
   'Avoid combination. Use non-serotonergic analgesic alternatives. If co-administration unavoidable, use lowest effective doses and monitor closely.',
   'B', 'Clinical Pharmacology', '2026-08-01'),

  -- 6. Metoprolol + Amiodarone (heart block — CRITICAL BLOCK)
  ('C01BD01', 'C07AB02', 'CRITICAL', 'BLOCK',
   'Additive negative chronotropic and dromotropic effects; amiodarone inhibits CYP2D6 (metoprolol metabolism)',
   'Severe bradycardia, AV block, or asystole. Metoprolol levels may increase 2-4x due to CYP2D6 inhibition.',
   'Avoid unless absolutely necessary. If required, use lowest metoprolol dose, monitor HR and ECG continuously.',
   'A', 'Micromedex 2.0', '2026-08-01'),

  -- 7. Aspirin + Dabigatran (bleeding — BLOCK)
  ('B01AC06', 'B01AE07', 'CRITICAL', 'BLOCK',
   'Dabigatran provides anticoagulation; aspirin adds antiplatelet effect and GI mucosal injury',
   'Significantly increased bleeding risk with DOAC + antiplatelet combination',
   'Avoid unless for approved clinical indication (e.g. recent ACS with AF). Document clinical justification.',
   'A', 'ESC Guidelines 2023', '2026-08-01'),

  -- 8. Warfarin + Amiodarone (INR potentiation — BLOCK)
  ('B01AA03', 'C01BD01', 'CRITICAL', 'BLOCK',
   'Amiodarone inhibits CYP2C9 (primary warfarin metabolism enzyme), dramatically increasing warfarin effect',
   'INR may increase 3-5x, leading to severe bleeding risk. Effect can persist weeks after stopping amiodarone.',
   'Reduce warfarin dose by 30-50% when initiating amiodarone. Monitor INR weekly for 1-2 months. Very long interaction duration due to amiodarone half-life.',
   'A', 'Micromedex 2.0', '2026-08-01'),

  -- 9. Digoxin + Aspirin (minor — INFORMATIONAL)
  ('B01AC06', 'C01AA05', 'INFO', 'INFORMATIONAL',
   'Aspirin may marginally reduce digoxin renal tubular secretion at high doses',
   'Minimal clinically significant interaction at normal aspirin doses',
   'No action required at usual doses. Be aware at high-dose aspirin (> 2g/day).',
   'C', 'Clinical Pharmacology', '2026-08-01'),

  -- 10. Metformin + Dabigatran (renal accumulation — ACKNOWLEDGE)
  ('A10BB03', 'B01AE07', 'WARNING', 'ACKNOWLEDGE',
   'Both drugs depend on renal clearance; renal impairment increases accumulation of both',
   'In patients with CKD, both agents may accumulate: dabigatran (bleeding risk) and metformin (lactic acidosis risk)',
   'Monitor eGFR regularly. Avoid combination if eGFR < 30 mL/min/1.73m². Consider dose adjustment.',
   'B', 'EMA Label', '2026-08-01')
ON CONFLICT (drug_a_code, drug_b_code) DO NOTHING;

-- Seed clinical protocol: Pediatric metformin contraindication
INSERT INTO public.hc_clinical_protocols
  (protocol_code, drug_code, contraindication_type, condition_spec, severity, enforcement, guideline_source, kb_version)
VALUES
  ('PROT-MET-PEDS-001', 'A10BB03', 'PEDIATRIC',
   '{"min_age_years": 10, "note": "Metformin not approved for children under 10"}',
   'CRITICAL', 'BLOCK', 'FDA Label / EMA SmPC', '2026-08-01'),
  ('PROT-WAR-PREG-001', 'B01AA03', 'PREGNANCY',
   '{"categories": ["X"], "note": "Warfarin is teratogenic — absolutely contraindicated in pregnancy"}',
   'CRITICAL', 'ABSOLUTE_BLOCK', 'FDA Label Category X', '2026-08-01'),
  ('PROT-DIG-DOSE-001', 'C01AA05', 'DOSE_LIMIT',
   '{"max_daily_dose_mg": 0.5, "note": "Narrow therapeutic window — toxicity risk above 0.5mg/day"}',
   'CRITICAL', 'BLOCK', 'Micromedex 2.0', '2026-08-01')
ON CONFLICT (protocol_code) DO NOTHING;
