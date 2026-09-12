# R7 ENFORCEMENT CHAIN SPECIFICATION

**Purpose:** Define exact evidence R7 must produce to seal Identity Remediation  
**Status:** Specification (R7 implementation must satisfy)

---

## 🎯 R7 MANDATE

**R7 cannot seal without proving this chain:**

```text
Party Architecture
    ↓
Automated Guard (code)
    ↓
Adversarial Test (proof)
    ↓
BLOCK legacy Person pattern
ALLOW valid Party pattern
    ↓
Evidence Seal (verified)
    ↓
Bella Platform/Factory Integration
```

**Result:** New products inherit Party automatically. No human memory required.

---

## 🔒 ENFORCEMENT CHAIN COMPONENTS

### 1. Party Architecture (Already Exists)

**Location:** `docs/architecture/E0_1A_IDENTITY_ARCHITECTURE_DESIGN.md`

**Status:** ✅ COMPLETE (defined in E0)

**Artifacts:**
- Party as canonical identity (design)
- Student → Party relationship (defined)
- Person as legacy compatibility layer (documented)

### 2. Automated Guard (R7 Must Create)

**Location:** `src/platform/architecture/guards/identity-guard.ts` (TBD)

**Status:** 🔲 TODO (R7 deliverable)

**Required Code:**
```typescript
/**
 * Architecture Guard: Identity Layer
 * Blocks Person-based identity in new Product Verticals
 */
export class IdentityArchitectureGuard {
  /**
   * Validates Product Vertical uses Party (not Person)
   * @throws ArchitectureViolation if Person-based identity detected
   */
  validateProductIdentity(manifest: ProductManifest): void {
    if (this.isNewProduct(manifest) && this.usesPersonIdentity(manifest)) {
      throw new ArchitectureViolation(
        `Product '${manifest.name}' uses deprecated Person identity. ` +
        `New products must use Party canonical identity. ` +
        `See: E0.1A-R Identity Remediation (sealed 2026-09-12)`
      );
    }
  }

  private isNewProduct(manifest: ProductManifest): boolean {
    // Products created after E0.1A-R seal
    const remediationSealDate = new Date('2026-09-12');
    return manifest.createdAt > remediationSealDate;
  }

  private usesPersonIdentity(manifest: ProductManifest): boolean {
    // Check if contracts reference Person-based identity
    return manifest.contracts.some(contract => 
      contract.identitySource === 'person' ||
      contract.schema.includes('person_id') && 
      !contract.schema.includes('party_id')
    );
  }
}
```

**Integration Points:**
- Product Registry (registration-time validation)
- ProductFactory (scaffold-time validation)
- CI/CD pipeline (build-time validation)

### 3. Adversarial Test (R7 Must Create)

**Location:** `tests/platform/architecture/identity-guard.test.ts` (TBD)

**Status:** 🔲 TODO (R7 deliverable)

**Required Tests:**

```typescript
describe('IdentityArchitectureGuard', () => {
  describe('Enforcement: Block Person-based identity', () => {
    test('blocks new product using Person identity', () => {
      const manifest: ProductManifest = {
        name: 'bella-spa',
        createdAt: new Date('2026-09-13'), // After remediation seal
        contracts: [{
          name: 'SpaStudentContract',
          identitySource: 'person', // ❌ INVALID
          schema: { person_id: 'uuid' }
        }]
      };

      const guard = new IdentityArchitectureGuard();
      
      expect(() => guard.validateProductIdentity(manifest))
        .toThrow(ArchitectureViolation);
      
      expect(() => guard.validateProductIdentity(manifest))
        .toThrow(/deprecated Person identity/);
    });

    test('blocks new product with person_id schema without party_id', () => {
      const manifest: ProductManifest = {
        name: 'bella-preschool',
        createdAt: new Date('2026-09-13'),
        contracts: [{
          name: 'PreschoolStudentContract',
          schema: {
            person_id: 'uuid', // ❌ Person without Party
            student_code: 'string'
          }
        }]
      };

      const guard = new IdentityArchitectureGuard();
      
      expect(() => guard.validateProductIdentity(manifest))
        .toThrow(ArchitectureViolation);
    });
  });

  describe('Enforcement: Allow Party-based identity', () => {
    test('allows new product using Party identity', () => {
      const manifest: ProductManifest = {
        name: 'bella-spa',
        createdAt: new Date('2026-09-13'),
        contracts: [{
          name: 'SpaStudentContract',
          identitySource: 'party', // ✅ VALID
          schema: { party_id: 'uuid' }
        }]
      };

      const guard = new IdentityArchitectureGuard();
      
      expect(() => guard.validateProductIdentity(manifest))
        .not.toThrow();
    });

    test('allows legacy product (English Center) with Person', () => {
      const manifest: ProductManifest = {
        name: 'bella-english-center',
        createdAt: new Date('2026-01-01'), // Before remediation
        contracts: [{
          name: 'EducationStudentContract',
          schema: {
            person_id: 'uuid', // ✅ VALID (legacy)
            party_id: 'uuid'   // Added via remediation
          }
        }]
      };

      const guard = new IdentityArchitectureGuard();
      
      expect(() => guard.validateProductIdentity(manifest))
        .not.toThrow(); // Legacy products exempt
    });
  });

  describe('Integration: ProductFactory', () => {
    test('Factory uses Party by default for new products', () => {
      const product = ProductFactory.create('bella-spa', {
        type: 'education',
        // identitySource NOT specified (use default)
      });

      expect(product.identitySource).toBe('party');
      expect(product.contracts.every(c => 
        c.schema.includes('party_id')
      )).toBe(true);
    });

    test('Factory blocks explicit Person override', () => {
      expect(() => 
        ProductFactory.create('bella-spa', {
          type: 'education',
          identitySource: 'person' // ❌ Explicit override blocked
        })
      ).toThrow(ArchitectureViolation);
    });
  });
});
```

**Test Coverage Required:**
- ✅ Block: New product + Person identity → throw
- ✅ Block: New product + person_id only → throw
- ✅ Allow: New product + Party identity → pass
- ✅ Allow: Legacy product + Person (grandfathered) → pass
- ✅ Integration: Factory defaults to Party → pass
- ✅ Integration: Factory blocks Person override → throw

**Success Criteria:** All 6+ tests PASS

### 4. Evidence Seal (R7 Verification)

**Location:** `docs/products/bella-english-center/R7_ENFORCEMENT_EVIDENCE.md` (TBD)

**Status:** 🔲 TODO (R7 deliverable)

**Required Evidence:**

```text
GUARD IMPLEMENTATION
✅ IdentityArchitectureGuard class created
✅ validateProductIdentity() method implemented
✅ Integration points defined (Registry, Factory, CI/CD)
✅ Error messages clear and actionable

ADVERSARIAL TESTS
✅ 6+ enforcement tests created
✅ All tests PASS
✅ Block tests prove rejection (legacy patterns blocked)
✅ Allow tests prove acceptance (valid patterns allowed)
✅ Integration tests prove automation (no human memory)

BUILD VERIFICATION
✅ Guard integrated into build pipeline
✅ Test suite runs on every build
✅ CI/CD rejects Person-based products

DOCUMENTATION
✅ Architecture Decision Record (why Party, not Person)
✅ Platform Guide (how new products use Party)
✅ Guard reference (how enforcement works)
✅ Migration completed evidence (English Center sealed)
```

### 5. Platform Integration (R7 Deployment)

**Location:** `src/platform/factory/product-factory.ts` (TBD)

**Status:** 🔲 TODO (R7 deliverable)

**Required Changes:**

```typescript
export class ProductFactory {
  private identityGuard = new IdentityArchitectureGuard();

  create(name: string, config: ProductConfig): Product {
    // Default to Party for new products
    const manifest: ProductManifest = {
      name,
      createdAt: new Date(),
      contracts: this.generateContracts(config),
      identitySource: config.identitySource || 'party' // DEFAULT
    };

    // Validate before creation
    this.identityGuard.validateProductIdentity(manifest);

    return this.scaffold(manifest);
  }

  private generateContracts(config: ProductConfig): Contract[] {
    // Generate Party-based contracts by default
    return config.type === 'education' 
      ? [this.generateEducationContract('party')]
      : [this.generateGenericContract('party')];
  }
}
```

**Integration Proof:**
```typescript
// R7 must demonstrate this works
test('End-to-end: New product creation uses Party automatically', () => {
  const spa = ProductFactory.create('bella-spa', { type: 'education' });
  
  // Verify Party used by default
  expect(spa.identitySource).toBe('party');
  expect(spa.contracts[0].schema.party_id).toBeDefined();
  expect(spa.contracts[0].schema.person_id).toBeUndefined();
  
  // Verify students can be created using Party
  const student = spa.services.student.create({
    partyId: 'test-party-id',
    studentCode: 'SPA-2026-001'
  });
  
  expect(student.partyId).toBe('test-party-id');
});
```

---

## ✅ R7 EXIT CRITERIA

### Code Deliverables

```text
✅ IdentityArchitectureGuard implemented
✅ 6+ adversarial tests created (all PASS)
✅ ProductFactory integrated (Party default)
✅ CI/CD pipeline updated (Guard on every build)
✅ Build PASS with Guard active
```

### Evidence Deliverables

```text
✅ R7_ENFORCEMENT_EVIDENCE.md (complete)
✅ Architecture Decision Record (ADR_PARTY_IDENTITY.md)
✅ Platform Guide updated (new product identity rules)
✅ Test results documented (all enforcement tests PASS)
✅ Integration demo (new product uses Party automatically)
```

### Verification Checkpoint

**R7 Seal Test:**

```bash
# 1. Attempt to create Person-based product
npm run test:platform -- --grep "blocks new product using Person"
# Expected: PASS (Guard blocks correctly)

# 2. Create Party-based product via Factory
npm run test:platform -- --grep "Factory uses Party by default"
# Expected: PASS (Factory generates Party automatically)

# 3. Run full enforcement suite
npm run test:platform:enforcement
# Expected: 6/6 tests PASS

# 4. Build with Guard active
npm run build
# Expected: PASS (no violations)
```

**If any test fails:** R7 cannot seal. Fix enforcement, re-verify.

---

## 🚫 R7 CANNOT SEAL WITH

❌ **Documentation only** ("new products should use Party")  
❌ **Guidelines or best practices** (no enforcement)  
❌ **Manual checklist** (human memory required)  
❌ **Aspirational ADR** (no working code)  
❌ **Passing tests without adversarial cases** (false-green)

**R7 must prove automation:** Guard blocks legacy pattern, allows valid pattern, zero human intervention.

---

## 📊 ENFORCEMENT PROOF CHAIN

```text
STEP 1: Code Implementation
→ IdentityArchitectureGuard class exists
→ validateProductIdentity() method works
→ Integration points connected

STEP 2: Adversarial Testing
→ Block tests: Person-based product → throw ArchitectureViolation
→ Allow tests: Party-based product → pass
→ Integration tests: Factory defaults → Party

STEP 3: Build Integration
→ Guard runs on every build
→ CI/CD rejects Person-based products
→ Test suite enforces automatically

STEP 4: Evidence Documentation
→ All tests documented (results + coverage)
→ ADR explains architecture decision
→ Platform guide shows correct usage
→ English Center remediation sealed

STEP 5: Deployment Verification
→ Create test product → uses Party automatically
→ Attempt Person override → blocked by Guard
→ Zero manual configuration required

═══════════════════════════════════════════════════════════════
RESULT: Person-based identity debt cannot recur
        (proven by code, not claimed by document)
═══════════════════════════════════════════════════════════════
```

---

## 🎯 SUCCESS METRIC

**R7 succeeds when this demonstration works:**

```typescript
// Developer creates new Bella product
const spa = ProductFactory.create('bella-spa');

// 1. Party used automatically (no manual setup)
assert(spa.identitySource === 'party');

// 2. Person override blocked by Guard
expect(() => 
  ProductFactory.create('test', { identitySource: 'person' })
).toThrow(ArchitectureViolation);

// 3. Students work with Party only
const student = spa.services.student.create({
  partyId: 'party-123',
  studentCode: 'SPA-2026-001'
  // No personId needed or accepted
});

assert(student.partyId === 'party-123');
```

**This is enforcement.** Code proves it works. Tests prove it blocks legacy. Integration proves it's automatic.

---

**R7 Enforcement Chain:** Party architecture → Guard code → Adversarial tests → Block legacy / Allow valid → Evidence seal → Platform integration → **Debt prevention verified**

**Specification Version:** 1.0  
**Effective After:** R7 seal  
**Compliance Required:** Mandatory for R7 completion
