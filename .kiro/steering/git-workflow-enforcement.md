---
name: Git Workflow Constitution Enforcement
description: Enforces single-scope PR discipline and Kernel protection
inclusion: always
---

# Git Workflow Constitution — AI Enforcement Layer

**MANDATORY:** You MUST enforce these rules for ALL code changes.

## Rule 1: Single-Scope Mandate

**Each PR modifies EXACTLY ONE:**
- One product vertical (e.g., English Center OR Bella Land, not both)
- OR platform infrastructure only
- OR documentation/tooling only

### Detection
```typescript
// Analyze file paths
const scopes = detectProductScopes(changedFiles);

if (scopes.length > 1) {
  // BLOCK: Multi-scope contamination
  throw new Error(`Multi-scope detected: ${scopes.join(' + ')}`);
}
```

### Enforcement Actions

**BEFORE writing code:**
1. Read user request
2. Identify which product(s) would be affected
3. If multiple products:
   - STOP immediately
   - Inform user: "This change affects multiple products. Split into separate PRs?"
   - Guide creation of focused PRs

**DURING implementation:**
1. Track file paths being modified
2. If scope creep detected:
   - STOP current work
   - Suggest moving out-of-scope changes to separate branch

**BEFORE creating PR:**
1. Verify all changed files belong to ONE scope
2. Use branch naming: `product/{product-name}/*` or `platform/{subsystem}/*`
3. Fill PR template with explicit scope declaration

## Rule 2: Kernel Freeze Protection

**Healthcare Kernel (H1-H12) is FROZEN**
**Logistics Kernel (E7.1-E7.3) is SEALED**

### Blocked Paths
```
src/platform/healthcare/engines/    (H1-H12)
src/platform/logistics/             (E7.1-E7.3)
```

### Enforcement Actions

**IF user requests changes to frozen Kernel:**
1. STOP immediately
2. Output: "ARCHITECTURAL GAP DETECTED"
3. Explain: "This requires Architecture Change Request (ACR)"
4. Do NOT write code
5. Document gap in `docs/architecture/acr/ACR-{YYYYMMDD}-{topic}.md`

**NEVER:**
- Create new Kernel engines (e.g., "H13")
- Modify existing Kernel entities
- Bypass Public Contracts

## Rule 3: Size Discipline

**File count >100 requires justification**

### Enforcement Actions

**BEFORE creating large PRs:**
1. Count affected files
2. If >100:
   - Ask user: "This will be a large PR. Is this migration/generated code?"
   - If NO: Suggest feature decomposition
   - If YES: Document in PR description

**Valid exceptions:**
- Database migrations + seed data
- OpenAPI/GraphQL codegen
- Contract changes requiring coupled updates

## Rule 4: Branch Naming

**Format:** `{scope}/{descriptive-name}`

**Valid:**
- `product/english-center/student-enrollment`
- `platform/org-unit/hierarchy-cache`
- `infra/ci-architecture-gates`

**Invalid:**
- `feature/multi-product-sync` (ambiguous scope)
- `john/quick-fix` (personal prefix)

### Enforcement Actions

**BEFORE creating branch:**
1. Parse requested change
2. Determine correct scope prefix
3. Generate semantic name
4. Use: `gh pr create --head {scope}/{name}`

## Rule 5: PR Template Compliance

**Required sections:**

```markdown
## Product Scope Declaration
- Primary Product: [Name or "None"]
- Secondary Products: [Must be "None" or have exception]
- Platform Kernel: [Yes/No - if Yes, requires ACR]
- Exception Required: [Yes/No]

## Changes Summary
[What changed and why]

## Testing Evidence
[Proof of validation]

## Exception Justification
[Required if: multi-scope, >100 files, Kernel modification]
```

### Enforcement Actions

**BEFORE gh pr create:**
1. Generate PR body with template filled
2. Validate scope declaration matches actual files
3. If mismatch: Reject and require correction

## Rule 6: Pre-PR Validation

**Run BEFORE pushing to remote:**

```bash
# Check 1: Scope analysis
npm run git:check-scope

# Check 2: Architecture Guard
npm run healthcare:verify  # if healthcare files
npm run logistics:verify    # if logistics files

# Check 3: File count
git diff --name-only main...HEAD | wc -l
```

### Enforcement Actions

**IF validation fails:**
1. Display exact failure reason
2. BLOCK push
3. Guide remediation
4. Do NOT suggest bypasses

## Workflow Integration

### GitHub Actions: "Validate PR Scope"

**Runs on:** Every PR to `main`

**Your role:** Explain results to user

- ✅ SUCCESS: Scope clean, proceed
- ⚠️ WARNING: Review needed, explain why
- ❌ FAILURE: Blocked, guide splitting PR

### Branch Cleanup

**Runs on:** PR merge

**Your role:** Confirm branch deletion expected

## Exception Protocol

### Valid Exceptions

**1. Contract Changes (Platform + Product)**

```typescript
// Example: Adding Kernel capability with consuming product
Files:
  src/platform/org-unit/org-unit.engine.ts      (contract)
  src/products/english-center/branch.service.ts (consumer)

Justification: "Contract coupling - cannot safely split"
```

**2. Migrations**

```typescript
// Example: Schema + seed data
Files:
  migrations/20260913_add_user_roles.sql  (80 files)
  seeds/roles.json                        (40 files)

Justification: "Migration requires seed data for integrity"
```

**3. Generated Code**

```typescript
// Example: OpenAPI update
Files:
  api/openapi.yaml                   (1 file changed)
  src/types/generated/*.ts           (150 files generated)

Justification: "Auto-generated from spec"
```

### Requesting Exception

**IF user has valid exception:**
1. Confirm it matches valid patterns above
2. Guide explicit documentation in PR
3. Explain check will show ⚠️ WARNING (not BLOCK)
4. Require architect review

**IF exception invalid:**
1. Refuse to proceed
2. Explain why it doesn't qualify
3. Guide proper decomposition

## Common Scenarios

### Scenario 1: User requests "Update both English Center and Bella Land"

**Response:**
```
This affects 2 products and violates Single-Scope Mandate.

I'll create 2 separate PRs:
1. product/english-center/[feature]
2. product/bella-land/[feature]

Which should I start with?
```

### Scenario 2: User wants to "fix typo in Kernel while working on product"

**Response:**
```
Kernel modification detected in frozen subsystem.

Options:
1. Skip Kernel change for now (recommended)
2. Create separate platform/* PR for Kernel fix
3. File Architecture Change Request if Kernel behavior change needed

Which do you prefer?
```

### Scenario 3: PR blocked by workflow

**Response:**
```
GitHub Action "Validate PR Scope" failed.

Reason: [Parse failure message]

Resolution:
[Specific steps to fix]

I can help split this PR correctly.
```

## Success Metrics

**You are successful when:**
- 0 multi-scope PRs created
- 0 Kernel freeze violations
- 100% PR template compliance
- Clean scope detection by GitHub Actions

**You failed when:**
- Multi-scope PR merged
- Kernel modified without ACR
- PR blocked due to preventable contamination

---

**Authority:** Git Workflow Constitution v1.0.0  
**Scope:** ALL code changes in repository  
**Exceptions:** Only via explicit Architecture Council approval
