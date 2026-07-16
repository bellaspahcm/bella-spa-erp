# Deployment: Enable Break Time Buffer

**Date**: July 15, 2026  
**Feature**: 15-minute break time enforcement between KTV sessions  
**Priority**: P2 (Quality of Life improvement)  
**Risk**: 🟢 Low (additive change, no breaking changes)

---

## Summary

**What**: Enable 15-minute break time buffer between KTV sessions  
**Why**: Improve KTV wellness, service quality, and reduce burnout  
**How**: Add `capacity_config` to tenant metadata via SQL migration  

---

## Pre-Deployment Checklist

### 1. Verify Current State
Run verification script in production:

```bash
# Copy script content
cat scripts/verify-break-time-config.sql

# Run in Supabase SQL Editor
# Or via psql:
psql $DATABASE_URL -f scripts/verify-break-time-config.sql
```

**Expected Output**:
```
Total active tenants: X
Tenants with capacity_config: Y (may be < X)
Tenants with break time enabled: Z (may be 0)
```

---

### 2. Backup Current Metadata (Optional but Recommended)
```sql
-- Create backup table
CREATE TABLE IF NOT EXISTS tenants_metadata_backup_20260715 AS
SELECT id, name, metadata, updated_at
FROM tenants;

-- Verify backup
SELECT COUNT(*) FROM tenants_metadata_backup_20260715;
```

---

### 3. Test Migration Locally First

```bash
# Start local Supabase
supabase start

# Apply migration
supabase db reset

# Or apply specific migration
supabase db push
```

**Verify**:
```sql
SELECT metadata->'capacity_config' 
FROM tenants 
LIMIT 1;
```

**Expected**:
```json
{
  "minBreakMinutes": 15,
  "workingHoursStart": "08:00",
  "workingHoursEnd": "20:00",
  "enforceBreakTimes": true,
  "enablePeakHours": false,
  "bufferPercentage": 10
}
```

---

## Deployment Steps

### Option 1: Via Supabase Migrations (Recommended ✅)

```bash
# 1. Push migration to production
supabase db push --project-ref <production-project-ref>

# 2. Verify migration applied
supabase db diff --linked

# 3. Check migration status
supabase migrations list --linked
```

---

### Option 2: Manual SQL Execution (If migrations not available)

```sql
-- Copy entire content of:
-- supabase/migrations/20260715200000_enable_break_time_buffer.sql

-- Paste and run in Supabase SQL Editor (Production)
```

---

### Option 3: Gradual Rollout (Safest for Production)

**Phase 1: Enable for 1 test tenant**
```sql
UPDATE tenants
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{capacity_config}',
  jsonb_build_object(
    'minBreakMinutes', 15,
    'enforceBreakTimes', true
  ),
  true
)
WHERE id = '<test-tenant-id>';
```

**Phase 2: Test manually**
1. Login to test tenant
2. Create booking 09:00-10:30
3. Try booking 10:35-12:05 (5 min gap) → Should reject ✅
4. Try booking 10:45-12:15 (15 min gap) → Should allow ✅

**Phase 3: Enable for all tenants**
```sql
-- Run full migration
-- (content from 20260715200000_enable_break_time_buffer.sql)
```

---

## Post-Deployment Verification

### 1. Check Configuration Applied

```sql
-- Run verification script
-- (content from scripts/verify-break-time-config.sql)
```

**Success Criteria**:
- ✅ All active tenants have `capacity_config`
- ✅ All have `minBreakMinutes >= 15`
- ✅ All have `enforceBreakTimes = true`

---

### 2. Test via UI

**Test Case 1: Reject tight gap**
1. Create Booking A: 09:00-10:30 (KTV Alice)
2. Try Booking B: 10:35-12:05 (KTV Alice, 5 min gap)
3. **Expected**: ❌ Error "Thời gian giữa 2 ca không đủ"

**Test Case 2: Allow sufficient gap**
1. Create Booking A: 09:00-10:30 (KTV Alice)
2. Try Booking B: 10:45-12:15 (KTV Alice, 15 min gap)
3. **Expected**: ✅ Success

**Test Case 3: Different KTVs (no conflict)**
1. Create Booking A: 09:00-10:30 (KTV Alice)
2. Try Booking B: 10:35-12:05 (KTV Bob)
3. **Expected**: ✅ Success (different KTVs)

---

### 3. Monitor Logs

```sql
-- Check if Decision Engine is being called
SELECT 
  COUNT(*) as decision_checks,
  COUNT(*) FILTER (WHERE result->>'available' = 'false') as rejections,
  COUNT(*) FILTER (WHERE result->'conflicts' @> '[{"type": "break_time_violation"}]') as break_time_rejections
FROM audit_logs
WHERE action = 'check_capacity'
  AND created_at >= NOW() - INTERVAL '1 hour';
```

---

## Expected Impact

### ✅ Positive Changes
1. **KTV Wellness**: 15-minute rest between sessions
2. **Service Quality**: Better preparation time
3. **Data Integrity**: Prevents scheduling conflicts
4. **Compliance**: Meets labor standards

### ⚠️ Potential User Friction
1. **Booking Rejections**: Some tight schedules may be rejected
2. **Admin Workflow**: May need to adjust booking times
3. **Customer Communication**: May need to explain gaps

**Mitigation**:
- Clear error messages explaining reason
- Suggest alternative times
- Communicate feature to staff beforehand

---

## Rollback Plan

### If Break Time Enforcement Causes Issues

**Option 1: Disable for Specific Tenant**
```sql
UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, enforceBreakTimes}',
  'false'::jsonb,
  true
)
WHERE id = '<tenant-id>';
```

**Option 2: Reduce Break Time (15 → 10 minutes)**
```sql
UPDATE tenants
SET metadata = jsonb_set(
  metadata,
  '{capacity_config, minBreakMinutes}',
  '10'::jsonb,
  true
)
WHERE id = '<tenant-id>';
```

**Option 3: Disable for All Tenants**
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

**Option 4: Complete Rollback (Remove Config)**
```sql
-- Restore from backup
UPDATE tenants t
SET metadata = b.metadata
FROM tenants_metadata_backup_20260715 b
WHERE t.id = b.id;
```

---

## Communication Plan

### For Admins (Before Deployment)

**Slack/Email**:
> 📢 **Cập nhật hệ thống: Thời gian nghỉ giữa các ca**
> 
> Từ ngày 15/07/2026, hệ thống sẽ tự động kiểm tra thời gian nghỉ giữa các ca của KTV.
> 
> **Thay đổi**:
> - Mỗi KTV cần tối thiểu **15 phút nghỉ** giữa 2 ca liên tiếp
> - Hệ thống sẽ từ chối booking nếu thời gian giữa 2 ca < 15 phút
> 
> **Ví dụ**:
> - Ca 1: 09:00 - 10:30
> - Ca 2: 10:35 - 12:05 → ❌ Bị từ chối (chỉ có 5 phút nghỉ)
> - Ca 2: 10:45 - 12:15 → ✅ Được chấp nhận (15 phút nghỉ)
> 
> **Lý do**: Đảm bảo KTV có thời gian nghỉ ngơi, di chuyển, và chuẩn bị cho ca tiếp theo.
> 
> Nếu có thắc mắc, vui lòng liên hệ @tech-team.

### For KTVs

**Thông báo**:
> 💆 **Tin tốt: Thời gian nghỉ ngơi được đảm bảo!**
> 
> Từ hôm nay, hệ thống sẽ tự động đảm bảo chị có **ít nhất 15 phút nghỉ** giữa các ca.
> 
> Điều này giúp:
> - Có thời gian nghỉ ngơi
> - Di chuyển giữa các phòng/địa điểm
> - Chuẩn bị tốt hơn cho khách tiếp theo
> 
> Chất lượng dịch vụ tốt hơn, sức khỏe được bảo vệ! 💪

---

## Monitoring & Metrics

### Track for First Week

**Daily Metrics**:
1. Number of bookings rejected due to break time
2. Average gap time between sessions
3. Admin feedback/complaints
4. KTV satisfaction scores

**Query**:
```sql
-- Daily break time rejections
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_rejections,
  COUNT(*) FILTER (WHERE result->'conflicts' @> '[{"type": "break_time_violation"}]') as break_time_rejections
FROM audit_logs
WHERE action = 'check_capacity'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Success Criteria

After 1 week:
- ✅ Break time config applied to all tenants
- ✅ Decision Engine correctly rejects tight gaps
- ✅ < 5 admin complaints about "too strict"
- ✅ No system errors or crashes
- ✅ KTV feedback positive or neutral

---

## Timeline

| Phase | Duration | Checklist |
|-------|----------|-----------|
| **Pre-Deploy** | 30 min | ✅ Verify current state<br>✅ Backup metadata<br>✅ Test locally |
| **Deploy** | 15 min | ✅ Run migration<br>✅ Verify applied |
| **Verify** | 30 min | ✅ Check config<br>✅ Test UI<br>✅ Monitor logs |
| **Monitor** | 1 week | ✅ Track metrics<br>✅ Gather feedback |
| **Review** | 1 hour | ✅ Analyze data<br>✅ Decide on adjustments |

**Total Time**: ~2 hours (deploy + verification)

---

## Conclusion

✅ **Ready for Production Deployment**

**Risk Level**: 🟢 Low  
**Complexity**: Simple SQL migration  
**Impact**: Positive (KTV wellness)  
**Rollback**: Easy (single UPDATE query)

**Recommended Approach**: Gradual rollout (1 tenant → all tenants)

---

**Prepared By**: Kiro AI Agent  
**Date**: July 15, 2026  
**Status**: Ready for execution
