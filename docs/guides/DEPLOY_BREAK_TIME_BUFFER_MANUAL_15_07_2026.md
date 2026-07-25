# Manual Deployment: Break Time Buffer Migration - July 15, 2026

## Context

Migration `20260715200000_enable_break_time_buffer.sql` cannot be deployed via `supabase db push` due to migration history mismatch between local and remote database.

**Root Cause**: Remote database has migrations that don't exist locally (applied by other developers or direct SQL execution).

**Solution**: Deploy migration manually via Supabase Dashboard SQL Editor.

---

## Deployment Steps

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Click **SQL Editor** in left sidebar

### Step 2: Execute Migration SQL
Copy and paste the following SQL into the editor and click **Run**:

```sql
-- Migration: Enable Break Time Buffer for All Tenants
-- Date: 2026-07-15 20:00:00
-- Purpose: Add capacity_config to tenant metadata to enforce 15-minute break between sessions
-- Impact: Improves KTV wellness and service quality

-- =====================================================
-- STEP 1: Add capacity_config to tenants without it
-- =====================================================

UPDATE tenants
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{capacity_config}',
  jsonb_build_object(
    'minBreakMinutes', 15,
    'workingHoursStart', '08:00',
    'workingHoursEnd', '20:00',
    'enforceBreakTimes', true,
    'enablePeakHours', false,
    'bufferPercentage', 10
  ),
  true
)
WHERE metadata->'capacity_config' IS NULL
   OR metadata->'capacity_config'->>'minBreakMinutes' IS NULL;

-- =====================================================
-- STEP 2: Update existing capacity_config to ensure break time is enabled
-- =====================================================

UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, enforceBreakTimes}',
  'true'::jsonb,
  true
)
WHERE metadata->'capacity_config' IS NOT NULL
  AND (metadata->'capacity_config'->>'enforceBreakTimes')::boolean IS NOT TRUE;

-- =====================================================
-- STEP 3: Ensure minBreakMinutes is at least 15 minutes
-- =====================================================

UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, minBreakMinutes}',
  '15'::jsonb,
  true
)
WHERE metadata->'capacity_config' IS NOT NULL
  AND (
    metadata->'capacity_config'->>'minBreakMinutes' IS NULL
    OR (metadata->'capacity_config'->>'minBreakMinutes')::int < 15
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check how many tenants now have capacity_config
-- Expected: All active tenants
DO $$
DECLARE
  total_tenants INT;
  configured_tenants INT;
BEGIN
  SELECT COUNT(*) INTO total_tenants FROM tenants WHERE status = 'active';
  
  SELECT COUNT(*) INTO configured_tenants 
  FROM tenants 
  WHERE status = 'active'
    AND metadata->'capacity_config' IS NOT NULL
    AND metadata->'capacity_config'->>'minBreakMinutes' IS NOT NULL;
  
  RAISE NOTICE 'Total active tenants: %', total_tenants;
  RAISE NOTICE 'Configured tenants: %', configured_tenants;
  
  IF total_tenants = configured_tenants THEN
    RAISE NOTICE '✅ All tenants configured successfully';
  ELSE
    RAISE WARNING '⚠️ Some tenants missing configuration: % unconfigured', (total_tenants - configured_tenants);
  END IF;
END $$;

-- =====================================================
-- POST-MIGRATION VALIDATION
-- =====================================================

-- Show sample of configured tenants
SELECT 
  id,
  name,
  metadata->'capacity_config' as capacity_config,
  status
FROM tenants
WHERE status = 'active'
LIMIT 5;

-- =====================================================
-- RECORD MIGRATION IN HISTORY
-- =====================================================

-- Add migration to history table (optional, if migration repair needed later)
-- INSERT INTO supabase_migrations.schema_migrations (version)
-- VALUES ('20260715200000')
-- ON CONFLICT DO NOTHING;
```

### Step 3: Verify Execution
After running, you should see:
- ✅ **NOTICE**: "Total active tenants: X"
- ✅ **NOTICE**: "Configured tenants: X"
- ✅ **NOTICE**: "All tenants configured successfully"
- ✅ **Sample tenants** with `capacity_config` displayed

---

## Verification Queries

Run these queries separately to verify deployment:

### Check All Tenants Have Config
```sql
SELECT 
  COUNT(*) FILTER (WHERE metadata->'capacity_config' IS NOT NULL) as configured_count,
  COUNT(*) as total_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE metadata->'capacity_config' IS NOT NULL) / COUNT(*)
  , 1) as percentage
FROM tenants
WHERE status = 'active';
```

Expected: `configured_count = total_count`, `percentage = 100.0`

### Check Break Time Settings
```sql
SELECT 
  name,
  metadata->'capacity_config'->>'minBreakMinutes' as min_break_minutes,
  metadata->'capacity_config'->>'enforceBreakTimes' as enforce_break_times,
  metadata->'capacity_config'->>'workingHoursStart' as working_start,
  metadata->'capacity_config'->>'workingHoursEnd' as working_end
FROM tenants
WHERE status = 'active'
ORDER BY name
LIMIT 10;
```

Expected: All tenants have `min_break_minutes = "15"`, `enforce_break_times = "true"`

### Test Break Time Logic (Read-Only)
```sql
-- Check if any existing bookings violate break time rules
-- (This is informational only, does NOT modify data)
WITH booking_gaps AS (
  SELECT 
    b1.tenant_id,
    b1.assigned_ktv_id,
    b1.scheduled_start as session1_end,
    b2.scheduled_start as session2_start,
    EXTRACT(EPOCH FROM (b2.scheduled_start - b1.scheduled_start)) / 60 as gap_minutes
  FROM bookings b1
  JOIN bookings b2 
    ON b1.tenant_id = b2.tenant_id
    AND b1.assigned_ktv_id = b2.assigned_ktv_id
    AND b1.id != b2.id
    AND b2.scheduled_start > b1.scheduled_start
    AND b2.scheduled_start < b1.scheduled_start + INTERVAL '2 hours'
  WHERE b1.status IN ('confirmed', 'in_progress', 'scheduled')
    AND b2.status IN ('confirmed', 'in_progress', 'scheduled')
    AND b1.scheduled_start::date = CURRENT_DATE
)
SELECT 
  tenant_id,
  assigned_ktv_id,
  COUNT(*) as violations_count,
  MIN(gap_minutes) as min_gap_minutes,
  AVG(gap_minutes) as avg_gap_minutes
FROM booking_gaps
WHERE gap_minutes < 15
GROUP BY tenant_id, assigned_ktv_id
ORDER BY violations_count DESC
LIMIT 10;
```

If this returns rows, it means there are existing bookings with gaps < 15 minutes. These are **historical violations** (allowed before this migration). New bookings will be blocked.

---

## Rollback (If Needed)

### Disable Break Time Enforcement Only
```sql
UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, enforceBreakTimes}',
  'false'::jsonb,
  true
);
```

### Remove Capacity Config Completely
```sql
UPDATE tenants
SET metadata = metadata - 'capacity_config';
```

---

## Expected Behavior After Deployment

### ✅ What Will Happen
1. **Admin Booking Creation**: When admin creates a new booking, Decision Engine will check:
   - Does KTV have another booking within 15 minutes before or after?
   - If YES → REJECT with message "KTV cần thời gian nghỉ giữa các ca (tối thiểu 15 phút)"
   
2. **Customer Self-Booking**: When customer selects a time slot:
   - System will only show available times that respect 15-minute break
   - Time slots too close to existing bookings will be hidden

3. **Existing Bookings**: NOT affected. Only new bookings are validated.

### ⚠️ What Will NOT Happen
- Existing bookings with gaps < 15 minutes will NOT be auto-cancelled
- Manual adjustments to existing bookings will still be possible (with admin override)
- Break time only applies to bookings in status: `confirmed`, `in_progress`, `scheduled`, `deposit_pending`

---

## Manual Testing Steps

After deployment, test the feature manually:

1. **Login as Admin**
2. **Go to Bookings Page** → Create New Booking
3. **Select a KTV** who already has a booking today at 14:00
4. **Try to create booking at 14:10** (5 minutes gap)
   - **Expected**: Error message "KTV cần thời gian nghỉ giữa các ca (tối thiểu 15 phút)"
5. **Try to create booking at 14:20** (20 minutes gap)
   - **Expected**: Success, booking created

---

## Monitoring

Monitor for 1 week after deployment:

### Daily Check (Run in SQL Editor)
```sql
-- Count rejected bookings due to break time violations (if logged)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as attempts,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected
FROM booking_attempts
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND rejection_reason LIKE '%thời gian nghỉ%'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### User Feedback
- Ask admins: "Có gặp khó khăn khi đặt lịch không?"
- Ask KTVs: "Có cảm thấy giữa các ca nghỉ ngơi đủ không?"

---

## Next Steps

1. ✅ **Deploy via SQL Editor** (manual execution)
2. ⏳ **Verify with queries above**
3. ⏳ **Manual QA testing** (create overlapping bookings)
4. ⏳ **Monitor for 1 week**
5. ⏳ **Collect user feedback**
6. 🔮 **Future**: Add admin UI for per-tenant break time configuration (5-30 minutes)

---

## Related Documents

- **Feature Analysis**: `docs/FEATURE_BREAK_TIME_BUFFER_ANALYSIS_15_07_2026.md`
- **Local Testing**: `scripts/test-break-time-logic.ts` (✅ PASSED all scenarios)
- **Logic Location**: `src/lib/decision-engine/providers/booking/capacity-management-provider.ts`

---

**Document Created**: July 15, 2026, 21:45 ICT
**Status**: Ready for Manual Deployment
**Risk Level**: LOW (read config from metadata, feature already implemented in Decision Engine)
**Estimated Deployment Time**: 2 minutes
**Rollback Time**: 30 seconds
