-- =====================================================================================
-- Bella Auto Phase 10: Mobile Workforce (PWA)
-- Migration: 20260803300000
-- 
-- Tables:
-- 1. auto_mobile_sessions - Track mobile user sessions and device info
-- 2. auto_offline_actions - Queue actions performed offline
-- 3. auto_photo_uploads - Track photo uploads from mobile devices
-- 4. auto_mobile_notifications - Push notifications for mobile users
-- 
-- Features:
-- - Mobile session management
-- - Offline-first action queue with sync
-- - Photo upload tracking with compression metadata
-- - Push notification delivery
-- - Device registration for PWA
-- 
-- Zero Regression: All tables prefixed with 'auto_', no core table modifications
-- =====================================================================================

-- =====================================================================================
-- TABLE: auto_mobile_sessions
-- Purpose: Track mobile user sessions for analytics and security
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_mobile_sessions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- User Information
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('sales', 'service_advisor', 'technician', 'manager')),
  
  -- Device Information
  device_id TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web', 'pwa')),
  device_model TEXT,
  device_os_version TEXT,
  app_version TEXT,
  
  -- Session Information
  session_token TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Location (for showroom/workshop check-in)
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  location_accuracy NUMERIC(8, 2), -- meters
  location_name TEXT, -- "Showroom Hà Nội", "Xưởng Quận 7", etc.
  
  -- Network & Performance
  network_type TEXT, -- 'wifi', '4g', '5g', 'offline'
  is_offline_mode BOOLEAN DEFAULT false,
  
  -- Metadata
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auto_mobile_sessions_tenant ON auto_mobile_sessions(tenant_id);
CREATE INDEX idx_auto_mobile_sessions_user ON auto_mobile_sessions(user_id);
CREATE INDEX idx_auto_mobile_sessions_active ON auto_mobile_sessions(tenant_id, user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_auto_mobile_sessions_device ON auto_mobile_sessions(device_id);
CREATE INDEX idx_auto_mobile_sessions_token ON auto_mobile_sessions(session_token);

-- RLS Policies
ALTER TABLE auto_mobile_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_mobile_sessions_tenant_isolation ON auto_mobile_sessions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Users can only see their own sessions
CREATE POLICY auto_mobile_sessions_user_isolation ON auto_mobile_sessions
  FOR SELECT USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER trg_auto_mobile_sessions_updated_at
  BEFORE UPDATE ON auto_mobile_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- TABLE: auto_offline_actions
-- Purpose: Queue actions performed offline for later sync
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_offline_actions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- User & Session
  user_id UUID NOT NULL,
  session_id UUID REFERENCES auto_mobile_sessions(id) ON DELETE CASCADE,
  
  -- Action Information
  action_type TEXT NOT NULL CHECK (action_type IN (
    'lead_capture',
    'test_drive_log',
    'quotation_create',
    'service_appointment_create',
    'repair_order_update',
    'photo_capture',
    'parts_request',
    'job_complete',
    'customer_note'
  )),
  entity_type TEXT NOT NULL, -- 'lead', 'booking', 'repair_order', etc.
  entity_id UUID, -- Will be null until synced
  
  -- Action Payload
  action_data JSONB NOT NULL,
  
  -- Sync Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed', 'conflict')),
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  sync_error TEXT,
  
  -- Conflict Resolution
  conflict_resolution TEXT CHECK (conflict_resolution IN ('client_wins', 'server_wins', 'manual')),
  conflict_resolved_at TIMESTAMPTZ,
  conflict_resolved_by UUID,
  
  -- Priority (for sync order)
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auto_offline_actions_tenant ON auto_offline_actions(tenant_id);
CREATE INDEX idx_auto_offline_actions_user ON auto_offline_actions(user_id);
CREATE INDEX idx_auto_offline_actions_status ON auto_offline_actions(tenant_id, status);
CREATE INDEX idx_auto_offline_actions_pending ON auto_offline_actions(tenant_id, status, priority) 
  WHERE status = 'pending';
CREATE INDEX idx_auto_offline_actions_session ON auto_offline_actions(session_id);
CREATE INDEX idx_auto_offline_actions_entity ON auto_offline_actions(entity_type, entity_id);

-- RLS Policies
ALTER TABLE auto_offline_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_offline_actions_tenant_isolation ON auto_offline_actions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY auto_offline_actions_user_isolation ON auto_offline_actions
  FOR ALL USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER trg_auto_offline_actions_updated_at
  BEFORE UPDATE ON auto_offline_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- TABLE: auto_photo_uploads
-- Purpose: Track photo uploads from mobile devices with metadata
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_photo_uploads (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- User & Session
  user_id UUID NOT NULL,
  session_id UUID REFERENCES auto_mobile_sessions(id) ON DELETE SET NULL,
  
  -- Photo Information
  photo_category TEXT NOT NULL CHECK (photo_category IN (
    'vehicle_exterior',
    'vehicle_interior',
    'vehicle_damage',
    'customer_id',
    'repair_progress',
    'parts_condition',
    'before_service',
    'after_service',
    'test_drive_form',
    'quotation_signature',
    'other'
  )),
  
  -- Related Entity
  entity_type TEXT NOT NULL, -- 'vehicle', 'repair_order', 'trade_in', 'booking'
  entity_id UUID NOT NULL,
  
  -- File Information
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- bytes
  file_mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  storage_bucket TEXT NOT NULL DEFAULT 'auto-photos',
  
  -- Image Metadata
  original_width INTEGER,
  original_height INTEGER,
  compressed_width INTEGER,
  compressed_height INTEGER,
  compression_ratio NUMERIC(5, 2), -- Percentage
  
  -- Capture Information
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  device_type TEXT,
  
  -- Upload Status
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN (
    'pending',
    'uploading',
    'uploaded',
    'failed',
    'deleted'
  )),
  uploaded_at TIMESTAMPTZ,
  upload_error TEXT,
  
  -- Additional Metadata
  notes TEXT,
  tags TEXT[], -- Array of tags for filtering
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auto_photo_uploads_tenant ON auto_photo_uploads(tenant_id);
CREATE INDEX idx_auto_photo_uploads_user ON auto_photo_uploads(user_id);
CREATE INDEX idx_auto_photo_uploads_entity ON auto_photo_uploads(entity_type, entity_id);
CREATE INDEX idx_auto_photo_uploads_category ON auto_photo_uploads(tenant_id, photo_category);
CREATE INDEX idx_auto_photo_uploads_status ON auto_photo_uploads(tenant_id, upload_status);
CREATE INDEX idx_auto_photo_uploads_session ON auto_photo_uploads(session_id);

-- RLS Policies
ALTER TABLE auto_photo_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_photo_uploads_tenant_isolation ON auto_photo_uploads
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY auto_photo_uploads_user_read ON auto_photo_uploads
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY auto_photo_uploads_user_insert ON auto_photo_uploads
  FOR INSERT WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    AND user_id = auth.uid()
  );

-- Trigger for updated_at
CREATE TRIGGER trg_auto_photo_uploads_updated_at
  BEFORE UPDATE ON auto_photo_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- TABLE: auto_mobile_notifications
-- Purpose: Push notifications for mobile users
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_mobile_notifications (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Recipient
  user_id UUID NOT NULL,
  
  -- Notification Content
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'lead_assigned',
    'appointment_reminder',
    'repair_order_assigned',
    'parts_available',
    'approval_required',
    'customer_arrived',
    'payment_received',
    'task_overdue',
    'system_alert'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Action (deep link)
  action_type TEXT, -- 'open_lead', 'open_repair_order', etc.
  action_data JSONB, -- { "id": "...", "screen": "..." }
  
  -- Priority
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  
  -- Delivery Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Delivery Channels
  push_notification_sent BOOLEAN DEFAULT false,
  in_app_notification_sent BOOLEAN DEFAULT false,
  
  -- Error Handling
  send_error TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Expiry
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auto_mobile_notifications_tenant ON auto_mobile_notifications(tenant_id);
CREATE INDEX idx_auto_mobile_notifications_user ON auto_mobile_notifications(user_id);
CREATE INDEX idx_auto_mobile_notifications_status ON auto_mobile_notifications(tenant_id, status);
CREATE INDEX idx_auto_mobile_notifications_unread ON auto_mobile_notifications(tenant_id, user_id, status) 
  WHERE status IN ('pending', 'sent', 'delivered');
CREATE INDEX idx_auto_mobile_notifications_priority ON auto_mobile_notifications(tenant_id, priority, created_at DESC);

-- RLS Policies
ALTER TABLE auto_mobile_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_mobile_notifications_tenant_isolation ON auto_mobile_notifications
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY auto_mobile_notifications_user_isolation ON auto_mobile_notifications
  FOR ALL USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER trg_auto_mobile_notifications_updated_at
  BEFORE UPDATE ON auto_mobile_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- RPC FUNCTIONS
-- =====================================================================================

-- Get pending offline actions for user (for sync)
CREATE OR REPLACE FUNCTION get_pending_offline_actions(
  p_tenant_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  action_id UUID,
  action_type TEXT,
  entity_type TEXT,
  action_data JSONB,
  priority INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oa.id AS action_id,
    oa.action_type,
    oa.entity_type,
    oa.action_data,
    oa.priority,
    oa.created_at
  FROM auto_offline_actions oa
  WHERE oa.tenant_id = p_tenant_id
    AND oa.user_id = p_user_id
    AND oa.status = 'pending'
  ORDER BY oa.priority ASC, oa.created_at ASC
  LIMIT p_limit;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION get_pending_offline_actions TO authenticated;

-- Get unread notifications for user
CREATE OR REPLACE FUNCTION get_unread_notifications(
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  notification_id UUID,
  notification_type TEXT,
  title TEXT,
  message TEXT,
  priority TEXT,
  action_type TEXT,
  action_data JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS notification_id,
    n.notification_type,
    n.title,
    n.message,
    n.priority,
    n.action_type,
    n.action_data,
    n.created_at
  FROM auto_mobile_notifications n
  WHERE n.tenant_id = p_tenant_id
    AND n.user_id = p_user_id
    AND n.status IN ('pending', 'sent', 'delivered')
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY
    CASE n.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    n.created_at DESC;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION get_unread_notifications TO authenticated;

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID,
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auto_mobile_notifications
  SET 
    status = 'read',
    read_at = NOW()
  WHERE id = p_notification_id
    AND tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND status != 'read';
  
  RETURN FOUND;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;

-- =====================================================================================
-- COMMENTS
-- =====================================================================================

COMMENT ON TABLE auto_mobile_sessions IS 'Phase 10: Mobile user sessions with device info';
COMMENT ON TABLE auto_offline_actions IS 'Phase 10: Offline action queue for sync';
COMMENT ON TABLE auto_photo_uploads IS 'Phase 10: Photo upload tracking with compression metadata';
COMMENT ON TABLE auto_mobile_notifications IS 'Phase 10: Push notifications for mobile users';

COMMENT ON COLUMN auto_offline_actions.action_data IS 'JSONB payload for the action to be synced';
COMMENT ON COLUMN auto_offline_actions.priority IS '1 (highest) to 10 (lowest) for sync order';
COMMENT ON COLUMN auto_photo_uploads.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN auto_mobile_notifications.action_data IS 'JSONB deep link data for navigation';

COMMENT ON FUNCTION get_pending_offline_actions IS 'Get pending offline actions for user sync';
COMMENT ON FUNCTION get_unread_notifications IS 'Get unread notifications for user';
COMMENT ON FUNCTION mark_notification_read IS 'Mark notification as read';

-- =====================================================================================
-- END OF MIGRATION
-- =====================================================================================
