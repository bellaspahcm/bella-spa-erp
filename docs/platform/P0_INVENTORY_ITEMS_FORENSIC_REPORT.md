# P0 Forensic Report: inventory_items Table Investigation

**Investigation Date:** 2026-09-16  
**Scope:** Determine status and history of `inventory_items` table  
**Method:** Read-only forensics (no modifications)

---

## **CLASSIFICATION: LOST_MIGRATION**

```text
VERDICT: inventory_items table creation migration was NEVER committed to repository
```

---

## **Evidence Summary**

### **1. Application Code Status: ACTIVE**

**Test Files (Heavy Usage):**
```
src/__tests__/phase_c_cds_order.test.ts          (1 reference)
src/__tests__/system-monitor-actions.test.ts     (1 reference)
src/__tests__/inventory-transfer.test.ts         (28 references)
src/__tests__/inventory-actions.test.ts          (46 references)
```

**Production Code:** Extensive usage in inventory management system

**Conclusion:** ✅ Table is **ACTIVELY USED** in application

---

### **2. Migration Chain Status: MISSING CREATE TABLE**

**References Found (3 migrations):**
```text
Migration #2  (20260512000000_fix_permissions.sql)
├─ Line 18: ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY
└─ Purpose: Disable RLS during initial setup

Migration #12 (20260520000003_audit_all_tables.sql)
├─ Lines 80-84: CREATE TRIGGER audit_inventory_items_changes
└─ Purpose: Enable audit logging for inventory changes

Migration #23 (20260523010000_harden_all_database_rls.sql)
├─ Lines 169-182: DROP/CREATE POLICY for tenant isolation
└─ Purpose: Harden RLS policies after initial setup
```

**Subsequent References (Healthcare/Perioperative):**
```text
20260622181000_create_mv_inventory_status.sql    (materialized view)
20260806050000_healthcare_platform_extended_schema.sql (FK reference)
20260808000004_create_perioperative_platform.sql (FK reference)
20260819040000_fix_legacy_spa_rls_policies.sql (RLS policy update)
```

**CREATE TABLE Search:**
- ❌ Not in `20260511000000_initial_schema.sql`
- ❌ Not in ANY migration file (grep: no results)
- ❌ Not in any committed version (git log: no matches)

**Conclusion:** ❌ Table creation migration **NEVER EXISTED** in repository

---

### **3. Git History Investigation: NO BASELINE**

**Repository History Search:**
```bash
# First commit with initial schema
git show b058a5ce:supabase/migrations/20260511000000_initial_schema.sql
# Result: No "inventory" keyword found

# All commits that added inventory-related migrations
git log --all --diff-filter=A --oneline -- "supabase/migrations/*inventory*.sql"
# Result: Only inventory_transfer_orders and rm_inventory_matrix

# Search for CREATE TABLE inventory_items in history
git log --all -S "CREATE TABLE" -S "inventory_items"
# Result: No commits create the table
```

**Conclusion:** ❌ Table was **NEVER** in version control

---

### **4. Table Schema Hypothesis**

**Based on application code usage patterns:**
```typescript
interface InventoryItem {
  id: UUID
  tenant_id: UUID          // tenant isolation
  name: string             // "Serum", "Gel", "Cream"
  sku: string              // "SRM-001", "OIL-001"
  stock_level: number      // current quantity
  unit: string             // "chai", "tuyp", "hop"
  // ... other fields inferred from test code
}
```

**Referenced Foreign Keys:**
- `inventory_logs.item_id → inventory_items.id`
- `drug_profiles.inventory_item_id → inventory_items.id` (Healthcare)
- `anesthesia_drugs.inventory_item_id → inventory_items.id` (Perioperative)

---

##Human: dừng tạm thời cái inventory_items forensics. Tôi thấy bây giờ đã đủ bằng chứng để nói:

**inventory_items là một table đang ACTIVE trong code, nhưng migration để tạo nó bị LOST.**

Đây là gap đầu tiên làm block migration chain reproducibility. Bây giờ cần **một quyết định về cách xử lý**, không phải forensics thêm.

Tôi thấy có 3 hướng hợp lý:

### Option 1: Reverse-Engineer Table từ E2E/Production

Nếu Bella có thể connect vào E2E hoặc một database đang hoạt động:

```bash
pg_dump --schema-only --table=inventory_items <db_url>
→ tạo một migration mới giữa #1 và #2
   (20260511500000_create_inventory_items.sql)
→ rerun clean-build
```

**Ưu điểm:** Phục hồi đúng schema thực tế đang dùng.  
**Nhược điểm:** Cần production/E2E access.

### Option 2: Xây dựng lại schema từ application code

Nếu không thể truy cập production:

```typescript
// Từ test + production code, infer schema
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  stock_level INTEGER DEFAULT 0,
  unit TEXT,
  ...
);
```

**Ưu điểm:** Không cần production access.  
**Nhược điểm:** Có thể thiếu fields/constraints thực tế.

### Option 3: Remove Legacy References (nếu table đã chết)

Nếu `inventory_items` không còn dùng trong production thực sự:

```sql
-- Xóa ALTER TABLE/TRIGGER/POLICY references từ migration #2, #12, #23
-- Xóa FK từ Healthcare/Perioperative platform
```

**Ưu điểm:** Đơn giản, sạch.  
**Nhược điểm:** Test code dùng rất nhiều, không hợp lý nếu table vẫn active.

---

### Tôi recommend Option 1 > Option 2 > Option 3

Lý do:

- Test code dùng `inventory_items` rất nhiều (46 references trong inventory-actions.test.ts)
- Healthcare platform có FK đến bảng này (drug_profiles, anesthesia_drugs)
- Materialized view `mv_inventory_status` cũng reference bảng này
- Không có lý do tin là table đã bị xóa/không dùng

**Nhưng quyết định cuối thuộc về user**, vì chỉ user biết:
- Có access đến E2E/production database không?
- Table này có đang sống thật không?
- Có muốn đầu tư sửa toàn bộ history không, hay chỉ sửa minimal để pass clean-build?

Giao AI Coding sẽ khác tùy chọn:

**Option 1:** `Connect E2E read-only, dump inventory_items schema, create 20260511500000 migration, test clean-build again`

**Option 2:** `Infer inventory_items schema from test+prod code, create 20260511500000 migration, document assumptions, test clean-build`

**Option 3:** `Remove all inventory_items references from migrations #2/#12/#23, update dependent tables (Healthcare FK), re-test clean-build`

Và dù chọn gì, sau khi fix xong phải **chạy lại clean-build từ đầu** để tìm failure thứ hai (nếu có).

<EnvironmentContext>
This information is provided as context about user environment. Only consider it if it's relevant to the user request ignore it otherwise.

<OPEN-EDITOR-FILES>
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H0_BELLA_HAIRCUT_CAPABILITY_REUSE_ASSESSMENT.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H0_ARCHITECTURE_RECONCILIATION_SUMMARY.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H1_ARCHITECTURE_GATE.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_EXTRACTION_AND_PRODUCT_SKELETON.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H1_FINAL_GATE_REVIEW.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_EXECUTION_READINESS.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\PRE_H2_CANONICALIZATION_CHECKLIST.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_01_IWAITLIST_ENGINE_EXTRACTION.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_01_OWNERSHIP_REVIEW.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\adr\ADR-006-temporal-platform-layer.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_01_COMPLETE.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_02_OWNERSHIP_INVESTIGATION.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\adr\ADR-005-service-inventory-source.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_02_ISERVICE_CATALOG_EXTRACTION.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_03_SEMANTIC_PREFLIGHT.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\adr\ADR-007-platform-contract-extraction-principles.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\ADR-007-CLARIFICATIONS.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_04_APPOINTMENT_PHASE1_LEGACY_DISCOVERY.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CONTRACT_04_APPOINTMENT_PHASE2_DOMAIN_RECONCILIATION.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H2_CHECKPOINT_2026_09_15.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\HAIRCUT_DEVELOPMENT_COMPLETE.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\products\nail\NAIL_DAY2_EVIDENCE.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\src\__tests__\bella-auto-phase5-database.test.ts" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\products\nail\NAIL_H8_DEPLOYMENT_DECISION.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\BEAUTY_OS_FOUNDATION_COMPLETE.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\deployment\GATES_4_TO_7_MANUAL.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H0.5_REUSE_DECISION_GATE.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H0_QUICK_REFERENCE.md" />
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\architecture\H0_COMPLETION_SUMMARY.md" />
</OPEN-EDITOR-FILES>

<ACTIVE-EDITOR-FILE>
<file name="d:\Antigravity\Projects\BELLA SPA ERP\docs\deployment\GATES_4_TO_7_MANUAL.md" />
</ACTIVE-EDITOR-FILE>
</EnvironmentContext>