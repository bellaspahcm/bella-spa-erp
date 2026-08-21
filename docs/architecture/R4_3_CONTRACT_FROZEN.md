# R4.3 — Execution Contract FROZEN

**Date:** 2026-08-20  
**Status:** 🟢 FROZEN  
**Version:** 1.0.0  
**Contract:** `docs/architecture/R4_3_EXECUTION_CONTRACT_SPECIFICATION.md`  

---

## Freeze Declaration

R4.3 Execution Contract is hereby **FROZEN** and ready for implementation.

**Contract covers:**
- Execution boundary invariants (E1-E6)
- Gate token specification
- Approval state machine
- Transaction semantics
- Security boundaries

---

## Frozen Decisions

### Q1: Gate Token Storage
**Decision:** ✅ **B — Database**  
**Rationale:** Persistent audit trail, single-use enforcement, no external dependencies  

### Q2: Approval State Machine
**Decision:** ✅ **C — EXECUTION_FAILED state**  
**Rationale:** Clear failure tracking, no approval revert, explicit retry authorization required  

### Q3: Gate Token Signing Key
**Decision:** ✅ **B — Secrets Manager**  
**Rationale:** Independent security boundary, not leaked with environment credentials  
**Production Requirement:** MUST use secrets manager (not .env)  

### Q4: Execution Rollback
**Decision:** ✅ **A — PostgreSQL Transaction (with limitations)**  
**Rationale:** Rollback compatible migrations automatically  
**Limitation:** Not all DDL is transactional; manual remediation may be needed  

---

## Execution Invariants

### E1: No Direct Executor Access
bella_migration_executor credential MUST NOT be directly accessible to developers.

**Enforcement:** Executor credential not in developer .env, only accessible through execution gate.

### E2: Gate Result Binding
Gate token MUST cryptographically bind ALL security-critical fields:
- approval_id, migration_id, migration_hash
- target_environment, target_schema
- executor_identity, execution_attempt_id
- issued_at, expires_at, nonce

**Signing:** Secrets manager key (Q3)  
**Storage:** Database, single-use (Q1)  
**Validation:** Executor independently verifies token + bindings  

### E3: Fail-Closed Execution
ANY error in gate verification MUST block execution.

**Never fail open.** Execution is privilege, not default.

### E4: Atomic Execution
State machine: `APPROVED → EXECUTING → EXECUTED | EXECUTION_FAILED`

**Transaction:** BEGIN → Execute → COMMIT | ROLLBACK (Q4)  
**Limitation:** Some DDL may not rollback cleanly  

### E5: Audit Trail Immutability
ALL gate decisions and execution attempts MUST be logged immutably (append-only).

### E6: Environment Isolation
Production executor MUST NOT be accessible from non-production environments.

---

## Security Boundary

```
Developer
   ↓
Migration File
   ↓
Compute Hash
   ↓
verifyApproval() [R4.2 - 8 invariants]
   ↓
Gate Token Generation [signed by secrets manager]
   ↓
Gate Token Storage [database, single-use]
   ↓
Executor Validation [independent token verification]
   ↓
bella_migration_executor [mutation]
   ↓
Production
```

**Critical:** Each layer independently validates. No bypass at any layer.

---

## Attack Vectors Prevented

| Attack | Prevention |
|--------|------------|
| Direct executor access | E1: Credential not exposed |
| Token forgery | E2: Secrets manager signing key |
| Token replay | E2: Nonce + single-use database check |
| Token substitution | E2: Migration hash binding |
| Environment confusion | E6: Environment match validation |
| Approval reuse | R4.2 I3 + E4: Single-use, state machine |
| Tampered migration | R4.2 I1: Hash mismatch detection |
| Unauthorized approver | R4.2 I6: Authority matrix |

---

## Implementation Requirements

### Database Schema
Must add:
1. `bella_gate_tokens` table (Q1 decision)
2. `execution_failed` status to `bella_migration_approval` (Q2 decision)

### Execution Wrapper
Must implement:
1. `scripts/bdgf/execute-migration.mjs`
   - Load migration file
   - Compute hash
   - Call verifyApproval()
   - Generate gate token (signed)
   - Store gate token (database)
   - Connect to bella_migration_executor
   - Validate gate token
   - Execute in transaction
   - Update approval state
   - Log audit trail

### Gate Token Module
Must implement:
1. `scripts/bdgf/gate-token.mjs`
   - `generateToken()` - sign with secrets manager key
   - `validateToken()` - verify signature, expiry, single-use
   - `consumeToken()` - mark token used in database

### Secrets Manager Integration
Must support:
1. Development: `.env` with `GATE_SIGNING_KEY` (warning: insecure)
2. Production: Secrets manager API (AWS, Vault, etc.)

---

## Testing Requirements

### Positive Tests
1. ✅ Valid approval + valid token → execute successfully
2. ✅ Approval state: `approved` → `executing` → `executed`
3. ✅ Transaction COMMIT on success
4. ✅ Audit log records execution

### Negative Tests (Bypass Detection)
1. ❌ No approval → BLOCK
2. ❌ Expired approval → BLOCK
3. ❌ Wrong environment → BLOCK
4. ❌ Hash mismatch → BLOCK
5. ❌ Token replay → BLOCK (nonce check)
6. ❌ Invalid token signature → BLOCK
7. ❌ Expired token → BLOCK (60s TTL)
8. ❌ Token for different migration → BLOCK (hash binding)
9. ❌ Direct executor access → BLOCKED (credential not available)
10. ❌ Unauthorized approver → BLOCK

### Regression Test
- ✅ R3 baseline still locked (3/3 authorities closed)

---

## Definition of Done

R4.3 is COMPLETE when:

1. ✅ Contract frozen (this document)
2. ✅ Database schema deployed (`bella_gate_tokens` table)
3. ✅ Execution wrapper implemented
4. ✅ Gate token module implemented
5. ✅ Secrets manager integration implemented
6. ✅ 10 negative bypass tests BLOCK
7. ✅ 1 positive test PASS
8. ✅ R3 regression test PASS
9. ✅ Audit trail verified
10. ✅ Evidence documented

**Critical Test:**
> Developer attempts to execute migration without passing gate → BLOCKED (no executor credential access)

---

## Compliance with R4.1 and R4.2

**R4.1 (Approval Contract):** ✅ 8 invariants (I0-I7) enforced by verifyApproval()  
**R4.2 (Approval Gate):** ✅ 25/25 tests PASSED, verification logic complete  
**R4.3 (Execution Gate):** 🟡 Contract frozen, implementation pending  

**Relationship:**
- R4.1 defines WHAT is a valid approval
- R4.2 proves approval verification works
- R4.3 proves execution requires valid approval (enforcement, not just verification)

---

## Next Steps

1. **Implement database schema** (bella_gate_tokens table, execution_failed status)
2. **Implement gate token module** (sign, validate, consume)
3. **Implement execution wrapper** (execute-migration.mjs)
4. **Write bypass tests** (10 negative scenarios)
5. **Run E2E test** (request → approve → execute)
6. **Document evidence** (R4_3_TEST_RESULTS.md)
7. **Mark R4.3 COMPLETE**

---

**Contract Frozen:** 2026-08-20  
**Implementation Start:** 2026-08-20  
**Expected Completion:** TBD  

**Frozen by:** Human architect decision (Q1-Q4) + AI contract formalization  
**Approved for implementation:** ✅ YES
