# ⚡ Quick Deploy - Partner Registration System

## 1️⃣ Deploy Database (2 mins)

### Copy & Run
1. Open: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql
2. Copy entire file: `scripts/apply-all-migrations.sql`
3. Paste vào SQL Editor
4. Click **Run**
5. Wait for: `✅ Partner Registration System migrations complete!`

---

## 2️⃣ Regenerate Types (1 min)

```bash
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
```

---

## 3️⃣ Uncomment Code (2 mins)

### File 1: `src/lib/provisioning/partner-provisioning-engine.ts`
**Line ~113** - Uncomment:
```typescript
// TODO: Uncomment after user_roles migration is deployed
const { error: roleError } = await supabase
  .from('user_roles')
  .insert({
    user_id: authUser.user.id,
    role_name: 'partner',
    tenant_id: tenant.id,
  } as any);
```

### Files 2-4: Admin APIs
Uncomment section `// 2. Verify admin role` trong:
- `src/app/api/admin/partner-applications/[id]/approve/route.ts`
- `src/app/api/admin/partner-applications/[id]/reject/route.ts`
- `src/app/api/admin/partner-applications/[id]/request-info/route.ts`

---

## 4️⃣ Add Admin User (1 min)

### Get Your User ID
```sql
-- Run in SQL Editor:
SELECT id, email FROM auth.users WHERE email = 'your@email.com';
-- Copy the UUID
```

### Add Admin Role
```sql
-- Replace YOUR_USER_ID:
INSERT INTO user_roles (user_id, role_name, tenant_id)
VALUES ('YOUR_USER_ID', 'admin', NULL)
ON CONFLICT DO NOTHING;
```

---

## 5️⃣ Build & Verify (1 min)

```bash
npm run build
```

Expected: `✓ Compiled successfully in X.Xs`

---

## 6️⃣ Seed Test Data (Optional, 1 min)

```sql
-- Run: scripts/seed-partner-test-data.sql
-- Creates 5 test applications
```

---

## 7️⃣ Test E2E (5 mins)

Follow: `scripts/test-partner-e2e.md`

Quick test:
1. `/partner/register` - Fill form
2. Check console for verification link
3. `/admin/partner-applications` - View application
4. Click Approve
5. Check console for activation link
6. Set password
7. Login ✅

---

## ✅ Done!

System deployed và ready to use!

**Next:**
- Configure SMTP: `docs/portal/SMTP_CONFIGURATION_GUIDE.md`
- Full test guide: `scripts/test-partner-e2e.md`
- System overview: `PARTNER_REGISTRATION_COMPLETE.md`

---

## 🔥 Super Quick (If You Trust Me)

```bash
# 1. Open Dashboard SQL Editor
# 2. Copy/paste scripts/apply-all-migrations.sql → Run
# 3. Regen types
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts

# 4. Get your user ID, add admin role (see step 4 above)
# 5. Build
npm run build

# Done in ~5 minutes! 🚀
```
