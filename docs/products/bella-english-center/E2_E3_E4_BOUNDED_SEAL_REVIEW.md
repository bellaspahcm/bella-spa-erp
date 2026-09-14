# E2/E3/E4 Bounded Seal Review

**Date:** 2026-09-14
**Scope:** Bella English Center E2/E3/E4
**Status:** GOVERNANCE ACCEPTED

> **Governance accepted on 2026-09-14.** See
> `E2_E3_E4_GOVERNANCE_ACCEPTANCE.md` for the canonical acceptance record.

---

## Review Verdict

E2/E3/E4 are accepted for bounded seal. Governance has accepted the two
explicit limitations below as governed debt / accepted risk.

This review does not convert broader Education failures or migration-history
limitations into `PASS`.

```text
Branch access architecture          PASS
Runtime branch isolation            PASS
English Center targeted tests       PASS
Platform architecture guard         PASS
New Education violations            PASS: 0
Unknown attribution                 PASS: 0

education:verify                    FAIL
  scoped attribution                 197 PRE-EXISTING / broader Education
  English Center responsibility      NONE for these 197

Migration-history integrity          LIMITED
  runtime migrations applied         YES
  full remote history proof          NOT AVAILABLE
```

---

## Seal Recommendation

Accepted governance outcome:

```text
E2 - Enrollment                  BOUNDED VERIFIED + SEALED
E3 - Program/Course/Class        BOUNDED VERIFIED + SEALED
E4 - Teacher/Workforce           BOUNDED VERIFIED + SEALED

E5                               UNBLOCKED after commit, PR, CI, and main merge
```

This recommendation is bounded to English Center E2/E3/E4 only. It must not be
used to claim that the broader Education baseline is architecture-clean.

---

## Evidence Summary

### Target capability evidence

```text
Platform branch-access model:
  org_relationships = source of truth
  user_org_unit_access = Platform projection/view

English Center RLS:
  E2 enrollments branch-aware RLS applied
  E3 program/course/class branch-aware RLS applied
  E4 teacher/workforce branch-aware RLS applied

Runtime branch isolation:
  Branch A user sees Branch A class
  Branch A user does not see Branch B class

Targeted tests:
  npx jest src/products/bella-english-center/__tests__ --runInBand
  4 suites passed
  33 tests passed

Platform guard:
  npm run arch:guard
  PASS
```

### Broader Education attribution

```text
education:verify:
  FAIL at education:architecture / Law 3

Actual violation entries:
  197

Baseline comparison:
  origin/main = 197
  current     = 197
  introduced = 0
  touched    = 0
  unknown    = 0
```

The 197 violations live under `src/products/bella-education` and are outside
the English Center E2/E3/E4 workstream.

---

## Accepted Risk / Governed Debt

### DEBT-EDU-ARCH-01

```text
Title: Pre-existing Education direct database access violations
Owner: Broader Bella Education / Preschool architecture remediation
Count: 197 actual violation entries
Status: Governed debt, scoped out from English Center E2/E3/E4
Blocking E2/E3/E4 bounded seal: No, if governance accepts attribution
Blocking future Education OS cleanup: Yes
```

Required future work:

```text
Create separate Education OS / Preschool direct-DB remediation workstream.
Replace product-layer direct `.from('edu_*')` and `.from('students')` access
with approved Education public contracts or Platform-owned projections.
```

### DEBT-MIG-HISTORY-01

```text
Title: Remote migration history unavailable for full drift proof
Owner: Platform database governance / release infrastructure
Status: Accepted infrastructure limitation, not PASS
Observation: Remote migration history is empty; db:migration:check passed by drift-skip
Blocking E2/E3/E4 bounded seal: No, if governance accepts runtime SQL proof plus limitation
Blocking full migration-history claim: Yes
```

Required future work:

```text
Reconstruct or initialize authoritative remote migration history.
Run full migration-history drift verification against a governed target.
Do not claim full migration-history integrity until that proof exists.
```

---

## Governance Acceptance Checklist

Governance accepted:

```text
[x] DEBT-EDU-ARCH-01 is scoped out from English Center E2/E3/E4.
[x] DEBT-MIG-HISTORY-01 is accepted as a bounded infrastructure limitation.
[x] The seal wording remains "bounded verified + sealed".
[x] No claim is made that full education:verify is green.
[x] No claim is made that full migration-history integrity is proven.
```

If this acceptance is later revoked:

```text
E2/E3/E4 final seal -> HOLD
E5                  -> HOLD
```

---

## Canonical Post-Acceptance State

Accepted state:

```text
E2 - Enrollment                  SEALED, bounded to English Center evidence
E3 - Program/Course/Class        SEALED, bounded to English Center evidence
E4 - Teacher/Workforce           SEALED, bounded to English Center evidence

Known broader debt:
  DEBT-EDU-ARCH-01
  197 pre-existing Education direct-DB violations

Known infrastructure limitation:
  DEBT-MIG-HISTORY-01
  Remote migration history unavailable; drift check not fully proven

E5                               UNBLOCKED after commit, PR, CI, and main merge
```
