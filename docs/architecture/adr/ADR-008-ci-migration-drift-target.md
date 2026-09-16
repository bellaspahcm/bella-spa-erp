# ADR-008: CI Migration Drift Check Target Environment

**Date:** 2026-09-16  
**Status:** Proposed  
**Context:** PR #115 Gate 3 blocked by undefined `SUPABASE_DB_URL` target

---

## Context

PR CI workflow (`ci-tests.yml`) runs migration drift check using `secrets.SUPABASE_DB_URL`, but the repository does not document which database environment this should verify against:

- Production database (live BabyCare data)
- Staging/E2E database (controlled test environment)
- Unconfigured (drift-skip pattern)

Historical evidence shows "empty remote drift-skip" pattern, suggesting this secret was intentionally left unconfigured or pointed to empty database.

## Problem

**PR #115** migration drift check fails with authentication error:
```
failed to connect to postgres: password authentication failed
```

Root cause: `SUPABASE_DB_URL` secret exists but contains invalid/expired credentials.

**Ambiguous design:**
- Production deploy uses `PRODUCTION_SUPABASE_DB_URL`
- Staging deploy uses `STAGING_SUPABASE_DB_URL`  
- PR CI uses generic `SUPABASE_DB_URL` (target undefined)

## Decision

**PR CI migration drift check target: Controlled E2E/Staging Database**

### Rationale

1. **Separation of Concerns**
   - PR CI validates: "Migration compatible with test baseline?"
   - Production gate validates: "Migration safe for production state?"

2. **Security**
   - PR CI should not require production database credentials
   - Production access limited to deployment workflows only

3. **Verification History**
   - Beauty OS H8 runtime-verified on E2E database `bmnbqbcdbuklhopfbopv`
   - Migration already proven on controlled environment

4. **Deployment Gate Exists**
   - Production deploy workflow already checks `PRODUCTION_SUPABASE_DB_URL`
   - Production drift verification happens at deployment time

### Implementation

**Phase 1: Policy Documentation** (this ADR)

**Phase 2: Workflow Contract Clarification**

Update `.github/workflows/ci-tests.yml`:

```yaml
# BEFORE (ambiguous)
- name: Supabase migration drift
  env:
    SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
  run: npm run db:migration:check

# AFTER (explicit)
- name: Supabase migration drift (E2E baseline)
  env:
    SUPABASE_DB_URL: ${{ secrets.E2E_SUPABASE_DB_URL }}
  run: npm run db:migration:check
```

**Phase 3: Update GitHub Secrets**

Either:
- A) Set `SUPABASE_DB_URL` = value of `E2E_SUPABASE_DB_URL` (maintain generic name)
- B) Use `E2E_SUPABASE_DB_URL` directly in workflow (explicit name)

Recommendation: **Option B** for clarity.

### Migration Verification Flow

```text
PR #115
   ├─ Zero-downtime policy check        ✅ (local analysis)
   ├─ E2E migration drift check         → E2E_SUPABASE_DB_URL
   └─ Merge to main

Deployment Gate 4-7 (Manual)
   ├─ Production backup
   ├─ Production migration preflight    → PRODUCTION_SUPABASE_DB_URL
   ├─ Apply migration to production
   └─ Production smoke tests
```

## Consequences

### Positive

- ✅ Clear separation: PR validation vs Production safety
- ✅ Reduced production credential exposure
- ✅ Aligns with existing runtime verification (E2E)
- ✅ Production drift still checked at deployment time

### Negative

- ⚠️ PR CI won't detect production-specific drift (by design)
- ⚠️ Requires E2E database to be maintained with migration history
- ⚠️ Must ensure E2E database stays representative of production schema

### Risks Mitigated

- ❌ **Not chosen:** Production DB credentials in PR CI
- ❌ **Not chosen:** Disable drift check entirely (drift-skip)
- ✅ **Chosen:** Staged verification with environment-appropriate credentials

## Rejected Alternatives

### Option A: Production Database

**Rejected because:**
- Requires production credentials in generic PR workflow
- Violates least-privilege principle
- Production deploy already has dedicated gate
- No documented governance policy requiring this

### Option C: Leave Unconfigured (Drift-Skip)

**Rejected because:**
- Migration drift is now a required gate
- Historical drift-skip was infrastructure limitation, not design
- Weakens migration safety without justification

## Validation

**This ADR unblocks PR #115 when:**

1. ADR approved by repository owner
2. Workflow updated to use `E2E_SUPABASE_DB_URL`
3. Secret verified to contain valid E2E database credentials
4. PR CI rerun shows migration drift check PASS

**Production safety remains protected by:**
- Gate 5: Production migration preflight using `PRODUCTION_SUPABASE_DB_URL`
- Manual deployment trigger (no auto-deploy)
- Required backup before migration apply

## References

- Original spec: `docs/implementation-artifacts/spec-add-supabase-migration-drift-check.md`
- PR #115: Beauty OS Foundation Complete + Haircut RC + Nail RC
- Migration file: `supabase/migrations/20260916000000_beauty_os_h8_persistence.sql`
- E2E verification: `docs/architecture/BEAUTY_OS_FOUNDATION_COMPLETE.md`

---

**Authority:** CI/CD Policy  
**Scope:** PR migration verification target  
**Approval Required:** Repository owner / DevOps governance
