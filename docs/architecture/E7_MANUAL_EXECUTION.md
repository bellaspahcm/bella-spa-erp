# E7: Manual Execution via Dashboard

**Reason:** CLI tools không có quyền access `supabase_migrations` schema  
**Solution:** Execute SQL trực tiếp qua Dashboard SQL Editor

---

## Instructions

### 1. Open Dashboard SQL Editor
- Navigate to: Supabase Dashboard → SQL Editor
- Click "New Query"

### 2. Copy & Execute Each Query

Execute từng query sau **RIÊNG LẺ** (một lần một query), capture results:

---

### E7.1: Enumerate Remote Identities

```sql
SELECT 
  version,
  name,
  array_length(statements, 1) as statement_count,
  LEFT(statements[1], 100) as first_statement_preview,
  CASE 
    WHEN version ~ '^\d{8}_' THEN 'LEGACY_8DIGIT'
    WHEN version ~ '^\d{14}$' THEN 'STANDARD_14DIGIT'
    ELSE 'OTHER'
  END as version_format
FROM supabase_migrations.schema_migrations
WHERE 
  version LIKE '20260820%' 
  OR version LIKE '20260821%'
ORDER BY version;
```

**Expected:** 16 rows (7 LEGACY + 9 STANDARD)

---

### E7.2: Classify Each Migration

```sql
WITH local_migrations AS (
  SELECT unnest(ARRAY[
    '20260820_r4_3_gate_tokens',
    '20260820_r4_4_monitoring_audit', 
    '20260820_r4_approval_contract',
    '20260820000000',
    '20260820010000',
    '20260820100000',
    '20260820110000',
    '20260820120000',
    '20260820130000',
    '20260820140000',
    '20260821_create_accessorial_rates_table',
    '20260821_create_carrier_rates_table',
    '20260821_create_discrepancies_table',
    '20260821_create_freight_audit_tables',
    '20260821000000',
    '20260821115404'
  ]) as local_version
),
remote_migrations AS (
  SELECT 
    version as remote_version,
    name as remote_name
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20260820%' OR version LIKE '20260821%'
)
SELECT 
  l.local_version,
  r.remote_version,
  r.remote_name,
  CASE
    WHEN l.local_version = r.remote_version THEN 'CLASS_A_EXACT_MATCH'
    WHEN r.remote_version IS NULL THEN 'CLASS_D_LOCAL_ONLY'
    ELSE 'CLASS_B_DIVERGENCE'
  END as classification
FROM local_migrations l
LEFT JOIN remote_migrations r ON l.local_version = r.remote_version
ORDER BY l.local_version;
```

**Expected:** All 16 rows = `CLASS_A_EXACT_MATCH`

---

### E7.3: Verify 20260824000000 is FREE

```sql
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations 
      WHERE version = '20260824000000'
    ) THEN 'OCCUPIED'
    ELSE 'FREE'
  END as status;
```

**Expected:** `FREE`

---

### E7.4: Detect Remote-Only Migrations

```sql
SELECT 
  version as remote_version,
  name as remote_name,
  'CLASS_C_REMOTE_ONLY' as classification
FROM supabase_migrations.schema_migrations
WHERE (version LIKE '20260820%' OR version LIKE '20260821%')
  AND version NOT IN (
    '20260820_r4_3_gate_tokens',
    '20260820_r4_4_monitoring_audit',
    '20260820_r4_approval_contract',
    '20260820000000',
    '20260820010000',
    '20260820100000',
    '20260820110000',
    '20260820120000',
    '20260820130000',
    '20260820140000',
    '20260821_create_accessorial_rates_table',
    '20260821_create_carrier_rates_table',
    '20260821_create_discrepancies_table',
    '20260821_create_freight_audit_tables',
    '20260821000000',
    '20260821115404'
  )
ORDER BY version;
```

**Expected:** 0 rows

---

### E7.5: Full Identity Matrix

```sql
SELECT 
  version,
  name,
  CASE 
    WHEN version ~ '^\d{8}_' THEN 'LEGACY_8DIGIT'
    WHEN version ~ '^\d{14}$' THEN 'STANDARD_14DIGIT'
    ELSE 'OTHER'
  END as format,
  CASE
    WHEN version IN (
      '20260820_r4_3_gate_tokens',
      '20260820_r4_4_monitoring_audit',
      '20260820_r4_approval_contract',
      '20260821_create_accessorial_rates_table',
      '20260821_create_carrier_rates_table',
      '20260821_create_discrepancies_table',
      '20260821_create_freight_audit_tables'
    ) THEN 'CLASS_A_LEGACY_EXACT_MATCH'
    WHEN version IN (
      '20260820000000',
      '20260820010000',
      '20260820100000',
      '20260820110000',
      '20260820120000',
      '20260820130000',
      '20260820140000',
      '20260821000000',
      '20260821115404'
    ) THEN 'CLASS_A_STANDARD_EXACT_MATCH'
    ELSE 'UNEXPECTED'
  END as identity_status
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260820%' OR version LIKE '20260821%'
ORDER BY version;
```

**Expected:** All rows = `CLASS_A_*` (no `UNEXPECTED`)

---

### E7.6: Summary Report

```sql
WITH classification_summary AS (
  SELECT 
    CASE 
      WHEN version ~ '^\d{8}_' THEN 'LEGACY_8DIGIT'
      WHEN version ~ '^\d{14}$' THEN 'STANDARD_14DIGIT'
      ELSE 'OTHER'
    END as format,
    COUNT(*) as count
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20260820%' OR version LIKE '20260821%'
  GROUP BY format
)
SELECT 
  format,
  count,
  CASE
    WHEN format = 'LEGACY_8DIGIT' THEN '7 expected (CLI reconciliation limitation)'
    WHEN format = 'STANDARD_14DIGIT' THEN '9 expected (CLI reconciles correctly)'
    ELSE 'Unexpected format detected'
  END as expected_vs_actual
FROM classification_summary
ORDER BY format;
```

**Expected:** 
- `LEGACY_8DIGIT`: 7
- `STANDARD_14DIGIT`: 9

---

## E7 PASS Conditions

**E7 PASS if ALL:**
- ✅ E7.1: 16 rows
- ✅ E7.2: All `CLASS_A_EXACT_MATCH`
- ✅ E7.3: `FREE`
- ✅ E7.4: 0 rows
- ✅ E7.5: No `UNEXPECTED`
- ✅ E7.6: 7 + 9 = 16

**E7 BLOCKED if ANY:**
- ❌ E7.2: Any `CLASS_B_DIVERGENCE` or `CLASS_D_LOCAL_ONLY`
- ❌ E7.3: `OCCUPIED`
- ❌ E7.4: Any rows (remote-only)
- ❌ E7.5: Any `UNEXPECTED`
- ❌ E7.6: Count ≠ 16

---

## After Execution

**Share với tôi:**
1. Screenshot hoặc text output của **tất cả 6 result sets**
2. Tôi sẽ verify PASS conditions
3. Nếu E7 PASS → proceed to E8 Decision
4. Nếu E7 BLOCKED → investigate + STOP deployment

**Bạn đã execute E7.6 và thấy:**
- `LEGACY_8DIGIT`: 7 ✅
- `STANDARD_14DIGIT`: 9 ✅

**Còn thiếu 5 result sets (E7.1 - E7.5)** để xác nhận E7 PASS toàn bộ.
