-- ==========================================
-- BELLA SPA: WAITLIST MANAGEMENT SYSTEM
-- Date: 2026-07-12
-- Purpose: Intelligent waitlist management with priority ranking,
--          auto-notification, and slot matching
-- 
-- Business Goals:
-- - Capture lost revenue when slots unavailable
-- - Maximize waitlist conversion rate (target: 60%+)
-- - Improve customer experience (proactive notifications)
-- - Reduce idle time (fill cancellations quickly)
-- ==========================================

-- ============================================================================
-- CLEANUP: Drop existing objects if they exist (for re-running migration)
-- ============================================================================
DROP INDEX IF EXISTS unique_active_waitlist;
DROP TABLE IF EXISTS waitlist_notification_logs CASCADE;
DROP TABLE IF EXISTS waitlist_entries CASCADE;

-- ============================================================================
-- TABLE: waitlist_entries
-- Purpose: Manages customer waitlist with priority-based ranking
-- ============================================================================

CREATE TABLE IF NOT EXISTS waitlist_entries (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Tenant Isolation (CRITICAL for multi-tenancy)
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Customer & Booking Context
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL, -- Denormalized for performance
    customer_tier TEXT NOT NULL CHECK (customer_tier IN ('vip', 'loyal', 'new')) DEFAULT 'new',
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- Optional: if waitlist from failed booking
    booking_request_id TEXT, -- Internal tracking ID
    
    -- Service Details (NOTE: services = packages in Bella ERP)
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL, -- Denormalized for performance
    booking_value DECIMAL(10,2) NOT NULL DEFAULT 0, -- VND amount
    
    -- Preferred Schedule
    preferred_date DATE NOT NULL,
    preferred_start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    
    -- Preferred Assignments (Optional)
    preferred_ktv_id UUID REFERENCES users(id) ON DELETE SET NULL,
    preferred_ktv_name TEXT,
    preferred_resource_id UUID REFERENCES booking_resources(id) ON DELETE SET NULL,
    preferred_resource_name TEXT,
    
    -- Flexibility
    is_flexible BOOLEAN DEFAULT FALSE, -- Can accept alternative times/dates
    
    -- Priority Calculation (0-100 scale)
    priority_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- Total score
    tier_score DECIMAL(5,2) DEFAULT 0, -- Customer tier contribution (VIP: 40, Loyal: 25, New: 10)
    value_score DECIMAL(5,2) DEFAULT 0, -- Booking value contribution (0-30)
    wait_time_score DECIMAL(5,2) DEFAULT 0, -- Wait time contribution (0-20)
    flexibility_bonus DECIMAL(5,2) DEFAULT 0, -- Flexibility contribution (0-10)
    
    -- Queue Position
    position INTEGER NOT NULL DEFAULT 0, -- Current position in queue (1 = first)
    wait_minutes INTEGER DEFAULT 0, -- Time waited so far (auto-incremented)
    estimated_wait_minutes INTEGER DEFAULT 0, -- Estimated remaining wait
    
    -- Status Lifecycle
    -- active: waiting for slot
    -- notified: notification sent to customer
    -- reserved: slot temporarily held for customer
    -- converted: successfully booked
    -- expired: timeout (> 24 hours)
    -- cancelled: manually removed by admin or customer
    status TEXT NOT NULL CHECK (status IN ('active', 'notified', 'reserved', 'converted', 'expired', 'cancelled')) DEFAULT 'active',
    
    -- Reservation Tracking (when status = 'reserved')
    reserved_at TIMESTAMPTZ,
    reservation_expires_at TIMESTAMPTZ,
    
    -- Expiry Management
    expires_at TIMESTAMPTZ NOT NULL, -- Auto-expire after config hours (default: 24)
    
    -- Notification Tracking
    notification_channel TEXT CHECK (notification_channel IN ('zalo', 'sms', 'email', 'push')),
    notified_at TIMESTAMPTZ,
    notification_count INTEGER DEFAULT 0,
    last_notification_at TIMESTAMPTZ,
    
    -- Conversion Tracking
    converted_to_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    
    -- Cancellation/Removal
    removal_reason TEXT, -- If status = 'cancelled'
    removed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    removed_at TIMESTAMPTZ,
    
    -- Metadata & Notes
    notes TEXT,
    internal_notes TEXT, -- Admin-only notes
    
    -- Audit
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- UNIQUE CONSTRAINT (Partial Index)
-- Prevent duplicate active entries for same customer/service/date
-- Only enforce for active statuses (allow historical duplicates)
-- ============================================================================
CREATE UNIQUE INDEX unique_active_waitlist 
ON waitlist_entries(tenant_id, customer_id, package_id, preferred_date)
WHERE status IN ('active', 'notified', 'reserved');

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================

-- Tenant isolation (most queries filter by tenant)
CREATE INDEX idx_waitlist_tenant_id ON waitlist_entries(tenant_id);

-- Customer lookup
CREATE INDEX idx_waitlist_customer_id ON waitlist_entries(customer_id);

-- Service & Date filtering (slot matching)
CREATE INDEX idx_waitlist_package_date ON waitlist_entries(package_id, preferred_date);

-- Status filtering (active, notified, etc.)
CREATE INDEX idx_waitlist_status ON waitlist_entries(status);

-- Priority-based queue ordering (highest score first, then oldest entry)
CREATE INDEX idx_waitlist_priority_queue ON waitlist_entries(tenant_id, package_id, preferred_date, priority_score DESC, created_at ASC)
    WHERE status IN ('active', 'notified');

-- Expiry cleanup (find expired entries)
CREATE INDEX idx_waitlist_expires_at ON waitlist_entries(expires_at)
    WHERE status IN ('active', 'notified');

-- Position tracking (for recalculation)
CREATE INDEX idx_waitlist_position ON waitlist_entries(tenant_id, package_id, preferred_date, position);

-- Conversion tracking (reporting)
CREATE INDEX idx_waitlist_converted_at ON waitlist_entries(converted_at)
    WHERE status = 'converted';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Note: Triggers commented out (require functions that may not exist)
-- Uncomment after creating necessary functions:
-- 1. update_updated_at_column() - Auto-update updated_at
-- 2. audit_log_trigger() - Track all changes

-- CREATE TRIGGER update_waitlist_entries_updated_at
--     BEFORE UPDATE ON waitlist_entries
--     FOR EACH ROW
--     EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER audit_waitlist_entries
--     AFTER INSERT OR UPDATE OR DELETE ON waitlist_entries
--     FOR EACH ROW
--     EXECUTE FUNCTION audit_log_trigger();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant view waitlist_entries" ON waitlist_entries
    FOR ALL
    TO authenticated
    USING (is_hq_super_admin() OR (tenant_id = get_auth_tenant_id()))
    WITH CHECK (is_hq_super_admin() OR (tenant_id = get_auth_tenant_id()));

CREATE POLICY "Tenant isolation for waitlist_entries" ON waitlist_entries
    FOR ALL
    TO public
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- TABLE: waitlist_notification_logs
-- Purpose: Track all notifications sent to waitlist customers
-- ============================================================================

CREATE TABLE IF NOT EXISTS waitlist_notification_logs (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Tenant Isolation
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Relationships
    waitlist_entry_id UUID NOT NULL REFERENCES waitlist_entries(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Notification Details
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'slot_available',    -- Slot became available
        'position_updated',  -- Moved up in queue
        'expiring_soon',     -- Entry will expire soon
        'expired',           -- Entry expired
        'reserved'           -- Slot reserved for customer
    )),
    
    channel TEXT NOT NULL CHECK (channel IN ('zalo', 'sms', 'email', 'push')),
    
    -- Status Tracking
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending',
    
    -- Message Content
    message_content TEXT,
    message_template_id TEXT, -- Reference to template used
    
    -- Delivery Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ, -- If channel supports read receipts
    
    -- Error Handling
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Response Tracking (if customer responds)
    customer_response TEXT, -- e.g., "accept", "decline", "later"
    customer_response_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB, -- Additional context (slot details, etc.)
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (waitlist_notification_logs)
-- ============================================================================

CREATE INDEX idx_notification_logs_tenant_id ON waitlist_notification_logs(tenant_id);
CREATE INDEX idx_notification_logs_entry_id ON waitlist_notification_logs(waitlist_entry_id);
CREATE INDEX idx_notification_logs_customer_id ON waitlist_notification_logs(customer_id);
CREATE INDEX idx_notification_logs_status ON waitlist_notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON waitlist_notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_sent_at ON waitlist_notification_logs(sent_at DESC)
    WHERE status = 'sent';

-- ============================================================================
-- RLS (waitlist_notification_logs) 
-- ============================================================================

ALTER TABLE waitlist_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant view waitlist_notification_logs" ON waitlist_notification_logs
    FOR ALL
    TO authenticated
    USING (is_hq_super_admin() OR (tenant_id = get_auth_tenant_id()))
    WITH CHECK (is_hq_super_admin() OR (tenant_id = get_auth_tenant_id()));

CREATE POLICY "Tenant isolation for waitlist_notification_logs" ON waitlist_notification_logs
    FOR ALL
    TO public
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE waitlist_entries IS 'Manages customer waitlist with intelligent priority ranking and auto-notification';
COMMENT ON COLUMN waitlist_entries.priority_score IS 'Total priority score (0-100): tier + value + wait_time + flexibility. Higher = higher priority.';
COMMENT ON COLUMN waitlist_entries.position IS 'Current position in queue (1 = first). Auto-recalculated when waitlist changes.';
COMMENT ON COLUMN waitlist_entries.status IS 'Lifecycle: active → notified → reserved → converted (or expired/cancelled)';
COMMENT ON COLUMN waitlist_entries.is_flexible IS 'Customer can accept alternative times/dates (gets priority boost +10)';
COMMENT ON COLUMN waitlist_entries.wait_minutes IS 'Total minutes customer has been waiting (auto-incremented by cron job)';
COMMENT ON COLUMN waitlist_entries.customer_tier IS 'Customer tier from membership: vip (40pts), loyal (25pts), new (10pts)';
COMMENT ON COLUMN waitlist_entries.booking_value IS 'Total booking value in VND (contributes 0-30 priority points)';
COMMENT ON COLUMN waitlist_entries.package_id IS 'Service package customer wants to book (references packages.id, NOT services.id)';

COMMENT ON TABLE waitlist_notification_logs IS 'Tracks all notifications sent to waitlist customers (Zalo, SMS, Email)';
COMMENT ON COLUMN waitlist_notification_logs.notification_type IS 'Type: slot_available (notify when slot free), position_updated (moved up), expiring_soon (remind), expired (timeout)';
COMMENT ON COLUMN waitlist_notification_logs.status IS 'Lifecycle: pending → sent (or failed). Retry up to 3 times on failure.';
COMMENT ON COLUMN waitlist_notification_logs.channel IS 'Delivery channel: zalo (preferred for VIP), sms, email, push';
COMMENT ON COLUMN waitlist_notification_logs.customer_response IS 'Customer action: accept (book), decline (remove), later (keep in queue)';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users (RLS policies control access)
GRANT SELECT, INSERT, UPDATE, DELETE ON waitlist_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON waitlist_notification_logs TO authenticated;

-- Grant access to service role (for backend operations)
GRANT ALL ON waitlist_entries TO service_role;
GRANT ALL ON waitlist_notification_logs TO service_role;

-- ============================================================================
-- MIGRATION VALIDATION
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waitlist_entries') THEN
        RAISE EXCEPTION 'Migration failed: waitlist_entries table not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waitlist_notification_logs') THEN
        RAISE EXCEPTION 'Migration failed: waitlist_notification_logs table not created';
    END IF;
    
    RAISE NOTICE 'Waitlist tables created successfully';
END $$;
