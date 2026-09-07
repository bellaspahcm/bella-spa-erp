# P7 — School Management

**Phase:** Operational Completeness  
**Priority:** MEDIUM — Required for multi-staff operations  
**Depends on:** P3 (Core operations foundation)  
**Purpose:** Enable school administrators to manage staff, settings, and operations

---

## Overview

Schools need to manage:
- Staff/teachers
- Roles and permissions
- Teacher assignments
- Operational reports
- School settings
- Multi-branch support (through existing tenant architecture)

**Scope constraint:** Do NOT build new enterprise abstractions solely for hypothetical scale.

Reuse Platform capabilities where they exist.

---

## Capabilities

### P7.1 — Staff & Teacher Management

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-001 | List staff | Admin | View all staff | ✅ Platform users table | ❓ May need preschool filter | ✅ Staff list | P0 | See all teachers/staff |
| PRE-P7-002 | Create staff | Admin | Add new staff member | ✅ Platform user creation | ❓ Role assignment | ✅ Staff form | P0 | Can add staff |
| PRE-P7-003 | Edit staff | Admin | Update staff info | ✅ Platform user update | ❌ | ✅ Edit form | P0 | Can update staff |
| PRE-P7-004 | Staff roles | Admin | Assign roles | ✅ Platform roles | ❓ Preschool-specific roles | ✅ Role assignment | P0 | Can assign teacher/admin/staff |
| PRE-P7-005 | Staff status | Admin | Activate/deactivate | ✅ Platform user status | ❌ | ✅ Status toggle | P0 | Can deactivate staff |
| PRE-P7-006 | View staff profile | Admin | See staff details | ✅ Platform users | ❌ | ✅ Profile page | P1 | See staff info |

**Platform reuse:**
- ✅ `users` table
- ✅ User authentication
- ✅ Role-based access control (RBAC)

**Preschool-specific roles needed:**
- School Admin (full access)
- Teacher (classroom + attendance + daily care)
- Staff (attendance + daily care, no admin)
- Parent (separate authorization model from P6)

**Classification:**

```typescript
// Reuse Platform roles, extend with preschool context
type PreschoolRole = 
  | 'preschool_admin'
  | 'preschool_teacher'
  | 'preschool_staff'
  | 'preschool_parent';
```

---

### P7.2 — Teacher Assignments

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-007 | Assign teacher to classroom | Admin | Link teacher → classroom | ✅ Classroom table fields | ❌ Update action | ✅ Assignment UI | P0 | Can assign lead/assistant teachers |
| PRE-P7-008 | View teacher schedule | Teacher, Admin | See teacher's classrooms | ✅ Query classrooms by teacher | ❌ | ✅ Schedule view | P1 | See which classes teacher has |
| PRE-P7-009 | Teacher workload | Admin | See teacher assignments | ❌ | ✅ Workload query | ✅ Workload view | P2 | See assignments per teacher |

**Backend reuse:**
- ✅ `preschool_classrooms.lead_teacher_id`
- ✅ `preschool_classrooms.assistant_teacher_id`

---

### P7.3 — Staff Attendance (Optional)

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-010 | Staff attendance | Admin | Track staff attendance | ❓ Check Platform | ✅ If not in Platform | ✅ Staff attendance UI | P2 | Can track staff check-in (if needed) |

**Decision:** Only build if Platform doesn't have staff attendance capability AND customer needs it.

**If Platform has general attendance:** Reuse.

**If not needed:** Skip for baseline.

---

### P7.4 — Activities & Planning

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-011 | Plan activities | Teacher, Admin | Create activity plan | ❌ | ✅ Activities table | ✅ Activity planner | P2 | Can plan classroom activities |
| PRE-P7-012 | School calendar | Admin | Manage school calendar | ❌ | ✅ Calendar events table | ✅ Calendar UI | P2 | Can set holidays/events |
| PRE-P7-013 | Classroom schedule | Teacher | Set daily schedule | ❌ | ✅ Schedule table | ✅ Schedule UI | P2 | Can define class schedule |

**Priority:** P2 (nice to have, not baseline critical)

**Schema (if P2 built):**

```sql
preschool_activities (
  id, tenant_id, classroom_id,
  activity_date, activity_time,
  activity_name, activity_type, description,
  created_by_user_id,
  created_at, updated_at
)

preschool_school_events (
  id, tenant_id,
  event_date, event_name, event_type, -- 'holiday', 'closure', 'event'
  description,
  created_at, updated_at
)
```

---

### P7.5 — Announcements

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-014 | Create announcement | Admin | Post school announcement | ❌ P6 schema | ✅ Create action | ✅ Announcement form | P0 | Can post announcements |
| PRE-P7-015 | Classroom announcement | Teacher | Post to classroom | ❌ P6 schema | ✅ Create action | ✅ Class announcement form | P1 | Can post class news |
| PRE-P7-016 | Manage announcements | Admin | Edit/delete announcements | ❌ | ✅ Update/delete actions | ✅ Management UI | P1 | Can manage announcements |

**Reuse P6 schema:** `preschool_announcements`

**New:** Staff-side creation UI (parents only see in P6)

---

### P7.6 — Operational Reports

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-017 | Attendance report | Admin | Attendance by date/class | ✅ Attendance table | ✅ Report query | ✅ Report page | P0 | Can generate attendance reports |
| PRE-P7-018 | Enrollment report | Admin | Current enrollment stats | ✅ Enrollment table | ✅ Stats query | ✅ Report widget | P0 | See enrollment by classroom |
| PRE-P7-019 | Daily care report | Admin | Daily care activities summary | ✅ Daily care logs | ✅ Report query | ✅ Report page | P1 | See daily care statistics |
| PRE-P7-020 | Financial report | Admin | Revenue/receivables | ✅ P5 finance tables | ✅ Report query | ✅ Report page | P0 | See financial summary |
| PRE-P7-021 | Student status report | Admin | Active/withdrawn/graduated | ✅ Students table | ✅ Stats query | ✅ Report widget | P1 | See student status breakdown |

**Backend reuse:** Query existing tables, no new schema needed.

**New:** Report query actions + UI presentation.

---

### P7.7 — Audit & History

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-022 | Activity log | Admin | View system activity | ❓ Platform audit | ✅ If not in Platform | ✅ Audit log UI | P2 | Can see who did what (if needed) |
| PRE-P7-023 | Change history | Admin | See record changes | ❓ Platform audit | ❌ | ✅ History view | P2 | See change timeline (if needed) |

**Decision:** Only build if Platform doesn't have audit logging.

**If Platform has audit:** Reuse.

**If not critical for baseline:** Skip.

---

### P7.8 — School Settings

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-024 | School profile | Admin | Set school name/info | ✅ Tenants table | ❓ May need preschool extension | ✅ Settings page | P0 | Can configure school info |
| PRE-P7-025 | Operating hours | Admin | Set school hours | ❌ | ✅ Settings table | ✅ Hours form | P1 | Can set operating hours |
| PRE-P7-026 | Age group config | Admin | Define age groups | ❌ | ✅ Settings table | ✅ Age group form | P1 | Can configure age groups |
| PRE-P7-027 | Notification settings | Admin | Configure notifications | ❓ Platform settings | ✅ If not in Platform | ✅ Notification config | P2 | Can set notification preferences |

**Schema needed:**

```sql
preschool_school_settings (
  id, tenant_id,
  setting_key, setting_value, setting_type,
  created_at, updated_at,
  UNIQUE(tenant_id, setting_key)
)

-- Examples:
-- ('operating_hours_start', '07:00', 'time')
-- ('operating_hours_end', '18:00', 'time')
-- ('age_groups', '[{"name":"Infants","min_months":0,"max_months":18}]', 'json')
```

---

### P7.9 — Multi-Branch Support

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P7-028 | Multi-tenant isolation | System | Enforce tenant boundaries | ✅ Platform RLS | ❌ | ❌ | P0 | Each tenant isolated |
| PRE-P7-029 | Branch management | System Admin | Create new branches | ✅ Platform tenants | ❌ | ❌ | P2 | Can provision new schools |

**Design:** Each school = separate tenant (reuse Platform multi-tenancy).

**No new abstraction needed.** Platform Core already supports multi-tenant.

**Out of scope for P7:** Multi-branch enterprise orchestration (not needed for baseline).

---

## Platform Reuse Analysis

**From Platform Core:**
- ✅ Users table (staff/teachers)
- ✅ Tenants table (schools)
- ✅ Roles & permissions
- ✅ Authentication
- ✅ RLS (tenant isolation)
- ✅ Audit logging (if exists)

**From Preschool:**
- ✅ All P3-P6 tables

**New Infrastructure:**
- Staff/teacher management UI (backend reuses Platform users)
- Announcements creation UI
- Reports UI
- School settings storage
- Activity planning (if P2 built)

---

## Implementation Order

**Priority 0 (Critical):**
1. Staff list view (reuse Platform users)
2. Staff create/edit (reuse Platform user actions)
3. Teacher assignment to classroom
4. School profile settings
5. Create announcement UI
6. Attendance report
7. Financial report

**Priority 1:**
8. Enrollment report
9. Classroom announcement
10. Teacher schedule view
11. Operating hours settings
12. Age group config
13. Daily care report

**Priority 2:**
14. Activity planner
15. School calendar
16. Staff attendance (if needed)
17. Audit log (if not in Platform)
18. Teacher workload view

---

## Acceptance Criteria (P7 Complete)

### Functional
- ✅ Can create/manage staff accounts
- ✅ Can assign roles (admin/teacher/staff)
- ✅ Can assign teachers to classrooms
- ✅ Can create school-wide announcements
- ✅ Can generate attendance reports
- ✅ Can generate financial reports
- ✅ Can configure school settings

### Non-Functional
- ✅ Reuses Platform user management
- ✅ RLS enforced (tenant + role)
- ✅ Reports perform adequately
- ✅ Settings persist correctly

### Demo-Ready
- ✅ Can demonstrate staff workflow
- ✅ Can show reports to prospects
- ✅ Can configure demo school
- ✅ Multi-staff operations work smoothly

### Evidence
- ✅ Platform reuse documented
- ✅ Staff authorization tested
- ✅ Teacher assignment tested
- ✅ Reports verified
- ✅ Settings persistence verified

---

## Risk: Over-Engineering

**Avoid:**
- ❌ Building HR system
- ❌ Payroll management
- ❌ Performance reviews
- ❌ Advanced scheduling algorithms
- ❌ Multi-branch orchestration abstractions

**Baseline scope:** Staff CRUD, teacher assignment, basic reports, settings.

**Complex HR features:** Out of scope for commercial baseline.

---

## EXTRACTION_CANDIDATE

If future products need similar staff management:
- Bella School (K-12 teacher management)
- Bella Spa (staff scheduling)
- Bella Gym (trainer management)

Consider extracting **Staff Management Kernel**.

**NOT NOW.** Reuse Platform users, extract later if pattern repeats across products.

---

## Next Phase

After P7 complete → **P8: Commercial Readiness**

P8 is polish phase: consistent UI, loading states, error handling, demo dataset, deployment readiness.
