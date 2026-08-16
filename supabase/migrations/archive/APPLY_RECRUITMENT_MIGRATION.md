# Apply Recruitment System Migration Manually

## Background
The recruitment system migration (`20260622290000_create_recruitment_system.sql`) needs to be applied to the remote Supabase database. Due to migration history conflicts, manual application via SQL Editor is required.

## Steps to Apply

### 1. Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query

### 2. Copy Migration SQL
Copy the contents of `supabase/migrations/20260622290000_create_recruitment_system.sql` and paste into the SQL Editor.

### 3. Execute the Migration
Click "Run" to execute the SQL script.

### 4. Verify Tables Created
Run this query to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'recruitment_%'
ORDER BY table_name;
```

Expected output:
- `recruitment_candidates`
- `recruitment_interviews`
- `recruitment_pipelines`
- `recruitment_positions`

### 5. Regenerate TypeScript Types (Already Done)
After tables are created, regenerate types:

```bash
npx supabase gen types typescript --project-id lvnvkpyxtuilhrabtlwv > src/types/database.types.ts
```

**Note**: This has already been completed in commit `7194cbdb`. You only need to regenerate if you make changes to the recruitment tables.

### 6. Update recruitment-metrics.ts Types (If Needed)
Once tables exist in database types, replace the temporary type definitions in `src/services/intelligence/hr/recruitment-metrics.ts` with proper imports from `database.types.ts`.

Current temporary interfaces that can be replaced:
- `RecruitmentCandidate`
- `PipelineTransition`
- `InterviewRecord`

Replace with:
```typescript
import type { Database } from '@/types/database.types';

type RecruitmentCandidate = Database['public']['Tables']['recruitment_candidates']['Row'];
type PipelineTransition = Database['public']['Tables']['recruitment_pipelines']['Row'];
type InterviewRecord = Database['public']['Tables']['recruitment_interviews']['Row'];
```

## Troubleshooting

### If tables already exist
If you see errors like "relation already exists", the migration has already been applied. You can skip this step.

### If RLS policies fail
If Row Level Security policies fail to create, check if they already exist:

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'recruitment_%';
```

### If audit triggers fail
If audit logging triggers fail because `audit_log_changes` function doesn't exist, that's expected behavior. The migration includes a conditional check for this function.

## Verification Queries

Check record counts (should be 0 initially):
```sql
SELECT 
  (SELECT COUNT(*) FROM recruitment_positions) as positions,
  (SELECT COUNT(*) FROM recruitment_candidates) as candidates,
  (SELECT COUNT(*) FROM recruitment_pipelines) as pipelines,
  (SELECT COUNT(*) FROM recruitment_interviews) as interviews;
```

Check RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'recruitment_%';
```

All tables should show `rowsecurity = true`.

## Post-Migration Tasks

1. ✅ **Database Types**: Already regenerated (commit `7194cbdb`)
2. ✅ **Training Metrics**: Already using real `rating` field (commit `7194cbdb`)
3. ⏳ **Recruitment Migration**: Needs manual SQL execution (this document)
4. ⏳ **Type Updates**: After migration, optionally replace temporary interfaces with generated types

## Related Files

- Migration: `supabase/migrations/20260622290000_create_recruitment_system.sql`
- Metrics Logic: `src/services/intelligence/hr/recruitment-metrics.ts`
- Service Layer: `src/services/intelligence/hr/service.ts`
- API Routes: 
  - `src/app/api/intelligence/hr/recruitment-metrics/route.ts`
  - `src/app/api/intelligence/hr/training-metrics/route.ts`

## Status

- [x] Migration SQL created
- [x] TypeScript types regenerated
- [x] Training metrics using real rating data
- [x] Build passing (112/112 pages)
- [x] Zero 'any' types
- [ ] Migration applied to remote database (manual step required)
- [ ] Optional: Replace temporary type interfaces with generated types
