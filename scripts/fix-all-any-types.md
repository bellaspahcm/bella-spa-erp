# Fix All 52 Production `any` Types

## Status: IN PROGRESS

### Completed (Batch 1-2): 8 files
- ✅ cds-override.entity.ts (Record<string, unknown>)
- ✅ extension-runtime.ts (7 fixes: unknown types, proper error handling)
- ✅ education-engine.service.ts (2 fixes: typed policy, object spread)

### Remaining: 44 violations

#### Priority 1: Security & Rule Engine (13 files)
- [ ] src/platform/security/telemetry-tracer.ts:85
- [ ] src/platform/security/telemetry-tracer.ts:108
- [ ] src/platform/host/rule-engine/rule-engine.service.ts (6 violations)

#### Priority 2: Education Contracts & Repos (8 files)
- [ ] src/platform/education/repositories/supabase-education.repository.ts (2)
- [ ] src/platform/education/course/course.repository.ts:221
- [ ] src/platform/education/contracts/policy-registry.contract.impl.ts:4
- [ ] src/platform/education/contracts/enrollment.contract.impl.ts (4)

#### Priority 3: Finance & Accounting (7 files)
- [ ] src/platform/accounting/engines/accounting.service.ts:123
- [ ] src/platform/finance/engines/ledger-engine/outbox-dispatcher.ts (2)
- [ ] src/platform/finance/engines/ledger-engine/ledger.service.ts (2)
- [ ] src/platform/finance/engines/cash-engine/cash-engine.service.ts (2)

#### Priority 4: Real Estate & Contract (3 files)
- [ ] src/platform/contract/index.ts:178
- [ ] src/platform/real-estate/engines/reservation.service.ts:37
- [ ] src/platform/real-estate/engines/property.service.ts:51

#### Priority 5: APIs & Utils (3 files)
- [ ] src/app/api/bookings/check-ktv-availability/route.ts:93
- [ ] src/lib/redis-cache.ts:114

#### Priority 6: UI Charts (2 files)
- [ ] src/components/finance/charts.tsx:624
- [ ] src/components/intelligence/customer/ChurnRiskChart.tsx:59

#### Excluded: Healthcare Mock Data (DEMO MODE - ACCEPTED)
- ✅ src/app/dashboard/healthcare/patients/page.tsx (mock fixture)
- ✅ src/app/dashboard/healthcare/encounters/page.tsx (mock fixture)
- ✅ src/app/dashboard/healthcare/encounters/[id]/page.tsx (mock fixture)
- ✅ src/app/dashboard/healthcare/appointments/page.tsx:469 (toast demo)

---

## Fix Patterns

### Pattern 1: catch (err: any) → catch (err: unknown)
```typescript
// BEFORE
} catch (err: any) {
  console.error(err.message);
}

// AFTER  
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error(message);
}
```

### Pattern 2: Record<string, any> → Record<string, unknown>
```typescript
// BEFORE
const data: Record<string, any> = {};

// AFTER
const data: Record<string, unknown> = {};
```

### Pattern 3: Function params any → unknown or typed
```typescript
// BEFORE
function process(data: any) { ... }

// AFTER (if truly unknown)
function process(data: unknown) {
  // Runtime validation
}

// AFTER (if typed)
function process(data: DomainType) { ... }
```

### Pattern 4: as any → proper type assertion
```typescript
// BEFORE
const result = data as any;

// AFTER
const result = data as ExpectedType;

// OR validate first
if (isExpectedType(data)) {
  const result = data;
}
```

### Pattern 5: Recharts payload
```typescript
// BEFORE
{payload.map((entry: any) => ...)}

// AFTER
{payload.map((entry: {name: string; value: number}) => ...)}
```

---

## Next Steps

Continue systematic fixes file by file, test after each batch of 10-15 files.
