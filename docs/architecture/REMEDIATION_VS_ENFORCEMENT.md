# REMEDIATION VS ENFORCEMENT

**Principle:** Remediate once → Enforce forever  
**Context:** Identity Architecture (E0.1A-R: R0–R7)

---

## 🎯 CORE DISTINCTION

### Remediation (One-Time)

**Definition:** Fixing historical architecture debt in existing product

**Characteristics:**
- ✅ Applied to **legacy codebase** (English Center E1)
- ✅ 8-stage process (R0–R7) with evidence gates
- ✅ DB migration, code migration, caller migration, verification
- ✅ Expensive, careful, evidence-based
- ✅ **Does not repeat** for each new product

**Example:** E0.1A-R Identity Remediation
```text
R0: Preflight
R1: Mapping
R2: Backfill
R3: Cutover
R4: Callers
R5: Freeze
R6: E2E
R7: Seal
```

**Duration:** Weeks/months (depends on debt size)

### Enforcement (Forever)

**Definition:** Preventing debt from recurring in new products

**Characteristics:**
- ✅ Applied to **new products** (Spa, Preschool, future)
- ✅ Built into Platform Registry/Manifest/Factory
- ✅ Architecture Guard enforces at creation time
- ✅ Zero remediation cost (correct from start)
- ✅ **Scales automatically** to all products

**Example:** Post-R7 Platform Rules
```text
✅ New Product Vertical must use Party (not Person)
✅ Architecture Guard blocks Person-based identity
✅ Product Registry validates Party contract compliance
✅ Factory templates use Party by default
```

**Duration:** Instant (prevented at product creation)

---

## 📊 COST COMPARISON

### English Center (Legacy Product)

**Status:** Requires full remediation (R0–R7)

**Cost:**
```text
R0: Preflight             ~1 day
R1: Identity Mapping      ~1 day
R2: Party Backfill        ~2 days
R3: Education Cutover     ~3 days
R4: Caller Migration      ~2-3 days (estimated)
R5: Legacy Freeze         ~2 days
R6: E2E Regression        ~1 day
R7: Evidence Seal         ~1 day
───────────────────────────────────
TOTAL:                    ~13-14 days

DB migrations:            3 (R2, R3, R5)
Code migrations:          ~50+ files (estimated)
Test updates:             ~100+ fixtures (estimated)
Evidence documents:       12+ reports
```

**Why expensive:** Fixing existing 631 students + legacy Person infrastructure

### Spa Product (New Product)

**Status:** No remediation required (uses Party from start)

**Cost:**
```text
Product scaffolding:      Platform Factory (automated)
Identity setup:           Party contract (already defined)
Architecture validation:  Guard checks (automated)
───────────────────────────────────
TOTAL:                    ~0 days remediation

DB migrations:            0 (uses standard Party schema)
Code migrations:          0 (built correctly from start)
Test updates:             0 (uses Party fixtures)
Evidence documents:       0 (no debt to remediate)
```

**Why cheap:** Platform enforces Party architecture automatically

### Preschool Product (New Product)

**Same as Spa:** 0 remediation cost (Party from start)

---

## 🔒 R7 DELIVERABLE: PLATFORM ENFORCEMENT

### What R7 Must Produce

**After Identity Remediation (R0–R7) seals:**

1. **Architecture Guard Rules**
   ```typescript
   // Block Person-based identity in new Product Verticals
   if (domain.isNewProduct() && domain.usesPersonIdentity()) {
     throw new ArchitectureViolation(
       'New products must use Party canonical identity (E0.1A-R sealed)'
     );
   }
   ```

2. **Product Registry Validation**
   ```typescript
   // Validate Product Manifest contracts
   interface IEducationProduct {
     studentContract: IEducationStudentContract; // MUST use partyId
   }
   
   // Reject if uses person_id
   if (contract.usesPersonId()) {
     throw new ManifestViolation('Person identity prohibited (use Party)');
   }
   ```

3. **Factory Templates**
   ```typescript
   // Product scaffold generator
   ProductFactory.create('bella-spa', {
     identitySource: 'Party',        // DEFAULT
     deprecatedPersonSource: false,  // BLOCKED
   });
   ```

4. **Documentation**
   - Architecture Decision Record (ADR): Why Party, not Person
   - Platform Guide: How new products use Party
   - Migration completed evidence: English Center remediation sealed

### Enforcement Mechanisms

```text
LAYER 1: Architecture Guard (build-time)
→ Blocks Person-based code in new Product Vertical domains

LAYER 2: Product Registry (registration-time)
→ Validates Manifest contracts use Party

LAYER 3: Factory Templates (scaffold-time)
→ Generates Party-based code by default

LAYER 4: CI/CD Gates (deploy-time)
→ Rejects Product deployment if Person-based

LAYER 5: Documentation (human-time)
→ Training materials, ADRs, platform guides
```

---

## 📈 SCALABILITY MODEL

### Without Enforcement (Remediation Every Time)

```text
English Center:     R0–R7 (13 days)
Spa:               R0–R7 (13 days)
Preschool:         R0–R7 (13 days)
Product N:         R0–R7 (13 days)
───────────────────────────────────
TOTAL (10 products): 130 days remediation
```

**Problem:** Debt multiplies with each product

### With Enforcement (Remediation Once)

```text
English Center:     R0–R7 (13 days)  ← ONE TIME
+ R7 Platform Setup: 2 days

Spa:               0 days (enforced)
Preschool:         0 days (enforced)
Product N:         0 days (enforced)
───────────────────────────────────
TOTAL (10 products): 15 days total
```

**Benefit:** 130 days → 15 days (8.7x improvement)

---

## 🚨 ANTI-PATTERN WARNING

### DON'T: Treat R0–R7 as Reusable Process

❌ **Wrong Approach:**
```text
"Every new product must complete R0–R7 Identity Remediation"
```

**Why wrong:**
- R0–R7 is for **fixing existing debt**, not creating new products
- New products should never have Person-based debt
- Wastes 13 days per product on avoidable remediation

### DO: Enforce at Platform Level

✅ **Right Approach:**
```text
"English Center completed R0–R7 once.
Platform now blocks Person-based identity in all new products."
```

**Why right:**
- R0–R7 debt paid once, never repeated
- New products get Party architecture automatically
- Zero marginal remediation cost per product

---

## 📋 R7 COMPLETION CHECKLIST

### Before R7 Seal

- [ ] English Center remediation complete (R0–R6)
- [ ] Finance remediation complete (if needed)
- [ ] All evidence documents sealed

### R7 Platform Tasks

**Architecture Guard:**
- [ ] Add Person identity block for new Product Verticals
- [ ] Add Party contract validation rules
- [ ] Test enforcement (attempt Person-based product → blocked)

**Product Registry:**
- [ ] Update Manifest schema (require Party contracts)
- [ ] Add validation in product registration flow
- [ ] Document contract requirements

**Factory Templates:**
- [ ] Update ProductFactory to use Party by default
- [ ] Remove Person identity templates
- [ ] Add Party-based examples

**Documentation:**
- [ ] Write ADR: Party as canonical identity
- [ ] Update Platform Guide: New product identity rules
- [ ] Publish remediation case study: English Center

**Verification:**
- [ ] Create test Product using Factory (should use Party)
- [ ] Attempt Person-based Product (should be blocked)
- [ ] Verify no manual Party setup required

### R7 Evidence

- [ ] Platform enforcement tests PASS
- [ ] Documentation published
- [ ] ADR sealed
- [ ] New product creation demo (Party by default)

---

## 🎯 SUCCESS METRIC

**After R7 Seal:**

```text
QUESTION: Does new Product X need Identity Remediation?
ANSWER:   No — Guard blocks Person, enforces Party automatically

QUESTION: How long to scaffold Spa product identity?
ANSWER:   0 days — Factory uses Party by default (tested)

QUESTION: Can Preschool use Person identity?
ANSWER:   No — Architecture Guard blocks at build time (verified)

QUESTION: Who ensures new products use Party?
ANSWER:   Automation — Guard enforces without human memory
```

**Verification Method:**

```typescript
// R7 must include these tests
describe('Platform Enforcement', () => {
  test('blocks Person-based identity in new products', () => {
    expect(() => 
      ProductFactory.create('test', { identity: 'Person' })
    ).toThrow(/Person prohibited/);
  });
  
  test('uses Party by default', () => {
    const product = ProductFactory.create('test');
    expect(product.identitySource).toBe('Party');
  });
});
```

**This is enforcement** — code proves it, not documents claiming it.

---

## 📚 RELATED DOCUMENTS

- `E0_1A_IDENTITY_ARCHITECTURE_DESIGN.md` — Why Party is canonical
- `CHECKPOINT_R3_SEALED.md` — Current remediation progress
- `R4_CALLER_MIGRATION_PLAN.md` — Next remediation step
- `FREEZE_POLICY.md` — Healthcare/Logistics kernel enforcement example

---

**Principle:** Remediate legacy debt once (R0–R7). Encode rules in Platform. Automate enforcement forever.

**Key Distinction:**
- **Documents** describe intent ("Party by default")
- **Code/Gates** prove enforcement (Architecture Guard blocks Person)
- **R7 deliverable:** Working enforcement, not just documentation

**Success Metric After R7:**

```text
NEW PRODUCT SCAFFOLD ATTEMPT:

1. Developer runs: ProductFactory.create('bella-spa')
2. Factory generates: Party-based identity (default)
3. Developer tries: Person-based identity override
4. Architecture Guard: BLOCKS (with clear error)
5. Tests verify: Enforcement works automatically
```

**This is enforcement.** Not aspirational — verifiable.

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-12  
**Review:** After R7 seal (add actual enforcement implementation details)
