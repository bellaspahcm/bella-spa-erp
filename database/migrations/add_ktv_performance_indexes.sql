-- KTV Dashboard Performance Optimization Indexes
-- Issue: critical_data = 5s, sessions_fetch = 11s
-- Root cause: Missing indexes for KTV queries

-- 1. Speed up getCurrentUser() - users table lookup by ID and email
CREATE INDEX IF NOT EXISTS idx_users_id 
ON public.users (id);

CREATE INDEX IF NOT EXISTS idx_users_email 
ON public.users (email);

CREATE INDEX IF NOT EXISTS idx_users_tenant 
ON public.users (tenant_id);

-- 2. Speed up tenant status check
CREATE INDEX IF NOT EXISTS idx_tenants_id_status 
ON public.tenants (id, status);

-- 3. Speed up getKTVActiveSessions() - filter by completed_by_ktv_id + status
CREATE INDEX IF NOT EXISTS idx_session_logs_ktv_status 
ON public.session_logs (completed_by_ktv_id, status, start_time DESC);

-- 4. Speed up getKTVUpcomingSessions() - filter by assigned_ktv_id
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_ktv 
ON public.bookings (assigned_ktv_id);

-- 5. Speed up session joins by booking_id
CREATE INDEX IF NOT EXISTS idx_session_logs_booking 
ON public.session_logs (booking_id, session_number);

-- 6. Speed up booking status checks
CREATE INDEX IF NOT EXISTS idx_bookings_status 
ON public.bookings (status);

-- 7. Composite index for session lookups with completed_by_ktv_id + status
CREATE INDEX IF NOT EXISTS idx_session_logs_completed_ktv_status 
ON public.session_logs (completed_by_ktv_id, status);

-- Expected improvement:
-- - getCurrentUser(): 5000ms → ~100ms (50x faster)
-- - getTenantSettings(): included in above
-- - getKTVActiveSessions(): 2000ms → ~50ms (40x faster)
-- - getKTVUpcomingSessions(): 9000ms → ~200ms (45x faster)
-- TOTAL: 17s → ~0.5s (34x faster!)
