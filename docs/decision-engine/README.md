# Decision Engine - Leave Approval

## Overview

Decision Engine provides automated decision recommendations for leave approval workflow using rule-based reasoning.

**Status:** ✅ Sprint 2 Complete - Pending Production Soak  
**Current Policies:** 1 (leave-approval-v1)  
**Architecture:** RuleReasoner + Policy-as-Data

---

## Quick Start

### For Admins (Using the Feature)

1. Navigate to **"Duyệt nghỉ phép KTV"** modal
2. Select a pending leave request
3. Wait for Decision Engine recommendation (green/red/yellow panel)
4. Make final decision (you can override recommendation)

**Outcomes:**
- 🟢 **APPROVE**: Safe to approve (24h+ notice, balance OK, no violations)
- 🔴 **REJECT**: Policy recommends rejection (short notice, no balance)
- 🟡 **ESCALATE**: Requires manual review (conflicts, violations)

---

## For Developers

### Architecture

```
LeaveApprovalModal (UI)
    ↓
getLeaveDecisionRecommendation() [Server Action]
    ↓
evaluateLeaveRequest() [Service]
    ↓
buildLeaveKnowledge() [Transform DB → Knowledge]
    ↓
RuleReasoner.evaluate(policy, knowledge)
    ↓
DecisionResult { outcome, explanation }
```

**Key Files:**
- `src/lib/decision-engine/RuleReasoner.ts` - Core evaluator
- `src/lib/decision-engine/policies/leave-approval-v1.ts` - Leave policy (6 rules)
- `src/services/leave-decision.service.ts` - Integration layer
- `src/app/dashboard/sessions/actions.ts` - Server action

**Performance:** ~35ms end-to-end (3 DB queries + evaluation)

---

### Policy Rules (leave-approval-v1)

| Priority | Condition | Outcome | Reason |
|----------|-----------|---------|--------|
| 1 | hoursNotice < 24 | REJECT | Short notice |
| 2 | balance <= 0 | REJECT | No balance |
| 3 | violations >= 3 | ESCALATE | Multiple violations |
| 4 | hasConflict = true | ESCALATE | Session conflicts |
| 5 | hoursNotice >= 24 | APPROVE | Default approval |

**Knowledge Fields:**
- `leave.hoursNotice` - Hours between request and leave date
- `leave.balance` - From `users.leave_balance`
- `attendance.violations` - Count of absent/late in last 90 days
- `context.hasConflict` - Sessions scheduled on leave date

---

### Adding a New Policy (Sprint 3+)

**Goal:** Verify RuleReasoner works without modification.

```typescript
// 1. Create policy file
// src/lib/decision-engine/policies/booking-capacity-v1.ts

import type { Policy } from '../types';

export const bookingCapacityPolicyV1: Policy = {
  id: 'booking-capacity-v1',
  version: '1.0.0',
  name: 'Booking Capacity Policy',
  rules: [
    {
      id: 'max-capacity',
      condition: (k) => k['room.currentCapacity'] >= k['room.maxCapacity'],
      outcome: 'REJECT',
      explanation: 'Room is at maximum capacity'
    },
    // ... more rules
  ]
};

// 2. Create service to build knowledge
// src/services/booking-decision.service.ts

export async function buildBookingKnowledge(booking) {
  return {
    'room.currentCapacity': ..., // Query from DB
    'room.maxCapacity': ...,
    // ... more fields
  };
}

// 3. Use same RuleReasoner
const reasoner = new RuleReasoner();
const decision = reasoner.evaluate(bookingCapacityPolicyV1, knowledge);
```

**Success Criteria:** If RuleReasoner needs NO changes → Architecture validated ✅

---

## Testing

### Unit Tests (11/11 passing)
```bash
npm test -- src/lib/decision-engine/__tests__/RuleReasoner.test.ts
npm test -- src/app/dashboard/sessions/components/__tests__/LeaveApprovalModal.simple.test.tsx
```

### Manual Test
See: `MANUAL_TEST_GUIDE.md`

### Production Soak (Required Before Sprint 3)
- Run 3-5 days minimum with real traffic
- Monitor override rate
- Collect supervisor feedback
- Adjust rules if needed

---

## Observability

### Logs

All decisions are logged in structured JSON:

```json
{
  "timestamp": "2026-06-22T10:30:00Z",
  "policy": "leave-approval-v1",
  "policyVersion": "1.0.0",
  "outcome": "APPROVE",
  "reason": "Advance notice is sufficient...",
  "requestId": "leave-123",
  "employeeId": "ktv-456",
  "durationMs": 32,
  "knowledge": {
    "hoursNotice": 72,
    "balance": 10,
    "violations": 0,
    "hasConflict": false
  }
}
```

**Use this data to:**
- Track which policies reject/escalate most
- Identify slow queries
- Optimize rules based on real usage

---

## Troubleshooting

### Recommendation not showing
1. Check browser console for `[DecisionEngine]` logs
2. Verify `getLeaveDecisionRecommendation()` is called
3. Check network tab for errors

### Incorrect recommendation
1. Check Knowledge object in logs
2. Verify database data (leave_balance, session_logs, attendance)
3. Review rule evaluation order

### Slow performance (>100ms)
1. Check database indexes on:
   - `users(id)`
   - `attendance(ktv_id, date)`
   - `session_logs(ktv_id, session_date, status)`
2. Consider caching for static data

---

## Production Deployment

### Prerequisites
- [ ] Manual integration test passed
- [ ] Structured logging verified
- [ ] 3-5 day production soak completed
- [ ] Supervisor feedback collected
- [ ] Rules adjusted if needed

### Rollback Plan
If issues occur, comment out in `LeaveApprovalModal.tsx`:
```typescript
// const decision = await getLeaveDecisionRecommendation(leave.id);
// setRecommendation(decision);
```

Decision Engine has no side effects (read-only), safe to disable.

---

## Roadmap

- ✅ Sprint 2: Leave Approval (Complete)
- ⏳ Production Soak: 3-5 days observation
- 🎯 Sprint 3: Booking Capacity (After soak passes)
- 📅 Future: Dynamic Pricing, Membership, Promotion

**Current KPI: 1/5 policies in production**

---

## Philosophy

> "Don't design for prediction, design for duplication."

We deliberately avoided:
- BellaBrain orchestrator
- Knowledge/Reasoner interfaces
- Factory patterns
- Plugin systems

**Why?** We'll add abstraction only if real pain appears after 5-10 policies are running.

**Current assessment:** RuleReasoner is clean and sufficient. No pain yet.

---

**Last Updated:** 2026-06-22  
**Maintainer:** Decision Engine Team  
**Questions?** Check logs first, then reach out to team.
