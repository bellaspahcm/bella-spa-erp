# Sprint 3-5: Architecture Validation Plan

**Timeline:** July 22 - August 30, 2026 (6 weeks)  
**Status:** 📋 Planning  
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL - Validates before Payroll investment

---

## 🎯 Objective

**Validate RuleReasoner is truly generic** by implementing 3 more vertical slices with different problem types:

1. **Sprint 3:** Booking Capacity (resource constraint)
2. **Sprint 4:** Promotion Engine (discount stacking)
3. **Sprint 5:** Membership Benefits (tier-based logic)

**Success Criteria:**
- ✅ **ZERO changes to RuleReasoner.ts** across 3 sprints
- ✅ All policies use same API: `reasoner.evaluate(policy, knowledge)`
- ✅ Only policy definitions + knowledge builders change

**If fails:** Refactor RuleReasoner before Payroll  
**If succeeds:** Architecture validated → Ready for Payroll Foundation

---

## 📊 Policy Comparison Matrix

| Aspect | Leave Approval (Sprint 2) | Booking Capacity (Sprint 3) | Promotion (Sprint 4) | Membership (Sprint 5) |
|--------|--------------------------|----------------------------|---------------------|---------------------|
| **Problem Type** | Approval/Rejection | Resource constraint | Discount calculation | Tier-based benefits |
| **Input** | Leave request | Booking request | Cart items | Customer profile |
| **Output** | APPROVE/REJECT/ESCALATE | ALLOW/BLOCK/WAITLIST | Discount % | Benefits list |
| **Complexity** | ⭐ Simple | ⭐⭐ Medium | ⭐⭐⭐ Medium-High | ⭐⭐ Medium |
| **Knowledge Sources** | 3 tables | 5 tables | 4 tables | 3 tables |
| **Rules Count** | 6 rules | 8 rules | 12 rules | 10 rules |
| **Dependencies** | None | Real-time inventory | Order history | RFM segmentation |

**Key Difference:**
- Leave: Boolean logic (yes/no)
- Booking: Numeric constraints (capacity >= demand)
- Promotion: Stacking rules (max 3 promos)
- Membership: Multi-tier cascading

---

## Sprint 3: Booking Capacity Policy (Week Jul 22-31)

### 3.1 Business Problem

**Current:** Admin manually checks if spa has capacity for booking
- Check available rooms
- Check available KTVs
- Check time slot conflicts
- Result: 15-20 min per booking review

**Goal:** Auto-validate booking capacity in <100ms

### 3.2 Policy Rules

```typescript
// booking-capacity-v1.ts
export const bookingCapacityPolicyV1: Policy = {
  id: 'booking-capacity-v1',
  version: '1.0.0',
  name: 'Chính sách kiểm tra công suất đặt lịch',
  
  rules: [
    // Rule 1: Block if no available rooms
    {
      id: 'no-rooms-available',
      priority: 1,
      conditions: {
        type: 'comparison',
        field: 'capacity.availableRooms',
        operator: '<=',
        value: 0
      },
      action: {
        outcome: 'BLOCK',
        reason: 'Không còn phòng trống trong khung giờ này'
      }
    },
    
    // Rule 2: Block if insufficient KTVs
    {
      id: 'insufficient-ktvs',
      priority: 2,
      conditions: {
        type: 'comparison',
        field: 'capacity.availableKTVs',
        operator: '<',
        value: { field: 'booking.requiredKTVs' }
      },
      action: {
        outcome: 'BLOCK',
        reason: 'Không đủ kỹ thuật viên trong khung giờ này'
      }
    },
    
    // Rule 3: Allow if capacity OK
    {
      id: 'capacity-ok',
      priority: 3,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          {
            type: 'comparison',
            field: 'capacity.availableRooms',
            operator: '>',
            value: 0
          },
          {
            type: 'comparison',
            field: 'capacity.availableKTVs',
            operator: '>=',
            value: { field: 'booking.requiredKTVs' }
          }
        ]
      },
      action: {
        outcome: 'ALLOW',
        reason: 'Còn đủ phòng và kỹ thuật viên'
      }
    },
    
    // Rule 4: Waitlist if near capacity (90%+)
    {
      id: 'near-capacity-waitlist',
      priority: 4,
      conditions: {
        type: 'comparison',
        field: 'capacity.utilizationRate',
        operator: '>=',
        value: 0.9
      },
      action: {
        outcome: 'WAITLIST',
        reason: 'Gần hết công suất, đưa vào danh sách chờ'
      }
    }
  ]
};
```

### 3.3 Knowledge Builder

```typescript
export async function buildBookingKnowledge(booking: {
  date: string;
  timeSlot: string;
  serviceId: string;
  branchId: string;
}): Promise<Knowledge> {
  const supabase = await createClient();
  
  // 1. Count available rooms
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, status')
    .eq('branch_id', booking.branchId)
    .eq('status', 'available');
  
  // 2. Count available KTVs
  const { data: ktvs } = await supabase
    .from('users')
    .select('id, status')
    .eq('role', 'ktv')
    .eq('status', 'active');
  
  // 3. Count existing bookings in same time slot
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('date', booking.date)
    .eq('time_slot', booking.timeSlot)
    .eq('branch_id', booking.branchId)
    .in('status', ['confirmed', 'pending']);
  
  // 4. Get service requirements
  const { data: service } = await supabase
    .from('services')
    .select('required_ktvs')
    .eq('id', booking.serviceId)
    .single();
  
  // Calculate metrics
  const totalRooms = rooms?.length || 0;
  const usedRooms = existingBookings?.length || 0;
  const availableRooms = totalRooms - usedRooms;
  
  const totalKTVs = ktvs?.length || 0;
  const usedKTVs = existingBookings?.reduce((sum, b) => sum + (service?.required_ktvs || 1), 0) || 0;
  const availableKTVs = totalKTVs - usedKTVs;
  
  const utilizationRate = totalRooms > 0 ? usedRooms / totalRooms : 0;
  
  return {
    'capacity.availableRooms': availableRooms,
    'capacity.availableKTVs': availableKTVs,
    'capacity.utilizationRate': utilizationRate,
    'booking.requiredKTVs': service?.required_ktvs || 1,
    'booking.date': booking.date,
    'booking.timeSlot': booking.timeSlot
  };
}
```

### 3.4 Integration Points

- **UI:** Booking form (real-time capacity check)
- **API:** `POST /api/bookings/check-capacity`
- **Service:** `booking-capacity.service.ts`
- **Tests:** 8 test scenarios (full capacity, partial, waitlist, etc.)

### 3.5 Success Criteria

- ✅ RuleReasoner evaluates capacity policy correctly
- ✅ No changes needed to RuleReasoner.ts
- ✅ Execution time < 100ms
- ✅ 8/8 tests passing

---

## Sprint 4: Promotion Engine (Week Aug 5-16)

### 4.1 Business Problem

**Current:** Manual promotion validation
- Check eligibility
- Check stacking rules
- Calculate total discount
- Result: Errors, disputes, revenue loss

**Goal:** Auto-validate promotions with stacking rules

### 4.2 Policy Rules (12 rules)

```typescript
// Promotion stacking examples:
// - Max 3 promos per order
// - VIP discount + Member discount OK
// - 2 product-specific promos NOT OK
// - Holiday promo exclusive (no stacking)
```

### 4.3 Knowledge Builder

```typescript
export async function buildPromotionKnowledge(order: {
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  appliedPromoCodes: string[];
}): Promise<Knowledge> {
  // Query:
  // - Customer tier
  // - Order history (for loyalty promos)
  // - Promotion rules from database
  // - Product categories
  
  return {
    'customer.tier': 'vip',
    'order.subtotal': 5000000,
    'order.itemCount': 3,
    'promos.count': 2,
    'promos.types': ['percentage', 'fixed'],
    'promos.hasExclusive': false,
    'customer.totalOrders': 15
  };
}
```

### 4.4 Success Criteria

- ✅ Handles complex stacking logic
- ✅ RuleReasoner unchanged
- ✅ 12/12 tests passing

---

## Sprint 5: Membership Benefits (Week Aug 19-30)

### 5.1 Business Problem

**Current:** Manual membership tier assignment
- Calculate RFM score
- Assign tier
- Apply benefits
- Result: Inconsistent, delayed updates

**Goal:** Auto-assign tiers + benefits

### 5.2 Policy Rules (10 rules)

```typescript
// Tier assignment:
// - Bronze: < 10M lifetime value
// - Silver: 10M - 50M
// - Gold: 50M - 100M
// - Diamond: 100M+

// Benefits per tier:
// - Bronze: 5% discount
// - Silver: 10% discount + free gift
// - Gold: 15% discount + priority booking
// - Diamond: 20% discount + personal account manager
```

### 5.3 Knowledge Builder

```typescript
export async function buildMembershipKnowledge(customer: {
  id: string;
}): Promise<Knowledge> {
  // Query:
  // - Total lifetime revenue
  // - Recency (last visit)
  // - Frequency (visit count)
  // - Current tier
  
  return {
    'customer.lifetimeValue': 75000000,
    'customer.recency': 15, // days since last visit
    'customer.frequency': 24, // visit count
    'customer.currentTier': 'silver',
    'customer.memberSince': '2024-01-15'
  };
}
```

### 5.4 Success Criteria

- ✅ Tier logic correct
- ✅ RuleReasoner unchanged
- ✅ 10/10 tests passing

---

## 🎯 After Sprint 5: Decision Point

### Option A: Architecture Validated ✅

**Evidence:**
- 4 different policies (Leave, Booking, Promotion, Membership)
- 0 changes to RuleReasoner across all sprints
- All tests passing

**Action:** Proceed to Payroll Foundation (Sprint 6-7)

---

### Option B: Architecture Needs Refactor ❌

**Evidence:**
- RuleReasoner needed changes in Sprint 3/4/5
- API inconsistencies
- Performance issues

**Action:** Refactor RuleReasoner BEFORE Payroll
- Sprint 6: Refactor + re-test all 4 policies
- Sprint 7: Payroll Foundation (delayed)

---

## 📊 Sprint 3-5 Velocity Targets

| Sprint | Effort (days) | LOC | Tests | Policies |
|--------|--------------|-----|-------|----------|
| Sprint 3 | 7 days | ~400 | 8 | 1 (Booking) |
| Sprint 4 | 9 days | ~600 | 12 | 1 (Promotion) |
| Sprint 5 | 7 days | ~450 | 10 | 1 (Membership) |
| **Total** | **23 days** | **~1,450** | **30** | **3** |

**Expected velocity:** 63 LOC/day (sustainable for complex policies)

---

## 🚀 Deliverables (Sprint 3-5)

### Code
- ✅ 3 policy files (booking, promotion, membership)
- ✅ 3 knowledge builders
- ✅ 3 service integrations
- ✅ 30 tests (unit + integration)

### Documentation
- ✅ SPRINT_3_COMPLETION_SUMMARY.md
- ✅ SPRINT_4_COMPLETION_SUMMARY.md
- ✅ SPRINT_5_COMPLETION_SUMMARY.md
- ✅ ARCHITECTURE_VALIDATION_REPORT.md (after Sprint 5)

### Business Value
- ✅ Auto booking capacity check
- ✅ Auto promotion validation
- ✅ Auto membership tier assignment

---

## 💡 Key Insight

> **"Payroll is 10-20x more complex than Leave. We need proof the engine can handle medium complexity (Booking, Promotion, Membership) before betting on high complexity (Payroll)."**

This roadmap trades 3 weeks of validation work for **2-3 months of avoided rework** if architecture is wrong.

**ROI:** 400-800% time saved

---

**Next:** After Sprint 5, review `ARCHITECTURE_VALIDATION_REPORT.md` before greenlighting Payroll Foundation.
