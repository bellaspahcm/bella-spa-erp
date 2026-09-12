---
remediation_id: E0.1A-R3
document: CODE_PATCH
phase: R3 Application Code Changes
created: 2026-09-12
status: ready_not_deployed
---

# R3 APPLICATION CODE PATCH

> **Phase:** R3 Education Identity Cutover  
> **Scope:** StudentService + Contract Implementation  
> **Prerequisites:** R3 database migration deployed (students.party_id added)

---

## 📋 CHANGES REQUIRED

### R3.5 — StudentService Changes

**File:** `src/platform/education/student/student.service.ts`

**Current Problem:**
```typescript
// Validates Person exists (aggregate root must exist first)
const person = await personRepo.findById(request.personId, request.tenantId);
if (!person) {
  throw new Error(`Person with ID ${request.personId} does not exist`);
}
```

**Issue:** Validates `persons` table, but Contract provides `partyId` → `party_parties`.

**Fix Required:**

1. **Change validation target:** Person → Party
2. **Add new repository import:** `PartyRepository`
3. **Update validation logic**
4. **Add query method:** `getStudentsByPartyId()`

---

### R3.6 — Contract Implementation Fix

**File:** `src/platform/education/contracts/student.contract.impl.ts`

**Current Problem:**
```typescript
// Semantic drift: partyId input → personId field
personId: input.partyId, // references generic Party profile identity
```

**Issue:** Contract says `partyId`, but passes to `personId`. After R3 DB migration, students have BOTH `person_id` and `party_id` columns. New students should populate `party_id`, NOT `person_id`.

**Fix Required:**

1. **Map `partyId` → `party_id` field** (not `person_id`)
2. **Return `student.party_id`** (not `student.person_id`)
3. **Query by `party_id`** (not `person_id`)

---

## 🔧 IMPLEMENTATION

### 1. Update StudentService Validation

**Location:** `src/platform/education/student/student.service.ts`

```typescript
import { PartyRepository } from '@/platform/host/party/party.repository';

export class StudentService {
  /**
   * Create new student
   * Validates Party exists before creating Student (post-R3)
   */
  static async createStudent(request: CreateStudentRequest): Promise<Student> {
    // R3: Validate Party exists (canonical identity)
    const supabase = await createClient();
    const partyRepo = new PartyRepository(supabase);
    
    // Map partyId → party_id (NOT person_id)
    const party = await partyRepo.findById(request.partyId, request.tenantId);
    if (!party) {
      throw new Error(`Party with ID ${request.partyId} does not exist`);
    }
    
    // Verify party_type = 'person' (business rule)
    if (party.party_type !== 'person') {
      throw new Error(`Party ${request.partyId} is not a person (type: ${party.party_type})`);
    }

    // Create aggregate (business logic + validation)
    const aggregate = StudentAggregate.create(request);
    const student = aggregate.getStudent();

    // Persist to database
    return await StudentRepository.create(student);
  }

  /**
   * Get students by party ID (NEW METHOD)
   */
  static async getStudentsByPartyId(partyId: string, tenantId: string): Promise<Student[]> {
    return await StudentRepository.findByPartyId(partyId, tenantId);
  }

  /**
   * Get students by person ID (LEGACY — deprecated)
   * @deprecated Use getStudentsByPartyId() instead
   */
  static async getStudentsByPersonId(personId: string, tenantId: string): Promise<Student[]> {
    return await StudentRepository.findByPersonId(personId, tenantId);
  }
}
```

---

### 2. Update CreateStudentRequest Type

**Location:** `src/platform/education/shared-kernel/types.ts`

```typescript
export interface CreateStudentRequest {
  tenantId: string;
  partyId: string;        // NEW: canonical identity
  personId?: string;      // LEGACY: keep for compatibility during R3
  studentCode: string;
  academicStatus: string;
  enrollmentType: string;
  programId: string;
  enrollmentDate: string;
  expectedGraduationDate?: string;
  guardianPartyId?: string;
  createdBy?: string;
}
```

---

### 3. Update StudentRepository

**Location:** `src/platform/education/student/student.repository.ts`

```typescript
export class StudentRepository {
  /**
   * Find students by party ID (NEW)
   */
  static async findByPartyId(partyId: string, tenantId: string): Promise<Student[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('party_id', partyId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Find students by person ID (LEGACY)
   * @deprecated Use findByPartyId() instead
   */
  static async findByPersonId(personId: string, tenantId: string): Promise<Student[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('person_id', personId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Create student (R3: populate party_id)
   */
  static async create(student: Student): Promise<Student> {
    const supabase = await createClient();
    
    // R3: Ensure party_id is populated
    if (!student.party_id) {
      throw new Error('party_id is required for new students (R3 requirement)');
    }
    
    const { data, error } = await supabase
      .from('students')
      .insert({
        ...student,
        party_id: student.party_id,    // NEW: authoritative
        person_id: student.person_id,  // LEGACY: keep for compatibility
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
```

---

### 4. Fix Contract Implementation

**Location:** `src/platform/education/contracts/student.contract.impl.ts`

```typescript
import { IEducationStudentContract, RegisterStudentInput, EducationStudentDTO } from './student.contract';
import { StudentService } from '../student/student.service';

export class StudentContractImpl implements IEducationStudentContract {
  public async registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO> {
    // R3 FIX: partyId → party_id (NOT person_id)
    const student = await StudentService.createStudent({
      tenantId: input.tenantId,
      partyId: input.partyId,           // FIXED: map to party_id field
      studentCode: input.studentCode,
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'primary',
      enrollmentDate: new Date().toISOString().split('T')[0],
      createdBy: '00000000-0000-0000-0000-000000000001',
    });

    // R3 FIX: Return party_id (NOT person_id)
    return {
      partyId: student.party_id,        // FIXED: use party_id
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
      guardianPartyId: input.guardianPartyId,
    };
  }

  public async getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null> {
    // R3 FIX: Query by party_id (NOT person_id)
    const students = await StudentService.getStudentsByPartyId(partyId, tenantId);
    if (students.length === 0) {
      return null;
    }

    const student = students[0];
    // R3 FIX: Return party_id (NOT person_id)
    return {
      partyId: student.party_id,        // FIXED: use party_id
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
    };
  }
}
```

---

### 5. Add PartyRepository (if not exists)

**Location:** `src/platform/host/party/party.repository.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { Party } from '../shared-kernel/types';

export class PartyRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(partyId: string, tenantId: string): Promise<Party | null> {
    const { data, error } = await this.supabase
      .from('party_parties')
      .select('*')
      .eq('id', partyId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }
}
```

---

## ✅ VERIFICATION CHECKLIST

### Integration Tests

```typescript
describe('R3 Education Identity Cutover', () => {
  it('should create new student with party_id', async () => {
    // Create Party first
    const party = await createParty({ party_type: 'person', ... });
    
    // Register student
    const student = await registerStudent({
      tenantId: 'test-tenant',
      partyId: party.id,
      studentCode: 'STU001',
    });
    
    // Verify party_id populated
    expect(student.party_id).toBe(party.id);
    
    // Verify NO new Person created
    const personsCount = await countPersons();
    expect(personsCount).toBe(0); // NO new persons
  });

  it('should query student by party_id', async () => {
    const students = await StudentService.getStudentsByPartyId(partyId, tenantId);
    expect(students.length).toBeGreaterThan(0);
    expect(students[0].party_id).toBe(partyId);
  });

  it('should fail to create student with invalid party_id', async () => {
    await expect(
      StudentService.createStudent({
        partyId: 'invalid-uuid',
        ...
      })
    ).rejects.toThrow('Party with ID invalid-uuid does not exist');
  });

  it('should fail to create student with non-person party', async () => {
    // Create organization party
    const orgParty = await createParty({ party_type: 'organization', ... });
    
    await expect(
      StudentService.createStudent({
        partyId: orgParty.id,
        ...
      })
    ).rejects.toThrow('Party ... is not a person');
  });
});
```

---

### Negative Tests

```typescript
describe('R3 Negative Tests — No Person Creation', () => {
  beforeEach(async () => {
    // Capture baseline persons count
    const baseline = await countPersons();
    expect(baseline).toBe(848); // R2 sealed count
  });

  it('should NOT create new Person when registering student', async () => {
    const party = await createParty({ party_type: 'person', ... });
    await registerStudent({ partyId: party.id, ... });
    
    // Verify persons table UNCHANGED
    const afterCount = await countPersons();
    expect(afterCount).toBe(848); // NO INCREASE
  });

  it('should NOT create Person when updating student', async () => {
    await updateStudent({ studentId, ... });
    
    const afterCount = await countPersons();
    expect(afterCount).toBe(848); // NO INCREASE
  });

  it('should NOT delete Party when deleting student', async () => {
    const student = await getStudentById(studentId, tenantId);
    const partyId = student.party_id;
    
    await deleteStudent(studentId, tenantId);
    
    // Verify Party still exists
    const party = await getPartyById(partyId, tenantId);
    expect(party).not.toBeNull();
  });
});
```

---

### Contract Tests

```typescript
describe('R3 Contract Semantic Fix', () => {
  it('should map partyId → party_id (not person_id)', async () => {
    const party = await createParty({ party_type: 'person', ... });
    
    const dto = await studentContract.registerStudent({
      tenantId: 'test-tenant',
      partyId: party.id,
      studentCode: 'STU001',
    });
    
    // Verify returned DTO uses party_id
    expect(dto.partyId).toBe(party.id);
    
    // Verify database record
    const dbStudent = await getStudentByCode('STU001', 'test-tenant');
    expect(dbStudent.party_id).toBe(party.id);
  });

  it('should query by partyId (not personId)', async () => {
    const dto = await studentContract.getStudent(tenantId, partyId);
    expect(dto?.partyId).toBe(partyId);
  });
});
```

---

## 🚨 DEPLOYMENT SEQUENCE

```text
1. ✅ Deploy R3 Database Migration
   └─ students.party_id added, backfilled, FK created

2. ⏸️  Deploy R3 Application Code
   └─ StudentService + Contract + Repository changes

3. ⏸️  Run Integration Tests
   └─ Verify party_id populated, NO new Person rows

4. ⏸️  Run Negative Tests
   └─ Verify persons count = 848 (unchanged)

5. ⏸️  Run Contract Tests
   └─ Verify semantic drift fixed

6. ⏸️  Smoke Test Production
   └─ Create 1 new student, verify party_id

7. ✅ Mark R3 COMPLETE
   └─ Authorize R4 (Caller Migration)
```

---

## 🔄 ROLLBACK PROCEDURE

If R3 code deployment fails:

1. **Revert application code** (git revert)
2. **Database stays as-is** (party_id column harmless)
3. **Legacy paths still work** (person_id unchanged)
4. **Investigate failure**, fix, redeploy

If database migration fails:

1. **Run rollback SQL:**
   ```sql
   DROP CONSTRAINT students_party_id_fkey;
   DROP INDEX idx_students_party_id;
   ALTER TABLE students DROP COLUMN party_id;
   ```

2. **Do NOT deploy application code**
3. **Investigate failure**, fix migration, retry

---

## 📊 SUCCESS CRITERIA

```text
R3 Database Migration:
  students.party_id added             ✅
  631/631 students backfilled         ✅
  FK integrity valid                  ✅
  Tenant consistency valid            ✅

R3 Application Code:
  StudentService uses Party           ⏸️
  Contract semantics fixed            ⏸️
  Integration tests PASS              ⏸️
  Negative tests PASS                 ⏸️
  New students populate party_id      ⏸️
  NO new Person rows created          ⏸️

R3 Overall:
  Database + Code deployed            ⏸️
  Evidence sealed                     ⏸️
  R4 authorized                       ⏸️
```

---

**STATUS:** 🟡 READY / NOT DEPLOYED

**NEXT:** Deploy R3 database migration → Deploy R3 application code → Verify → Authorize R4
