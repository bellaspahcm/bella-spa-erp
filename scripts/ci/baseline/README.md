## Identity-Aware No-New-Debt Baseline System

**Purpose:** Distinguish inherited technical debt from newly introduced violations in CI.

**Core Principle:** `NEW = CURRENT - BASELINE`

---

### Architecture

```
┌─────────────────────────────────────────────────┐
│            BASELINE SYSTEM                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐                               │
│  │  Tool Output │  (tsc, eslint, jest, etc.)   │
│  └──────┬───────┘                               │
│         │                                        │
│         ▼                                        │
│  ┌──────────────┐                               │
│  │   Adapters   │  (parse → stable fingerprint) │
│  └──────┬───────┘                               │
│         │                                        │
│         ▼                                        │
│  ┌──────────────┐                               │
│  │  Findings[]  │  (with stable identities)     │
│  └──────┬───────┘                               │
│         │                                        │
│         ▼                                        │
│  ┌──────────────┐                               │
│  │  Comparator  │  (NEW = CURRENT - BASELINE)   │
│  └──────┬───────┘                               │
│         │                                        │
│         ▼                                        │
│  ┌──────────────┐                               │
│  │    Policy    │  (4 enforcement strategies)   │
│  └──────┬───────┘                               │
│         │                                        │
│         ▼                                        │
│    PASS / BLOCK                                 │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

### Key Concepts

**Stable Fingerprint:**
- Primary identity of a finding
- Survives: line movement, whitespace changes, file reformatting
- Changes when: semantic meaning changes, symbol changes, failure reason changes
- NOT based on line/column (those are display-only metadata)

**Policy Layers:**

1. **Zero-Tolerance:** Any violation blocks (no historical tolerance)
2. **No-New-Debt:** Existing allowed, new blocked, resolved → ratchet opportunity
3. **No-New-Debt-With-Reason:** + failure reason in identity (for Jest)
4. **Conditional-Grandfathering:** Modified migrations strict, unchanged + baseline = allow

---

### Usage

#### Generate Baseline (from clean main)

```bash
git checkout main
git pull
node scripts/ci/baseline/generate-baseline.ts --output .github/ci/baselines/main.json
git add .github/ci/baselines/main.json
git commit -m "chore: generate baseline for identity-aware no-new-debt"
```

#### Compare PR Against Baseline (in CI)

```bash
node scripts/ci/baseline/compare-with-baseline.ts \
  --baseline .github/ci/baselines/main.json \
  --pr-base origin/main \
  --pr-head HEAD
```

Exit codes:
- `0`: All policies pass
- `1`: One or more policies block
- `2`: Error in execution

#### Ratchet Baseline (when debt decreases)

```bash
# Preview ratchet opportunities
node scripts/ci/baseline/ratchet-governance.ts --preview

# Apply ratchet (manual review required)
node scripts/ci/baseline/ratchet-governance.ts --apply

# View audit history
node scripts/ci/baseline/ratchet-governance.ts --audit
```

⚠️ **NEVER auto-commit baseline updates in CI**

---

### Fingerprint Design

**TypeScript:**
```
ts:{file}:{code}:{symbol}:{message_sig}
```
- `code`: TS2353, TS2322, etc.
- `symbol`: Variable/property name
- `message_sig`: Semantic hash of error message

**ESLint:**
```
eslint:{file}:{rule_id}:{context}
```
- `rule_id`: react/no-unescaped-entities, etc.
- `context`: AST context hash

**Jest:**
```
jest:{suite}:{test}:{failure_reason_hash}
```
- `suite`: Full test suite path
- `test`: Test name
- `failure_reason_hash`: **CRITICAL** - captures failure semantics

**Migration:**
```
migration:{migration_id}:{rule}:{object}
```
- `migration_id`: 20260511500000
- `rule`: blocking-index, missing-concurrently
- `object`: Table/index/column name

---

### Adversarial Verification

8 scenarios MUST PASS before production use:

1. ✅ Line shift → ALLOW
2. ✅ New error → BLOCK
3. ✅ Same test, new cause → BLOCK
4. ✅ Unchanged migration + baseline → ALLOW
5. ✅ Modified migration → STRICT BLOCK
6. ✅ Resolved debt → ALLOW + ratchet
7. ✅ Debt laundering (swap violations) → BLOCK
8. ✅ Same code, different semantic → BLOCK

Run tests:
```bash
npm test -- tests/baseline/adversarial-verification.test.ts
```

---

### Files

**Core:**
- `schema.ts` - Type definitions
- `fingerprint.ts` - Stable fingerprint generation
- `comparator.ts` - Comparison logic + policy enforcement

**Adapters:**
- `adapters/typescript-adapter.ts` - Parse tsc output
- `adapters/eslint-adapter.ts` - Parse eslint JSON
- `adapters/jest-adapter.ts` - Parse jest JSON
- `adapters/migration-adapter.ts` - Parse migration check + PR-relative grandfathering

**Tools:**
- `generate-baseline.ts` - Create baseline from current state
- `compare-with-baseline.ts` - Compare + apply policy (CI usage)
- `ratchet-governance.ts` - Manage baseline updates

**Tests:**
- `tests/baseline/adversarial-verification.test.ts` - 8 critical scenarios

**CI:**
- `.github/workflows/baseline-no-new-debt.yml` - GitHub Actions integration

**Data:**
- `.github/ci/baselines/main.json` - Current baseline
- `.github/ci/baselines/ratchet-audit.json` - Audit history

---

### Design Principles

1. **Fingerprint Stability:** Survives refactoring, not semantic changes
2. **Policy Clarity:** Each scope has explicit enforcement rules
3. **No Auto-Update:** Baselines are sacred, require manual review
4. **Audit Trail:** All ratchets recorded with rationale
5. **PR-Relative:** Migration policy based on PR changes, not baseline age
6. **Adversarial Verification:** Prove system correctness before enforcement

---

### Why This Exists

**Problem:** CI blocked clean PR #116 (Logistics hardening) due to pre-existing debt in unrelated scopes.

**Root Cause:** CI lacked ability to distinguish:
- Historical debt (inherited)
- New debt (introduced by PR)

**Solution:** Identity-aware baseline system that:
- Fingerprints findings with stable identities
- Compares: `NEW = CURRENT - BASELINE`
- Blocks only new violations
- Allows historical debt to be fixed incrementally

**Result:**
- Clean scopes can merge without waiving CI
- Technical debt can only decrease, never increase
- No bypass mechanisms needed
- Factory improved for all future PRs

---

### References

- **Architecture Decision:** Option B - Build infrastructure first
- **User Decision:** "Không bypass CI để đưa một scope sạch vào main. Ta đang sửa Factory."
- **Policy:** PR-relative migration ownership, not baseline commit age
- **Gate:** I8 adversarial verification MUST PASS before I9 CI integration
