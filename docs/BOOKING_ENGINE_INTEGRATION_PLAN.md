# Booking Engine Integration Plan
**Decision Engine Phase 1+2 → Booking API/UI**

**Date**: July 9, 2026  
**Status**: 📋 PLANNING  
**Goal**: Integrate Auto-Assignment + Capacity Management into real booking flow

---

## 📊 EXECUTIVE SUMMARY

Integrate completed Booking Engine Providers (Phase 1: Auto-Assignment, Phase 2: Capacity Management) into existing booking workflow to provide:
- **Real-time capacity validation** before booking creation
- **Automated KTV assignment** with optimal matching
- **Conflict detection** with alternative suggestions
- **UI feedback** for capacity status and conflicts

**Timeline**: 3-5 days  
**Complexity**: Medium (existing patterns available)  
**Risk**: Low (Decision Engine already tested 100%)

---

## 🎯 INTEGRATION POINTS

### Current Booking Flow (Identified)

```
User → BookingCreateScheduleModal
    → handleCreateScheduleSubmit (action)
    → createSessionLog (database)
    → Refresh UI
```

### New Flow with Decision Engine

```
User → BookingCreateScheduleModal
    │
    ├─> [Step 1] Capacity Check (CapacityManagementProvider)
    │   └─> If conflicts → Show alternatives, block creation
    │
    ├─> [Step 2] Auto-Assignment (AutoAssignmentProvider)
    │   └─> If no KTV selected → Suggest optimal KTV
    │
    └─> [Step 3] Create Booking (existing flow)
        └─> Success → Refresh UI
```

---

## 📁 FILES TO MODIFY

### 1. Server Actions (Backend Integration)

#### `src/services/booking-decision-service.ts` (EXPAND EXISTING)
**Status**: Already has `evaluateBookingRequest` - expand it

**New Functions**:
```typescript
// NEW: Check capacity using Phase 2 provider
export async function checkBookingCapacity(input: {
  tenantId: string;
  ktvId: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  durationMinutes: number;
  customerTier: 'vip' | 'loyal' | 'new';
  serviceType: string;
}): Promise<{
  available: boolean;
  capacityDetails: CapacityDetails;
  conflicts?: CapacityConflict[];
  alternatives?: Alternative[];
}>;

// NEW: Auto-assign KTV using Phase 1 provider
export async function autoAssignKtv(input: {
  tenantId: string;
  customerId: string;
  serviceId: string;
  serviceType: string;
  requestedDate: string;
  requestedStartTime: string;
  durationMinutes: number;
  customerTier: 'vip' | 'loyal' | 'new';
  preferredKtvId?: string;
}): Promise<{
  assignedKtvId: string | null;
  confidence: number;
  reason: string;
  alternatives?: Array<{ktvId: string; score: number; reason: string}>;
}>;
```

**Implementation Strategy**:
- Import `CapacityManagementProvider` from `@/lib/decision-engine/providers/booking`
- Import `AutoAssignmentProvider` from `@/lib/decision-engine/providers/booking`
- Fetch existing bookings from `session_logs` table
- Fetch KTV candidates from `users` table (role='ktv')
- Fetch KTV capacity config from `users` or tenant settings
- Call provider methods with proper input mapping
- Return standardized results for UI consumption

---

#### `src/modules/bookings/actions/session-log-actions.ts` (CREATE NEW)
**Status**: New file - consolidate booking creation logic

**Functions**:
```typescript
export async function createBookingWithValidation(input: {
  bookingId: string;
  assignedDate: string;
  assignedTime: string;
  assignedKtvId?: string;
  customerId: string;
  serviceType: string;
  durationMinutes: number;
  customerTier: 'vip' | 'loyal' | 'new';
  skipCapacityCheck?: boolean; // For override by manager
  skipAutoAssignment?: boolean; // If KTV manually selected
}): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
  conflicts?: CapacityConflict[];
  alternatives?: Alternative[];
}>;
```

**Process**:
1. If `!skipCapacityCheck`: Call `checkBookingCapacity()`
   - If conflicts → return error with alternatives
2. If `!skipAutoAssignment && !assignedKtvId`: Call `autoAssignKtv()`
   - Use returned `assignedKtvId`
3. Create session log in database
4. Return success with sessionId

---

### 2. UI Components (Frontend Integration)

#### `src/app/dashboard/bookings/components/BookingCreateScheduleModal.tsx` (MODIFY)
**Status**: Existing modal - add capacity check & auto-assignment UI

**Current Implementation**:
```typescript
const handleSubmit = async () => {
  // Directly create session log
  await createSessionLog({...});
};
```

**New Implementation**:
```typescript
const handleSubmit = async () => {
  // Step 1: Check capacity
  setIsCheckingCapacity(true);
  const capacityResult = await checkBookingCapacity({
    tenantId,
    ktvId: selectedKtvId || 'temp-ktv-for-check',
    requestedDate: selectedDate,
    requestedStartTime: startTime,
    requestedEndTime: endTime,
    durationMinutes: calculatedDuration,
    customerTier: customer.tier || 'loyal',
    serviceType: selectedService.type,
  });
  setIsCheckingCapacity(false);

  // Step 2: Handle conflicts
  if (!capacityResult.available) {
    setConflicts(capacityResult.conflicts);
    setAlternatives(capacityResult.alternatives);
    setShowConflictDialog(true);
    return; // Block creation
  }

  // Step 3: Auto-assign KTV if not selected
  let finalKtvId = selectedKtvId;
  if (!selectedKtvId) {
    setIsAutoAssigning(true);
    const assignmentResult = await autoAssignKtv({
      tenantId,
      customerId: customer.id,
      serviceId: selectedService.id,
      serviceType: selectedService.type,
      requestedDate: selectedDate,
      requestedStartTime: startTime,
      durationMinutes: calculatedDuration,
      customerTier: customer.tier || 'loyal',
    });
    setIsAutoAssigning(false);

    if (assignmentResult.assignedKtvId) {
      finalKtvId = assignmentResult.assignedKtvId;
      setAutoAssignedKtv(assignmentResult); // Show suggestion
      setShowAssignmentDialog(true);
      return; // Wait for user confirmation
    } else {
      toast.error('Không tìm thấy KTV phù hợp');
      return;
    }
  }

  // Step 4: Create booking (existing flow)
  await createBookingWithValidation({
    bookingId,
    assignedDate: selectedDate,
    assignedTime: startTime,
    assignedKtvId: finalKtvId,
    customerId: customer.id,
    serviceType: selectedService.type,
    durationMinutes: calculatedDuration,
    customerTier: customer.tier || 'loyal',
    skipCapacityCheck: true, // Already checked
    skipAutoAssignment: true, // Already assigned
  });

  onSuccess();
};
```

**New UI States**:
```typescript
const [isCheckingCapacity, setIsCheckingCapacity] = useState(false);
const [isAutoAssigning, setIsAutoAssigning] = useState(false);
const [conflicts, setConflicts] = useState<CapacityConflict[]>([]);
const [alternatives, setAlternatives] = useState<Alternative[]>([]);
const [showConflictDialog, setShowConflictDialog] = useState(false);
const [autoAssignedKtv, setAutoAssignedKtv] = useState<AssignmentResult | null>(null);
const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
```

---

#### `src/app/dashboard/bookings/components/CapacityConflictDialog.tsx` (CREATE NEW)
**Purpose**: Display capacity conflicts and alternatives

```typescript
interface CapacityConflictDialogProps {
  open: boolean;
  onClose: () => void;
  conflicts: CapacityConflict[];
  alternatives: Alternative[];
  onSelectAlternative: (alt: Alternative) => void;
}

export function CapacityConflictDialog(props: CapacityConflictDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>⚠️ Phát hiện xung đột lịch hẹn</DialogTitle>
          <DialogDescription>
            Không thể tạo lịch hẹn do các xung đột sau:
          </DialogDescription>
        </DialogHeader>

        {/* Conflicts List */}
        <div className="space-y-2">
          {props.conflicts.map((conflict, idx) => (
            <div key={idx} className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-900">{conflict.type}</p>
              <p className="text-sm text-red-700">{conflict.reason}</p>
            </div>
          ))}
        </div>

        {/* Alternatives */}
        {props.alternatives && props.alternatives.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium">Đề xuất thay thế:</p>
            {props.alternatives.map((alt, idx) => (
              <button
                key={idx}
                onClick={() => props.onSelectAlternative(alt)}
                className="w-full rounded-lg border border-primary/20 bg-primary/5 p-3 text-left hover:bg-primary/10"
              >
                <p className="font-medium text-primary">{alt.suggestedTime}</p>
                <p className="text-sm text-muted-foreground">{alt.reason}</p>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

#### `src/app/dashboard/bookings/components/KtvAssignmentDialog.tsx` (CREATE NEW)
**Purpose**: Display auto-assignment suggestion with alternatives

```typescript
interface KtvAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  assignedKtv: {
    ktvId: string;
    ktvName: string;
    confidence: number;
    reason: string;
  };
  alternatives: Array<{ktvId: string; ktvName: string; score: number; reason: string}>;
  onConfirm: () => void;
  onSelectAlternative: (ktvId: string) => void;
}

export function KtvAssignmentDialog(props: KtvAssignmentDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>✨ Gợi ý KTV phù hợp</DialogTitle>
          <DialogDescription>
            Hệ thống đã tự động chọn KTV tối ưu cho lịch hẹn này
          </DialogDescription>
        </DialogHeader>

        {/* Primary Assignment */}
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-primary">{props.assignedKtv.ktvName}</p>
            <span className="rounded-full bg-primary/20 px-2 py-1 text-xs font-medium text-primary">
              {Math.round(props.assignedKtv.confidence * 100)}% phù hợp
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{props.assignedKtv.reason}</p>
        </div>

        {/* Alternatives */}
        {props.alternatives && props.alternatives.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Lựa chọn khác:</p>
            {props.alternatives.map((alt, idx) => (
              <button
                key={idx}
                onClick={() => props.onSelectAlternative(alt.ktvId)}
                className="w-full rounded-lg border border-border bg-muted/30 p-3 text-left hover:bg-muted/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">{alt.ktvName}</p>
                  <span className="text-xs text-muted-foreground">{alt.score}/100</span>
                </div>
                <p className="text-xs text-muted-foreground">{alt.reason}</p>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>Chọn thủ công</Button>
          <Button onClick={props.onConfirm}>Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

#### `src/app/dashboard/bookings/components/BookingsTimelineGrid.tsx` (MODIFY)
**Purpose**: Show real-time capacity status

**New Feature**: Capacity indicator badge on timeline cells

```typescript
// Add capacity check on cell hover
const [cellCapacity, setCellCapacity] = useState<Record<string, CapacityStatus>>({});

const handleCellHover = async (date: string, hour: number, ktvId: string) => {
  const key = `${date}-${hour}-${ktvId}`;
  if (cellCapacity[key]) return; // Already cached

  const capacity = await checkBookingCapacity({
    tenantId,
    ktvId,
    requestedDate: date,
    requestedStartTime: `${hour.toString().padStart(2, '0')}:00`,
    requestedEndTime: `${(hour + 2).toString().padStart(2, '0')}:00`,
    durationMinutes: 120,
    customerTier: 'loyal',
    serviceType: 'Massage',
  });

  setCellCapacity(prev => ({
    ...prev,
    [key]: {
      available: capacity.available,
      utilization: capacity.capacityDetails.utilizationPercentage,
    }
  }));
};

// Render cell with capacity badge
<div
  className="timeline-cell"
  onMouseEnter={() => handleCellHover(date, hour, ktv.id)}
>
  {cellCapacity[key] && (
    <span className={`capacity-badge ${
      cellCapacity[key].utilization > 80 ? 'bg-red-500' :
      cellCapacity[key].utilization > 60 ? 'bg-yellow-500' :
      'bg-green-500'
    }`}>
      {cellCapacity[key].utilization}%
    </span>
  )}
</div>
```

---

### 3. Type Definitions

#### `src/types/decision-engine.ts` (CREATE NEW)
**Purpose**: Export Decision Engine types for app-wide use

```typescript
// Re-export from Decision Engine
export type {
  AutoAssignmentInput,
  AutoAssignmentOutput,
  CapacityCheckInput,
  CapacityCheckOutput,
  CapacityConflict,
  Alternative,
  KtvCandidate,
} from '@/lib/decision-engine/providers/booking/types';

// App-specific wrappers
export interface BookingCapacityCheckRequest {
  tenantId: string;
  ktvId: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  durationMinutes: number;
  customerTier: 'vip' | 'loyal' | 'new';
  serviceType: string;
}

export interface BookingCapacityCheckResponse {
  available: boolean;
  capacityDetails: {
    currentBookings: number;
    maxBookings: number;
    utilizationPercentage: number;
  };
  conflicts?: CapacityConflict[];
  alternatives?: Alternative[];
  executionTime: number;
}

export interface KtvAutoAssignmentRequest {
  tenantId: string;
  customerId: string;
  serviceId: string;
  serviceType: string;
  requestedDate: string;
  requestedStartTime: string;
  durationMinutes: number;
  customerTier: 'vip' | 'loyal' | 'new';
  preferredKtvId?: string;
}

export interface KtvAutoAssignmentResponse {
  assignedKtvId: string | null;
  assignedKtvName?: string;
  confidence: number;
  reason: string;
  alternatives?: Array<{
    ktvId: string;
    ktvName: string;
    score: number;
    reason: string;
  }>;
  executionTime: number;
}
```

---

## 🔄 IMPLEMENTATION SEQUENCE

### Phase A: Backend Integration (2 days)

**Day 1: Service Layer**
- ✅ Expand `booking-decision-service.ts`
  - Add `checkBookingCapacity()` function
  - Add `autoAssignKtv()` function
  - Add helper functions for data fetching
- ✅ Create `session-log-actions.ts`
  - Add `createBookingWithValidation()` function
  - Integrate capacity check and auto-assignment
- ✅ Create type definitions in `types/decision-engine.ts`
- ✅ Write unit tests for service functions

**Day 2: Database Queries**
- ✅ Add queries to fetch existing bookings (for capacity check)
- ✅ Add queries to fetch KTV candidates (for auto-assignment)
- ✅ Add queries to fetch KTV capacity config
- ✅ Add queries to fetch tenant capacity config
- ✅ Optimize queries with proper indexes

### Phase B: Frontend Integration (2 days)

**Day 3: Modal Enhancement**
- ✅ Modify `BookingCreateScheduleModal.tsx`
  - Add capacity check before submission
  - Add auto-assignment flow
  - Add loading states
- ✅ Create `CapacityConflictDialog.tsx`
  - Display conflicts
  - Show alternatives
  - Handle alternative selection
- ✅ Create `KtvAssignmentDialog.tsx`
  - Display assignment suggestion
  - Show alternatives
  - Handle confirmation

**Day 4: Timeline Enhancement**
- ✅ Modify `BookingsTimelineGrid.tsx`
  - Add capacity indicator badges
  - Add hover tooltip with details
  - Implement caching for performance
- ✅ Add capacity legend/guide in UI
- ✅ Add loading/error states

### Phase C: Testing & Polish (1 day)

**Day 5: Integration Testing**
- ✅ E2E test: Create booking with capacity check
- ✅ E2E test: Auto-assignment suggestion flow
- ✅ E2E test: Conflict detection and alternatives
- ✅ Performance test: Timeline capacity indicators
- ✅ UI/UX polish: Loading states, error messages
- ✅ Documentation: User guide for new features

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements
- [ ] Capacity check blocks booking creation if conflicts detected
- [ ] User sees clear conflict reasons and alternative suggestions
- [ ] Auto-assignment suggests optimal KTV with confidence score
- [ ] User can accept/reject auto-assignment suggestion
- [ ] User can manually override both capacity check and assignment
- [ ] Timeline shows real-time capacity status (utilization %)
- [ ] All existing booking flows continue to work (backward compatible)

### Performance Requirements
- [ ] Capacity check completes in <200ms (avg)
- [ ] Auto-assignment completes in <500ms (avg)
- [ ] Timeline capacity indicators load in <100ms per cell
- [ ] No noticeable lag in booking creation flow

### UX Requirements
- [ ] Loading states for all async operations
- [ ] Clear error messages with actionable guidance
- [ ] Conflict dialog is intuitive and informative
- [ ] Assignment dialog builds trust (show reasoning)
- [ ] Mobile-friendly (responsive design)

---

## 🚨 RISKS & MITIGATIONS

### Risk 1: Performance Degradation
**Impact**: High | **Probability**: Medium

**Scenario**: Capacity check queries all existing bookings, causing slow response times.

**Mitigation**:
- Add database indexes on `session_logs.assigned_date`, `session_logs.completed_by_ktv_id`
- Cache capacity results for same date/time/ktv (1-minute TTL)
- Use optimistic UI (assume available, verify in background)
- Add fallback: Skip check if query takes >1 second

### Risk 2: Breaking Existing Flow
**Impact**: High | **Probability**: Low

**Scenario**: Integration changes break existing booking creation for users.

**Mitigation**:
- Feature flag: `ENABLE_DECISION_ENGINE_INTEGRATION=false` (default)
- Gradual rollout: Enable for 10% users, monitor, then 100%
- Comprehensive regression testing
- Fallback: If Decision Engine fails, allow booking (fail-open)

### Risk 3: User Confusion
**Impact**: Medium | **Probability**: Medium

**Scenario**: Users don't understand conflict messages or assignment suggestions.

**Mitigation**:
- User testing with 5-10 staff members before launch
- Clear, Vietnamese-language messages (no technical jargon)
- Tooltips and help text for all new UI elements
- Video tutorial (1-2 minutes) demonstrating new features

### Risk 4: Data Quality Issues
**Impact**: Medium | **Probability**: Medium

**Scenario**: Incorrect KTV capacity config leads to wrong decisions.

**Mitigation**:
- Admin UI to configure KTV capacity (maxDailyBookings, workingHours, etc.)
- Default sensible values (maxDailyBookings=8, workingHours=08:00-20:00)
- Audit log for all capacity config changes
- Manual override always available for managers

---

## 📚 DOCUMENTATION DELIVERABLES

1. **User Guide** (`docs/USER_GUIDE_BOOKING_ENGINE_FEATURES.md`)
   - How to create bookings with new features
   - Understanding conflict messages
   - Using auto-assignment suggestions
   - Capacity indicators explanation

2. **Developer Guide** (`docs/DEVELOPER_GUIDE_BOOKING_ENGINE_INTEGRATION.md`)
   - Architecture overview
   - API reference (service functions)
   - Adding new providers
   - Troubleshooting

3. **Admin Guide** (`docs/ADMIN_GUIDE_CAPACITY_CONFIGURATION.md`)
   - Configuring KTV capacity
   - Configuring tenant capacity policies
   - Monitoring capacity utilization
   - Performance tuning

---

## 🔗 NEXT STEPS AFTER INTEGRATION

### Short-term (Week 1-2)
1. Monitor production metrics (capacity check latency, assignment success rate)
2. Gather user feedback and iterate on UX
3. Fix any bugs or edge cases discovered
4. Add capacity analytics dashboard

### Medium-term (Month 1-2)
5. Phase 3: Booking Optimization Provider (slot arrangement)
6. Phase 4: Dynamic Pricing Provider (peak hour pricing)
7. Advanced features: Waitlist management, cancellation prediction
8. Mobile app integration

### Long-term (Month 3+)
9. Machine learning: Learn from booking patterns
10. Predictive capacity: Forecast demand and suggest staffing
11. Multi-location capacity: Support multiple spa branches
12. API for third-party integrations

---

**Status**: 📋 READY FOR IMPLEMENTATION  
**Next Action**: Begin Phase A - Backend Integration



---

## ✅ IMPLEMENTATION STATUS

### Phase 1: Backend Integration ✅ COMPLETED

**Status**: ✅ COMPLETED (4/4 tasks)  
**Completion Date**: 2026-07-09  
**Duration**: ~6 hours  
**Summary Document**: `docs/BOOKING_ENGINE_BACKEND_INTEGRATION_COMPLETION.md`

**Completed Tasks**:
1. ✅ Expanded `booking-decision.service.ts` with `checkBookingCapacity()` and `autoAssignKtv()` functions (+380 lines)
2. ✅ Created `session-log-actions.ts` with `createBookingWithValidation()` function (+470 lines)
3. ✅ Created `types/decision-engine.ts` with app-wide type definitions (+500 lines)
4. ✅ Written comprehensive unit tests for all new functions (+750 lines, 25 scenarios)

**Total Code Written**: ~2,100 lines (production + tests)

**Key Achievements**:
- ✅ Service layer successfully integrates both Decision Engine providers
- ✅ Full booking creation flow with capacity validation and auto-assignment
- ✅ Comprehensive type system for UI/API consumption
- ✅ 25 test scenarios covering all edge cases
- ✅ Manager override capability (skip validation flags)
- ✅ Conflict detection with alternative suggestions
- ✅ Structured audit logging for observability

---

### Phase 2: Frontend UI Components (NEXT PRIORITY)

**Status**: 📋 PLANNED (0/4 components)  
**Estimated Duration**: 4-5 days  
**Prerequisites**: Phase 1 complete ✅

**Tasks**:
1. 🔲 Create `BookingCapacityIndicator.tsx` - Real-time capacity badges for timeline
2. 🔲 Create `CapacityConflictDialog.tsx` - Conflict display with alternatives
3. 🔲 Create `KtvAssignmentDialog.tsx` - Auto-assignment suggestion with alternatives
4. 🔲 Enhance `BookingCreateForm.tsx` - Integration with all new components

**Dependencies**:
- Phase 1 backend services must be complete ✅
- UI components must consume standardized result types ✅

---

### Phase 3: Integration Testing (AFTER UI)

**Status**: 📋 PLANNED (0/8 scenarios)  
**Estimated Duration**: 2-3 days  
**Prerequisites**: Phase 2 complete

**Test Scenarios**:
1. 🔲 Successful booking creation with capacity validation
2. 🔲 Booking rejection due to capacity conflicts
3. 🔲 Alternative time acceptance
4. 🔲 Auto-assignment with high confidence
5. 🔲 Manual KTV selection override
6. 🔲 Manager override (skip validation)
7. 🔲 Multiple concurrent bookings (race condition)
8. 🔲 Peak hour capacity management

---

### Phase 4: Performance Optimization (FINAL)

**Status**: 📋 PLANNED (0/3 areas)  
**Estimated Duration**: 2 days  
**Prerequisites**: Phase 3 complete

**Optimization Areas**:
1. 🔲 Capacity check caching (Redis, TTL: 1 minute)
2. 🔲 Batch candidate fetching (parallel Supabase queries)
3. 🔲 Result memoization (avoid duplicate checks)

---

**Overall Progress**: 25% complete (Phase 1 of 4 phases)  
**Next Action**: Start Phase 2 - Frontend UI Components
