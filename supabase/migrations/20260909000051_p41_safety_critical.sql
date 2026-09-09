-- ============================================================================
-- Bella Preschool OS - Phase 4.1 Safety Critical Domain
-- ============================================================================
-- Migration: 20260909000051_p41_safety_critical
-- Description:
--   - Allergy Exposure Hard Block definitions (Allergen, Ingredients, Meal bindings)
--   - Medication Anti-Double-Dose (Authorization, Dose Occurrence, Log)
--   - Health Incident Escalation (Incident severity, escalation workflow)
--
-- Constitution Compliance:
--   - Strictly additive tables in preschool product boundary.
--   - No imports or tables from Healthcare OS.
--   - Strict foreign keys to canonical `students` table (student_id).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALLERGY & MEAL DEPENDENCY
-- ----------------------------------------------------------------------------

-- edu_allergens: Canonical dictionary of allergens
CREATE TABLE IF NOT EXISTS public.edu_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_allergen_name UNIQUE (tenant_id, name)
);

-- edu_child_allergies: Student allergy profile
CREATE TABLE IF NOT EXISTS public.edu_child_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  allergen_id UUID NOT NULL REFERENCES public.edu_allergens(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE')),
  reaction_notes TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_student_allergen UNIQUE (tenant_id, student_id, allergen_id)
);

-- edu_food_ingredients: Canonical food ingredients
CREATE TABLE IF NOT EXISTS public.edu_food_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_ingredient_name UNIQUE (tenant_id, name)
);

-- edu_ingredient_allergens: Mapping ingredients to allergens
CREATE TABLE IF NOT EXISTS public.edu_ingredient_allergens (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.edu_food_ingredients(id) ON DELETE CASCADE,
  allergen_id UUID NOT NULL REFERENCES public.edu_allergens(id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, allergen_id)
);

-- edu_meal_items: The actual meal entity assigned to students
CREATE TABLE IF NOT EXISTS public.edu_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- edu_meal_item_ingredients: Meal recipe
CREATE TABLE IF NOT EXISTS public.edu_meal_item_ingredients (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meal_item_id UUID NOT NULL REFERENCES public.edu_meal_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.edu_food_ingredients(id) ON DELETE CASCADE,
  PRIMARY KEY (meal_item_id, ingredient_id)
);

-- ----------------------------------------------------------------------------
-- 2. MEDICATION DOMAIN
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.edu_medication_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  authorized_dose TEXT NOT NULL,
  authorized_by_guardian_id UUID NOT NULL REFERENCES public.persons(id),
  authorized_at TIMESTAMPTZ NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  evidence_id UUID,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.persons(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.edu_medication_dose_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  authorization_id UUID NOT NULL REFERENCES public.edu_medication_authorizations(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'SKIPPED', 'MISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.edu_medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dose_occurrence_id UUID NOT NULL REFERENCES public.edu_medication_dose_occurrences(id) ON DELETE CASCADE,
  administered_at TIMESTAMPTZ NOT NULL,
  dose_given TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.persons(id),
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'SKIPPED', 'ERROR')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hard Invariant: Anti-Double Dose Protection
CREATE UNIQUE INDEX uq_completed_medication_dose
ON public.edu_medication_logs (tenant_id, dose_occurrence_id)
WHERE status = 'COMPLETED';

-- ----------------------------------------------------------------------------
-- 3. HEALTH INCIDENTS & ESCALATION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.edu_health_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  incident_time TIMESTAMPTZ NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('MINOR', 'MODERATE', 'SEVERE', 'CRITICAL')),
  description TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.persons(id),
  
  -- Escalation Flow
  escalation_required BOOLEAN NOT NULL DEFAULT false,
  parent_notified_at TIMESTAMPTZ,
  escalation_acknowledged_at TIMESTAMPTZ,
  escalation_notes TEXT,
  
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Hard DB constraints on escalation
  CONSTRAINT check_incident_escalation CHECK (
    (severity NOT IN ('SEVERE', 'CRITICAL') OR escalation_required = true)
  ),
  CONSTRAINT check_incident_closure CHECK (
    (status != 'CLOSED') OR (escalation_required = false) OR (escalation_acknowledged_at IS NOT NULL)
  )
);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

DO $$
DECLARE
  t_name TEXT;
  tables_to_secure TEXT[] := ARRAY[
    'edu_allergens', 'edu_child_allergies', 'edu_food_ingredients', 
    'edu_ingredient_allergens', 'edu_meal_items', 'edu_meal_item_ingredients',
    'edu_medication_authorizations', 'edu_medication_dose_occurrences', 
    'edu_medication_logs', 'edu_health_incidents'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables_to_secure
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);
    
    EXECUTE format('
      DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I;
      CREATE POLICY %I_tenant_isolation ON public.%I
        FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> ''tenant_id'')::UUID);
    ', t_name, t_name, t_name, t_name);

    EXECUTE format('
      DROP POLICY IF EXISTS %I_service_role ON public.%I;
      CREATE POLICY %I_service_role ON public.%I
        FOR ALL TO service_role USING (true);
    ', t_name, t_name, t_name, t_name);
  END LOOP;
END $$;
