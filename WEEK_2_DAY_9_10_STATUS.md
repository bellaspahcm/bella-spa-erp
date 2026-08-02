# Day 9-10: Admin Actions API

**Status:** Backend ✅ | Deploy ⏳

---

## ✅ Done

1. **3 Admin APIs** - approve, reject, request-info
2. **UI Connected** - buttons → APIs with loading/success states
3. **Build passing** - `npm run build` ✅

---

## ⏳ Còn làm (35 phút)

### 1. Deploy Migration (5 phút)
```
Mở: https://supabase.com/dashboard/project/prbytsdxmgukikydbvoo/sql
Copy: supabase/migrations/20260802112935_partner_registration_system.sql
Paste → Run → Xong
```

### 2. Storage Bucket (2 phút)
```
Mở: Storage tab → New bucket → "partner-application-documents" (Private)
Copy 3 policies từ DEPLOY_NOW.md → Run
```

### 3. Regen Types (1 phút)
```bash
npx supabase gen types typescript --project-id prbytsdxmgukikydbvoo > src/types/database.types.ts
```

### 4. Bật strict check (5 phút)
```typescript
// next.config.ts
typescript: { ignoreBuildErrors: false } // ✅
```
Chạy `npm run build` → fix lỗi nếu có

### 5. Test E2E (20 phút)
- Register → Verify email → Admin approve/reject/request-info
- Check database xem có đúng không

---

## Files mới
- `src/app/api/admin/partner-applications/[id]/approve/route.ts`
- `src/app/api/admin/partner-applications/[id]/reject/route.ts`
- `src/app/api/admin/partner-applications/[id]/request-info/route.ts`
- `DEPLOY_NOW.md` (hướng dẫn deploy chi tiết)

---

**Xong thì:** Commit + Push
