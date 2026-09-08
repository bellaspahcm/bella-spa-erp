# Step 2: Babycare Production Verification (READ-ONLY)

**Date:** 2026-09-05  
**Purpose:** Verify production schema and usage before migration validation  
**Mode:** READ-ONLY - NO modifications allowed

---

## 🎯 Objectives

**Verify 3 hypotheses:**

1. **Tables exist in production:** packages, inventory_items, inventory_logs
2. **Babycare actively uses them:** Not just type imports
3. **Schema compatible with migration:** 20260510 creates compatible schema

---

## 📊 Evidence Required (3 categories)

### A. Production Schema (READ-ONLY Queries)

**Required for each table: packages, inventory_items, inventory_logs**

#### 1. Table Existence
```sql
SELECT 
  table_schema, 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN ('packages', 'inventory_items', 'inventory_logs')
  AND table_schema = 'public';
```

**Expected:** 3 rows if all tables exist

---

#### 2. Full Column Schema
```sql
SELECT 
  table_name,
  column_name, 
  ordinal_position,
  data_type,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('packages', 'inventory_items', 'inventory_logs')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

**Compare with:** Migration 20260510 column definitions

---

#### 3. Constraints
```sql
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name IN ('packages', 'inventory_items', 'inventory_logs')
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
```

**Compare with:** Migration FKs, PKs, checks, uniques

---

#### 4. Indexes
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('packages', 'inventory_items', 'inventory_logs')
  AND schemaname = 'public'
ORDER BY tablename, indexname;
```

**Compare with:** Migration index definitions

---

#### 5. RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('packages', 'inventory_items', 'inventory_logs')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
```

**Compare with:** Migration RLS policy definitions

---

#### 6. Triggers (if any)
```sql
SELECT 
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table IN ('packages', 'inventory_items', 'inventory_logs')
  AND event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

---

#### 7. Data Existence
```sql
-- Verify tables have data (not just empty structures)
SELECT 
  'packages' AS table_name,
  COUNT(*) AS row_count,
  MIN(created_at) AS first_record,
  MAX(created_at) AS last_record
FROM packages
WHERE created_at IS NOT NULL

UNION ALL

SELECT 
  'inventory_items',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM inventory_items
WHERE created_at IS NOT NULL

UNION ALL

SELECT 
  'inventory_logs',
  COUNT(*),
  MIN(created_at),
  MAX(created_at)
FROM inventory_logs
WHERE created_at IS NOT NULL;
```

**Interpretation:**
- Row count > 0: Tables actively used
- Recent created_at: Recent activity
- Old first_record: Long-standing tables

---

### B. Babycare Runtime Usage Verification

**Purpose:** Prove Babycare ACTIVELY uses these tables, not just type imports

#### 1. Code References (Already Documented)

**From previous grep:**
```typescript
// src/services/inventory-actions.ts - 50+ operations
// src/services/inventory-transfer-actions.ts - HQ↔Branch
// src/services/healthcare/healthcare-actions.ts - Drug inventory
```

#### 2. Active Transaction Evidence (READ-ONLY Query)

```sql
-- Find recent Babycare tenant operations
SELECT 
  t.name AS tenant_name,
  t.id AS tenant_id,
  'packages' AS table_name,
  COUNT(*) AS record_count,
  MAX(p.created_at) AS last_activity
FROM tenants t
LEFT JOIN packages p ON p.tenant_id = t.id
WHERE t.name ILIKE '%babycare%'
  OR t.slug ILIKE '%babycare%'
GROUP BY t.name, t.id

UNION ALL

SELECT 
  t.name,
  t.id,
  'inventory_items',
  COUNT(*),
  MAX(ii.created_at)
FROM tenants t
LEFT JOIN inventory_items ii ON ii.tenant_id = t.id
WHERE t.name ILIKE '%babycare%'
  OR t.slug ILIKE '%babycare%'
GROUP BY t.name, t.id

UNION ALL

SELECT 
  t.name,
  t.id,
  'inventory_logs',
  COUNT(*),
  MAX(il.created_at)
FROM tenants t
LEFT JOIN inventory_logs il ON il.tenant_id = t.id
WHERE t.name ILIKE '%babycare%'
  OR t.slug ILIKE '%babycare%'
GROUP BY t.name, t.id
ORDER BY tenant_name, table_name;
```

**Expected:** If Babycare tenant has records, tables are actively used

---

#### 3. Application Flow Trace

**Trace this workflow in production logs/database:**

```text
Babycare User Action
        ↓
API endpoint (e.g., /api/inventory/create-item)
        ↓
Service layer (src/services/inventory-actions.ts)
        ↓
Supabase query
        ↓
INSERT INTO inventory_items (...)
        ↓
Record created in production DB
```

**Evidence needed:**
- Recent inventory_items records for Babycare tenant
- Corresponding inventory_logs for movements
- Active API usage logs (if available)

---

### C. Schema Compatibility Analysis

**Compare production schema vs migration 20260510**

#### Compatibility Matrix

| Aspect | Production | Migration 20260510 | Match? | Action |
|--------|-----------|-------------------|---------|---------|
| **packages columns** | (from query A2) | 33 columns | TBD | Document differences |
| **packages FKs** | (from query A3) | tenant_id, template_id | TBD | Must match |
| **packages indexes** | (from query A4) | 4 indexes | TBD | Migration can add missing |
| **packages RLS** | (from query A5) | 2 policies | TBD | Migration can add missing |
| **inventory_items columns** | (from query A2) | 12 columns | TBD | Document differences |
| **inventory_items FKs** | (from query A3) | tenant_id | TBD | Must match |
| **inventory_items indexes** | (from query A4) | 4 indexes | TBD | Migration can add missing |
| **inventory_items RLS** | (from query A5) | 1 policy | TBD | Migration can add missing |
| **inventory_logs columns** | (from query A2) | 13 columns | TBD | Document differences |
| **inventory_logs FKs** | (from query A3) | 4 FKs | TBD | Must match |
| **inventory_logs indexes** | (from query A4) | 5 indexes | TBD | Migration can add missing |
| **inventory_logs RLS** | (from query A5) | 1 policy | TBD | Migration can add missing |

---

#### Critical Compatibility Rules

**MUST MATCH (Migration-breaking if different):**
- Column names
- Column data types
- Column nullability (for NOT NULL columns)
- Primary keys
- Foreign key targets (must reference same tables)

**CAN DIFFER (Migration can add/modify):**
- Indexes (can add more)
- RLS policies (can add/strengthen)
- Check constraints (can add if compatible with data)
- Column defaults (for nullable columns)

**CANNOT DIFFER (Breaking change):**
- Removing columns
- Changing column types incompatibly
- Removing FKs
- Changing PK

---

## 🚦 Decision Tree

### Scenario 1: Tables Exist + Schema Compatible ✅

```text
Production has all 3 tables
        ↓
Schema matches migration (or compatible)
        ↓
Babycare actively uses them
        ↓
CONCLUSION: Migration is restoration of missing CREATE statements
        ↓
ACTION: Proceed to Step 3 (Fresh DB test)
```

---

### Scenario 2: Tables Exist + Schema INCOMPATIBLE ❌

```text
Production has tables
        ↓
Schema DIFFERS from migration
        ↓
CONCLUSION: Migration would create incompatible schema
        ↓
ACTION: STOP. Document differences. Revise migration to match production.
```

**Example incompatibility:**
```text
Production: inventory_items has column "location" (TEXT)
Migration: Does not include "location"
→ Fresh DB would be missing column
→ Application code may break
```

---

### Scenario 3: Tables Do NOT Exist ⚠️

```text
Production does NOT have these tables
        ↓
But application code references them
        ↓
CONCLUSION: Either:
  A. Tables in different schema/database
  B. Application code is dead code
  C. Babycare is broken in production
        ↓
ACTION: STOP. Investigate before migration.
```

---

## 📋 Evidence Checklist

**Before proceeding to Step 3:**

### Production Schema Evidence
- [ ] Query A1: Table existence confirmed
- [ ] Query A2: Full column schema documented
- [ ] Query A3: Constraints documented
- [ ] Query A4: Indexes documented
- [ ] Query A5: RLS policies documented
- [ ] Query A6: Triggers documented (if any)
- [ ] Query A7: Data existence confirmed

### Babycare Usage Evidence
- [ ] Code references verified (already done)
- [ ] Active transactions found in production
- [ ] Babycare tenant has records
- [ ] Recent activity timestamps
- [ ] Application flow traced

### Compatibility Analysis
- [ ] Column schema compared (production vs migration)
- [ ] FK targets verified
- [ ] Critical incompatibilities: NONE found
- [ ] Acceptable differences: Documented
- [ ] Decision: COMPATIBLE / INCOMPATIBLE / REQUIRES REVISION

---

## ✅ Success Criteria

**Step 2 complete when:**

1. ✅ All 7 production schema queries executed
2. ✅ Full schema documented for all 3 tables
3. ✅ Babycare usage confirmed (not just type imports)
4. ✅ Compatibility analysis complete
5. ✅ Decision made: PROCEED / STOP / REVISE

**If PROCEED:**
- Schema compatible
- Babycare actively uses tables
- Migration restoration justified
- → Advance to Step 3 (Fresh DB test)

**If STOP:**
- Schema incompatible OR
- Tables don't exist OR
- No active usage
- → Revise strategy before migration

---

## 🔒 Safety Reminder

**This is READ-ONLY verification.**

```text
❌ DO NOT run migrations on production
❌ DO NOT modify schemas
❌ DO NOT alter tables
❌ DO NOT drop/create objects

✅ ONLY read information_schema
✅ ONLY document findings
✅ ONLY analyze compatibility
```

---

## 📝 Documentation Template

**After completing queries, document:**

```markdown
# Babycare Production Schema Verification Results

## Tables Found
- [ ] packages: YES / NO
- [ ] inventory_items: YES / NO
- [ ] inventory_logs: YES / NO

## Schema Compatibility
- [ ] packages: COMPATIBLE / INCOMPATIBLE / NOT FOUND
- [ ] inventory_items: COMPATIBLE / INCOMPATIBLE / NOT FOUND
- [ ] inventory_logs: COMPATIBLE / INCOMPATIBLE / NOT FOUND

## Active Usage Confirmed
- [ ] Babycare tenant records found: YES / NO
- [ ] Recent activity: YES / NO (last activity: DATE)
- [ ] Application operations active: YES / NO

## Decision
- [ ] PROCEED to Step 3 (Fresh DB test)
- [ ] STOP - Schema incompatible (details: ___)
- [ ] STOP - Tables not found (details: ___)
- [ ] REVISE migration (required changes: ___)

## Key Findings
(Document critical differences, unexpected discoveries, etc.)
```

---

**Status:** ⏸️ READY TO EXECUTE  
**Prerequisites:** Access to Babycare production database (READ-ONLY)  
**Next:** Execute queries A1-A7, verify usage, analyze compatibility  
**Outcome:** GO/NO-GO decision for Step 3
