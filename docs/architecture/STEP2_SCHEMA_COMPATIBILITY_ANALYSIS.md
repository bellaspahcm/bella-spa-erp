# Step 2: Schema Compatibility Analysis

**Date:** 2026-09-05  
**Database:** lvnvkpyxtuilhrabtlwv (Bella Platform Production)  
**Migration:** 20260510000000_create_spa_core_tables.sql

---

## 🎯 Compatibility Analysis Methodology

**Comparison:**
```text
Production Schema (lvnvkpyxtuilhrabtlwv)
          vs
Migration 20260510000000
```

**Classification:**
- ✅ **COMPATIBLE** - Safe, no conflict
- ⚠️ **MATERIAL DIFFERENCE** - Requires investigation
- ❌ **MISSING IN MIGRATION** - Migration incomplete
- ❌ **MISSING IN PRODUCTION** - Migration creates new objects
- ❓ **UNKNOWN** - Needs evidence

---

## 📊 TABLE 1: packages

### ✅ **COLUMNS: COMPATIBLE**

**Total columns:**
- Production: 33 columns
- Migration: 33 columns

| Column | Production Type | Migration Type | Match | Notes |
|--------|----------------|----------------|-------|-------|
| id | uuid | uuid | ✅ | PK, default gen_random_uuid() |
| name | text NOT NULL | text NOT NULL | ✅ | |
| description | text NULL | text NULL | ✅ | |
| full_price | numeric NOT NULL | numeric NOT NULL | ✅ | |
| total_sessions | integer NOT NULL | integer NOT NULL | ✅ | Default 15 (prod) vs 1 (migration) ⚠️ |
| status | text NULL | text NULL | ✅ | Default 'active' (both) |
| tenant_id | uuid NULL | uuid NULL | ⚠️ | Production allows NULL, Migration has FK |
| created_at | timestamptz NULL | timestamptz NULL | ✅ | Default now() |
| updated_at | timestamptz NULL | timestamptz NULL | ✅ | Default now() |
| price | bigint NULL | numeric NULL | ⚠️ | **TYPE MISMATCH** |
| duration | text NULL | text NULL | ✅ | Default '90 min/session' |
| details | text[] NULL | text[] NULL | ✅ | Default '{}' |
| ktv_commission | bigint NULL | numeric NULL | ⚠️ | **TYPE MISMATCH** |
| offer | text NULL | text NULL | ✅ | Default '' |
| is_hq_template | boolean NULL | boolean NULL | ✅ | Default false |
| template_id | uuid NULL | uuid NULL | ✅ | Self-reference FK |
| price_cap | bigint NULL | numeric NULL | ⚠️ | **TYPE MISMATCH** |
| price_floor | bigint NULL | numeric NULL | ⚠️ | **TYPE MISMATCH** |
| allowed_franchise_override | boolean NULL | boolean NULL | ✅ | Default true |
| session_multiplier | numeric(3,2) NULL | numeric NULL | ⚠️ | Production has precision constraint |
| module_key | text NOT NULL | text NOT NULL | ✅ | Default 'babycare' (prod) |
| service_kind | text NOT NULL | text NOT NULL | ✅ | Default 'treatment_package' |
| service_category | text NULL | text NULL | ✅ | |
| default_duration_minutes | integer NOT NULL | integer NOT NULL | ✅ | Default 90 |
| requires_resource | boolean NOT NULL | boolean NOT NULL | ✅ | Default false |
| default_resource_type | text NULL | text NULL | ✅ | |
| before_after_required | boolean NOT NULL | boolean NOT NULL | ✅ | Default false |
| care_note_template | text NULL | text NULL | ✅ | |
| estimated_duration | integer NULL | integer NULL | ✅ | |
| required_workers | integer NULL | integer NULL | ✅ | |
| metadata | jsonb NULL | jsonb NULL | ✅ | Default '{}' |
| product_usage | jsonb NULL | jsonb NULL | ✅ | Default '{}' |

### ⚠️ **TYPE MISMATCHES (packages):**

**Production uses `bigint` for currency fields, Migration uses `numeric`:**
- `price`: bigint (prod) vs numeric (migration)
- `ktv_commission`: bigint (prod) vs numeric (migration)
- `price_cap`: bigint (prod) vs numeric (migration)
- `price_floor`: bigint (prod) vs numeric (migration)

**Classification:** ⚠️ **MATERIAL DIFFERENCE**

**Impact:**
- `numeric` is MORE flexible (decimal support)
- `bigint` is integer-only
- **Migration would WIDEN types** (bigint → numeric)
- **Functionally compatible** (numeric can store bigint values)
- **BUT: Application code may expect bigint semantics**

**Recommendation:** INVESTIGATE - Check if application code performs integer-only arithmetic or allows decimals

---

### ⚠️ **FOREIGN KEYS: PARTIAL MISMATCH**

| FK | Production | Migration | Match |
|----|------------|-----------|-------|
| tenant_id → tenants | ❌ **NOT PRESENT** | ✅ `ON DELETE CASCADE` | ⚠️ **MISSING IN PRODUCTION** |
| template_id → packages | ❌ **NOT PRESENT** | ✅ `ON DELETE SET NULL` | ⚠️ **MISSING IN PRODUCTION** |

**Classification:** ❌ **MISSING IN PRODUCTION**

**Impact:**
- Production has NO foreign key constraints
- Migration would ADD FK constraints
- **Existing data may violate FK constraints**
- **Cannot apply migration safely without data validation**

**Critical:** Must verify no orphaned references before migration

---

### ⚠️ **CHECK CONSTRAINTS: PARTIAL MISMATCH**

**Production:**
```sql
CHECK default_duration_minutes BETWEEN 1 AND 1440
CHECK default_resource_type IN ('bed', 'room', 'machine', 'chair', 'other') OR NULL
CHECK module_key IN ('baby_care', 'beauty_spa', 'student_training', 'industrial_cleaning')
CHECK service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation')
```

**Migration:**
```sql
CHECK default_duration_minutes BETWEEN 1 AND 1440  ✅ MATCH
CHECK module_key IN ('babycare', 'beauty_spa', 'industrial_cleaning')  ⚠️ DIFFERENT
CHECK service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation')  ✅ MATCH
-- default_resource_type check NOT in migration  ❌ MISSING
```

**Classification:** ⚠️ **MATERIAL DIFFERENCE**

**Differences:**
1. **module_key values differ:**
   - Production: `'baby_care'` (underscore)
   - Migration: `'babycare'` (no underscore)
   - Production has: `'student_training'` (missing in migration)
   - Migration missing: `'student_training'`

2. **default_resource_type check missing in migration**

**Impact:** Migration would REJECT existing production data with module_key = 'baby_care' or 'student_training'

---

### ✅ **INDEXES: COMPATIBLE**

**Production has 5 indexes, Migration creates 4:**

| Index | Production | Migration | Match |
|-------|------------|-----------|-------|
| packages_pkey (id) | ✅ | ✅ | ✅ MATCH |
| idx_packages_tenant_module_kind | ✅ | ✅ | ✅ MATCH |
| idx_packages_template_id | ✅ | ✅ | ✅ MATCH |
| idx_packages_is_hq_template | ✅ | ✅ | ✅ MATCH (partial) |
| idx_packages_product_usage (GIN) | ✅ | ✅ | ✅ MATCH |

**Classification:** ✅ **COMPATIBLE** - Migration uses IF NOT EXISTS

---

### ✅ **RLS: COMPATIBLE**

**Production:**
- RLS enabled: YES
- Policies: 2 (Tenant read packages, Tenant admin manage packages)

**Migration:**
- RLS enabled: YES
- Policies: 2 (same names)

**Classification:** ✅ **COMPATIBLE** - CREATE POLICY will skip if exists

---

### ❌ **TRIGGERS: MISSING IN MIGRATION**

**Production has 3 triggers:**
```sql
audit_packages_changes (INSERT/UPDATE/DELETE) → log_audit_event()
```

**Migration:** NO triggers defined

**Classification:** ❌ **MISSING IN MIGRATION**

**Impact:** Migration does NOT recreate audit triggers

---

## 📊 TABLE 2: inventory_items

### ✅ **COLUMNS: MOSTLY COMPATIBLE**

| Column | Production Type | Migration Type | Match | Notes |
|--------|----------------|----------------|-------|-------|
| id | uuid NOT NULL | uuid NOT NULL | ✅ | PK, default gen_random_uuid() |
| tenant_id | uuid NOT NULL | uuid NOT NULL | ✅ | FK to tenants |
| name | text NOT NULL | text NOT NULL | ✅ | |
| sku | text NULL | text NULL | ✅ | |
| unit | text NOT NULL | text NOT NULL | ✅ | Default 'cái' (prod) vs 'unit' (migration) ⚠️ |
| stock_level | numeric NOT NULL | integer NOT NULL | ⚠️ | **TYPE MISMATCH** |
| min_stock_level | numeric NOT NULL | integer NOT NULL | ⚠️ | **TYPE MISMATCH** |
| price_per_unit | numeric NOT NULL | numeric NOT NULL | ✅ | |
| category | text NULL | text NULL | ✅ | |
| notes | text NULL | text NULL | ✅ | |
| created_at | timestamptz NULL | timestamptz NULL | ✅ | Default now() |
| updated_at | timestamptz NULL | timestamptz NULL | ✅ | Default now() |

### ⚠️ **TYPE MISMATCHES (inventory_items):**

**Stock fields:**
- `stock_level`: numeric (prod) vs integer (migration)
- `min_stock_level`: numeric (prod) vs integer (migration)

**Classification:** ⚠️ **MATERIAL DIFFERENCE**

**Impact:**
- Production allows decimal stock levels (e.g., 2.5 liters)
- Migration would restrict to integers
- **Migration would NARROW types** (numeric → integer)
- **INCOMPATIBLE if production has decimal stock data**

**Recommendation:** CRITICAL - Check if production data contains decimal stock values

---

### ❌ **FOREIGN KEYS: MISSING IN PRODUCTION**

| FK | Production | Migration | Match |
|----|------------|-----------|-------|
| tenant_id → tenants | ❌ **NOT PRESENT** | ✅ `ON DELETE CASCADE` | ⚠️ **MISSING IN PRODUCTION** |

**Classification:** ❌ **MISSING IN PRODUCTION**

**Impact:** Migration would ADD FK constraint, may fail if orphaned tenant_id references exist

---

### ❌ **CHECK CONSTRAINTS: MISSING IN PRODUCTION**

**Production:** NO check constraints

**Migration:**
```sql
CHECK stock_level >= 0
CHECK min_stock_level >= 0
CHECK price_per_unit >= 0
```

**Classification:** ❌ **MISSING IN PRODUCTION**

**Impact:** Migration would ADD constraints, may fail if production has negative values

---

### ⚠️ **INDEXES: EXTRA IN MIGRATION**

**Production:** 2 indexes
**Migration:** 4 indexes + 1 unique

| Index | Production | Migration | Match |
|-------|------------|-----------|-------|
| inventory_items_pkey | ✅ | ✅ | ✅ |
| idx_inventory_items_tenant | ✅ | ✅ | ✅ |
| idx_inventory_items_sku | ❌ | ✅ | ❌ **MISSING IN PRODUCTION** |
| idx_inventory_items_category | ❌ | ✅ | ❌ **MISSING IN PRODUCTION** |
| idx_inventory_items_tenant_sku_unique | ❌ | ✅ | ❌ **MISSING IN PRODUCTION** |

**Classification:** ✅ **COMPATIBLE** - Migration adds more indexes (safe)

---

### ✅ **RLS: COMPATIBLE**

**Production:** RLS enabled, 1 policy (Tenant isolation)
**Migration:** RLS enabled, 1 policy (same name)

**Classification:** ✅ **COMPATIBLE**

---

### ❌ **TRIGGERS: MISSING IN MIGRATION**

**Production has 4 triggers:**
```sql
audit_inventory_items_changes (INSERT/UPDATE/DELETE) → log_audit_event()
inventory_items_updated_at (UPDATE) → update_updated_at_column()
```

**Migration:** NO triggers defined

**Classification:** ❌ **MISSING IN MIGRATION**

**Impact:** Audit + updated_at triggers NOT recreated

---

## 📊 TABLE 3: inventory_logs

### ✅ **COLUMNS: MOSTLY COMPATIBLE**

| Column | Production Type | Migration Type | Match | Notes |
|--------|----------------|----------------|-------|-------|
| id | uuid NOT NULL | uuid NOT NULL | ✅ | PK |
| tenant_id | uuid NOT NULL | uuid NOT NULL | ✅ | FK |
| item_id | uuid NOT NULL | uuid NOT NULL | ✅ | FK to inventory_items |
| change_amount | numeric NOT NULL | numeric NOT NULL | ✅ | |
| reason | text NOT NULL | text NOT NULL | ✅ | Default 'restock' |
| session_log_id | uuid NULL | uuid NULL | ✅ | FK to session_logs |
| notes | text NULL | text NULL | ✅ | |
| created_by | uuid NULL | uuid NULL | ✅ | FK to users |
| created_at | timestamptz NULL | timestamptz NULL | ✅ | Default now() |
| business_event_type | text NULL | text NULL | ✅ | |
| accounting_template_id | uuid NULL | uuid NULL | ✅ | FK to accounting_event_templates |
| accounting_review_status | text NOT NULL | text NOT NULL | ✅ | Default 'UNREVIEWED' (prod) vs 'needs_review' (migration) ⚠️ |
| accounting_metadata | jsonb NOT NULL | jsonb NOT NULL | ✅ | Default '{}' |

### ⚠️ **DEFAULT VALUE MISMATCH:**

**accounting_review_status:**
- Production: `'UNREVIEWED'`
- Migration: `'needs_review'`

**Classification:** ⚠️ **MATERIAL DIFFERENCE**

**Impact:** New rows would have different default values depending on when created

---

### ❌ **FOREIGN KEYS: MISSING IN PRODUCTION**

**Production:** NO foreign keys

**Migration:**
```sql
tenant_id → tenants (ON DELETE CASCADE)
item_id → inventory_items (ON DELETE RESTRICT)
session_log_id → session_logs (ON DELETE SET NULL)
created_by → users (ON DELETE SET NULL)
-- accounting_template_id FK commented out in migration
```

**Classification:** ❌ **MISSING IN PRODUCTION**

**Impact:** Migration would ADD FKs, may fail if orphaned references exist

---

### ⚠️ **CHECK CONSTRAINTS: DIFFERENT**

**Production:**
```sql
CHECK accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED')
```

**Migration:** NO check constraints on accounting_review_status

**Classification:** ❌ **MISSING IN MIGRATION**

**Impact:** Migration does NOT enforce accounting_review_status values

---

### ✅ **INDEXES: COMPATIBLE**

**Production:** 4 indexes
**Migration:** 5 indexes

All production indexes present in migration. Migration adds one extra (created_at).

**Classification:** ✅ **COMPATIBLE**

---

### ✅ **RLS: COMPATIBLE**

**Production:** RLS enabled, 1 policy
**Migration:** RLS enabled, 1 policy (same name)

**Classification:** ✅ **COMPATIBLE**

---

### ❌ **TRIGGERS: NONE IN PRODUCTION**

**Production:** NO triggers
**Migration:** NO triggers

**Classification:** ✅ **COMPATIBLE** (both have none)

---

## 🚦 FINAL CLASSIFICATION

### **TABLE: packages**

| Aspect | Status | Critical Issue |
|--------|--------|----------------|
| Columns | ⚠️ MATERIAL DIFFERENCE | bigint vs numeric types |
| Foreign Keys | ❌ MISSING IN PRODUCTION | Would ADD constraints |
| Check Constraints | ⚠️ MATERIAL DIFFERENCE | module_key values differ ('baby_care' vs 'babycare') |
| Indexes | ✅ COMPATIBLE | |
| RLS | ✅ COMPATIBLE | |
| Triggers | ❌ MISSING IN MIGRATION | Audit triggers not recreated |

**Decision:** ⚠️ **REVISE REQUIRED**

**Critical Issues:**
1. **module_key CHECK constraint mismatch** - Production has 'baby_care', migration expects 'babycare'
2. **Missing FK constraints in production** - Cannot add without data validation
3. **Currency type mismatch** - bigint vs numeric needs application code review

---

### **TABLE: inventory_items**

| Aspect | Status | Critical Issue |
|--------|--------|----------------|
| Columns | ⚠️ MATERIAL DIFFERENCE | Stock levels: numeric vs integer |
| Foreign Keys | ❌ MISSING IN PRODUCTION | Would ADD constraints |
| Check Constraints | ❌ MISSING IN PRODUCTION | Would ADD non-negative checks |
| Indexes | ✅ COMPATIBLE | Migration adds more (safe) |
| RLS | ✅ COMPATIBLE | |
| Triggers | ❌ MISSING IN MIGRATION | Audit + updated_at triggers not recreated |

**Decision:** ⚠️ **REVISE REQUIRED**

**Critical Issues:**
1. **Stock type mismatch** - numeric (prod) vs integer (migration) - INCOMPATIBLE if decimal stock exists
2. **Missing FK in production** - Cannot add without validation
3. **Triggers missing** - updated_at automation lost

---

### **TABLE: inventory_logs**

| Aspect | Status | Critical Issue |
|--------|--------|----------------|
| Columns | ⚠️ MATERIAL DIFFERENCE | accounting_review_status default differs |
| Foreign Keys | ❌ MISSING IN PRODUCTION | Would ADD 4 FKs |
| Check Constraints | ❌ MISSING IN MIGRATION | accounting_review_status values not enforced |
| Indexes | ✅ COMPATIBLE | |
| RLS | ✅ COMPATIBLE | |
| Triggers | ✅ COMPATIBLE | None in both |

**Decision:** ⚠️ **REVISE REQUIRED**

**Critical Issues:**
1. **Default value mismatch** - 'UNREVIEWED' vs 'needs_review'
2. **Missing FKs in production** - 4 foreign keys not enforced
3. **CHECK constraint missing in migration** - accounting_review_status values not validated

---

## 🎯 OVERALL DECISION: **REVISE**

### **Summary:**

**Migration 20260510 is NOT a faithful restoration of production schema.**

**Critical Gaps:**

1. **Type Mismatches:**
   - packages: bigint vs numeric (4 columns)
   - inventory_items: numeric vs integer (stock fields)

2. **Production has NO Foreign Key constraints**
   - Migration assumes FKs exist
   - Adding FKs may fail on orphaned data

3. **CHECK Constraint Mismatches:**
   - packages.module_key: 'baby_care' (prod) vs 'babycare' (migration)
   - inventory_logs.accounting_review_status: enforced in prod, not in migration

4. **Triggers Missing:**
   - packages: 3 audit triggers
   - inventory_items: 4 triggers (audit + updated_at)

5. **Default Value Mismatches:**
   - inventory_logs.accounting_review_status: 'UNREVIEWED' vs 'needs_review'

### **Risk Assessment:**

**IF applied to fresh DB:** Migration would create INCOMPATIBLE schema
**IF applied to production:** Migration would FAIL on constraint additions

---

## 📋 RECOMMENDATIONS

### **Option A: Revise Migration to Match Production**

Update 20260510 to:
1. Use correct types (bigint where production uses bigint)
2. Remove FK constraints (production doesn't have them)
3. Fix module_key CHECK (use 'baby_care' not 'babycare')
4. Add missing CHECK for accounting_review_status
5. Use correct default values
6. Add trigger creation statements

**Pros:** Faithful restoration
**Cons:** Large revision required

---

### **Option B: Treat as Schema Normalization**

Accept that migration creates "idealized" schema, then:
1. Document differences as "production drift"
2. Create separate data migration to align production
3. Use migration as "future target schema"

**Pros:** Clean future schema
**Cons:** Requires production schema update path

---

### **Option C: Stop Restoration Approach**

If differences too large, reconsider whether restoration migration is correct approach.

**Alternative:** Generate actual DDL from production, use that as migration

---

## 🔒 FINAL STATUS

**Step 2:** 🟡 **COMPLETE with REVISE recommendation**

**Evidence collected:** ✅ COMPLETE
**Schema compatibility:** ❌ **INCOMPATIBLE**
**Migration accuracy:** ❌ **NOT FAITHFUL to production**

**Cannot proceed to Step 3 (Fresh DB test) until migration revised.**

---

**Next Gate:** User decision on revision approach (Option A, B, or C)
