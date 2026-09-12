---
product: bella-english-center
phase: E0.1A-1
status: RESOLVED
created: 2026-09-12
issue: person_vs_party_identity_duplication
severity: CRITICAL
---

# E0.1A-1 — PERSON vs. PARTY IDENTITY RECONCILIATION

> **Issue:** Two separate human identity models found: `persons` table and `party_parties` table with no FK relationship.

---

## 🔴 PROBLEM STATEMENT

**Discovery:** Platform has TWO identity aggregate roots for humans:

1. **Person** (`public.persons`)
   - Created: Migration `20260810000001_create_persons_table.sql`
   - Owner: `src/platform/host/person/`
   - Service: `PersonService`
   - Used by: Education Kernel (Students table FK)

2. **Party** (`public.party_parties`)
   - Created: Migration `20260806000000_blueprint_core_schema.sql`
   - Owner: `src/platform/party/`
   - Service: `PartyEngine`
   - Used by: Healthcare (Encounters), Real Estate, Platform Core

**Critical Evidence:**

```sql
-- Migration 20260810224418: Student references Person
ALTER TABLE public.students
  ADD CONSTRAINT students_person_fk
  FOREIGN KEY (person_id)
  REFERENCES public.persons(id)  -- NOT party_parties
  ON DELETE CASCADE;

-- Migration 20260806030000: Encounter references Party
CREATE TABLE public.hc_encounters (
    ...
    patient_party_id UUID NOT NULL REFERENCES public.party_parties(id)
    doctor_party_id UUID REFERENCES public.party_parties(id)
);
```

**No Bridge FK Found:**
```sql
-- Searched for:
persons.party_id
party_parties.person_id

-- Result: NO RELATIONSHIP EXISTS
```

---

## 🔍 INVESTIGATION RESULTS

### Case Analysis

**CASE A: persons is compatibility layer of Party** ❌ DISPROVEN
- No FK relationship found
- No code bridging Person → Party
- Separate creation flows

**CASE B: Parallel identity systems** ✅ **CONFIRMED**
- `persons` = Platform Host identity primitive (Education)
- `party_parties` = Blueprint Core identity aggregate (Healthcare, Real Estate, Platform Core)
- Created in different migrations (20260806 vs. 20260810)
- No sync mechanism

**CASE C: Contract drift** ⚠️ **PARTIALLY TRUE**
- Education Student Contract says `partyId`
- Education Student implementation uses `person_id`
- Healthcare uses `party_id` correctly

### Evidence Chain Tracing

**Education Flow:**
```text
IEducationStudentContract.registerStudent(partyId)
        ↓
StudentService.createStudent(request)
        ↓
Validates: PersonRepository.findById(request.personId)  -- ⚠️ Uses PersonId not PartyId
        ↓
Persists: students.person_id → persons.id
```

**Healthcare Flow:**
```text
Healthcare creates patient
        ↓
INSERT INTO party_parties (party_type='person', ...)
        ↓
Encounter: patient_party_id → party_parties.id
```

**Contract vs. Implementation Mismatch:**
```typescript
// Contract says partyId
interface RegisterStudentInput {
  partyId: string; // ⚠️ Naming suggests Platform Party
  studentCode: string;
}

// Implementation uses personId
const student = await StudentService.createStudent({
  personId: input.partyId,  // ⚠️ Semantic mismatch
  studentCode: input.studentCode
});
```

---

## 📊 DUPLICATION IMPACT ANALYSIS

### Affected Entities

| Entity | Uses Person | Uses Party | Identity Source |
|--------|------------|-----------|-----------------|
| **Healthcare Patient** | ❌ | ✅ | `party_parties` |
| **Education Student** | ✅ | ❌ | `persons` |
| **Real Estate Customer** | ❌ | ✅ | `party_parties` |
| **Teacher (Education)** | ⚠️ UNCLEAR | ✅ (test evidence) | `party_parties` |
| **Doctor (Healthcare)** | ❌ | ✅ | `party_parties` |
| **Guardian** | ⚠️ NO TABLE | ✅ `party_relationships` | `party_parties` |

### Schema Comparison

| Field | `persons` | `party_parties` | Compatibility |
|-------|-----------|----------------|---------------|
| **Identity** | `id` | `id` | ✅ Both UUID |
| **Name** | `first_name`, `last_name`, `middle_name` | `display_name`, `legal_name` | ❌ Different structure |
| **Person Type** | Implicit (always person) | `party_type` ('person' or 'organization') | ❌ Party more generic |
| **Date of Birth** | `date_of_birth` | `dob` | ✅ Same semantic |
| **Gender** | `gender` | `gender` | ✅ Same values |
| **Identifiers** | `identifiers` JSONB array | `party_identifiers` separate table | ❌ Different model |
| **Contacts** | `contacts` JSONB array | N/A | ❌ Person-specific |
| **Addresses** | `addresses` JSONB array | N/A | ❌ Person-specific |
| **Relationships** | N/A | `party_relationships` table | ❌ Party-specific |
| **Roles** | N/A | `party_roles` table | ❌ Party-specific |

### Architectural Intent

**Person Model (Platform Host):**
```typescript
// Simple identity primitive
interface Person {
  personId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  // ... basic person attributes
}
```

**Party Model (Blueprint Core):**
```typescript
// Rich identity aggregate with roles & relationships
interface Party {
  id: string;
  partyType: 'person' | 'organization';
  displayName: string;
  // Dynamic features:
  identifiers: PartyIdentifier[];  // External IDs (CCCD, Passport, BHYT)
  roles: PartyRole[];              // Cross-vertical roles
  relationships: PartyRelationship[]; // Guardian, works_for, etc.
}
```

---

## 🎯 ROOT CAUSE

**Verdict:** **TWO SEPARATE IDENTITY MODELS COEXIST**

**Timeline Analysis:**
1. **2026-08-06:** Blueprint Core created `party_parties` (universal identity)
2. **2026-08-10:** Platform Host created `persons` (simple identity primitive)
3. **Education Kernel adopted `persons`** (simpler model)
4. **Healthcare/Real Estate adopted `party_parties`** (richer model)

**Likely Reason:**
- `party_parties` designed for complex multi-vertical scenarios (healthcare patient = buyer = employee)
- `persons` created as simpler alternative for Education use case
- Migration happened AFTER Party model existed → intentional separation or oversight?

---

## 💥 CONSEQUENCES FOR ENGLISH CENTER

### Immediate Impact

**1. Student Identity Ambiguity**
- English Center Student should reference `persons` OR `party_parties`?
- Contract says `partyId` but Education uses `persons`
- Guardian model uses `party_relationships` → requires Party not Person

**2. Cross-Vertical Integration Issues**

**Scenario A: Student becomes Healthcare Patient**
```text
Person X enrolled in English Center
        ↓
students.person_id → persons(X)
        ↓
Person X visits clinic
        ↓
Must create NEW party_parties(Y)  -- ⚠️ DUPLICATE IDENTITY
        ↓
hc_encounters.patient_party_id → party_parties(Y)
        ↓
SAME HUMAN HAS TWO IDENTITIES (X and Y)
```

**Scenario B: Guardian relationship**
```text
English Center needs guardian for Student
        ↓
students.person_id → persons(student_id)
        ↓
Guardian must be in party_parties (for party_relationships)
        ↓
BUT Student is in persons, NOT party_parties
        ↓
Cannot create party_relationship(guardian_party_id, student_party_id)  -- ⚠️ FK VIOLATION
```

**3. Teacher Identity Confusion**
```text
teacher_assignments.teacher_party_id → ?

Test evidence (p32) shows:
teacher_party_id references party_parties  -- ✅

But Education uses persons for students:
students.person_id references persons      -- ⚠️

Same vertical, different identity models
```

---

## ✅ RESOLUTION DECISION

### Option 1: Migrate Education to Party ⭐ **RECOMMENDED**

**Rationale:**
- `party_parties` is Platform Core canonical identity
- Healthcare, Real Estate already use Party
- Party model richer (roles, relationships, identifiers)
- Guardian model (`party_relationships`) requires Party
- Multi-vertical scenarios need unified identity

**Migration Path:**
```sql
-- Step 1: Create party for each person
INSERT INTO party_parties (id, tenant_id, party_type, display_name, dob, gender, ...)
SELECT 
    id,
    tenant_id,
    'person',
    first_name || ' ' || last_name,
    date_of_birth,
    gender,
    ...
FROM persons;

-- Step 2: Migrate identifiers
INSERT INTO party_identifiers (party_id, tenant_id, identifier_type, identifier_value, ...)
SELECT 
    p.id,
    p.tenant_id,
    i->>'type',
    i->>'value',
    ...
FROM persons p, jsonb_array_elements(p.identifiers) i;

-- Step 3: Update students FK
ALTER TABLE students DROP CONSTRAINT students_person_fk;
ALTER TABLE students RENAME COLUMN person_id TO party_id;
ALTER TABLE students ADD CONSTRAINT students_party_fk 
    FOREIGN KEY (party_id) REFERENCES party_parties(id);

-- Step 4: Deprecate persons table (keep for historical reference)
-- DO NOT DROP - maintain for audit trail
```

**Impact:**
- ✅ Unified identity across all verticals
- ✅ Guardian relationships work natively
- ✅ Education Student contract becomes semantically correct (`partyId`)
- ✅ English Center can use Party from day 1
- ⚠️ Breaking change for existing Education code

---

### Option 2: Keep Dual Model with Bridge ❌ **NOT RECOMMENDED**

**Approach:**
```sql
-- Create 1:1 bridge
ALTER TABLE persons ADD COLUMN party_id UUID REFERENCES party_parties(id);
-- OR
ALTER TABLE party_parties ADD COLUMN person_id UUID REFERENCES persons(id);
```

**Why Not Recommended:**
- Complexity: Two sources of truth
- Sync issues: Person updates must sync to Party
- Guardian problem persists: `party_relationships` cannot reference `persons`
- Teacher inconsistency: Uses Party while Student uses Person
- Future verticals: Which model to use?

---

### Option 3: Deprecate Party, Keep Person ❌ **NOT VIABLE**

**Why Not Viable:**
- Healthcare already deeply integrated with Party
- Real Estate uses Party
- Platform Core Timeline, Journey use Party
- Richer model (roles, relationships) needed for platform
- Would require massive Healthcare migration

---

## 📋 RESOLUTION PLAN

### Phase 1: Immediate (for E0.1A completion)

**Decision:** Education OS WILL migrate to Party model

**English Center Design:**
```typescript
// English Center Student references Party (not Person)
CREATE TABLE english_center_student_contexts (
    student_id UUID PRIMARY KEY REFERENCES students(student_id),
    party_id UUID NOT NULL REFERENCES party_parties(id),  -- ✅ Use Party
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    // ... English-specific attributes
);
```

**Guardian/Payer Pattern:**
```typescript
// Use Platform Core party_relationships
await partyEngine.linkParties(tenantId, {
  sourcePartyId: guardianPartyId,  // ✅ Party
  targetPartyId: studentPartyId,   // ✅ Party
  type: 'guardian_of',
  attributes: { emergencyContact: true }
}, actorId);
```

**Teacher Pattern:**
```typescript
// Teacher already uses Party (test evidence)
teacher_assignments.teacher_party_id → party_parties.id  // ✅ Correct
```

---

### Phase 2: Education OS Migration (Future Work)

**Scope:** Migrate Education Kernel from Person to Party

**Steps:**
1. Create migration script (see Option 1 above)
2. Update Education Kernel Student Service to use Party
3. Update Education contracts (fix `partyId` semantic)
4. Migrate existing student data
5. Update Preschool to use Party
6. Deprecate `persons` table (keep for audit)

**Timeline:** Before English Center E1 implementation (to avoid building on legacy model)

---

## 🎯 UPDATED E0.1A OWNERSHIP MATRIX

### Corrected Ownership

| Entity | Canonical Owner | Source of Truth | Resolution |
|--------|----------------|----------------|------------|
| **Human Identity** | Platform Core | `party_parties` | ✅ LOCKED |
| **Student Role** | Education Kernel | `students` (will migrate `person_id` → `party_id`) | ✅ LOCKED |
| **Guardian Relationship** | Platform Core | `party_relationships` | ✅ LOCKED |
| **Teacher Identity** | Platform Core | `party_parties` | ✅ LOCKED (already correct) |

### English Center Architecture

```text
Platform Core party_parties (canonical identity)
        │
        ├── party_id
        │
        ▼
Education Kernel students
        │
        ├── student_id
        │
        ▼
English Center student_contexts
        │
        ├── placement, branch, level, goals
```

**NO LONGER:**
```text
❌ persons → students → english_center_contexts
```

**INSTEAD:**
```text
✅ party_parties → students → english_center_contexts
```

---

## ✅ E0.1A-1 RESOLUTION STATUS

**Issue:** Person vs. Party identity duplication

**Root Cause:** Two separate identity models coexist without bridge

**Impact:** Critical - blocks guardian relationships, creates cross-vertical identity fragmentation

**Resolution:** Migrate Education OS to Party model (canonical Platform identity)

**English Center Action:** Use Party from day 1, do NOT adopt legacy Person model

**Blocker Status:** **RESOLVED** ✅

**Next Phase:** E0.1B Finance Reuse Reconciliation

---

**Approval Required:** Human Architect confirm Education → Party migration timeline before E1 implementation
