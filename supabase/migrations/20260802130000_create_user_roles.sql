-- ============================================================================
-- User Roles Table
-- Purpose: Store user role assignments for RBAC
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  tenant_id UUID, -- NULL = global role
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(user_id, role_name, tenant_id)
);

-- Indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_name ON user_roles(role_name);
CREATE INDEX idx_user_roles_tenant_id ON user_roles(tenant_id) WHERE tenant_id IS NOT NULL;

-- RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_name IN ('admin', 'super_admin')
    )
  );

-- Policy: Super admins can manage roles
CREATE POLICY "Super admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_name = 'super_admin'
    )
  );

-- Comments
COMMENT ON TABLE user_roles IS 'User role assignments for RBAC';
COMMENT ON COLUMN user_roles.tenant_id IS 'NULL for global roles, UUID for tenant-specific roles';

-- Verification
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_roles') = 1,
    'user_roles table not created';
  RAISE NOTICE '✅ user_roles table created successfully';
END $$;
