# Person Platform Capability

**Status:** ✅ Implemented (CAP-001)  
**Version:** 1.0.0  
**Owner:** Platform Team  

---

## Overview

Person is the **identity primitive** of Bella Platform. It represents "who someone is" independent of their roles in different verticals.

**Architecture:**
```
Platform (Host)
└── Person (identity)
    ├── Healthcare → Patient (references Person)
    ├── Education → Student (references Person)
    └── Beauty Spa → Customer (references Person)
```

---

## Key Principles

### 1. Person = Identity ONLY

**Person contains:**
- ✅ firstName, lastName, middleName
- ✅ dateOfBirth, gender, nationality
- ✅ contacts (phone, email)
- ✅ addresses
- ✅ identifiers (national-id, passport, etc.)

**Person does NOT contain:**
- ❌ MPI, insurance, allergies (Healthcare-specific → Patient)
- ❌ Student code, GPA (Education-specific → Student)
- ❌ Loyalty points, packages (Beauty Spa-specific → Customer)

### 2. Verticals Reference Person (Not Extend)

**✅ CORRECT:**
```typescript
// Healthcare
interface Patient {
  patientId: string;
  personId: string; // References Person
  mpiId: string;    // Healthcare-specific
  insuranceInfo: InsuranceInfo[];
}

// Education
interface Student {
  studentId: string;
  personId: string; // References Person
  studentCode: string;
  academicStatus: string;
}
```

**❌ WRONG:**
```typescript
// Don't extend Person
interface Student extends Person {
  studentCode: string; // Wrong - breaks aggregate boundary
}
```

### 3. One Person, Multiple Roles

Same person can have multiple roles across verticals:
- Person ID: `person-123`
  - Healthcare: Patient ID `patient-456` (hospital treatment)
  - Education: Student ID `student-789` (training course)
  - Beauty Spa: Customer ID `customer-012` (spa services)

---

## Usage

### Create Person

```typescript
import { PersonService, CreatePersonRequest } from '@/platform/host/person';

const personService = new PersonService(supabase);

const request: CreatePersonRequest = {
  tenantId: 'tenant-123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  gender: 'male',
  contacts: [
    {
      type: 'email',
      value: 'john.doe@example.com',
      isPrimary: true,
    },
    {
      type: 'mobile',
      value: '+84901234567',
      isPrimary: true,
    },
  ],
  identifiers: [
    {
      type: 'national-id',
      value: '079090001234',
      isPrimary: true,
    },
  ],
};

const response = await personService.createPerson(request);

if (response.success) {
  console.log('Person created:', response.data.personId);
} else {
  console.error('Error:', response.error.message);
}
```

### Query Persons

```typescript
const response = await personService.queryPersons({
  tenantId: 'tenant-123',
  firstName: 'John',
  lastName: 'Doe',
  limit: 50,
  offset: 0,
});

if (response.success) {
  console.log('Found persons:', response.data.length);
}
```

### Find by Identifier

```typescript
const response = await personService.findByIdentifier(
  'tenant-123',
  'national-id',
  '079090001234'
);

if (response.success) {
  console.log('Person found:', response.data.fullName);
}
```

---

## Database Schema

**Table:** `public.persons`

**Key Fields:**
- `id` (UUID) - Person ID
- `tenant_id` (UUID) - Tenant isolation
- `first_name`, `last_name`, `middle_name` (TEXT)
- `date_of_birth` (DATE)
- `gender` (TEXT) - male, female, other, prefer-not-to-say
- `identifiers` (JSONB) - Array of government/institutional IDs
- `contacts` (JSONB) - Array of phone/email/mobile
- `addresses` (JSONB) - Array of physical addresses
- `status` (TEXT) - active, inactive, deceased, merged

**Indexes:**
- Tenant isolation: `tenant_id`
- Name search: `first_name`, `last_name`
- JSONB GIN: `identifiers`, `contacts`, `addresses`

**RLS:** Enabled (tenant isolation enforced)

---

## Events

Person capability publishes domain events:

- `person.created` - New person created
- `person.updated` - Person information updated
- `person.deleted` - Person soft-deleted (status = inactive)
- `person.merged` - Person merged into another (duplicate resolution)
- `person.status-changed` - Person status changed

---

## Vertical Integration

### Healthcare (Patient)

```typescript
// 1. Create Person
const personResponse = await personService.createPerson({
  tenantId,
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  gender: 'male',
});

const personId = personResponse.data.personId;

// 2. Create Patient (references Person)
const patient: Patient = {
  patientId: generateId(),
  personId, // ← References Person
  mpiId: generateMpiId(),
  insuranceInfo: [...],
  allergies: [...],
};
```

### Education (Student)

```typescript
// 1. Create Person (or use existing)
const personResponse = await personService.createPerson({
  tenantId,
  firstName: 'Jane',
  lastName: 'Smith',
  dateOfBirth: '2005-03-20',
  gender: 'female',
});

const personId = personResponse.data.personId;

// 2. Create Student (references Person)
const student: Student = {
  studentId: generateId(),
  personId, // ← References Person
  studentCode: 'STU202401',
  academicStatus: 'enrolled',
  programId: 'program-123',
};
```

### Beauty Spa (Customer)

```typescript
// 1. Create Person (or use existing)
const personResponse = await personService.createPerson({
  tenantId,
  firstName: 'Mary',
  lastName: 'Johnson',
  dateOfBirth: '1985-07-10',
  gender: 'female',
});

const personId = personResponse.data.personId;

// 2. Create Customer (references Person)
const customer: Customer = {
  customerId: generateId(),
  personId, // ← References Person
  loyaltyPoints: 0,
  packageId: null,
};
```

---

## Testing

### Unit Tests (Domain Logic)

```typescript
import { PersonAggregate } from '@/platform/host/person';

describe('PersonAggregate', () => {
  it('should create person with valid data', () => {
    const aggregate = PersonAggregate.create({
      tenantId: 'tenant-123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-15',
      gender: 'male',
    });

    const person = aggregate.getPerson();
    expect(person.firstName).toBe('John');
    expect(person.lastName).toBe('Doe');
    expect(person.status).toBe('active');
  });

  it('should throw error if first name missing', () => {
    expect(() => {
      PersonAggregate.create({
        tenantId: 'tenant-123',
        firstName: '',
        lastName: 'Doe',
        dateOfBirth: '1990-01-15',
        gender: 'male',
      });
    }).toThrow('First name is required');
  });
});
```

### Integration Tests

```typescript
import { PersonService } from '@/platform/host/person';

describe('PersonService', () => {
  it('should create and retrieve person', async () => {
    const service = new PersonService(supabase);

    const createResponse = await service.createPerson({
      tenantId: 'tenant-123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-15',
      gender: 'male',
    });

    expect(createResponse.success).toBe(true);

    const getResponse = await service.getPerson(
      createResponse.data.personId,
      'tenant-123'
    );

    expect(getResponse.success).toBe(true);
    expect(getResponse.data.firstName).toBe('John');
  });
});
```

---

## Migration Guide

### Migrating Healthcare Patient

**Before (Patient has identity):**
```typescript
interface Patient {
  id: string;
  firstName: string;    // ← Identity
  lastName: string;     // ← Identity
  dateOfBirth: string;  // ← Identity
  gender: string;       // ← Identity
  mpiId: string;        // Healthcare
  insuranceInfo: InsuranceInfo[];
}
```

**After (Patient references Person):**
```typescript
interface Patient {
  patientId: string;
  personId: string;     // ← References Person
  mpiId: string;        // Healthcare only
  insuranceInfo: InsuranceInfo[];
}
```

**Migration Steps:**
1. Create Person from Patient identity fields
2. Update Patient record with `person_id`
3. Remove identity fields from Patient table
4. Update Patient queries to join Person table
5. Run Healthcare regression tests

---

## Constitution Compliance

**Law 4: Additive Migration** ✅
- New table `persons` created
- No DROP COLUMN or breaking constraints
- Existing tables unchanged

**Law 11: No `any` Types** ✅
- All types strictly defined
- JSONB validated with TypeScript interfaces
- No implicit `any` in codebase

---

## API Reference

See [types.ts](./types.ts) for complete API documentation.

---

## Support

**Questions:** #platform-person channel  
**Issues:** Create issue with `[Person]` prefix  
**Owner:** Platform Team  

---

**Last Updated:** 2026-08-10  
**Version:** 1.0.0

