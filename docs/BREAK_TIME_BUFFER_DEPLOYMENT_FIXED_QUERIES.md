# Break Time Buffer Deployment - Fixed Queries

## Error Fix

**Lỗi gặp phải**: `ERROR: 42601: unterminated dollar-quoted string at or near "$$"`

**Nguyên nhân**: PostgreSQL cần closing `$$` cho DO block.

**Solution**: Sử dụng queries đơn giản hơn, không cần DO block phức tạp.

---

## Step 1: Deploy Migration (Run All Together)

```sql
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
-- STEP 2: Update existing capacity_config to enable break times
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
```

**Expected Result**: Should show "UPDATE X" for each statement (where X is number of rows updated)

---

## Step 2: Verify Deployment (Simple Queries)

### Query 1: Check Total Counts
```sql
-- Check how many tenants now have capacity_config
SELECT 
  COUNT(*) FILTER (WHERE status = 'active') as total_active_tenants,
  COUNT(*) FILTER (WHERE status = 'active' AND metadata->'capacity_config' IS NOT NULL) as configured_tenants,
  COUNT(*) FILTER (WHERE status = 'active' AND metadata->'capacity_config'->>'minBreakMinutes' = '15') as break_time_enabled
FROM tenants;
```

**Expected Result**: All 3 numbers should be equal (e.g., `5, 5, 5`)

---

### Query 2: View Sample Configurations
```sql
-- Show sample of configured tenants
SELECT 
  id,
  name,
  metadata->'capacity_config'->>'minBreakMinutes' as min_break_minutes,
  metadata->'capacity_config'->>'enforceBreakTimes' as enforce_break_times,
  metadata->'capacity_config'->>'workingHoursStart' as working_start,
  metadata->'capacity_config'->>'workingHoursEnd' as working_end,
  status
FROM tenants
WHERE status = 'active'
ORDER BY name
LIMIT 10;
```

**Expected Result**: All rows should show:
- `min_break_minutes = "15"`
- `enforce_break_times = "true"`
- `working_start = "08:00"`
- `working_end = "20:00"`

---

### Query 3: Full Capacity Config View
```sql
-- View full capacity_config JSON for all tenants
SELECT 
  name,
  metadata->'capacity_config' as capacity_config,
  status
FROM tenants
WHERE status = 'active'
ORDER BY name;
```

**Expected Result**: Each tenant should have complete `capacity_config` JSON object

---

## Step 3: Test Break Time Logic (Read-Only)

```sql
-- Check if any existing bookings violate break time rules
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
    AND b1.scheduled_start::date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  tenant_id,
  assigned_ktv_id,
  COUNT(*) as violations_count,
  ROUND(MIN(gap_minutes)::numeric, 1) as min_gap_minutes,
  ROUND(AVG(gap_minutes)::numeric, 1) as avg_gap_minutes
FROM booking_gaps
WHERE gap_minutes < 15
GROUP BY tenant_id, assigned_ktv_id
ORDER BY violations_count DESC
LIMIT 10;
```

**Expected Result**: 
- If returns 0 rows: ✅ No existing violations (clean slate)
- If returns rows: ℹ️ Historical violations exist (before this migration), new bookings will be blocked

---

## Troubleshooting

### If UPDATE shows 0 rows
**Possible causes**:
1. All tenants already have capacity_config (good!)
2. No active tenants (check: `SELECT COUNT(*) FROM tenants WHERE status = 'active'`)

### If Verification shows NULL values
**Run this fix**:
```sql
-- Force re-add capacity_config
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
WHERE status = 'active';
```

---

## Rollback (If Needed)

### Disable break time enforcement only
```sql
UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, enforceBreakTimes}',
  'false'::jsonb,
  true
)
WHERE status = 'active';
```

### Remove capacity_config completely
```sql
UPDATE tenants
SET metadata = metadata - 'capacity_config'
WHERE status = 'active';
```

---

## Manual Testing After Deployment

1. **Login as Admin** to BELLA SPA ERP
2. **Go to Bookings** → Create New Booking
3. **Select a KTV** who has a booking today at 14:00
4. **Try to create booking at 14:10** (5 min gap)
   - **Expected**: Error "KTV cần thời gian nghỉ giữa các ca (tối thiểu 15 phút)"
5. **Try to create booking at 14:20** (20 min gap)
   - **Expected**: Success

---

## Success Criteria

✅ All UPDATE statements executed without errors  
✅ Verification Query 1 shows equal counts  
✅ Verification Query 2 shows min_break_minutes = "15"  
✅ Verification Query 2 shows enforce_break_times = "true"  
✅ Manual test rejects 5-minute gap  
✅ Manual test allows 20-minute gap  

---

**Ready to Deploy**: Copy Step 1 queries into SQL Editor and run!
