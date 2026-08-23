# BELLA ARCHITECTURE FREEZE POLICY

**Version:** 1.0.0  
**Effective Date:** 2026-08-22  
**Status:** ACTIVE

---

## Overview

This document defines the policy and procedures for managing frozen architecture layers in the Bella platform. Frozen layers represent stable, tested, and production-grade components that serve as contracts for higher-level systems.

## Frozen Layers

### Current Status (2026-08-22)

| Layer ID | Name | Status | Artifacts | Tests | Freeze Date |
|----------|------|--------|-----------|-------|-------------|
| E7.1 | Domain Kernel | 🔒 SEALED | 12 | 366 | 2024-01-15 |
| E7.2 | Operational Kernel | 🔒 SEALED | 4 | 73 | 2024-02-01 |
| E7.3 | Rules & Traceability | 🔒 SEALED | 9 | 108 | 2026-08-22 |

**Total:** 25 frozen artifacts, 547 regression tests

---

## Status Definitions

### DRAFT
- **Meaning:** Layer is under active development
- **Protection:** None
- **Modification:** Freely allowed
- **Review:** Not required

### FROZEN
- **Meaning:** Layer is feature-complete and stable
- **Protection:** Documentation + conventions
- **Modification:** Discouraged but possible
- **Review:** Code review required

### SEALED
- **Meaning:** Layer is production-grade and serves as a contract
- **Protection:** Multi-layer machine enforcement
- **Modification:** Requires ACR + ADR + architecture review
- **Review:** Human architect approval required

---

## Multi-Layer Enforcement

Sealed layers are protected by 5 enforcement mechanisms:

### Layer 1: Architecture Guard Script
- **Location:** `scripts/architecture/architecture-guard.ts`
- **Trigger:** Manual execution, pre-commit hook
- **Checks:**
  - Frozen file existence
  - File hash verification (when baseline exists)
  - Dependency boundary enforcement
  - Forbidden import detection

**Usage:**
```bash
npm run arch:guard              # Basic check
npm run arch:guard:verbose      # Detailed output
npm run arch:guard:hashes       # Include hash verification
```

### Layer 2: Pre-Tool-Use Hook
- **Location:** `.kiro/hooks/architecture-guard.json`
- **Trigger:** Before `fs_write`, `str_replace`, `fs_append`
- **Checks:**
  - Target file path against frozen artifact list
  - Blocks AI/tool modifications immediately

**Behavior:**
- Exit 0: Allow operation
- Exit 2: Block operation with detailed message

### Layer 3: Git Pre-Commit Hook
- **Location:** `.husky/pre-commit` (TODO)
- **Trigger:** `git commit`
- **Checks:**
  - Staged files against frozen artifact list
  - Prevents accidental commits

**Override:** `git commit --no-verify` (discouraged)

### Layer 4: CI Architecture Gate
- **Location:** `.github/workflows/architecture-gate.yml` (TODO)
- **Trigger:** Pull request, push to main
- **Checks:**
  - All Layer 1 checks
  - Full regression test suite (547/547 must pass)
  - API signature verification

**Result:** PR blocked if violations detected

### Layer 5: Regression Test Suite
- **Location:** `src/platform/logistics/domain/**/__tests__/**`
- **Trigger:** CI, manual
- **Tests:** 547 total
  - E7.1: 366 tests
  - E7.2: 73 tests
  - E7.3: 108 tests

**Command:**
```bash
npm test -- src/platform/logistics/domain
```

---

## Modification Process

### For SEALED Layers

Modifying a sealed layer requires formal architecture governance:

#### Step 1: Create Architecture Change Request (ACR)

**Template:** `docs/architecture/templates/ACR_TEMPLATE.md`

**Required Information:**
- Layer affected (E7.1, E7.2, E7.3)
- Artifacts to be modified
- Reason for change
- Impact analysis
- Alternative approaches considered
- Risk assessment

#### Step 2: Human Architect Review

**Reviewers:**
- Platform Architecture Team
- Domain experts for affected layer

**Evaluation Criteria:**
- Is the change necessary?
- Can it be achieved without breaking frozen contracts?
- What is the blast radius?
- Are there better alternatives?

**Possible Outcomes:**
- **APPROVED:** Proceed to Step 3
- **REJECTED:** Return to Step 1 with feedback
- **DEFER:** Request more analysis

#### Step 3: Document Architecture Decision Record (ADR)

**Template:** `docs/architecture/decisions/ADR-XXXX-*.md`

**Required Sections:**
- Context
- Decision
- Rationale
- Consequences
- Alternatives considered

#### Step 4: Unlock Layer

Update `ARCHITECTURE_FREEZE_MANIFEST.json` or manifest file:

```json
{
  "layer": "E7.X",
  "status": "DRAFT",  // Changed from SEALED
  "unlockReason": "ACR-2026-001 approved",
  "unlockDate": "2026-08-25"
}
```

#### Step 5: Implement Changes

- Make necessary modifications
- Update tests
- Update documentation
- Follow existing coding standards

#### Step 6: Full Regression

**Command:**
```bash
npm test -- src/platform/logistics/domain
```

**Requirement:** 100% pass rate (547/547)

**If failures:**
- Fix all failing tests
- Do not proceed until 100% pass

#### Step 7: Update Baseline

For hash-protected artifacts:

```bash
# Compute new hashes
npm run arch:baseline:compute

# Review changes
npm run arch:baseline:diff

# Commit new baseline
npm run arch:baseline:commit
```

#### Step 8: Re-Seal Layer

Update manifest status back to `SEALED`:

```json
{
  "layer": "E7.X",
  "status": "SEALED",
  "freezeDate": "2026-08-25",
  "freezeCommit": "abc123def",
  "changeHistory": [
    {
      "date": "2026-08-25",
      "acr": "ACR-2026-001",
      "adr": "ADR-0042",
      "summary": "Added new capability X"
    }
  ]
}
```

#### Step 9: Update Documentation

- Update `FREEZE_POLICY.md` if process changed
- Update layer documentation
- Update affected product documentation
- Communicate changes to team

---

## Emergency Procedures

### Critical Production Bug

If a frozen layer has a critical production bug:

1. **Assess Severity:**
   - P0: Data loss, security breach, complete outage
   - P1: Major feature broken, significant user impact
   - P2: Minor issue, workaround available

2. **P0 Response:**
   - Immediate hotfix allowed
   - Create ACR **within 24 hours**
   - Document ADR **within 48 hours**
   - Full regression **before merge**

3. **P1 Response:**
   - Follow standard ACR process
   - Expedited review (24-hour SLA)
   - Full regression required

4. **P2 Response:**
   - Follow standard ACR process
   - Normal review timeline

---

## Enforcement Audit

### Weekly Check

Run architecture guard in CI:

```bash
npm run arch:guard:hashes
```

Expected: 0 violations

### Monthly Review

- Review all frozen layers
- Verify all tests still pass
- Check for technical debt
- Evaluate freeze policy effectiveness

### Quarterly Assessment

- Review ACR/ADR history
- Assess layer boundaries
- Consider promotions (FROZEN → SEALED)
- Update enforcement mechanisms

---

## FAQ

### Q: Can I add a new feature that uses frozen layers?

**A:** Yes! Frozen layers are designed to be consumed. You can import and use them freely. You just cannot modify their internal implementation.

### Q: What if I need a capability that doesn't exist in a frozen layer?

**A:** Build it in a higher layer. For example:
- E7.3 adds traceability capabilities on top of frozen E7.1/E7.2
- E7.4 Finance will add cost evaluation on top of frozen E7.1/E7.2/E7.3

### Q: Can I fix a typo in a frozen file?

**A:** For documentation/comments: Possibly, ask architect for approval.
For code/types: Requires full ACR process, even for typos.

### Q: What if CI architecture gate fails on my PR?

**A:** 
1. Check which frozen file was modified
2. Review the architecture guard output
3. Revert the frozen file changes
4. Implement your feature using the frozen APIs, not modifying them
5. If you genuinely need to modify frozen code, follow the ACR process

### Q: How long does the ACR process take?

**A:**
- Standard: 3-5 business days
- Expedited (P1): 1-2 business days
- Emergency (P0): Same day with post-facto documentation

### Q: Can I disable the architecture guard for my branch?

**A:** No. The guard is mandatory. If you believe you have a valid reason to disable it, create an ACR explaining why.

---

## Related Documents

- **Constitution:** `docs/architecture/LOGISTICS_OS_CONSTITUTION.md`
- **ACR Template:** `docs/architecture/templates/ACR_TEMPLATE.md`
- **ADR Index:** `docs/architecture/decisions/README.md`
- **E7.1 Freeze:** `docs/implementation/E7_1_FROZEN_MANIFEST.json`
- **E7.3 Freeze:** `docs/implementation/E7_3_FREEZE_CERTIFICATE.md`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-08-22 | Initial freeze policy for E7.1/E7.2/E7.3 |

---

**Approved by:** Platform Architecture Team  
**Next Review:** 2026-11-22 (Quarterly)
