# Phase B: Business Integration - Implementation Plan

**Timeline:** July-September 2026 (12 weeks)  
**Objective:** Integrate Decision Engine into 5-10 core business processes  
**Target:** 20,000-50,000 decisions/day  
**Status:** 🔵 IN PROGRESS

---

## 🎯 Integration Priority Matrix

| Priority | Business Process | Expected Volume/Day | Complexity | Estimated Time | Status |
|----------|------------------|---------------------|------------|----------------|--------|
| 🔴 **P0** | **Leave Approval** | 50-100 | Low | ✅ DONE | ✅ Complete |
| 🔴 **P0** | **Overbooking Detection** | 500-1,000 | Medium | 1 week | ⏳ Next |
| 🟡 **P1** | **Booking Pricing** | 200-500 | High | 2 weeks | ⏳ Queued |
| 🟡 **P1** | **Discount Approval** | 100-200 | Medium | 1 week | ⏳ Queued |
| 🟡 **P1** | **Payroll Calculation** | 2,000-5,000/month | High | 2 weeks | ⏳ Queued |
| 🟢 **P2** | **Commission Calculation** | 1,000-2,000/month | Medium | 1.5 weeks | ⏳ Queued |
| 🟢 **P2** | **KPI Evaluation** | 500-1,000/month | Medium | 1 week | ⏳ Queued |
| ⚪ **P3** | **Inventory Reorder** | 50-100 | Low | 1 week | ⏳ Queued |
| ⚪ **P3** | **Procurement Approval** | 20-50 | Low | 1 week | ⏳ Queued |
| ⚪ **P3** | **CRM Scoring** | 100-200 | Medium | 1 week | ⏳ Queued |

---

## 🚀 Week-by-Week Roadmap

### Week 1-2: Overbooking Detection (Jul 1-14)
**Why first:** High volume (500-1k/day), critical for operations, medium complexity

**Current State:** Manual checks, occasional double-bookings
**Target State:** Automatic conflict detection with Decision Engine

**Implementation:**
1. **Define decision context** (booking, KTV schedule, existing bookings)
2. **Write policy rules:**
   - Rule 1: No KTV double-booking (same time slot)
   - Rule 2: No room double-booking
   - Rule 3: Soft limit warning (KTV > 8 sessions/day)
   - Rule 4: Hard limit block (KTV > 10 sessions/day)
3. **Integrate into booking flow:**
   - Call Decision Engine before `bookings.insert()`
   - If rejected, show error + available alternatives
4. **Add audit logging** (already built-in)
5. **Test scenarios:** 20 test cases
6. **Deploy to production**

**Success Metrics:**
- Zero double-bookings after deployment
- 500+ decisions/day within 1 week
- Average latency < 20ms

---

### Week 3-4: Booking Pricing (Jul 15-28)
**Why next:** High volume, complex rules, revenue impact

**Current State:** Fixed pricing or manual discount
**Target State:** Dynamic pricing based on demand, time, customer tier

**Implementation:**
1. **Define pricing factors:**
   - Base price (from package)
   - Time multiplier (peak hours 1.2x, off-peak 0.8x)
   - Customer tier multiplier (VIP 1.0x, regular 1.1x, new 1.2x)
   - Demand multiplier (bookings > 80% capacity → 1.3x)
   - Holiday multiplier (1.5x)
2. **Write policy rules:**
   - Rule 1: Base price calculation
   - Rule 2: Apply time multiplier
   - Rule 3: Apply customer tier discount
   - Rule 4: Apply demand surge
   - Rule 5: Cap maximum price (150% of base)
   - Rule 6: Floor minimum price (70% of base)
3. **Integrate into booking creation:**
   - Call Decision Engine to calculate final price
   - Display breakdown to user (base + adjustments)
4. **A/B testing setup** (optional)
5. **Deploy gradually** (10% → 50% → 100%)

**Success Metrics:**
- 200+ pricing decisions/day
- Revenue increase > 5%
- Zero pricing errors

---

### Week 5-6: Discount Approval (Jul 29 - Aug 11)
**Why next:** Medium volume, prevents revenue leakage

**Current State:** Manual approval or fixed discount rules
**Target State:** Automated multi-tier approval based on discount amount

**Implementation:**
1. **Define approval tiers:**
   - Tier 1: < 10% discount → Auto-approve
   - Tier 2: 10-20% discount → Manager approval required
   - Tier 3: 20-30% discount → Director approval required
   - Tier 4: > 30% discount → CEO approval required
2. **Define validation rules:**
   - Rule 1: Customer must have 0 outstanding debt
   - Rule 2: No discount abuse (max 1 discount/month per customer)
   - Rule 3: Discount reason required for > 15%
   - Rule 4: Package-specific discount limits
3. **Integrate into booking flow:**
   - Call Decision Engine when discount requested
   - If auto-approved, apply immediately
   - If manual approval needed, create approval request
4. **Build approval UI** (simple list + approve/reject buttons)

**Success Metrics:**
- 100+ discount decisions/day
- Reduce manual approvals by 60%
- Zero discount abuse cases

---

### Week 7-8: Payroll Calculation (Aug 12-25)
**Why next:** High value, complex logic, monthly batch

**Current State:** Mix of automated + manual adjustments
**Target State:** Fully automated with Decision Engine

**Implementation:**
1. **Migrate existing salary logic to Decision Engine:**
   - Base salary (pro-rata for partial month)
   - Session bonus (package multipliers)
   - Rating bonus (4★/4.5★/5★)
   - KPI bonus (sync from leaderboard)
   - Violations deduction
   - Advances deduction
2. **Add new rules:**
   - Rule 1: Minimum wage compliance
   - Rule 2: Overtime calculation (if > 26 days)
   - Rule 3: Holiday bonus (if worked on holiday)
   - Rule 4: New hire pro-rata (first month)
   - Rule 5: Resignation pro-rata (last month)
3. **Handle edge cases:**
   - Mid-month hire date
   - Mid-month resignation
   - Unpaid leave adjustment
4. **Integrate with existing salary page:**
   - Replace `recalculateAndSaveSalaryRecord()` with Decision Engine call
   - Keep same UI/UX
5. **Parallel run for 1 month** (compare old vs new calculation)

**Success Metrics:**
- 2,000-5,000 payroll decisions/month
- 100% calculation accuracy (vs old system)
- Reduce manual adjustments by 80%

---

### Week 9-10: Commission Calculation (Aug 26 - Sep 8)
**Why next:** Medium value, monthly batch, Beauty Spa specific

**Current State:** Beauty Spa has advanced commission rules (not in Bella Spa)
**Target State:** Unified commission engine for all modules

**Implementation:**
1. **Define commission types:**
   - Service commission (3-level config: override → tenant → system)
   - Product sales commission (%)
   - Position bonus multiplier (junior 1.0x → manager 2.5x)
   - Seniority bonus (< 1yr 0% → 10+yrs 20%)
2. **Write policy rules:**
   - Rule 1: Calculate service commission per session
   - Rule 2: Calculate product commission per sale
   - Rule 3: Apply position multiplier
   - Rule 4: Apply seniority bonus
   - Rule 5: Cap total commission (if > 2x base salary, flag for review)
3. **Integrate into salary calculation:**
   - Call Decision Engine for each KTV
   - Sum commissions across all sessions/sales
4. **Add commission breakdown UI**

**Success Metrics:**
- 1,000-2,000 commission decisions/month
- Zero calculation errors
- Reduce accountant review time by 50%

---

### Week 11: KPI Evaluation (Sep 9-15)
**Why next:** Medium value, monthly batch, affects bonuses

**Current State:** KPI calculated separately, then synced to salary
**Target State:** KPI evaluation via Decision Engine

**Implementation:**
1. **Define KPI metrics:**
   - Session count (weight 30%)
   - Average rating (weight 25%)
   - Customer satisfaction (weight 20%)
   - Attendance rate (weight 15%)
   - Upsell rate (weight 10%)
2. **Write scoring rules:**
   - Rule 1: Calculate weighted score
   - Rule 2: Rank KTVs (leaderboard)
   - Rule 3: Determine bonus tier (top 10% → 2M, top 25% → 1M, etc.)
3. **Integrate with existing KPI page:**
   - Replace manual calculation with Decision Engine
   - Keep leaderboard UI

**Success Metrics:**
- 500-1,000 KPI decisions/month
- Transparent scoring (KTVs can see breakdown)
- Zero manual overrides needed

---

### Week 12: Polish & Production Validation (Sep 16-22)
**Focus:** Ensure all 6 integrations running smoothly

**Tasks:**
1. **Performance optimization:**
   - Add caching where needed
   - Optimize slow rules
   - Load test (simulate 50k decisions/day)
2. **Error handling:**
   - Test all failure scenarios
   - Verify fallback logic
   - Check audit completeness
3. **Documentation:**
   - Create business user guide for each integration
   - Create troubleshooting runbook
4. **Monitoring setup:**
   - Add custom Grafana dashboards (if available)
   - Set up alerts for high error rates
5. **Final validation:**
   - Run Gate 3 & 4 style checks
   - Verify 20k+ decisions/day achieved

---

## 📋 Implementation Checklist (Per Integration)

For each business process, follow this checklist:

### 1. Planning Phase
- [ ] Document current business logic
- [ ] Identify decision inputs (context)
- [ ] Identify decision outputs (approve/reject/value)
- [ ] List all edge cases
- [ ] Define success metrics

### 2. Policy Design Phase
- [ ] Write policy rules in pseudocode
- [ ] Review with business stakeholders
- [ ] Map to Decision Engine policy format
- [ ] Define rule priorities
- [ ] Define confidence thresholds

### 3. Implementation Phase
- [ ] Create policy file (`src/policies/[domain]/[policy].ts`)
- [ ] Register policy in Policy Registry
- [ ] Create decision action (`src/services/decision-actions/[domain].ts`)
- [ ] Integrate into existing flow (API route or page action)
- [ ] Add audit logging (automatic via Decision Engine)

### 4. Testing Phase
- [ ] Unit tests for policy rules (20+ scenarios)
- [ ] Integration tests (end-to-end flow)
- [ ] Load testing (simulate expected volume)
- [ ] Edge case testing (boundary conditions)
- [ ] Manual QA (business user acceptance)

### 5. Deployment Phase
- [ ] Deploy to staging
- [ ] Parallel run (compare old vs new logic)
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Monitor for errors/anomalies
- [ ] Document known issues

### 6. Validation Phase
- [ ] Verify decision volume matches expectation
- [ ] Check audit completeness (100%)
- [ ] Measure latency (< target)
- [ ] Verify confidence scores
- [ ] Business stakeholder sign-off

---

## 🛠️ Technical Architecture Changes

### New Directory Structure:
```
src/
├── policies/
│   ├── booking/
│   │   ├── overbooking-detection.ts
│   │   ├── dynamic-pricing.ts
│   │   └── discount-approval.ts
│   ├── payroll/
│   │   ├── salary-calculation.ts
│   │   └── commission-calculation.ts
│   └── performance/
│       └── kpi-evaluation.ts
├── services/
│   └── decision-actions/
│       ├── booking-decisions.ts
│       ├── payroll-decisions.ts
│       └── performance-decisions.ts
└── lib/
    └── decision-engine/
        ├── decision-engine.ts (existing)
        ├── policy-registry.ts (existing)
        └── decision-context-builder.ts (new)
```

### Policy File Template:
```typescript
// src/policies/booking/overbooking-detection.ts
import { Policy, Rule } from '@/lib/decision-engine/types';

export const overbookingDetectionPolicy: Policy = {
  id: 'booking.overbooking-detection',
  name: 'Overbooking Detection Policy',
  domain: 'booking',
  category: 'validation',
  version: '1.0.0',
  description: 'Prevent KTV and room double-bookings',
  rules: [
    {
      id: 'no-ktv-double-booking',
      name: 'No KTV Double Booking',
      description: 'KTV cannot be booked in overlapping time slots',
      priority: 100,
      conditions: {
        ktvId: { exists: true },
        preferredTime: { exists: true },
        duration: { exists: true },
      },
      action: async (context) => {
        const conflicts = await checkKTVConflicts(
          context.ktvId,
          context.preferredTime,
          context.duration
        );
        return {
          decision: conflicts.length === 0 ? 'approve' : 'reject',
          reason: conflicts.length === 0 
            ? 'No conflicts found'
            : `KTV already booked at ${conflicts[0].time}`,
          confidence: 1.0,
          metadata: { conflictCount: conflicts.length },
        };
      },
    },
    // ... more rules
  ],
};
```

### Decision Action Template:
```typescript
// src/services/decision-actions/booking-decisions.ts
import { makeDecision } from '@/lib/decision-engine/decision-engine';
import { overbookingDetectionPolicy } from '@/policies/booking/overbooking-detection';

export async function checkBookingConflicts(input: {
  ktvId: string;
  roomId: string;
  preferredTime: string;
  duration: number;
  tenantId: string;
}) {
  const result = await makeDecision({
    decisionType: 'booking.overbooking-check',
    tenantId: input.tenantId,
    context: {
      ktvId: input.ktvId,
      roomId: input.roomId,
      preferredTime: input.preferredTime,
      duration: input.duration,
    },
    policy: overbookingDetectionPolicy,
    provider: 'RuleProvider',
  });

  return {
    success: result.decision === 'approve',
    conflicts: result.metadata?.conflicts || [],
    reason: result.reason,
  };
}
```

---

## 📊 Expected Metrics After Phase B

**By September 30, 2026:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Total Integrations** | 6+ | Count of live processes |
| **Daily Decision Volume** | 20,000+ | Sum across all processes |
| **Average Latency** | < 50ms | p95 from audit logs |
| **Error Rate** | < 0.1% | Failed decisions / total |
| **Policy Coverage** | > 80% | Active rules / total rules |
| **Audit Completeness** | 100% | All decisions logged |
| **Business Impact** | Measurable | Revenue increase, time saved |

**Decision Volume Breakdown:**
- Overbooking Detection: 500-1,000/day
- Booking Pricing: 200-500/day
- Discount Approval: 100-200/day
- Payroll Calculation: 2,000-5,000/month
- Commission Calculation: 1,000-2,000/month
- KPI Evaluation: 500-1,000/month

**Total:** ~20,000-50,000 decisions/day (excluding monthly batch)

---

## 🚨 Risk Mitigation

### Risk 1: Integration Breaks Existing Flow
**Mitigation:**
- Parallel run mode (compare old vs new logic)
- Feature flag (enable/disable Decision Engine per tenant)
- Automatic rollback if error rate > 5%

### Risk 2: Decision Engine Too Slow
**Mitigation:**
- Set strict latency targets (< 50ms)
- Add caching for frequently used decisions
- Load test before production

### Risk 3: Business Logic Mismatch
**Mitigation:**
- Involve business stakeholders in policy design
- Create test scenarios from real cases
- Manual QA before rollout

### Risk 4: Audit Log Explosion (Storage Cost)
**Mitigation:**
- Implement log retention policy (keep 90 days, archive rest)
- Compress old logs
- Monitor storage usage

---

## 🎯 Success Criteria for Phase B

Before moving to Phase C, verify:

- ✅ 6+ business processes integrated
- ✅ 20,000+ decisions/day sustained for 1 week
- ✅ Zero critical errors
- ✅ Average latency < 50ms
- ✅ Policy coverage > 80%
- ✅ Audit completeness 100%
- ✅ Business stakeholder approval
- ✅ Documentation complete

---

## 📝 Next Steps (This Week)

### Monday-Tuesday (Jun 23-24):
1. 🔵 Create `src/policies/booking/` directory
2. 🔵 Implement `overbooking-detection.ts` policy
3. 🔵 Write unit tests (20 scenarios)

### Wednesday-Thursday (Jun 25-26):
1. 🔵 Create `checkBookingConflicts()` decision action
2. 🔵 Integrate into booking API route
3. 🔵 Test in staging

### Friday (Jun 27):
1. 🔵 Deploy to production (10% rollout)
2. 🔵 Monitor for errors
3. 🔵 Collect first 100 real decisions

**Goal:** Have overbooking detection live by end of week

---

**Document Owner:** Bella Platform Team  
**Last Updated:** June 22, 2026  
**Next Review:** July 19, 2026 (after Overbooking Detection complete)  
**Status:** 🔵 IN PROGRESS

---

## 🎓 Remember

> **"Integration first, optimization later."**

Don't spend weeks perfecting rules. Get them working, deploy, collect data, then optimize based on real patterns.

> **"Real decisions > Synthetic tests."**

100 real production decisions teach more than 1,000 unit tests.

