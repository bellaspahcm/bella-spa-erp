# CORE PRESSURE EVENT TEMPLATE

**Purpose:** Document moments where Core modification appeared necessary but was avoided

**Rules:**
1. ✅ Only log **genuine** pressure (not fabricated for KPI)
2. ✅ Document **before** finding solution (capture real thought process)
3. ✅ Include **why** Core mod seemed necessary
4. ✅ Document **actual** alternative used
5. ❌ Do NOT log convenience preferences
6. ❌ Do NOT log minor duplications
7. ❌ Do NOT create artificial complexity

---

## CORE PRESSURE EVENT #[NUMBER]

**Date:** [YYYY-MM-DD HH:mm:ss]  
**Day:** [Week 3 Day N]  
**Developer:** [Name or "AI Agent"]  
**Context:** [Feature being implemented]

### Requirement
[Describe what you were trying to build]

### Pressure Type
- [ ] Capability Gap (Core missing functionality)
- [ ] Performance Issue (Core pattern insufficient)
- [ ] Pattern Mismatch (Core abstraction doesn't fit)
- [ ] Integration Challenge (Core doesn't support needed integration)
- [ ] Data Model Constraint (Core schema limiting)
- [ ] Event/Messaging Gap (Core event bus insufficient)
- [ ] Other: [specify]

### Why Core Modification Appeared Necessary
[Detailed explanation of why you thought Core needed to change]

**Specific thought process:**
- What were you trying to accomplish?
- What Core limitation did you hit?
- Why did modifying Core seem like the solution?
- What would the Core change have enabled?

### Considered Core Change

**Location:** `src/core/[file]`

**Type:**
- [ ] Add new capability
- [ ] Modify existing abstraction
- [ ] Add new type/interface
- [ ] Change event schema
- [ ] Modify database schema
- [ ] Other: [specify]

**Code Change (if sketched):**
```diff
// Example:
// File: src/core/event-bus/index.ts

+ export interface EventMetadata {
+   // New field for Logistics optimization data
+   optimizationMetadata?: OptimizationMetadata;
+ }
+
+ export interface OptimizationMetadata {
+   algorithm: string;
+   computeTimeMs: number;
+   alternativesEvaluated: number;
+ }
```

**Impact if made:**
- Affected Core modules: [list]
- Breaking changes: [YES/NO]
- Other systems affected: [Healthcare, etc.]

### Why Core Was NOT Modified

**Principle Applied:**
- [ ] Core Freeze (Week 3-4 Zero-Core-Change Test)
- [ ] Separation of Concerns (domain-specific logic)
- [ ] Open/Closed Principle (extend, don't modify)
- [ ] Kernel Isolation (keep domain logic in Kernel)
- [ ] Other: [specify]

**Governance:**
- Constraint: [Core = IMMUTABLE during test period]
- Gate: [Would fail Architecture Guard]
- Impact: [Would invalidate Zero-Core-Change Test]

### Alternative Solution

**Type:**
- [ ] Contract Extension
- [ ] Kernel Capability (domain-specific)
- [ ] Extension/Plugin Pattern
- [ ] Adapter/Wrapper
- [ ] Domain-Specific Logic
- [ ] Other: [specify]

**Location:** `src/platform/logistics/[file]`

**Implementation:**
```typescript
// Example:
// File: src/platform/logistics/shared-kernel/types.ts

/**
 * Logistics-specific event metadata extension
 * 
 * Extends base EventMetadata without modifying Core
 */
export interface LogisticsEventMetadata extends EventMetadata {
  routeOptimization?: {
    algorithm: 'greedy' | 'genetic' | 'simulated-annealing';
    computeTimeMs: number;
    waypointsEvaluated: number;
    alternativeRoutesConsidered: number;
    costSavingPercentage: number;
  };
}

/**
 * Logistics domain event with extended metadata
 */
export interface LogisticsDomainEvent<T = Record<string, unknown>> {
  eventType: string;
  eventVersion: string;
  eventId: string;
  timestamp: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: 'shipment' | 'route' | 'carrier';
  payload: T;
  metadata: LogisticsEventMetadata;
}
```

**Size:**
- New files created: [N]
- Lines of code: [N]
- Complexity: [Low / Medium / High]

**Quality Assessment:**
- [ ] Clean (follows platform patterns)
- [ ] Acceptable (minor duplication)
- [ ] Hacky (workaround, creates tech debt)

**If Hacky:** Explain why and document tech debt

### Implementation Evidence

**Code:**
- [ ] Alternative implemented
- [ ] Tests written and passing
- [ ] Integration verified

**Verification:**
- [ ] Architecture Guard: PASS
- [ ] Core diff: 0 modifications
- [ ] Healthcare Regression: PASS

**Files Changed:**
- `[list files]`

**Git Commit:**
```bash
git log --oneline -1
# [commit hash] [commit message]
```

### Outcome

**Feature Status:**
- [ ] ✅ Completed successfully
- [ ] 🟡 Completed with limitations
- [ ] ❌ Blocked (no viable alternative)

**If Blocked:** Explain blocker and impact

**Performance:**
- Compared to hypothetical Core solution: [Better / Same / Worse]
- Measurable impact: [latency, memory, etc.]
- Acceptable: [YES / NO]

**Maintainability:**
- Compared to hypothetical Core solution: [Better / Same / Worse]
- Future burden: [Low / Medium / High]
- Acceptable: [YES / NO]

### Metrics

**Effort:**
- Time to identify pressure: [minutes]
- Time to find alternative: [minutes]
- Time to implement: [hours]
- Total delay vs modifying Core: [estimate]

**Core Impact:**
- Core modifications: **0** ✅
- Core LOC added: **0** ✅
- Core tests affected: **0** ✅

**Logistics Impact:**
- Logistics LOC added: [N]
- Logistics files created: [N]
- Logistics tests added: [N]

### Lessons Learned

**About Core Abstractions:**
- What does this reveal about Core design?
- Is this a genuine Core gap or domain-specific need?
- Should Core eventually add this capability?

**About Platform Maturity:**
- Was alternative easy or difficult to find?
- How clean is the alternative solution?
- Would this pattern work for other domains?

**Recommendations:**
- [ ] Core is sufficient as-is
- [ ] Consider adding to Core in future (post-freeze)
- [ ] Pattern should be documented for other domains
- [ ] Core has a genuine gap requiring ADR

### Related Events
- Previous events: [#N, #M if related]
- Related requirements: [list]
- Follow-up needed: [YES/NO]

---

## APPROVAL

**Documented By:** [Name/Agent]  
**Reviewed By:** [If applicable]  
**Date:** [YYYY-MM-DD]  
**Status:** [RESOLVED / BLOCKED / MONITORING]

---

## APPENDIX: Evidence Artifacts

**Logs:**
```
[Paste relevant logs, test output, etc.]
```

**Screenshots/Diagrams:**
[If applicable]

**References:**
- Architecture docs: [link]
- Contract definition: [file path]
- Implementation: [file path]
- Tests: [file path]

---

**END OF CORE PRESSURE EVENT TEMPLATE**
