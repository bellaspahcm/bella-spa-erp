# Phase 3C E2E Runtime Tests

End-to-end tests for Bella Runtime v1.1 (Phase 3C).

## Test Categories

| Category | Description | Status |
|----------|-------------|--------|
| 3C-1 | Happy Path E2E | ⏳ Week 2 |
| 3C-2 | Idempotent Replay | ⏳ Week 2-3 |
| 3C-3 | Cross-Tenant Attack | ⏳ Week 3 |
| 3C-4 | Validation Attack | ⏳ Week 3 |
| 3C-5 | Outbox Failure | ⏳ Week 4 |
| 3C-6 | Retry & Recovery | ⏳ Week 4 |
| 3C-7 | Quarantine Workflow | ⏳ Week 4 |
| 3C-8 | Audit Provenance | ⏳ Week 4 |
| 3C-9 | Finance OS Boundary | ⏳ Week 4 |
| 3C-10 | End-to-End Invariants | ⏳ Week 5 |

## Environment Setup

### Required Environment Variables

Phase 3C requires additional environment variables compared to Phase 3B:

```bash
# Supabase Connection (same as Phase 3B)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT Secret (NEW for Phase 3C)
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

### How to Get SUPABASE_JWT_SECRET

1. Go to Supabase Dashboard
2. Navigate to Project Settings → API
3. Find "JWT Secret" under "JWT Settings"
4. Copy the secret to `.env.local`

**Security Note:** JWT secret is highly sensitive. Never commit to git.

### Difference from Phase 3B

| Aspect | Phase 3B | Phase 3C |
|--------|----------|----------|
| **Authentication** | `service_role` key | `anon` key + tenant JWT |
| **RLS** | Bypassed | Enforced |
| **Tenant Context** | Repository-level | JWT claim-level |
| **Security Testing** | NOT tested | Cross-tenant attacks tested |

## Running Tests

### Infrastructure Verification (Week 1)

```bash
npm run test:runtime:3c:infra
```

Verifies:
- JWT generation works
- Authenticated clients created
- Test tenants exist
- RLS policies enabled
- Finance OS mock functional

### Full E2E Suite (Week 2+)

```bash
npm run test:runtime:3c
```

### Watch Mode

```bash
npm run test:runtime:3c:watch
```

## Test Infrastructure

### JWT Helper

Located at `tests/utils/test-jwt-helper.ts`.

**Usage:**
```typescript
import { createAuthenticatedClient } from '../../utils/test-jwt-helper';

const client = createAuthenticatedClient('tenant-a');
// All queries now run with tenant-a JWT claims + RLS enforcement
```

### Finance OS Mock

Located at `tests/utils/finance-os-mock.ts`.

**Usage:**
```typescript
import { financeOSMock } from '../../utils/finance-os-mock';

// Configure response behavior
financeOSMock.setConfig({ responseMode: 'accept' });

// Emit intent
const response = await financeOSMock.emitIntent(intent);

// Verify emission
expect(financeOSMock.wasIntentEmitted(correlationId, tenantId)).toBe(true);
```

### E2E Fixtures

Located at `tests/utils/e2e-fixtures.ts`.

**Usage:**
```typescript
import { createTestIntent, HEALTHCARE_INTENTS, E2E_TENANTS } from '../../utils/e2e-fixtures';

// Generic intent
const intent = createTestIntent({ tenantId: E2E_TENANTS.TENANT_A.tenantId });

// Healthcare-specific
const patientRevenue = HEALTHCARE_INTENTS.PATIENT_REVENUE('tenant-a', 500.00);
```

## Test Isolation

### Tenant Fixtures

Phase 3C uses dedicated test tenants:
- `test-e2e-tenant-a` (normal user)
- `test-e2e-tenant-b` (normal user)
- `test-e2e-tenant-attacker` (security tests)

### Cleanup Strategy

- **Before each test:** Clean up all E2E test data
- **After all tests:** Final cleanup
- **Scope:** Tenant-scoped cleanup preserves other test data

### Data Lifecycle

```typescript
beforeAll(async () => {
  context = setupE2ETest();
  await ensureTestTenantsExist(context.serviceRoleClient);
});

beforeEach(async () => {
  await cleanupAllE2EData(context.serviceRoleClient);
  financeOSMock.reset();
});

afterAll(async () => {
  await cleanupAllE2EData(context.serviceRoleClient);
});
```

## Debugging

### Enable Verbose Logging

```bash
DEBUG=runtime:* npm run test:runtime:3c
```

### Check JWT Token

```typescript
import { generateTenantJWT, verifyTenantJWT } from '../../utils/test-jwt-helper';

const token = generateTenantJWT({ tenantId: 'tenant-a' });
const payload = verifyTenantJWT(token);
console.log('JWT Payload:', payload);
```

### Verify RLS Policies

```typescript
import { verifyTenantIsolation } from '../../utils/e2e-test-setup';

const results = await verifyTenantIsolation(
  context.tenantAClient,
  'tenant-a',
  'tenant-b'
);

console.log('RLS Verification:', results);
```

## Known Limitations

### Phase 3C Scope

- **Finance OS is mocked:** Real Finance OS integration tested separately
- **Single-node execution:** No distributed Runtime testing
- **No performance testing:** Load/stress tests in Phase 4
- **No observability testing:** Metrics/tracing in Phase 4

### Test Environment

- **Supabase required:** Tests cannot run without live Supabase connection
- **RLS must be enabled:** Policies must exist in database
- **JWT secret required:** Cannot test authentication without secret

## Related Documents

- [Phase 3C Test Plan](../../../docs/architecture/BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md)
- [Runtime Architecture v1.1](../../../docs/architecture/BELLA_RUNTIME_ARCHITECTURE_V1.md)
- [Implementation Design v1.1](../../../docs/architecture/BELLA_RUNTIME_IMPLEMENTATION_DESIGN_V1.md)
- [Phase 3B Evidence](../../../docs/testing/BELLA_RUNTIME_PHASE_3B_EVIDENCE.md)

## Governance

**Phase 3C Status:** 🟢 OPEN (Week 1 — Infrastructure)

**Next Milestone:** Week 2 — Happy Path + Idempotency Tests

**Evidence Required:** Test execution results + RLS verification report

**Production Gate:** Phase 3C PASS + Phase 3D PASS → Production readiness
