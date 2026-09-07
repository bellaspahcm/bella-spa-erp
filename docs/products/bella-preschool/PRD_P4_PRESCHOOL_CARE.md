# P4 — Preschool Care

**Phase:** Differentiation  
**Priority:** HIGH — Transforms generic student management into preschool system  
**Depends on:** P3 (Student, Attendance)  
**Purpose:** Daily care tracking that differentiates preschool from K-12/higher-ed

---

## Overview

**This is what makes Bella Preschool a preschool product**, not just student/class CRUD.

Parents expect daily updates on:
- What child ate
- How well child slept
- Bathroom/hygiene
- Activities/observations
- Any incidents
- Health status

Teachers need to record this throughout the day.

**Market expectation:** OneKids, KidsOnline, NextX all emphasize daily care timeline visible to parents.

---

## Capabilities

### P4.1 — Daily Care Log

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P4-001 | Daily care schema | System | Store daily activities | ❌ | ✅ New table needed | ❌ | P0 | Table exists with RLS |
| PRE-P4-002 | Record meal | Teacher | Log meal + quantity | ❌ | ✅ `recordMealAction` | ✅ Meal form | P0 | Can record breakfast/lunch/snack |
| PRE-P4-003 | Meal status | Teacher | Ate all/some/none | ❌ | ✅ Part of meal action | ✅ Status select | P0 | Can indicate meal consumption |
| PRE-P4-004 | Record nap | Teacher | Log nap time + duration | ❌ | ✅ `recordNapAction` | ✅ Nap form | P0 | Can record sleep start/end |
| PRE-P4-005 | Record hygiene | Teacher | Log bathroom/diaper | ❌ | ✅ `recordHygieneAction` | ✅ Hygiene form | P0 | Can record bathroom activities |
| PRE-P4-006 | Daily observation | Teacher | Add observation note | ❌ | ✅ `addObservationAction` | ✅ Note form | P0 | Can add teacher observations |
| PRE-P4-007 | Record incident | Teacher | Log incident | ❌ | ✅ `recordIncidentAction` | ✅ Incident form | P0 | Can record incidents with details |
| PRE-P4-008 | View daily timeline | Teacher, Parent | See all today's activities | ❌ | ✅ `getDailyTimelineAction` | ✅ Timeline view | P0 | See chronological activity log |
| PRE-P4-009 | Activity photos | Teacher | Add photos to activities | ❌ | ✅ Photo storage integration | ✅ Photo upload | P1 | Can attach photos to activities |

**Schema needed:**

```sql
preschool_daily_care_logs (
  id, tenant_id, student_id, activity_date,
  activity_type, -- 'meal', 'nap', 'hygiene', 'observation', 'incident'
  activity_time,
  meal_type, meal_status, meal_notes,
  nap_start, nap_end, nap_notes,
  hygiene_type, hygiene_notes,
  observation_text,
  incident_type, incident_description, incident_severity,
  recorded_by_user_id,
  photo_urls,
  created_at, updated_at
)
```

---

### P4.2 — Health & Medical

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P4-010 | Health profile schema | System | Store health info | ❌ | ✅ New table | ❌ | P0 | Table exists |
| PRE-P4-011 | Record allergies | Admin | Add allergy with severity | ⚠️ students.notes | ✅ Structured table needed | ✅ Allergy form | P0 | Can record allergies properly |
| PRE-P4-012 | Medical history | Admin | Record medical conditions | ❌ | ✅ Medical history table | ✅ Medical form | P1 | Can record medical info |
| PRE-P4-013 | Medication | Admin | Record medication + schedule | ❌ | ✅ Medication table | ✅ Medication form | P1 | Can track medications |
| PRE-P4-014 | Administer medication | Teacher | Log medication given | ❌ | ✅ `administerMedicationAction` | ✅ Admin log | P1 | Can record medication administration |
| PRE-P4-015 | Health incident | Teacher | Record injury/illness | ❌ | ✅ Part of incident | ✅ Health incident UI | P0 | Can record health incidents |
| PRE-P4-016 | Height/weight | Admin | Record growth metrics | ❌ | ✅ Growth tracking table | ✅ Growth form | P1 | Can track physical development |
| PRE-P4-017 | Immunizations | Admin | Track vaccination records | ❌ | ✅ If required | ✅ Immunization form | P2 | Can record immunizations (if needed) |

**Schema needed:**

```sql
preschool_student_health (
  id, tenant_id, student_id,
  blood_type, chronic_conditions,
  created_at, updated_at
)

preschool_allergies (
  id, tenant_id, student_id,
  allergen, severity, reaction, notes,
  created_at
)

preschool_medications (
  id, tenant_id, student_id,
  medication_name, dosage, schedule, start_date, end_date,
  authorization_document_url,
  created_at, updated_at
)

preschool_medication_logs (
  id, tenant_id, student_id, medication_id,
  administered_at, administered_by_user_id,
  notes, created_at
)

preschool_growth_records (
  id, tenant_id, student_id,
  measurement_date, height_cm, weight_kg,
  recorded_by_user_id,
  notes, created_at
)
```

---

## Platform Reuse

**From Platform:**
- ✅ Photo storage (if Platform has file upload capability)
- ✅ Users table (recorded_by_user_id)
- ✅ RLS patterns

**From Preschool:**
- ✅ Students table
- ✅ Attendance (activity timeline related to attendance)

**New Infrastructure:**
- Daily care log system
- Health profile system
- Medication tracking
- Photo storage (if not in Platform)

---

## Parent Visibility

**Critical:** P4 data feeds into P6 Parent Experience.

Parent should see:
- Today's meals
- Today's naps
- Bathroom activities
- Teacher observations
- Any incidents (with appropriate filtering)
- Photos/activities

**Do NOT duplicate data model.** Parent views query same `preschool_daily_care_logs` with appropriate RLS.

---

## Implementation Order

**Priority 0:**
1. Daily care schema
2. Record meal action + UI
3. Record nap action + UI
4. Record hygiene action + UI
5. Daily observation action + UI
6. View daily timeline (teacher view)
7. Record incident action + UI
8. Allergy management (structured)

**Priority 1:**
9. Medication tracking
10. Administer medication log
11. Height/weight tracking
12. Activity photos

**Priority 2:**
13. Immunizations (if required)
14. Advanced health records

---

## Acceptance Criteria (P4 Complete)

### Functional
- ✅ Teachers can record meals, naps, hygiene throughout day
- ✅ Teachers can add observations
- ✅ Teachers can record incidents
- ✅ Teachers can view daily timeline for each student
- ✅ Allergies stored in structured format (not just notes)
- ✅ Health incidents recorded properly
- ✅ Medication tracking (if P1 prioritized)

### Non-Functional
- ✅ Daily care log is easy to use (not time-consuming)
- ✅ Timeline view is chronological and clear
- ✅ RLS enforces tenant isolation
- ✅ Parent-visible data properly filtered

### Demo-Ready
- ✅ Can demonstrate daily care workflow
- ✅ Can show timeline to prospects
- ✅ Differentiates product from generic student management
- ✅ Looks like a preschool product (not K-12)

### Evidence
- ✅ Daily care actions tested
- ✅ Timeline query tested
- ✅ Parent visibility verified (when P6 built)
- ✅ RLS verified for health data

---

## Risk: Complexity

Daily care logging must be **fast and easy** for teachers.

If it takes 5 minutes to record each activity, teachers won't use it.

**Mitigation:**
- Quick-entry forms
- Defaults for common values
- Bulk actions where applicable
- Mobile-friendly (teachers use tablets/phones)

---

## EXTRACTION_CANDIDATE

If future education products (Bella School, Bella Training) also need:
- Daily observations
- Incident tracking
- Health profiles

Then consider extracting to **Education Care Kernel**.

**NOT NOW.** Mark for future evaluation.

---

## Next Phase

After P4 complete → **P5: Tuition & Finance**

P5 depends on P3 Student foundation.
