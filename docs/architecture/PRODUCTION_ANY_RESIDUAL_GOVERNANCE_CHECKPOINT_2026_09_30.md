# Production Any Residual Governance Checkpoint

Ngay 2026-09-30

## Trang thai

STATUS: SEALED / STOPPED AT GOVERNANCE / CONTRACT BOUNDARY

Sau Integration I1 va Partner Admin PA1:

```text
Production any baseline
59 / 22 files
 ↓ Integration I1  -15 / -10 files
44 / 12 files
 ↓ Partner Admin PA1 -10 / -2 files
34 / 10 files
```

Partner Admin:

```text
0 violations
0 files
```

Integration Hub / Runtime:

```text
0 violations
0 files
```

## Final Gate Snapshot

`check:any-types`:

```text
npm run check:any-types
FAIL

Total Files Scanned: 2785
Total Lines Scanned: 837,122
Files with Violations: 144
Total Violations: 606
```

Interpretation:

- This is the current full repository gate state, not a PASS.
- It includes test/mock debt and other out-of-scope areas beyond the production residual classified in this checkpoint.
- No further production cleanup is authorized by this checkpoint.

Production runtime invariant:

```text
npx jest src/__tests__/invariants/production-runtime-integrity.test.ts --runInBand
FAIL

INVARIANT 1: Found 34 unapproved production any usages
INVARIANT 3: next.config.ts has ignoreBuildErrors: true
```

Interpretation:

- The 34 production any usages are exactly the residual listed below.
- `ignoreBuildErrors: true` remains a separate build-integrity baseline and is not fixed here.
- This result is EXPECTED FAIL / VERIFIED BLOCKER, not PASS.

## Residual Current Scan

```text
34 violations / 10 files
```

### Real Estate Residual - 3

```text
src/platform/real-estate/repositories/property-unit.repository.ts:95
unitCode: (data as any).unit_code || data.product_code || '',

src/platform/real-estate/repositories/property-unit.repository.ts:146
unitCode: (item as any).unit_code || item.product_code || '',

src/platform/real-estate/engines/reservation.service.ts:91
status: 'cancelled' as any,
```

Classification:

- Generated Database drift / product contract mismatch.
- `unit_code` exists in some schema evidence but not in current generated `Database` row contract.
- Reservation status has semantic mismatch between `cancelled` and generated/current Real Estate status contract.

Action:

- DEFER.
- Requires canonical contract decision before code cleanup.
- No fake interface, no generated type patch, no double cast.

### Logistics Frozen / Domain Contract - 29

```text
src/platform/logistics/warehouse/receipt.service.ts:1038
status: row.status as any,

src/platform/logistics/warehouse/receipt.service.ts:1061
discrepancy_status: row.discrepancy_status as any,

src/platform/logistics/warehouse/receipt.service.ts:1062
uom: row.uom as any,

src/platform/logistics/warehouse/receipt.service.ts:1209
} catch (error: any) {

src/platform/logistics/warehouse/receipt.service.ts:1323
} catch (error: any) {

src/platform/logistics/warehouse/receipt.service.ts:1401
} catch (error: any) {

src/platform/logistics/warehouse/receipt.service.ts:1666
} catch (error: any) {

src/platform/logistics/warehouse/receipt.service.ts:1744
const sku = row.logistics_warehouse_skus as any;

src/platform/logistics/warehouse/receipt.service.ts:1778
} catch (error: any) {

src/platform/logistics/warehouse/receipt.service.ts:1887
} catch (error: any) {

src/platform/logistics/repositories/movement.repository.ts:176
const movements = data.map((row: any) => this.mapToDomain(row));

src/platform/logistics/repositories/movement.repository.ts:240
const saved = data.map((row: any) => this.mapToDomain(row));

src/platform/logistics/repositories/movement.repository.ts:255
private mapToDomain(row: any): InventoryMovement {

src/platform/logistics/engines/freight-audit-engine.ts:821
? (shipment.origin as any).city || (shipment.origin as any).zip || 'UNKNOWN'

src/platform/logistics/engines/freight-audit-engine.ts:824
? (shipment.destination as any).city || (shipment.destination as any).zip || 'UNKNOWN'

src/platform/logistics/engines/freight-audit-engine.ts:829
? (shipment.total_weight as any).value || 0

src/platform/logistics/engines/freight-audit-engine.ts:1295
shipment: any,

src/platform/logistics/engines/freight-audit-engine.ts:2463
charge_type: row.charge_type as any,

src/platform/logistics/domain/rules/rule.types.ts:110
input: Record<string, any>;

src/platform/logistics/domain/rules/rule.types.ts:113
output: any;

src/platform/logistics/domain/rules/rule.types.ts:116
metadata?: Record<string, any>;

src/platform/logistics/domain/rules/rule.helpers.ts:105
input: Record<string, any>,

src/platform/logistics/domain/rules/rule.helpers.ts:106
output: any,

src/platform/logistics/domain/rules/rule.helpers.ts:107
metadata?: Record<string, any>

src/platform/logistics/domain/rules/rule.composition.ts:49
context: any;

src/platform/logistics/domain/rules/rule.composition.ts:138
.map(r => (r as any).violation);

src/platform/logistics/domain/rules/compliance.evaluation.ts:31
rules: Rule<any>[];

src/platform/logistics/domain/rules/compliance.evaluation.ts:37
additionalContext?: Record<string, any>;

src/platform/logistics/domain/rules/compliance.evaluation.ts:219
.map(r => (r as any).violation as ViolationDetail);
```

Classification:

- Logistics OS frozen/domain-contract boundary.
- E7.1/E7.2/E7.3 sealed scope.

Action:

- DEFER.
- Requires Logistics governance / ACR if code must change.
- Do not continue under this campaign.

### Finance/Core-Adjacent - 2

```text
src/platform/finance/resolvers/kernel-client.service.ts:73
kernelRequest.lines.map((line: any) => ({

src/platform/finance/resolvers/kernel-client.service.ts:132
private async convertToKernelRequest(instruction: PostingInstruction): Promise<any> {
```

Classification:

- Finance/Core-adjacent resolver boundary.
- Needs contract evidence for kernel request/response shape.

Action:

- DEFER.
- Do not change as part of Partner Admin / Integration cleanup.

## Decision

Campaign stops here because all remaining production `any` usages are outside the allowed safe cleanup scope:

- Logistics frozen: explicitly out of scope.
- Finance/Core-adjacent: explicitly out of scope.
- Real Estate residual: canonical contract mismatch, requires governance/contract decision.

No suppression, no fake contract, no `as unknown as`, no generated type patch.

## Seal

This checkpoint is sealed as a governance boundary, not as a zero-violation gate.

```text
FIXABLE / PROVEN LOCAL PRODUCTION ANY DEBT = 0
UNKNOWN PRODUCTION RESIDUAL                = 0
GOVERNANCE / CONTRACT RESIDUAL             = 34
```

Next work must be opened as separate scoped campaigns only:

- Logistics frozen cleanup via Logistics governance / ACR.
- Real Estate contract drift reconciliation.
- Finance/Core resolver contract campaign.
- Build integrity campaign for `ignoreBuildErrors`.
- Separate non-production/test `check:any-types` batches if desired.
