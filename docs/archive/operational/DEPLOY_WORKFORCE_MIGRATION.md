# Deploy Workforce Portal Migration

## ⚠️ Migration Status

**BLOCKED**: `supabase db push` failed do migration cũ `20260621_mobile_rpc.sql` có lỗi (column `scheduled_date` không tồn tại).

## ✅ Workaround: Deploy thủ công qua Supabase SQL Editor

### Bước 1: Mở Supabase SQL Editor
1. Vào: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new
2. Login nếu cần

### Bước 2: Copy migration SQL
Copy toàn bộ nội dung file: `supabase/migrations/20260802010000_create_workforce_portal_tables.sql`

### Bước 3: Paste và Run
1. Paste vào SQL Editor
2. Click "Run" hoặc Ctrl+Enter
3. Đợi ~5-10 giây để execute

### Bước 4: Verify
Chạy query này để verify 5 tables đã được tạo:

```sql
SELECT 
  schemaname, 
  tablename, 
  tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 're_%'
ORDER BY tablename;
```

**Expected Output**: 5 rows
- `re_commission_ledger`
- `re_documents`
- `re_project_checkins`
- `re_sales_kpi_targets`
- `re_tasks`

### Bước 5: Verify RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename LIKE 're_%'
ORDER BY tablename, policyname;
```

**Expected**: Mỗi table có 1-2 RLS policies

### Bước 6: Regenerate TypeScript Types
Sau khi migration thành công, chạy local:

```bash
npx supabase gen types typescript --project-ref lvnvkpyxtuilhrabtlwv > src/types/database.types.ts
```

Hoặc nếu lệnh trên fail:

```bash
supabase gen types typescript --linked > src/types/database.types.ts
```

### Bước 7: Uncomment queries trong workforce-actions.ts
File: `src/services/workforce-actions.ts`

Uncomment 3 sections:
1. `getMyCommissionLedger()` - Line ~86
2. `projectSiteCheckIn()` - Line ~185
3. `getMyKpiProgress()` - Line ~247

### Bước 8: Rebuild
```bash
npm run build
```

---

## 🔧 Fix Migration Error (Optional - nếu muốn fix supabase db push)

Migration `20260621_mobile_rpc.sql` query sai column name.

**Fix**:
```sql
-- Sửa dòng 51 trong file supabase/migrations/20260621_mobile_rpc.sql:
-- Cũ:
    AND sl.scheduled_date = p_today
-- Mới:
    AND DATE(sl.assigned_time) = p_today
```

Sau đó chạy lại:
```bash
supabase db push --include-all
```

---

## 📝 Notes
- Migration này **100% an toàn** cho beauty_spa/babycare tenants
- Chỉ tạo 5 tables mới với prefix `re_*`
- Không ALTER bất kỳ table nào
- RLS policies đảm bảo tenant isolation
