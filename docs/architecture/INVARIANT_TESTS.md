# 🛡️ BELLA Platform Governance — Invariant Tests

**Status:** 🔴 **BLOCKING** (must PASS before production deployment)  
**Purpose:** Regression barrier for architectural violations  
**Scope:** Production runtime integrity

---

## What Are Invariant Tests?

Invariant tests are **NOT unit tests**. They are **architectural guardrails** that enforce platform-level contracts.

**Characteristics:**
- Run in CI/CD pipeline before every deploy
- **MUST** pass for build to succeed
- Violations = Architecture breach = Build FAIL
- Prevent regression to anti-patterns

**Difference from Unit Tests:**

| Unit Tests | Invariant Tests |
|------------|-----------------|
| Test business logic | Test architectural rules |
| Verify behavior | Verify constraints |
| Can be mocked | Cannot be bypassed |
| Feature-specific | Platform-wide |
| "Does it work?" | "Is it allowed?" |

---

## 6 Core Invariants

### ✅ INVARIANT 1: Production Type Safety

**Rule:** Production source has ZERO unapproved `any` types.

**Rationale:**
- `any` defeats TypeScript's type safety
- In domain/runtime boundaries, `any` = contract violation
- Healthcare clinical orders, CDS overrides, extension runtime CANNOT use `any`

**Exceptions:**
Extremely rare cases may require `any`. Must have:
```typescript
// @approved-any reason="FFI to untyped external library X" owner="architect-name" expiry="2026-12-31"
const externalLib: any = require('untyped-lib');
```

**Locations:**
- ❌ `medical-order.service.ts`
- ❌ `hospital-admission.service.ts`
- ❌ `cds-override.entity.ts`
- ❌ `extension-runtime.ts`

**Fix:**
Replace `any` with proper types:
```typescript
// BEFORE
function processOrder(data: any) { ... }

// AFTER
import { ClinicalOrder } from '@/platform/healthcare/engines/h3-clinical-orders/contracts';
function processOrder(data: ClinicalOrder) { ... }
```

---

### ✅ INVARIANT 2: Clinical Provenance Integrity

**Rule:** Production Healthcare runtime has ZERO mock clinical identity.

**Rationale:**
- Healthcare requires authoritative provenance chain
- Mock data = HIPAA audit trail violation
- Clinical evidence must originate from real entities

**Forbidden Patterns:**
```typescript
❌ const patientId = 'pat-default';
❌ const encounterId = 'enc-dental-default';
❌ const mockPatient = { id: 'default-123' };
```

**Correct Pattern:**
```typescript
✅ Real Patient
      ↓
   Real Encounter (hc_encounters via H2 Kernel)
      ↓
   Real Clinical Event (H3 Clinical Orders)
      ↓
   Real Temporal Evidence (H9 Temporal Engine)
      ↓
   Real Audit Trail (H11 Audit)
      ↓
   Clinical Action
```

**Locations:**
- ❌ `healthcare-chairs-actions.ts`
- ❌ Mock Temporal/Audit contracts

**Fix:**
```typescript
// BEFORE
const patientId = 'pat-default';

// AFTER
const patientId = await patientContract.resolvePatientId(encounter);
```

---

### ✅ INVARIANT 3: Build Integrity

**Rule:** Production builds MUST fail on TypeScript errors.

**Rationale:**
- `ignoreBuildErrors: true` = false-green
- Broken code can reach production
- TypeScript enforces domain contracts

**Check:**
```typescript
// next.config.ts
export default {
  typescript: {
    ignoreBuildErrors: false, // ✅ REQUIRED
  },
};
```

**Impact:**
```
TypeScript error
     ↓
Build FAIL ✅  (not Build PASS ❌)
     ↓
Developer fixes error
     ↓
Build PASS
     ↓
Production deploy
```

---

### ✅ INVARIANT 4: Healthcare Contract Boundary

**Rule:** Clinical evidence must originate from authoritative Kernel contracts.

**Rationale:**
- Product code cannot bypass Healthcare Kernel (H1-H12)
- Direct `hc_*` table access violates bounded context
- Kernel owns Healthcare domain logic

**Forbidden:**
```typescript
❌ const patients = await supabase.from('hc_master_patient_index').select();
❌ const sql = `SELECT * FROM hc_encounters WHERE ...`;
```

**Correct:**
```typescript
✅ Product Service
       ↓
   Product Contract (AdmissionContract)
       ↓
   Healthcare Kernel Engine (H2 Patient Encounter)
       ↓
   hc_encounters table
```

**Locations:**
- ❌ `healthcare-hospital-services.ts`
- ❌ `hospital/beds/page.tsx`
- ❌ `healthcare/pharmacy/page.tsx`

**Fix:**
```typescript
// BEFORE
const admissions = await supabase
  .from('hc_inpatient_admissions')
  .select();

// AFTER
import { AdmissionContract } from '@/platform/healthcare/contracts';
const admissions = await AdmissionContract.listAdmissions(tenantId);
```

---

### ✅ INVARIANT 5: UI Persistence Boundary

**Rule:** UI components cannot directly access `hc_*` tables.

**Rationale:**
- UI → Database coupling is anti-pattern
- Violates separation of concerns
- Makes testing impossible

**Forbidden:**
```tsx
❌ // In React component
   const { data } = await supabase
     .from('hc_master_patient_index')
     .select();
```

**Correct:**
```tsx
✅ UI Component
      ↓
   Service Layer (AdmissionService)
      ↓
   Product Contract
      ↓
   Kernel Engine
      ↓
   Database
```

**Fix:**
```tsx
// BEFORE (page.tsx)
const patients = await supabase.from('hc_master_patient_index').select();

// AFTER (page.tsx)
import { getPatients } from '@/services/healthcare/patient.service';
const patients = await getPatients();
```

---

### ✅ INVARIANT 6: RLS Tenant Isolation

**Rule:** Every tenant-owned table has enforced tenant isolation.

**Requirements:**
1. All tables with `tenant_id` must have RLS enabled
2. No `USING (true)` policies on authenticated users
3. Policies must check `tenant_id = get_auth_tenant_id()`
4. Both `USING` and `WITH CHECK` must enforce isolation

**Verification:**
```bash
npm run security:rls-audit
```

**See:** `docs/security/SECURITY_GATE_PROTOCOL.md`

---

## Running Invariant Tests

### Local Development
```bash
npm test -- invariants
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
- name: Run Invariant Tests
  run: npm test -- invariants
  # MUST pass for deploy to proceed
```

### Pre-commit Hook
```bash
# .kiro/hooks/pre-commit.json
{
  "trigger": "PreToolUse",
  "action": {
    "type": "command",
    "command": "npm test -- invariants --run"
  }
}
```

---

## Fixing Violations

### Priority Order

1. **Clinical Mock Identity** (P1 — HIPAA provenance)
2. **Build Integrity** (P1 — False-green elimination)
3. **Production `any`** (P1 — Type safety)
4. **Direct hc_* Access** (P2 — Architecture boundary)
5. **CSP Hardening** (P2 — Defense-in-depth)

### Fix Workflow

```
1. Run invariant tests
       ↓
2. Identify violations
       ↓
3. Fix ONE invariant at a time
       ↓
4. Re-run tests (MUST pass)
       ↓
5. Commit with: "fix(invariant): <description>"
       ↓
6. Repeat until ALL invariants PASS
       ↓
7. Security Gate can proceed
```

---

## Enforcement

### Build Pipeline

```typescript
// package.json
{
  "scripts": {
    "test:invariants": "vitest run src/__tests__/invariants",
    "prebuild": "npm run test:invariants",  // ← Blocks build
  }
}
```

### Git Hooks

```bash
# .husky/pre-push
#!/bin/sh
npm run test:invariants || exit 1
```

### Vercel Deploy

```json
// vercel.json
{
  "buildCommand": "npm run test:invariants && npm run build"
}
```

---

## Exception Process

**Rarely**, an exception may be required. Process:

1. **Document:**
   ```typescript
   // @invariant-exception
   // Invariant: INVARIANT_1_TYPE_SAFETY
   // Reason: FFI to untyped legacy system X
   // Owner: architect-name
   // Approved: 2026-08-16
   // Expiry: 2026-12-31
   // Remediation: Migrate to typed SDK by Q4 2026
   ```

2. **Get approval** from:
   - Technical Architect
   - Domain Lead (Healthcare/Finance/etc.)
   - Security Review (if P0/P1)

3. **Create tracking issue:**
   ```
   Title: [TECH DEBT] Remove INVARIANT_1 exception in file.ts
   Priority: P1
   Due: 2026-12-31
   ```

4. **Add to exception registry:**
   `docs/architecture/INVARIANT_EXCEPTIONS.md`

---

## Invariant vs. Verification Test

**Invariant Test:**
- Architectural constraint
- Platform-wide rule
- Binary: PASS or FAIL
- Examples: "No `any`", "No mock identity"

**Verification Test:**
- Business logic validation
- Feature-specific
- Can have edge cases
- Examples: "Prepayment reconciles", "RLS blocks cross-tenant"

**Both are required.** Invariants ensure the platform is structurally sound. Verifications ensure features work correctly.

---

## Security Gate Integration

Invariant tests are **Gate 5** in the Security Reconciliation:

```
Gate 1: RLS Inventory        ✅ DONE
Gate 2: Classify Violations   ✅ DONE
Gate 3: Verify Remote         ✅ DONE
Gate 4: Migration History     ✅ DONE
Gate 5: Invariant Tests       🔴 IN PROGRESS ← YOU ARE HERE
Gate 6: Adversarial Testing   ⏳ BLOCKED
Gate 7: Design Fix Review     ⏳ BLOCKED
Gate 8: Apply & Re-test       ⏳ BLOCKED
Gate 9: Freeze & Document     ⏳ BLOCKED
```

**Until all 6 invariants PASS:**
- ❌ F5 cannot resume
- ❌ Production deployment blocked
- ❌ Security Gate NOT PASS

---

## Success Criteria

```
✅ INVARIANT 1: 0 unapproved `any`
✅ INVARIANT 2: 0 mock clinical identity
✅ INVARIANT 3: ignoreBuildErrors = false
✅ INVARIANT 4: 0 direct hc_* access from products
✅ INVARIANT 5: 0 direct hc_* access from UI
✅ INVARIANT 6: All tenant tables have RLS

→ Security Gate PASS
→ F5 can resume
→ Production deployment ALLOWED
```

---

**Last Updated:** 2026-08-16  
**Owner:** Platform Architecture Team  
**Status:** 🔴 6/6 Invariants NOT PASS (violations detected)
