# Platform Finance F3 AR — Versioning Policy

**Module**: Platform Finance F3 Accounts Receivable  
**Status**: v1.0.0 (FROZEN)  
**Owner**: Platform Finance Team  
**Governance**: Semantic Versioning

---

## Current Version

**v1.0.0** — Initial stable release (E0.1B-R Finance Remediation)

**Release Date**: 2026-09-12  
**Test Coverage**: 49/49 PASS

---

## Public Contract (Immutable)

### Interface

```typescript
export interface IF3AccountsReceivable {
  createDraftInvoice(input: CreateInvoiceInput): Promise<InvoiceResult>;
  addInvoiceLine(input: AddInvoiceLineInput): Promise<InvoiceResult>;
  finalizeInvoice(input: FinalizeInvoiceInput): Promise<InvoiceResult>;
  voidInvoice(input: VoidInvoiceInput): Promise<InvoiceResult>;
  getInvoice(input: GetInvoiceInput): Promise<InvoiceView>;
}
```

**Status**: **IMMUTABLE** — breaking changes require major version bump.

### Types (Public API)

```typescript
// Input types (v1.0.0)
CreateInvoiceInput
AddInvoiceLineInput
FinalizeInvoiceInput
VoidInvoiceInput
GetInvoiceInput

// Output types (v1.0.0)
InvoiceResult
InvoiceView
InvoiceHeader
InvoiceLine
ReceivablePosition
InvoiceStatus

// Error types (v1.0.0)
F3InvoiceNotFoundError
F3InvoiceNotDraftError
F3InvoiceNotFinalizedError
F3InvoiceNumberDuplicateError
F3InvoiceEmptyError
F3ZeroValueInvoiceError
F3InvalidRevenueAccountError
F3InvoiceHasAllocationsError
F3InvalidInputError
F3PostingFailedError
```

**Status**: **FROZEN** — field additions allowed (non-breaking), removals require major version bump.

---

## Semantic Versioning Rules

### MAJOR (x.0.0) — Breaking Changes

**Triggers**:
- Remove method from `IF3AccountsReceivable`
- Remove field from public input/output types
- Change method signature (parameter types, return type)
- Change error codes or semantics
- Remove exported type or error class

**Examples**:
```typescript
// ❌ BREAKING (requires v2.0.0)
interface IF3AccountsReceivable {
  // Removed: createDraftInvoice()
  addInvoiceLine(...): Promise<InvoiceResult>;
}

// ❌ BREAKING (requires v2.0.0)
type CreateInvoiceInput = {
  tenantId: string;
  // Removed: partyId (was required)
  invoiceNumber: string;
};
```

**Process**:
1. Document breaking change in `BREAKING_CHANGES.md`
2. Notify all Product teams (minimum 2 sprint notice)
3. Provide migration guide
4. Bump version to v2.0.0
5. Deprecate v1.x.x (support for 6 months)

### MINOR (1.x.0) — New Features (Non-Breaking)

**Triggers**:
- Add new method to `IF3AccountsReceivable`
- Add optional field to input/output types
- Add new error class
- Add new exported type

**Examples**:
```typescript
// ✅ NON-BREAKING (v1.1.0)
interface IF3AccountsReceivable {
  createDraftInvoice(...): Promise<InvoiceResult>;
  addInvoiceLine(...): Promise<InvoiceResult>;
  finalizeInvoice(...): Promise<InvoiceResult>;
  voidInvoice(...): Promise<InvoiceResult>;
  getInvoice(...): Promise<InvoiceView>;
  
  // NEW (optional feature)
  adjustInvoice?(input: AdjustInvoiceInput): Promise<InvoiceResult>;
}

// ✅ NON-BREAKING (v1.1.0)
type CreateInvoiceInput = {
  tenantId: string;
  partyId: string;
  invoiceNumber: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  
  // NEW (optional field)
  referenceNumber?: string;
};
```

**Process**:
1. Add feature with tests
2. Update documentation
3. Bump version to v1.x.0
4. Announce in release notes

### PATCH (1.0.x) — Bug Fixes (Non-Breaking)

**Triggers**:
- Fix internal engine implementation bug
- Fix error message formatting
- Performance optimization
- Documentation updates

**Examples**:
```typescript
// ✅ NON-BREAKING (v1.0.1)
// Fix: Engine incorrectly mapped F1 error codes
private mapError(error: any): Error {
  // Bug fix: check code === 'F3002' not 'F3003'
}

// ✅ NON-BREAKING (v1.0.2)
// Performance: optimize getInvoice query
private async getInvoiceLines(...) {
  // Add index hint for faster retrieval
}
```

**Process**:
1. Fix bug with test
2. Update CHANGELOG.md
3. Bump version to v1.0.x
4. Deploy immediately (no Product team notice required)

---

## Version History

### v1.0.0 (2026-09-12) — Initial Stable Release

**Features**:
- `IF3AccountsReceivable` interface (5 methods)
- Invoice lifecycle: DRAFT → FINALIZED → VOIDED
- F1 GL posting integration
- AR subledger + position management
- Party-native identity (`partyId`)
- Tenant isolation enforced
- 10 typed errors

**Tests**: 49/49 PASS
- Engine unit: 14/14
- Engine integration: 14/14
- Public exports: 10/10
- English Center billing: 11/11

**Evidence**: See `R6_FULL_VERIFICATION_REPORT.md`

---

## Deferred Features (Out of v1.0.0 Scope)

**NOT Included**:
- ❌ Payment allocation (F2 Cash incomplete)
- ❌ Adjustment memos (F2 Cash incomplete)
- ❌ Credit notes (requires F2 Cash)
- ❌ Installment scheduling (E1.1 Chain Management)
- ❌ Invoice templates/printing (E1.4 UI)

**Status**: May be added in v1.x.0 (minor versions) or v2.0.0 (if breaking).

---

## Deprecation Policy

### Deprecation Timeline

**Phase 1: Announcement** (Sprint N)
- Mark deprecated in JSDoc: `@deprecated since v1.5.0, use XYZ instead`
- Add console warning in development mode
- Update documentation with migration guide

**Phase 2: Grace Period** (6 months / 12 sprints)
- Old API continues to work
- New API available in parallel
- Teams migrate at their own pace

**Phase 3: Removal** (Next major version)
- Remove deprecated API in v2.0.0
- Old code breaks (compile error)
- Teams must have migrated by now

### Example

```typescript
// v1.5.0: Deprecate old signature
/**
 * @deprecated since v1.5.0, use createInvoiceV2 with installment support
 */
createDraftInvoice(input: CreateInvoiceInput): Promise<InvoiceResult>;

// v1.5.0: Add new signature (parallel)
createInvoiceV2(input: CreateInvoiceInputV2): Promise<InvoiceResult>;

// v2.0.0: Remove old signature
// createDraftInvoice() → REMOVED
createInvoiceV2(input: CreateInvoiceInputV2): Promise<InvoiceResult>;
```

---

## Internal Implementation (Private)

**NOT Versioned**:
- `F3AccountsReceivableEngine` class (private implementation)
- Internal helpers: `mapInvoiceHeader()`, `buildF1Payload()`, etc.
- RPC wrappers (internal only)
- DB schema mapping

**Freedom**: Engine internals can change freely without version bump (as long as public contract unchanged).

---

## Governance

### Ownership

**Platform Finance Team**:
- Contract interface changes (requires review)
- Major/minor version bumps (requires approval)
- Deprecation decisions (requires Product team consultation)

**Product Teams** (English Center, etc.):
- Feature requests (submit via issue)
- Bug reports (submit via issue)
- Breaking change feedback (mandatory consultation period)

### Change Process

**1. Proposal**:
- Submit RFC (Request for Comments) with:
  - Problem statement
  - Proposed solution
  - Breaking vs non-breaking analysis
  - Migration guide (if breaking)

**2. Review**:
- Platform Finance team reviews
- Product teams provide feedback (7-day minimum)
- Architecture team approves breaking changes

**3. Implementation**:
- Implement with tests (must maintain 49/49 PASS)
- Update documentation
- Bump version per semantic versioning rules

**4. Release**:
- Tag release in git: `platform-finance-v1.x.x`
- Update CHANGELOG.md
- Announce in team channels
- Deploy via CI/CD

---

## CI/CD Integration

### Pre-Merge Checks

**Required**:
- ✅ All 49 regression tests PASS
- ✅ Build PASS (TypeScript compilation)
- ✅ Lint PASS
- ✅ Architecture guard PASS (no direct DB/RPC access from Product)

**Blocking**: PR cannot merge if any check fails.

### Version Bump Automation

```yaml
# .github/workflows/version-bump.yml
on:
  push:
    paths:
      - 'src/platform/finance/contracts/f3-ar.contract.ts'

jobs:
  check-breaking-changes:
    - name: Detect breaking changes
      run: npm run check-contract-diff
    - name: Require major version bump if breaking
      if: breaking_detected
      run: exit 1 # Block merge
```

---

## Contact

**Questions**: Platform Finance team (#platform-finance Slack)  
**Bug Reports**: GitHub Issues (`platform-finance` label)  
**Feature Requests**: RFC process  
**Breaking Change Consultation**: Architecture review board

---

**Version**: v1.0.0  
**Last Updated**: 2026-09-12  
**Status**: FROZEN (immutable public contract)
