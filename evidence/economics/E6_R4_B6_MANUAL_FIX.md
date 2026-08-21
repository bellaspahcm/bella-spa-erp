# E6 R4 B6 — MANUAL FIX REQUIRED

**Bug:** B6 - Migration Automation Failure  
**Requirement:** R4 Unique Constraint Validation  
**Status:** ⏸️ BLOCKED - Manual SQL execution required  
**Date:** 2026-08-22 05:41:50

---

## 🐛 PROBLEM

**Migration Script Failed:**
```
❌ Migration failed: supabase.rpc(...).catch is not a function
```

**Test Result:**
```
❌ AC4.2: Duplicate receipt rejected: Duplicate was NOT rejected (BUG)
R4 Test: 4/5 PASS (duplicate detection failed)
```

**Root Cause:**
Migration automation script could not apply unique index to database.
Index `idx_receipts_unique` does NOT exist.
Duplicate receipts are currently allowed (violates AC4.1).

---

## 🔧 MANUAL FIX

### Step 1: Open Supabase SQL Editor

URL: https://lvnvkpyxtuilhrabtlwv.supabase.co  
Navigate to: **SQL Editor** → **New Query**

### Step 2: Execute SQL

Copy and paste this exact SQL:

```sql
-- E6 R4: Receipt Unique Constraint
-- Prevent duplicate receipts (tenant + PO + vendor + date)

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_unique
ON logistics_warehouse_receipts (tenant_id, po_number, vendor_id, received_date)
WHERE deleted_at IS NULL;

-- Verify index created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname = 'idx_receipts_unique';
```

### Step 3: Verify Success

Expected output:
```
indexname            | indexdef
---------------------+----------------------------------------------------------
idx_receipts_unique  | CREATE UNIQUE INDEX idx_receipts_unique ON ...
```

### Step 4: Record Timestamp

After SQL execution completes successfully, record:
- Execution time: [YOUR TIMESTAMP HERE]
- Success confirmed: YES/NO

---

## ✅ VERIFICATION

### Rerun R4 Test

```powershell
$env:SUPABASE_URL="https://lvnvkpyxtuilhrabtlwv.supabase.co"
Get-Content .env.local | ForEach-Object { 
  if ($_ -match '^([^=]+)=(.*)$') { 
    Set-Item -Path "env:$($matches[1])" -Value $matches[2].Trim() 
  } 
}
node scripts/e6/test-r4-unique-constraint.mjs
```

### Expected Result

```
✅ AC4.1: First receipt created successfully
✅ AC4.2: Duplicate receipt rejected
✅ AC4.2: Error message informative
✅ AC4.3: Different PO number allowed
✅ AC4.3: Different date allowed
✅ AC4.4: Soft-deleted receipt allows recreation

📊 Total: 6/6 PASS
✅ R4 VERIFICATION PASS
```

---

## 📊 REWORK CLASSIFICATION

**After successful manual application and retest:**

### If Test PASSES (6/6):

**Classification:** ❌ Migration Tooling Friction (NOT Bella bug)
- SQL itself is correct
- Automation delivery failed
- Manual application succeeded
- **Counts in C₆:** NO

**Rework Time:** 0 days (not implementation bug)

**Evidence:**
- Migration SQL is valid PostgreSQL
- Index creation succeeds when executed manually
- No code changes to Bella implementation needed
- Pure infrastructure/tooling issue

### If Test STILL FAILS:

**Classification:** ✅ Schema/Contract Bug (Bella bug)
- SQL has error or wrong constraint
- Deeper investigation required
- **Counts in C₆:** YES

**Next Steps:**
- Investigate why index doesn't work
- Check for data conflicts
- Revise SQL or schema design

---

## 📋 PROTOCOL CHECKLIST

After manual fix:

- [ ] SQL executed in Supabase SQL Editor
- [ ] Index verified created (`pg_indexes` query)
- [ ] R4 test rerun
- [ ] Test result: PASS / FAIL
- [ ] B6 classification determined
- [ ] B6 rework time recorded (if applicable)
- [ ] E6_BUG_LOG.md updated with resolution
- [ ] E6_WORK_LOG.md updated with timestamp
- [ ] E6_VERIFICATION_LOG.md updated with R4 result

---

## 🎯 CURRENT STATUS

```
R1: ✅ PASS (78cff0f4)
R2: ✅ PASS (6ae1c90e)
R3: ✅ PASS (0de3cc12)
R4: ⏸️  BLOCKED (B6 - manual fix required)
R5-R15: ⏳ PENDING

Progress: 3/15 (20%)
C₆ Rework: 0.0086d (not counting B6 yet)
T₆: Running from 2026-08-21 23:06:39
```

---

**Created:** 2026-08-22 05:41:50  
**Status:** ⏸️ AWAITING MANUAL SQL EXECUTION  
**Next:** Retest R4 after index created

