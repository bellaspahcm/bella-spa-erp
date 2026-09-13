# BELLA FACTORY RULE — CANONICAL-FIRST DEVELOPMENT

**Status:** MANDATORY — PRE-IMPLEMENTATION RULE  
**Scope:** All AI-assisted development across Bella Platform and Products  
**Priority:** P0 (Must execute before discovery/implementation)  
**Effective Date:** 2026-09-11

---

## Principle

> Before creating, modifying, or testing a technical pattern, first determine whether Bella Platform or an existing verified product already has a canonical implementation for that concern.

**AI MUST NOT design a new local pattern before checking for an existing canonical pattern.**

---

## Rationale

Every new Bella product (Hospital, Preschool, Beauty Spa, Real Estate, English Center, etc.) should inherit knowledge from previous products.

**Problem observed:** AI rediscovering authentication, tenant isolation, RLS patterns, service boundaries, and testing methodology from scratch for each new vertical, leading to:
- Inconsistent security patterns
- Privilege expansion bugs
- Duplicate implementations
- Missed institutional knowledge
- Longer development cycles

**Solution:** Mandate canonical pattern search BEFORE implementation.

---

## 1. Mandatory Preflight Classification

Before implementation, AI must classify the work into:

### A. Platform / Cross-Product Concern

**Mandatory canonical check required.**

Examples:
- Authentication & Authorization
- Tenant context & isolation
- RLS (Row-Level Security) policies
- Server Action pattern
- Service boundaries (service_role vs user session)
- Repository pattern
- Error handling & validation
- Audit attribution (created_by, updated_by)
- Soft delete / entity lifecycle
- Cross-tenant security testing
- Browser E2E methodology
- Regression test methodology
- Logging & observability
- Data ownership semantics
- Shared workflow infrastructure

**For these concerns, AI must inspect:**
1. Bella Platform implementation
2. Existing mature/verified products (Hospital, Preschool, Beauty Spa)
3. Existing Factory/Governance rules
4. Existing tests proving the pattern
5. Existing ADRs/contracts where applicable

### B. Domain-Specific Concern

**Canonical check recommended but not mandatory.**

Examples (Bella Land):
- Project → Product relationship
- Apartment inventory semantics
- Customer → Reservation workflow
- Reservation lifecycle states
- Deposit / booking business rules

**For domain concerns:**
- AI may perform product discovery
- AI MUST still reuse platform-level canonical patterns for auth, tenant, security, persistence, testing

---

## 2. Canonical Source Priority

Prefer evidence in this order:

```text
1. Bella Platform canonical implementation
        ↓
2. Factory / Governance rule
        ↓
3. Previously FIELD VERIFIED / CLOSED product
        ↓
4. Verified shared service / library
        ↓
5. Current product implementation
        ↓
6. New design (only if no canonical pattern exists)
```

**Reference products:**
- Hospital (healthcare vertical)
- Preschool (education vertical)
- Beauty Spa (service vertical)
- Real Estate (property vertical)

Use these as reference implementations for cross-cutting concerns.

---

## 3. Reuse Before Reinvention

Before creating a new implementation, AI must answer:

```text
Does a canonical pattern already exist?
        ↓
    YES → Reuse it
        ↓
    NO
        ↓
Is this genuinely domain-specific?
        ↓
    YES → Design domain-specific implementation
    NO  → Investigate platform gap before inventing new pattern
```

**Examples:**

❌ **Wrong:**
```typescript
// Bella Land creates new tenant helper
function getMyTenantId() {
  const user = await getUser();
  return user?.tenant_id;
}
```

✅ **Correct:**
```sql
-- Reuse canonical helper
tenant_id = public.get_auth_tenant_id()
```

❌ **Wrong:**
```typescript
// Direct DB update with user session client
const supabase = await createClient();
await supabase.from('products').update({ status: 'booked' });
// User session subject to RLS → may fail if policy insufficient
```

✅ **Correct:**
```typescript
// Service-layer authorization (canonical pattern)
const serviceClient = createServiceClient(); // bypasses RLS
// Authorization checked at action layer
await reservationService.mutateProduct(serviceClient, params);
```

---

## 4. Divergence Rule

If AI determines the existing canonical pattern **cannot** be reused, it MUST state:

```text
CANONICAL DIVERGENCE

Existing canonical:
<pattern description>

Why it cannot be reused:
<technical/business evidence>

Required difference:
<domain-specific reason>

Impact:
<security/data/workflow implications>

Approval:
<Human Architect decision required>
```

**AI MUST NOT silently introduce a second competing pattern.**

---

## 5. Security-Sensitive Rule

For security-sensitive concerns, **canonical check is MANDATORY**:

- Auth & session management
- Tenant isolation
- RLS policies
- Permission boundaries
- Service-role usage
- Privileged mutations
- Cross-entity ownership

**AI MUST NOT:**
- Broaden permissions for convenience
- Add generic authenticated access just to make a workflow pass
- Treat service_role as RLS evidence
- Create custom tenant logic when canonical helper exists
- Bypass canonical service/domain behavior with direct DB operations

**Example (from Bella Land P5.5):**

❌ **Wrong (privilege expansion):**
```sql
-- Added generic UPDATE for all authenticated users
CREATE POLICY "products_update_all" ON products
  FOR UPDATE TO authenticated
  USING (tenant_id = user.tenant_id);
-- Allows ktv to UPDATE price, area, project_id, etc.
```

✅ **Correct (service-layer authorization):**
```typescript
// Keep admin-only RLS policy
// Use service client for controlled mutation
const serviceClient = createServiceClient();
await reservationService.reserveProduct(serviceClient, params);
// Only Product.status mutated, not price/area
```

---

## 6. Test Methodology Rule

Before writing a new security or integration test, **check for existing verified test pattern**.

**Examples:**

### RLS Tests
✅ **Canonical:**
- Authenticated clients required
- Service_role only for fixture setup / independent verification
- Test actual user permissions, not service_role bypass

❌ **Anti-pattern:**
- Using service_role to "test" RLS policies
- Testing with wrong role/session

### Browser Runtime Tests
✅ **Canonical:**
- Production UI required
- Real browser interaction
- Verify DOM state, not just action success

❌ **Anti-pattern:**
- Direct action/script execution claiming "browser tested"
- Skipping actual UI verification

### Canonical Service Workflow Tests
✅ **Canonical:**
- Test through canonical service
- Verify domain invariants enforced
- Check rollback semantics

❌ **Anti-pattern:**
- Direct DB insert claiming "service tested"
- Bypassing domain validation

---

## 7. Evidence Boundary

**Canonical determines:** HOW the system should be implemented.

**Runtime evidence determines:** WHETHER that implementation may be marked VERIFIED / CLOSED.

**Canonical existence alone is not runtime proof.**

You must still execute tests and capture evidence after implementing canonical pattern.

---

## 8. No-New-Pattern Guard

AI MUST NOT create a new cross-product pattern unless:

```text
1. ✅ Canonical search completed
2. ✅ No suitable existing pattern found
3. ✅ New pattern is justified with evidence
4. ✅ Impact is documented (security, data, workflow)
5. ✅ Required governance/change-control satisfied
```

---

## 9. Required AI Output Before Implementation

For architecture/security/data/workflow changes, AI should produce:

```text
CANONICAL PREFLIGHT

Concern:
<what is being changed>

Canonical reference:
<existing platform/product implementation with file paths>

Reuse decision:
REUSE / EXTEND / DIVERGE / NEW

Reason:
<brief evidence>

Implementation boundary:
<what will and will not change>

Security impact:
<tenant isolation, permissions, RLS, etc.>
```

Only then proceed to implementation.

---

## 10. Core Factory Principle

> Every new Bella product should inherit knowledge from previous products.

> A new vertical should discover only what is genuinely new about its domain — not rediscover authentication, tenancy, security, architecture, testing, and governance from scratch.

**The platform becomes stronger when every solved problem becomes reusable institutional knowledge.**

---

## Development Flow (Updated)

```text
CANONICAL FIRST ← NEW MANDATORY STEP
      ↓
SCOPE / OWNERSHIP
      ↓
EVIDENCE FIRST
      ↓
IMPLEMENT
      ↓
VERIFY
      ↓
REGRESSION
      ↓
SEAL
```

**Old flow (deprecated):**
```text
Discovery → Implement → Find pattern doesn't work → RCA → Discover canonical exists → Refactor
```

**New flow (required):**
```text
Canonical search → Reuse proven pattern → Implement → Verify
```

---

## Examples from Bella Land v2 RC

### Example 1: RLS Policy (P5.5 Defect)

**Initial approach (wrong):**
- Discovered Product UPDATE blocked by admin-only policy
- Created generic UPDATE policy for all authenticated users
- Did not check canonical authorization pattern
- Result: Privilege expansion (ktv can UPDATE price/area)

**Canonical-first approach (correct):**
1. Search: How do other verticals handle service mutations under RLS?
2. Find: Service-layer authorization pattern (createServiceClient)
3. Reuse: Action layer authorizes → Service client mutates
4. Result: Admin-only RLS preserved, controlled mutation works

### Example 2: Tenant Helper (Hypothetical)

**Initial approach (wrong):**
```typescript
// Create new tenant getter
function getTenantId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.user_metadata?.tenant_id;
}
```

**Canonical-first approach (correct):**
1. Search: Does Bella have canonical tenant helper?
2. Find: `public.get_auth_tenant_id()` in DB migrations
3. Reuse: Use canonical helper in RLS policies
4. Result: Consistent tenant isolation across products

### Example 3: Browser E2E (C3.3)

**Initial approach (wrong):**
- Wrote script calling Server Actions directly
- Claimed "browser tested" without actual UI
- Did not check canonical E2E methodology

**Canonical-first approach (correct):**
1. Search: How do other products verify browser flows?
2. Find: Manual browser checklist with screenshot evidence
3. Reuse: Production UI → Real user interaction → DOM verification
4. Result: Genuine browser evidence captured

---

## Enforcement

**Pre-commit hook suggestion:**
```bash
# Check if architecture/security changes include CANONICAL PREFLIGHT
if [[ $(git diff --cached --name-only | grep -E 'src/platform|migrations|contracts') ]]; then
  echo "⚠️  Platform/Security change detected"
  echo "📋 CANONICAL PREFLIGHT required before commit"
  echo "    See: docs/architecture/FACTORY_RULE_CANONICAL_FIRST_DEVELOPMENT.md"
fi
```

**AI agent hook (recommended):**
- Trigger on: Server Action creation, RLS policy changes, service instantiation
- Action: Prompt AI to output CANONICAL PREFLIGHT before proceeding

---

## Success Criteria

A new Bella vertical is following this rule when:

1. ✅ AI searches existing products before implementing auth/tenant/RLS
2. ✅ AI reuses `createServiceClient()` pattern when needed
3. ✅ AI reuses `get_auth_tenant_id()` in RLS policies
4. ✅ AI follows canonical test methodology (browser, RLS, service)
5. ✅ AI outputs CANONICAL PREFLIGHT for architecture changes
6. ✅ No duplicate patterns introduced without documented divergence
7. ✅ Security boundaries preserved (no generic permission grants)

---

## Related Documents

- `docs/architecture/CANONICAL_PATTERN_PRINCIPLE.md` - Pattern discovery methodology
- `docs/architecture/FREEZE_POLICY.md` - Kernel freeze and change control
- `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md` - Healthcare canonical patterns
- `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md` - Education canonical patterns
- `AGENTS.md` - AI coding discipline and Architecture Guard

---

## Revision History

| Date | Version | Change |
|---|---|---|
| 2026-09-11 | 1.0 | Initial Factory Rule established (from Bella Land P5.5 lessons) |

---

**This is a FACTORY-LEVEL RULE. All AI agents working on Bella Platform must comply.**
