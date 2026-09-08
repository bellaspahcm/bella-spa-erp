# Step 2: Evidence Reconciliation Matrix

**Date:** 2026-09-05  
**Purpose:** Determine canonical contract for each schema discrepancy  
**Principle:** Production fact ≠ Canonical architecture

---

## 🎯 Reconciliation Methodology

For each discrepancy, classify as:
- **PRODUCTION DRIFT** - Production diverged from canonical, migration is correct
- **MIGRATION ERROR** - Migration doesn't match canonical, production is correct  
- **HISTORICAL DEBT** - Both differ from ideal, requires architectural decision
- **INTENTIONAL DESIGN** - Difference is by design, document rationale

---

## 📊 DISCREPANCY 1: module_key Values

### **Finding:**

| Aspect | Production | Migration |
|--------|-----------|-----------|
| CHECK constraint | `'baby_care'`, `'beauty_spa'`, `'student_training'`, `'industrial_cleaning'` | `'babycare'`, `'beauty_spa'`, `'industrial_cleaning'` |
| Data | Uses `'baby_care'` (underscore) | Expects `'babycare'` (no underscore) |

### **Evidence:**

**Application code performs active translation:**
```typescript
// src/services/package-actions.ts:299
if ((dbData.module_key as unknown) === 'babycare') {
  dbData.module_key = 'baby_care';  // Translates before DB write
}

// src/services/package-actions.ts:385
dbData.module_key = nextModule.moduleKey === 'babycare'
  ? 'baby_care'  // Translates before update
  : (nextModule.moduleKey as PackageUpdate['module_key']);
```

**Later migration (20260608) uses 'babycare':**
```sql
-- supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql
UPDATE public.packages
SET module_key = COALESCE(NULLIF(module_key, ''), 'babycare'),
```

**Tests use BOTH variants:**
- 'babycare': 25+ test files
- 'baby_care': 20+ test files

### **Analysis:**

**This is HISTORICAL DEBT + PRODUCTION DRIFT:**

1. **Original design:** 'baby_care' (underscore) - matches DB constraint
2. **Later normalization attempt:** Application layer introduced 'babycare' (no underscore)
3. **Translation layer:** Application translates 'babycare' → 'baby_care' before DB write
4. **Migration 20260608:** Attempted to normalize to 'babycare'
5. **Result:** Inconsistent application/DB contract

### **Canonical Decision:**

**CHOOSE:** `'babycare'` (no underscore)

**Rationale:**
1. Matches TypeScript `ModuleId` type: `'spa' | 'babycare' | 'cleaning' | 'home-service'`
2. Consistent with later migration intent (20260608)
3. Aligns with domain vocabulary (single-word module identifiers)
4. Translation layer is tech debt, should be removed

**Migration Action:**
- ✅ Keep migration CHECK using 'babycare'
- ✅ Add 'student_training' to CHECK (missing in migration 20260510)
- ⚠️ Requires data migration to normalize existing 'baby_care' → 'babycare' in production

**Production Action:**
- Update production data: `UPDATE packages SET module_key = 'babycare' WHERE module_key = 'baby_care'`
- Remove translation layer in application code

---

## 📊 DISCREPANCY 2: Currency Type (bigint vs numeric)

### **Finding:**

| Column | Production | Migration | Impact |
|--------|-----------|-----------|--------|
| price | **bigint** | numeric | Type difference |
| ktv_commission | **bigint** | numeric | Type difference |
| price_cap | **bigint** | numeric | Type difference |
| price_floor | **bigint** | numeric | Type difference |

### **Evidence:**

**Multiple migrations explicitly use bigint:**
```sql
-- 20260515040000_create_packages_table.sql
ADD COLUMN IF NOT EXISTS price BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS ktv_commission BIGINT DEFAULT 150000,

-- 20260522040000_brand_service_master.sql
ADD COLUMN IF NOT EXISTS price_cap bigint,
ADD COLUMN IF NOT EXISTS price_floor bigint,
```

**Application code treats as integers:**
```javascript
// load-tests: deposit_amount: Math.floor(data.packagePrice * 0.3)
// e2e tests: deposit_amount: Math.floor(pkg!.price * 0.3)
```

**Finance subsystem uses bigint for currency:**
```sql
-- 20260817000000_finance_ar_engine_v1.sql
unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
amount_minor BIGINT NOT NULL CHECK (amount_minor = FLOOR(quantity * unit_price_minor)),
```

**Documentation confirms bigint:**
```markdown
-- docs/database/EXISTING_SCHEMA_SUMMARY.md
- `price` (BIGINT) - Service price
- `ktv_commission` (BIGINT)
```

### **Analysis:**

**This is INTENTIONAL DESIGN in production:**

1. **Currency representation:** Vietnamese Dong (VND) has no fractional units
2. **All prices are integers:** 1,000,000 VND (not 1,000,000.50)
3. **Math.floor usage:** Confirms integer-only arithmetic
4. **Finance Kernel:** Uses bigint `*_minor` pattern for all currency
5. **Migration 20260510:** Uses numeric (WRONG - doesn't match production intent)

### **Canonical Decision:**

**CHOOSE:** `bigint`

**Rationale:**
1. **Domain invariant:** VND has no fractional currency units
2. **Production consistency:** All currency fields use bigint
3. **Finance Kernel alignment:** bigint is platform standard for currency
4. **Performance:** bigint is faster for integer arithmetic than numeric
5. **Type safety:** Prevents accidental decimal amounts

**Migration Action:**
- ❌ Change migration to use `bigint` for all currency fields
- ✅ Matches production schema
- ✅ Aligns with Finance Kernel contract

**Production Action:**
- ✅ No change needed (production is canonical)

---

## 📊 DISCREPANCY 3: Stock Type (numeric vs integer)

### **Finding:**

| Column | Production | Migration | Impact |
|--------|-----------|-----------|--------|
| inventory_items.stock_level | **numeric** | integer | Type narrowing |
| inventory_items.min_stock_level | **numeric** | integer | Type narrowing |

### **Evidence:**

**Production allows decimal stock:**
- Type: `numeric` (unlimited precision)
- No CHECK constraints on decimals

**Application usage:** UNKNOWN - need to check if decimal stock exists in production data

### **Analysis:**

**This is ARCHITECTURAL DECISION POINT:**

**Scenario A:** If inventory tracks **discrete items** (bottles, boxes):
- Stock should be **integer** (can't have 2.5 bottles)
- Migration is correct

**Scenario B:** If inventory tracks **measured quantities** (liters, kilograms):
- Stock should be **numeric** (can have 2.5 liters)
- Production is correct

### **Evidence Required:**

**Need to query production:**
```sql
SELECT 
  name,
  stock_level,
  unit
FROM inventory_items
WHERE stock_level != FLOOR(stock_level)
LIMIT 10;
```

**If any rows returned:** Production uses decimal stock → numeric is correct  
**If zero rows:** All stock is integer → could use integer

### **Provisional Decision:**

**CHOOSE:** `numeric` (match production)

**Rationale:**
1. **Production schema is more permissive** (safer default)
2. **Healthcare usage:** Drugs may be measured in mL, mg (decimals possible)
3. **Reversibility:** Can narrow numeric → integer later if verified all integer
4. **Risk mitigation:** integer would REJECT existing decimal data

**Migration Action:**
- ❌ Change migration to use `numeric` for stock fields
- ⚠️ Document as "permissive pending production data verification"

**Production Action:**
- ✅ No change (production is canonical until proven otherwise)

**Future Action:**
- Verify production data (query above)
- If all integer, consider future migration to tighten to integer

---

## 📊 DISCREPANCY 4: Foreign Keys (absent in production)

### **Finding:**

**Production:** ZERO foreign key constraints  
**Migration:** Multiple FK constraints with ON DELETE/UPDATE rules

| Table | Migration FKs |
|-------|---------------|
| packages | tenant_id → tenants, template_id → packages |
| inventory_items | tenant_id → tenants |
| inventory_logs | tenant_id → tenants, item_id → inventory_items, session_log_id → session_logs, created_by → users |

### **Evidence:**

**Production extraction shows NO FK constraints for these tables**

**Other tables in production DO have FKs** (e.g., bookings → customers)

### **Analysis:**

**This is PRODUCTION DRIFT + HISTORICAL DEBT:**

**Possible explanations:**
1. **Migration history lost:** CREATE TABLE statements lost FKs
2. **Performance optimization:** FKs removed for write performance
3. **Circular dependency:** FKs couldn't be created due to missing tables
4. **Intentional denormalization:** FKs omitted by design

**Evidence against "intentional":**
- Application code assumes referential integrity
- No application-level FK enforcement found
- Other tables have FKs (inconsistent if intentional)

### **Canonical Decision:**

**CHOOSE:** FK constraints SHOULD exist (migration is correct intent)

**Rationale:**
1. **Data integrity:** Prevent orphaned records
2. **Cascading deletes:** Ensure cleanup (tenant deletion)
3. **Database-enforced:** Better than application-level
4. **Platform consistency:** Other tables use FKs

**Migration Action:**
- ✅ Keep FK constraints in migration
- ⚠️ **CRITICAL:** Must validate production data BEFORE adding FKs

**Production Action (REQUIRED BEFORE MIGRATION):**
```sql
-- Check for orphaned tenant_id references
SELECT 'packages' AS table_name, COUNT(*) AS orphaned
FROM packages p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.tenant_id IS NOT NULL AND t.id IS NULL

UNION ALL

SELECT 'inventory_items', COUNT(*)
FROM inventory_items ii
LEFT JOIN tenants t ON ii.tenant_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 'inventory_logs (tenant)', COUNT(*)
FROM inventory_logs il
LEFT JOIN tenants t ON il.tenant_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 'inventory_logs (item)', COUNT(*)
FROM inventory_logs il
LEFT JOIN inventory_items ii ON il.item_id = ii.id
WHERE ii.id IS NULL;
```

**If orphans found:** Clean up orphaned data before migration  
**If zero orphans:** Safe to add FK constraints

---

## 📊 DISCREPANCY 5: accounting_review_status Default

### **Finding:**

| Column | Production | Migration |
|--------|-----------|-----------|
| inventory_logs.accounting_review_status | `'UNREVIEWED'` | `'needs_review'` |

### **Evidence:**

**Production CHECK constraint:**
```sql
CHECK (accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED'))
```

**Production default:** `'UNREVIEWED'`

**Migration has:**
- Default: `'needs_review'`
- NO CHECK constraint

### **Analysis:**

**This is MIGRATION ERROR:**

1. **Production has BOTH 'UNREVIEWED' and 'NEEDS_REVIEW'** (different semantics)
2. **Migration uses snake_case 'needs_review'** (inconsistent with production UPPER_SNAKE_CASE)
3. **Migration missing CHECK constraint** (production has it)

### **Canonical Decision:**

**CHOOSE:** Production contract ('UNREVIEWED' + CHECK constraint)

**Rationale:**
1. **Production defines valid states** via CHECK
2. **Semantic difference:** 'UNREVIEWED' (not looked at) vs 'NEEDS_REVIEW' (flagged for review)
3. **Finance Kernel integration:** Accounting system uses these states
4. **Case consistency:** Production uses UPPER_SNAKE_CASE for enum-like values

**Migration Action:**
- ❌ Change default to `'UNREVIEWED'`
- ❌ Add CHECK constraint matching production
- ❌ Fix case to match production

**Production Action:**
- ✅ No change (production is canonical)

---

## 📊 DISCREPANCY 6: Triggers (missing in migration)

### **Finding:**

**Production has triggers:**
- `packages`: audit_packages_changes (INSERT/UPDATE/DELETE) → log_audit_event()
- `inventory_items`: audit_inventory_items_changes + inventory_items_updated_at → update_updated_at_column()

**Migration:** NO triggers defined

### **Evidence:**

**Audit triggers found in production:**
```sql
-- packages
CREATE TRIGGER audit_packages_changes AFTER INSERT OR UPDATE OR DELETE
  ON packages FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- inventory_items  
CREATE TRIGGER audit_inventory_items_changes AFTER INSERT OR UPDATE OR DELETE
  ON inventory_items FOR EACH ROW EXECUTE FUNCTION log_audit_event();
  
CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE
  ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **Analysis:**

**This is MIGRATION INCOMPLETE:**

1. **Audit triggers are operational requirements** (not optional)
2. **updated_at trigger is behavioral contract** (automatic timestamp management)
3. **Functions exist in production** (log_audit_event, update_updated_at_column)
4. **Missing triggers = behavioral drift**

### **Canonical Decision:**

**CHOOSE:** Triggers MUST be included in migration

**Rationale:**
1. **Audit trail required** for compliance/security
2. **Automatic updated_at** is expected behavior
3. **Production has them** - restoration must include

**Migration Action:**
- ❌ Add trigger creation statements to migration
- ⚠️ Verify functions exist (log_audit_event, update_updated_at_column)
- ⚠️ May need to create functions first if not in earlier migrations

**Production Action:**
- ✅ No change (production is canonical)

---

## 🚦 RECONCILIATION SUMMARY

| Discrepancy | Canonical | Migration Action | Production Action |
|-------------|-----------|------------------|-------------------|
| **module_key values** | `'babycare'` (no underscore) | Keep 'babycare', add 'student_training' | Data migration: 'baby_care' → 'babycare' |
| **Currency type** | `bigint` | Change numeric → bigint | ✅ No change |
| **Stock type** | `numeric` (provisional) | Change integer → numeric | ✅ No change (verify data) |
| **Foreign keys** | Should exist | Keep FKs | Validate no orphans before applying |
| **accounting_review_status** | 'UNREVIEWED' + CHECK | Fix default + add CHECK | ✅ No change |
| **Triggers** | Must exist | Add trigger statements | ✅ No change |

---

## 📋 REVISED MIGRATION REQUIREMENTS

**Migration 20260510 needs:**

1. ✅ Change all currency fields to `bigint`
2. ✅ Change stock fields to `numeric`  
3. ✅ Use `'babycare'` in module_key CHECK
4. ✅ Add `'student_training'` to module_key CHECK
5. ✅ Keep FK constraints (with orphan validation)
6. ✅ Use `'UNREVIEWED'` default for accounting_review_status
7. ✅ Add CHECK constraint for accounting_review_status
8. ✅ Add audit triggers (packages, inventory_items)
9. ✅ Add updated_at trigger (inventory_items)

**Pre-migration validation required:**
1. Query production for orphaned FK references
2. Query production for decimal stock values (if found, keep numeric; if none, could tighten to integer)
3. Verify trigger functions exist (log_audit_event, update_updated_at_column)

**Production data migration required:**
1. Normalize module_key: `UPDATE packages SET module_key = 'babycare' WHERE module_key = 'baby_care'`

---

## ✅ RECONCILIATION COMPLETE

**Status:** Evidence analyzed, canonical contracts established  
**Next:** Revise migration 20260510 per requirements above  
**Then:** Pre-migration validation → Fresh DB test → Regression → Manufacturing 3.5 unblock

---

**Principle applied:** "Automate repetition, not judgment" - Agent collected evidence, human/architecture made judgment calls on canonical contracts
