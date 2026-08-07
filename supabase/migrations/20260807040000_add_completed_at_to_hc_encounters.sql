-- Add completed_at column to hc_encounters table
ALTER TABLE public.hc_encounters 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update status check constraint to include 'completed'
ALTER TABLE public.hc_encounters DROP CONSTRAINT IF EXISTS hc_encounters_status_check;
ALTER TABLE public.hc_encounters ADD CONSTRAINT hc_encounters_status_check 
CHECK (status IN ('planned', 'arrived', 'triaged', 'in_progress', 'finished', 'completed', 'cancelled'));
