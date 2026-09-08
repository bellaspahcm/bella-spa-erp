# FACTORY MEASUREMENT PROTOCOL — Lightweight Prospective Capability

**Version:** 1.0  
**Date:** 2026-09-06  
**Status:** 🔵 **DEFINED** (not yet implemented)  
**Trigger:** Next real Industry OS with business demand

---

## Purpose

Capture sufficient effort provenance to measure economic leverage empirically, without creating timesheet bureaucracy.

**Goal:**
> Answer: "Did Platform reduce effort, by how much, with what confidence?"

**NOT Goal:**
- Track every hour obsessively
- Build measurement infrastructure
- Create approval/reporting overhead
- Slow down development

---

## When to Use

**Trigger conditions:**
1. New Industry OS with **real business demand** (customer contract, revenue projection, operational need)
2. Industry OS ≥ minimal viable scope (not trivial feature)
3. Human approves measurement for this project

**Do NOT use for:**
- Experiments without business demand
- Small features (<40h estimated effort)
- Projects where measurement overhead > value

---

## Measurement Phases

### Phase 1: Before Starting (5 minutes)

**Define baseline:**
```yaml
baseline:
  description: "Standalone effort if built without Platform"
  method: [historical | expert_estimate | proxy]
  value: [hours]
  source: "Document provenance"
  assumptions: ["List key assumptions"]
  confidence: [HIGH | MEDIUM | LOW]
```

**Define scope:**
```yaml
scope:
  features: ["List deliverables"]
  quality_bar: "Definition of done"
  exclusions: ["Out of scope"]
```

**Example:**
```yaml
baseline:
  description: "Healthcare Encounter + Vitals engine"
  method: proxy
  value: 180h
  source: "Hospital C1-C2 similar scope (from Healthcare Kernel build)"
  assumptions:
    - Same quality bar (tests, documentation)
    - Includes basic RLS and FSM
  confidence: MEDIUM
  
scope:
  features:
    - Encounter engine with status FSM
    - Vitals observation recording
    - Integration with Person Center
  quality_bar: "Tests pass, TypeScript clean, Architecture Guard pass"
  exclusions:
    - Orders engine (separate)
    - UI implementation
```

---

### Phase 2: During Development (ongoing, minimal)

**Effort log (not timesheet):**
```yaml
effort_log:
  architecture: [hours] # Design, contract definition
  implementation: [hours] # Code writing
  platform_reuse: [hours] # Time saved by reusing existing
  testing: [hours]
  rework: [hours] # Bugs, refactoring
  human_intervention: [hours] # Reviews, decisions, unblocking
```

**How to track:**
- Factory logs when starting/completing major milestones
- Human logs review/decision time (optional, rough estimate OK)
- NO per-hour tracking, NO daily timesheets

**Example log entries:**
```
2026-09-10: Architecture design complete (12h)
2026-09-11: Encounter contract + engine (18h implementation, 24h reused from Healthcare Kernel)
2026-09-12: Testing + integration (15h)
2026-09-13: Human review + approval (2h)
Total: 71h
```

---

### Phase 3: After Completion (10 minutes)

**Calculate leverage:**
```yaml
economic_leverage:
  baseline_effort: [value, source, confidence]
  platform_effort: [value, breakdown, confidence]
  leverage_ratio: [baseline / platform]
  confidence: [HIGH | MEDIUM | LOW]
  
  interpretation: "Platform reduced effort by X% vs baseline"
```

**Example:**
```yaml
economic_leverage:
  baseline_effort:
    value: 180h
    source: "Hospital C1-C2 proxy"
    confidence: MEDIUM
    
  platform_effort:
    value: 71h
    breakdown:
      architecture: 12h
      implementation: 18h (24h reused)
      testing: 15h
      integration: 8h
      rework: 10h
      human: 8h
    confidence: HIGH
    
  leverage_ratio: 2.54×
  confidence: MEDIUM (baseline proxy, platform measured)
  
  interpretation: "Platform reduced effort by ~61% vs comparable baseline"
```

---

## Confidence Levels

### HIGH Confidence
- Baseline: Measured historical data from same team
- Platform: Effort log with provenance
- Scope: Comparable apples-to-apples

### MEDIUM Confidence
- Baseline: Proxy from similar domain OR expert estimate with documentation
- Platform: Measured effort log
- Scope: Mostly comparable with documented differences

### LOW Confidence
- Baseline: Rough estimate without documentation
- Platform: Partial effort tracking
- Scope: Significant differences

---

## Anti-Patterns (Do NOT Do)

❌ **Timesheet bureaucracy**
- Forcing developers to log every 15 minutes
- Daily time reports
- Approval workflow for time entries

❌ **Measurement theater**
- Tracking metrics without using them
- Complex dashboards nobody reads
- Precision theater (claiming ±5 minutes accuracy)

❌ **Goal-seeking measurement**
- Adjusting baseline to make leverage look good
- Cherry-picking scope to maximize ratio
- Hiding rework/overhead to inflate efficiency

❌ **Artificial projects for measurement**
- Building features just to collect data
- Creating Product #2 without demand to prove reuse
- Industry OS without business need for measurement experiment

---

## Valid Use Case Example

**Project:** Healthcare Capability Pack #2 (Orders + Prescriptions)

**Business demand:** ✅ Clinic pilot customer needs prescription workflow

**Before starting:**
```yaml
baseline:
  description: "Orders + Prescription workflow standalone"
  method: expert_estimate
  value: 200h
  source: "Senior dev estimate based on CPOE system experience"
  assumptions:
    - Basic order entry + validation
    - E-prescribing integration stub
    - RLS and audit trail included
  confidence: MEDIUM
```

**During development:**
```
Week 1: Order engine contract (16h arch, 28h impl, 12h reused from Healthcare Kernel)
Week 2: Prescription workflow (22h impl, 8h RLS, 6h reused)
Week 3: Testing + integration (18h test, 12h integration, 8h rework)
Week 4: Human review + pilot deployment prep (6h human, 10h docs)
Total: 146h
```

**After completion:**
```yaml
economic_leverage:
  baseline: 200h (expert estimate, MEDIUM confidence)
  platform: 146h (measured log, HIGH confidence)
  leverage: 1.37×
  confidence: MEDIUM
  interpretation: "Platform reduced effort by ~27% vs standalone estimate"
```

**Result:** Valid measurement, documented confidence level

---

## Invalid Use Case Example

**Project:** Real Estate Product #2 (Specialty Store)

**Business demand:** ❌ None (created to prove reuse metrics)

**Decision:** Do NOT use measurement protocol

**Reason:**
> Artificial project creates artificial evidence. Wait for real demand.

---

## Integration with Factory

**Factory role:**
1. Logs major milestone effort automatically
2. Separates Platform reuse from new implementation
3. Captures provenance (which primitives reused, which built new)
4. Calculates leverage ratio with confidence level

**Human role:**
1. Defines baseline before starting (5 min)
2. Logs review/decision time (optional, rough estimate)
3. Reviews final measurement (10 min)

**No new tooling required:**
- Use existing docs/architecture/ folder for logs
- Simple YAML or Markdown format
- No database, no dashboard, no automation

---

## Expected Outcomes

**After 3 Industry OS with measurement:**

```yaml
industry_os_leverage:
  - name: Healthcare C2
    leverage: 2.54×
    confidence: MEDIUM
    
  - name: Retail Extensions
    leverage: 3.12×
    confidence: HIGH
    
  - name: Manufacturing MES
    leverage: 1.89×
    confidence: MEDIUM

aggregate:
  average_leverage: 2.52×
  trend: "Increasing (1.89× → 2.54× → 3.12×)"
  confidence: "MEDIUM to HIGH (measured, not estimated)"
```

**This would be valid empirical evidence for Platform value.**

---

## When to Stop Using

**Stop if:**
1. Measurement overhead > value provided
2. Team finds it bureaucratic despite minimal design
3. No one uses the data for decisions

**Keep if:**
1. Helps validate Platform value claims
2. Informs build vs buy decisions
3. Supports investor/board communication

---

## Document Status

**Status:** 🔵 DEFINED (not yet implemented)

**Next use:** When next Industry OS with real business demand appears

**Review:** After first 2 uses, assess if protocol is lightweight enough

**Maintenance:** Update only if methodology proves insufficient

---

## Relationship to Real Estate Investigation

**Real Estate taught us:**
> Cannot measure economic leverage retrospectively without effort provenance.

**This protocol solves:**
> Capture minimal provenance prospectively, enabling future measurement without bureaucracy.

**Key difference:**
> Real Estate tried to reconstruct (failed). Next Industry OS will capture during (succeed).

---

**Version:** 1.0  
**Author:** Factory + Human collaborative design  
**Last Updated:** 2026-09-06  
**Next Review:** After first 2 Industry OS uses

**Principle:**
> **Measure with minimal friction. Accept confidence levels. Refuse precision theater.**
