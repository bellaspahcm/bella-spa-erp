-- Seed initial tenant
INSERT INTO tenants (name, status) VALUES ('Bella Spa Headquarter', 'active');

-- Seed initial admin (Note: In real app, this should be linked to Supabase Auth)
INSERT INTO users (email, full_name, role, status, tenant_id)
SELECT 'admin@bellaspa.com.vn', 'System Admin', 'admin', 'active', id
FROM tenants WHERE name = 'Bella Spa Headquarter'
LIMIT 1;
