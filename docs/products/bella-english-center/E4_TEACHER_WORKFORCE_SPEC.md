# E4 — TEACHER & WORKFORCE MANAGEMENT

**Product:** Bella English Center  
**Phase:** E4  
**Depends on:** E3 (Classes)

---

## SCOPE

English Center teacher workforce management.

**IN SCOPE:**
- Teacher profile extensions (certifications, specializations)
- Teacher-branch assignments
- Teacher availability/schedule
- Class-teacher assignments (already in E3, enhance here)

**OUT OF SCOPE:**
- Core workforce/HR management (use Platform if exists)
- Payroll (separate Finance domain)
- Detailed timetabling (E5)

---

## ARCHITECTURE

```
English Center
  ↓
Teacher Service
  ↓
[Check Platform Workforce Contract if exists]
  ↓
english_center_teachers (extension of parties)
```

**Ownership:**
- Platform owns: Party/Person core entity
- English Center owns: Teacher-specific context (certifications, branch assignments, availability)

---

## DATA MODEL

### Table: `english_center_teachers`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Teacher ID |
| `tenant_id` | UUID | NOT NULL, FK → tenants | Tenant isolation |
| `party_id` | UUID | NOT NULL UNIQUE, FK → parties | Link to Party entity |
| `employee_code` | VARCHAR(50) | NULL | Teacher employee code |
| `certifications` | JSONB | NULL | Teaching certifications (TESOL, CELTA, etc.) |
| `specializations` | VARCHAR[] | NULL | Specializations (IELTS, TOEIC, Kids, Business) |
| `languages` | VARCHAR[] | NULL | Languages taught |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | active/inactive/on_leave |
| `metadata` | JSONB | NULL | |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |

**Indexes:**
- `idx_teachers_tenant` ON (`tenant_id`)
- `idx_teachers_party` ON (`party_id`)
- `idx_teachers_status` ON (`status`)

---

### Table: `english_center_teacher_branches`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Assignment ID |
| `tenant_id` | UUID | NOT NULL, FK → tenants | Tenant isolation |
| `teacher_id` | UUID | NOT NULL, FK → english_center_teachers | Teacher |
| `branch_id` | UUID | NOT NULL, FK → org_units | Branch |
| `is_primary` | BOOLEAN | NOT NULL DEFAULT false | Primary branch |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | active/inactive |
| `assigned_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT NOW() | |

**Indexes:**
- `idx_teacher_branches_tenant` ON (`tenant_id`)
- `idx_teacher_branches_teacher` ON (`teacher_id`)
- `idx_teacher_branches_branch` ON (`branch_id`)

---

## API ENDPOINTS

### Teachers
**POST /api/english-center/teachers** - Create teacher  
**GET /api/english-center/teachers** - List teachers  
**GET /api/english-center/teachers/:id** - Get teacher detail  
**PATCH /api/english-center/teachers/:id** - Update teacher  

### Branch Assignments
**POST /api/english-center/teachers/:id/assign-branch** - Assign to branch  
**GET /api/english-center/teachers/:id/branches** - List teacher branches  

---

## TESTS

- Create teacher (links to party)
- Assign teacher to branch
- List teachers by branch
- Update certifications/specializations

---

## ACCEPTANCE CRITERIA

**E4 DONE when:**
1. Migration applied (2 tables)
2. Types, Repositories, Services implemented
3. API routes implemented (6 endpoints)
4. Architecture Guard PASS
5. Build PASS
6. PR merged
7. E4 sealed

---

## CONSTITUTION COMPLIANCE

- ✅ Single scope (English Center only)
- ✅ Extends Platform Party entity (no duplication)
- ✅ Additive migration
- ✅ Tenant + branch isolation
