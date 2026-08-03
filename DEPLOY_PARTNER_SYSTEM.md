# Partner Registration - Deploy Guide

## 1. Deploy Migrations (Dashboard)
```
1. https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql
2. Copy nội dung 2 files:
   - supabase/migrations/20260802112935_partner_registration_system.sql
   - supabase/migrations/20260802130000_create_user_roles.sql
3. Run
```

## 2. Regen Types
```bash
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
```

## 3. Uncomment Code
File: `src/lib/provisioning/partner-provisioning-engine.ts` (line ~113)
- Uncomment user_roles insert

## 4. Add Admin Role
```sql
-- Thay YOUR_USER_ID bằng ID thật
INSERT INTO user_roles (user_id, role_name) 
VALUES ('YOUR_USER_ID', 'admin');
```

## 5. Seed Test Data
```bash
# Copy scripts/seed-partner-test-data.sql vào SQL Editor
# Run
```

## 6. Test E2E
1. `/partner/register` - Submit form
2. Check email console log - Copy verification link
3. Click verify → Redirected to activation
4. `/admin/partner-applications` - View application
5. Click Approve → Check provisioning logs
6. Copy activation link from logs
7. Set password → Login

## 7. Re-enable Role Checks
Files to edit:
- `src/app/api/admin/partner-applications/[id]/approve/route.ts`
- `src/app/api/admin/partner-applications/[id]/reject/route.ts`
- `src/app/api/admin/partner-applications/[id]/request-info/route.ts`

Uncomment section: `// 2. Verify admin role`

## Done!
- ✅ Registration wizard (4 steps)
- ✅ Email verification
- ✅ Admin approve/reject/request-info
- ✅ Auto-provisioning (tenant + user)
- ✅ Activation page (set password)
- ✅ Build passing

## Future
- SMTP config → See `docs/portal/SMTP_CONFIGURATION_GUIDE.md`
- Document upload
- AI fraud detection

## Related Docs
- **Deploy Checklist:** `DEPLOY_CHECKLIST.md`
- **E2E Test Guide:** `scripts/test-partner-e2e.md`
- **System Status:** `docs/portal/PARTNER_REGISTRATION_STATUS.md`
- **Full Spec:** `docs/portal/PARTNER_REGISTRATION_SYSTEM_SPEC.md`
