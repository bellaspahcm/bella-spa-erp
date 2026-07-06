# Phase B Week 1: Overbooking Detection Integration

**Date**: June 22, 2026  
**Status**: ✅ COMPLETED  
**Integration Point**: Booking Creation Flow

---

## 🎯 Objective

Integrate Decision Engine's overbooking detection policy into Bella Spa's booking creation workflow to prevent scheduling conflicts.

---

## 📦 Components Integrated

### 1. Policy Rules (Already Created)
File: `src/policies/booking/overbooking-detection.ts`

**4 Rules**:
1. **KTV Double Booking** (Priority 100 - Critical)
   - Prevents KTV from being assigned to multiple sessions at same time
   - Time slot overlap detection (HH:MM + duration)
   - Returns conflict details (customer name, booking ID, time)

2. **Room Double Booking** (Priority 95 - Critical)
   - Prevents room from being double-booked
   - Similar overlap detection for booking resources

3. **Soft Limit Warning** (Priority 50 - Advisory)
   - Warns when KTV has >8 sessions/day
   - Does NOT block booking (warning only)

4. **Hard Limit Block** (Priority 90 - Critical)
   - Blocks when KTV has ≥10 sessions/day
   - Critical safety limit

### 2. Decision Wrapper (Already Created)
File: `src/services/decision-actions/booking-decisions.ts`

**Function**: `checkBookingConflicts()`
- Tenant-isolated
- Fail-open on errors (don't block legitimate bookings)
- Returns detailed conflict information

### 3. UI Integration (NEW - This PR)
File: `src/app/dashboard/bookings/hooks/useBookingsPageActions.ts`

**Modified Function**: `handleCreateScheduleSubmit()`

**Changes**:
```typescript
// 1. Import decision function
import { checkBookingConflicts } from '@/services/decision-actions/booking-decisions';

// 2. Fetch booking data to get assigned KTV
const bookingResult = await getBookingDetailsWithPayment(bookingId);
const assignedKtvId = booking.assigned_ktv_id || null;

// 3. Check for conflicts BEFORE creating session
const conflictCheck = await checkBookingConflicts({
  bookingId,
  ktvId: assignedKtvId,
  bookingResourceId,
  assignedDate: date,
  assignedTime: createTimeRange.start,
  durationMinutes: 90, // Default, TODO: get from package
});

// 4. Handle decision result
if (conflictCheck.decision === 'REJECT') {
  // Show error toast + conflict details
  // Block session creation
  return;
}

if (conflictCheck.decision === 'APPROVE_WITH_WARNING') {
  // Show warning toast
  // Allow session creation
}

// 5. Proceed with createSessionLog() if approved
```

---

## 🔄 Flow Diagram

### Before Integration
```
User clicks "Tạo lịch hẹn"
  ↓
Extract form data (booking_id, date, time, resource_id)
  ↓
Call createSessionLog() immediately  ❌ No validation
  ↓
Show success toast
```

### After Integration
```
User clicks "Tạo lịch hẹn"
  ↓
Extract form data
  ↓
Fetch booking details (get assigned_ktv_id)
  ↓
Call checkBookingConflicts()  ⭐ NEW
  ↓
Decision Engine evaluates 4 rules
  ↓
├─ REJECT → Show error + conflict details → Block creation
├─ APPROVE_WITH_WARNING → Show warning → Continue creation
└─ APPROVE → Continue creation
  ↓
Call createSessionLog()
  ↓
Show success toast
```

---

## 📊 User Experience Examples

### Example 1: KTV Double Booking (BLOCKED)
```
User tries to book KTV "Bella" at 08:30
  ↓
Engine detects: Bella already has booking at 08:30 with customer "Nguyễn Thị A"
  ↓
Toast Error: "Không thể tạo lịch hẹn do xung đột"
Toast Error: "⚠️ KTV đã có lịch lúc 08:30 với khách Nguyễn Thị A"
  ↓
Modal stays open, user can adjust time/KTV
```

### Example 2: Room Double Booking (BLOCKED)
```
User tries to book "Phòng VIP 1" at 14:00
  ↓
Engine detects: Room already booked at 14:00
  ↓
Toast Error: "⚠️ Phòng Phòng VIP 1 đã có lịch lúc 14:00"
  ↓
Modal stays open, user can select different room
```

### Example 3: Soft Limit Warning (ALLOWED)
```
User tries to book KTV "Bella" for 9th session today
  ↓
Engine detects: 9 sessions > 8 (soft limit)
  ↓
Toast Warning: "Cảnh báo: Vượt quá số ca khuyến nghị"
  ↓
Booking still created successfully ✅
```

### Example 4: Hard Limit Block (BLOCKED)
```
User tries to book KTV "Bella" for 10th session today
  ↓
Engine detects: 10 sessions ≥ 10 (hard limit)
  ↓
Toast Error: "Không thể tạo lịch hẹn do xung đột"
  ↓
Booking blocked ❌
```

---

## 🛡️ Safety Features

1. **Fail-Open Strategy**
   - If Decision Engine fails (network, database error)
   - Booking creation proceeds normally
   - Error logged but user not blocked
   - Rationale: Better to allow legitimate booking than false reject

2. **Tenant Isolation**
   - All queries filtered by `tenant_id`
   - Bella Spa KTVs cannot see Beauty Spa bookings
   - No cross-tenant conflicts

3. **Graceful Error Handling**
   - Try-catch around entire decision logic
   - User-friendly error messages
   - Console logs for debugging

4. **No Breaking Changes**
   - Existing booking flow unchanged
   - Only adds validation layer
   - Can be disabled via feature flag (future)

---

## 📈 Expected Impact

### Week 1 Metrics (Target)
- **Decisions/day**: 500-1,000
- **Reject rate**: 1-5% (estimated based on manual conflicts)
- **Warning rate**: 10-20% (soft limit triggers)
- **Error rate**: <0.1% (fail-open)

### Business Value
1. **Prevent Double Bookings**: No more KTV/room conflicts
2. **Workload Protection**: Prevent burnout (10+ sessions/day)
3. **Better Planning**: Warnings help managers redistribute load
4. **Audit Trail**: Every booking decision logged for analysis

---

## 🧪 Testing Plan

### Manual Testing (Day 1)
- [ ] Test happy path (no conflicts)
- [ ] Test KTV double-booking (same time)
- [ ] Test room double-booking
- [ ] Test soft limit (9 sessions)
- [ ] Test hard limit (10 sessions)
- [ ] Test with no KTV assigned (should pass)
- [ ] Test with no room assigned (should pass)
- [ ] Test fail-open (simulate DB error)

### Production Monitoring (Week 1)
- [ ] Monitor Gate 3 metrics (queue depth, error rate)
- [ ] Check `audit_log` table for decision records
- [ ] Analyze rejection patterns (which rules trigger most)
- [ ] User feedback (any false rejections?)

---

## 🔜 Next Steps

### Week 1 Remaining Tasks
1. ✅ Integration complete
2. ⏳ Local testing (manual scenarios)
3. ⏳ Deploy to staging
4. ⏳ Monitor first 100 decisions
5. ⏳ Collect feedback from staff

### Week 2-4 (Other Business Integrations)
- Week 2: Booking Pricing (200-500/day)
- Week 3: Discount Approval (100-200/day)
- Week 4: Payroll Calculation (2k-5k/month)

---

## 📝 Notes

### Known Limitations
1. **Duration hardcoded to 90 minutes**
   - TODO: Get from package metadata
   - Currently using default for all bookings

2. **No time zone handling**
   - Assumes all times in Vietnam timezone
   - Works for single-country deployment

3. **No calendar integration**
   - Only checks Bella Spa's internal sessions
   - External calendars (Google, Outlook) not checked

### Future Enhancements
1. **Feature flag support** - Enable/disable per tenant
2. **Custom limits per KTV** - Some KTVs can handle 12 sessions/day
3. **Break time detection** - Ensure 15-min breaks between sessions
4. **Staff availability** - Check annual leave, sick leave

---

## 🎉 Success Criteria

**Definition of Done for Week 1**:
- ✅ Integration code complete (no TypeScript errors)
- ⏳ Manual testing passed (8 scenarios)
- ⏳ Deployed to production
- ⏳ First 100 decisions recorded
- ⏳ Zero production incidents
- ⏳ User feedback collected

**Phase B Week 1 Status**: 🟢 ON TRACK

---

**Last Updated**: June 22, 2026  
**Author**: Kiro AI Agent  
**Review Status**: Awaiting manual testing & deployment
