-- Add missing columns to session_logs for GPS verification and correct tracking
ALTER TABLE session_logs
ADD COLUMN checkin_lat numeric,
ADD COLUMN checkin_lon numeric,
ADD COLUMN start_time timestamp with time zone,
ADD COLUMN end_time timestamp with time zone;
