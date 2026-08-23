# Partner System Deploy Checklist

## Before Deploy
- [x] Build passing (203 pages)
- [x] All features implemented
- [x] Documentation complete

## Deploy Steps

### 1. Database (5 mins)
```bash
# Dashboard: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql

# Copy and run:
1. supabase/migrations/20260802112935_partner_registration_system.sql
2. supabase/migrations/20260802130000_create_user_roles.sql

# Expected: 2 migrations, ~15 tables/functions created
```

### 2. Types (1 min)
```bash
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
npm run build  # Should pass
```

### 3. Code Changes (2 mins)
```bash
# File: src/lib/provisioning/partner-provisioning-engine.ts (line ~113)
# Uncomment user_roles insert

# Files (3): src/app/api/admin/partner-applications/[id]/*.ts
# Uncomment: // 2. Verify admin role section
```

### 4. Admin User (1 min)
```sql
# Get ID: SELECT id FROM auth.users WHERE email = 'your@email.com';
# Add role: Use scripts/add-admin-user.sql
```

### 5. Test Data (1 min)
```sql
# Run: scripts/seed-partner-test-data.sql
# Creates 5 test applications
```

### 6. Test E2E (10 mins)
```bash
# Follow: scripts/test-partner-e2e.md
# Register → Verify → Approve → Activate → Login
```

## Verification
- [ ] Migrations applied
- [ ] Types generated
- [ ] Build passes
- [ ] Admin role exists
- [ ] Test data seeded
- [ ] E2E test passes

## Rollback Plan
```sql
-- If needed:
DROP TABLE partner_application_logs;
DROP TABLE partner_applications;
DROP TABLE user_roles;
DROP TYPE partner_application_status;
DROP TYPE partner_application_log_action;
```

## Production Deploy
1. Run all above steps on staging first
2. Test E2E on staging
3. Repeat on production
4. Monitor logs for errors
5. Configure SMTP (optional, for real emails)

## Done!
System ready for partner onboarding.
