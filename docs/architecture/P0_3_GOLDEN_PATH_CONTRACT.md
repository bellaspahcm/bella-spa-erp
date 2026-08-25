# P0.3 GOLDEN PATH CONTRACT

**Contract Version:** 1.0.0  
**Status:** FROZEN ❄️  
**Phase:** Phase 2 — Contract Definition  
**Immutable After:** Phase 7 (Production Lock)

---

## 🎯 CONTRACT OBJECTIVE

**Define the ONLY authorized mechanism for production deployment.**

This contract specifies:
- **WHAT** the system must guarantee (not HOW to implement)
- **Inputs and outputs** for each step
- **Failure modes** and rollback behavior
- **Invariants** that must hold at all times

**Any deployment not conforming to this contract is UNAUTHORIZED.**

---

## 🔒 FIVE IMMUTABLE PRINCIPLES

### Principle 1: FAIL CLOSED

**Rule:** When in doubt, BLOCK deployment.

**Enforcement:**
- Cannot determine change type → **BLOCK**
- Cannot verify migration safety → **BLOCK**
- Missing required secret → **BLOCK**
- Invalid gate token → **BLOCK**
- Verification fails → **BLOCK**
- Unknown state → **BLOCK**

**Rationale:** Production safety > deployment velocity. False negatives (unnecessary blocks) are acceptable. False positives (allowing unsafe changes) are FORBIDDEN.

### Principle 2: NO DATABASE ROLLBACK

**Rule:** Database migrations are forward-only.

**Enforcement:**
- Migration applied → **PERMANENT** (no automated rollback)
- Migration fails → **HALT** (do not deploy app, do not continue)
- Fix errors → **NEW FORWARD MIGRATION**

**Rationale:** Production database state is APPEND-ONLY history. Automatic rollback is ONLY allowed within a single transaction (before COMMIT). Once committed, rollback = new forward migration to correct the state, not schema rewind.

**Clarification:**
- **DURING transaction:** Failure → automatic rollback (PostgreSQL transaction behavior) → no changes committed
- **AFTER commit:** Changes are permanent → forward-only corrections required

### Principle 3: DATABASE BEFORE APPLICATION

**Rule:** Application deployment is conditional on database success.

**Enforcement:**
- Migration fails → **DO NOT DEPLOY APP**
- Migration succeeds → **VERIFY DB STATE** → Deploy app (conditional)
- App deployment fails → Database remains migrated (safe state, old app still serves)

**Order:**
```
1. Migrate Database
2. Verify Database State
3. Deploy Application (conditional on steps 1+2)
4. Smoke Test Application
5. Promote to Production (conditional on steps 1-4)
```

**Rationale:** Database is source of truth. Application can be redeployed. Database mutations are irreversible (forward-only).

### Principle 4: ZERO-KNOWLEDGE DEPLOYMENT

**Rule:** Developer/AI has ZERO access to production credentials.

**Enforcement:**
- No production secrets in repository code
- No production secrets in `.env` files
- No production secrets in documentation
- All production secrets in GitHub Environment Secrets only
- Secrets injected at runtime by Control Plane (GitHub Actions)
- Secrets masked in logs

**Developer/AI Knowledge Boundary:**
```
✅ ALLOWED: git push, git commit, code changes
❌ FORBIDDEN: DATABASE_EXECUTOR_URL, VERCEL_TOKEN, GATE_SIGNING_KEY, any production credential
```

**Rationale:** Credentials in AI context → compromise risk. Zero-knowledge = zero credential exposure.

### Principle 5: ALL BYPASSES ARE BREAK-GLASS

**Rule:** Manual/bypass paths are EMERGENCY ONLY, not normal deployment.

**Enforcement:**
- `psql` direct connection → **EMERGENCY ONLY** (must audit)
- Supabase SQL Editor → **EMERGENCY ONLY** (must audit)
- `supabase db push` → **EMERGENCY ONLY** (must audit)
- Direct Vercel CLI → **EMERGENCY ONLY** (must audit)
- Manual deployment scripts → **EMERGENCY ONLY** (must audit)

**Emergency Requirements:**
1. ⚠️ NOT NORMAL DEPLOYMENT
2. 👤 HUMAN AUTHORIZATION REQUIRED
3. 📝 MUST LOG TO AUDIT TRAIL
4. 🔍 POST-INCIDENT REVIEW REQUIRED

**Rationale:** Golden Path is default. Bypasses indicate control plane failure or emergency. All bypasses must be auditable and reviewed.

---

## 📋 TEN CONTRACT STEPS

### CONTRACT 1: ENTRY

**Guarantee:** `git push` is the ONLY entry point for production deployment.

**Input:**
```
git push origin main
  ↓
Commit SHA: abc123...
Branch: main
Changes: [file paths]
Author: user@example.com / AI agent
```

**Process:**
- GitHub receives push event
- Triggers Control Plane (GitHub Actions)

**Output:**
```
Deployment session initiated
Session ID: deploy-{timestamp}-{sha}
Status: STARTED
```

**Failure Modes:**
- Push to non-main branch → **IGNORE** (no production deployment)
- Invalid branch → **IGNORE**
- No changes → **IGNORE** (empty push)

**Idempotency:**
- Same commit pushed twice → **DEDUPLICATE** (only one deployment session)

**Invariants:**
- ✅ Every production deployment starts with `git push`
- ✅ No other entry point exists (no manual trigger, no API, no cron)

**Exception:** Manual `workflow_dispatch` trigger (human-authorized, must audit)

---

### CONTRACT 2: CHANGE DETECTION

**Guarantee:** System automatically detects change types and routes accordingly.

**Input:**
```
Commit SHA: abc123...
Changed files: [list of paths]
```

**Process:**
- Analyze changed files to determine change type

**Output:**
```
Change Classification:
  - application_code: true/false
  - database_migration: true/false
  - infrastructure_config: true/false
  - documentation_only: true/false

Routing Decision:
  - database_pipeline: true/false
  - application_pipeline: true/false
  - skip_deployment: true/false (docs-only)
```

**Classification Rules:**

| Change Type | Pattern | Pipeline |
|-------------|---------|----------|
| Database Migration | `supabase/migrations/*.sql` | Database Pipeline |
| Application Code | `src/**`, `app/**`, `pages/**`, `api/**` | Application Pipeline |
| Infrastructure | `.github/workflows/**`, `vercel.json` | Infrastructure Review |
| Documentation | `docs/**`, `*.md` (excluding root README) | Skip Deployment |
| Mixed | Any combination | Database Pipeline + Application Pipeline |

**Failure Modes:**
- Cannot classify change → **BLOCK** (Principle 1: Fail Closed)
- Unrecognized file pattern → **BLOCK** (require explicit classification)

**Idempotency:**
- Same commit always produces same classification

**Invariants:**
- ✅ Every deployment knows what changed
- ✅ Database changes trigger database pipeline
- ✅ Application changes trigger application pipeline
- ✅ Documentation-only changes skip deployment

---

### CONTRACT 3: VALIDATION

**Guarantee:** All changes pass automated validation gates before policy evaluation.

**Input:**
```
Change Classification: {application, database, infrastructure}
Commit SHA: abc123...
```

**Process:**
1. **Code Quality:** Linting, type-checking, formatting
2. **Unit Tests:** All unit test suites (target: 100% pass)
3. **Integration Tests:** Critical path integration tests
4. **Security Scan:** Secret leaks, dependency vulnerabilities
5. **Architecture Guard:** Frozen layer compliance (Healthcare H1-H12, Logistics E7.1-E7.3)

**Output:**
```
Validation Result:
  lint: PASS/FAIL
  type_check: PASS/FAIL
  unit_tests: PASS/FAIL (123/123)
  integration_tests: PASS/FAIL (45/45)
  security_scan: PASS/FAIL
  architecture_guard: PASS/FAIL
  
Overall Status: PASS/FAIL
Blocking Issues: [list if FAIL]
```

**Validation Gates:**

| Gate | Command | Failure = BLOCK |
|------|---------|-----------------|
| Lint | `npm run lint` | ✅ YES |
| Type Check | `npm run type-check` | ✅ YES |
| Unit Tests | `npm run test:unit` | ✅ YES |
| Integration Tests | `npm run test:integration` | ✅ YES |
| Critical Tests | `npm run test:critical` | ✅ YES |
| Security Audit | `npm run security:audit` | ✅ YES |
| Secret Scan | `npm run security:secrets` | ✅ YES |
| Architecture Guard (Healthcare) | `npm run healthcare:guard` | ✅ YES |
| Architecture Guard (Logistics) | `npm run arch:guard` | ✅ YES |

**Failure Modes:**
- Any gate fails → **BLOCK ENTIRE DEPLOYMENT**
- Test timeout → **BLOCK** (treat as failure)
- Gate execution error → **BLOCK** (Principle 1: Fail Closed)

**Idempotency:**
- Same commit always produces same validation result (deterministic tests)

**Invariants:**
- ✅ No deployment proceeds without passing ALL validation gates
- ✅ Architecture guard prevents frozen layer violations
- ✅ Security scan prevents credential leaks

---

### CONTRACT 4: MIGRATION SAFETY

**Guarantee:** Database migrations are analyzed for safety before execution.

**Input:**
```
Database Migrations: [list of new *.sql files]
Commit SHA: abc123...
Current DB State: {schema snapshot or version}
```

**Process:**
1. **Zero-Downtime Check:** Detect breaking changes (column drops, table drops, NOT NULL additions)
2. **RLS Invariant Check:** Detect RLS policy deletions or weakening
3. **Permission Check:** Detect privilege escalations or dangerous grants
4. **Dependency Check:** Detect circular dependencies or missing foreign key targets
5. **Idempotency Check:** Detect non-idempotent operations (e.g., `ALTER TABLE ADD COLUMN` without `IF NOT EXISTS`)

**Output:**
```
Migration Safety Analysis:
  zero_downtime: SAFE/UNSAFE
  rls_invariants: PRESERVED/VIOLATED
  permissions: SAFE/ESCALATION_DETECTED
  dependencies: RESOLVED/UNRESOLVED
  idempotency: IDEMPOTENT/NON_IDEMPOTENT
  
Overall Assessment: SAFE/UNSAFE
Blocking Issues: [list if UNSAFE]
Warnings: [list non-blocking issues]
```

**Safety Rules:**

| Check | Command | Failure = BLOCK |
|-------|---------|-----------------|
| Zero-Downtime | `npm run db:migration:zero-downtime -- --base HEAD^` | ✅ YES |
| Migration Validation | `npm run db:migration:check` | ✅ YES |

**Failure Modes:**
- Breaking change detected → **BLOCK** (provide fix suggestion)
- RLS policy removed → **BLOCK** (tenant isolation violation)
- Non-idempotent migration → **BLOCK** (provide idempotent rewrite)
- Cannot analyze migration → **BLOCK** (Principle 1: Fail Closed)

**Idempotency:**
- Same migration always produces same safety assessment

**Invariants:**
- ✅ No breaking changes reach production
- ✅ RLS policies are never weakened without explicit approval
- ✅ All migrations are idempotent (safe to retry)

---

### CONTRACT 5: BDGF POLICY

**Guarantee:** Every production mutation requires valid BDGF gate token.

**Input:**
```
Migration Content: {SQL DDL}
Migration Hash: sha256(content)
Target Environment: production
Target Schema: public
Executor Identity: bella_migration_executor
```

**Process:**
1. **Generate Gate Token:**
   - Hash migration content
   - Bind to execution context (environment, schema, executor)
   - Sign with `GATE_SIGNING_KEY`
   - Store in `bella_gate_tokens` table

2. **Record Approval:**
   - Automated approval for safe migrations (passed Contract 4)
   - Human approval for high-risk migrations (manual gate)
   - Store in `bella_gate_approvals` table

**Output:**
```
Gate Token:
  payload:
    nonce: {unique-id}
    migration_hash: {sha256}
    target_environment: production
    target_schema: public
    executor_identity: bella_migration_executor
    issued_at: {timestamp}
    expires_at: {timestamp + 1 hour}
  signature: {HMAC-SHA256}
  
Approval Record:
  approval_id: {unique-id}
  approval_type: automated | human
  approved_by: github-actions | human@example.com
  approved_at: {timestamp}
```

**Failure Modes:**
- Cannot generate gate token → **BLOCK** (missing GATE_SIGNING_KEY)
- Migration hash mismatch → **BLOCK** (content changed after approval)
- Expired token → **BLOCK** (must regenerate)
- Missing approval → **BLOCK** (require human approval)

**Idempotency:**
- Same migration + context → **NEW TOKEN** (nonce always unique, single-use)

**Invariants:**
- ✅ Every production mutation has gate token
- ✅ Gate token is cryptographically bound to migration content
- ✅ Gate token is single-use (consumed after execution)
- ✅ No token = no execution (enforced by migration-executor.mjs)

---

### CONTRACT 6: APPROVAL

**Guarantee:** System determines when human approval is required vs automated approval.

**Input:**
```
Migration Safety Assessment: {from Contract 4}
Change Classification: {from Contract 2}
Deployment Context: {environment, time, author}
```

**Process:**
- Evaluate approval policy rules

**Approval Policy:**

| Condition | Approval Type |
|-----------|---------------|
| Migration Safety = SAFE + Tests PASS + Architecture PASS | **AUTOMATED** |
| Migration Safety = UNSAFE | **BLOCK** (fix required, no approval) |
| Migration Safety = SAFE but WARNING (e.g., large data change) | **HUMAN REQUIRED** |
| Off-hours deployment (outside 9am-5pm) | **HUMAN REQUIRED** |
| High-risk tables touched (e.g., `users`, `tenants`, `billing`) | **HUMAN REQUIRED** |
| First deployment by new AI agent | **HUMAN REQUIRED** |

**Output:**
```
Approval Decision:
  approval_required: automated | human | blocked
  approval_reason: {reason if human required}
  approval_timeout: 1 hour (if human required)
  
If automated:
  approval_granted: true
  approved_by: github-actions
  approved_at: {timestamp}
  
If human:
  approval_pending: true
  approval_url: {GitHub Actions approval UI}
  notified: [list of approvers]
```

**Failure Modes:**
- Human approval times out → **BLOCK** (abort deployment)
- Human rejects → **BLOCK** (log reason, abort deployment)
- Cannot determine approval policy → **BLOCK** (Principle 1: Fail Closed)

**Idempotency:**
- Same migration + context → same approval decision

**Invariants:**
- ✅ Safe changes approved automatically (fast path)
- ✅ Risky changes require human review (safe path)
- ✅ Unsafe changes blocked regardless of approval (no override)

---

### CONTRACT 7: EXECUTION

**Guarantee:** Only `bella_migration_executor` role can mutate production database, and only via migration-executor.mjs with valid gate token.

**Input:**
```
Gate Token: {from Contract 5}
Migration Content: {SQL DDL}
Database Credentials: DATABASE_EXECUTOR_URL (injected at runtime)
```

**Process:**
1. **Validate Gate Token:**
   - Verify signature (cryptographic validation)
   - Verify binding (migration hash matches content)
   - Verify not expired
   - Verify not already consumed

2. **Consume Gate Token:**
   - Atomic single-use consumption (update `bella_gate_tokens` table)
   - If already consumed → BLOCK (replay attack prevention)

3. **Execute Migration:**
   - Connect to database as `bella_migration_executor`
   - Execute SQL in transaction (if DDL is transactional)
   - Commit on success, rollback on failure

4. **Record Execution:**
   - Log execution start/end in audit table
   - Log execution result (success/failure)
   - Log rows affected

**Output:**
```
Execution Result:
  status: SUCCESS | FAILED
  token_id: {consumed-token-id}
  rows_affected: {count}
  execution_time_ms: {duration}
  error: {error message if FAILED}
```

**Failure Modes:**
- Invalid gate token → **BLOCK** (gate validation failed)
- Token already consumed → **BLOCK** (replay attack)
- Token expired → **BLOCK** (regenerate token)
- Migration hash mismatch → **BLOCK** (content tampered)
- Database connection failed → **BLOCK** (retry with backoff)
- Migration execution failed DURING transaction → **ROLLBACK TRANSACTION** (no changes committed) + **BLOCK** (do not deploy app)
- Migration execution failed AFTER commit → **NO ROLLBACK** (changes already committed, forward-only) + **BLOCK APP DEPLOYMENT** (DB state may be inconsistent)

**Idempotency:**
- Same token → **CONSUMED ONCE** (single-use enforcement)
- Retry requires new token (new approval + new gate)

**Invariants:**
- ✅ Only bella_migration_executor can mutate production
- ✅ Every mutation has valid gate token
- ✅ Gate tokens are single-use (no replay)
- ✅ Execution is atomic (transaction where possible)

---

### CONTRACT 8: VERIFICATION

**Guarantee:** Database state is verified to meet invariants before application deployment.

**Input:**
```
Migration Execution Result: {from Contract 7}
Expected State: {schema snapshot or rules}
```

**Process:**
1. **Schema Verification:**
   - Verify expected tables exist
   - Verify expected columns exist
   - Verify expected indexes exist

2. **RLS Verification:**
   - Verify RLS enabled on all tenant-isolated tables
   - Verify RLS policies exist and match expected

3. **Permission Verification:**
   - Verify `bella_developer` has read-only permissions
   - Verify `bella_migration_executor` has mutation permissions
   - Verify no unexpected privilege escalations

4. **Data Integrity Verification:**
   - Verify foreign key constraints valid
   - Verify no orphaned records
   - Verify no constraint violations

**Output:**
```
Verification Result:
  schema: PASS/FAIL
  rls_policies: PASS/FAIL
  permissions: PASS/FAIL
  data_integrity: PASS/FAIL
  
Overall Status: PASS/FAIL
Violations: [list if FAIL]
```

**Verification Commands:**

| Check | Type | Failure = BLOCK |
|-------|------|-----------------|
| Schema existence | SQL query | ✅ YES |
| RLS enabled | SQL query (`SELECT * FROM pg_tables WHERE tablename = 'X' AND rowsecurity = true`) | ✅ YES |
| Permission check | SQL query (`SELECT * FROM information_schema.role_table_grants`) | ✅ YES |
| Constraint validation | SQL query (`SELECT * FROM information_schema.table_constraints`) | ✅ YES |

**Failure Modes:**
- Schema mismatch → **BLOCK** (migration incomplete or failed)
- RLS disabled → **BLOCK** (tenant isolation violated)
- Permission violation → **BLOCK** (security boundary violated)
- Data integrity violation → **BLOCK** (inconsistent state)
- Cannot verify → **BLOCK** (Principle 1: Fail Closed)

**Idempotency:**
- Same DB state → same verification result

**Invariants:**
- ✅ Database state matches expected schema
- ✅ RLS policies protect tenant isolation
- ✅ Permissions follow principle of least privilege
- ✅ No data integrity violations

**Principle Enforcement:**
- ✅ Principle 3 (Database Before Application): Verification MUST pass before app deployment

---

### CONTRACT 9: DEPLOYMENT

**Guarantee:** Application deploys to Vercel ONLY if database verification passes (Contract 8).

**Input:**
```
Database Verification Result: {from Contract 8}
Change Classification: {from Contract 2}
Commit SHA: abc123...
```

**Process:**
1. **Conditional Gate:**
   - IF database migration exists AND verification = FAIL → **BLOCK APP DEPLOYMENT**
   - IF database migration exists AND verification = PASS → **PROCEED**
   - IF no database migration → **PROCEED** (app-only change)

2. **Build Application:**
   - `npm run build` (Next.js production build)
   - Generate optimized bundle

3. **Deploy to Vercel:**
   - Deploy to Vercel preview environment (immutable preview URL)
   - Wait for deployment health check

4. **Smoke Test:**
   - Test critical paths: `/api/health`, authentication flow, database connectivity
   - Verify no breaking changes

5. **Promote to Production:**
   - Manual approval gate (GitHub Environment protection)
   - Promote preview URL to production domain
   - Monitor production health

**Output:**
```
Deployment Result:
  preview_url: https://{preview-id}.vercel.app
  preview_status: DEPLOYED | FAILED
  smoke_test: PASS | FAIL
  production_promoted: true | false
  production_url: https://bella-spa-erp.vercel.app
```

**Failure Modes:**
- Database verification failed → **BLOCK APP DEPLOYMENT** (Principle 3: Database Before Application)
- Build failed → **BLOCK DEPLOYMENT** (fix build errors)
- Deployment failed → **BLOCK PROMOTION** (Vercel error, retry)
- Smoke test failed → **BLOCK PROMOTION** (critical path broken, rollback or fix-forward)
- Promotion approval denied → **HALT** (preview remains, production unchanged)

**Idempotency:**
- Same commit → same build → same deployment (immutable preview URLs)

**Invariants:**
- ✅ Application never deployed if database verification fails
- ✅ Preview environment tested before production promotion
- ✅ Production promotion requires human approval
- ✅ Old application continues serving if new deployment fails (safe state)

---

### CONTRACT 10: AUDIT

**Guarantee:** Every deployment (success or failure) is recorded with full provenance.

**Input:**
```
Deployment Session: {from Contract 1}
All Contract Outputs: {Contracts 2-9}
```

**Process:**
- Record all deployment steps and outcomes in audit table

**Output:**
```
Audit Record:
  session_id: deploy-{timestamp}-{sha}
  commit_sha: abc123...
  author: user@example.com | AI agent
  triggered_at: {timestamp}
  completed_at: {timestamp}
  duration_ms: {total duration}
  
  change_detection: {Contract 2 output}
  validation: {Contract 3 output}
  migration_safety: {Contract 4 output}
  gate_token: {Contract 5 output}
  approval: {Contract 6 output}
  execution: {Contract 7 output}
  verification: {Contract 8 output}
  deployment: {Contract 9 output}
  
  final_status: SUCCESS | FAILED | BLOCKED
  failure_reason: {reason if not SUCCESS}
  
  artifacts:
    - migration_files: [list]
    - gate_token_id: {id}
    - approval_id: {id}
    - preview_url: {url}
    - production_url: {url}
```

**Audit Storage:**
- **Primary:** GitHub Actions workflow run logs (immutable, GitHub-managed)
- **Secondary:** Database audit table (`bella_execution_audit` or equivalent)
- **Tertiary:** External audit log (future: send to SIEM or audit service)

**Failure Modes:**
- Cannot write audit log → **WARN** (do not block deployment, but alert)

**Idempotency:**
- Each deployment session has unique `session_id`
- Multiple audit writes for same session → **DEDUPLICATE** (upsert by session_id)

**Invariants:**
- ✅ Every deployment (success or failure) has audit record
- ✅ Audit record contains full provenance (what, who, when, why, how)
- ✅ Audit log is immutable (append-only)
- ✅ Audit log is queryable for incident response

---

## 🔐 CONTRACT ENFORCEMENT MECHANISMS

### Enforcement 1: GitHub Actions Workflow

**Mechanism:** `.github/workflows/deploy-production.yml` implements Contract 1-10.

**Enforcement:**
- Contract violations → **WORKFLOW FAILS** → deployment blocked
- All secrets injected at runtime (Principle 4: Zero-Knowledge)
- Logs are structured for audit (Contract 10)

### Enforcement 2: BDGF Policy Engine

**Mechanism:** `scripts/bdgf/migration-executor.mjs` enforces Contract 5 & 7.

**Enforcement:**
- No gate token → **EXECUTION BLOCKED**
- Invalid gate token → **EXECUTION BLOCKED**
- Token already consumed → **EXECUTION BLOCKED**

### Enforcement 3: Database Roles

**Mechanism:** PostgreSQL roles `bella_developer` (read-only) and `bella_migration_executor` (mutation).

**Enforcement:**
- Developers/AI use `bella_developer` (read-only, no mutation)
- Production mutations use `bella_migration_executor` (gate-protected)
- Direct mutation attempts with wrong role → **DATABASE REJECTS**

### Enforcement 4: Architecture Guard

**Mechanism:** `scripts/architecture/architecture-guard.ts` and `scripts/healthcare/architecture-guard.ts`.

**Enforcement:**
- Frozen layer violations → **CI FAILS** (Contract 3)
- Kernel modification attempts → **BLOCKED**

### Enforcement 5: GitHub Environment Protection

**Mechanism:** GitHub Actions Environment "Production" with required reviewers.

**Enforcement:**
- Production promotion requires manual approval (Contract 6 & 9)
- Secrets only accessible in Production environment

---

## 🚨 FAILURE SCENARIO HANDLING

### Scenario 1: Migration Fails During Transaction

**Flow:**
```
1. Migration executed (Contract 7)
2. Migration fails during transaction (e.g., constraint violation)
3. Transaction rolled back automatically (PostgreSQL transaction behavior)
4. Execution status = FAILED
5. Database state = UNCHANGED (safe state, rollback successful)
6. Database verification = SKIPPED (no changes to verify)
7. Application deployment = BLOCKED (Contract 9 conditional gate)
8. Production state = UNCHANGED (safe state)
9. Audit record = FAILED
```

**Developer/AI Action:** Fix migration, push new commit, retry

**Principle Applied:** Principle 2 (Forward-Only) — rollback WITHIN transaction is acceptable, production never committed bad state

### Scenario 1b: Migration Fails After Commit

**Flow:**
```
1. Migration executed (Contract 7)
2. Migration commits successfully BUT application logic expects more changes
3. Database state = PARTIALLY MIGRATED (committed, cannot rollback)
4. Database verification = FAIL (inconsistent state detected)
5. Application deployment = BLOCKED (Contract 9 conditional gate)
6. Production state = DATABASE CHANGED, APP UNCHANGED (DB forward-only, app rollback via old version)
7. Audit record = VERIFICATION FAILED
```

**Developer/AI Action:** Create new forward migration to fix inconsistent state OR complete the partial migration

**Principle Applied:** Principle 2 (Forward-Only) — once committed, only forward corrections allowed

### Scenario 2: App Build Fails

**Flow:**
```
1. Database migration succeeds (Contract 7)
2. Database verification passes (Contract 8)
3. Application build fails (Contract 9)
4. Vercel deployment = BLOCKED
5. Database state = MIGRATED (forward-only)
6. Application state = OLD VERSION STILL SERVING (safe state)
7. Audit record = DEPLOYMENT FAILED
```

**Developer/AI Action:** Fix build error, push new commit, retry (DB migration already applied, idempotent)

**Principle Applied:** Principle 2 (Forward-Only) + Principle 3 (DB Before App ensures old app compatible with new DB)

### Scenario 3: Smoke Test Fails

**Flow:**
```
1. Database migration succeeds
2. Database verification passes
3. Application deployed to preview
4. Smoke test fails (Contract 9)
5. Production promotion = BLOCKED
6. Preview URL remains (for debugging)
7. Production = UNCHANGED (old version still serving)
8. Audit record = SMOKE TEST FAILED
```

**Developer/AI Action:** Fix issue, push new commit, retry

**Principle Applied:** Principle 3 (DB Before App) — preview environment isolated from production

### Scenario 4: Human Approval Denied

**Flow:**
```
1. All automated checks pass (Contracts 3-4)
2. Approval policy = HUMAN REQUIRED (Contract 6)
3. Human reviewer denies approval
4. Gate token = NOT GENERATED (Contract 5)
5. Execution = BLOCKED
6. Audit record = APPROVAL DENIED
```

**Developer/AI Action:** Address reviewer concerns, push updated commit, resubmit

**Principle Applied:** Principle 1 (Fail Closed) — human override for high-risk changes

### Scenario 5: Gate Token Replay Attack

**Flow:**
```
1. Gate token generated (Contract 5)
2. Migration executed successfully (Contract 7)
3. Gate token consumed (single-use)
4. Attacker attempts to replay same token
5. migration-executor validates token
6. Token status = ALREADY CONSUMED
7. Execution = BLOCKED
8. Security incident logged (Contract 10)
```

**System Action:** Alert security team, audit token usage

**Principle Applied:** Contract 7 (Single-Use Tokens) — replay protection

### Scenario 6: Emergency Break-Glass

**Flow:**
```
1. Production outage, Golden Path blocked (e.g., GitHub Actions down)
2. Human operator uses emergency path (e.g., psql direct connection)
3. Emergency mutation applied
4. AUDIT LOG REQUIRED (Principle 5)
5. Post-incident review required
6. Golden Path gap analysis required
```

**Audit Requirements:**
```
Emergency Deployment Log:
  timestamp: {when}
  operator: {who}
  path: psql | SQL Editor | Supabase CLI
  change: {what SQL was executed}
  reason: {why emergency path used}
  authorization: {CTO approval, ticket #1234}
  post_incident_review: {link to post-mortem}
```

**Principle Applied:** Principle 5 (All Bypasses Are Break-Glass) — emergency path is audited, not normal

---

## 📊 CONTRACT COMPLIANCE MATRIX

| Contract | Enforced By | Failure Mode | Block Deployment? |
|----------|-------------|--------------|-------------------|
| 1. Entry | GitHub Actions trigger | Invalid push | ❌ NO (ignore) |
| 2. Change Detection | GitHub Actions script | Cannot classify | ✅ YES |
| 3. Validation | CI scripts (npm run) | Test/lint/guard fails | ✅ YES |
| 4. Migration Safety | CI scripts (npm run db:*) | Unsafe migration | ✅ YES |
| 5. BDGF Policy | gate-token.mjs | Invalid/missing token | ✅ YES |
| 6. Approval | GitHub Actions + policy | Approval denied/timeout | ✅ YES |
| 7. Execution | migration-executor.mjs | Execution fails | ✅ YES |
| 8. Verification | SQL queries | State mismatch | ✅ YES |
| 9. Deployment | Vercel CLI + smoke tests | Deploy/smoke fails | ✅ YES |
| 10. Audit | GitHub Actions logs + DB | Audit write fails | ⚠️ WARN (do not block) |

---

## 🎯 CONTRACT SUCCESS CRITERIA

**Contract is considered IMPLEMENTED when:**

1. ✅ **Entry:** `git push` triggers GitHub Actions workflow (no other entry points active)
2. ✅ **Change Detection:** Workflow correctly classifies all change types (verified with test cases)
3. ✅ **Validation:** All validation gates run and block on failure (verified with failing commits)
4. ✅ **Migration Safety:** Unsafe migrations blocked (verified with breaking change test)
5. ✅ **BDGF Policy:** migration-executor requires valid gate token (verified with missing/invalid token test)
6. ✅ **Approval:** Human approval required for high-risk changes (verified with high-risk test case)
7. ✅ **Execution:** Only bella_migration_executor mutates DB (verified with wrong-role test)
8. ✅ **Verification:** DB state verified before app deployment (verified with verification failure test)
9. ✅ **Deployment:** App deployment conditional on DB success (verified with DB failure test)
10. ✅ **Audit:** All deployments logged (verified by querying audit log)

**Contract is considered FROZEN when:**

- ✅ All 10 contracts implemented
- ✅ All adversarial tests pass (Phase 6)
- ✅ Production deployment successful using Golden Path
- ✅ No bypass paths active (all marked EMERGENCY ONLY)
- ✅ Architecture guard enforces contract compliance

---

## 🚀 CONTRACT VERIFICATION CHECKLIST

**Before Phase 7 (Production Lock), verify:**

- [ ] Contract 1: Push to `main` triggers workflow, no other triggers active
- [ ] Contract 2: Test with app-only, DB-only, mixed, docs-only changes (all correctly classified)
- [ ] Contract 3: Force lint failure → deployment blocked ✅
- [ ] Contract 3: Force test failure → deployment blocked ✅
- [ ] Contract 3: Force architecture guard failure → deployment blocked ✅
- [ ] Contract 4: Create unsafe migration (DROP COLUMN) → blocked ✅
- [ ] Contract 4: Create RLS violation → blocked ✅
- [ ] Contract 5: Attempt execution without gate token → blocked ✅
- [ ] Contract 5: Attempt execution with invalid token signature → blocked ✅
- [ ] Contract 6: High-risk change → human approval required ✅
- [ ] Contract 6: Safe change → automated approval ✅
- [ ] Contract 7: Token consumed after execution (single-use) ✅
- [ ] Contract 7: Replay token → blocked ✅
- [ ] Contract 8: Force DB verification failure → app deployment blocked ✅
- [ ] Contract 9: DB fails → app not deployed, old app still serves ✅
- [ ] Contract 9: Smoke test fails → production not promoted ✅
- [ ] Contract 10: Check audit log after successful deployment ✅
- [ ] Contract 10: Check audit log after failed deployment ✅

---

## 📄 CONTRACT MODIFICATION POLICY

**This contract is IMMUTABLE after Phase 7 (Production Lock).**

**To modify this contract:**

1. Create Architecture Decision Record (ADR)
2. Document why modification is necessary
3. Propose new contract version (increment version number)
4. Review with team (human approval required)
5. Implement changes in isolated environment
6. Run full adversarial test suite
7. Deploy to production with monitoring
8. Update this document (create new version, archive old version)

**Forbidden modifications:**

- ❌ Weakening security (e.g., removing gate token requirement)
- ❌ Introducing bypass paths (e.g., allowing direct psql as normal path)
- ❌ Removing audit logging (e.g., skipping Contract 10)
- ❌ Disabling Principle 1 (Fail Closed) behavior

**Allowed modifications:**

- ✅ Adding new validation gates (strengthening security)
- ✅ Improving error messages (better developer experience)
- ✅ Optimizing performance (without changing behavior)
- ✅ Adding new audit fields (more observability)

---

**END OF GOLDEN PATH CONTRACT**

**Status:** FROZEN ❄️ (after Phase 7)  
**Version:** 1.0.0  
**Next Phase:** Phase 3 — Zero-Knowledge Secret Boundary  
**Implementation:** Phase 4 — Build Control Plane  
**Enforcement:** Phase 6 — Adversarial Testing  
**Lock:** Phase 7 — Production Lock
