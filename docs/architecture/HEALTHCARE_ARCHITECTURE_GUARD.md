# Healthcare Architecture Guard

**Created:** 2026-09-01  
**Source:** P1 Healthcare Investigation Lessons  
**Purpose:** Automated enforcement of architectural invariants to prevent recurrence of P1 issues  

---

## Overview

Healthcare Architecture Guard is an automated verification tool that enforces architectural rules derived from real P1 investigation findings. It prevents the recurrence of circular dependencies, barrel export issues, and reverse dependencies that caused compiler hangs.

**Philosophy:** Convert forensic lessons into automated invariants.

---

## Rules Enforced

### Rule 1: EVENTS_NO_DOMAIN_IMPORT

**Source:** P1 Healthcare circular dependency #1  
**Finding:** `events → domain` import was architectural defect in circular dependency chain  
**Experiment result:** Removing this dependency alone did NOT resolve compiler hang  

**Rule:**
```
Event files MUST NOT import from domain layer
Events should depend only on contracts
```

**Violation Example:**
```typescript
// ❌ VIOLATION
import type { ClinicalOrder } from '../domain/clinical-order.entity';

// ✅ CORRECT
import type { 
  MedicationOrderDetails, 
  LabOrderDetails 
} from '../../../contracts/order-engine.contract';
```

**Rationale:** Event definitions should not depend on internal domain entities across this engine boundary. This was part of circular dependency chain but not sufficient cause of compiler hang.

**Classification:** Architectural defect (proven), NOT compiler hang root cause (experiment rejected)

---

### Rule 2: BARREL_NO_PARENT_CONTRACT_REEXPORT

**Source:** P1 Healthcare circular dependency #2 (compiler hang root cause)  
**Finding:** Barrel export re-exporting parent contracts creates circular module resolution  
**Experiment result:** Removing this pattern RESOLVED compiler hang (controlled experiment confirmed)  

**Rule:**
```
Engine index.ts barrel exports MUST NOT re-export parent contracts
Pattern: engine/index.ts → ../../contracts → engine/contracts (CYCLE)
```

**Violation Example:**
```typescript
// order-engine/index.ts
// ❌ VIOLATION
export {
  ORDER_ENGINE_CONTRACT,
  type OrderEngineContract,
} from '../../contracts/order-engine.contract';
```

**Correct Pattern:**
```typescript
// order-engine/index.ts
// ✅ CORRECT
export { ClinicalOrderService } from './services/clinical-order.service';
export { OrderEngineService } from './order-engine.service';

// Consumers import contracts directly:
import { ORDER_ENGINE_CONTRACT } from '@/platform/healthcare/contracts/order-engine.contract';
```

**Rationale:** Prevents a dependency pattern that was experimentally demonstrated to cause the Healthcare compiler hang. When TypeScript processes `order-engine/**/*.ts` glob including `index.ts`, the barrel re-export creates circular module resolution that hangs compiler.

**Evidence:** Differential isolation showed all files PASS individually, but TIMEOUT with index.ts barrel re-export present. Removing re-export resolved hang.

**Classification:** Compiler hang root cause (experimentally proven via controlled remediation)

---

### Rule 3: CONTRACT_NO_ENGINE_IMPORT

**Source:** Contract boundary principle  
**Finding:** Contracts define interface, engines implement (not reverse)  
**Evidence:** Architectural principle, not directly tied to compiler hang  

**Rule:**
```
Contract files MUST NOT import from engine directories
Contracts should be dependency-free or depend only on shared types
```

**Violation Example:**
```typescript
// contracts/laboratory-engine.contract.ts
// ❌ VIOLATION
import type { LabOrder } from '../engines/laboratory-engine/domain/lab-order';
```

**Correct Pattern:**
```typescript
// contracts/laboratory-engine.contract.ts
// ✅ CORRECT - define types directly in contract
export interface LabOrder {
  orderId: string;
  // ...
}

// OR import from shared kernel
import type { SharedLabOrder } from '../shared-kernel/types';
```

**Rationale:** Contracts are interface definitions. Engines implement contracts. Reverse dependency (contract → engine) violates separation of interface from implementation.

**Classification:** Architectural boundary violation (principle-based), NOT proven compiler hang cause

---

### Rule 4: NO_IMPORT_CYCLES

**Source:** P1 Healthcare investigation (general principle)  
**Finding:** Import cycles increase compiler complexity  
**Evidence:** Cycles were present in hang case, but not all cycles cause hangs  

**Rule:**
```
No circular import dependencies allowed
A → B → C → A is forbidden
```

**Detection:** Simple static analysis walks import graph and detects cycles.

**Rationale:** Import cycles increase compiler complexity and can contribute to hangs in combination with other factors. This is generic architectural invariant.

**Classification:** Architectural best practice (general), NOT proven sufficient cause of any specific compiler hang

---

### Rule 5: ENGINE_CONTRACT_ISOLATION

**Source:** Architecture principle (related to P1 patterns)  
**Finding:** Engine-specific contracts importing parent contracts suggests consolidation opportunity  

**Rule:**
```
Engine-specific contracts importing parent contracts should be reviewed
May indicate need for contract consolidation
```

**Severity:** WARNING (not ERROR)

**Example:**
```typescript
// engines/order-engine/contracts/host-event-bus-bridge.ts
// ⚠️ WARNING
import type { OrderEvent } from '../../../contracts/order-engine.contract';
```

**Rationale:** If engine-specific contract depends on parent contract, consider consolidating into parent contract or re-evaluating boundary.

---

## Usage

### Run Manually

```bash
npm run healthcare:guard
```

### Run in Pre-Commit Hook

Add to `.kiro/hooks/pre-commit.json`:

```json
{
  "version": "v1",
  "hooks": [{
    "name": "Healthcare Architecture Guard",
    "trigger": "PreToolUse",
    "matcher": "git.*commit",
    "action": {
      "type": "command",
      "command": "npm run healthcare:guard"
    }
  }]
}
```

### Run in CI

```yaml
# .github/workflows/architecture-guard.yml
- name: Healthcare Architecture Guard
  run: npm run healthcare:guard
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed ✅ |
| 1 | Architecture violations found ❌ |

---

## Output Format

```
Running Healthcare Architecture Guard...

  ⏳ Events domain dependency...
  ⏳ Barrel contract re-exports...
  ⏳ Contract engine reverse dependency...
  ⏳ Import cycles...
  ⏳ Engine contract isolation...

✅ 5 checks completed

╔════════════════════════════════════════════════════════════════╗
║         ❌ HEALTHCARE ARCHITECTURE VIOLATIONS FOUND ❌        ║
╚════════════════════════════════════════════════════════════════╝

🔴 ERRORS: 2

1. [EVENTS_NO_DOMAIN_IMPORT]
   File: src/platform/healthcare/engines/order-engine/events/order-event-factory.ts:9
   Event files must not import from domain layer
   Evidence: import type { ClinicalOrder } from '../domain/

2. [BARREL_NO_PARENT_CONTRACT_REEXPORT]
   File: src/platform/healthcare/engines/order-engine/index.ts:25
   Engine barrel exports must not re-export parent contracts
   Evidence: export type { OrderEngineContract } from '../../contracts/

══════════════════════════════════════════════════════════════

❌ Architecture Guard FAILED
   2 error(s) must be fixed
```

---

## Rule Evidence Classification

| Rule | Evidence Level | Classification |
|------|---------------|----------------|
| BARREL_NO_PARENT_CONTRACT_REEXPORT | ✅ **PROVEN via controlled experiment** | Compiler hang root cause (Healthcare order-engine case) |
| EVENTS_NO_DOMAIN_IMPORT | ✅ **PROVEN architectural defect**, ❌ NOT sufficient for hang | Architectural violation, not hang cause |
| CONTRACT_NO_ENGINE_IMPORT | ⚠️ Principle-based | Architectural boundary, not proven hang-related |
| NO_IMPORT_CYCLES | ⚠️ General best practice | Generic invariant, not specific hang cause |
| ENGINE_CONTRACT_ISOLATION | ℹ️ Pattern observation | Warning only, review trigger |

**Key Distinction:**

```
PROVEN compiler hang cause (via experiment):
  → BARREL_NO_PARENT_CONTRACT_REEXPORT only

Architectural defects (not proven hang cause):
  → EVENTS_NO_DOMAIN_IMPORT
  → CONTRACT_NO_ENGINE_IMPORT

General best practices:
  → NO_IMPORT_CYCLES
  → ENGINE_CONTRACT_ISOLATION
```

**Governance:** Do NOT claim all violations cause compiler hangs. Only barrel re-export pattern experimentally proven.

---

## Guard Status

### Current State (2026-09-01)

```
Guard implementation:        ✅ VERIFIED
Guard rules:                 ✅ ACTIVE
Evidence backing:            ✅ DOCUMENTED
Existing violations:         🔴 5 FOUND
Gate cleanliness:            ❌ NOT CLEAN YET
Production gate status:      ⏸️ NOT ENABLED (violations present)
```

### Known Violations

Current Healthcare codebase has 5 pre-existing violations:

| Rule | File | Classification | Remediation Priority |
|------|------|----------------|---------------------|
| EVENTS_NO_DOMAIN_IMPORT | order-event-factory.ts | Architectural defect | Medium |
| BARREL_NO_PARENT_CONTRACT_REEXPORT | cds-engine/index.ts | Compiler hang pattern | HIGH |
| BARREL_NO_PARENT_CONTRACT_REEXPORT | laboratory-engine/index.ts | Compiler hang pattern | HIGH |
| CONTRACT_NO_ENGINE_IMPORT | laboratory-engine.contract.ts | Boundary violation | Medium |
| CONTRACT_NO_ENGINE_IMPORT | nursing-engine.contract.ts | Boundary violation | Medium |

**Note:** 
- order-engine barrel export already fixed in P1 remediation
- Other engines have same barrel re-export pattern (HIGH priority - proven hang cause)
- Contract violations are architectural (not proven hang cause)

### Path to Production Gate

```
Current: Guard exists, violations present → NOT blocking commits
         ↓
Step 1: Fix HIGH priority violations (barrel re-exports)
         ↓
Step 2: Evaluate MEDIUM priority violations
         ↓
Step 3: Clean gate (0 violations)
         ↓
Future: Enable as pre-commit gate
```

**Do NOT enable as blocking gate until violations resolved.**

---

## Extension Points

### Adding New Rules

1. Add check function following pattern:
   ```typescript
   function checkNewRule(): Violation[] {
     const violations: Violation[] = [];
     // Check logic
     return violations;
   }
   ```

2. Add to checks array in `main()`:
   ```typescript
   { name: 'New rule', fn: checkNewRule }
   ```

3. Update this documentation

### Rule Naming Convention

- Rule ID: UPPERCASE_SNAKE_CASE
- Descriptive name based on what's forbidden or required
- Examples: `EVENTS_NO_DOMAIN_IMPORT`, `BARREL_NO_PARENT_CONTRACT_REEXPORT`

---

## Maintenance

### When to Update Guard

- After P1 investigation reveals new architectural defect pattern
- When new Healthcare kernel boundaries are established
- When new engines are added with specific isolation requirements

### When NOT to Update Guard

- For one-off violations (handle via code review)
- For patterns that haven't caused real issues
- For overly specific file-level rules (keep rules general)

---

## Integration with Existing Guards

Healthcare Architecture Guard complements existing guards:

| Guard | Scope | Purpose |
|-------|-------|---------|
| **Architecture Guard** | General (E7 Logistics Kernel) | Frozen boundary enforcement |
| **Healthcare Architecture Guard** | Healthcare-specific | Dependency pattern enforcement |
| **TypeScript Compiler** | Full project | Type correctness |
| **Architecture Tests** | Runtime boundaries | Contract enforcement |

**Relationship:** Healthcare guard is specialized enforcement based on P1 lessons. Does not replace general Architecture Guard.

---

## Philosophy

**Core Principle:** Convert forensic lessons into automated invariants.

**Evidence Standard:** No rule without evidence.

```
Finding → Controlled Experiment → Confirmed Invariant → Automated Guard
```

**NOT:**
```
"Có vẻ nguy hiểm" → Add rule (speculative)
```

**Classification Discipline:**

Guard must distinguish:
- ✅ **Experimentally proven causes** (barrel re-export → compiler hang)
- ✅ **Architectural defects** (events → domain, but NOT hang cause)
- ⚠️ **Best practices** (import cycles, boundary principles)

**Do NOT conflate**: Architectural violation ≠ Compiler hang cause

**Bella Governance:** Architecture Guard evolves from repository of frozen boundaries to repository of evidence-backed technical lessons.

---

## Evidence Trace

All rules in this guard trace to documented P1 investigations:

- `EVENTS_NO_DOMAIN_IMPORT` ← P1_HEALTHCARE_PROVENANCE_COMPLETE.md
- `BARREL_NO_PARENT_CONTRACT_REEXPORT` ← P1_COMPILER_PHASE_C4_FINDINGS.md
- `CONTRACT_NO_ENGINE_IMPORT` ← Healthcare architecture principles
- `NO_IMPORT_CYCLES` ← P1_COMPILER_PHASE_C3_FINDINGS.md
- `ENGINE_CONTRACT_ISOLATION` ← Pattern observed during investigation

**No rule without evidence.**

---

## Future Enhancements

Possible additions based on future investigations:

- Type complexity metrics (if pathological types identified)
- Scoped compiler timeout detection (if systematic pattern emerges)
- Contract completeness checks (deferred from P1)
- Domain invariant enforcement (if violations discovered)

**Trigger:** Real issue → Investigation → Pattern identified → Rule added

**Not:** "This might be useful" → Rule added speculatively

---

**Document Status:** ACTIVE  
**Last Updated:** 2026-09-01  
**Maintainer:** Architecture team  
**Review Trigger:** After each P1 Healthcare investigation
