-- Migration: KTV Care Session Duration Tracking & Duration Warnings
-- Applied on 2026-05-19

-- 1. Add duration and warning columns to session_logs
ALTER TABLE public.session_logs 
  ADD COLUMN IF NOT EXISTS standard_duration INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS actual_duration INTEGER,
  ADD COLUMN IF NOT EXISTS time_deviation INTEGER,
  ADD COLUMN IF NOT EXISTS duration_warning_type VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ktv_checkout_note TEXT;

COMMENT ON COLUMN public.session_logs.standard_duration IS 'Standard package duration of the session in minutes';
COMMENT ON COLUMN public.session_logs.actual_duration IS 'Actual duration of the session in minutes (calculated checkout_time - checkin_time)';
COMMENT ON COLUMN public.session_logs.time_deviation IS 'Deviation of duration: actual_duration - standard_duration';
COMMENT ON COLUMN public.session_logs.duration_warning_type IS 'Duration warning category: normal, under_time, over_time';
COMMENT ON COLUMN public.session_logs.ktv_checkout_note IS 'Reason/notes recorded by KTV for under_time warning';
