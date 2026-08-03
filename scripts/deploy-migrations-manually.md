# Deploy Migrations Manually (Dashboard Method)

## Why Manual?
CLI có migration history mismatch. Dashboard method reliable hơn.

## Steps

### 1. Open Supabase Dashboard SQL Editor
```
URL: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql
```

### 2. Deploy Migration 1: Partner Registration System
```bash
# Copy nội dung file:
supabase/migrations/20260802112935_partner_registration_system.sql

# Paste vào SQL Editor
# Click "Run"
# Wait for success message
```

### 3. Deploy Migration 2: User Roles
```bash
# Copy nội dung file:
supabase/migrations/20260802130000_create_user_roles.sql

# Paste vào SQL Editor
# Click "Run"
# Wait for success message
```

### 4. Verify
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('partner_applications', 'partner_application_logs', 'user_roles');

-- Expected: 3 rows
```

### 5. Regen Types
```bash
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
```

## Done!
Migrations deployed. Proceed to next step in DEPLOY_CHECKLIST.md
