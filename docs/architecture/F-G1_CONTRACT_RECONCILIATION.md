# F-G1 Contract Reconciliation — AutoMove Evidence

**Date:** 2026-09-06  
**Trigger:** Factory Test #3 (AutoMove) encountered 4 runtime DB/RLS failures NOT caught by F-G1 preflight  
**Status:** 🟡 **OPEN — Contract reconciliation required before determining remediation**

---

## Purpose

Map each AutoMove incident to F-G1's existing contract to determine:
- **Case A (Gap):** Incident outside F-G1 contract → Record as capability gap, do NOT expand guard
- **Case B (Defect):** Incident inside F-G1 contract → Guard failed to detect → Remediate F-G1
- **Case C (Ambiguity):** Contract unclear → Clarify contract first, then classify

**Critical principle:**  
> **Do NOT expand F-G1 based on single-Product incidents. Contract reconciliation must happen BEFORE implementation changes.**

---

## F-G1 Current Contract (Baseline)

**Source:** `src/factory/gates/f-g1-environment-preflight/__tests__/f-g1-environment-preflight.test.ts`

**Declared scope:**
1. Database connectivity verification
2. Required tables existence check
3. RLS policies presence verification
4. Service role authentication

**Implementation validates:**
- Supabase client can connect
- 7 AutoMove tables exist in schema
- Each table has at least one RLS policy defined
- `SUPABASE_SERVICE_ROLE_KEY` available

**What F-G1 does NOT explicitly contract to validate:**
- FK constraint correctness ❓
- Table privilege grants (`GRANT SELECT`) ❓
- Column schema correctness ❓
- RLS policy semantic correctness (Platform function compatibility) ❓
- Tenant context configuration ❓

---

## AutoMove Incidents (Evidence)

### Incident #1: Invalid Customer FK Join

**Symptom:** Supabase query error on `.customer:customers(...)`  
**Root cause:** `auto_vehicles.delivered_to_customer_id` has no FK constraint defined  
**Factory remediation:** Removed customer joins from vehicle queries  

**Contract question:**  
> Should F-G1 validate that FK relationships referenced in code actually exist in schema?

**Current contract assessment:**  
- F-G1 checks tables exist ✅
- F-G1 does NOT check FK constraints ❌

**Classification:** Likely **Case A (Gap)** — FK validation not in current F-G1 contract

---

### Incident #2: Missing Table Privileges

**Symptom:** `permission denied for table auto_vehicles`  
**Root cause:** Tables created but `GRANT SELECT` not executed for `authenticated`/`anon` roles  
**Factory remediation:** Migration `20260906000000_fix_auto_vehicles_anon_access.sql`  

**Contract question:**  
> Should F-G1 validate that required database roles have necessary table-level privileges?

**Current contract assessment:**  
- F-G1 checks tables exist ✅
- F-G1 checks service role works ✅
- F-G1 does NOT check role-specific privileges for `authenticated`/`anon` ❌

**Classification:** Likely **Case A (Gap)** — Role privilege validation not in current F-G1 contract

---

### Incident #3: Schema/Code Column Mismatch

**Symptom:** Code references `vehicle.make`, `vehicle.model`, `vehicle.year` failing  
**Root cause:** Actual schema uses `variant_id` (FK), `vin`, `model_year`  
**Factory remediation:** Updated actions + UI to use correct column names  

**Contract question:**  
> Should F-G1 validate that code references match actual schema columns?

**Current contract assessment:**  
- F-G1 checks tables exist ✅
- F-G1 does NOT validate column existence or naming ❌

**Classification:** Likely **Case A (Gap)** — Column validation not in current F-G1 contract

**Alternative interpretation:** This is a code generation defect, not an environment issue. F-G1 is "Environment Preflight" — validating deployment environment readiness, not code correctness.

---

### Incident #4: RLS Policy Platform Incompatibility

**Symptom:** `unrecognized configuration parameter "app.current_tenant_id"`  
**Root cause:** RLS policies used `current_setting('app.current_tenant_id')` instead of Platform's canonical `get_auth_tenant_id()`  
**Factory remediation:** Migration `20260906000001_fix_auto_repair_orders_rls.sql` updating 3 policies  

**Contract question:**  
> Should F-G1 validate that RLS policies use Platform-compatible functions?

**Current contract assessment:**  
- F-G1 checks RLS policies exist ✅
- F-G1 does NOT validate policy semantic correctness ❌
- F-G1 does NOT check Platform function usage ❌

**Classification:** **Ambiguous** — Could be Gap OR Defect depending on F-G1 scope interpretation

**Sub-questions:**
- Is "environment preflight" responsible for validating Platform conventions?
- Should F-G1 know about `get_auth_tenant_id()` vs `current_setting()`?
- Is this a schema correctness issue (F-G1 scope) or business logic issue (out of scope)?

---

## Reconciliation Questions

### Q1: What is the intended boundary of "Environment Preflight"?

**Option A — Minimal (Connectivity + Existence):**
- Verify database connects
- Verify required tables/policies exist
- Do NOT validate semantic correctness

**Option B — Structural (Schema Integrity):**
- Option A PLUS:
- Validate FK constraints match schema
- Validate required privileges granted
- Validate column existence

**Option C — Platform Contract (Convention Compliance):**
- Option B PLUS:
- Validate RLS policies use Platform functions
- Validate tenant context configuration
- Validate Platform integration patterns

**Current F-G1 implementation appears to be Option A.**  
**AutoMove incidents suggest need for Option B or C.**

**Decision needed:** Which option should be F-G1's canonical contract?

---

### Q2: Should F-G1 expand scope based on AutoMove incidents?

**Arguments FOR expansion:**
- 4 real incidents caught during E2E validation
- Earlier detection = faster feedback
- Prevents runtime failures in production

**Arguments AGAINST expansion:**
- Only one Product's evidence (insufficient pattern)
- Risk of overfitting to AutoMove-specific issues
- Guard complexity explosion
- False positives on legitimate schema variations
- Unclear boundary between "environment" vs "code correctness"

**Factory principle:**  
> **Evidence First → Rule Second → Automation Third.**  
> One Product = documented learning. Multiple Products = rule formalization.

**Decision needed:** Expand F-G1 now OR wait for pattern repetition across Products?

---

### Q3: For each incident, is it a Guard deficiency or Capability gap?

**Incident #1 (FK):**
- [ ] Guard deficiency (F-G1 should have caught this)
- [ ] Capability gap (outside F-G1 scope)
- [ ] Contract ambiguity (unclear if F-G1 responsible)

**Incident #2 (Privileges):**
- [ ] Guard deficiency
- [ ] Capability gap
- [ ] Contract ambiguity

**Incident #3 (Columns):**
- [ ] Guard deficiency
- [ ] Capability gap
- [ ] Contract ambiguity

**Incident #4 (RLS/Platform):**
- [ ] Guard deficiency
- [ ] Capability gap
- [ ] Contract ambiguity

---

## Reconciliation Process

```
Step 1: Read current F-G1 contract explicitly
        ↓
Step 2: For each AutoMove incident:
        - Map incident to contract requirement (if exists)
        - If no mapping → Capability gap (Case A)
        - If mapping exists → Check implementation
        - If implementation should catch but doesn't → Defect (Case B)
        - If contract unclear → Ambiguity (Case C)
        ↓
Step 3: Classify all incidents
        ↓
Step 4: Decide scope change (if any)
        - Case A only → No F-G1 changes, document gaps
        - Case B found → Remediate F-G1 implementation
        - Case C found → Clarify contract first
        ↓
Step 5: Update contract document
        ↓
Step 6: If remediation needed → implement + test
        ↓
Step 7: Document decision + evidence
```

---

## Preliminary Assessment (Subject to Review)

**Likely classification:**

- **Incident #1 (FK):** Case A (Gap) — FK validation outside current scope
- **Incident #2 (Privileges):** Case A or B (TBD) — Role privileges may be implied by "environment readiness"
- **Incident #3 (Columns):** Case A (Gap) — Column validation is code correctness, not environment
- **Incident #4 (RLS/Platform):** Case C (Ambiguity) — Unclear if Platform convention enforcement is F-G1 responsibility

**Tentative recommendation:**  
Do NOT expand F-G1 based on AutoMove alone. Document these as capability gaps. Observe if patterns repeat across next 2-3 Products before formalizing new checks.

**Exception:** If Incident #2 or #4 can be proven to fall within existing contract, remediate immediately.

---

## Next Actions

**REQUIRED before any F-G1 changes:**
1. ✅ Document all 4 AutoMove incidents with evidence
2. ⏸️ Review F-G1 contract document (if exists) or infer from implementation
3. ⏸️ Map each incident to contract explicitly
4. ⏸️ Classify: Gap / Defect / Ambiguity
5. ⏸️ Make scope decision with evidence justification
6. ⏸️ Update F-G1 contract document
7. ⏸️ Implement changes (if needed)
8. ⏸️ Add tests for new validations
9. ⏸️ Document decision rationale

**BLOCKED:**
- ❌ F-G1 implementation changes (until classification complete)
- ❌ New Factory capabilities (until reconciliation complete)
- ❌ Product #4 construction (until learning from #3 captured)

---

## Success Criteria

**Reconciliation complete when:**
- [ ] Each AutoMove incident classified (Gap/Defect/Ambiguity)
- [ ] F-G1 contract boundary explicitly documented
- [ ] Decision recorded with evidence justification
- [ ] If remediation needed: implementation + tests complete
- [ ] If no remediation: gaps documented for future evaluation

**Key principle preserved:**  
> **One incident ≠ rule expansion. Pattern repetition ≠ rule formalization. Contract clarity > implementation complexity.**

---

**Status:** 🟡 **OPEN — Reconciliation in progress**  
**Blocking:** F-G1 changes, Factory expansion, Product #4  
**Owner:** Factory governance review
