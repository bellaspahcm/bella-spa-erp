# Phase 4B.3 — Implementation Evidence Test Suite

**Contract:** P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544) 🔒 IMMUTABLE  
**Implementation:** commit 9a2494a5  
**Test Evidence Baseline:** commit ab135cea

## Objective

Execute T1-T7 scenarios on **actual implementation** and prove:
- 7/7 expected outcomes match actual outcomes
- Evidence artifacts from actual implementation (not copied from ab135cea)
- Deployment blocking proven (T2/T3/T5/T6)
- Contract 37ae4544 unchanged (SHA256 verified)

## Test Structure

```
test/phase4b3/
├── README.md                    (this file)
├── fixtures/
│   ├── t1-happy-path.sql        (correct RLS + structure)
│   ├── t2-rls-missing.sql       (security violation)
│   ├── t3-deletion.sql          (drift detection)
│   ├── t4-additive.sql          (platform expansion)
│   ├── t5-unreachable.ts        (connection failure)
│   ├── t6-type-mismatch.sql     (declaration ≠ actual)
│   └── t7-no-declaration.sql    (OPC principle)
├── declarations/
│   ├── t1-declaration.yaml
│   ├── t2-declaration.yaml
│   ├── t6-declaration.yaml
│   └── t7-no-declaration.yaml   (empty)
├── run-tests.ts                 (execution runner)
├── verify-evidence.ts           (evidence integrity checker)
└── verify-contract.ts           (immutability checker)
```

## Prerequisites

1. **RPC Functions Deployed:**
   ```bash
   supabase db push
   # Applies: supabase/migrations/20260825120000_phase4b3_verification_rpc.sql
   ```

2. **Environment Variables:**
   ```bash
   export TEST_DATABASE_URL="postgresql://..."
   export DATABASE_EXECUTOR_SERVICE_ROLE_KEY="..."
   ```

3. **Test Database Clean:**
   ```bash
   # Drop test tables if exist
   DROP TABLE IF EXISTS test_hc_appointments CASCADE;
   DROP TABLE IF EXISTS test_hc_patient_notes CASCADE;
   # ... (other test tables)
   ```

## Execution

### Run All Tests
```bash
npm run test:phase4b3
# Runs: ts-node test/phase4b3/run-tests.ts
```

### Run Individual Test
```bash
npm run test:phase4b3:t1  # T1: Happy Path
npm run test:phase4b3:t2  # T2: RLS Missing
# ...
```

### Verify Evidence Integrity
```bash
npm run test:phase4b3:verify-evidence
# Checks artifact provenance, compares with ab135cea
```

### Verify Contract Immutability
```bash
npm run test:phase4b3:verify-contract
# SHA256 hash check of Contract 37ae4544
```

## Expected Outcomes (from Test Evidence ab135cea)

| Test | Expected Result | Deployment | Critical Check |
|------|-----------------|------------|----------------|
| T1 | PASS | ✅ ELIGIBLE | RLS enabled, structure correct |
| T2 | FAIL | ❌ BLOCKED | RLS missing (CRITICAL) |
| T3 | FAIL | ❌ BLOCKED | Unexpected deletion (CRITICAL) |
| T4 | WARNING | ✅ ELIGIBLE | Additive non-security |
| T5 | ERROR | ❌ BLOCKED | DB unreachable (fail-closed) |
| T6 | FAIL | ❌ BLOCKED | Type mismatch (declaration ≠ proof) |
| T7 | WARNING | ✅ ELIGIBLE | No declaration (OPC principle) |

## Gate Pass Criteria

✅ 7/7 tests executed successfully  
✅ Expected outcomes = Actual outcomes (7/7)  
✅ Evidence artifacts from implementation 9a2494a5  
✅ Deployment blocking proven (T2/T3/T5/T6)  
✅ OPC principle preserved (T7)  
✅ Contract 37ae4544 unchanged (SHA256 verified)  
✅ No scope expansion beyond Contract  

**If ALL criteria PASS → Certificate ELIGIBLE**

## Evidence Artifacts

Each test generates:
- `artifacts/verification/impl-t{N}-{timestamp}.json` — Verification result
- DB record in `migration_governance.verification_results`

## Provenance Verification

Evidence must prove it's from implementation 9a2494a5:
```typescript
// Each artifact must contain
{
  "verification_id": "impl-t1-...",  // Prefix distinguishes from Test Evidence
  "implementation_commit": "9a2494a5",
  "contract_version": "1.0.0",
  "contract_commit": "37ae4544",
  // ...
}
```

## Contract Immutability Check

```bash
# Verify Contract unchanged
git show 37ae4544:docs/architecture/P0_3_PHASE4B_3_CONTRACT.md | sha256sum
git show HEAD:docs/architecture/P0_3_PHASE4B_3_CONTRACT.md | sha256sum
# Hashes MUST match
```

## Deployment Consequence Proof (T2/T3/T5/T6)

Each FAIL/ERROR test must prove:
```
Verification FAIL/ERROR
    ↓
result.deployment_eligible = false
    ↓
CI job: migrate-database FAILURE (exit code 1)
    ↓
CI job: promote SKIPPED (needs failed)
    ↓
Deployment: BLOCKED ✅
```

## OPC Principle Verification (T7)

T7 must prove:
```
No Declaration
    ↓
Expected State = Contract Invariants ONLY
    ↓
NO inference from actual DB state
    ↓
Security verified independently
    ↓
WARNING (incomplete verification, not PASS)
    ↓
Deployment ELIGIBLE (security satisfied)
```

## Troubleshooting

### Test Fails: "RPC function not found"
```bash
# Deploy RPC functions
supabase db push
```

### Test Fails: "Cannot connect to database"
```bash
# Check environment variables
echo $TEST_DATABASE_URL
echo $DATABASE_EXECUTOR_SERVICE_ROLE_KEY
```

### Evidence Mismatch
```bash
# Compare with Test Evidence baseline
diff artifacts/verification/impl-t1-*.json test-evidence/v-t1-*.json
```

## Next Steps After 7/7 PASS

1. Review Implementation Evidence document
2. Verify all gate criteria satisfied
3. Generate Phase 4B.3 Certificate
4. Freeze Implementation Evidence document

---

**Status:** 🟡 Test suite framework ready, fixtures pending creation
