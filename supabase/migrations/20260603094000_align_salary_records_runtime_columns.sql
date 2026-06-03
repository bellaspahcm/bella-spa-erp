-- Align salary_records with the active salary workflow and generated types.
ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS total_sessions NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_bonus NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_bonus NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ktv_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_event_type TEXT,
  ADD COLUMN IF NOT EXISTS accounting_template_id UUID,
  ADD COLUMN IF NOT EXISTS accounting_review_status TEXT NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN IF NOT EXISTS accounting_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.salary_records
  DROP CONSTRAINT IF EXISTS salary_records_status_check;

ALTER TABLE public.salary_records
  ADD CONSTRAINT salary_records_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'published',
    'disputed',
    'confirmed',
    'approved',
    'paid',
    'finalized'
  ));

NOTIFY pgrst, 'reload schema';
