# Factory Canonical Scope Derivation Rule

**Version:** 1.0  
**Status:** Productized from E8.1 proven behavior  
**Last Updated:** 2026-09-03

---

## Purpose

Deterministic machinery for deriving canonical implementation scope from multi-source evidence.

**Solves:**
- Prevents "DB table exists → build entity" heuristics
- Eliminates manual "2 or 4 entities?" questions
- Detects canonical drift automatically
- Makes Factory decisions reproducible

---

## Authority Ordering

Evidence sources ranked by authority (highest first):

1. **DB migrations** — authoritative persistence
2. **Generated types from real DB** — authoritative contract
3. **RLS policies** — authoritative governance
4. **Existing domain** — evidence of intent
5. **Behavioral tests** — evidence of requirements
6. **Historical/deleted code** — evidence of history, NOT authority

---

## Decision Model

### Outcomes

| Decision | Meaning |
|----------|---------|
| **CONFORM** | Implementation matches canonical evidence |
| **RECONSTRUCT** | Canonical persistence exists but domain missing (drift) |
| **DEFER** | Insufficient canonical evidence to proceed |
| **BLOCK** | Evidence contradictions detected, human decision required |
| **DO_NOT_REVIVE** | Historical implementation only, not canonical |

###

 Explicit Rules

**Rule 1: Historical-only → DO_NOT_REVIVE**
```
historical=true AND migration=false AND generatedTypes=false AND rls=false
→ DO_NOT_REVIVE
```

**Rule 2: Migration/Types mismatch → BLOCK**
```
(migration=true AND generatedTypes=false) OR
(migration=false AND generatedTypes=true)
→ BLOCK (contract drift)
```

**Rule 3: Canonical persistence without RLS → BLOCK**
```
migration=true AND generatedTypes=true AND rls=false
→ BLOCK (governance gap)
```

**Rule 4: Full canonical chain + domain → CONFORM**
```
migration=true AND generatedTypes=true AND rls=true AND domain=true
→ CONFORM
```

**Rule 5: Canonical persistence without domain → RECONSTRUCT**
```
migration=true AND generatedTypes=true AND rls=true AND domain=false
→ RECONSTRUCT (canonical drift)
```

**Rule 6: Domain without canonical persistence → DEFER**
```
domain=true AND migration=false
→ DEFER (speculative)
```

**Rule 7: Tests without persistence → DEFER**
```
tests=true AND migration=false AND domain=false
→ DEFER
```

**Rule 8: Orphaned RLS → DEFER**
```
rls=true AND migration=false AND generatedTypes=false
→ DEFER
```

**Rule 9: No evidence → DEFER**
```
All false
→ DEFER
```

---

## E8.1 Retrospective Verification

**Factory correctly reproduced E8 Education OS scope:**

| Entity | Migration | Types | RLS | Domain | Tests | Expected | Actual |
|--------|-----------|-------|-----|--------|-------|----------|--------|
| Course | ✅ | ✅ | ✅ | ✅ | ✅ | CONFORM | ✅ CONFORM |
| Enrollment | ✅ | ✅ | ✅ | ✅ | ✅ | CONFORM | ✅ CONFORM |
| Attendance | ✅ | ✅ | ✅ | ❌ | ❌ | RECONSTRUCT | ✅ RECONSTRUCT |
| Assessment | ✅ | ✅ | ✅ | ❌ | ❌ | RECONSTRUCT | ✅ RECONSTRUCT |
| Student | ❌ | ❌ | ❌ | ❌ | ❌ | DEFER | ✅ DEFER |

**Result:** 5/5 correct decisions

---

## Usage

### Programmatic

```typescript
import { deriveCanonicalScope, type CanonicalEvidence } from './canonical-scope-derivation';

const evidence: CanonicalEvidence = {
  migration: true,
  generatedTypes: true,
  rls: true,
  domain: false,
  tests: false,
};

const result = deriveCanonicalScope(evidence);
console.log(result.decision); // 'RECONSTRUCT'
console.log(result.reason);   // 'Canonical drift: authoritative persistence...'
```

### CLI (future)

```bash
# Future: Scan repository and derive scope
npm run factory:derive-scope -- --os=education
```

---

## Test Coverage

**10 test cases verified:**
1. ✅ Complete evidence → CONFORM
2. ✅ Canonical persistence + missing domain → RECONSTRUCT
3. ✅ Domain without persistence → DEFER
4. ✅ Migration without types → BLOCK
5. ✅ Canonical table without RLS → BLOCK
6. ✅ Historical only → DO_NOT_REVIVE
7. ✅ E8 Course retrospective → CONFORM
8. ✅ E8 Attendance retrospective → RECONSTRUCT
9. ✅ E8 Student (not built) → DEFER
10. ✅ Canonical wins over historical → RECONSTRUCT

**Run tests:**
```bash
npx tsx scripts/governance/test-canonical-scope-derivation.ts
```

---

## Known Limitations

1. **Evidence collection not automated** - `collectCanonicalEvidence()` is a stub
2. **RLS detection simplistic** - doesn't verify policy correctness, only existence
3. **No historical code analysis** - relies on manual `historical` flag
4. **Single-entity focus** - doesn't analyze entity relationships

**Future work:**
- Implement `collectCanonicalEvidence()` with file scanning
- Add RLS policy correctness verification
- Analyze git history for historical evidence
- Detect entity relationship chains

---

## Integration

**Current:** Standalone rule with manual evidence input  
**Future:** Integrate into Factory orchestration

**Does NOT replace:**
- Architecture Guard (frozen boundary enforcement)
- Gate B (scoped typecheck)
- G0.5 (regression protection)
- BDGF (Build-Deploy-Gate-Fix loop)

**Complements:** Existing gates by providing evidence-based scope decisions

---

## Evolution Principle

> **"Extract proven behavior → Make testable → Make reusable"**

**E7:** Factory can build an OS  
**E8:** Factory decides scope autonomously (experiment)  
**E9:** Scope decision becomes testable machinery (**this document**)  
**E10+:** Machinery compounds across OS builds

---

## References

- **E8.1 Evidence:** `docs/architecture/E8_EDUCATION_KERNEL_EVIDENCE.md`
- **E8 Discovery:** `docs/architecture/E8_EDUCATION_OS_DISCOVERY.md`
- **Implementation:** `scripts/governance/canonical-scope-derivation.ts`
- **Tests:** `scripts/governance/test-canonical-scope-derivation.ts`
- **AGENTS.md:** Factory principles

---

**Status:** ✅ PRODUCTIZED  
**Verification:** ✅ E8 retrospective confirmed  
**Next:** Implement `collectCanonicalEvidence()` for full automation
