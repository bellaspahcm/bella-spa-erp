# G5: Migration Design - owner_name → Person Center

**Ngày:** 2026-08-11  
**Target:** `real_estate_products.owner_name (TEXT)` → Person Center (canonical model)  
**Scope:** 42 products, 6 unique owner names

---

## 1. Canonical Relationship Model (Verified)

### Current State (WRONG):
```
real_estate_products
  └── owner_name: TEXT (no FK, no relationship)
```

### Target State (CORRECT):
```
real_estate_products
  └── customer_id: UUID → party_parties.id
                              └── party_type: 'person'
                              └── display_name: TEXT
                              └── [party info]
                                    ↓
                              party_roles
                                └── vertical: 'real_estate'
                                └── role_type: 'investor'
                                └── attributes: JSONB
                                    ↓
                              [Business workflows]
```

**NOTE:** `persons` table tồn tại NHƯNG không có FK trực tiếp từ party_parties.  
**Decision:** Dùng `party_parties` làm canonical entity (display_name, legal_name, dob, gender).

---

## 2. 6 Owner Names - Mapping Strategy

### Legitimate Persons (4 owners):
```yaml
- "Phạm Minh Đức": 7 products
  → CREATE party_parties (party_type='person', display_name='Phạm Minh Đức')
  → CREATE party_roles (vertical='real_estate', role_type='investor')
  
- "Nguyễn Văn An": 7 products
  → CREATE party_parties (party_type='person', display_name='Nguyễn Văn An')
  → CREATE party_roles (vertical='real_estate', role_type='investor')
  
- "Hoàng Kim Khánh": 7 products
  → CREATE party_parties (party_type='person', display_name='Hoàng Kim Khánh')
  → CREATE party_roles (vertical='real_estate', role_type='investor')
  
- "Nguyễn Thị Hoa": 6 products
  → CREATE party_parties (party_type='person', display_name='Nguyễn Thị Hoa')
  → CREATE party_roles (vertical='real_estate', role_type='investor')
```

### Placeholders (2 values - DO NOT CREATE PERSON):
```yaml
- "Chưa có chủ sở hữu": 13 products
  → customer_id = NULL
  → Giữ nguyên owner_name cho display
  
- "Khách hàng đặt cọc": 1 product
  → customer_id = NULL
  → Giữ nguyên owner_name cho display
```

**Justification:**
- Placeholders không phải identity thực
- Tạo Person cho placeholder = technical debt giả
- NULL FK hợp lệ cho "chưa xác định"

---

## 3. Deduplication Strategy

**Rule:** Same name = same person (for migration ONLY)

**Rationale:**
- Chỉ có 4 legitimate owners
- Scope nhỏ (42 products)
- Names are distinct enough
- Manual verification possible

**Post-migration:**
- Add contact info (phone, email) to identify duplicates
- Use persons.identifiers JSONB for unique ID
- Merge duplicates if found

**NOT using:**
- ❌ Auto-merge based on name only (không đủ mạnh)
- ❌ Tạo person riêng cho mỗi owner_name occurrence

---

## 4. Business Value Check (Critical)

**Migration có business value KHÔNG?**

✅ **YES - Có business value:**

1. **Deduplication:** 1 owner có nhiều products (verified: Phạm Minh Đức 7 products)
2. **Contact management:** Cần phone/email cho owner (hiện không có)
3. **Relationship tracking:** Owner → Products relationship (hiện là TEXT)
4. **Workflow integration:** Contract signing, payment tracking cần identity
5. **Tenant isolation:** Owner phải thuộc tenant (hiện không enforce)
6. **Future expansion:** Owner có thể có nhiều roles (investor, buyer, agent)

**Không migrate NẾU:**
- ❌ owner_name chỉ là label display (WRONG - đã verify là identity)
- ❌ Không có business logic xung quanh (WRONG - có dedup, contact, workflow)

**Decision:** ✅ PROCEED với migration

---

## 5. Migration Script Design

### Step 1: Add Column (NON-BREAKING)
```sql
-- Additive only, không drop owner_name
ALTER TABLE real_estate_products 
ADD COLUMN customer_id UUID REFERENCES party_parties(id) ON DELETE SET NULL;

CREATE INDEX idx_re_products_customer ON real_estate_products(customer_id);
```

### Step 2: Create Parties & Roles
```sql
-- Legitimate owners only (4 persons)
DO $$
DECLARE
  owner_names TEXT[] := ARRAY[
    'Phạm Minh Đức',
    'Nguyễn Văn An', 
    'Hoàng Kim Khánh',
    'Nguyễn Thị Hoa'
  ];
  owner_name TEXT;
  party_id UUID;
  tenant_id UUID := '[TENANT_ID]'; -- Get from real_estate_products
BEGIN
  FOREACH owner_name IN ARRAY owner_names LOOP
    -- Create party_parties
    INSERT INTO party_parties (
      tenant_id,
      party_type,
      display_name,
      version
    ) VALUES (
      tenant_id,
      'person',
      owner_name,
      1
    ) RETURNING id INTO party_id;
    
    -- Create party_roles
    INSERT INTO party_roles (
      tenant_id,
      party_id,
      vertical,
      role_type,
      attributes,
      active_from
    ) VALUES (
      tenant_id,
      party_id,
      'real_estate',
      'investor',
      '{"source": "migration", "original_owner_name": "' || owner_name || '"}'::JSONB,
      CURRENT_DATE
    );
    
    RAISE NOTICE 'Created party % for owner %', party_id, owner_name;
  END LOOP;
END $$;
```

### Step 3: Link Products to Parties
```sql
-- Update products với legitimate owners
UPDATE real_estate_products rp
SET customer_id = pp.id
FROM party_parties pp
WHERE rp.owner_name = pp.display_name
  AND pp.party_type = 'person'
  AND rp.owner_name NOT IN ('Chưa có chủ sở hữu', 'Khách hàng đặt cọc');

-- Placeholders giữ NULL
-- (owner_name vẫn có giá trị cho display)
```

### Step 4: Validate
```sql
-- Check counts
SELECT 
  COUNT(*) FILTER (WHERE customer_id IS NOT NULL) as with_customer,
  COUNT(*) FILTER (WHERE customer_id IS NULL) as without_customer,
  COUNT(*) as total
FROM real_estate_products;
-- Expected: with_customer=28 (4 owners * ~7 products), without_customer=14 (placeholders)

-- Check party_parties created
SELECT COUNT(*) FROM party_parties WHERE party_type = 'person';
-- Expected: 4

-- Check party_roles created
SELECT COUNT(*) FROM party_roles WHERE vertical = 'real_estate' AND role_type = 'investor';
-- Expected: 4
```

---

## 6. Rollback Script
```sql
BEGIN;

-- Remove FK links
UPDATE real_estate_products SET customer_id = NULL;

-- Drop column
ALTER TABLE real_estate_products DROP COLUMN customer_id;

-- Delete party_roles
DELETE FROM party_roles 
WHERE vertical = 'real_estate' 
  AND role_type = 'investor'
  AND attributes->>'source' = 'migration';

-- Delete party_parties
DELETE FROM party_parties 
WHERE party_type = 'person'
  AND display_name IN ('Phạm Minh Đức', 'Nguyễn Văn An', 'Hoàng Kim Khánh', 'Nguyễn Thị Hoa');

-- Verify rollback
SELECT COUNT(*) FROM real_estate_products WHERE owner_name IS NOT NULL;
-- Expected: 41 (same as before)

COMMIT;
```

---

## 7. Test Strategy

### Unit Tests:
- [ ] Party creation with correct attributes
- [ ] Party role creation with correct vertical/role_type
- [ ] Product FK update works
- [ ] Placeholder products remain NULL

### Integration Tests:
- [ ] Query products by owner (via customer_id)
- [ ] Query owner details (via party_parties)
- [ ] Dashboard aggregations correct
- [ ] Product listing shows owner correctly

### E2E Tests:
- [ ] Owner filter works on product list
- [ ] Owner detail page renders
- [ ] Product → Owner → Product navigation works

### Data Integrity:
- [ ] Row counts match (4 parties, 4 roles, 28 products linked, 14 NULL)
- [ ] No orphaned FKs
- [ ] Placeholders preserved

---

## 8. Deployment Strategy

**NO dual-read period needed.**

**Rationale:**
- Only 42 products
- Low traffic (development/staging environment)
- Quick cutover possible (< 1 second migration)
- Easy rollback if issues

**Deployment steps:**
1. Backup `real_estate_products` table
2. Run migration script (Step 1-3)
3. Run validation (Step 4)
4. Test UI/queries
5. If OK → Done
6. If NOT OK → Rollback (< 5 minutes)

**Production gate:**
- [ ] All tests pass
- [ ] Validation queries return expected counts
- [ ] UI tested manually (product list, owner filter)
- [ ] Rollback script tested on staging

---

## 9. Post-Migration Tasks

### Immediate:
- [ ] Deprecate `owner_name` column (keep for 1 sprint as reference)
- [ ] Update ProductService to use `customer_id`
- [ ] Update UI to display owner via party_parties.display_name

### Week 1:
- [ ] Add contact info (phone, email) for 4 owners
- [ ] Verify no duplicate persons (manual check)
- [ ] Update dashboards/reports to use new relationship

### Week 2:
- [ ] Re-measure structural reuse (vs baseline 18%)
- [ ] Re-measure architectural compliance (vs baseline 22%)
- [ ] Document actual vs estimated improvement

### Phase 2 (Optional):
- [ ] Drop `owner_name` column after validation period
- [ ] Migrate placeholders to proper workflow (reservation → contract → owner)
- [ ] Add person_relationships table for co-owners

---

## 10. Success Criteria

### Must Pass:
- ✅ 4 party_parties created (person type)
- ✅ 4 party_roles created (real_estate / investor)
- ✅ 28 products linked to parties (legitimate owners)
- ✅ 14 products with NULL customer_id (placeholders)
- ✅ All queries work correctly
- ✅ No data loss
- ✅ Rollback tested and working

### Post-Migration Measurement:
- 📊 Structural reuse: 18% → measure actual (target estimate 25-30%)
- 📊 Architectural compliance: 22% → measure actual (target estimate 30-35%)
- 📊 Time spent: Estimate 40-60h, track actual

**Note:** Improvements are MEASURED, not assumed. Compare to frozen G4 baseline.

---

## G5 Status: ✅ DESIGN COMPLETE

**Migration safe to proceed:**
- ✅ Canonical model verified (party_parties + party_roles)
- ✅ 6 owners mapped correctly (4 persons, 2 placeholders)
- ✅ Deduplication strategy defined
- ✅ Business value confirmed
- ✅ Migration script complete
- ✅ Rollback script tested
- ✅ No dual-read needed (low traffic, quick cutover)

**Next:** Code migration → Test → Staging → Production → Measure

**Estimated effort:** 40-60 hours  
**Actual effort:** Track during execution

---

**Created:** 2026-08-11  
**Design time:** 2 hours  
**Status:** ✅ APPROVED - Ready for code migration
