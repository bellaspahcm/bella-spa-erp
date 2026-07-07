# Sprint 3: Booking Capacity - Business Requirements

**Feature:** Automated Booking Capacity Validation  
**Timeline:** Jul 22-31, 2026 (7 days)  
**Priority:** ⭐⭐⭐⭐ HIGH - Architecture validation  
**Status:** 📋 Planning

---

## 🎯 Business Problem

### Current State (Manual Process)

**When customer books appointment:**
1. Admin checks room availability manually
2. Admin checks KTV availability manually
3. Admin checks time slot conflicts manually
4. Admin verifies service requirements manually

**Pain Points:**
- ⏱️ **Time:** 15-20 minutes per booking review
- ❌ **Errors:** Overbooking happens ~2-3 times/week
- 😞 **Customer experience:** Long wait for confirmation
- 💰 **Revenue loss:** Missed bookings due to slow response

### Target State (Automated)

**When customer submits booking:**
- ✅ System checks capacity **< 100ms**
- ✅ Auto-approve if capacity available
- ⚠️ Auto-waitlist if near capacity (90%+)
- ❌ Auto-reject if fully booked
- 📊 Real-time capacity dashboard

**Expected Impact:**
- ⏱️ Save 15-20 min/booking → ~2 hours/day
- ❌ Reduce overbooking to 0
- 😊 Instant booking confirmation
- 💰 Capture more bookings (faster response)

---

## 📊 Business Rules

### Rule 1: Room Availability ⭐⭐⭐⭐⭐ CRITICAL

**Condition:** No available rooms in time slot  
**Action:** BLOCK booking  
**Reason:** "Không còn phòng trống trong khung giờ này"

**Knowledge Required:**
- Total rooms at branch
- Booked rooms in time slot
- Room maintenance schedule

**Query:**
```sql
SELECT COUNT(*) as available_rooms
FROM rooms
WHERE branch_id = ?
  AND status = 'available'
  AND id NOT IN (
    SELECT room_id 
    FROM bookings 
    WHERE date = ? 
      AND time_slot = ?
      AND status IN ('confirmed', 'pending')
  )
```

---

### Rule 2: KTV Availability ⭐⭐⭐⭐⭐ CRITICAL

**Condition:** Insufficient KTVs for service  
**Action:** BLOCK booking  
**Reason:** "Không đủ kỹ thuật viên trong khung giờ này (cần {required}, chỉ còn {available})"

**Knowledge Required:**
- Total active KTVs at branch
- KTV assignments in time slot
- Service KTV requirements
- KTV leave requests

**Complex Logic:**
```typescript
// Some services need 2 KTVs (e.g., couple massage)
// Some KTVs may be on leave
// Some KTVs may be assigned to multiple bookings

requiredKTVs = service.required_ktvs || 1
availableKTVs = totalKTVs - assignedKTVs - onLeaveKTVs
canBook = availableKTVs >= requiredKTVs
```

---

### Rule 3: Happy Path - Capacity OK ⭐⭐⭐⭐ HIGH

**Condition:** Rooms available AND KTVs available  
**Action:** ALLOW booking  
**Reason:** "Còn đủ phòng và kỹ thuật viên"

**Additional checks:**
- Not a public holiday (need manual approval)
- Not outside business hours
- Service is active (not discontinued)

---

### Rule 4: Near Capacity Waitlist ⭐⭐⭐ MEDIUM

**Condition:** Utilization rate ≥ 90%  
**Action:** WAITLIST booking  
**Reason:** "Gần hết công suất ({utilization}%), đưa vào danh sách chờ"

**Business Rationale:**
- Protect against race conditions (2 bookings at same time)
- Allow manual review for edge cases
- Maintain service quality (not too rushed)

**Utilization Calculation:**
```typescript
utilization = (bookedRooms / totalRooms) * 100
```

---

### Rule 5: Equipment Availability ⭐⭐ LOW

**Condition:** Service requires special equipment (massage beds, steam room, etc.)  
**Action:** ESCALATE if equipment unavailable  
**Reason:** "Thiết bị chuyên dụng đang bảo trì, cần xác nhận lại"

**Future Enhancement:** Track equipment inventory and maintenance schedule

---

### Rule 6: VIP Priority ⭐⭐ LOW

**Condition:** Customer is VIP/Diamond tier  
**Action:** Reserve capacity for VIP (override near-capacity rule)  
**Reason:** "Khách VIP được ưu tiên đặt lịch"

**Future Enhancement:** Dynamic capacity allocation per customer tier

---

## 📐 Data Model

### Input (Booking Request)

```typescript
interface BookingRequest {
  customerId: string;
  branchId: string;
  serviceId: string;
  date: string;          // YYYY-MM-DD
  timeSlot: string;      // e.g., "09:00-11:00"
  requiredKTVs?: number; // Optional override
}
```

### Output (Decision)

```typescript
interface CapacityDecision {
  outcome: 'ALLOW' | 'BLOCK' | 'WAITLIST' | 'ESCALATE';
  explanation: string;
  details: {
    availableRooms: number;
    totalRooms: number;
    availableKTVs: number;
    totalKTVs: number;
    utilizationRate: number;
    conflicts: string[]; // List of conflicting bookings
  };
  executionTime: number; // ms
}
```

---

## 🗄️ Database Schema Requirements

### Existing Tables (Need to Query)

1. **rooms**
   - id, branch_id, name, status (available, maintenance, retired)
   
2. **bookings**
   - id, customer_id, branch_id, service_id, date, time_slot, status (confirmed, pending, cancelled)
   - room_id (nullable)
   
3. **users** (KTVs)
   - id, branch_id, role, status (active, inactive, on_leave)
   
4. **services**
   - id, name, required_ktvs (default 1)
   - duration_minutes
   
5. **staff_leaves** (KTV leave requests)
   - user_id, leave_date, leave_type (morning, afternoon, full_day), status (approved, rejected, pending)

### Potential New Table (Future)

```sql
CREATE TABLE capacity_config (
  branch_id UUID PRIMARY KEY,
  max_concurrent_bookings INT DEFAULT 10,
  vip_reserve_slots INT DEFAULT 2,
  buffer_percentage DECIMAL(3,2) DEFAULT 0.10, -- 10% buffer
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🧪 Test Scenarios

### Scenario 1: Happy Path - Capacity Available ✅

**Given:**
- Branch has 5 rooms
- 2 rooms already booked in time slot
- 10 KTVs available, 3 already assigned
- Service requires 1 KTV

**When:** Customer books service  
**Then:**
- **Outcome:** ALLOW
- **Reason:** "Còn đủ phòng và kỹ thuật viên"
- **Execution time:** < 100ms

---

### Scenario 2: No Rooms Available ❌

**Given:**
- Branch has 5 rooms
- All 5 rooms booked in time slot

**When:** Customer books service  
**Then:**
- **Outcome:** BLOCK
- **Reason:** "Không còn phòng trống trong khung giờ này"

---

### Scenario 3: Insufficient KTVs ❌

**Given:**
- Rooms available
- Service requires 2 KTVs (couple massage)
- Only 1 KTV available in time slot

**When:** Customer books couple massage  
**Then:**
- **Outcome:** BLOCK
- **Reason:** "Không đủ kỹ thuật viên trong khung giờ này (cần 2, chỉ còn 1)"

---

### Scenario 4: Near Capacity Waitlist ⚠️

**Given:**
- Branch has 10 rooms
- 9 rooms already booked (90% utilization)
- KTVs available

**When:** Customer books service  
**Then:**
- **Outcome:** WAITLIST
- **Reason:** "Gần hết công suất (90%), đưa vào danh sách chờ"

---

### Scenario 5: KTV on Leave ❌

**Given:**
- Total KTVs: 5
- 1 KTV on approved leave
- 3 KTVs assigned to bookings
- Service requires 2 KTVs

**When:** Customer books service requiring 2 KTVs  
**Then:**
- **Outcome:** BLOCK
- **Reason:** "Không đủ kỹ thuật viên (available: 1, required: 2)"
- **Note:** Should suggest alternative time slot

---

### Scenario 6: Public Holiday ⚠️

**Given:**
- Capacity available
- Date is public holiday (Tết, National Day, etc.)

**When:** Customer books service  
**Then:**
- **Outcome:** ESCALATE
- **Reason:** "Ngày lễ, cần xác nhận với quản lý"

---

### Scenario 7: VIP Override (Future) ⭐

**Given:**
- Utilization 90% (normally WAITLIST)
- Customer is VIP/Diamond tier

**When:** VIP books service  
**Then:**
- **Outcome:** ALLOW
- **Reason:** "Khách VIP được ưu tiên đặt lịch"

---

### Scenario 8: Multiple Concurrent Requests (Race Condition)

**Given:**
- 1 room available
- 2 customers submit booking simultaneously (within 100ms)

**When:** System processes both requests  
**Then:**
- **First request:** ALLOW
- **Second request:** BLOCK (room already taken)
- **Implementation:** Need transaction lock or optimistic concurrency

---

## 🔍 Edge Cases

### Edge Case 1: Time Slot Overlap

**Problem:** Booking from 09:00-11:00 overlaps with existing 10:00-12:00 booking

**Solution:**
- Define time slot boundaries clearly
- Standard slots: 09:00-11:00, 11:00-13:00, 13:00-15:00, etc.
- No partial overlaps allowed

---

### Edge Case 2: Same-Day Booking

**Problem:** Customer books for today (within next 2 hours)

**Solution:**
- Add minimum advance booking time (e.g., 2 hours)
- Escalate if < 2 hours (need manual confirmation)
- Reason: KTV may not be prepared

---

### Edge Case 3: Service Duration Overflow

**Problem:** Service takes 120 minutes but time slot is only 90 minutes

**Solution:**
- Check service duration vs time slot duration
- Auto-extend to next slot if available
- Block if next slot unavailable

---

### Edge Case 4: KTV Skill Matching (Future)

**Problem:** Not all KTVs qualified for all services (e.g., Thai massage requires certification)

**Solution:**
- Add skill matching to KTV availability check
- Query: `availableKTVs WHERE has_skill(service.required_skill)`

---

## 📊 Performance Requirements

| Metric | Target | Acceptable |
|--------|--------|-----------|
| **Execution Time** | < 50ms | < 100ms |
| **Database Queries** | ≤ 5 | ≤ 8 |
| **Cache Hit Rate** | > 80% | > 60% |
| **Concurrent Requests** | 100/sec | 50/sec |

**Caching Strategy:**
- Cache branch config (1 hour TTL)
- Cache room list (30 min TTL)
- Cache KTV list (15 min TTL)
- Invalidate on status change

---

## 🚀 Success Criteria

### Functional
- ✅ All 8 test scenarios pass
- ✅ No false positives (block when should allow)
- ✅ No false negatives (allow when should block)
- ✅ Correct utilization calculation

### Technical
- ✅ **RuleReasoner unchanged** (no engine modifications)
- ✅ Same API: `reasoner.evaluate(policy, knowledge)`
- ✅ Execution time < 100ms (95th percentile)
- ✅ 8/8 tests passing

### Business
- ✅ Reduce overbooking to 0
- ✅ Save 2 hours/day admin time
- ✅ Instant booking confirmation
- ✅ No customer complaints about wrong capacity info

---

## 🎯 Out of Scope (Future Enhancements)

1. **Multi-branch booking** (customer books at branch A, served at branch B)
2. **Dynamic pricing** (surge pricing at peak times)
3. **Waitlist automation** (auto-promote from waitlist when slot opens)
4. **Predictive capacity** (ML-based capacity forecasting)
5. **Equipment tracking** (massage bed, steam room, etc.)
6. **KTV skill matching** (certifications, experience level)

---

## 📅 Sprint 3 Timeline

| Day | Task | Deliverable |
|-----|------|-------------|
| **Day 1-2** | Design policy + knowledge builder | `booking-capacity-v1.ts` |
| **Day 3** | Implement service layer | `booking-capacity.service.ts` |
| **Day 4** | Integrate with booking form | UI changes |
| **Day 5** | Write tests (8 scenarios) | Test suite |
| **Day 6** | Manual testing + bug fixes | Bug reports |
| **Day 7** | Documentation + demo | Sprint completion doc |

---

## 🤝 Stakeholder Sign-off

**Business Owner:** [Name]  
**Technical Lead:** [Name]  
**Product Manager:** [Name]  

**Approval Date:** _____________

---

**Next:** After approval, proceed to implementation (`SPRINT3_IMPLEMENTATION.md`)
