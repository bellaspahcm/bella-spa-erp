# Sprint 3: Booking Capacity - Implementation Plan

**Timeline:** Jul 22-31, 2026 (7 days)  
**Status:** 📋 Ready to Start  
**Prerequisites:** ✅ Sprint 2 complete, ✅ Requirements approved

---

## 🏗️ Architecture Overview

```
Booking Form (UI)
    ↓
checkBookingCapacity() [Server Action]
    ↓
BookingCapacityService.evaluate()
    ↓
buildBookingKnowledge() [Query 5 tables]
    ↓
RuleReasoner.evaluate(bookingCapacityPolicyV1, knowledge)
    ↓
Decision { outcome, explanation, details }
    ↓
UI displays result (Allow/Block/Waitlist)
```

**Key Principle:** Reuse RuleReasoner from Sprint 2, **NO ENGINE CHANGES**

---

## 📁 File Structure

```
src/
├── lib/decision-engine/
│   ├── RuleReasoner.ts                    [NO CHANGES]
│   ├── types.ts                           [NO CHANGES]
│   └── policies/
│       ├── leave-approval-v1.ts           [Existing]
│       └── booking-capacity-v1.ts         [NEW - 350 LOC]
│
├── services/
│   ├── leave-decision.service.ts          [Existing]
│   └── booking-capacity.service.ts        [NEW - 400 LOC]
│
├── app/
│   └── dashboard/
│       └── bookings/
│           ├── actions.ts                 [NEW - 150 LOC]
│           └── components/
│               └── BookingCapacityCheck.tsx [NEW - 250 LOC]
│
└── __tests__/
    └── booking-capacity/
        ├── policy.test.ts                 [NEW - 200 LOC]
        ├── service.test.ts                [NEW - 250 LOC]
        └── integration.test.ts            [NEW - 300 LOC]

Total: ~1,900 LOC (more complex than Leave Approval due to multi-table queries)
```

---

## 🎯 Day-by-Day Implementation

### Day 1-2: Policy Definition + Knowledge Builder

#### Step 1.1: Define Policy Rules

File: `src/lib/decision-engine/policies/booking-capacity-v1.ts`

```typescript
/**
 * Booking Capacity Policy v1
 * 
 * Validates booking requests against:
 * - Room availability
 * - KTV availability  
 * - Capacity utilization
 * - Public holidays
 */

import type { Policy } from '../types';

export const bookingCapacityPolicyV1: Policy = {
  id: 'booking-capacity-v1',
  version: '1.0.0',
  name: 'Chính sách kiểm tra công suất đặt lịch',
  description: 'Tự động kiểm tra phòng, kỹ thuật viên, và công suất trước khi xác nhận đặt lịch',
  
  rules: [
    // Rule 1: CRITICAL - No rooms available
    {
      id: 'no-rooms-block',
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
    
    // Rule 2: CRITICAL - Insufficient KTVs
    {
      id: 'insufficient-ktvs-block',
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
    
    // Rule 3: Public holiday - need manual approval
    {
      id: 'holiday-escalate',
      priority: 3,
      conditions: {
        type: 'comparison',
        field: 'context.isHoliday',
        operator: '===',
        value: true
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Ngày lễ, cần xác nhận với quản lý'
      }
    },
    
    // Rule 4: Near capacity - waitlist
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
        reason: 'Gần hết công suất, đưa vào danh sách chờ để xác nhận'
      }
    },
    
    // Rule 5: Same-day booking - escalate if < 2h advance
    {
      id: 'short-notice-escalate',
      priority: 5,
      conditions: {
        type: 'comparison',
        field: 'booking.hoursUntilBooking',
        operator: '<',
        value: 2
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Đặt lịch gấp (< 2 giờ), cần xác nhận khả năng chuẩn bị'
      }
    },
    
    // Rule 6: Happy path - capacity OK
    {
      id: 'capacity-ok-allow',
      priority: 100,
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
          },
          {
            type: 'comparison',
            field: 'capacity.utilizationRate',
            operator: '<',
            value: 0.9
          }
        ]
      },
      action: {
        outcome: 'ALLOW',
        reason: 'Còn đủ phòng và kỹ thuật viên'
      }
    }
  ]
};
```

#### Step 1.2: Knowledge Builder

File: `src/services/booking-capacity.service.ts`

```typescript
/**
 * Booking Capacity Service
 * 
 * Evaluates booking capacity using Decision Engine
 */

import { RuleReasoner } from '@/lib/decision-engine/RuleReasoner';
import { bookingCapacityPolicyV1 } from '@/lib/decision-engine/policies/booking-capacity-v1';
import type { Knowledge, DecisionResult } from '@/lib/decision-engine/types';
import { differenceInHours } from 'date-fns';
import { createClient } from '@/lib/supabase-server';

/**
 * Build knowledge from booking request
 */
export async function buildBookingKnowledge(request: {
  branchId: string;
  serviceId: string;
  date: string;        // YYYY-MM-DD
  timeSlot: string;    // e.g., "09:00-11:00"
}): Promise<Knowledge> {
  const supabase = await createClient();
  
  // 1. Get total rooms at branch
  const { data: allRooms } = await supabase
    .from('rooms')
    .select('id, status')
    .eq('branch_id', request.branchId)
    .eq('status', 'available');
  
  const totalRooms = allRooms?.length || 0;
  
  // 2. Get booked rooms in time slot
  const { data: bookedRooms } = await supabase
    .from('bookings')
    .select('room_id')
    .eq('date', request.date)
    .eq('time_slot', request.timeSlot)
    .eq('branch_id', request.branchId)
    .in('status', ['confirmed', 'pending'])
    .not('room_id', 'is', null);
  
  const usedRooms = bookedRooms?.length || 0;
  const availableRooms = totalRooms - usedRooms;
  
  // 3. Get total active KTVs at branch
  const { data: allKTVs } = await supabase
    .from('users')
    .select('id, status')
    .eq('role', 'ktv')
    .eq('status', 'active')
    .eq('branch_id', request.branchId);
  
  const totalKTVs = allKTVs?.length || 0;
  
  // 4. Get KTVs on leave
  const { data: onLeaveKTVs } = await supabase
    .from('staff_leaves')
    .select('user_id')
    .eq('leave_date', request.date)
    .eq('status', 'approved');
  
  const ktvOnLeave = onLeaveKTVs?.length || 0;
  
  // 5. Get KTVs already assigned in time slot
  const { data: assignedKTVs } = await supabase
    .from('session_logs')
    .select('ktv_id')
    .eq('session_date', request.date)
    .in('status', ['pending', 'confirmed'])
    .not('ktv_id', 'is', null);
  
  // Count unique KTVs (one KTV can be assigned to multiple sessions)
  const uniqueAssignedKTVs = new Set(assignedKTVs?.map(a => a.ktv_id)).size;
  
  const availableKTVs = totalKTVs - ktvOnLeave - uniqueAssignedKTVs;
  
  // 6. Get service requirements
  const { data: service } = await supabase
    .from('services')
    .select('required_ktvs')
    .eq('id', request.serviceId)
    .single();
  
  const requiredKTVs = service?.required_ktvs || 1;
  
  // 7. Calculate utilization rate
  const utilizationRate = totalRooms > 0 ? usedRooms / totalRooms : 0;
  
  // 8. Calculate hours until booking
  const bookingDateTime = new Date(`${request.date} ${request.timeSlot.split('-')[0]}`);
  const hoursUntilBooking = differenceInHours(bookingDateTime, new Date());
  
  // 9. Check if holiday (simplified - can integrate with holiday API)
  const isHoliday = false; // TODO: Implement holiday check
  
  return {
    'capacity.availableRooms': availableRooms,
    'capacity.totalRooms': totalRooms,
    'capacity.availableKTVs': availableKTVs,
    'capacity.totalKTVs': totalKTVs,
    'capacity.utilizationRate': utilizationRate,
    'booking.requiredKTVs': requiredKTVs,
    'booking.hoursUntilBooking': hoursUntilBooking,
    'booking.date': request.date,
    'booking.timeSlot': request.timeSlot,
    'context.isHoliday': isHoliday
  };
}

/**
 * Evaluate booking capacity
 */
export async function evaluateBookingCapacity(request: {
  branchId: string;
  serviceId: string;
  date: string;
  timeSlot: string;
}): Promise<{
  decision: DecisionResult;
  knowledge: Knowledge;
  executionTimeMs: number;
}> {
  const startTime = performance.now();
  
  // 1. Build knowledge
  const knowledge = await buildBookingKnowledge(request);
  
  // 2. Initialize reasoner
  const reasoner = new RuleReasoner({
    debug: process.env.NODE_ENV !== 'production'
  });
  
  // 3. Evaluate
  const decision = reasoner.evaluate(bookingCapacityPolicyV1, knowledge);
  
  const executionTimeMs = performance.now() - startTime;
  
  // 4. Log telemetry
  console.log('[DecisionEngine]', JSON.stringify({
    timestamp: new Date().toISOString(),
    policy: bookingCapacityPolicyV1.id,
    policyVersion: bookingCapacityPolicyV1.version,
    outcome: decision.outcome,
    reason: decision.explanation,
    durationMs: Math.round(executionTimeMs),
    knowledge: {
      availableRooms: knowledge['capacity.availableRooms'],
      availableKTVs: knowledge['capacity.availableKTVs'],
      utilizationRate: knowledge['capacity.utilizationRate']
    }
  }));
  
  return {
    decision,
    knowledge,
    executionTimeMs
  };
}
```

**Estimated LOC:** 350 (policy) + 400 (service) = **750 LOC**

---

### Day 3: Server Action Integration

File: `src/app/dashboard/bookings/actions.ts`

```typescript
'use server';

import { evaluateBookingCapacity } from '@/services/booking-capacity.service';

export async function checkBookingCapacity(request: {
  branchId: string;
  serviceId: string;
  date: string;
  timeSlot: string;
}) {
  try {
    const { decision, knowledge, executionTimeMs } = await evaluateBookingCapacity(request);
    
    return {
      outcome: decision.outcome,
      explanation: decision.explanation,
      executionTime: Math.round(executionTimeMs),
      policyId: 'booking-capacity-v1',
      policyVersion: '1.0.0',
      details: {
        availableRooms: knowledge['capacity.availableRooms'] as number,
        totalRooms: knowledge['capacity.totalRooms'] as number,
        availableKTVs: knowledge['capacity.availableKTVs'] as number,
        totalKTVs: knowledge['capacity.totalKTVs'] as number,
        utilizationRate: knowledge['capacity.utilizationRate'] as number
      }
    };
  } catch (error) {
    console.error('[checkBookingCapacity] Error:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Lỗi khi kiểm tra công suất'
    };
  }
}
```

---

### Day 4: UI Integration

File: `src/app/dashboard/bookings/components/BookingCapacityCheck.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { checkBookingCapacity } from '../actions';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  branchId: string;
  serviceId: string;
  date: string;
  timeSlot: string;
}

export function BookingCapacityCheck({ branchId, serviceId, date, timeSlot }: Props) {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (branchId && serviceId && date && timeSlot) {
      checkCapacity();
    }
  }, [branchId, serviceId, date, timeSlot]);
  
  const checkCapacity = async () => {
    setIsLoading(true);
    try {
      const response = await checkBookingCapacity({ branchId, serviceId, date, timeSlot });
      setResult(response);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
        <Clock className="w-5 h-5 text-slate-400 animate-spin" />
        <p className="text-xs font-bold text-slate-700">Đang kiểm tra công suất...</p>
      </div>
    );
  }
  
  if (!result) return null;
  
  if (result.error) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-amber-800">⚠️ Không thể kiểm tra công suất</p>
          <p className="text-[11px] text-amber-700 mt-0.5">{result.message}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "p-4 border rounded-xl flex gap-3",
      result.outcome === 'ALLOW' && "bg-emerald-50 border-emerald-200",
      result.outcome === 'BLOCK' && "bg-rose-50 border-rose-200",
      result.outcome === 'WAITLIST' && "bg-amber-50 border-amber-200",
      result.outcome === 'ESCALATE' && "bg-blue-50 border-blue-200"
    )}>
      {result.outcome === 'ALLOW' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
      {result.outcome === 'BLOCK' && <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
      {(result.outcome === 'WAITLIST' || result.outcome === 'ESCALATE') && (
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
      )}
      
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className={cn(
            "text-xs font-bold uppercase",
            result.outcome === 'ALLOW' && "text-emerald-800",
            result.outcome === 'BLOCK' && "text-rose-800",
            (result.outcome === 'WAITLIST' || result.outcome === 'ESCALATE') && "text-amber-800"
          )}>
            {result.outcome === 'ALLOW' && '✅ Có thể đặt lịch'}
            {result.outcome === 'BLOCK' && '❌ Không thể đặt lịch'}
            {result.outcome === 'WAITLIST' && '⏰ Danh sách chờ'}
            {result.outcome === 'ESCALATE' && '⚠️ Cần xác nhận'}
          </p>
          <span className="text-[9px] font-bold text-slate-400">{result.executionTime}ms</span>
        </div>
        
        <p className={cn(
          "text-[11px] mt-1.5 leading-relaxed",
          result.outcome === 'ALLOW' && "text-emerald-700",
          result.outcome === 'BLOCK' && "text-rose-700",
          (result.outcome === 'WAITLIST' || result.outcome === 'ESCALATE') && "text-amber-700"
        )}>
          {result.explanation}
        </p>
        
        {result.details && (
          <div className="mt-2 pt-2 border-t border-dashed border-slate-200/50 text-[10px] text-slate-500">
            Phòng: {result.details.availableRooms}/{result.details.totalRooms} •
            KTV: {result.details.availableKTVs}/{result.details.totalKTVs} •
            Công suất: {Math.round(result.details.utilizationRate * 100)}%
          </div>
        )}
        
        <div className="mt-2 pt-2 border-t border-dashed border-slate-200/50">
          <p className="text-[9px] font-bold text-slate-400 uppercase">
            🤖 AI Capacity Check • Policy: {result.policyId} v{result.policyVersion}
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Estimated LOC:** 150 (actions) + 250 (UI) = **400 LOC**

---

### Day 5: Tests

**Test files:**
1. `src/lib/decision-engine/policies/__tests__/booking-capacity-v1.test.ts` (200 LOC)
2. `src/services/__tests__/booking-capacity.service.test.ts` (250 LOC)
3. `src/app/dashboard/bookings/__tests__/capacity-check.integration.test.ts` (300 LOC)

**Total tests:** ~750 LOC covering 8 scenarios

---

### Day 6: Manual Testing + Bug Fixes

**Test checklist:**
- [ ] Scenario 1: Capacity available → ALLOW
- [ ] Scenario 2: No rooms → BLOCK
- [ ] Scenario 3: Insufficient KTVs → BLOCK
- [ ] Scenario 4: Near capacity → WAITLIST
- [ ] Scenario 5: KTV on leave → BLOCK
- [ ] Scenario 6: Public holiday → ESCALATE
- [ ] Scenario 7: Short notice → ESCALATE
- [ ] Scenario 8: Race condition handling

---

### Day 7: Documentation

**Deliverables:**
1. `SPRINT3_COMPLETION_SUMMARY.md` - What was built
2. `BOOKING_CAPACITY_MANUAL_TEST_GUIDE.md` - Test scenarios
3. Update `SPRINT_3_TO_5_VALIDATION_PLAN.md` - Mark Sprint 3 complete

---

## 🎯 Success Criteria (Repeat from Requirements)

### Must Pass
- ✅ **RuleReasoner unchanged** (0 lines modified)
- ✅ Same API: `reasoner.evaluate(policy, knowledge)`
- ✅ All 8 test scenarios pass
- ✅ Execution time < 100ms
- ✅ No overbooking in production

### Should Pass
- ✅ Cache hit rate > 60%
- ✅ Concurrent requests handled correctly
- ✅ Race condition test passes

---

## 📊 Estimated Effort

| Task | LOC | Time |
|------|-----|------|
| Policy definition | 350 | 1 day |
| Knowledge builder | 400 | 1 day |
| Server action | 150 | 0.5 day |
| UI component | 250 | 0.5 day |
| Tests | 750 | 1.5 days |
| Manual testing | - | 1 day |
| Documentation | - | 0.5 day |
| **Total** | **~1,900** | **7 days** |

---

## 🚀 Ready to Start?

**Prerequisites checklist:**
- ✅ Sprint 2 complete
- ✅ Requirements approved
- ✅ Database schema reviewed
- ✅ Test data prepared

**Next:** Create branch `feature/sprint3-booking-capacity` and start Day 1!
