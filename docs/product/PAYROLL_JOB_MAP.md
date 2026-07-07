# Payroll Job Map

**Version:** v1.0  
**Date:** 2026-06-22  
**Purpose:** Document what HR actually does, not what we think they need

---

## Core Principle

**Jobs-to-be-Done before Information Architecture.**

❌ Don't ask: "What screens do they need?"  
✅ Ask: "What jobs are they trying to get done?"

---

## Job #1: Run Monthly Payroll

**Actor:** HR Manager  
**Frequency:** Once per month (25th-30th)  
**Duration:** 2-4 hours  
**Trigger:** End of month approaching  

**Steps (Current manual process):**
1. Collect attendance data (from Excel or attendance system)
2. Collect commission data (from booking system)
3. Collect leave/absence data (from leave system)
4. Open salary template (Excel)
5. Fill in data for each employee (manual entry, prone to errors)
6. Calculate totals (Excel formulas)
7. Check for anomalies (employees with 0 salary, negative amounts, etc.)
8. Fix errors → Recalculate
9. Get manager approval (print PDF, sign)
10. Export to accounting system (manual export)
11. Generate bank transfer file (copy-paste to bank portal)

**Pain Points:**
- ⚠️ Data scattered across 3-4 systems
- ⚠️ Manual data entry (high error rate)
- ⚠️ Excel formula breaks when adding new employees
- ⚠️ Hard to explain why salary changed month-over-month
- ⚠️ Approval process is offline (print → sign → scan)
- ⚠️ Re-calculation takes 1-2 hours if errors found

**Success Criteria:**
- All employees have salary calculated
- No errors (negative salary, missing data)
- Manager approved
- Exported to accounting + bank

**What they DON'T care about:**
- How formulas work
- Where data is stored
- System architecture

---

## Job #2: Explain Why Employee Salary Changed

**Actor:** HR Staff  
**Frequency:** 5-10 times per month  
**Duration:** 5-30 minutes per case  
**Trigger:** Employee questions salary, Finance audits, Manager asks  

**Steps (Current manual process):**
1. Employee asks: "Tại sao lương tháng này giảm 900k?"
2. HR opens Excel salary file
3. Compare this month vs last month (manual diff)
4. Check attendance log → "Ah, vắng 2 ngày"
5. Check commission log → "Same as last month"
6. Check penalties → "Đi muộn 1 ngày"
7. Calculate manually: `-2 days × (6M/26) = -462k, -1 late × 50k = -50k, total -512k` (not 900k!)
8. Re-check all sources → Find error in attendance log
9. Explain to employee (verbal or email)

**Pain Points:**
- ⚠️ Manual comparison (error-prone)
- ⚠️ Data scattered → hard to trace
- ⚠️ No audit trail ("Ai sửa attendance log?")
- ⚠️ Math errors when explaining (embarrassing)
- ⚠️ Takes 30 mins to answer a simple question

**Success Criteria:**
- HR can explain salary breakdown in <5 minutes
- Explanation is accurate (matches actual calculation)
- Has proof (attendance log, commission records)

**What they DON'T care about:**
- Formula syntax
- Calculation engine performance
- Database schema

---

## Job #3: Fix Payroll Error Mid-Month

**Actor:** HR Staff  
**Frequency:** 2-3 times per month  
**Duration:** 15 minutes - 2 hours  
**Trigger:** Employee reports error, HR catches mistake, Attendance correction  

**Steps (Current manual process):**
1. Discover error (e.g., "Forgot to add commission for Nguyễn Văn A")
2. Check if payroll is locked (if locked, need accounting to unlock)
3. Open Excel → Find employee row
4. Update data (add missing commission)
5. Recalculate → Check if it's correct now
6. **Problem:** Other employees' formulas might break when editing
7. Recalculate ALL employees (Excel slow, 5-10 mins)
8. Check for new errors introduced by fix
9. Get manager re-approval (if already approved)
10. Re-export to accounting/bank

**Pain Points:**
- ⚠️ Locked payroll = can't fix easily
- ⚠️ Fixing 1 employee → breaks others (Excel formula references)
- ⚠️ Full recalculation is slow (10 mins for 50 employees)
- ⚠️ No history (can't see what changed, who changed, when)
- ⚠️ Re-approval is painful (manager already approved once)

**Success Criteria:**
- Fix error without breaking other employees
- Fast (< 2 minutes)
- Manager notified of change (no need for full re-approval)

**What they DON'T care about:**
- How recalculation works internally
- Database transactions
- Calculation dependencies

---

## Job #4: Adjust Salary Policy (Rare)

**Actor:** HR Manager + Finance Manager  
**Frequency:** 2-3 times per year  
**Duration:** 1 hour  
**Trigger:** Company policy change, Inflation adjustment, Promotion wave  

**Examples:**
- "Tăng hệ số Senior từ 1.2 lên 1.3"
- "Thêm phụ cấp xăng xe 500k/tháng cho tất cả KTV"
- "Đổi thưởng KPI từ 1M → tier-based (30-35 ca: 500k, 35-40 ca: 1M, >40 ca: 1.5M)"

**Steps (Current manual process):**
1. Manager decides policy change (meeting, email)
2. HR updates Excel template (edit formula or add column)
3. Test with 1-2 employees (manual calculation to verify)
4. Apply to all employees next month
5. **Problem:** Hard to estimate impact before applying

**Pain Points:**
- ⚠️ No impact preview ("Nếu tăng hệ số Senior, chi phí tăng bao nhiêu?")
- ⚠️ Excel formula hard to edit (need Excel skills)
- ⚠️ Effective date unclear (apply this month or next month?)
- ⚠️ No version control (can't rollback if mistake)

**Success Criteria:**
- See impact before applying (cost estimate)
- Apply safely (no breaking existing payroll)
- Can rollback if needed

**What they DON'T care about:**
- DSL syntax
- Formula versioning system
- Configuration management

---

## Job #5: Handle Employee Resignation

**Actor:** HR Staff  
**Frequency:** 2-5 times per month  
**Duration:** 10-20 minutes  
**Trigger:** Employee submits resignation letter  

**Steps (Current manual process):**
1. Employee resigns (e.g., resigned June 15)
2. HR calculates pro-rata salary:
   - Base: `6M × (15/26) = 3.46M`
   - Commission: Only count sessions before June 15
   - KPI: Usually 0 (didn't work full month)
3. **Problem:** Excel formula still uses full month
4. HR manually overrides (delete formula, type hardcoded value)
5. Add note: "Resigned June 15"
6. Recalculate
7. Process final payment (includes unused leave, severance if applicable)

**Pain Points:**
- ⚠️ Manual pro-rata calculation (error-prone)
- ⚠️ Excel formula override = breaks future months
- ⚠️ Hard to separate: salary + unused leave + severance
- ⚠️ No resignation workflow (just manual notes)

**Success Criteria:**
- Correct pro-rata salary (to resignation date)
- Clear breakdown (salary vs leave vs severance)
- Fast (10 mins)

**What they DON'T care about:**
- Resignation date tracking system
- Pro-rata calculation algorithm
- Leave balance calculation engine

---

## Job #6: Get Manager Approval for High Salary

**Actor:** HR Staff → Manager → (sometimes) Finance/CEO  
**Frequency:** 5-10 times per month  
**Duration:** 30 minutes - 2 days  
**Trigger:** Employee salary > 15M, or sudden increase >20%  

**Steps (Current manual process):**
1. HR generates payroll
2. See: "Trần Văn C: 18.5M (last month: 12M, +54%)"
3. Check why: "Ah, got 3 VIP packages + holiday OT"
4. Prepare explanation document (Word/Email)
5. Send to Manager for approval (email/chat)
6. **Manager asks:** "Tại sao tăng 54%?" (needs detailed breakdown)
7. HR prepares detailed breakdown (Excel screenshots)
8. Manager approves (email reply or verbal)
9. **Problem:** If Manager on leave → Stuck
10. HR proceeds with payroll

**Pain Points:**
- ⚠️ Manual approval request (email/chat, no tracking)
- ⚠️ Hard to prepare explanation (screenshots, manual breakdown)
- ⚠️ Approval blocked if Manager unavailable
- ⚠️ No audit trail (just email chain)
- ⚠️ Approval rules not clear (>15M? >20% increase? both?)

**Success Criteria:**
- Manager sees case + explanation in one place
- Approve/Reject in < 5 mins
- Has audit trail (who approved, when, why)
- Escalation if Manager unavailable

**What they DON'T care about:**
- Approval workflow engine
- Rule-based routing
- Notification system architecture

---

## Job #7: Export Payroll to Accounting/Bank

**Actor:** HR Staff  
**Frequency:** Once per month (after payroll locked)  
**Duration:** 15-30 minutes  
**Trigger:** Payroll approved and locked  

**Steps (Current manual process):**
1. Export Excel to PDF (for archival)
2. Open accounting system (Misa, Fast, or other)
3. Manually enter salary journal entries:
   - Debit: Salary Expense
   - Credit: Salary Payable
   - For each employee (50 entries!)
4. Open bank portal (VCB, ACB, etc.)
5. Create bank transfer file (manual copy-paste from Excel):
   - Employee name, bank account, amount
6. Upload to bank
7. **Problem:** If any error → Re-do from step 2

**Pain Points:**
- ⚠️ Manual data entry to accounting system (50 entries × 2 mins = 100 mins!)
- ⚠️ Manual copy-paste to bank (error-prone)
- ⚠️ No automatic export (must copy field-by-field)
- ⚠️ Different bank formats (VCB ≠ ACB ≠ Techcombank)

**Success Criteria:**
- One-click export to accounting system (JSON/API)
- One-click export to bank (standard format)
- No manual entry
- No errors

**What they DON'T care about:**
- Export format specification
- API integration details
- File format standards

---

## Job Frequency Map

| Job | Frequency | Duration | Pain Level |
|-----|-----------|----------|------------|
| Run Monthly Payroll | 1×/month | 2-4 hours | 🔥🔥🔥 High |
| Explain Salary Change | 5-10×/month | 5-30 mins | 🔥🔥 Medium |
| Fix Payroll Error | 2-3×/month | 15 mins - 2 hours | 🔥🔥🔥 High |
| Adjust Salary Policy | 2-3×/year | 1 hour | 🔥 Low |
| Handle Resignation | 2-5×/month | 10-20 mins | 🔥 Low |
| Get Approval | 5-10×/month | 30 mins - 2 days | 🔥🔥 Medium |
| Export to Accounting/Bank | 1×/month | 15-30 mins | 🔥 Low |

**Insight:** Most pain is in **operational jobs** (Run, Explain, Fix), not **setup jobs** (Adjust Policy).

**Implication:** IA should prioritize operational workflows, not configuration screens.

---

## Key Discoveries

### 1. HR spends 80% time on Operations, 20% on Configuration
**Current IA mistake:** Configuration is top-level, equal weight to Operations.  
**Correct IA:** Operations first (Run, Review, Fix), Configuration nested.

### 2. "Explain Why" is the #1 pain point
**Current IA:** Employee Detail exists, but not discoverable enough.  
**Correct IA:** Employee Detail should be 1 click from anywhere.

### 3. Approval is inline, not a separate module
**Current IA:** Approval Queue is separate top-level module.  
**Correct IA:** Approval is inline in Payroll Run (3 pending cases, click to approve).

### 4. Formula editing is rare, data editing is frequent
**Current IA:** Formula is nested under Configuration.  
**Validation:** Need user testing. HR might never touch formulas, only data (rates, tiers, amounts).

### 5. Reports is not a module, it's a button
**Current IA:** Reports & Export is top-level module.  
**Correct IA:** Export button in Payroll Run (once locked).

---

## Next Steps

### Phase 1: Validate Jobs with Real HR ✅
- [ ] Interview 2-3 HR staff (non-tech, frontline users)
- [ ] Observe them doing payroll (screen recording + think-aloud)
- [ ] Collect pain points (what takes longest? what breaks most?)
- [ ] Update job map based on findings

### Phase 2: Job-Driven IA ⏳
- [ ] Map jobs → screens (1 job might need 2-3 screens, or 1 screen serves 3 jobs)
- [ ] Prioritize by frequency × pain (high frequency + high pain = must optimize)
- [ ] Defer low-frequency jobs (Adjust Policy can have worse UX, it's rare)

### Phase 3: Screen Flow ⏳
- [ ] Draw user journeys for top 3 jobs
- [ ] Identify reusable patterns (drill-down, inline edit, approval toast)

### Phase 4: Wireframe ⏳
- [ ] Only for validated jobs
- [ ] No polish, just layout

### Phase 5: User Testing ⏳
- [ ] Put wireframe in front of real HR
- [ ] Watch them fail (that's the data we need)
- [ ] Iterate

**Do NOT design IA before Phase 1 is done.**

---

## Anti-Patterns to Avoid

### ❌ Anti-pattern #1: Designing for edge cases
**Example:** "What if Manager is on leave and CFO needs to approve?"  
**Reality:** Happens 1×/year. Don't over-design for it.

### ❌ Anti-pattern #2: Mirroring system architecture in UI
**Example:** Master Data → Calculations → Policy (reflects backend structure)  
**Reality:** HR doesn't think in system layers.

### ❌ Anti-pattern #3: Making configuration prominent
**Example:** Configuration as top-level menu  
**Reality:** HR changes configuration 2-3×/year, runs payroll 12×/year.

### ❌ Anti-pattern #4: Assuming HR wants flexibility
**Example:** "Let HR create custom formulas"  
**Reality:** HR wants pre-built formulas that work, not formula editor.

### ❌ Anti-pattern #5: Building for scale before validating core job
**Example:** "Support 100+ approval rules"  
**Reality:** Most companies have 3-5 rules. Start there.

---

## Appendix: How Jobs Inform IA

### Job: "Run Monthly Payroll" → IA: Payroll Runs (time-based list)
- Not "Create Payroll" (verb-based)
- Not "Payroll Management" (too generic)

### Job: "Explain Why Salary Changed" → IA: Employee Detail (drill-down)
- Not separate "Explanation Report" module
- Inline, 1 click away from any screen showing salary

### Job: "Fix Payroll Error" → IA: Inline edit + Recalculate button
- Not "Edit Payroll" module
- Fix where error is shown (no context switch)

### Job: "Get Approval" → IA: Inline approval (not separate queue)
- Show pending count in Payroll Run: "3 need approval"
- Click → Modal with cases → Approve/Reject → Done

### Job: "Export" → IA: Button in Payroll Run
- Not separate "Reports" module
- Export is end-of-workflow action, not exploration task

**Pattern:** Jobs naturally reveal UI structure. Don't design UI first.
