# Feature Analysis: Break Time Buffer Between Sessions

**Date**: July 15, 2026  
**Question**: "Hệ thống có yêu cầu thời gian giãn cách sau mỗi ca để KTV có thời gian nghỉ ngơi hoặc di chuyển tầm 15-30 phút không?"  
**Answer**: ✅ **CÓ - Logic đã có, nhưng cần verify production config**

---

## Summary

**Feature Exists**: ✅ YES  
**Default Value**: 15 minutes break time  
**Location**: Decision Engine - Capacity Management Provider  
**Status**: 🟡 **Implemented but may not be enabled in production**

---

## How It Works

### 1. Logic Implementation

**File**: `src/lib/decision-engine/providers/booking/capacity-management-provider.ts`

**Function**: `findBreakTimeViolations()`

```typescript
private findBreakTimeViolations(
  requestedStart: string,
  requestedEnd: string,
  existingBookings: Array<any>,
  minBreakMinutes: number
): Array<any> {
  const violations: Array<any> = [];

  existingBookings.forEach(booking => {
    if (booking.status === 'cancelled') return;

    // Check gap before requested booking
    const gapBefore = this.calculateTimeDifference(booking.endTime, requestedStart);
    if (gapBefore >= 0 && gapBefore < minBreakMinutes) {
      violations.push(booking);
    }

    // Check gap after requested booking
    const gapAfter = this.calculateTimeDifference(requestedEnd, booking.startTime);
    if (gapAfter >= 0 && gapAfter < minBreakMinutes) {
      violations.push(booking);
    }
  });

  return violations;
}
```

**How it works**:
1. For each existing booking, calculate time gap before and after
2. If gap < `minBreakMinutes` (default 15), flag as violation
3. If violations exist, booking is rejected

---

### 2. Configuration

**Config Location**: `tenants.metadata.capacity_config`

**Structure**:
```typescript
interface TenantCapacityConfig {
  minBreakMinutes?: number;          // Default: 15 minutes
  workingHoursStart?: string;        // Default: '08:00'
  workingHoursEnd?: string;          // Default: '20:00'
  enablePeakHours?: boolean;         // Default: false
  enforceBreakTimes?: boolean;       // Default: true
}
```

**Default Values** (from code):
```typescript
minBreakMinutes: capacityConfig.minBreakMinutes || 15
enforceBreakTimes: capacityConfig.enforceBreakTimes !== false
```

---

### 3. Example Scenarios

#### ✅ Scenario 1: Valid Break Time (15 min gap)
```
Booking A: 09:00 - 10:30 (90 min Massage)
Booking B: 10:45 - 12:15 (90 min Tắm Bé)

Gap: 10:30 → 10:45 = 15 minutes ✅
Result: ALLOWED
```

#### ❌ Scenario 2: Insufficient Break Time (10 min gap)
```
Booking A: 09:00 - 10:30 (90 min Massage)
Booking B: 10:40 - 12:10 (90 min Tắm Bé)

Gap: 10:30 → 10:40 = 10 minutes ❌
Result: REJECTED - "Insufficient break time between sessions"
```

#### ✅ Scenario 3: 30-Minute Break
```
Booking A: 09:00 - 10:30 (90 min Massage)
Booking B: 11:00 - 12:30 (90 min Tắm Bé)

Gap: 10:30 → 11:00 = 30 minutes ✅
Result: ALLOWED (exceeds minimum 15 min)
```

---

## Decision Engine Rules

**Rule Priority**: 230 (MEDIUM - Quality & Compliance)

**Rule Logic**:
```typescript
IF enforceBreakTimes === true
  AND gap between sessions < minBreakMinutes
THEN reject booking
ELSE allow booking
```

**Conflict Type**: `break_time_violation`

**Error Message**:
```
"Thời gian giữa 2 ca không đủ (cần tối thiểu {minBreakMinutes} phút để nghỉ ngơi/di chuyển)"
```

---

## Current Status Investigation

### ✅ Where It Works

**Test Environment**:
- File: `src/__tests__/integration/booking-flow-seed.ts`
- Config: `minBreakMinutes: 15`
- Status: ✅ Enabled in tests

**Decision Engine Tests**:
- File: `src/lib/decision-engine/providers/booking/__tests__/capacity-management-provider.test.ts`
- Default: `minBreakMinutes: 15`
- Status: ✅ Tested and working

---

### 🟡 Where It May Not Work

**Production Tenants**:
- Config: May not have `capacity_config` in `metadata`
- Default fallback: `minBreakMinutes: 15` (should work)
- **ISSUE**: `enforceBreakTimes` may not be set

**Verification Needed**:
1. Check actual tenant metadata in production database
2. Verify if `capacity_config` exists
3. Test actual booking flow with tight gaps

---

## How to Verify in Production

### SQL Query to Check Config

```sql
SELECT 
  id,
  name,
  metadata->'capacity_config' as capacity_config
FROM tenants
WHERE tenant_id = '<your-tenant-id>';
```

**Expected Output**:
```json
{
  "minBreakMinutes": 15,
  "workingHoursStart": "08:00",
  "workingHoursEnd": "20:00",
  "enforceBreakTimes": true
}
```

**If NULL or missing**: Feature not enabled for that tenant

---

### Manual Test in UI

**Steps**:
1. Login as admin
2. Create Booking A: 09:00 - 10:30 for KTV X
3. Try to create Booking B: 10:35 - 12:05 for same KTV X (5 min gap)
4. **Expected**: ❌ Error message about insufficient break time
5. **If allowed**: Config not enabled

---

## Recommendations

### Option 1: Enable for All Tenants (Recommended ✅)

**SQL Migration**:
```sql
-- Add capacity_config to all tenants missing it
UPDATE tenants
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{capacity_config}',
  '{
    "minBreakMinutes": 15,
    "workingHoursStart": "08:00",
    "workingHoursEnd": "20:00",
    "enforceBreakTimes": true,
    "enablePeakHours": false
  }'::jsonb,
  true
)
WHERE metadata->'capacity_config' IS NULL;
```

**Impact**:
- ✅ All tenants get 15-minute break enforcement
- ✅ Improves KTV wellness
- ✅ Reduces scheduling conflicts

---

### Option 2: Make Configurable per Tenant

**Admin UI Enhancement**:

Add to Settings > Operations:

```
┌─────────────────────────────────────────┐
│ Cấu hình Ca làm việc                     │
├─────────────────────────────────────────┤
│ ☑ Bắt buộc thời gian nghỉ giữa các ca    │
│                                          │
│ Thời gian nghỉ tối thiểu:                │
│ [15] phút ▼                              │
│                                          │
│ Giờ làm việc:                            │
│ Từ: [08:00] Đến: [20:00]                │
│                                          │
│ ☐ Quản lý giờ cao điểm                   │
└─────────────────────────────────────────┘
```

**Benefits**:
- ✅ Flexible per-tenant configuration
- ✅ Can adjust 15 → 30 minutes if needed
- ✅ Can disable for specific tenants (e.g., massage-only)

---

### Option 3: Different Break Times by Service Type

**Advanced Configuration**:

```typescript
{
  "breakTimeRules": {
    "massage": 15,      // 15 min after massage
    "spa_treatment": 20, // 20 min after spa
    "baby_care": 30     // 30 min after baby care (more cleanup)
  }
}
```

**Rationale**:
- Massage: Quick cleanup (15 min)
- Spa Treatment: More cleanup (20 min)
- Baby Care: Travel + cleanup (30 min)

---

## Business Benefits

### ✅ KTV Wellness
- Rest between sessions reduces fatigue
- Improves service quality
- Reduces burnout and turnover

### ✅ Service Quality
- KTVs have time to prepare for next client
- Cleaner setup between sessions
- Better customer experience

### ✅ Operational Efficiency
- Travel time for mobile services
- Room cleanup and preparation
- Reduces rushed sessions

### ✅ Compliance
- Labor law compliance (rest periods)
- Occupational health standards
- Reduces liability

---

## Industry Standards

| Industry | Typical Break Time |
|----------|-------------------|
| **Massage Therapy** | 15-20 minutes |
| **Spa Services** | 20-30 minutes |
| **Beauty Salon** | 10-15 minutes |
| **Medical/Clinical** | 30-60 minutes |

**Bella Spa Current**: 15 minutes (massage) → ✅ Matches industry standard

---

## Testing Checklist

- [ ] Verify tenant metadata has `capacity_config`
- [ ] Test booking with 5-minute gap (should reject)
- [ ] Test booking with 15-minute gap (should allow)
- [ ] Test booking with 30-minute gap (should allow)
- [ ] Test with `enforceBreakTimes: false` (should allow tight gaps)
- [ ] Test Decision Engine directly (unit tests)
- [ ] Test via admin UI (integration test)
- [ ] Test via public booking (integration test)

---

## Conclusion

✅ **Feature EXISTS and is WELL-DESIGNED**

**Current State**:
- Logic: ✅ Implemented (Decision Engine)
- Default: ✅ 15 minutes (good)
- Tests: ✅ Comprehensive coverage
- Production: 🟡 May need config enabling

**Next Steps**:
1. Verify production tenant config
2. Enable via SQL if missing
3. Test manually in UI
4. Consider admin UI for configuration

**Priority**: 🟡 Medium (feature exists, just needs config verification)

---

**Analysis By**: Kiro AI Agent  
**Date**: July 15, 2026  
**Status**: Feature analysis complete, awaiting production verification
