---
remediation_id: E0.1A-R
phase: R1_IDENTITY_MAPPING
status: in_progress
created: 2026-09-12
blast_radius: platform_wide
affected_modules:
  - education
  - hr
  - real_estate
---

# E0.1A-R1 — IDENTITY MAPPING EVIDENCE

> **Purpose:** Create immutable mapping evidence between Person and Party before data migration.
> 
> **Critical:** This is mapping ONLY. No schema changes, no data backfill, no FK migration.

---

## 📋 R1 SCOPE

```text
R1.1  Create identity_migration_mapping table (evidence artifact)
R1.2  Populate 848 person → party mappings
R1.3  Reconcile coverage (persons_total = mapping_rows)
R1.4  Seal mapping snapshot (immutable evidence)
```

**OUT OF SCOPE:**
- ❌ INSERT INTO party_parties
- ❌ ALTER TABLE students ADD COLUMN party_id
- ❌ UPDATE students SET party_id = ...
- ❌ Freeze Person writes
- ❌ Contract/Caller changes

---

## 🗂️ R1.1 — MAPPING EVIDENCE TABLE

### Schema Design

```sql
CREATE TABLE IF NOT EXISTS public.identity_migration_mapping (
  -- Primary mapping
  person_id UUID NOT NULL REFERENCES persons(id),
  party_id UUID NOT NULL,  -- Will reference party_parties(id) after backfill
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Migration metadata
  strategy TEXT NOT NULL CHECK (strategy IN (
    'CREATE_NEW_PARTY',
    'REUSE_EXISTING_PARTY',
    'AMBIGUOUS_REVIEW',
    'UNMIGRATABLE'
  )),
  
  -- Evidence
  source TEXT NOT NULL DEFAULT 'persons',
  match_confidence NUMERIC,  -- NULL for CREATE_NEW_PARTY
  match_evidence JSONB,      -- Evidence for REUSE_EXISTING_PARTY
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'party_created',
    'fk_migrated',
    'verified',
    'sealed'
  )),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  party_created_at TIMESTAMPTZ,  -- When party_parties INSERT happened
  fk_migrated_at TIMESTAMPTZ,    -- When FK cutover happened
  verified_at TIMESTAMPTZ,
  sealed_at TIMESTAMPTZ,
  
  -- Constraints
  PRIMARY KEY (person_id),
  UNIQUE (party_id),
  UNIQUE (person_id, tenant_id)
);

-- Indexes
CREATE INDEX idx_identity_mapping_tenant ON identity_migration_mapping(tenant_id);
CREATE INDEX idx_identity_mapping_status ON identity_migration_mapping(status);
CREATE INDEX idx_identity_mapping_strategy ON identity_migration_mapping(strategy);
```

### Evidence Semantics

| Column | Purpose | Example |
|--------|---------|---------|
| `person_id` | Source Person UUID | `011ec62d-4085-41a1-9a88-2b24c20b6ead` |
| `party_id` | Target Party UUID | Same as person_id (0 collisions) |
| `strategy` | Migration decision | `CREATE_NEW_PARTY` |
| `match_evidence` | Why this mapping? | `{ "reason": "no_existing_party", "collision_check": "pass" }` |
| `status` | Migration phase | `planned` → `party_created` → `fk_migrated` → `verified` → `sealed` |

---

## 🔄 R1.2 — POPULATE MAPPINGS

### Population Query

```sql
INSERT INTO identity_migration_mapping (
  person_id,
  party_id,
  tenant_id,
  strategy,
  match_evidence,
  status
)
SELECT 
  id AS person_id,
  id AS party_id,  -- Same UUID (0 collisions verified in R0.3)
  tenant_id,
  'CREATE_NEW_PARTY' AS strategy,
  jsonb_build_object(
    'reason', 'no_existing_party',
    'collision_check', 'pass',
    'r0_census_date', '2026-09-12',
    'persons_total', 848,
    'uuid_collisions', 0,
    'deterministic_duplicates', 0
  ) AS match_evidence,
  'planned' AS status
FROM persons
ORDER BY created_at;
```

### Expected Result

```text
INSERT 0 848
```

---

## ✅ R1.3 — RECONCILIATION

### Coverage Verification Queries

```sql
-- 1. Total mapping count
SELECT COUNT(*) AS total_mappings
FROM identity_migration_mapping;
-- Expected: 848

-- 2. Unmapped persons
SELECT COUNT(*) AS unmapped_persons
FROM persons p
LEFT JOIN identity_migration_mapping m ON p.id = m.person_id
WHERE m.person_id IS NULL;
-- Expected: 0

-- 3. Duplicate party_id mappings
SELECT party_id, COUNT(*) AS duplicate_count
FROM identity_migration_mapping
GROUP BY party_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 4. Strategy distribution
SELECT strategy, COUNT(*) AS count
FROM identity_migration_mapping
GROUP BY strategy;
-- Expected:
-- CREATE_NEW_PARTY | 848

-- 5. Tenant coverage
SELECT 
  p.tenant_id,
  COUNT(p.id) AS persons_count,
  COUNT(m.person_id) AS mapped_count
FROM persons p
LEFT JOIN identity_migration_mapping m ON p.id = m.person_id
GROUP BY p.tenant_id
HAVING COUNT(p.id) != COUNT(m.person_id);
-- Expected: 0 rows (all tenants 100% mapped)
```

### R1.3 PASS Criteria

```text
total_mappings              = 848
unmapped_persons            = 0
duplicate_party_mappings    = 0
strategy_coverage           = 100% CREATE_NEW_PARTY
tenant_coverage             = 100%
```

---

## 🔒 R1.4 — SEAL MAPPING SNAPSHOT

### Freeze Evidence

After R1.3 reconciliation passes, create immutable snapshot:

```sql
-- Mark all mappings as evidence-sealed
UPDATE identity_migration_mapping
SET sealed_at = NOW()
WHERE status = 'planned' AND sealed_at IS NULL;

-- Expected: UPDATE 848
```

### Evidence Integrity Check

```sql
-- Verify seal
SELECT 
  COUNT(*) AS sealed_mappings,
  COUNT(*) FILTER (WHERE sealed_at IS NOT NULL) AS with_seal_timestamp,
  MIN(sealed_at) AS first_sealed,
  MAX(sealed_at) AS last_sealed
FROM identity_migration_mapping;

-- Expected:
-- sealed_mappings: 848
-- with_seal_timestamp: 848
-- first_sealed: 2026-09-12T...
-- last_sealed: 2026-09-12T...
```

### Export Evidence (Backup)

```bash
# Export mapping evidence as CSV
psql $DATABASE_EXECUTOR_URL -c "
COPY (
  SELECT 
    person_id,
    party_id,
    tenant_id,
    strategy,
    match_evidence::text,
    status,
    created_at,
    sealed_at
  FROM identity_migration_mapping
  ORDER BY created_at
) TO STDOUT WITH CSV HEADER
" > evidence/E0.1A-R1-identity-mapping-$(date +%Y%m%d).csv
```

---

## 📊 R1 COMPLETION CRITERIA

```text
✅ identity_migration_mapping table created
✅ 848 mappings populated
✅ 0 unmapped persons
✅ 0 duplicate party_id mappings
✅ 100% CREATE_NEW_PARTY strategy
✅ 100% tenant coverage
✅ Evidence sealed with timestamp
✅ CSV backup exported to evidence/

🔴 NO data migration executed
🔴 NO schema changes
🔴 NO FK cutover
```

---

## 🚨 BLAST RADIUS REMINDER

**Affected Tables (from R0.5):**
1. `students` (Education) — 631 rows
2. `hr_departments` (HR)
3. `hr_employee_profiles` (HR)
4. `re_commission_ledger` (Real Estate)
5. `re_project_checkins` (Real Estate)
6. `re_sales_kpi_targets` (Real Estate)
7. `re_tasks` (Real Estate)

**Cross-Module Impact:**
- Education Student Registration
- HR Employee Management
- Real Estate Sales/Commission/Task tracking

**This mapping is PLATFORM IDENTITY MIGRATION, not Education-only remediation.**

---

## 🔴 BLOCKERS FOR R2 (Data Migration)

Before proceeding to R2 Party Backfill:

```text
R0.6 Write-Path Census            🔴 REQUIRED
R0.7 Contract/Caller Census       🔴 REQUIRED
R1 Mapping Evidence               🟡 IN PROGRESS

CANNOT ALTER schema until R0.6 + R0.7 complete.
```

---

**STATUS:** R1 specification complete, implementation pending.

**NEXT:** Execute R1.1 → R1.4, then R0.6 Write-Path Census.
