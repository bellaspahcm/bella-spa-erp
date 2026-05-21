-- Add missing columns to session_logs for GPS verification and correct tracking
ALTER TABLE session_logs
ADD COLUMN IF NOT EXISTS checkin_lat numeric,
ADD COLUMN IF NOT EXISTS checkin_lon numeric,
ADD COLUMN IF NOT EXISTS start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS end_time timestamp with time zone;
