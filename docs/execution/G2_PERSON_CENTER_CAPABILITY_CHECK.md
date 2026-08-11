# Gate 2: Person Center Capability Validation

**Date:** 2026-08-11  
**Purpose:** Verify Person Center can replace `re_customers` for Real Estate

**Decision:** GO/NO-GO for migration

---

## Schema Comparison

### Current (re_customers)
```sql
CREATE TABLE re_customers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  family_members JSONB DEFAULT '[]',
  co_owners JSONB DEFAULT '[]',
  investment_profile JSONB,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Target (persons + party_roles)
```sql
-- Core identity
CREATE TABLE persons (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  nationality TEXT,
  identifiers JSONB DEFAULT '[]', -- Phone, email, national ID
  contacts JSONB DEFAULT '[]',    -- Phone numbers, emails, addresses
  ...
);

-- Role-specific data
CREATE TABLE party_roles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  party_id UUID NOT NULL REFERENCES party_parties(id),
  vertical TEXT NOT NULL,           -- 'real_estate'
  role_type TEXT NOT NULL,          -- 'real_estate_investor'
  attributes JSONB DEFAULT '{}',    -- Investment profile, preferences
  active_from DATE,
  active_to DATE,
  UNIQUE (tenant_id, party_id, vertical, role_type)
);
```

---

## Capability Matrix

| Capability | Required | Person Center Status | Notes |
|-----------|----------|---------------------|-------|
| **1. Person Identity** | ✅ CRITICAL | ✅ SUPPORTED | `first_name`, `last_name`, `date_of_birth`, `gender` |
| **2. Contact Information** | ✅ CRITICAL | ✅ SUPPORTED | `contacts` JSONB (phone, email) |
| **3. Tenant Isolation** | ✅ CRITICAL | ✅ SUPPORTED | `tenant_id` with RLS policies |
| **4. Party Roles** | ✅ CRITICAL | ✅ SUPPORTED | `party_roles` table with `vertical='real_estate'`, `role_type='investor'` |
| **5. Role Attributes** | ✅ CRITICAL | ✅ SUPPORTED | `attributes` JSONB (investment profile, preferences) |
| **6. Identifiers** | ✅ CRITICAL | ✅ SUPPORTED | `identifiers` JSONB (national ID, passport, etc.) |
| **7. Audit Trail** | ✅ CRITICAL | ✅ SUPPORTED | `created_at`, `updated_at` timestamps |
| **8. Data Migration** | ✅ CRITICAL | ⚠️ TO VERIFY | Need to test INSERT from `re_customers` |
| **9. Relationships** | 🟡 NICE-TO-HAVE | ❌ NOT SUPPORTED | `family_members`, `co_owners` → Need alternative approach |
| **10. Tags** | 🟡 NICE-TO-HAVE | ✅ SUPPORTED | Can store in `party_roles.attributes` as `{tags: []}` |
| **11. Search/Filter** | ✅ CRITICAL | ⚠️ TO VERIFY | Need to test query performance with JOINs |
| **12. Rollback Support** | ✅ CRITICAL | ⚠️ TO VERIFY | Need rollback script |

---

## Critical Gaps Identified

### Gap 1: Relationships (family_members, co_owners)

**Current (re_customers):**
```json
{
  "family_members": [
    {"name": "Jane Doe", "relationship": "spouse", "phone": "+84901234567"}
  ],
  "co_owners": [
    {"name": "John Smith", "relationToPrimary": "business_partner"}
  ]
}
```

**Options:**

**Option A: Store in party_roles.attributes (RECOMMENDED for now)**
```json
{
  "investment_profile": {...},
  "relationships": {
    "family_members": [...],
    "co_owners": [...]
  }
}
```

**Pros:**
- ✅ Simple migration
- ✅ No schema changes needed
- ✅ Preserves existing data structure

**Cons:**
- ❌ Not normalized (cannot query co-owner as Person)
- ❌ No referential integrity

**Option B: Create person_relationships table (FUTURE)**
```sql
CREATE TABLE person_relationships (
  from_person_id UUID REFERENCES persons(id),
  to_person_id UUID REFERENCES persons(id),
  relationship_type TEXT, -- 'spouse', 'co_owner', 'family'
  ...
);
```

**Decision:** Use Option A for Phase 1 migration. Consider Option B for Phase 2.

---

## Capability Verification Tests

### Test 1: Create Person with Real Estate Role

```sql
-- Test creating a Real Estate investor
BEGIN;

-- Insert person
INSERT INTO persons (tenant_id, first_name, last_name, date_of_birth, gender, contacts)
VALUES (
  'test-tenant-id',
  'John',
  'Doe',
  '1985-05-15',
  'male',
  '[
    {"type": "phone", "value": "+84901234567", "primary": true},
    {"type": "email", "value": "john.doe@example.com", "primary": true}
  ]'::JSONB
)
RETURNING id;

-- Insert party_role
INSERT INTO party_roles (tenant_id, party_id, vertical, role_type, attributes)
VALUES (
  'test-tenant-id',
  '[person_id_from_above]',
  'real_estate',
  'investor',
  '{
    "investment_profile": {
      "budgetRange": "5-10B VND",
      "preferredTypes": ["apartment", "villa"],
      "preferredAreas": ["District 1", "District 2"]
    },
    "relationships": {
      "family_members": [],
      "co_owners": []
    },
    "tags": ["high_value", "urgent"]
  }'::JSONB
);

COMMIT;
```

**Result:** [ ] PASS / [ ] FAIL  
**Notes:** _[fill after test]_

---

### Test 2: Query Real Estate Investors

```sql
-- Query all Real Estate investors for a tenant
SELECT 
  p.id,
  p.first_name || ' ' || p.last_name AS full_name,
  p.contacts->0->>'value' AS phone,
  pr.attributes->>'investment_profile' AS investment_profile,
  pr.attributes->>'tags' AS tags,
  p.created_at
FROM persons p
JOIN party_roles pr ON pr.party_id = p.id
WHERE p.tenant_id = 'test-tenant-id'
  AND pr.vertical = 'real_estate'
  AND pr.role_type = 'investor'
ORDER BY p.created_at DESC;
```

**Result:** [ ] PASS / [ ] FAIL  
**Performance:** _[query time]_  
**Notes:** _[fill after test]_

---

### Test 3: Data Migration (Sample)

```sql
-- Migrate ONE row from re_customers to persons + party_roles
BEGIN;

-- Step 1: Insert into persons
INSERT INTO persons (
  id,  -- Keep same ID for traceability
  tenant_id,
  first_name,
  last_name,
  date_of_birth,
  gender,
  contacts,
  created_at,
  updated_at
)
SELECT 
  id,
  tenant_id,
  split_part(name, ' ', 1) AS first_name,  -- Simple split (may need refinement)
  split_part(name, ' ', 2) AS last_name,
  COALESCE(metadata->>'date_of_birth', '1990-01-01')::DATE AS date_of_birth,
  COALESCE(metadata->>'gender', 'prefer-not-to-say') AS gender,
  jsonb_build_array(
    jsonb_build_object('type', 'phone', 'value', phone, 'primary', true),
    jsonb_build_object('type', 'email', 'value', COALESCE(email, ''), 'primary', true)
  ) AS contacts,
  created_at,
  updated_at
FROM re_customers
WHERE id = '[test-customer-id]';

-- Step 2: Insert into party_roles
INSERT INTO party_roles (
  tenant_id,
  party_id,
  vertical,
  role_type,
  attributes,
  active_from
)
SELECT 
  tenant_id,
  id AS party_id,
  'real_estate' AS vertical,
  'investor' AS role_type,
  jsonb_build_object(
    'investment_profile', investment_profile,
    'relationships', jsonb_build_object(
      'family_members', family_members,
      'co_owners', co_owners
    ),
    'tags', COALESCE(tags, ARRAY[]::TEXT[])
  ) AS attributes,
  created_at::DATE AS active_from
FROM re_customers
WHERE id = '[test-customer-id]';

-- Step 3: Validate
SELECT 
  (SELECT COUNT(*) FROM re_customers WHERE id = '[test-customer-id]') AS original_count,
  (SELECT COUNT(*) FROM persons WHERE id = '[test-customer-id]') AS person_count,
  (SELECT COUNT(*) FROM party_roles WHERE party_id = '[test-customer-id]' AND vertical = 'real_estate') AS role_count;
  
ROLLBACK; -- Don't commit test migration
```

**Result:** [ ] PASS / [ ] FAIL  
**Row Counts Match:** [ ] YES / [ ] NO  
**Notes:** _[fill after test]_

---

### Test 4: Tenant Isolation (RLS)

```sql
-- Verify RLS policies prevent cross-tenant access
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.tenant_id TO 'tenant-A';

-- Should only see tenant-A persons
SELECT COUNT(*) FROM persons WHERE tenant_id = 'tenant-A'; -- Should succeed
SELECT COUNT(*) FROM persons WHERE tenant_id = 'tenant-B'; -- Should return 0 or error
```

**Result:** [ ] PASS / [ ] FAIL  
**Notes:** _[fill after test]_

---

### Test 5: Rollback Script

```sql
-- Test rollback strategy
BEGIN;

-- Simulate migration
INSERT INTO persons (...) SELECT ... FROM re_customers WHERE id = '[test-id]';
INSERT INTO party_roles (...) SELECT ... FROM re_customers WHERE id = '[test-id]';

-- Rollback
DELETE FROM party_roles WHERE party_id = '[test-id]' AND vertical = 'real_estate';
DELETE FROM persons WHERE id = '[test-id]';

-- Verify re_customers untouched
SELECT COUNT(*) FROM re_customers WHERE id = '[test-id]'; -- Should still be 1

ROLLBACK;
```

**Result:** [ ] PASS / [ ] FAIL  
**Notes:** _[fill after test]_

---

## Test Execution Log

**Date:** _[fill date]_  
**Executed by:** _[name]_  
**Database:** _[dev/staging]_

| Test | Status | Time | Notes |
|------|--------|------|-------|
| Test 1: Create Person with Role | [ ] | ___ | |
| Test 2: Query Investors | [ ] | ___ | |
| Test 3: Data Migration Sample | [ ] | ___ | |
| Test 4: Tenant Isolation | [ ] | ___ | |
| Test 5: Rollback Script | [ ] | ___ | |

---

## Go/No-Go Decision

**All CRITICAL capabilities must be ✅ SUPPORTED or ⚠️ TO VERIFY (and then tested).**

### Decision Criteria:

**🟢 GO for migration IF:**
- [x] All 5 tests PASS
- [x] Person Center schema supports required fields
- [x] Relationships gap acceptable (use attributes for Phase 1)
- [x] Query performance acceptable (<100ms for typical queries)
- [x] Rollback script tested and working

**🔴 NO-GO (extend Person Center first) IF:**
- [ ] Any CRITICAL capability missing
- [ ] Tests reveal performance issues (>1s queries)
- [ ] Rollback script fails
- [ ] Tenant isolation broken

---

## Decision

**Status:** ⏳ PENDING TEST EXECUTION

**Next Steps:**
1. Execute Tests 1-5 (30 minutes)
2. Document results
3. Make Go/No-Go decision
4. If NO-GO: Document required Person Center extensions
5. If GO: Proceed to Gate 3 (Dependency Discovery)

---

**Executed by:** _[fill name]_  
**Date:** _[fill date]_  
**Decision:** [ ] GO / [ ] NO-GO  
**Justification:** _[fill after tests]_
