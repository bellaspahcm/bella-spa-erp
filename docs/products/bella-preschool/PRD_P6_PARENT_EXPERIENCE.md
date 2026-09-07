# P6 — Parent Experience

**Phase:** Modern Preschool Standard  
**Priority:** HIGH — Market expectation for modern preschools  
**Depends on:** P3 (Student/Attendance), P4 (Daily Care), P5 (Tuition)  
**Purpose:** Enable parents to monitor child's daily activities and financial status

---

## Overview

Modern parents expect real-time updates about their child's day at preschool.

**Market standard (OneKids, KidsOnline, NextX):**
- Mobile-friendly parent portal
- Daily activity timeline
- Attendance status
- Photos from school
- Payment status
- School announcements
- Direct messaging with teachers

**Critical design principle:** Parents query the **same data tables** as staff, with RLS enforcing authorization.

**DO NOT duplicate data models for parent views.**

---

## Authorization Model

**Parent access controlled by:**
1. Parent authentication (separate from staff login)
2. `student_guardians` junction table links authenticated customer → student
3. RLS policies enforce:
   - Parents see only their own children
   - Parents cannot see other families' data
   - Parents have read-only access (except communication)

**Implementation:**
- Reuse Platform Auth (customers → users mapping if exists)
- Verify parent identity independently from staff identity
- Parent session context: `tenant_id` + `customer_id` + `authorized_student_ids[]`

---

## Capabilities

### P6.1 — Parent Authentication & Access

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P6-001 | Parent login | Parent | Email/password or code | ✅ Platform Auth | ❓ May need customer auth | ✅ Login page | P0 | Parents can authenticate |
| PRE-P6-002 | Parent session | System | Establish parent context | ✅ Platform session | ✅ Student authorization check | ❌ | P0 | Parent authorized for specific students |
| PRE-P6-003 | Multi-child support | Parent | Switch between children | ❌ | ✅ Context switching | ✅ Child selector | P0 | Parents with multiple children can switch |
| PRE-P6-004 | Parent profile | Parent | View/edit own profile | ✅ Platform customers | ❓ May need action | ✅ Profile page | P1 | Parents can update contact info |

**Authorization query needed:**

```typescript
async function getAuthorizedStudents(customerId: string, tenantId: string) {
  // Query student_guardians where customer_id = customerId
  // Return student_id[]
}
```

---

### P6.2 — Child Profile & Status

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P6-005 | View child profile | Parent | See child info | ✅ Student table | ❌ Reuse with RLS | ✅ Profile view | P0 | See child's basic info |
| PRE-P6-006 | Today's status | Parent | See attendance today | ✅ Attendance table | ❌ Reuse with RLS | ✅ Status widget | P0 | See if checked-in/out |
| PRE-P6-007 | View classroom | Parent | See child's classroom | ✅ Enrollment + classroom | ❌ Reuse with RLS | ✅ Classroom info | P0 | See classroom and teachers |
| PRE-P6-008 | Attendance history | Parent | Past attendance | ✅ Attendance table | ❌ Reuse with RLS | ✅ History view | P1 | See attendance records |

---

### P6.3 — Daily Care Timeline

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P6-009 | View daily timeline | Parent | See today's activities | ✅ Daily care logs (P4) | ❌ Reuse with RLS | ✅ Timeline view | P0 | See meals/naps/activities |
| PRE-P6-010 | Meal updates | Parent | See what child ate | ✅ Daily care logs | ❌ Reuse with RLS | ✅ Meal display | P0 | See meal consumption |
| PRE-P6-011 | Nap updates | Parent | See sleep status | ✅ Daily care logs | ❌ Reuse with RLS | ✅ Nap display | P0 | See nap times |
| PRE-P6-012 | Hygiene updates | Parent | See bathroom activities | ✅ Daily care logs | ⚠️ Filter sensitive info | ✅ Hygiene display | P1 | See appropriate hygiene info |
| PRE-P6-013 | Teacher observations | Parent | See teacher notes | ✅ Daily care logs | ❌ Reuse with RLS | ✅ Observation display | P0 | See teacher observations |
| PRE-P6-014 | Activity photos | Parent | See photos from day | ✅ Daily care logs | ❌ Reuse with RLS | ✅ Photo gallery | P0 | See child's daily photos |
| PRE-P6-015 | Incident notifications | Parent | See incidents | ✅ Daily care logs | ⚠️ Sensitive data filter | ✅ Incident display | P0 | Notified of incidents appropriately |

**RLS consideration:** Some observations/incidents may need teacher approval before parent visibility.

---

### P6.4 — Health Information

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P6-016 | View allergies | Parent | See child's allergies | ✅ Allergies table (P4) | ❌ Reuse with RLS | ✅ Allergy display | P0 | See recorded allergies |
| PRE-P6-017 | View medications | Parent | See medication schedule | ✅ Medications table (P4) | ❌ Reuse with RLS | ✅ Medication display | P1 | See medication info |
| PRE-P6-018 | Medication log | Parent | See when meds administered | ✅ Medication logs (P4) | ❌ Reuse with RLS | ✅ Admin log view | P1 | See administration records |
| PRE-P6-019 | Growth tracking | Parent | See height/weight | ✅ Growth records (P4) | ❌ Reuse with RLS | ✅ Growth chart | P1 | See growth over time |

---

### P6.5 — Financial Information

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P6-020 | View balance | Parent | See outstanding balance | ✅ Charges/payments (P5) | ❌ Reuse with RLS | ✅ Balance display | P0 | See current balance |
| PRE-P6-021 | Payment history | Parent | See past payments | ✅ Payments table (P5) | ❌ Reuse with RLS | ✅ Payment list | P0 | See payment records |
| PRE-P6-022 | View charges | Parent | See upcoming/past charges | ✅ Charges table (P5) | ❌ Reuse with RLS | ✅ Charge list | P0 | See tuition/fees |
| PRE-P6-023 | Download receipts | Parent | Get payment receipts | ✅ Receipts (P5) | ❌ Reuse with RLS | ✅ Receipt download | P1 | Can download receipts |
| PRE-P6-024 | Payment submission | Parent | Submit payment info | ❓ | ✅ If supported | ✅ Payment form | P2 | Can indicate payment made (if needed) |

---

### P6.6 — Communication

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P6-025 | View announcements | Parent | See school announcements | ❌ | ✅ Announcements table | ✅ Announcement list | P0 | See school-wide announcements |
| PRE-P6-026 | Classroom announcements | Parent | See class-specific news | ❌ | ✅ Classroom announcements | ✅ Class news view | P1 | See classroom updates |
| PRE-P6-027 | Direct message teacher | Parent | Send message to teacher | ❌ | ✅ Messaging system | ✅ Message UI | P1 | Can message teachers |
| PRE-P6-028 | Message history | Parent | View past messages | ❌ | ✅ Message query | ✅ Message history | P1 | See conversation history |
| PRE-P6-029 | Notifications | Parent | Push/email notifications | ❓ Check Platform | ✅ Notification logic | ✅ Notification settings | P1 | Receive notifications |

**Schema needed:**

```sql
preschool_announcements (
  id, tenant_id,
  announcement_type, -- 'school', 'classroom'
  classroom_id, -- null for school-wide
  title, content,
  published_at, expires_at,
  created_by_user_id,
  created_at, updated_at
)

preschool_messages (
  id, tenant_id,
  from_user_id, from_customer_id,
  to_user_id, to_customer_id,
  student_id, -- context
  subject, message,
  sent_at, read_at,
  created_at
)
```

---

### P6.7 — Parent Management

| ID | Capability | User Role | Workflow | Existing Backend | New Backend | UI Needed | Priority | Acceptance |
|----|------------|-----------|----------|------------------|-------------|-----------|----------|------------|
| PRE-P6-030 | Update authorized pickup | Parent | Request pickup authorization change | ❌ | ✅ Request workflow | ✅ Request form | P2 | Can request pickup changes |
| PRE-P6-031 | Emergency contact update | Parent | Update emergency contact | ✅ Customers table | ❓ Update action | ✅ Contact form | P1 | Can update contact info |
| PRE-P6-032 | Absence notification | Parent | Notify school of absence | ❌ | ✅ Absence notification | ✅ Absence form | P1 | Can notify planned absence |

---

## Platform Reuse

**From Platform:**
- ✅ Customer authentication
- ✅ Customers table (guardian profiles)
- ✅ Session management
- ✅ Notification system (if exists)

**From Preschool:**
- ✅ All P3 data (students, attendance)
- ✅ All P4 data (daily care, health)
- ✅ All P5 data (tuition, payments)
- ✅ Student-guardian junction

**New Infrastructure:**
- Parent-specific UI/UX
- Announcements system
- Parent-teacher messaging
- Parent authorization queries

---

## UI/UX Requirements

**Mobile-first design:** Parents primarily use phones.

**Key UX principles:**
- Home screen = today's status
- Easy navigation to timeline
- Push notifications for important events
- Photo-heavy (parents love photos)
- Fast loading (parents check frequently)

**Not a separate app:** Web-based, mobile-responsive.

**Role-aware navigation:** Parent sees different menu than staff.

---

## Implementation Order

**Priority 0 (Critical):**
1. Parent authentication infrastructure
2. Student authorization query
3. Child profile view
4. Today's status widget
5. Daily care timeline
6. Activity photos display
7. Balance display
8. School announcements

**Priority 1:**
9. Payment history
10. Attendance history
11. Classroom info
12. Teacher messaging
13. Notifications
14. Growth tracking
15. Emergency contact update

**Priority 2:**
16. Absence notification
17. Payment submission
18. Pickup authorization request

---

## RLS Verification

**Critical security checks:**

1. **Parent authorization:**
   ```sql
   -- Parents can only see their own children
   CREATE POLICY parent_students ON preschool_students
   FOR SELECT TO authenticated
   USING (
     id IN (
       SELECT student_id FROM preschool_student_guardians
       WHERE customer_id = auth.uid()
       AND tenant_id = get_auth_tenant_id()
     )
   );
   ```

2. **Daily care logs:**
   ```sql
   -- Parents see only their children's logs
   CREATE POLICY parent_care_logs ON preschool_daily_care_logs
   FOR SELECT TO authenticated
   USING (
     student_id IN (
       SELECT student_id FROM preschool_student_guardians
       WHERE customer_id = auth.uid()
       AND tenant_id = get_auth_tenant_id()
     )
   );
   ```

3. **Financial data:**
   ```sql
   -- Parents see only their children's charges/payments
   CREATE POLICY parent_charges ON preschool_charges
   FOR SELECT TO authenticated
   USING (
     student_id IN (
       SELECT student_id FROM preschool_student_guardians
       WHERE customer_id = auth.uid()
       AND tenant_id = get_auth_tenant_id()
     )
   );
   ```

**Must verify:** RLS policies prevent parents from accessing other families' data.

---

## Acceptance Criteria (P6 Complete)

### Functional
- ✅ Parents can authenticate
- ✅ Parents see only their own children
- ✅ Parents see today's attendance status
- ✅ Parents see daily care timeline
- ✅ Parents see activity photos
- ✅ Parents see financial balance
- ✅ Parents see payment history
- ✅ Parents see school announcements
- ✅ Parents can message teachers (if P1)

### Non-Functional
- ✅ Mobile-responsive UI
- ✅ Fast loading times
- ✅ RLS enforced (no cross-family data leaks)
- ✅ Parent session isolated from staff session
- ✅ Photos display properly

### Demo-Ready
- ✅ Can demonstrate parent login → timeline flow
- ✅ Parent view looks modern (market-competitive)
- ✅ Can show to prospects as differentiator
- ✅ Parents can use without training

### Evidence
- ✅ Parent authentication tested
- ✅ Authorization boundaries tested
- ✅ RLS policies verified (no data leaks)
- ✅ Timeline display tested
- ✅ Financial data verified
- ✅ Cross-family isolation verified

---

## Risk: Authorization Complexity

**Critical:** Parent authorization is more complex than staff authorization.

**Risks:**
- Parent sees other families' data (RLS failure)
- Parent sees data after student withdrawn (temporal authorization)
- Parent can modify data (should be read-only except communication)

**Mitigation:**
- Comprehensive RLS testing
- Authorization boundary verification
- Separate E2E tests for parent flows
- Manual security review

---

## EXTRACTION_CANDIDATE

If future products need parent/guardian portals:
- Bella School (K-12 parent portal)
- Bella Training (student/parent portal)

Consider extracting **Parent Portal Kernel**.

**NOT NOW.** Build for Preschool, extract later if pattern repeats.

---

## Next Phase

After P6 complete → **P7: School Management**

P7 covers staff/teacher management, operational reports, school settings.
