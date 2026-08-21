# E0 BOUNDARY DISCIPLINE: DATABASE CHECKS

**Context:** G3a Layer 2.2 preparation  
**Critical:** Database validation capability vs domain knowledge  
**Status:** PRE-EXECUTION GUIDANCE  

---

## 🔐 THE BOUNDARY RULE

**Database validation capability** → ALLOWED in kernel ✅  
**Database schema/Amendment 12 knowledge** → NOT ALLOWED in kernel ❌

---

## ALLOWED IN BDGF KERNEL

**Generic database validation primitives:**

```javascript
// ✅ ALLOWED: Generic capability
'database-table-exists'      // Check if any table exists
'database-column-type'       // Verify column data type
'database-constraint-check'  // Check constraint existence
'database-index-check'       // Verify index existence
'database-fk-check'          // Check foreign key
'database-uniqueness'        // Verify unique constraint
'database-migration-state'   // Check migration tracking
'database-schema-metadata'   // Read schema information
```

**These are infrastructure primitives, not domain logic.**

---

## NOT ALLOWED IN BDGF KERNEL

**Domain-specific logic:**

```javascript
// ❌ NOT ALLOWED: Domain knowledge
if (table === 'amendment_12_xxx')           // Hardcoded domain table
if (table === 'canonical_tenant_map')       // Knows business concept
if (column === 'reconciliation_phase')      // Knows domain field
if (table.includes('tenant'))               // Domain pattern matching

// ❌ NOT ALLOWED: Business semantics
'check-tenant-reconciliation'               // Domain business rule
'validate-amendment-12-state'               // Domain-specific validation
'ensure-reservation-complete'               // Business process knowledge
```

**These embed domain knowledge into kernel.**

---

## THE CORRECT PATTERN

### Generic Check (in kernel)

```javascript
// check-registry.mjs
'database-table-exists': async (config) => {
  const { tableName, schema = 'public' } = config;
  
  // Generic: check any table
  const exists = await checkTableExists(schema, tableName);
  
  return {
    status: exists ? 'PASS' : 'FAIL',
    message: exists 
      ? `Table ${schema}.${tableName} exists`
      : `Table ${schema}.${tableName} not found`
  };
}
```

**No domain knowledge. Parameterized. Reusable.**

---

### Domain Knowledge (in config)

```json
// e0-artifact-integrity.json
{
  "id": "check-canonical-map-not-exists",
  "name": "Precondition: canonical_tenant_map does NOT exist",
  "type": "database-table-exists",
  "config": {
    "tableName": "canonical_tenant_map",
    "schema": "public",
    "expectExists": false
  }
}
```

**Domain knowledge:** `canonical_tenant_map` is Amendment 12 concept  
**Where it lives:** Config (not kernel)  
**Kernel just checks:** "Does this table exist?" (generic)

---

## CLASSIFICATION EXAMPLES

### Example 1: Table Existence

**Question:** E0 needs to verify `canonical_tenant_map` doesn't exist yet

**Wrong approach (domain in kernel):**
```javascript
// ❌ DON'T DO THIS
'check-canonical-map-not-exists': async () => {
  const exists = await checkTableExists('public', 'canonical_tenant_map');
  return exists ? 'FAIL' : 'PASS';
}
```
**Why wrong:** Kernel knows about `canonical_tenant_map` (domain concept)

**Right approach (domain in config):**
```javascript
// ✅ Kernel: Generic
'database-table-exists': async (config) => {
  return await checkTableExists(config.schema, config.tableName);
}
```
```json
// ✅ Config: Domain
{
  "type": "database-table-exists",
  "config": {
    "tableName": "canonical_tenant_map",
    "expectExists": false
  }
}
```
**Why right:** Kernel is generic, config specifies domain

---

### Example 2: Column Type

**Question:** E0 needs to verify `tenant_id` is TEXT (not UUID yet)

**Wrong approach:**
```javascript
// ❌ DON'T DO THIS
'check-tenant-id-is-text': async () => {
  const type = await getColumnType('runtime_tenant_registry', 'tenant_id');
  return type === 'text' ? 'PASS' : 'FAIL';
}
```
**Why wrong:** Knows about tenant_id (domain field)

**Right approach:**
```javascript
// ✅ Kernel: Generic
'database-column-type': async (config) => {
  const type = await getColumnType(config.tableName, config.columnName);
  return type === config.expectedType ? 'PASS' : 'FAIL';
}
```
```json
// ✅ Config: Domain
{
  "type": "database-column-type",
  "config": {
    "tableName": "runtime_tenant_registry",
    "columnName": "tenant_id",
    "expectedType": "text"
  }
}
```
**Why right:** Kernel checks any column, config specifies which

---

### Example 3: Query Execution

**Question:** E0 needs to count TEXT fixtures (must be 5)

**Wrong approach:**
```javascript
// ❌ DON'T DO THIS
'check-text-fixture-count': async () => {
  const count = await query(`
    SELECT COUNT(*) FROM runtime_tenant_registry 
    WHERE tenant_id NOT IN (
      SELECT id::text FROM public.tenants
    )
  `);
  return count === 5 ? 'PASS' : 'FAIL';
}
```
**Why wrong:** Hardcoded business query in kernel

**Right approach:**
```javascript
// ✅ Kernel: Generic
'database-query': async (config) => {
  const result = await executeQuery(config.query, config.params);
  
  if (config.expectedCount !== undefined) {
    return result.count === config.expectedCount ? 'PASS' : 'FAIL';
  }
  // ... other generic comparisons
}
```
```json
// ✅ Config: Domain
{
  "type": "database-query",
  "config": {
    "query": "SELECT COUNT(*) as count FROM runtime_tenant_registry WHERE ...",
    "expectedCount": 5,
    "description": "5 TEXT fixtures must be present"
  }
}
```
**Why right:** Kernel executes any query, config provides domain query

---

## CLASSIFICATION DECISION TREE

**When adding database check, ask:**

```
Does this check work for ANY table/column/schema?
    YES → Generic capability → Add to kernel ✅
    NO ↓

Does this check require Amendment 12 knowledge?
    YES → Domain-specific → Keep in config ⬜
    NO ↓

Is this a one-off hack just to pass E0?
    YES → Don't add anywhere ❌
```

---

## EXAMPLES: CLASSIFICATION

### ✅ Generic (Add to Kernel)

- Check if table exists
- Verify column data type
- Count rows matching condition (parameterized)
- Check constraint exists
- Verify index exists
- Get database version
- Check user privileges

**Common property:** Works for any database/table/column

---

### ⬜ Domain (Keep in Config)

- Know that `canonical_tenant_map` is Amendment 12 table
- Know that `tenant_id` is business identifier
- Know that 5 fixtures is correct count
- Know that TEXT → UUID is migration goal
- Know that `reconciliation_phase` is business state

**Common property:** Requires Amendment 12 understanding

---

### ❌ One-off (Don't Add)

- Check specifically for Amendment 12 migration state
- Hardcode table names in kernel
- Embed business rules in check logic
- Create "amendment-12-validator" check type

**Common property:** Not reusable, domain-specific

---

## THE 6-STEP PROCESS

### 1. Baseline E0 (Already Done)

✅ 33/33 legacy captured

---

### 2. Identify Generic Capabilities Missing

**Review E0 checks:**
- 15 file-based → Existing `file-existence`, `regex-match` ✅
- 10 database → **Evaluate case-by-case** ⬜
- 8 pattern → Existing `regex-match` ✅

**DO NOT assume all 6 database types must be added.**

**Let E0 requirements drive the decision:**

For each E0 check:
1. Can existing primitives handle this? → Use existing ✅
2. Need new capability? → Classify:
   - Generic (reusable) → Add to kernel
   - Domain-specific → Keep in config
   - One-off hack → Don't add

**Possible database capabilities (if needed):**
- `database-table-exists`
- `database-column-type`
- `database-schema-exists`
- `database-query`
- `database-version`
- `database-privilege`

**Add only what E0 proves is genuinely generic and reusable.**

---

### 3. Enhance Check Registry (Controlled)

**This is P0 enhancement, not arbitrary expansion.**

**Critical principle:**
> BDGF can know HOW to check database  
> BDGF cannot know THE DATABASE OF AMENDMENT 12

**Add generic capabilities only, and only if proven necessary.**

**Do NOT:**
- Add Amendment 12-specific checks
- Hardcode domain table names
- Embed business logic
- Create "shortcut" checks for E0
- Assume all 6 database types must be added

**Test each new primitive independently with non-Amendment-12 data before using in E0.**

**This proves:** BDGF can self-extend capability while maintaining architectural boundary.

---

### 4. Create E0 Configuration

**Domain knowledge lives here:**
- Table names: `canonical_tenant_map`, `runtime_tenant_registry`
- Column names: `tenant_id`, `reconciliation_phase`
- Expected values: 5 fixtures, TEXT type, etc.

**Config calls generic checks with domain parameters**

---

### 5. Execute BDGF E0

**Target:** 33/33 PASS

**If fail:**
- Classify: Missing generic capability? Domain in kernel? Bug?
- Fix correctly (don't hack)
- Re-execute

---

### 6. Freeze E0

**Only after:**
- 33/33 functional equivalence ✅
- Boundary maintained ✅
- Evidence archived ✅
- Differential A ≡ B ✅

**Then:** `LAYER_2_2_FROZEN.md`

---

## AFTER E0: NO IMMEDIATE AUDIT

**Correct sequence:**

```
E0 → Freeze
  ↓
E1 → 10/10
  ↓
95/95 migration complete
  ↓
Architecture Audit (7 audits)
  ↓
Differential Verification
  ↓
G3a Decision
```

**Reason:** Want full migration evidence before architectural assessment

---

## THE MILESTONE AHEAD

**Current:**
```
Specification
  → Executable Governance
    → Real Governance Replacement
      → 52/95 Architectural Proof
```

**After E0 + E1:**
```
→ 95/95 real governance checks
  running on reusable governance infrastructure
```

**This validates platform bet before investing in:**
- P1: Rollback Harness
- P1: Scope Guard
- P1: Human GO Controller
- P2: Compliance Reporter

---

## SESSION FOCUS (NEXT)

**Single objective:**

🔵 **G3a Layer 2.2 — E0 Artifact Integrity: 33/33**

**Approach:**
- Prove → Evidence → Freeze → Move on

**No scope expansion**  
**No premature optimization**  
**No P1 build**

**Just:** E0 validation with boundary discipline

---

## BOUNDARY DISCIPLINE CHECKLIST

Before adding ANY database check to kernel, confirm:

- [ ] Works for any table/column (not just Amendment 12)
- [ ] Parameterized (no hardcoded domain values)
- [ ] Reusable (Healthcare/Finance/Education can use it)
- [ ] No business logic (pure infrastructure)
- [ ] Domain knowledge in config (not kernel)

**If any NO:** Don't add to kernel

---

**🔐 PRINCIPLE:** Database capability ≠ database schema knowledge  
**📍 BOUNDARY:** Generic validation (kernel) vs domain specifics (config)  
**🎯 GOAL:** E0 33/33 with boundary maintained  

---

## THE DEEPER PROOF

**E0 is not just "does it work?"**

**E0 proves three things:**

1. **Functional equivalence:** 33/33 A ≡ B (same as Layer 2.1)
2. **Boundary discipline:** No Amendment 12 in kernel (same as Layer 2.1)  
3. **Self-extension capability:** BDGF can add generic capabilities without breaking boundary **(NEW)**

**The third proof is critical for platform confidence.**

**Why this matters:**

If BDGF cannot extend safely:
- Every new OS (Healthcare, Finance, Education) needs kernel modification
- Boundary erodes over time
- Platform becomes monolith

If BDGF can extend safely:
- New governance needs add generic capabilities
- Boundary stays clean
- Platform scales sustainably

**E0 database checks test this architectural property.**

**This is why E0 is harder test than Package Integrity.**

---

## WHAT E0 REALLY VALIDATES

**Not just:** "BDGF can run E0 checks"

**But:** "BDGF can self-extend capability while maintaining architectural boundary"

**Package Integrity (52):** Proven with existing primitives  
**E0 Artifact (33):** Requires new primitives + boundary discipline  

**E0 is architectural stress test, not just functional test.**  
