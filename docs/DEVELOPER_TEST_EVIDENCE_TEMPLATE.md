# DEVELOPER TEST - EVIDENCE PROFILE TEMPLATE

**Purpose:** Capture evidence from vertical creation tasks (not pass/fail judgment)  
**Use:** After each Developer Test task (Student, Enrollment, Course, etc.)  

---

## EVIDENCE PROFILE FORMAT

```markdown
# Education Developer Test #[Number]

**Task:** [e.g., Build Student Aggregate]  
**Developer:** [Name/ID]  
**Date:** [YYYY-MM-DD]  
**Vertical:** Education  

---

## METRICS

| Metric | Value | Notes |
|--------|-------|-------|
| First commit | [Xh XXm] | Time from task start to first commit |
| Total task time | [Xh XXm] | Time from start to tests passing |
| Coding ratio | [XX%] | Coding time / Total time (target: >60%) |
| Questions asked | [X] | Count of questions to platform team |
| Platform files touched | [X] | Count of files modified in platform/ |
| Healthcare files touched | [X] | Count of files modified in verticals/healthcare/ |
| Gap requests | [X] | Count of Capability Gap Requests submitted |
| Tests | [PASS/FAIL] | Did unit + integration tests pass? |

---

## TIME BREAKDOWN

| Activity | Time | % of Total |
|----------|------|------------|
| Reading docs | [Xh XXm] | [XX%] |
| Understanding platform | [Xh XXm] | [XX%] |
| Writing code | [Xh XXm] | [XX%] |
| Debugging | [Xh XXm] | [XX%] |
| Testing | [Xh XXm] | [XX%] |
| **Total** | **[Xh XXm]** | **100%** |

**Key Insight:** Coding ratio = Writing code / Total time

---

## QUESTIONS ASKED

1. [Question 1]  
   - Answer: [Brief answer]  
   - Gap revealed: [Platform doc missing? API unclear? Capability absent?]

2. [Question 2]  
   - Answer: ...  
   - Gap revealed: ...

*(List all questions, even if <5)*

---

## PLATFORM FILES TOUCHED

*(Should be 0 for mature platform)*

- [ ] None ✅
- [ ] `platform/host/[file]` - Reason: ...
- [ ] `platform/capabilities/[file]` - Reason: ...

---

## HEALTHCARE FILES TOUCHED

*(Should be 0 for proper isolation)*

- [ ] None ✅
- [ ] `verticals/healthcare/[file]` - Reason: ...

---

## CAPABILITY GAP REQUESTS

*(0-2 is acceptable, >3 indicates platform immaturity)*

1. **[Capability Name]**  
   - Gap: [Description]  
   - Cross-vertical: [Yes/No/Unknown]  
   - Blocker: [Yes/No]

*(If 0 gap requests, write: "None - platform sufficient")*

---

## DEVELOPER-REPORTED BLOCKERS

**What slowed you down the most?**
- [Blocker 1]
- [Blocker 2]
- ...

**What was unclear?**
- [Unclear 1]
- [Unclear 2]
- ...

**What surprised you (good or bad)?**
- [Surprise 1]
- [Surprise 2]
- ...

---

## ASSESSMENT

**Platform Enabling:**
- [ ] Yes - Developer mostly reused platform, minimal blockers
- [ ] Partial - Developer reused platform but encountered gaps
- [ ] No - Developer rebuilt capabilities, many blockers

**Capability Gaps Identified:**
- [Gap 1]: [Description] - [Cross-vertical? Yes/No]
- [Gap 2]: [Description] - [Cross-vertical? Yes/No]

**Recommended Actions:**
- [ ] No action - platform sufficient
- [ ] Extract capability: [Name]
- [ ] Improve documentation: [Which doc]
- [ ] Fix platform API: [Which API]

---

## COMPARATIVE ANALYSIS (After Multiple Tests)

| Task | Time | Coding % | Questions | Gaps | Trend |
|------|------|----------|-----------|------|-------|
| #1 Student | 7h 10m | 68% | 3 | 1 | Baseline |
| #2 Enrollment | 5h 30m | 72% | 2 | 0 | ⬇️ Improving |
| #3 Course | 4h 20m | 75% | 1 | 0 | ⬇️ Improving |
| #4 Attendance | 3h 50m | 78% | 1 | 0 | ⬇️ Improving |
| #5 Assessment | 3h 30m | 80% | 0 | 0 | ⬇️ Improving |

**Key Pattern:**
- ⬇️ Time decreasing = Platform enables learning curve
- ⬆️ Coding % increasing = Less reading, more building
- ⬇️ Questions decreasing = Platform clarity improving
- ⬇️ Gaps stable/decreasing = Platform mature

**Evidence:**
- If curve trends down → Platform is maturing ✅
- If curve stays flat → Platform not improving ⚠️
- If curve trends up → Platform creating complexity ❌

---

## NEXT STEPS

**Immediate:**
- [ ] Address capability gaps (if any)
- [ ] Improve documentation (if unclear)
- [ ] Fix platform APIs (if issues found)

**Next Test:**
- Task: [Next aggregate/workflow]
- Expected time: [Estimate based on trend]
- Focus: [What to validate]

---

## EVIDENCE SIGNATURE

**Captured by:** [Observer name]  
**Reviewed by:** [Platform team lead]  
**Status:** Evidence recorded ✅  
**No judgment:** This is data, not pass/fail

---

**Last Updated:** [Date]
```

---

## USAGE NOTES

### How to Use This Template

1. **Before Test:**
   - Brief developer on task only (no architecture explanations)
   - Provide: Framework + Quick Start + Platform docs
   - Start timer when developer begins reading

2. **During Test:**
   - Observe (don't intervene unless safety issue)
   - Note questions asked
   - Track time spent on each activity (self-reported or observed)

3. **After Test:**
   - Fill out this template within 24 hours
   - Focus on evidence, not judgment
   - Identify specific gaps (not vague "needs improvement")

### Evidence, Not Judgment

**DON'T write:**
- ❌ "Developer failed to complete task"
- ❌ "Platform passed validation"
- ❌ "Test successful"

**DO write:**
- ✅ "Developer completed Student in 7h 10m with 1 capability gap"
- ✅ "Platform enabled 68% coding ratio, 3 questions asked"
- ✅ "Evidence: Billing capability gap identified (cross-vertical: YES)"

### Progressive Validation

After 3-5 tasks, **analyze trends:**

```
IF (Time decreasing AND Coding % increasing AND Questions decreasing):
  → Evidence: Platform enables vertical creation ✅
  → Confidence: Increasing with each task
  → Action: Continue Education, prepare Real Estate

IF (Time flat AND Coding % flat):
  → Evidence: Platform not improving ⚠️
  → Confidence: Platform at current maturity limit
  → Action: Extract more capabilities before continuing

IF (Time increasing):
  → Evidence: Platform creating complexity ❌
  → Confidence: High (bad trend)
  → Action: Stop Education, fix Platform architecture
```

---

## EXAMPLE (FILLED)

```markdown
# Education Developer Test #01

**Task:** Build Student Aggregate  
**Developer:** Alex Chen (no prior Bella knowledge)  
**Date:** 2026-08-15  
**Vertical:** Education  

---

## METRICS

| Metric | Value | Notes |
|--------|-------|-------|
| First commit | 3h 20m | Initial Student.create() + tests |
| Total task time | 7h 10m | Including integration with Person Center |
| Coding ratio | 68% | 4h 55m coding / 7h 10m total |
| Questions asked | 3 | Person Center API, Event schema, Test setup |
| Platform files touched | 0 | ✅ No platform modifications |
| Healthcare files touched | 0 | ✅ No Healthcare coupling |
| Gap requests | 1 | Need generic Enrollment capability |
| Tests | PASS | Unit + Integration tests pass |

---

## TIME BREAKDOWN

| Activity | Time | % of Total |
|----------|------|------------|
| Reading docs | 1h 15m | 17% |
| Understanding platform | 1h 00m | 14% |
| Writing code | 4h 55m | 68% |
| Debugging | 0h 30m | 7% |
| Testing | 0h 30m | 7% |
| **Total** | **7h 10m** | **100%** |

**Key Insight:** 68% coding ratio = Good platform enablement

---

## QUESTIONS ASKED

1. "How do I link Student to Person Center?"  
   - Answer: Use `personCenter.create()` then reference `personId`  
   - Gap revealed: Quick Start should show Person Center integration example

2. "What's the event schema for student.created?"  
   - Answer: Use `education.student.created.v1` with payload schema  
   - Gap revealed: Event schemas not documented in Platform docs

3. "How do I run integration tests?"  
   - Answer: `npm run test:integration -- --grep "Student"`  
   - Gap revealed: Test setup not in Quick Start

---

## PLATFORM FILES TOUCHED

- [x] None ✅

---

## HEALTHCARE FILES TOUCHED

- [x] None ✅

---

## CAPABILITY GAP REQUESTS

1. **Enrollment Workflow Capability**  
   - Gap: Need generic enrollment/registration workflow  
   - Cross-vertical: YES (Healthcare has admission, Real Estate has tenant onboarding)  
   - Blocker: NO (can build vertical-specific for now)

---

## DEVELOPER-REPORTED BLOCKERS

**What slowed you down the most?**
- Person Center API not well documented (spent 45 min figuring it out)
- Event schema format unclear (trial and error)

**What was unclear?**
- How to structure domain aggregates (figured out from Quick Start example)
- Test setup (asked question #3)

**What surprised you (good or bad)?**
- Good: Platform APIs are intuitive once I found them
- Good: No need to touch Healthcare at all
- Bad: Documentation scattered (had to search multiple files)

---

## ASSESSMENT

**Platform Enabling:**
- [x] Partial - Developer reused platform but encountered documentation gaps

**Capability Gaps Identified:**
- Enrollment Workflow: Generic registration workflow (Cross-vertical: YES)

**Recommended Actions:**
- [ ] Extract Enrollment capability (after validating with Healthcare/Real Estate)
- [x] Improve Quick Start: Add Person Center integration example
- [x] Document event schemas in Platform docs
- [x] Add test setup to Quick Start

---

## COMPARATIVE ANALYSIS

| Task | Time | Coding % | Questions | Gaps | Trend |
|------|------|----------|-----------|------|-------|
| #1 Student | 7h 10m | 68% | 3 | 1 | Baseline |

**Evidence:** First task baseline established. Wait for Task #2 to see trend.

---

## NEXT STEPS

**Immediate:**
- [x] Update Quick Start with Person Center example
- [x] Document event schemas
- [ ] Consider extracting Enrollment capability (wait for more evidence)

**Next Test:**
- Task: Build Enrollment Aggregate
- Expected time: 5-6 hours (estimate)
- Focus: Validate if Enrollment capability gap is real or just documentation

---

## EVIDENCE SIGNATURE

**Captured by:** Platform Observer Team  
**Reviewed by:** Architecture Lead  
**Status:** Evidence recorded ✅  
**No judgment:** Task completed, gaps identified, improvements recommended

---

**Last Updated:** 2026-08-15
```

---

## TEMPLATE STATUS

**Status:** ✅ ACTIVE  
**Use:** After each Developer Test task  
**Purpose:** Capture evidence, identify bottlenecks, track trends  

**Remember:** Metrics find problems, not prove success. Use evidence to improve Platform, not to "pass gates."

---

**Last Updated:** 2026-08-10  
**Owner:** Architecture Team
