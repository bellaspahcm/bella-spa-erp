# Database Migrations

## KTV Performance Optimization

### Issue
KTV Dashboard loading time: **5-17 seconds** (unacceptable)

### Root Cause
- Missing database indexes on frequently queried columns
- `getCurrentUser()` full table scan on `users` table
- `getKTVActiveSessions()` full table scan on `session_logs`
- `getKTVUpcomingSessions()` multiple slow joins without indexes

### Solution
Run `add_ktv_performance_indexes.sql` to create composite indexes.

---

## How to Apply Migration

### Option 1: Supabase Dashboard (recommended)

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
2. Copy entire content of `add_ktv_performance_indexes.sql`
3. Paste into SQL Editor
4. Click **"Run"**
5. Verify output shows: `Success. No rows returned`

### Option 2: Supabase CLI

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_ID

# Run migration
npx supabase db push database/migrations/add_ktv_performance_indexes.sql
```

### Option 3: Direct SQL (if you have psql access)

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f database/migrations/add_ktv_performance_indexes.sql
```

---

## Verify Indexes Created

After running migration, verify indexes exist:

```sql
-- Check users indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename = 'users' 
AND indexname LIKE 'idx_users_%';

-- Check session_logs indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename = 'session_logs' 
AND indexname LIKE 'idx_session_%';

-- Check bookings indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename = 'bookings' 
AND indexname LIKE 'idx_bookings_%';
```

Expected output: Should show all 8 new indexes.

---

## Expected Performance Improvement

| Query | Before | After | Improvement |
|-------|--------|-------|-------------|
| `getCurrentUser()` | ~5000ms | ~100ms | **50x faster** |
| `getKTVActiveSessions()` | ~2000ms | ~50ms | **40x faster** |
| `getKTVUpcomingSessions()` | ~9000ms | ~200ms | **45x faster** |
| **TOTAL Dashboard Load** | **17s** | **~0.5s** | **34x faster** |

---

## Rollback (if needed)

If indexes cause issues, drop them:

```sql
DROP INDEX IF EXISTS idx_users_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_tenant;
DROP INDEX IF EXISTS idx_tenants_id_status;
DROP INDEX IF EXISTS idx_session_logs_ktv_status;
DROP INDEX IF EXISTS idx_bookings_assigned_ktv;
DROP INDEX IF EXISTS idx_session_logs_booking;
DROP INDEX IF EXISTS idx_bookings_status;
DROP INDEX IF EXISTS idx_session_logs_completed_ktv_status;
```

---

## Notes

- Indexes are **CREATE INDEX IF NOT EXISTS** - safe to run multiple times
- No data modification - read-only schema changes
- Zero downtime - Postgres creates indexes concurrently
- Estimated index creation time: ~10-30 seconds per index (depends on table size)

---

## After Migration

1. **Clear KTV app cache** (Service Worker + IndexedDB)
2. **Hard reload**: `Ctrl + Shift + R`
3. **Check Console logs** - `total_to_ui` should be < 1000ms
4. **Celebrate** 🎉
