# Phase 1: Leave Approval Integration

**Status**: ✅ READY TO TEST  
**Date**: June 22, 2026  
**Goal**: First real-world Decision Engine integration to collect audit data

---

## What We Built

### 1. Leave Approval Policy ✅
**File**: `src/lib/decision-engine/policies/leave-approval-policy.ts`

**8 Business Rules**:
1. ✅ **Leave Balance Check** - Reject if insufficient balance
2. ✅ **Maximum Duration** - Reject if > 30 days
3. ✅ **Invalid Duration** - Reject if ≤ 0 days
4. ✅ **Manager Approval** - Reject if > 5 days without manager
5. ✅ **Tet Blackout** - Reject during Jan 20 - Feb 10
6. ✅ **High Season Blackout** - Reject if > 3 days during Jun-Aug
7. ✅ **Sick Leave Auto-Approve** - Approve if sick + ≤ 3 days
8. ✅ **Default Approve** - Approve if all checks pass

**Rule Priority**:
```
Priority 1: Leave Balance (critical - blocks immediately)
Priority 2: Max Duration (critical)
Priority 3: Invalid Duration (critical)
Priority 4: Manager Approval (authorization)
Priority 5: Tet Blackout (business policy)
Priority 6: High Season Blackout (business policy)
Priority 7: Sick Leave Auto (special case)
Priority 100: Default Approve (fallback)
```

---

### 2. Leave Decision Service ✅
**File**: `src/services/leave/leave-decision-service.ts`

**Workflow**:
```
1. Fetch leave request from database
2. Fetch employee leave balance
3. Build DecisionContext with all inputs
4. Execute DecisionEngine.evaluate()
5. Map decision output to database update
6. Return LeaveApprovalResult
```

**Key Methods**:
- `evaluateLeaveApproval()` - Execute decision only
- `applyDecision()` - Update database based on decision
- `approveLeaveRequest()` - Full workflow (evaluate + apply)

---

### 3. API Endpoint ✅
**File**: `src/app/api/leave-requests/[id]/decide/route.ts`

**Endpoint**: `POST /api/leave-requests/[id]/decide`

**Request**:
```json
{
  "action": "approve"
}
```

**Response**:
```json
{
  "success": true,
  "approved": true,
  "reason": "All approval criteria met",
  "decisionId": "dec_1719048234_abc123",
  "metadata": {
    "confidence": 0.95,
    "executionTimeMs": 42,
    "autoApproved": false,
    "requiresEscalation": false
  }
}
```

---

### 4. Integration Tests ✅
**File**: `src/services/leave/__tests__/leave-decision-integration.test.ts`

**7 Test Scenarios**:
1. ✅ Approve: Sufficient balance
2. ✅ Reject: Insufficient balance
3. ✅ Reject: Excessive duration (> 30 days)
4. ✅ Reject: Long leave without manager
5. ✅ Reject: Tet blackout period
6. ✅ Auto-approve: Sick leave ≤ 3 days
7. ✅ Audit: Decisions logged correctly

---

## Decision Context Example

```typescript
{
  decisionType: 'leave-request-approval',
  input: {
    requestId: 'req-001',
    employeeId: 'emp-123',
    employeeName: 'Nguyễn Văn A',
    employeeLeaveBalance: 12,
    leaveType: 'annual',
    requestedDays: 5,
    startDate: '2026-07-15',
    endDate: '2026-07-19',
    reason: 'Family vacation',
    approverRole: 'manager'
  },
  tenantId: 'tenant-abc',
  userId: 'approver-001',
  correlationContext: {
    correlationId: 'leave-req-001',
    traceId: 'trace-1719048234',
    spanId: 'span-approval-1719048234'
  }
}
```

---

## Decision Output Examples

### ✅ Approved
```json
{
  "approved": true,
  "confidence": 0.95,
  "matchedRules": [
    {
      "ruleId": "default-approve",
      "ruleName": "Default Approve",
      "priority": 100
    }
  ],
  "output": {
    "approved": true,
    "reason": "All approval criteria met"
  },
  "metadata": {
    "provider": "DecisionEngine",
    "executionTimeMs": 42,
    "policiesExecuted": ["Leave Approval Policy"]
  }
}
```

### ❌ Rejected - Insufficient Balance
```json
{
  "approved": false,
  "confidence": 1.0,
  "matchedRules": [
    {
      "ruleId": "leave-balance-check",
      "ruleName": "Leave Balance Check",
      "priority": 1
    }
  ],
  "output": {
    "approved": false,
    "reason": "Insufficient leave balance"
  }
}
```

### ⚠️ Rejected - Requires Escalation
```json
{
  "approved": false,
  "confidence": 1.0,
  "matchedRules": [
    {
      "ruleId": "long-leave-manager-approval",
      "ruleName": "Long Leave Manager Approval",
      "priority": 4
    }
  ],
  "output": {
    "approved": false,
    "reason": "Leave requests over 5 days require manager approval",
    "requiresEscalation": true
  }
}
```

---

## Testing Plan

### Phase 1A: Unit Tests (Done ✅)
```bash
npm test -- leave-decision-integration.test.ts
```

### Phase 1B: Manual Testing (Next)
**Scenario 1: Happy Path**
```bash
# 1. Create leave request
curl -X POST http://localhost:3000/api/leave-requests \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "emp-123",
    "leave_type": "annual",
    "start_date": "2026-07-15",
    "end_date": "2026-07-19",
    "days": 5,
    "reason": "Family vacation"
  }'

# 2. Approve via Decision Engine
curl -X POST http://localhost:3000/api/leave-requests/req-001/decide \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'

# 3. Check audit trail
curl http://localhost:3000/api/decision-engine/audit?decisionType=leave-request-approval

# 4. View decision detail
curl http://localhost:3000/api/decision-engine/audit/dec_abc123
```

**Scenario 2: Insufficient Balance**
```bash
# Employee with 3 days balance requests 5 days
# Expected: Rejected with confidence 1.0
```

**Scenario 3: Tet Blackout**
```bash
# Request leave during Jan 25-28, 2026
# Expected: Rejected with blackoutPeriod='tet-2026'
```

**Scenario 4: Auto-Approve Sick Leave**
```bash
# Request 2-day sick leave
# Expected: Approved with autoApproved=true
```

### Phase 1C: Load Testing (After 1 week)
**Goal**: Collect 1000+ leave decisions

```bash
# Generate test load
for i in {1..1000}; do
  curl -X POST http://localhost:3000/api/leave-requests/$i/decide \
    -H "Content-Type: application/json" \
    -d '{"action": "approve"}'
done

# Check health
curl http://localhost:3000/api/decision-engine/health
```

**Expected Results**:
- ✅ Queue pending: 0
- ✅ Circuit breaker: CLOSED
- ✅ Success rate: > 99%
- ✅ P95 latency: < 10ms

---

## Audit Data Collection

### What We'll Collect

After 1 week of Leave Approval integration, we should have:

**Volume**:
- ~500-1000 leave decisions
- ~50-100 unique employees
- ~10-20 unique approvers

**Decision Types**:
- Approved (estimate: 70%)
- Rejected - Insufficient balance (15%)
- Rejected - Long leave without manager (10%)
- Rejected - Blackout period (5%)

**Metadata**:
- Average execution time
- Confidence distribution
- Rule match patterns
- Auto-approval rate

---

## Time Machine Validation

Once we have real data, we can test **Time Machine** replay:

### Test Scenario: Policy Change
**Before** (v1.0.0): Allow > 3 days during high season  
**After** (v1.1.0): Restrict to ≤ 3 days

**Steps**:
1. Find decision made with v1.0.0 policy (approved 5-day June leave)
2. Replay with v1.1.0 policy
3. Verify output changes:
   - Original: `approved: true`
   - Replayed: `approved: false, reason: "high season restriction"`

```bash
# Replay decision with new policy
curl -X POST http://localhost:3000/api/decision-engine/replay/dec_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "policyVersion": "v1.1.0",
    "compareWithOriginal": true
  }'
```

---

## Distributed Tracing Validation

### Multi-Decision Workflow

**Scenario**: Manager approves leave, triggers cascade:
1. Leave Request Approval (Decision 1)
2. Attendance Record Creation (Decision 2)
3. Salary Adjustment (Decision 3)

**Trace**:
```
traceId: trace-leave-req-001
├─ Decision 1 (spanId: span-approval)
│  ├─ duration: 42ms
│  └─ output: approved
├─ Decision 2 (spanId: span-attendance, parentSpanId: span-approval)
│  ├─ duration: 15ms
│  └─ output: attendance_created
└─ Decision 3 (spanId: span-salary, parentSpanId: span-attendance)
   ├─ duration: 28ms
   └─ output: salary_adjusted

Critical Path: Decision 1 → Decision 2 → Decision 3 (85ms total)
```

**Validate Trace Viewer**:
```bash
curl http://localhost:3000/api/decision-engine/trace/trace-leave-req-001
```

---

## Success Metrics

### Phase 1 Complete When:

✅ **Integration Working**:
- [ ] 100+ leave decisions made via Decision Engine
- [ ] Zero silent failures (all decisions logged)
- [ ] Circuit breaker stayed CLOSED (no outages)

✅ **Audit Trail Proven**:
- [ ] All decisions appear in audit log
- [ ] Correlation IDs traced correctly
- [ ] Time Machine replay works

✅ **Performance Acceptable**:
- [ ] P95 execution time < 10ms
- [ ] Audit overhead < 10%
- [ ] Success rate > 99%

✅ **User Experience**:
- [ ] Approval response time < 100ms (including DB update)
- [ ] No complaints about slowness
- [ ] Decision reasons clear to users

---

## Rollback Plan

If issues occur:

### Option A: Disable Decision Engine (Quick)
```typescript
// Revert to old hardcoded logic
const approved = employee.leaveBalance >= request.days;
```

### Option B: Keep Engine, Fix Policy
```typescript
// Update policy rule
leaveApprovalPolicy.rules[0].conditions = [
  // New condition
];
```

### Option C: Manual Override
```bash
# Temporarily disable specific rule
POST /api/decision-engine/admin/disable-rule
{
  "policyName": "Leave Approval Policy",
  "ruleId": "tet-blackout-period"
}
```

---

## Next Steps

After Phase 1 complete (1-2 weeks):

1. ✅ **Review Metrics**: Check audit data quality
2. ✅ **Validate Time Machine**: Replay real decisions
3. ✅ **Test Trace Viewer**: Verify correlation works
4. ✅ **User Feedback**: Ask managers about decision reasons

Then proceed to:
- **Phase 2**: Discount Approval integration
- **Phase 3**: Observability Dashboard (with real data!)

---

**Document Version**: 1.0  
**Last Updated**: June 22, 2026  
**Status**: Phase 1 Ready to Test ✅
