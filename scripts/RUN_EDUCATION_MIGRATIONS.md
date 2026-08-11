# Education Platform Migrations - Manual Application

## Root Cause

Supabase CLI migration history mismatch prevents `supabase db push`. Local migrations not reflected on remote:

```
Local Migration          Remote Status
─────────────────────    ─────────────
20260810231500           ❌ NOT applied (courses, enrollments)
20260810235000           ❌ NOT applied (attendances)
```

## Solution

Apply migrations manually via Supabase Dashboard SQL Editor.

## Steps

### 1. Open Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: `bellaspahcm's Project` (ID: `lvnvkpyxtuilhrabtlwv`)
3. Navigate to **SQL Editor**

### 2. Run Migration Script

1. Create new query in SQL Editor
2. Copy contents of `scripts/apply_education_migrations_manual.sql`
3. Paste into SQL Editor
4. Click **Run**

### 3. Verify Tables Created

You should see success messages:

```
✅ courses table created successfully
✅ enrollments table created successfully
✅ attendances table created successfully
```

### 4. Verify Schema Cache

After running migration, wait 30-60 seconds for PostgREST schema cache to reload.

Then verify in SQL Editor:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('courses', 'enrollments', 'attendances')
ORDER BY table_name, ordinal_position;
```

Should return all columns for each table.

### 5. Run Integration Tests

After schema cache reloads:

```bash
npm test src/platform/education/enrollment/__tests__/enrollment.integration.test.ts
npm test src/platform/education/course/__tests__/course.integration.test.ts
npm test src/platform/education/attendance/__tests__/attendance.integration.test.ts
```

## Expected Outcome

All integration tests should pass:

- Enrollment: 14/14 ✅
- Course: 17/17 ✅  
- Attendance: TBD ✅

## Troubleshooting

### If schema cache doesn't reload:

1. Run in SQL Editor:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

2. Wait 1-2 minutes

3. Re-run integration tests

### If tables already exist:

Script uses `CREATE TABLE IF NOT EXISTS`, so safe to re-run.

### If foreign key errors:

Ensure `persons` and `students` tables exist first (from Student migration 20260810224417/224418).
