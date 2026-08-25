# P0.3-A2 DEPLOYMENT ARTIFACT INVENTORY

**Investigation Date:** 2026-08-25  
**Status:** READ-ONLY COMPLETE  
**Objective:** Find ALL paths to production (database + application)

---

## 🎯 INVESTIGATION SUMMARY

**Scope Investigated:**
- ✅ 13 GitHub Workflows
- ✅ 74 BDGF Scripts (scripts/bdgf/)
- ✅ 40+ Deployment/Migration Scripts
- ✅ 340+ Migration Files (supabase/migrations/)
- ✅ Package.json Scripts (140+ scripts)
- ✅ Credential References (DATABASE_URL, DATABASE_EXECUTOR_URL, PRODUCTION_SUPABASE_DB_URL, SUPABASE_SERVICE_ROLE_KEY)
- ✅ Documentation (deployment, BDGF, E8.0.4, gate, approval, rollback)

**Key Finding:**
Repository contains **MULTIPLE DEPLOYMENT PATHS** with overlapping responsibilities and unclear production usage evidence.

---

## 📊 TABLE 1: ARTIFACT INVENTORY

| Artifact | Purpose | Invocation | Credential | Status |
|----------|---------|------------|------------|--------|
| `.github/workflows/deploy-production.yml` | Production app deployment (Vercel) | `workflow_dispatch` (manual) | `PRODUCTION_SUPABASE_DB_URL` (validation only), `VERCEL_TOKEN` | **INTENDED** |
| `.github/workflows/deploy-staging.yml` | Staging app deployment (Vercel) | `push` to `develop` branch | `STAGING_SUPABASE_DB_URL`, `VERCEL_TOKEN` | **CURRENT** |
| `.github/workflows/decision-engine-deploy.yml` | Decision Engine deployment | `push` to `main` (paths filter) | `VERCEL_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` | **LEGACY/UNKNOWN** |
| `.github/workflows/architecture-gate.yml` | CI gate (healthcare/logistics guards) | PR/push events | None (read-only verification) | **CURRENT** |
| `.github/workflows/architecture-guard.yml` | Architecture compliance check | PR/push events | None (static analysis) | **CURRENT** |
| `.github/workflows/ci-tests.yml` | Test suite runner | PR/push events | `SUPABASE_DB_URL` (test only) | **CURRENT** |
| `.github/workflows/quality-security.yml` | Security/quality checks | PR/push events | None | **CURRENT** |
| `scripts/bdgf/migration-executor.mjs` | **BDGF Migration Executor** (R4.3.3) | Called by `execute-migration-wrapper.mjs` | `DATABASE_EXECUTOR_URL` | **INTENDED** |
| `scripts/bdgf/deploy-schema.mjs` | BDGF schema deployment | Direct node invocation | `DATABASE_EXECUTOR_URL` | **LEGACY/MANUAL** |
| `scripts/bdgf/deploy-verify.mjs` | BDGF deployment verification | Direct node invocation | `DATABASE_EXECUTOR_URL` | **CURRENT/VERIFY** |
| `scripts/bdgf/gate-runner.mjs` | BDGF gate execution engine | Config-driven | None (framework) | **INTENDED** |
| `scripts/bdgf/gate-token.mjs` | Gate token validation/consumption | Called by migration-executor | `DATABASE_URL` | **INTENDED** |
| `scripts/bdgf/execute-migration-wrapper.mjs` | Migration execution wrapper | Direct node invocation | `DATABASE_EXECUTOR_URL` | **INTENDED** |
| `scripts/bdgf/r3-*.mjs` | R3 credential rotation scripts (22 files) | Manual execution | `DATABASE_URL`, `DATABASE_EXECUTOR_URL` | **COMPLETED/OBSOLETE** |
| `scripts/bdgf/r4-*.mjs` | R4 gate testing scripts (17 files) | Test/verification only | `DATABASE_EXECUTOR_URL` | **TEST/VERIFY** |
| `scripts/deploy-booking-engine-schema.sh` | Booking engine deployment | Manual bash script | `SUPABASE_DB_URL` (via `npx supabase db push`) | **LEGACY/MANUAL** |
| `scripts/deploy-bella-auto-rpcs.sh` | Bella Auto RPC deployment | Manual bash script | `SUPABASE_DB_URL` (via `supabase db push` + `psql`) | **LEGACY/MANUAL** |
| `scripts/deploy-commission-system-staging.sh` | Commission system staging deploy | Manual bash script | `STAGING_DB_URL` (via `psql` + `pg_dump`) | **LEGACY/MANUAL** |
| `scripts/deploy-partner-portal-staging.sh` | Partner portal staging deploy | Manual bash script | `NEXT_PUBLIC_SUPABASE_URL` (via `npx supabase db push` + `psql`) | **LEGACY/MANUAL** |
| `scripts/deploy-migration.js` | Generic migration deployer | Direct node invocation | `SUPABASE_DB_URL` (via `psql`) | **LEGACY/MANUAL** |
| `scripts/apply-surgery-migration.js` | Surgery schema migration | Direct node invocation | `DATABASE_URL` or `SUPABASE_DB_URL` | **LEGACY/MANUAL** |
| `scripts/apply-clinical-orders-migration.js` | Clinical orders migration | Direct node invocation | `SUPABASE_URL` (local only check) | **LOCAL/TEST** |
| `scripts/backup-database.sh` | Database backup | Manual bash script | `SUPABASE_DB_PASSWORD` (via `pg_dump`) | **MANUAL/OPERATIONAL** |
| `supabase/migrations/*.sql` | 340+ migration files | Applied via multiple mechanisms | N/A (data) | **CURRENT** |
| `package.json` scripts | 140+ npm scripts | `npm run <script>` | Various (per script) | **MIXED** |
| Supabase CLI (`npx supabase`) | Supabase CLI commands | Manual invocation | Supabase project credentials | **CURRENT/MANUAL** |
| `psql` commands | Direct PostgreSQL client | Manual/scripted invocation | `DATABASE_URL`, `SUPABASE_DB_URL`, connection strings | **CURRENT/MANUAL** |
| Supabase SQL Editor | Web-based SQL interface | Manual browser usage | Supabase dashboard login | **MANUAL** |

---

## 📊 TABLE 2: PRODUCTION PATHS

| Path | Entry Point | DB Access | App Deploy | Evidence | Classification |
|------|-------------|-----------|------------|----------|----------------|
| **Path A: GitHub Actions → Vercel** | `git push` → `deploy-production.yml` (workflow_dispatch) | DB validation only (`npm run db:migration:check`) | Vercel deploy + promote | Workflow exists, `workflow_dispatch` requires manual trigger | **INTENDED** |
| **Path B: GitHub Actions → Decision Engine → Vercel** | `git push` to `main` (path filter) | None | Vercel deploy (auto) | Legacy workflow, unclear if active | **LEGACY/UNKNOWN** |
| **Path C: BDGF Local → migration-executor** | `node scripts/bdgf/execute-migration-wrapper.mjs` | `bella_migration_executor` role via `DATABASE_EXECUTOR_URL` | None | R4.3.3 gate token + executor, designed for CI but can run locally | **INTENDED/LOCAL** |
| **Path D: BDGF Local → deploy-schema** | `node scripts/bdgf/deploy-schema.mjs` | `bella_migration_executor` role via `DATABASE_EXECUTOR_URL` | None | Direct schema deployment, no gate validation | **LEGACY/MANUAL** |
| **Path E: Supabase CLI → db push** | `npx supabase db push --linked` | Supabase project credentials | None | Used in multiple bash scripts, documented in code comments | **CURRENT/MANUAL** |
| **Path F: psql → Direct SQL** | `psql $DATABASE_URL -f migration.sql` | Raw PostgreSQL connection | None | Used in bash scripts, documented as manual fallback | **CURRENT/MANUAL** |
| **Path G: Supabase SQL Editor** | Manual browser → SQL Editor → Run | Supabase dashboard login | None | No code evidence, assumed available | **MANUAL** |
| **Path H: Vercel Auto Deploy** | `git push` → Vercel Git integration | None | Vercel auto-deploy (if enabled) | No explicit workflow, depends on Vercel project config | **UNKNOWN** |
| **Path I: Package.json scripts** | `npm run <various>` (140+ scripts) | Various (per script, e.g., `db:migration:check`, `healthcare:verify`) | None | Many scripts reference DB, unclear which are production-capable | **MIXED/UNKNOWN** |

**Critical Gap:** No single Golden Path enforced. Paths A-I coexist without clear precedence or deprecation markers.

---

## 📊 TABLE 3: CREDENTIAL CONSUMERS

| Credential | Consumer | Environment | Purpose | Classification |
|------------|----------|-------------|---------|----------------|
| `DATABASE_URL` | `scripts/bdgf/apply-r2-r3.mjs`, `apply-r3-simple.mjs`, `apply-security-fix.mjs`, `check-*.mjs` (9+ files) | Local/CI | BDGF operations (bella_developer role assumed) | **LOCAL_ONLY** |
| `DATABASE_URL` | `scripts/apply-surgery-migration.js` (fallback) | Local | Manual migration apply | **LOCAL_ONLY** |
| `DATABASE_EXECUTOR_URL` | `scripts/bdgf/migration-executor.mjs`, `deploy-schema.mjs`, `deploy-verify.mjs` | Local/CI | Migration execution (bella_migration_executor role) | **PRODUCTION_DEPLOYMENT** |
| `DATABASE_EXECUTOR_URL` | `scripts/bdgf/r3-*.mjs`, `r4-*.mjs` (39 files) | Local | R3 rotation + R4 testing | **TEST_ONLY** |
| `PRODUCTION_SUPABASE_DB_URL` | `.github/workflows/deploy-production.yml` | CI_SECRET | DB migration validation (`npm run db:migration:check`) | **CI_SECRET** |
| `STAGING_SUPABASE_DB_URL` | `.github/workflows/deploy-staging.yml` | CI_SECRET | Staging DB migration validation | **CI_SECRET** |
| `SUPABASE_DB_URL` | `.github/workflows/ci-tests.yml`, `quality-security.yml` | CI_SECRET | Test/CI verification only | **CI_SECRET** |
| `SUPABASE_DB_URL` | `scripts/apply-surgery-migration.js`, `deploy-migration.js` (primary) | Local | Manual migration apply | **LOCAL_ONLY** |
| `SUPABASE_SERVICE_ROLE_KEY` | `.github/workflows/decision-engine-deploy.yml` | CI_SECRET | Cache warmup, smoke tests | **CI_SECRET** |
| `SUPABASE_SERVICE_ROLE_KEY` | `e2e/helpers/supabase-admin.ts`, `tests/utils/e2e-test-setup.ts` | Local/CI | E2E test setup/teardown | **TEST_ONLY** |
| `SUPABASE_SERVICE_ROLE_KEY` | `mcp-server/src/db.ts` | Local | MCP server DB access | **LOCAL_ONLY** |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/audit-*.ts`, `check-*.ts` (15+ files) | Local | Admin operations (audits, checks, data seeding) | **LOCAL_ONLY** |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/__tests__/*.test.ts` (20+ files) | Test | Unit/integration test mocks | **TEST_ONLY** |
| `STAGING_DB_URL` | `scripts/deploy-commission-system-staging.sh` | Local | Staging deployment via `psql` + `pg_dump` | **LOCAL_ONLY** |
| `NEXT_PUBLIC_SUPABASE_URL` | `scripts/deploy-partner-portal-staging.sh` | Local | Staging deployment via `psql` | **LOCAL_ONLY** |
| `VERCEL_TOKEN` | `.github/workflows/deploy-production.yml`, `deploy-staging.yml`, `decision-engine-deploy.yml` | CI_SECRET | Vercel deployment | **CI_SECRET** |
| `GATE_SIGNING_KEY` | `scripts/bdgf/gate-token.mjs`, `gate-runner.mjs` | Local/CI | BDGF gate token cryptography | **PRODUCTION_DEPLOYMENT** |

**Critical Finding:** 
- `DATABASE_EXECUTOR_URL` is the **ONLY** credential designed for production mutation (via bella_migration_executor role).
- `SUPABASE_SERVICE_ROLE_KEY` is **OVERUSED** in local scripts (admin operations, audits, seeding) despite being a production-capable credential.
- No clear separation between LOCAL_ONLY and PRODUCTION_DEPLOYMENT for many scripts.

---

## 📊 TABLE 4: LEGACY/CONFLICT MAP

| Artifact | Classification | Evidence | P0.3 Treatment Recommendation |
|----------|----------------|----------|-------------------------------|
| `.github/workflows/deploy-production.yml` | **INTENDED** | Workflow exists, requires manual trigger, includes validation gates, uses Vercel promotion | **ADOPT** — Enhance with BDGF integration for DB mutations |
| `.github/workflows/decision-engine-deploy.yml` | **DEPRECATED** | Auto-triggers on main push (path filter), duplicates deploy-production.yml, unclear current usage | **DEPRECATE** — Merge into deploy-production.yml or delete if unused |
| `scripts/bdgf/migration-executor.mjs` | **INTENDED** | R4.3.3 security boundary, gate token validation, bella_migration_executor role, designed for CI | **ADOPT** — Integrate into GitHub Actions workflow |
| `scripts/bdgf/deploy-schema.mjs` | **DEPRECATED** | Direct schema deployment without gate validation, local-only invocation | **DEPRECATE** — Replaced by migration-executor.mjs |
| `scripts/bdgf/execute-migration-wrapper.mjs` | **INTENDED** | Wrapper for migration-executor, provides CLI interface | **ADOPT** — Integrate into GitHub Actions workflow |
| `scripts/bdgf/r3-*.mjs` (22 files) | **OBSOLETE** | R3 credential rotation complete (P0.2 CLOSED), no longer needed | **DELETE** — Archive as historical evidence |
| `scripts/bdgf/r4-*.mjs` (17 files) | **TEST/VERIFY** | R4 gate testing and adversarial testing, not production deployment | **KEEP** — Retain for regression testing |
| `scripts/deploy-booking-engine-schema.sh` | **DEPRECATED** | Manual bash script using `npx supabase db push`, no CI integration | **DEPRECATE** — Migrate to Golden Path |
| `scripts/deploy-bella-auto-rpcs.sh` | **DEPRECATED** | Manual bash script using `supabase db push` + `psql`, no gate validation | **DEPRECATE** — Migrate to Golden Path |
| `scripts/deploy-commission-system-staging.sh` | **DEPRECATED** | Manual bash script with `psql` + `pg_dump`, staging-only | **DEPRECATE** — Migrate to Golden Path or keep for staging manual fallback |
| `scripts/deploy-partner-portal-staging.sh` | **DEPRECATED** | Manual bash script using `npx supabase db push` + `psql`, staging-only | **DEPRECATE** — Migrate to Golden Path or keep for staging manual fallback |
| `scripts/deploy-migration.js` | **DEPRECATED** | Generic manual deployer using `psql`, local-only | **DEPRECATE** — Replaced by BDGF migration-executor |
| `scripts/apply-surgery-migration.js` | **DEPRECATED** | Manual migration apply, local-only | **DEPRECATE** — Use Golden Path |
| `scripts/apply-clinical-orders-migration.js` | **LOCAL/TEST** | Local-only guard (rejects non-local URLs), test artifact | **KEEP** — For local development only |
| `scripts/backup-database.sh` | **OPERATIONAL** | Manual backup using `pg_dump`, operational tool | **KEEP** — Operational utility, not deployment |
| `npx supabase db push` | **MANUAL** | Supabase CLI command used in 10+ bash scripts, no CI integration | **DEPRECATE** — Enforce Golden Path only |
| `psql` commands | **MANUAL** | Direct PostgreSQL client used in 15+ bash scripts, no gate validation | **RESTRICT** — Block in CI, allow manual emergency only |
| Supabase SQL Editor | **MANUAL** | Web-based interface, no code evidence | **RESTRICT** — Emergency only, audit all usage |
| `package.json` scripts (140+) | **MIXED** | Mix of test, verify, deploy, manual operations | **AUDIT** — Classify each, integrate relevant scripts into Golden Path |

**Recommended Deprecation Priority:**
1. **P0 (Immediate):** Delete R3 scripts (obsolete), deprecate `deploy-schema.mjs` (unsafe)
2. **P1 (Before A3):** Deprecate all bash deploy scripts (10+ files), document `psql` as emergency-only
3. **P2 (Before A4):** Audit package.json scripts, integrate safe operations into Golden Path
4. **P3 (Before A5):** Restrict Supabase SQL Editor access, implement audit logging

---

## 🔍 DUPLICATE DEPLOYMENT PATHS DETECTED

**Question:** How many ways can AI/developer deploy to production?

### Database Deployment Paths (7 identified):

1. **GitHub Actions → BDGF migration-executor** (INTENDED, not yet implemented)
2. **Local → BDGF migration-executor** (INTENDED, currently callable locally)
3. **Local → BDGF deploy-schema.mjs** (DEPRECATED, no gate)
4. **Local → npx supabase db push** (MANUAL, used in 10+ scripts)
5. **Local → psql < migration.sql** (MANUAL, used in 15+ scripts)
6. **Local → Supabase SQL Editor** (MANUAL, web interface)
7. **Local → bash deploy scripts** (DEPRECATED, 10+ scripts with varying approaches)

### Application Deployment Paths (4 identified):

1. **GitHub Actions → Vercel (deploy-production.yml)** (INTENDED, manual trigger)
2. **GitHub Actions → Vercel (decision-engine-deploy.yml)** (LEGACY, auto-trigger)
3. **Vercel Git Integration** (UNKNOWN, depends on Vercel project config)
4. **Local → Vercel CLI** (MANUAL, no evidence but assumed available)

**Total:** **11 deployment paths** (7 DB + 4 app) with overlapping capabilities and no clear precedence.

---

## 🔴 CRITICAL GAPS IDENTIFIED

### Gap 1: No Enforced Golden Path
- **Evidence:** Multiple coexisting deployment mechanisms (GitHub Actions, BDGF local, Supabase CLI, psql, bash scripts)
- **Impact:** AI/developer can bypass intended controls, inconsistent deployment practices
- **Recommendation:** Implement single enforced Golden Path in A3

### Gap 2: BDGF Not Integrated into CI
- **Evidence:** `migration-executor.mjs` designed for CI but not invoked by `deploy-production.yml`
- **Impact:** Production workflow lacks gate validation, R4.3.3 security boundary not enforced
- **Recommendation:** Integrate BDGF into GitHub Actions in A4

### Gap 3: Legacy Scripts Still Documented/Discoverable
- **Evidence:** 10+ bash deploy scripts in `scripts/`, code comments reference `supabase db push` and `psql`
- **Impact:** AI agents can discover and use deprecated paths
- **Recommendation:** Delete/archive legacy scripts, update documentation in A3

### Gap 4: Unclear Credential Boundaries
- **Evidence:** `DATABASE_URL` vs `DATABASE_EXECUTOR_URL` usage inconsistent, `SUPABASE_SERVICE_ROLE_KEY` overused
- **Impact:** Scripts may use wrong credential for context (read-only vs mutation)
- **Recommendation:** Enforce credential classification in A5

### Gap 5: No Migration Tracking Mechanism
- **Evidence:** 340+ migration files, multiple application mechanisms, no central registry
- **Impact:** Risk of duplicate application, missing migrations, inconsistent state
- **Recommendation:** Implement migration registry in A4

### Gap 6: Manual Operations Not Audited
- **Evidence:** `psql`, Supabase SQL Editor, `npx supabase db push` leave no audit trail
- **Impact:** Untraceable changes, no rollback capability
- **Recommendation:** Implement audit logging in A5

---

## 📋 MIGRATION INVENTORY SUMMARY

**Total Migration Files:** 340+ files in `supabase/migrations/`

**Naming Convention:** `YYYYMMDDHHMMSS_description.sql`

**Migration Tracking:**
- Supabase internal tracking (`supabase_migrations` table)
- No BDGF registry integration detected
- No migration approval workflow detected

**Application Mechanisms Identified:**
1. `npx supabase db push` (Supabase CLI)
2. `psql < migration.sql` (direct PostgreSQL client)
3. `scripts/bdgf/migration-executor.mjs` (BDGF, gate-protected)
4. `scripts/bdgf/deploy-schema.mjs` (BDGF, no gate)
5. `scripts/deploy-migration.js` (legacy wrapper)
6. Manual SQL Editor paste (Supabase dashboard)
7. GitHub Actions CI checks (`npm run db:migration:check`) — **validation only, not application**

**Critical Finding:** Migrations can be applied via **6 different mechanisms** with varying levels of validation and audit.

---

## 📚 DOCUMENTATION INVENTORY

**Deployment/Migration Documentation Found:**

| Document | Content | Status |
|----------|---------|--------|
| `docs/BELLA_AUTO_PROGRESS_STATUS.md` | Bella Auto deployment progress, mentions "deployed to production", "migrations deployed", "rollback system" | References legacy manual deployment |
| `docs/BELLA_AUTO_PRODUCTION_VERIFICATION_RESULTS.md` | Production verification, mentions "deploy RPCs", "migration applied", "RPC deployment", "PostgREST schema refresh" | Documents manual deployment workflow |
| `docs/architecture/E8_0_4_IMPLEMENTATION_STATUS.md` | E8.0.4 BDGF status (assumed, file listed in context) | BDGF protocol documentation |
| `scripts/bdgf/R3_*.md` (3 files) | R3 credential rotation guides (P0.2 completed) | Historical, P0.2 CLOSED |
| `scripts/bdgf/R4_*.md` (3 files) | R4 gate deployment and verification guides | BDGF R4.3+ protocol |
| Code comments in bash scripts | References to `supabase db push`, `psql`, manual deployment steps | Embedded legacy protocol documentation |

**Critical Finding:** Documentation references **manual deployment workflows** and legacy paths that should be deprecated. No single authoritative Golden Path documentation exists.

**A3 Requirement:** Create `P0_3_GOLDEN_DEPLOYMENT_PATH.md` after A3 classification decisions.

---

## ✅ A2 COMPLETION STATUS

| Task | Status | Evidence |
|------|--------|----------|
| A2.1 GitHub Workflows | ✅ COMPLETE | 13 workflows inventoried |
| A2.2 BDGF Scripts | ✅ COMPLETE | 74 scripts classified (verify, test, deploy, rotation) |
| A2.3 Deployment/Migration Paths | ✅ COMPLETE | 11 paths identified (7 DB, 4 app) |
| A2.4 Credential References | ✅ COMPLETE | 4 credentials tracked, consumers classified |
| A2.5 Migration Inventory | ✅ COMPLETE | 340+ migrations, 6 application mechanisms |
| A2.6 Documentation Inventory | ✅ COMPLETE | Legacy manual workflows documented, no Golden Path |

**Output Delivered:**
- ✅ Table 1: Artifact Inventory (28 artifacts)
- ✅ Table 2: Production Paths (9 paths)
- ✅ Table 3: Credential Consumers (17 credential-consumer pairs)
- ✅ Table 4: Legacy/Conflict Map (19 artifacts classified)

---

## 🎯 A3 DECISION REQUIRED

**User must decide for each artifact/path:**

| Option | Action | Criteria |
|--------|--------|----------|
| **KEEP** | Retain as-is | Already compliant with Golden Path |
| **REUSE** | Integrate into Golden Path | Core logic sound, needs CI integration |
| **REWRITE** | Rebuild with new approach | Fundamentally incompatible, fresh start better |
| **DEPRECATE** | Mark obsolete, remove from docs | Superseded by better alternative |
| **DELETE** | Remove from repository | Obsolete, historical only |

**Blocking Question for A3:**

> Should P0.3 Golden Path be:
> 
> **Option A:** GitHub Actions → BDGF (migration-executor) → bella_migration_executor → PostgreSQL → Vercel
> 
> **Option B:** GitHub Actions → Supabase CLI → PostgreSQL → Vercel (abandon BDGF)
> 
> **Option C:** Hybrid approach (BDGF for critical, Supabase CLI for low-risk)

**A2 Evidence Suggests:** Option A (BDGF-based) has most architectural investment (R4.3.3 security boundary, gate tokens, audit), but NOT YET integrated into CI.

---

## 📊 NEXT STEPS

1. **User reviews A2 inventory**
2. **User decides KEEP/REUSE/REWRITE/DEPRECATE/DELETE for each artifact**
3. **User selects Golden Path architecture (Option A/B/C)**
4. **A3 proceeds:** Classify artifacts based on decisions
5. **A4 proceeds:** Select and freeze control plane contract
6. **A5 proceeds:** Design Golden Path implementation

**No code changes until A3 classification complete.**

---

## 🔒 SECURITY NOTES

- ✅ No `.env` file read (credentials rotated in P0.2, previously exposed)
- ✅ No secret values examined (references only)
- ✅ No production connections made (read-only investigation)
- ✅ No workflow executions triggered (inventory only)

**Credential Exposure Risk:**
- `SUPABASE_SERVICE_ROLE_KEY` referenced in 20+ files (test, scripts, MCP server)
- Recommendation: Audit usage, enforce LOCAL_ONLY/TEST_ONLY boundaries

---

**END OF A2 INVENTORY**
