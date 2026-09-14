# E2/E3/E4 Governance Acceptance

**Date:** 2026-09-14
**Scope:** Bella English Center E2/E3/E4
**Decision:** ACCEPTED
**Current workspace base SHA:** `dc74120eab0787449371947d028e96f0a97313ca`

---

## Accepted Decision

Governance accepts bounded seal for Bella English Center E2/E3/E4.

The acceptance is explicitly bounded to English Center E2/E3/E4 evidence and
does not certify the broader Education baseline or full migration-history
integrity.

```text
E2 - Enrollment                  BOUNDED VERIFIED + SEALED
E3 - Program/Course/Class        BOUNDED VERIFIED + SEALED
E4 - Teacher/Workforce           BOUNDED VERIFIED + SEALED

E5                               UNBLOCKED after commit, PR, CI, and main merge
```

---

## Accepted Governed Debt

### DEBT-EDU-ARCH-01

```text
Title: Pre-existing Education direct database access violations
Accepted as: Governed debt outside English Center E2/E3/E4
Owner: Broader Bella Education / Preschool architecture remediation
Actual current violation entries: 197
origin/main violation entries:   197
Introduced by E2/E3/E4:            0
Touched by E2/E3/E4:               0
Unknown attribution:               0
```

This debt must be handled in a separate Education OS Architecture Hardening
workstream. It is not on the English Center E5 critical path.

### DEBT-MIG-HISTORY-01

```text
Title: Remote migration history unavailable for full drift proof
Accepted as: Bounded infrastructure limitation
Owner: Platform database governance / release infrastructure
Runtime SQL proof: Present
db:migration:check status: Drift-skip only
Full migration-history integrity: Not proven
```

This debt must be handled in a separate migration-history remediation
workstream. It is not a `PASS` and must not be represented as full drift proof.

### DEBT-TSC-ROOT-01

```text
Title: Root TypeScript baseline has pre-existing diagnostics outside E2/E3/E4 diff
Accepted as: Bounded CI/typecheck limitation
Owner: Platform / whole-repository TypeScript hardening
Root typecheck status: Fails or exceeds CI budget outside changed English Center TypeScript files
Changed-file diagnostics: 0 observed for E2/E3/E4 changed TypeScript files
CI policy: Fail PR only when bounded TypeScript diagnostics touch changed TypeScript files
```

This debt must be handled in a separate whole-repository TypeScript hardening
workstream. A green scoped typecheck check must not be represented as full root
repository TypeScript compliance while this debt remains open.

---

## Evidence Accepted

```text
Branch-access architecture       RESOLVED
Platform projection              IMPLEMENTED
Platform Org/People RLS repair   APPLIED
E2/E3/E4 branch-aware RLS        APPLIED
Runtime branch isolation         PASS
Targeted tests                   33/33 PASS
Platform Architecture Guard      PASS
Education violations delta       0
Attribution unknown              0
Changed-file TypeScript delta    0
```

---

## Claims Not Accepted

Governance does not accept the following claims:

```text
Full education:verify PASS
Full broader Education architecture compliance
Full migration-history integrity
Full root TypeScript compliance
197 Education violations fixed
DEBT-EDU-ARCH-01 owned by English Center
DEBT-MIG-HISTORY-01 converted to PASS
DEBT-TSC-ROOT-01 converted to PASS
```

---

## Release Boundary

The bounded seal is valid only if the implementation and evidence artifacts are
committed, reviewed in PR, pass CI, and merge to main without changing the
accepted scope.

After merge, the merge commit SHA becomes the canonical sealed SHA for
E2/E3/E4.
