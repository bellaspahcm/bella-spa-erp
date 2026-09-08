# Factory Phase 3 — Canonical Contract Establishment Investigation

**Date:** 2026-09-05  
**Status:** INVESTIGATION COMPLETE  
**Finding:** Capability gap identified

---

## INVESTIGATION OBJECTIVE

**Question:** Is `database.types.ts` establishment a Factory capability gap or intentional external boundary?

**Method:** Evidence-based audit of Bella codebase, documentation, and existing Industry OS patterns.

---

## FINDINGS

### 1. CANONICAL SOURCE OF TRUTH

**Answer:** Migrations are canonical source, `database.types.ts` is generated artifact.

**Evidence:**

#### From Documentation (1000+ references)

```
Migration → Deployed DB → npx supabase gen types → database.types.ts
```

**Quotes:**
- "Do not modify generated database types manually" (core-platform-extraction-roadmap.md)
- "Use Supabase auto-generated types" (multiple ADRs, specs)
- "Regenerate types after every migration" (deployment guides)
- "database.types.ts (auto-generated)" (architecture_diagram.md)

#### From Existing Industry OS Patterns

All existing Industry OS follow same workflow:

```bash
# Step 1: Create migration
supabase/migrations/YYYYMMDDHHMMSS_<name>.sql

# Step 2: Deploy migration
npx supabase db push (local)
OR Supabase Dashboard (remote)

# Step 3: Generate types
npx supabase gen types typescript --local > src/types/database.types.ts
OR
npx supabase gen types typescript --project-ref <ref> > src/types/database.types.ts
```

**Examples:**
- Healthcare: Schema → Deploy → Generate types
- Education: Schema → Deploy → Generate types
- Real Estate: Schema → Deploy → Generate types
- Logistics: Schema → Deploy → Generate types

**No Industry OS generates types directly from migration files without deployment.**

---

### 2. DATABASE.TYPES.TS ROLE

**Answer:** Generated artifact, NOT canonical truth.

**Classification:**

| Attribute | Value |
|-----------|-------|
| **Source** | Supabase database introspection |
| **Authority** | Derived (not authoritative) |
| **Modification** | Never manual (regenerated) |
| **Purpose** | Type-safe contract from DB schema |
| **Dependency** | Requires deployed database |

**Contract chain:**

```
Canonical Truth:
  supabase/migrations/*.sql (DDL schema)
      ↓ [DEPLOYMENT]
  PostgreSQL database (deployed schema)
      ↓ [INTROSPECTION]
  database.types.ts (TypeScript contract)
      ↓ [USAGE]
  Domain layer (type-safe implementation)
```

---

### 3. EXISTING TYPE GENERATION MECHANISM

**Answer:** YES, Bella has established mechanism, but it requires deployed database.

**Command:**

```bash
npx supabase gen types typescript <options> > src/types/database.types.ts
```

**Options:**
- `--local`: Generate from local Supabase instance (Docker)
- `--project-ref <ref>`: Generate from remote Supabase project
- `--linked`: Use linked project from config

**Requirements:**
1. ✅ Supabase CLI installed (`npx supabase`)
2. ✅ Migration deployed to database (local OR remote)
3. ✅ Database accessible (connection established)
4. ❌ **NOT available:** Direct generation from migration files without deployment

**Bella does NOT have:**
- Migration → Types generator (without deployment)
- Local type generation from DDL parser
- Factory-integrated type establishment

---

### 4. CAPABILITY GAP OR INTENTIONAL BOUNDARY?

**Answer:** CAPABILITY GAP

**Evidence:**

#### Factory Mission

From FACTORY_QUALIFICATION_STATUS.md:

> **Factory = Autonomous Industry OS Construction System**
>
> **Goal:** Repository (DB + schema) → Industry OS (verified, compliant, production-ready) with minimal human decisions

**Current reality:**

```
Fresh Industry OS Intent
    ↓
✅ Canonical schema creation (DONE)
    ↓
❌ Schema deployment (MISSING - requires human/external deployment)
    ↓
❌ Type generation (MISSING - requires deployed DB)
    ↓
🚫 Evidence collection (BLOCKED - no types)
    ↓
🚫 Scope derivation (BLOCKED - requires types)
    ↓
🚫 Construction context (BLOCKED - requires scope)
```

**Gap:** Factory cannot autonomously bridge canonical schema → canonical types.

#### Why This Is a Gap (Not Intentional Boundary)

**1. Fresh Industry OS construction is stated Factory goal**

Factory Phase 3 objective (user directive):

> "Build Manufacturing OS" (fresh OS, no prior implementation)

**Expected flow:**
```
Intent → Schema → Types → Evidence → Scope → Context → Construction
```

**Actual flow:**
```
Intent → Schema → ❌ BLOCKED (no types) → ❌ Evidence fails → ❌ Scope fails
```

**2. Factory governance requires types but cannot establish them**

From canonical-scope-derivation.ts:

```typescript
// Rule: Contract drift detected
if (evidence.migration && !evidence.generatedTypes) {
  return { decision: 'BLOCK', reason: 'Contract drift: migration exists but generated types missing' };
}
```

**Factory BLOCKS when types missing** but has **no capability to generate types**.

**This is architectural contradiction:**
- Factory governance: "Types REQUIRED for RECONSTRUCT"
- Factory capability: "Cannot generate types"

**3. All existing Industry OS required human intervention**

**Healthcare, Education, Real Estate, Logistics:**
- Human created migration
- Human deployed to Supabase
- Human ran `npx supabase gen types`
- Human committed `database.types.ts`
- THEN Factory could proceed

**This proves:** Current Factory requires human to establish canonical contract before autonomous construction can begin.

**4. User expectation contradicts current boundary**

User directive for Phase 3:

> "Objective duy nhất đưa cho Factory/AI agent: Build Manufacturing OS.
>
> Factory phải tự thực hiện: Discover canonical truth → Derive scope → Assemble construction context → AI self-research → Autonomous construction"

**"Tự thực hiện" (autonomously perform) includes contract establishment.**

---

## ARCHITECTURAL CLASSIFICATION

### Current State

**Factory ownership:**
- ✅ Schema discovery (from existing migrations)
- ✅ Evidence collection (IF types exist)
- ✅ Scope derivation (IF evidence complete)
- ✅ Construction context assembly (IF scope RECONSTRUCT)
- ❌ Schema deployment
- ❌ Type generation
- ❌ Canonical contract establishment

**External dependencies:**
- Supabase deployment (human OR CI/CD)
- Type generation (human runs CLI command)
- Canonical contract commitment (human git commit)

### Why External Dependency Is Problematic

**1. Breaks autonomy claim**

Factory cannot autonomously construct fresh Industry OS if human must:
1. Deploy schema to Supabase
2. Run type generation command
3. Commit generated types
4. THEN Factory can start

**This is 3 human interventions BEFORE Factory begins.**

**2. Creates deployment coupling**

Fresh Industry OS experimentation requires:
- Supabase project (local OR remote)
- Docker (for local Supabase)
- Network access (for remote Supabase)
- Supabase CLI installed

**Cannot experiment with Factory offline/standalone.**

**3. Delays validation feedback**

Manufacturing Phase 3 flow:

```
Schema created → Deploy required → ❌ BLOCKED
```

**Cannot validate Factory capability without external deployment step.**

---

## ROOT CAUSE ANALYSIS

### Why Does Factory Require database.types.ts?

**From evidence-collector.ts:**

```typescript
function collectGeneratedTypes(typesPath: string, entityPatterns: EntityNamePatterns): boolean {
  // Factory checks for generated types in database.types.ts
  // Uses types as evidence of canonical contract
}
```

**Purpose:** Verify canonical persistence has corresponding type contract.

**Rationale:** Type safety — domain implementation must match deployed schema.

**Problem:** Factory has no mechanism to establish this contract for fresh OS.

### Why Can't Factory Generate Types from Migrations?

**Technical reason:** Supabase `gen types` command uses database introspection, not DDL parsing.

**Command internals:**
```
supabase gen types → connects to PostgreSQL → introspects schema → generates TypeScript
```

**NOT:**
```
supabase gen types → reads migration files → parses DDL → generates TypeScript
```

**Why introspection (not DDL parsing)?**
- Deployed schema may differ from migration (constraints, indexes, triggers added separately)
- Schema may be modified via Dashboard
- Type generation must reflect **actual deployed state**, not migration intent

**Factory cannot replicate this without database connection.**

---

## SOLUTION SPACE

### Option A: Factory Owns Type Generation (Recommended)

**Approach:** Factory establishes canonical contract as part of pipeline.

**Implementation:**

```typescript
// Factory Phase 3.5: Canonical Contract Establishment

async function establishCanonicalContract(industryScope: string) {
  // Step 1: Deploy schema to local Supabase
  await deploySchemaLocally(industryScope);
  
  // Step 2: Generate types via Supabase CLI
  await generateTypes(industryScope);
  
  // Step 3: Verify types generated
  const typesExist = await verifyTypes(industryScope);
  
  if (!typesExist) {
    throw new Error('Canonical contract establishment failed');
  }
  
  return { status: 'CONTRACT_ESTABLISHED', typesPath: 'src/types/database.types.ts' };
}
```

**Pipeline becomes:**

```
Intent
  ↓
Schema Creation
  ↓
Canonical Contract Establishment ← [NEW]
  ↓
Evidence Collection
  ↓
Scope Derivation
  ↓
Construction Context
  ↓
Autonomous Construction
```

**Requirements:**
- Factory must manage local Supabase instance (Docker OR embedded)
- Factory must invoke Supabase CLI (OR replicate introspection logic)
- Factory must handle deployment errors/rollback

**Pros:**
- ✅ Factory becomes truly autonomous for fresh OS
- ✅ Aligns with stated Factory mission
- ✅ Removes human intervention requirement
- ✅ Enables offline/standalone Factory operation

**Cons:**
- ⚠️ Adds complexity (database management)
- ⚠️ Requires Supabase dependency in Factory
- ⚠️ May need infrastructure (Docker, ports, cleanup)

---

### Option B: Accept External Boundary (Not Recommended)

**Approach:** Document that Factory requires pre-established canonical contract.

**Revised Factory scope:**

> **Factory autonomously constructs Industry OS GIVEN established canonical contract (schema + types).**

**Pipeline becomes:**

```
[EXTERNAL] Schema Creation
[EXTERNAL] Deploy + Type Generation
[EXTERNAL] Commit database.types.ts
     ↓
[FACTORY] Evidence Collection
     ↓
[FACTORY] Scope Derivation
     ↓
[FACTORY] Construction Context
     ↓
[FACTORY] Autonomous Construction
```

**Pros:**
- ✅ Simple (no Factory changes)
- ✅ Leverages existing Supabase tooling
- ✅ Clear separation of concerns

**Cons:**
- ❌ Factory NOT autonomous for fresh OS
- ❌ Contradicts stated Factory mission
- ❌ 3 human interventions required before Factory starts
- ❌ Cannot experiment with Factory standalone
- ❌ Phase 3 validation blocked without external setup

---

### Option C: Hybrid Approach

**Approach:** Factory auto-establishes contract for local validation, but production uses external pipeline.

**Factory modes:**

**Development/Validation Mode:**
- Factory spins up local Supabase
- Factory deploys schema
- Factory generates types
- Factory proceeds with construction
- (Standalone, no human intervention)

**Production Mode:**
- Schema deployed via CI/CD
- Types generated via deployment pipeline
- Factory consumes pre-established contract
- (Leverages production infrastructure)

**Pros:**
- ✅ Factory autonomous for Phase 3 validation
- ✅ Production uses proven deployment pipeline
- ✅ Best of both worlds

**Cons:**
- ⚠️ Two code paths (complexity)
- ⚠️ May introduce dev/prod parity issues

---

## RECOMMENDATION

**Adopt Option A: Factory Owns Type Generation**

**Rationale:**

### 1. Aligns with Factory Mission

User directive (Phase 3):

> "Factory phải tự thực hiện: Discover canonical truth → Derive scope → Assemble construction context"

**"Tự thực hiện" cannot mean "human runs 3 commands first, THEN Factory starts."**

### 2. Enables True Autonomy

Factory Phase 2 objective:

> "One Industry OS intent should be sufficient for Factory to assemble the context a capable AI coding agent needs to independently build the correct system"

**Current reality:** "One intent + 3 human deployment steps + THEN Factory can start"

**NOT sufficient.**

### 3. Unblocks Phase 3 Validation

Manufacturing validation currently blocked at:

```
Schema created → ❌ No types → ❌ Evidence fails → ❌ Cannot proceed
```

**With contract establishment capability:**

```
Schema created → ✅ Types generated → ✅ Evidence succeeds → ✅ Proceed to construction
```

### 4. Proven Pattern

**Factory already manages complex capabilities:**
- Evidence collection (37 tests)
- Scope derivation (10 tests)
- Construction context assembly (~400 LOC)
- Governance orchestration (40 tests)

**Contract establishment complexity:** Similar scope (~200-300 LOC).

### 5. Manufacturing Field Test Validates Need

Phase 3 discovered this gap **through real experiment**, not theoretical design.

**This is evidence-driven architecture evolution** (Factory principle).

---

## IMPLEMENTATION SKETCH

```typescript
// scripts/governance/canonical-contract-establishment.ts

export async function establishCanonicalContract(
  industryScope: string,
  options: {
    mode: 'local' | 'remote';
    migrationsPath?: string;
  }
): Promise<ContractEstablishmentResult> {
  
  // Step 1: Verify migrations exist
  const migrations = discoverMigrations(industryScope, options.migrationsPath);
  if (migrations.length === 0) {
    return { status: 'NO_MIGRATIONS', reason: 'No migrations found for industry' };
  }
  
  // Step 2: Deploy to local Supabase (if needed)
  if (options.mode === 'local') {
    await ensureLocalSupabase(); // Start Docker if not running
    await deployMigrations(migrations);
  }
  
  // Step 3: Generate types via Supabase CLI
  const typesGenerated = await generateTypesFromDeployedSchema({
    mode: options.mode,
    output: 'src/types/database.types.ts',
  });
  
  if (!typesGenerated.success) {
    return { 
      status: 'GENERATION_FAILED', 
      reason: typesGenerated.error,
      recovery: 'Check Supabase connection and schema validity'
    };
  }
  
  // Step 4: Verify types contain industry entities
  const typesValid = await verifyGeneratedTypes(industryScope);
  if (!typesValid) {
    return {
      status: 'VALIDATION_FAILED',
      reason: 'Generated types do not contain expected industry entities'
    };
  }
  
  return {
    status: 'CONTRACT_ESTABLISHED',
    typesPath: 'src/types/database.types.ts',
    entitiesFound: typesValid.entities,
  };
}
```

**Integration into Factory Build CLI:**

```typescript
// scripts/governance/factory-build.ts

async function main() {
  const industry = process.argv[2];
  
  console.log('[1/4] Canonical Contract Establishment...'); // NEW STEP
  const contract = await establishCanonicalContract(industry, { mode: 'local' });
  
  if (contract.status !== 'CONTRACT_ESTABLISHED') {
    console.error(`❌ Contract establishment failed: ${contract.reason}`);
    process.exit(1);
  }
  
  console.log('[2/4] Evidence Collection...');
  const evidenceMap = await collectIndustryEvidence(industry, { ... });
  
  console.log('[3/4] Scope Derivation...');
  const scopeResults = deriveScope(evidenceMap);
  
  console.log('[4/4] Construction Context Assembly...');
  const contexts = assembleContexts(scopeResults);
  
  // ... rest of pipeline
}
```

---

## ALTERNATIVES CONSIDERED AND REJECTED

### 1. Modify Scope Derivation to Accept Migrations-Only

**Proposal:** Change scope derivation to allow RECONSTRUCT without generated types.

**Rejected because:**
- ❌ Weakens governance (types exist for type safety)
- ❌ Allows contract drift (migration ≠ deployed schema)
- ❌ Doesn't solve root problem (types still needed for domain implementation)

### 2. Manual Type Stubs for Testing

**Proposal:** Create minimal type stubs to unblock Phase 3.

**Rejected because:**
- ❌ Test-only workaround (not production solution)
- ❌ Stubs may not match actual schema
- ❌ Hides the real capability gap
- ❌ Makes Phase 3 validation meaningless

### 3. Skip Type Contract Requirement

**Proposal:** Factory doesn't require types, uses migration DDL directly.

**Rejected because:**
- ❌ Breaks Bella's type safety contract
- ❌ Domain implementation loses TypeScript safety
- ❌ Violates existing architectural principle (types = canonical contract)

---

## PHASE 3 MANUFACTURING STATUS

**Experiment Status:** BLOCKED AT CANONICAL CONTRACT ESTABLISHMENT

**What Was Accomplished:**
- ✅ Canonical schema created (6 entities, 7 tables)
- ✅ RLS policies defined
- ✅ Indexes created
- ✅ Prefix convention validated (manufacturing_ not mfg_)

**What Was Blocked:**
- ❌ Type generation (requires deployed database)
- ❌ Evidence collection (requires types)
- ❌ Scope derivation (requires evidence)
- ❌ Construction context assembly (requires scope)
- ❌ Autonomous construction (never reached)

**Human Interventions:** 0 (correctly refused to bypass governance)

**Factory Governance:** ✅ CORRECT (blocked without canonical contract)

**Finding:** Factory capability gap, not Phase 2/3 failure.

---

## NEXT STEPS

**Recommendation:** Implement Canonical Contract Establishment (Option A)

**Implementation Plan:**

### Phase 3.5: Contract Establishment Capability

**Scope:** ~300 LOC, 1-2 days

**Components:**
1. Local Supabase management (Docker interface)
2. Migration deployment automation
3. Type generation via Supabase CLI
4. Contract verification

**Tests:**
- Supabase startup/shutdown
- Migration deployment (success/failure)
- Type generation (success/failure)
- Contract validation

### Phase 3 Retry: Manufacturing Construction

**After Phase 3.5 complete:**
- Run Factory Build with contract establishment
- Verify types generated automatically
- Proceed with Evidence → Scope → Context pipeline
- Validate autonomous construction

**Success Criteria:**
- 0 human interventions from "Build Manufacturing OS" to construction contexts
- Types generated automatically
- Evidence collection succeeds
- Scope derivation produces RECONSTRUCT decisions
- Construction contexts generated

---

## CONCLUSION

**Finding:** Factory has capability gap in Canonical Contract Establishment.

**Classification:** Architectural gap, not governance failure or Phase 2/3 defect.

**Impact:** Factory cannot autonomously construct fresh Industry OS without human deployment intervention.

**Recommendation:** Implement Contract Establishment as native Factory capability (Option A).

**Rationale:** Aligns with Factory mission, enables true autonomy, unblocks Phase 3 validation.

**Status:** Investigation complete, awaiting implementation decision.

---

**Investigation Date:** 2026-09-05  
**Finding:** CAPABILITY GAP IDENTIFIED  
**Next:** User decision on implementation approach
