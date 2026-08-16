# P1 Critical Fixes Needed

## 🔴 Priority Order

### 1. Healthcare Mock Contracts (P1.3) — CRITICAL AUDIT VIOLATION
**File:** `src/services/healthcare-chairs-actions.ts`

**Issues:**
- Line 130-133: Mock temporal & audit contracts
```typescript
{ recordTemporalEvent: async (input: any) => ({ id: `temp-${Date.now()}`, sequenceNumber: 1, ...input }) } as any,
{ recordAuditEntry: async (input: any) => ({ id: `aud-${Date.now()}`, sha256Fingerprint: 'SHA256:DENTAL_CHAIR_EVIDENCE_FINGERPRINT' }) } as any
```
- Line 158: Hard-coded patient ID: `'pat-default'`
- Line 232: Hard-coded encounter ID: `'enc-dental-default'`

**Impact:**
- Creates FAKE audit/evidence records
- Breaks clinical provenance chain
- Violates encounter boundary
- Falsifies temporal history

**Fix:**
1. Remove mock contracts
2. Inject real TemporalContract & AuditContract
3. Remove hard-coded IDs
4. Use actual patient/encounter from context

---

### 2. Type Safety Violations (P1.2) — 1,389 any violations
**Command:** `npm run check:any-types`

**Critical Files:**
- `src/products/bella-hospital/services/hospital-admission.service.ts:47`
- `src/products/bella-medical/services/medical-order.service.ts:62`
- `src/platform/healthcare/engines/cds-engine/domain/cds-override.entity.ts:11`

**Fix Strategy:**
1. Run audit: `npm run check:any-types > docs/any-violations-report.txt`
2. Prioritize platform/healthcare, platform/education, platform/finance
3. Fix iteratively, starting with entities/services
4. Target: < 100 violations in kernel code

---

### 3. RLS Policy Violations (P0.4)

**Files with USING(true) / WITH CHECK(true):**
- `supabase/migrations/20260512000000_fix_permissions.sql:8`
- `supabase/migrations/20260807100000_hospital_inpatient_his_baseline.sql:169`
- `supabase/migrations/20260801010000_real_estate_foundation_tables.sql:163`

**Fix:**
1. Audit all migrations for `USING (true)` pattern
2. Replace with proper tenant isolation:
   ```sql
   USING (tenant_id = auth.uid() OR current_user IN ('service_role', 'postgres'))
   ```
3. Document exceptions with security justification

---

### 4. CSP Hardening (P1.4)

**Current CSP (next.config.ts:17):**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:
```

**Issues:**
- `unsafe-inline` allows inline scripts (XSS risk)
- `unsafe-eval` allows eval() (code injection risk)
- `blob:` for workers is OK

**Files using dangerouslySetInnerHTML:**
- `src/app/dashboard/settings/components/SecurityTab.tsx:328`

**Fix:**
1. Add nonce-based CSP for inline scripts
2. Remove `unsafe-eval` if not needed by dependencies
3. Audit all `dangerouslySetInnerHTML` usage
4. Consider Content-Security-Policy-Report-Only mode first

---

## ✅ Already Fixed

- ✅ P0.1: Debug API routes deleted (`src/app/api/debug/`)
- ✅ P0.2: Migration sync (local ↔ remote)
- ✅ P0.3: F5 migrations marked as applied
- ✅ P1.1: Build type-check enabled (`next.config.ts`)

---

## 📋 Next Steps

1. **Immediate (today):**
   - Document healthcare mock contract replacement strategy
   - Create ticket for audit contract injection

2. **This week:**
   - Run full `any` type audit
   - Fix top 50 critical violations in healthcare/finance kernels
   - RLS policy audit script

3. **This sprint:**
   - Complete CSP hardening
   - Remove all mock contracts
   - Achieve < 100 `any` violations in kernel code
