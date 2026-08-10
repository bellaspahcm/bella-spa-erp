# Capability Gap Request: Shared Identity / Person Capability

**Status:** ✅ DEPLOYED  
**Requester:** Education Vertical (Smoke Test)  
**Date:** 2026-08-10  
**Implemented:** 2026-08-10  
**Deployed:** 2026-08-10 (manual migration via SQL Editor)  
**Priority:** HIGH (Blocking vertical creation)  

---

## Gap Description

**Missing Capability:** Shared Identity / Person Management

**What Education needs:**
```typescript
// Education wants to reference a shared Person:
interface Student {
  studentId: string;
  personId: string; // ← References shared Person aggregate
  studentCode: string;
  academicStatus: 'enrolled' | 'on_leave' | 'graduated';
  programId: string;
}
```

**What currently exists:**
- ❌ No `@/platform/host/person-center` (documented in Quick Start, not implemented)
- Healthcare has `Patient` (in `platform/healthcare/shared-kernel/types.ts`)
- Beauty Spa has `spa_customer` (database table)
- Real Estate has `People Directory` (minimal, for lead assignment only)
- Each vertical manages identity independently

**Problem:**
- No shared identity capability exists
- Each vertical duplicates: firstName, lastName, dateOfBirth, gender, contact info
- Cannot share identity across verticals (e.g., same person as Patient + Student)
- Framework assumes Person Center exists, but implementation missing

---

## Use Case

### Education Scenario
1. **Student Registration:**
   - Create Person identity (name, DOB, gender, contact)
   - Create Student role (studentCode, programId, academicStatus)
   - Link Student → Person via `personId`

2. **Cross-Vertical Scenario:**
   - Person works as Hospital staff (Employee)
   - Same person enrolls in training course (Student)
   - Shared identity prevents duplicate records

### Healthcare Scenario
- Patient exists with: mpiId, identifiers, contact, insurance
- Healthcare-specific data stays in Healthcare Platform
- Core identity (name, DOB, gender, contact) extracted to Platform

### Beauty Spa Scenario
- spa_customer currently stores: name, phone, address
- Core identity extracted to Platform
- Spa-specific data (package, loyalty points) stays in vertical

---

## Proposed Solution

### Option A: Build Shared Person Capability in Platform ✅ RECOMMENDED

**Architecture:**
```
PLATFORM (Host)
└── Person Capability
    ├── Person aggregate (identity only)
    ├── PersonId (stable UUID)
    ├── Core attributes (name, DOB, gender, contact)
    └── API contract

VERTICALS
├── Healthcare
│   └── Patient (references Person + adds healthcare context)
├── Education
│   └── Student (references Person + adds academic context)
└── Beauty Spa
    └── Customer (references Person + adds loyalty context)
```

**Person Capability Scope:**
```typescript
// Platform: Person (identity only)
interface Person {
  personId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  contacts: Contact[];
  addresses: Address[];
  identifiers: Identifier[]; // national-id, passport, etc.
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// Healthcare: Patient (references Person + adds healthcare)
interface Patient {
  patientId: string;
  personId: string; // ← References Platform Person
  mpiId: string; // Healthcare-specific MPI
  medicalRecordNumber: string;
  insuranceInfo: InsuranceInfo[];
  allergies: Allergy[];
  bloodType: BloodType;
  // ... other healthcare attributes
}

// Education: Student (references Person + adds academic)
interface Student {
  studentId: string;
  personId: string; // ← References Platform Person
  studentCode: string;
  admissionDate: Date;
  academicStatus: AcademicStatus;
  programId: string;
  // ... other education attributes
}

// Beauty Spa: Customer (references Person + adds loyalty)
interface Customer {
  customerId: string;
  personId: string; // ← References Platform Person
  customerCode: string;
  loyaltyPoints: number;
  packageId?: string;
  // ... other spa attributes
}
```

**Benefits:**
- ✅ Single source of truth for identity
- ✅ Prevents duplicate records across verticals
- ✅ Each vertical adds domain-specific context
- ✅ Cross-vertical identity resolution (same person, multiple roles)

**Implementation:**
1. Create `src/platform/host/person/` capability
2. Extract identity fields from Healthcare Patient
3. Migrate Healthcare to reference Person
4. Education builds Student referencing Person
5. Beauty Spa migrates spa_customer to reference Person

---

### Option B: Build in Education Vertical ❌ NOT RECOMMENDED

**Why rejected:**
- Person identity is clearly cross-vertical
- Healthcare Patient contains person data
- Beauty Spa spa_customer contains person data
- Duplicate implementation across verticals
- Violates DRY principle

---

## Cross-Vertical Evidence

### Existing Verticals (Evidence: All need identity)

**Healthcare:** ✅ YES
- Current: Patient has firstName, lastName, dateOfBirth, gender, contact
- Benefit: Extract identity to Platform, keep healthcare context in Healthcare

**Education:** ✅ YES (blocked without it)
- Need: Student must reference Person
- Current: Cannot proceed with Student implementation

**Beauty Spa:** ✅ YES
- Current: spa_customer table has name, phone, address
- Benefit: Share customer identity across spa services

**Real Estate:** ⚠️ PARTIAL
- Current: People Directory (minimal, for lead assignment)
- Benefit: Could use Person for broker/agent identity

### Expected Future Verticals

**Automotive:** ✅ LIKELY
- Need: Vehicle owner identity (same as Person)

**Retail:** ✅ LIKELY
- Need: Customer identity (same as Person)

**Generic Nature:** ✅ YES
- Person identity is industry-agnostic
- Core abstraction: firstName, lastName, DOB, gender, contact
- Domain-specific roles built on top: Patient, Student, Customer, Employee

---

## Current Workarounds (Not Acceptable)

### Workaround 1: Create Student without Person reference
```typescript
// ❌ BAD: Duplicate identity in Education
interface Student {
  studentId: string;
  firstName: string; // Duplicate
  lastName: string;  // Duplicate
  dateOfBirth: string; // Duplicate
  gender: string; // Duplicate
  phone: string; // Duplicate
  email: string; // Duplicate
  // ...
}
```
**Why rejected:** Violates framework principle, duplicates identity

### Workaround 2: Education references Healthcare Patient
```typescript
// ❌ BAD: Creates vertical coupling
interface Student {
  studentId: string;
  patientId: string; // ← Wrong abstraction level
}
```
**Why rejected:** Education depends on Healthcare, not generic

### Workaround 3: Copy Patient to Education
```typescript
// ❌ BAD: Copy Healthcare code
// Copy from: platform/healthcare/shared-kernel/types.ts (Patient)
// Rename: Patient → Person
```
**Why rejected:** Code duplication, not true extraction

---

## Impact Analysis

### Blocking Impact (HIGH)
- ❌ **Education Student** cannot be implemented (smoke test blocked at 1 hour)
- ❌ **Vertical Creation Framework** validation failed (framework assumes Person Center exists)
- ❌ **Cross-vertical identity** not possible (same person cannot have Patient + Student roles)

### Technical Debt (if not fixed)
- Each new vertical duplicates identity management
- Data inconsistency across verticals
- Cannot resolve "same person, multiple roles"
- Framework documentation-reality mismatch

---

## Decision

**Recommended:** ✅ **Option A - Build Shared Person Capability in Platform**

**Rationale:**
1. Identity is clearly cross-vertical (Healthcare, Education, Beauty Spa all need it)
2. Core abstraction is generic (name, DOB, gender, contact)
3. Prevents duplication across verticals
4. Enables cross-vertical identity resolution
5. Framework already assumes it exists

**Implementation Priority:** 🔴 HIGH
- Blocks Education vertical creation
- Required for Platform maturity
- Referenced in framework documentation

**Estimated Effort:**
- Extract Person from Healthcare Patient: 2-3 days
- Create Platform capability contract: 1 day
- Migrate Healthcare to reference Person: 2-3 days
- Update Education Quick Start: 1 hour
- **Total:** ~1 week

**Dependencies:**
- Healthcare Platform (Patient extraction)
- Database migration (additive only, per Constitution Law 4)
- Event Bus (person.* events)

---

## Next Steps

1. ✅ **ARB Review** (if modifying platform contracts)
   - Decision: Extract identity to Platform
   - Approve: Person capability contract
   - Timeline: 1-2 days

2. **Implementation:**
   - Week 1: Extract Person capability from Healthcare
   - Week 1: Create platform/host/person/ implementation
   - Week 1: Migrate Healthcare to reference Person
   - Week 2: Re-run Education smoke test

3. **Validation:**
   - Re-run Education smoke test with Person capability
   - Target: Developer can start Student implementation in <30 min
   - Measure: Coding ratio >60%

---

## Appendix: Smoke Test Evidence

**Smoke Test Date:** 2026-08-10  
**Task:** Build Education Student aggregate  
**Result:** ❌ BLOCKED (cannot proceed without Person capability)  

**Timeline:**
- 0-10 min: Read framework + Quick Start
- 10-45 min: Define Student domain, check capability reuse
- 45-60 min: Search codebase for Person Center (not found)
- 60 min: **BLOCKED** - Person capability doesn't exist

**Evidence:**
- Framework says: `import { PersonCenter } from '@/platform/host/person-center'`
- Reality: No person-center folder in src/platform/host/
- Healthcare has Patient (not shared)
- Beauty Spa has spa_customer (not shared)
- Real Estate has People Directory (minimal, not identity management)

**Capability Gap Confirmed:** ✅ Person Center missing

---

**Created:** 2026-08-10  
**Updated:** 2026-08-10  
**Status:** 🔴 OPEN (Awaiting ARB decision)

