# Real Estate Module - Production Deployment Guide

## Tổng Quan

Triển khai Real Estate module với **47 performance indexes** áp dụng Beauty Spa best practices.

## Trạng Thái Hiện Tại

- ✅ Code deployed to Vercel: https://bella-spa-erp.vercel.app
- ✅ Database tables created (9 tables)
- ✅ RLS policies deployed
- ✅ RPCs deployed (9 functions)
- ✅ Demo data seeded
- ⚠️ **Schema incomplete**: Missing `deleted_at`, `area_m2`, enums
- ❌ **Performance indexes**: Not deployed yet

## Vấn Đề Production

Khi chạy script `deploy-performance-safe.sql` gặp lỗi:

```
ERROR: 42703: column "area_m2" does not exist
ERROR: 22P02: invalid input value for enum reservation_status: "pending_deposit"
```

**Nguyên nhân**: Production database thiếu columns và enums từ migration `20260802150000_real_estate_core_schema.sql`

## Giải Pháp: Triển Khai 2 Bước

### BƯỚC 1: Deploy Schema Patch

**File**: `scripts/DEPLOY_STEP_1_SCHEMA.sql`

**Nội dung**:
- Tạo 5 enums: `product_type`, `lead_state`, `booking_state`, `contract_state`, `reservation_status`
- Thêm column `deleted_at` vào 9 tables
- Thêm column `area_m2` vào `real_estate_products`

**Cách chạy**:

1. Mở Supabase Dashboard: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Vào **SQL Editor** → New Query
3. Copy toàn bộ nội dung `DEPLOY_STEP_1_SCHEMA.sql`
4. Paste và click **Run**
5. Kiểm tra output:

```
✅ REAL ESTATE SCHEMA PATCH DEPLOYED
Enums: 5 | Deleted_at columns: 9
✅ Ready for performance indexes deployment!
```

**Thời gian**: ~10 giây

---

### BƯỚC 2: Deploy Performance Indexes

**File**: `scripts/DEPLOY_STEP_2_PERFORMANCE.sql`

**Nội dung**: 47 indexes chia thành 6 nhóm:

1. **Tenant Isolation** (7 indexes)
   - Pattern: `tenant_id` first, then `status`/`date`/`FK`
   - Đảm bảo multi-tenancy isolation

2. **Lead Management** (5 indexes)
   - FSM state transitions
   - Agent assignment
   - Marketing attribution

3. **Reservation & Booking** (7 indexes)
   - FSM state tracking
   - Product availability checks
   - Customer history

4. **Contract Management** (6 indexes)
   - Contract lifecycle
   - Installment tracking (GIN index for JSONB)
   - Revenue recognition

5. **Financial Transactions** (7 indexes)
   - Accounting queries
   - Cashflow reports
   - Payment history

6. **Commission Tracking** (5 indexes)
   - Agent performance
   - Payroll reconciliation
   - Approval workflow

7. **Analytics & Reporting** (5 indexes)
   - Composite indexes with INCLUDE
   - Dashboard queries
   - Management reports

**Đặc điểm kỹ thuật**:
- ✅ Partial indexes (`WHERE deleted_at IS NULL`)
- ✅ Composite indexes (`INCLUDE` columns)
- ✅ GIN indexes (JSONB/array operations)
- ✅ Multi-column indexes (tenant + status + date)

**Cách chạy**:

1. **CHỈ chạy sau khi BƯỚC 1 hoàn tất**
2. Mở Supabase Dashboard → SQL Editor → New Query
3. Copy toàn bộ nội dung `DEPLOY_STEP_2_PERFORMANCE.sql`
4. Paste và click **Run**
5. Kiểm tra output:

```
✅ REAL ESTATE PERFORMANCE OPTIMIZATION DEPLOYED

📊 Index Statistics:
  • Total Indexes:      47
  • GIN Indexes:        2 (JSONB/Array)
  • Partial Indexes:    35 (WHERE filters)
  • Composite Indexes:  12 (Multi-column/INCLUDE)

🎯 Optimization Areas:
  ✓ Tenant isolation (multi-tenancy core)
  ✓ FSM state transitions (leads, bookings, contracts)
  ✓ Product availability (inventory management)
  ✓ Financial transactions (accounting, cashflow)
  ✓ Commission tracking (agent performance)
  ✓ Analytics & reporting (dashboard queries)

✅ Real Estate module optimization complete!
```

**Thời gian**: ~2-3 phút (indexes build online, không lock tables)

---

## Kiểm Tra Sau Khi Deploy

### 1. Verify Enums

```sql
SELECT typname 
FROM pg_type 
WHERE typname IN (
  'product_type', 'lead_state', 'booking_state', 
  'contract_state', 'reservation_status'
);
```

Kết quả mong đợi: 5 rows

### 2. Verify Columns

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name LIKE 're_%' OR table_name LIKE 'real_estate_%')
  AND column_name IN ('deleted_at', 'area_m2')
ORDER BY table_name, column_name;
```

Kết quả mong đợi: 10 rows (9 deleted_at + 1 area_m2)

### 3. Verify Indexes

```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 're_%' OR tablename LIKE 'real_estate_%')
  AND indexname LIKE 'idx_re_%'
ORDER BY tablename, indexname;
```

Kết quả mong đợi: 47+ rows

### 4. Test Query Performance

```sql
-- Test tenant isolation index
EXPLAIN ANALYZE
SELECT * FROM real_estate_products
WHERE tenant_id = 'd4710089-f0bc-4cca-bde4-3904c17c2782'
  AND status = 'available'
  AND deleted_at IS NULL;
```

Kết quả tốt: `Index Scan using idx_re_products_tenant_status`

```sql
-- Test lead pipeline index
EXPLAIN ANALYZE
SELECT * FROM re_leads
WHERE tenant_id = 'd4710089-f0bc-4cca-bde4-3904c17c2782'
  AND state IN ('QUALIFIED', 'VISIT_SCHEDULED', 'NEGOTIATING')
  AND deleted_at IS NULL
ORDER BY state_changed_at DESC;
```

Kết quả tốt: `Index Scan using idx_re_leads_hot`

---

## Lessons Learned từ Beauty Spa

### 1. Tenant Isolation First
**Pattern**: ALWAYS filter `tenant_id` first, then other conditions
```sql
-- ✅ GOOD
CREATE INDEX idx_table_tenant_status 
  ON table(tenant_id, status)
  WHERE deleted_at IS NULL;

-- ❌ BAD
CREATE INDEX idx_table_status 
  ON table(status);
```

### 2. Partial Indexes for Soft Delete
**Pattern**: Exclude deleted records from indexes
```sql
WHERE deleted_at IS NULL
```
- Giảm kích thước index 20-30%
- Query nhanh hơn (ít rows hơn)

### 3. Composite Indexes với INCLUDE
**Pattern**: Add columns to index without sorting
```sql
CREATE INDEX idx_table_tenant_date
  ON table(tenant_id, created_at DESC)
  INCLUDE (amount, customer_id)
  WHERE deleted_at IS NULL;
```
- Index-only scans (không cần đọc table)
- Giảm I/O 50-70%

### 4. GIN Indexes cho JSONB/Arrays
**Pattern**: Fast lookup in JSONB/array columns
```sql
CREATE INDEX idx_contracts_installments_gin 
  ON re_contracts USING GIN (installments)
  WHERE state = 'ACTIVE';
```

### 5. Partial Indexes cho Hot Data
**Pattern**: Index only "hot" states
```sql
-- Only index leads in active states
CREATE INDEX idx_re_leads_hot 
  ON re_leads(tenant_id, assigned_to)
  WHERE state IN ('QUALIFIED', 'VISIT_SCHEDULED', 'NEGOTIATING');
```

---

## Performance Impact Estimation

**Before Optimization**:
- Dashboard load: 5-10s
- Product listing: 2-3s
- Lead pipeline: 3-5s
- Reports: 10-15s

**After Optimization** (dự kiến):
- Dashboard load: 1-2s (↓ 70-80%)
- Product listing: 0.5-1s (↓ 70%)
- Lead pipeline: 0.5-1s (↓ 80%)
- Reports: 2-3s (↓ 80%)

**Disk Space**:
- Indexes: ~15-20% table size
- Example: 1GB tables → 150-200MB indexes

---

## Rollback Plan

Nếu có vấn đề, xóa indexes:

```sql
-- Drop all Real Estate indexes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_re_%'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname || ' CASCADE';
    RAISE NOTICE 'Dropped: %', r.indexname;
  END LOOP;
END $$;
```

**Không ảnh hưởng data**, chỉ làm chậm queries.

---

## Next Steps

Sau khi deploy xong:

1. **Test UI performance** trên production
2. **Monitor slow queries** trong Supabase Dashboard
3. **Verify demo data** hoạt động đúng
4. **Update DONE.md** với kết quả triển khai
5. **Commit scripts** vào Git

---

## Files Created

1. `scripts/DEPLOY_STEP_1_SCHEMA.sql` - Schema patch
2. `scripts/DEPLOY_STEP_2_PERFORMANCE.sql` - Performance indexes
3. `scripts/REAL_ESTATE_DEPLOYMENT_GUIDE.md` - This guide
4. `supabase/migrations/20260802160000_real_estate_performance_optimization_v2.sql` - Migration file (for future reference)

---

## References

- **Playbook**: `docs/guides/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md`
- **Beauty Spa Pattern**: `supabase/migrations/20260622280000_performance_optimization_indexes.sql`
- **Production DB**: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
- **Vercel App**: https://bella-spa-erp.vercel.app

---

## Questions?

Nếu có vấn đề:
1. Check Supabase Dashboard → Logs
2. Run verification queries ở trên
3. Check `pg_stat_user_indexes` để xem indexes có được dùng không
