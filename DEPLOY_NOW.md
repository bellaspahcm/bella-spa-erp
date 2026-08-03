# 🚀 DEPLOY REAL ESTATE MODULE NOW

## ⚡ Quick Steps (5 phút)

### 1️⃣ Mở Supabase Dashboard
👉 https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql

### 2️⃣ Deploy Core Schema
1. Click **New Query**
2. Copy nội dung từ: `supabase/migrations/20260802150000_real_estate_core_schema.sql`
3. **XÓA** các dòng có `\echo` và `\i` (không chạy được)
4. Click **RUN**

### 3️⃣ Deploy RPC Functions
1. Click **New Query**
2. Copy nội dung từ: `supabase/migrations/20260802151000_real_estate_rpc_functions.sql`
3. **XÓA** các dòng có `\echo`
4. Click **RUN**

### 4️⃣ Verify
```sql
SELECT COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'real_estate%';
-- Expect: 9
```

### 5️⃣ Test
```bash
npm run dev
```
👉 http://localhost:3000/dashboard/real-estate

---

## ✅ Done!

**Chi tiết:** Xem `docs/deployment/MANUAL_DEPLOYMENT_INSTRUCTIONS.md`

**Lý do manual:** Supabase CLI conflict với migrations 20260622

**Files:**
- ✅ `supabase/migrations/20260802150000_real_estate_core_schema.sql`
- ✅ `supabase/migrations/20260802151000_real_estate_rpc_functions.sql`
- ✅ `scripts/seed-real-estate-demo.sql` (optional)

**Deployment method:** Manual SQL Editor (CLI failed)

**Thời gian:** ~5 phút
