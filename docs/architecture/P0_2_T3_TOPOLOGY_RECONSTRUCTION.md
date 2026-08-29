# P0.2-T3: Production Topology Reconstruction

**Status:** ✅ COMPLETE  
**Date:** 2026-08-25  
**Phase:** P0.2 Credential Boundary Audit  
**Execution Mode:** Read-only evidence collection

---

## Executive Summary

Evidence collection complete across GitHub, Vercel, and Supabase. Production topology identified as **dual-plane architecture with single operational path**.

**Critical Finding:** Application plane (Vercel → Supabase API) is operational. Schema/migration plane (GitHub Actions → Direct PostgreSQL) is designed but not provisioned.

---

## Topology Map

```
Developer
    │
    ├─── GitHub Control Plane
    │       │
    │       └─── bellaspahcm/bella-spa-erp
    │               │
    │               ├─── Repository Secrets
    │               │      PRODUCTION_SUPABASE_DB_URL: ❌ NOT EXISTS
    │               │
    │               ├─── Environment "Production"
    │               │      Secrets: EMPTY ❌
    │               │
    │               └─── deploy-production.yml
    │                      Status: ❌ NOT OPERATIONAL (missing credential)
    │
    └─── Vercel Control Plane
            │
            └─── Production Environment
                    SUPABASE_URL: ✅
                    SUPABASE_SERVICE_ROLE_KEY: ✅
                    SUPABASE_SECRET_KEY: ✅
                    │
                    ▼
                Supabase API Layer
                    │
                    ▼
                PostgreSQL Production
                (db.lvnvkpyxtuilhabtlwv.supabase.co:5432)
```

---

## Evidence Sources

### T1: Vercel Audit
- **Date:** 2026-08-25
- **Scope:** Environment Variables (All Projects)
- **Findings:**
  - `DATABASE_URL`: ❌ NOT OBSERVED
  - `POSTGRES_URL`: ❌ NOT OBSERVED
  - `PRODUCTION_*_DB_URL`: ❌ NOT OBSERVED
  - `SUPABASE_URL`: ✅ Production scope
  - `SUPABASE_SERVICE_ROLE_KEY`: ✅ Production scope
  - `SUPABASE_SECRET_KEY`: ✅ Production scope

**Conclusion:** Vercel uses Supabase API credentials, not direct PostgreSQL connection strings.

### T2: Supabase Audit
- **Date:** 2026-08-25
- **Project:** bellaspahcm's Project
- **Project Ref:** lvnvkpyxtuilhabtlwv
- **Project URL:** https://lvnvkpyxtuilhabtlwv.supabase.co
- **Status:** Healthy (NANO compute)

**Database Connection:**
- Direct PostgreSQL endpoint: ✅ AVAILABLE
- Format: `postgresql://postgres:[PASSWORD]@db.lvnvkpyxtuilhabtlwv.supabase.co:5432/postgres`
- Port: 5432 (direct connection)
- Connection pooling: Available (Transaction/Session modes)
- Selected mode: Direct connection

**Database Roles (16 total):**

*Supabase-managed (PROTECTED):*
- `anon` (ID: 16484) — 0 connections
- `authenticated` (ID: 16485) — 0 connections
- `authenticator` (ID: 16487) — 2 connections
- `cit_login_postgres` (ID: 22696) — 0 connections
- `dashboard_user` (ID: 16555) — 0 connections
- `pgbouncer` (ID: 16389) — 1 connection
- `service_role` (ID: 16486) — 0 connections
- `supabase_admin` (ID: 10) — 5 connections
- `supabase_auth_admin` (ID: 16545) — 0 connections
- `supabase_elt_admin` (ID: 16432) — 0 connections
- `supabase_read_only_user` (ID: 16434) — 0 connections ⚠️
- `supabase_realtime_admin` (ID: 17502) — 0 connections
- `supabase_replication_admin` (ID: 16431) — 0 connections
- `supabase_storage_admin` (ID: 16547) — 1 connection

*Custom roles (NOT PROTECTED):*
- `bella_developer` (ID: 391496) — 0 connections ⚠️
- `bella_migration_executor` (ID: 391497) — 0 connections ⚠️
- `postgres` (ID: 16388) — 1 connection ⚠️

**Integrations:**
- GitHub: ❌ No repository connected
- Vercel: Not visible in evidence

**Conclusion:** Direct PostgreSQL access available. Custom roles exist but have 0 connections (provenance unknown).

### T3: Cross-Platform Synthesis

**Proven operational path:**
```
Vercel Runtime
  → SUPABASE_SERVICE_ROLE_KEY (API credential)
  → Supabase API Layer
  → PostgreSQL (internal connection)
```

**Intended but non-operational path:**
```
GitHub Actions
  → secrets.PRODUCTION_SUPABASE_DB_URL ❌ NOT EXISTS
  → [INTENDED] Direct PostgreSQL connection
  → [INTENDED] E8.0.4 Custom Deployment Adapter
```

---

## PROVEN vs INTENDED vs UNKNOWN

### ✅ PROVEN

| Component | Evidence |
|-----------|----------|
| Production Supabase project operational | T2: Dashboard status "Healthy" |
| PostgreSQL database operational | T2: Connection info visible |
| Direct PostgreSQL endpoint available | T2: `postgresql://...` connection string |
| Vercel has Supabase API credentials | T1: Environment variables |
| Application uses API layer | T1: No direct DB credentials in Vercel |
| GitHub workflow file exists | Repository inspection |
| GitHub Environment "Production" exists | E1-B1: Environment evidence |
| Branch protection active | E1-B4: Ruleset evidence |

### ⚠️ INTENDED (Not Operational)

| Component | Status |
|-----------|--------|
| GitHub Actions → PostgreSQL migration path | Credential missing (T1) |
| E8.0.4 deployment adapter execution | Workflow cannot run |
| Environment-gated deployment | Environment exists, no secrets |
| Least-privilege migration identity | No credential provisioned |

### ❓ UNKNOWN

| Question | Status |
|----------|--------|
| Source of `postgres` role's 1 active connection | Unknown (no metadata) |
| Provenance of `bella_developer` role | Unknown |
| Provenance of `bella_migration_executor` role | Unknown |
| Purpose of existing custom roles | Unknown |
| Grants on custom roles | Not audited |
| Actual production migration mechanism | Unknown |
| Developer direct DB access capability | Not established |

---

## Critical Architectural Gaps

### Gap 1: Dual Topology, Single Operational Path

**Design:** Two separate credential paths (application API, schema migration direct PostgreSQL)  
**Reality:** Only application path operational  
**Impact:** Migration/deployment mechanism unclear

### Gap 2: Existing Roles, Unknown Purpose

**Observed:**
- `supabase_read_only_user` — Supabase built-in, 0 connections
- `bella_developer` — Custom role, 0 connections
- `bella_migration_executor` — Custom role, 0 connections

**Questions:**
- Who created custom roles?
- What grants do they have?
- Are they LOGIN or NOLOGIN?
- Are they managed by migrations?
- Why are they not being used?

### Gap 3: No Proven Deployment Identity

**Current state:**
- Application: API credentials (not PostgreSQL role)
- GitHub Actions: No credentials
- Migration mechanism: Unknown
- `postgres` superuser: 1 connection (source unknown)

**Implication:** Least-privilege deployment boundary not established.

---

## Architecture Decision Required

**Before E2 (bella_readonly creation), must determine:**

### Is `deploy-production.yml` the intended production migration control plane?

#### Option A: YES
- Remediation: Provision GitHub Environment secret + create least-privilege role
- E2 unlocked with clear boundary design
- Path: GitHub Environment → Limited-privilege role → E8.0.4 adapter

#### Option B: NO
- Investigation: Identify actual migration mechanism
- Re-scope P0.2 based on actual topology
- E2 may not be relevant or needs different design

#### Option C: UNKNOWN
- Additional evidence needed:
  - Query existing role grants
  - Inspect migration history
  - Check deployment logs
  - Confirm architectural intent

---

## P0.2 Status

```
✅ T1 Vercel Audit                    COMPLETE
✅ T2 Supabase Audit                  COMPLETE
✅ T3 Topology Reconstruction         COMPLETE
✅ T4 Provenance Investigation        COMPLETE
🟡 T5 Operational Verification        COMPLETE (credential exposure incident)

🔴 SECURITY INCIDENT: T5 Credential Exposure
   DATABASE_URL and DATABASE_EXECUTOR_URL exposed during audit

✅ E1 Evidence Collection             COMPLETE (with security incident)
🟡 E1 Infrastructure Proof            COMPLETE (R3 architecture proven)
     ├─ Credential existence          ✅ Proven (local .env, EXPOSED)
     ├─ Application path              ✅ Proven (Vercel → API)
     ├─ Migration path                🟡 Strong evidence (BDGF → bella_migration_executor)
     ├─ Deployment identity           ✅ Database identity proven (bella_migration_executor)
     └─ Least-privilege boundary      ✅ Proven (R3: bella_developer, bella_migration_executor)

❌ E2 bella_readonly Creation         OBSOLETE (bella_developer already exists)
⏸️ R3 Verification                    HOLD (pending credential rotation)
🔒 E3 GitHub Actions Provisioning     BLOCKED (not current operational path)
```

---

## Execution Locks

### PROHIBITED (until Architecture Decision)
- ❌ bella_readonly creation
- ❌ Any database role creation/modification
- ❌ Secret creation/provisioning
- ❌ Workflow modification
- ❌ Ruleset changes
- ❌ Grant operations
- ❌ Production database connection

### ALLOWED
- ✅ Read-only role investigation (if needed)
- ✅ Documentation
- ✅ Architecture decision discussion
- ✅ Remediation design (no implementation)

---

## Next Steps

1. **Architecture Decision:** Confirm intended production migration plane
2. **If GitHub Actions:** Design remediation for E2
3. **If other mechanism:** Re-scope P0.2
4. **If unknown:** Collect additional evidence

**No implementation permitted until decision confirmed.**

---

## References

- **E1 Evidence:** `docs/architecture/P0_2_E1_EVIDENCE_FINDINGS.md`
- **Gap Analysis:** `docs/architecture/P0_2_GAP_ANALYSIS.md`
- **Remediation Design:** `docs/architecture/P0_2_REMEDIATION_DESIGN.md`
- **Workflow:** `.github/workflows/deploy-production.yml`
- **E8.0.4 Status:** `docs/architecture/E8_0_4_IMPLEMENTATION_STATUS.md`
