# Canonical Pattern Principle — Bella Architecture Governance

**Version:** 1.0  
**Date:** 2026-09-11  
**Status:** ACTIVE  
**Scope:** All Bella modules and capabilities

---

## Principle

> **Before creating a new pattern, first prove that no canonical pattern already exists.**

---

## Scope of Application

### MUST Check Canonical (Cross-Module Impact)

Check existing patterns BEFORE implementing in these areas:

**Architecture & Data:**
- Database schema design (tables, columns, constraints)
- Foreign key patterns (especially composite FK for Layer 5)
- Index strategies
- Migration patterns
- Data modeling conventions

**Security & Authorization:**
- RLS policy patterns
- Authentication helpers (`get_auth_tenant_id()`, `is_hq_super_admin()`)
- Tenant isolation mechanisms
- Role-based access control
- WITH CHECK patterns

**API & Contracts:**
- Server Actions structure
- Service layer interfaces
- Error response format
- Validation patterns
- DTO naming conventions

**Testing & Evidence:**
- Test script structure
- Gate-based evidence methodology
- Authenticated vs. service_role testing
- Regression suite patterns

**Workflow & State:**
- State machine patterns
- Event sourcing conventions
- Domain event naming
- Saga patterns

**Naming & Conventions:**
- Table naming (prefix conventions)
- Function naming
- Type/Interface naming
- File organization

**Governance:**
- Evidence documentation format
- RCA structure
- Architecture decision records
- Freeze policy application

---

### MAY Handle Locally (Single-Module Presentation)

These can be implemented without checking canonical:

**UI Presentation:**
- Component spacing/padding
- Button labels
- Toast message copy
- Tooltip text
- Icon selection
- Color tweaks (within design system)

**Local UX:**
- Form field order
- Modal size
- Placeholder text
- Help text

**Non-Contract Changes:**
- Internal helper functions (not shared)
- Local state management
- Component-specific styles

---

## Decision Rule

```
IF change affects:
  - Multiple modules OR
  - Database/schema OR
  - Security/auth OR
  - API contract OR
  - Workflow/state OR
  - Test pattern
THEN:
  1. Search for canonical pattern
  2. Reuse if applicable
  3. Only create new if canonical doesn't fit
  4. Document why canonical not used

ELSE IF change is:
  - Single-module presentation OR
  - Local UI copy/styling
THEN:
  Handle locally without canonical check
```

---

## Examples

### ✅ CORRECT: Check Canonical First

**Scenario:** Implementing RLS policies for `re_customers`

**Process:**
1. ❌ Don't immediately write custom policy
2. ✅ Check Projects/Products RLS patterns
3. ✅ Found canonical: `public.get_auth_tenant_id()` + `public.is_hq_super_admin()`
4. ✅ Reuse canonical pattern
5. ✅ Result: Consistent authorization across all entities

---

### ✅ CORRECT: Local Presentation

**Scenario:** Changing "Create Customer" button to "Add New Customer"

**Process:**
1. ✅ Local copy change, no contract impact
2. ✅ Implement directly in component
3. ✅ No canonical check needed

---

### ❌ INCORRECT: Skip Canonical Check

**Scenario:** Creating new tenant validation helper

**Process:**
1. ❌ Write `function validateTenantOwnership(userId, tenantId)`
2. ❌ Deploy without checking existing helpers
3. ❌ Discover later: `get_auth_tenant_id()` already exists
4. ❌ Result: Two competing patterns for same concept

**Correct Process:**
1. ✅ Search for existing tenant helpers
2. ✅ Find `get_auth_tenant_id()`, `is_hq_super_admin()`
3. ✅ Reuse or extend canonical
4. ✅ Document if new helper truly needed

---

## How to Check Canonical

### 1. Database Patterns
```bash
# Check existing RLS policies
grep -r "CREATE POLICY" supabase/migrations/

# Check FK patterns
grep -r "FOREIGN KEY" supabase/migrations/

# Check helpers
grep -r "CREATE FUNCTION.*get_auth" supabase/migrations/
```

### 2. Code Patterns
```bash
# Check service patterns
ls src/modules/*/services/

# Check action patterns
ls src/modules/*/actions/

# Check existing implementations
grep -r "createClient" src/modules/
```

### 3. Test Patterns
```bash
# Check existing test structure
ls scripts/bella-land/test-*.ts

# Check authentication patterns
grep -r "authenticateUser" scripts/
```

### 4. Documentation
```bash
# Check architecture docs
ls docs/architecture/

# Check existing ADRs
ls docs/architecture/decisions/
```

---

## Benefits of Canonical Pattern Enforcement

### Consistency
- Same concepts use same patterns
- Easier onboarding (learn once, apply everywhere)
- Predictable behavior across modules

### Maintainability
- Single point of change for pattern updates
- Less drift over time
- Easier refactoring

### Security
- Authorization patterns proven once, reused everywhere
- No ad-hoc security implementations
- Consistent tenant isolation

### Quality
- Established patterns are battle-tested
- Reduces "reinventing the wheel" bugs
- Faster code review (familiar patterns)

---

## Anti-Patterns to Avoid

### ❌ "Not Invented Here" Syndrome
Creating new pattern because existing one is in different module

**Fix:** Patterns are shared; extract to common if needed

---

### ❌ "Quick Fix" Divergence
Implementing slightly different version "just for this case"

**Fix:** Either prove canonical doesn't fit, or extend canonical

---

### ❌ "Copy-Paste Drift"
Copying pattern but modifying it slightly each time

**Fix:** Reference canonical source, don't copy

---

## Governance Checkpoints

### Code Review
Reviewer MUST ask:
> "Did you check if a canonical pattern exists for this?"

If no: Request canonical check before approval

---

### Architecture Review
For new capabilities, architect MUST verify:
> "Are we reusing canonical patterns from existing capabilities?"

Document deviations in ADR

---

### Evidence Closure
Before sealing capability, verify:
> "Do new patterns match canonical patterns in sealed capabilities?"

Ensure consistency across program

---

## Evolution of Canonical Patterns

### When to Create New Canonical

New pattern becomes canonical when:
1. **Proven:** Used successfully in 2+ capabilities
2. **Documented:** Clear usage guidelines exist
3. **Approved:** Architecture review accepted it
4. **Stable:** No active changes or experiments

### When to Update Canonical

Update canonical when:
1. **Security gap:** Vulnerability discovered
2. **Scale issue:** Performance degradation found
3. **Business change:** Requirements evolved
4. **Tech debt:** Better approach proven

**Process:**
1. Create Architecture Change Request (ACR)
2. Impact analysis (how many modules affected)
3. Migration plan
4. Approval
5. Coordinated rollout
6. Update documentation

---

## Bella Land RC Application

**Current Canonical Patterns:**

**Authorization (Projects/Products/Customers):**
- Helper: `public.get_auth_tenant_id()`
- Override: `public.is_hq_super_admin()`
- Roles: `admin`, `super_admin`, `admin_staff`

**Layer 5 (Products only):**
- Composite FK: `(parent_id, tenant_id) REFERENCES parent(id, tenant_id)`
- Used when: Child belongs to specific parent entity

**Testing (All capabilities):**
- Gate-based evidence (not averaging)
- Write flow: service_role tests
- Security: authenticated client tests
- Browser: manual B1-B10 + DB verification

**Evidence Format:**
- Discovery: `C{N}_0_*_DISCOVERY.md`
- Gates: `C{N}_{M}_*.md`
- Seal: `C{N}_5_*_SEAL.md`
- Sessions: `SESSION_{N}_*.md`

---

## Enforcement

**Severity Levels:**

**P0 (BLOCKING):**
- Security patterns (RLS, auth)
- Data integrity patterns (FK, constraints)
- Cross-module contracts

**P1 (HIGH):**
- Test patterns
- Error handling
- Naming conventions

**P2 (MEDIUM):**
- Code organization
- Documentation format

**P3 (LOW):**
- Local presentation
- UI copy

---

## Summary

**Golden Rule:**
> If it touches architecture, data, security, workflow, naming, schema, tenant, auth, error, API, test, or governance → **CHECK CANONICAL FIRST**.

**Purpose:**
> Keep Bella **cohesive as it scales**, not fragmented.

**Outcome:**
> Bella with 100 modules is still consistent, predictable, and maintainable.

---

_This principle is part of Bella Architecture Governance and MUST be followed for all cross-module changes._

---

**Version History:**
- v1.0 (2026-09-11): Initial version based on Bella Land RC evidence closure lessons learned
