# F5 Implementation Constraints

**Effective Date:** August 16, 2026  
**Baseline Checkpoint:** Commit `48e56477` / `1cf10c39`  
**Status:** 🔓 **F5 CLEARED TO RESUME**

---

## ⚠️ MANDATORY CONSTRAINTS

All F5 implementation MUST preserve the established security baseline.

### 1. Baseline is Immutable

**The following metrics MUST remain at baseline or better:**

| Metric | Baseline | Constraint |
|--------|----------|------------|
| Production `any` types | **0** | ❌ CANNOT INCREASE |
| RLS regressions | **0** | ❌ CANNOT REGRESS |
| Contract violations | **0** | ❌ CANNOT VIOLATE |
| Build bypass flags | **0** | ❌ CANNOT ENABLE |
| TypeScript errors | **0** | ❌ CANNOT INTRODUCE |

**Enforcement:** CI will FAIL and block PR on any violation.

**No exceptions:** Do NOT create `@approved-any` comments or disable checks just to make CI pass.

**If you need an exception:** Escalate to architect for explicit approval and document rationale.

---

### 2. DEMO-MODE Evolution Path

**Current state (ACCEPTED):**
```
DEMO_MODE = true
    ↓
Mock clinical fixtures
    ↓
UI development
```

**Target architecture:**
```
DEMO_MODE = true
    ↓
E2E Seed Tenant Migration
    ↓
PostgreSQL (with real data structure)
    ↓
RLS (enforced)
    ↓
Healthcare Kernel H1-H12
    ↓
Public Contracts
    ↓
UI Components
```

**Timeline:**
- ✅ Current: Mock fixtures permitted (build phase)
- 🔜 Next sprint: Create E2E seed tenant migration
- 🎯 Pilot: Disable DEMO_MODE, use real Kernel contracts
- 🚀 Production: Zero mock data, full provenance chain

**Action items (backlog, NOT blocking F5):**
1. Create `migrations/seeds/demo-tenant.sql` with synthetic but realistic data
2. Seed data flows through Kernel contracts (not direct UI access)
3. Add `DEMO_MODE` environment flag (default: false in production)
4. Create empty-state UI components for zero-data scenarios
5. Document transition plan for pilot customers

**Rationale:** Mock fixtures are development scaffolding, not production architecture. Evolution to seed migrations maintains RLS/contract boundaries while enabling realistic E2E testing.

---

### 3. No Scope Creep Beyond P1-B

**P1-B scope (CLOSED/PASS):**
- ✅ Production type safety
- ✅ RLS tenant isolation
- ✅ Contract boundary enforcement
- ✅ Build integrity
- ✅ Migration integrity

**Explicitly OUT OF SCOPE for P1-B:**
- ❌ Comprehensive penetration testing
- ❌ Full CSRF/XSS audit
- ❌ Dependency vulnerability scanning
- ❌ DDoS/rate limiting implementation
- ❌ Secrets management audit
- ❌ Infrastructure security hardening
- ❌ HIPAA compliance certification
- ❌ SOC2 audit preparation

**These are future work items, NOT P1-B blockers.**

**Important disclaimer:**
> P1-B PASS does not constitute a comprehensive security audit, penetration test, or regulatory compliance certification.

**If security issues arise during F5:**
- Document in backlog as separate tickets
- Do NOT block F5 for issues outside P1-B scope
- Prioritize based on risk assessment
- Schedule dedicated security sprint if needed

**Scope creep prevention:** Security gate will NEVER close if we keep expanding requirements. P1-B addressed defined architectural invariants. Future security work follows separate planning.

---

## CI/CD Enforcement

### Pre-commit Hook (Optional but Recommended)
```bash
cp .git-hooks/pre-commit.example .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Catches violations before commit (instant feedback).

### GitHub Actions (Required for main/develop)
```bash
mv .github/workflows/security-gate.yml.example .github/workflows/security-gate.yml
```

Blocks PR merge on violations.

### Manual Check
```bash
npm test -- production-runtime-integrity
npm run type-check
```

Run before pushing to verify compliance.

---

## Violation Response Protocol

### If CI Fails on Your PR

**Step 1: Identify violation**
```bash
# Run locally to see full output
npm test -- production-runtime-integrity
```

**Step 2: Fix the violation**
- New `any` type → Replace with proper type or `unknown`
- RLS regression → Restore tenant isolation policy
- Contract violation → Route through Kernel contracts
- TypeScript error → Fix type issue

**Step 3: Verify fix**
```bash
npm test -- production-runtime-integrity
npm run type-check
```

**Step 4: Push fix**
```bash
git add .
git commit -m "fix: resolve security gate violation"
git push
```

### If You Need an Exception

**DO NOT bypass checks without approval.**

**Process:**
1. Document why violation is unavoidable
2. Propose mitigation strategy
3. Escalate to architect for review
4. If approved: Add `@approved-any` comment with:
   - `reason`: Why needed
   - `owner`: Who approved
   - `expiry`: When to revisit (YYYY-MM-DD)

**Example:**
```typescript
// @approved-any reason="Third-party library requires any" owner="architect@bella.com" expiry="2027-01-01"
const result: any = externalLib.getData();
```

---

## Baseline Verification

### Check Current Status
```bash
# Run all invariant tests
npm test -- production-runtime-integrity

# Expected output:
# Test Suites: 1 passed, 1 total
# Tests:       8 passed, 8 total
```

### Verify Baseline Metrics
```bash
# Count production any types (should be 0)
git diff 48e56477..HEAD -- 'src/platform/**/*.ts' 'src/platform/**/*.tsx' | grep -c ": any"

# Check RLS policies (should be 9 for Healthcare)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_policies WHERE tablename LIKE 'hc_%';"
```

---

## F5 Team Responsibilities

✅ **DO:**
- Run invariant tests before every PR
- Fix violations immediately (don't accumulate)
- Ask for help if unclear how to fix
- Report suspected false positives
- Suggest improvements to invariant tests

❌ **DON'T:**
- Disable checks to make CI pass
- Use `@ts-ignore` or `@ts-expect-error` without justification
- Bypass pre-commit hooks habitually
- Introduce new `any` types
- Access `hc_*` tables directly from UI
- Modify RLS policies without architect review

---

## References

- **Security Reconciliation Report:** `docs/security/SECURITY_RECONCILIATION_2026-08-16.md`
- **Invariant Test Suite:** `src/__tests__/invariants/production-runtime-integrity.test.ts`
- **Healthcare Constitution:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
- **Education Constitution:** `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`
- **CI Workflow:** `.github/workflows/security-gate.yml.example`
- **Pre-commit Hook:** `.git-hooks/pre-commit.example`

---

## Questions?

**Security gate violation?**  
Run `npm test -- production-runtime-integrity` and read error output.

**Need exception approval?**  
Escalate to architect with documented rationale.

**Found security issue outside P1-B scope?**  
Create backlog ticket, don't block F5.

**Invariant test seems wrong?**  
Raise in team channel, architect will review.

---

**Status:** 🔓 **F5 CLEARED with documented constraints**

**Remember:** These constraints protect the security baseline achieved in P1-B. They exist to maintain quality, not to block progress. If constraints seem unreasonable, discuss with team rather than bypassing.
