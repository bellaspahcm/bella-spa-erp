# Education Finance Domain Discovery
**Phase:** 2 — Education Discovery  
**Date:** 2026-08-18  
**Status:** IN PROGRESS  
**Objective:** Map Education OS domain entities and understand business model BEFORE designing financial integration

---

## Discovery Method

**Source:** Actual Education OS implementation (not assumptions)
- Schema: `supabase/migrations/20260613100000_create_student_training_foundation.sql`
- Module: `student_training` (enabled_modules flag)
- Role: `student` role added to users

**Approach:**
1. Observe existing domain entities
2. Map business relationships
3. Identify financial touch points
4. Classify responsibilities
5. Identify unknowns

**NOT doing:**
- ❌ Designing adapters
- ❌ Writing financial journal logic
- ❌ Deciding accounting treatment
- ❌ Modifying Finance Kernel

---

## Education Domain Entities

### Core Domain Model

```
Tenant (multi-tenant)
  ↓
Course (Training Program)
  ├─ title, description, specialty
  ├─ tuition_amount (NUMERIC)
  ├─ theory_duration_minutes
  ├─ status: draft | active | archived
  ↓
Course_Modules (Curriculum Structure)
  ├─ title, description
  ├─ sequence_order
  ↓
Lessons (Learning Content)
  ├─ content_type: document | video | pdf | quiz | live_class
  ├─ content_url, body
  ├─ required_view_seconds, required_view_percentage
  ├─ status: draft | published | archived

Student (Enrollment)
  ├─ user_id (links to users table)
  ├─ course_id
  ├─ full_name, phone, email
  ├─ enrollment_status: active | paused | graduated | withdrawn
  ├─ tuition_total (NUMERIC)
  ├─ tuition_paid (NUMERIC)
  ├─ enrolled_at, graduated_at
  ├─ CONSTRAINT: tuition_paid <= tuition_total

Student_Tuition_Payments (Payment Records)
  ├─ student_id
  ├─ amount (NUMERIC, CHECK > 0)
  ├─ payment_method: cash | bank_transfer | vietqr | card | other
  ├─ payment_status: recorded | voided
  ├─ paid_at
  ├─ recorded_by (user_id)
  ├─ receipt_number (UNIQUE per tenant)

Student_Lesson_Progress (Learning Tracking)
  ├─ student_id, lesson_id
  ├─ time_spent_seconds, view_percentage
  ├─ is_completed, completed_at
  ├─ last_accessed_at

Training_Classes (Scheduled Sessions)
  ├─ course_id, trainer_id
  ├─ class_type: theory | practice | exam | orientation
  ├─ starts_at, ends_at
  ├─ location_note, capacity
  ├─ status: scheduled | completed | cancelled

Student_Class_Attendance (Attendance Tracking)
  ├─ student_id, class_id
  ├─ attendance_status: present | excused_absent | absent
  ├─ checked_in_at, checked_by
```

---

## Business Model Understanding

### Revenue Model

**Primary Revenue:** Tuition fees for training courses

**Structure:**
```
Course
  ├─ tuition_amount (catalog price)
  ↓
Student enrolls
  ├─ tuition_total (obligation amount - may differ from catalog)
  ├─ tuition_paid (累積 payments)
  ↓
Student_Tuition_Payments
  ├─ amount (payment instance)
  ├─ payment_method
  ├─ paid_at (收款時點)
```

**Key observation:**
- `tuition_total` and `tuition_paid` are **tracked in Education OS**
- Payments **recorded** in Education OS
- Financial **posting** to Finance OS: TBD (Phase 3)

### Cost Model

**Identified costs:**
1. **Trainer compensation** - Linked via `training_classes.trainer_id`
2. **Course content creation** - Implicit (lessons, modules)
3. **Operational costs** - Not visible in current schema

**Unknown:**
- How are trainer payments calculated?
- Are there per-class compensation rules?
- Are there commission/bonus structures?
- How are scholarships/discounts handled?

---

## Financial Touch Points

### 1. Enrollment (Revenue Recognition Point?)

**Business Event:** Student enrolls in course

**Data:**
```typescript
Student created
  - tuition_total: NUMERIC
  - enrolled_at: DATE
  - enrollment_status: 'active'
```

**Financial Intent:** Revenue obligation created

**Questions:**
- When does revenue recognize? (enrollment? completion? payment?)
- Is tuition_total always equal to course.tuition_amount?
- Can tuition_total be discounted/adjusted after enrollment?
- Is there enrollment fee separate from tuition?

**Accounting implications:**
- If recognize on enrollment: Deferred Revenue
- If recognize on completion: Revenue Recognition Rule
- If recognize on payment: Cash basis (unlikely for education)

---

### 2. Tuition Payment (Cash Receipt)

**Business Event:** Student makes payment

**Data:**
```typescript
Student_Tuition_Payment created
  - amount: NUMERIC (CHECK > 0)
  - payment_method: 'cash' | 'bank_transfer' | ...
  - paid_at: TIMESTAMPTZ
  - payment_status: 'recorded' | 'voided'
  - receipt_number: TEXT (UNIQUE)
```

**Financial Intent:** Cash receipt, AR reduction (if AR exists)

**Questions:**
- Is payment reducing Accounts Receivable? Or just tracking cash?
- Does payment trigger revenue recognition? Or separate?
- What happens when payment > tuition_total?
- Can payments be refunded? (payment_status='voided' suggests yes)

**Accounting implications:**
- DR Cash, CR AR (if AR model)
- DR Cash, CR Deferred Revenue (if advance payment)
- Need to understand revenue recognition policy

---

### 3. Enrollment Status Changes

**Business Events:**
- `enrollment_status: 'paused'` - Student takes break
- `enrollment_status: 'graduated'` - Student completes course
- `enrollment_status: 'withdrawn'` - Student leaves before completion

**Financial Intent:**
- Graduated: Revenue recognition finalized? Tuition earned?
- Withdrawn: Refund policy? Tuition forfeiture? Partial revenue recognition?
- Paused: No immediate financial effect?

**Questions:**
- What is refund policy for withdrawn students?
- Is tuition pro-rated based on completion percentage?
- Are there withdrawal fees?
- Does graduated status affect revenue recognition timing?

**Accounting implications:**
- Graduated: Deferred Revenue → Revenue (if recognize on completion)
- Withdrawn: May trigger refund liability, revenue reversal
- Paused: Likely no immediate GL effect

---

### 4. Payment Voiding

**Business Event:** Payment status changed to 'voided'

**Financial Intent:** Reverse cash receipt, restore AR (if applicable)

**Questions:**
- Why is payment voided? (error? refund? fraudulent?)
- Does void trigger refund to student?
- Is new payment expected? Or enrollment cancelled?

**Accounting implications:**
- DR AR (or Deferred Revenue), CR Cash
- May require refund liability if cash already disbursed

---

### 5. Training Classes (Instructor Costs?)

**Business Event:** Training class scheduled/completed

**Data:**
```typescript
Training_Classes
  - trainer_id: UUID (instructor)
  - class_type: 'theory' | 'practice' | 'exam' | 'orientation'
  - starts_at, ends_at
  - status: 'scheduled' | 'completed' | 'cancelled'
```

**Financial Intent:** Instructor compensation cost?

**Questions:**
- Are trainers employees (payroll) or contractors (AP)?
- How is compensation calculated? (per-class? per-hour? salary?)
- Is compensation tracked in Education OS or separate HR/Payroll module?
- Are there class-specific fees (e.g., exam proctoring)?

**Accounting implications:**
- DR Instructor Expense, CR Cash/AP (if per-class payment)
- May flow through HR/Payroll module (not direct Education → Finance)

---

### 6. Scholarships / Discounts (Not yet visible)

**Business Event:** Scholarship/discount applied to student

**Current schema:** NO scholarship/discount table found

**Questions:**
- How are scholarships applied? (tuition_total adjusted?)
- Are discounts tracked separately?
- Is there scholarship fund accounting?
- Are there scholarship eligibility rules?

**Accounting implications:**
- DR Scholarship Expense, CR Tuition Revenue (contra-revenue)
- Or: DR Scholarship Expense, CR AR (if reduces obligation)

**Status:** UNKNOWN - Needs clarification

---

## Domain Boundary Analysis

### Education OS Responsibility

**What Education OS owns:**
1. **Course catalog** - Programs, modules, lessons
2. **Student lifecycle** - Enrollment, progress, graduation
3. **Learning delivery** - Content access, progress tracking
4. **Attendance** - Class attendance, trainer assignment
5. **Payment recording** - Cash receipt documentation
6. **Tuition obligation tracking** - `tuition_total`, `tuition_paid`

**What Education OS does NOT own:**
1. ❌ General Ledger posting
2. ❌ Chart of Accounts
3. ❌ Financial reporting
4. ❌ Journal entry creation
5. ❌ Accounts Receivable subsidiary ledger
6. ❌ Revenue recognition policy enforcement

---

### Finance OS Responsibility

**What Finance OS owns:**
1. **Double-entry bookkeeping** - All GL postings
2. **Account structure** - COA, account hierarchy
3. **Financial integrity** - F1-F5 invariants
4. **Transaction atomicity** - All-or-nothing posting
5. **Tenant isolation** - Multi-tenant financial data
6. **Audit trail** - Immutable financial history

**What Finance OS does NOT own:**
1. ❌ Student enrollment logic
2. ❌ Course management
3. ❌ Learning progress tracking
4. ❌ Tuition amount calculation (business rules)
5. ❌ Payment method processing
6. ❌ Refund policy logic

---

### Integration Boundary (TBD - Phase 3)

**Question:** Where does Education stop and Finance start?

**Hypothesis:**
```
Education OS
  ├─ Student enrolls
  ├─ Payment received
  ├─ Status changes (graduated, withdrawn)
  ↓
──────────── BOUNDARY ────────────────
  ↓
Financial Intent
  ├─ "Tuition obligation created"
  ├─ "Cash received for tuition"
  ├─ "Revenue earned (graduated)"
  ├─ "Refund liability (withdrawn)"
  ↓
Finance Adapter (TBD - Phase 4+)
  ├─ Maps Education events → Financial events
  ├─ Applies accounting policy
  ├─ Constructs journal entries
  ↓
Finance Public Contract
  ↓
Finance OS
  ├─ Posts to GL
  ├─ Updates AR
  ├─ Records in ledger
```

**To be proven in Phase 3.**

---

## Education-Specific vs. Finance-Generic

### Education-Specific Concepts

**These belong in Education OS, NOT Finance OS:**

1. **Student** - Education domain entity
2. **Course** - Education catalog
3. **Enrollment** - Education business process
4. **Lesson Progress** - Learning-specific
5. **Attendance** - Education operational metric
6. **Graduation Status** - Education lifecycle milestone
7. **Training Classes** - Education delivery mechanism

**Contract Generality Test:**
- ❌ Hospital doesn't have "students"
- ❌ Manufacturing doesn't have "courses"
- ❌ Retail doesn't have "enrollment"

**Conclusion:** These concepts CANNOT be in Finance contract directly.

---

### Finance-Generic Concepts

**These can be in Finance contract (general across industries):**

1. **Revenue obligation** - All industries recognize revenue
2. **Cash receipt** - All industries receive payment
3. **Accounts Receivable** - All industries have credit sales
4. **Refund liability** - All industries may issue refunds
5. **Deferred revenue** - All industries may have advance payments
6. **Cost recognition** - All industries incur costs

**Contract Generality Test:**
- ✅ Hospital: Patient services revenue
- ✅ Education: Tuition revenue
- ✅ Manufacturing: Product sales revenue
- ✅ Retail: Merchandise sales revenue

**Conclusion:** Finance contract should use general concepts.

---

## Unknowns and Open Questions

### High Priority (Needed for Phase 3)

1. **Revenue Recognition Policy**
   - When does Education recognize tuition revenue?
   - On enrollment? On completion? Pro-rated over course duration?
   - Is there deferral period?

2. **Accounts Receivable Model**
   - Does Education use AR? Or cash-only?
   - If AR: When is AR created? (enrollment? invoice generation?)
   - Is `tuition_total - tuition_paid` equivalent to AR balance?

3. **Refund Policy**
   - What triggers refund? (withdrawn before completion?)
   - Is refund full or pro-rated?
   - How is refund processed financially?

4. **Discount/Scholarship Handling**
   - How are scholarships applied?
   - Is there separate scholarship fund accounting?
   - Are discounts tracked as contra-revenue?

5. **Instructor Compensation**
   - How are trainers paid?
   - Is compensation per-class, per-hour, or salary?
   - Does Education OS trigger payment? Or separate Payroll module?

### Medium Priority (Can defer to later phases)

6. **Multi-Course Enrollment**
   - Can student enroll in multiple courses simultaneously?
   - Is tuition tracked per-course or aggregated?

7. **Course Modifications**
   - Can `course.tuition_amount` change after enrollment?
   - Does change affect existing students?

8. **Payment Allocation**
   - If student owes multiple courses, how is payment allocated?
   - First-in-first-out? Pro-rated? Specified by payer?

9. **Late Payment Handling**
   - Are there late fees?
   - Can student attend class if payment overdue?

10. **Course Cancellation**
    - What if course cancelled after enrollment?
    - Full refund? Partial? Credit toward other course?

---

## Template Potential for Future Industries

### Reusable Patterns Identified

**Pattern 1: Obligation + Payment Tracking**
```
Industry creates obligation
  → tracks obligation amount
  → records payments
  → maintains running balance
```

**Generality:**
- Education: tuition_total, tuition_paid
- Hospital: treatment cost, insurance coverage, patient responsibility
- Manufacturing: order amount, deposits, final payment
- Retail: invoice amount, payments received

**Template potential:** ✅ HIGH

---

**Pattern 2: Lifecycle Status Changes → Financial Effects**
```
Entity status changes
  → triggers financial consequence
  → requires mapping to accounting treatment
```

**Generality:**
- Education: enrolled → graduated → withdrawn
- Hospital: admitted → treated → discharged
- Manufacturing: ordered → produced → shipped
- Retail: order placed → fulfilled → returned

**Template potential:** ✅ HIGH

---

**Pattern 3: Payment Methods Diversity**
```
Industry accepts multiple payment methods
  → each with own processing characteristics
  → all map to same financial effect (cash receipt)
```

**Generality:**
- cash, bank_transfer, vietqr, card, other
- Same across all industries

**Template potential:** ✅ HIGH

---

**Pattern 4: Refund/Void Handling**
```
Business process reversal
  → requires financial reversal
  → maintains audit trail
```

**Generality:**
- Education: payment voiding, withdrawal refund
- Hospital: billing adjustment, insurance reversal
- Manufacturing: order cancellation, deposit refund
- Retail: product return, payment refund

**Template potential:** ✅ HIGH

---

### Industry-Specific Complexity

**NOT reusable (Education-specific):**
- Course curriculum structure (modules, lessons)
- Learning progress tracking (view_percentage, completion)
- Class scheduling and attendance
- Trainer assignment

**These stay in Education OS adapter, not in template.**

---

## Next Steps

### Phase 2 Completion Criteria

**Remaining artifacts:**
1. ✅ EDUCATION_FINANCE_DOMAIN_DISCOVERY.md (this document)
2. ⏳ EDUCATION_FINANCE_TOUCH_POINTS.md (detailed financial event mapping)
3. ⏳ EDUCATION_FINANCE_RESPONSIBILITY_MATRIX.md (boundary clarification)

**After Phase 2:**
→ Phase 3: Contract Design
→ E-ARCH-1 Gate (architecture approval)
→ Phase 4+: Implementation

---

## Discovery Status

**Domain entities:** ✅ MAPPED (from actual schema)

**Business model:** 🟡 PARTIALLY UNDERSTOOD
- Revenue model: Clear (tuition-based)
- Cost model: Unclear (trainer compensation?)
- Refund policy: Unknown
- Scholarship handling: Unknown

**Financial touch points:** ✅ IDENTIFIED (6 key events)

**Boundary:** 🟡 HYPOTHESIS FORMED (needs validation in Phase 3)

**Template potential:** ✅ IDENTIFIED (4 reusable patterns)

**Unknowns:** 🔴 10 HIGH PRIORITY QUESTIONS

**Ready for Phase 3:** ❌ NO (need answers to high priority questions first)

---

**Phase 2 Status:** IN PROGRESS  
**Next:** Map financial touch points in detail, clarify unknowns with stakeholders
