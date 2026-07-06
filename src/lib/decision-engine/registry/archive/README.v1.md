# Policy Registry - Enterprise-Grade v2.0

Policy Registry for the Bella ERP Decision Engine. Manages policy lifecycle, governance, statistics, and audit trails.

## Architecture

```
PolicyRegistry (Façade)
│
├── PolicyRepository (Data Access Layer)
│   ├── CRUD operations
│   ├── Multi-version queries
│   └── Soft delete
│
├── PolicyLifecycleService (Status Transitions)
│   ├── publish() - draft → active
│   ├── deprecate() - active → deprecated
│   ├── archive() - deprecated → archived
│   ├── activate() - deprecated → active
│   └── softDelete() - any → deleted
│
├── PolicyGovernanceService (Compliance)
│   ├── checkGovernance()
│   ├── checkPublishEligibility()
│   ├── updateGovernance()
│   └── getPoliciesNeedingReview()
│
├── PolicyStatisticsService (Metrics)
│   ├── recordDecision() - atomic Postgres function
│   ├── getStatistics()
│   └── getTopPolicies()
│
├── PolicyAuditService (Audit Trail)
│   ├── logChange()
│   ├── getHistory()
│   └── queryAuditTrail()
│
└── RBAC (Permission Checking)
    ├── hasPermission()
    ├── checkPermission()
    └── enforceXxxPermission()
```

## Key Features

### ✅ Multi-Version Support
- Composite key: `(policy_id, version)`
- Only one version can be `is_active = true`
- Parent version tracking for lineage

### ✅ Atomic Statistics
- Uses Postgres function `increment_policy_statistics()`
- No race conditions
- Non-blocking (failures don't break decisions)

### ✅ Complete Audit Trail
- All changes logged to `policy_history`
- Compliance-ready (SOC 2, GDPR)
- Field-level change tracking

### ✅ Governance Validation
- Business/technical owner required for publishing
- Review date and expiry tracking
- Department ownership

### ✅ RBAC Integration
- Permission checks before all write operations
- Three roles: admin, manager, user
- Fine-grained permissions (create, publish, deprecate, archive, delete, etc.)

### ✅ Soft Delete
- Uses `deleted_at` column
- All queries filter `WHERE deleted_at IS NULL`
- Audit trail preserved

### ✅ Status Lifecycle
```
draft → active → deprecated → archived
         ↑          ↓
         └──────────┘ (reactivate)
```

## Database Schema

### `policy_registry` Table
```sql
CREATE TABLE policy_registry (
  id UUID PRIMARY KEY,
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
  category TEXT,
  tenant_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  parent_version TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  published_by TEXT,
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Soft Delete
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  
  -- Governance
  owner_department TEXT,
  business_owner TEXT,
  business_owner_email TEXT,
  technical_owner TEXT,
  technical_owner_email TEXT,
  review_date DATE,
  effective_date DATE,
  expire_date DATE,
  
  -- Config
  config JSONB,
  metadata JSONB,
  
  -- Composite unique key
  UNIQUE (policy_id, version)
);

-- Only one active version per policy
CREATE UNIQUE INDEX idx_policy_active 
ON policy_registry (policy_id) 
WHERE is_active = true AND deleted_at IS NULL;
```

### `policy_history` Table
```sql
CREATE TABLE policy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT
);
```

### `policy_statistics` Table
```sql
CREATE TABLE policy_statistics (
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  total_decisions INTEGER NOT NULL DEFAULT 0,
  total_approvals INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  confidence_sum NUMERIC(10, 2) NOT NULL DEFAULT 0,
  confidence_count INTEGER NOT NULL DEFAULT 0,
  last_decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_id, version)
);
```

## Usage Examples

### 1. Register a New Policy

```typescript
import { PolicyRegistry } from '@/lib/decision-engine/registry';

const policy = await PolicyRegistry.register(
  {
    policy: {
      id: 'leave-approval',
      version: '1.0.0',
      name: 'Leave Approval Policy',
      rules: [/* ... */],
    },
    category: 'leave',
    tenantId: 'bella-spa-hcm',
    businessOwner: 'HR Manager',
    businessOwnerEmail: 'hr@bella.vn',
    technicalOwner: 'John Doe',
    technicalOwnerEmail: 'john@bella.vn',
    ownerDepartment: 'HR',
    reviewDate: '2026-12-31',
    effectiveDate: '2026-01-01',
    expireDate: '2027-12-31',
  },
  userId
);
```

### 2. Publish a Policy

```typescript
const published = await PolicyRegistry.publish(
  'leave-approval',
  '1.0.0',
  userId,
  'Initial production release'
);
// Automatically deactivates other versions
// Validates governance before publishing
// Logs to audit trail
```

### 3. Get Active Version

```typescript
const active = await PolicyRegistry.getActive('leave-approval');
// Returns the currently active version
// Used by Decision Engine for execution
```

### 4. Record Decision Statistics

```typescript
await PolicyRegistry.recordDecision(
  'leave-approval',
  '1.0.0',
  'approve',
  0.95, // confidence
  45    // latency in ms
);
// Non-blocking - failures don't throw
// Uses atomic Postgres function
```

### 5. Check Governance

```typescript
const check = await PolicyRegistry.checkGovernance('leave-approval', '1.0.0');

if (!check.passed) {
  console.error('Governance errors:', check.errors);
  console.warn('Governance warnings:', check.warnings);
}
```

### 6. Deprecate a Policy

```typescript
const deprecated = await PolicyRegistry.deprecate(
  'leave-approval',
  '1.0.0',
  userId,
  'Replaced by v2.0.0 with new rules'
);
// Requires 10+ character reason
// Deactivates the version
// Logs to audit trail
```

### 7. View Audit History

```typescript
const history = await PolicyRegistry.getHistory('leave-approval', '1.0.0', userId);

history.forEach(entry => {
  console.log(`${entry.action} by ${entry.createdBy} at ${entry.createdAt}`);
  console.log(`  Field: ${entry.fieldChanged}`);
  console.log(`  Old: ${JSON.stringify(entry.oldValue)}`);
  console.log(`  New: ${JSON.stringify(entry.newValue)}`);
  console.log(`  Reason: ${entry.reason}`);
});
```

### 8. Get Statistics

```typescript
const stats = await PolicyRegistry.getStatistics('leave-approval', '1.0.0', userId);

console.log(`Total decisions: ${stats.totalDecisions}`);
console.log(`Approval rate: ${stats.approvalRate}%`);
console.log(`Average confidence: ${stats.avgConfidence}`);
```

### 9. List Policies with Filters

```typescript
const result = await PolicyRegistry.list({
  status: 'active',
  category: 'leave',
  ownerDepartment: 'HR',
  needsReview: true,
  limit: 20,
  offset: 0,
});

console.log(`Found ${result.total} policies`);
result.policies.forEach(p => {
  console.log(`${p.name} v${p.version} - ${p.status}`);
});
```

## RBAC Permissions

### Roles
- **admin**: Full access (all permissions)
- **manager**: Create, read, update, publish policies
- **user**: Read-only access

### Permissions
```typescript
POLICY_PERMISSIONS = {
  CREATE: 'policy:create',
  READ: 'policy:read',
  UPDATE: 'policy:update',
  DELETE: 'policy:delete',
  PUBLISH: 'policy:publish',
  DEPRECATE: 'policy:deprecate',
  ARCHIVE: 'policy:archive',
  VIEW_HISTORY: 'policy:view_history',
  VIEW_STATISTICS: 'policy:view_statistics',
}
```

### Checking Permissions

```typescript
import { hasPermission, checkPermission } from '@/lib/decision-engine/registry';

// Returns boolean
const canPublish = await hasPermission(userId, 'policy:publish');

// Throws PermissionDeniedError if denied
await checkPermission(userId, 'policy:publish');
```

## Validation

### Policy Validation
- Policy ID: 3-100 chars, alphanumeric + underscore/hyphen
- Version: Semver format (1.0.0)
- Name: 3-200 chars
- Description: max 1000 chars
- Email: valid email format

### Status Transitions
```typescript
VALID_STATUS_TRANSITIONS = {
  draft: ['active'],
  active: ['deprecated', 'archived'],
  deprecated: ['active', 'archived'],
  archived: [], // Cannot transition from archived
}
```

### Governance Requirements for Publishing
- ✅ Business owner + email (required)
- ✅ Technical owner + email (required)
- ✅ Owner department (required)
- ✅ Effective date (required)
- ✅ Not expired
- ⚠️ Review date (recommended)

## Error Handling

All errors extend `PolicyRegistryError`:

```typescript
try {
  await PolicyRegistry.publish('policy-id', '1.0.0', userId);
} catch (error) {
  if (error instanceof PolicyNotFoundError) {
    console.error('Policy not found');
  } else if (error instanceof InvalidStatusTransitionError) {
    console.error('Invalid status transition');
  } else if (error instanceof GovernanceValidationError) {
    console.error('Governance validation failed:', error.details.failures);
  } else if (error instanceof PermissionDeniedError) {
    console.error('Permission denied:', error.details.action);
  }
}
```

## Testing

See test files in `__tests__/` directory:
- `PolicyRepository.test.ts`
- `PolicyAuditService.test.ts`
- `PolicyStatisticsService.test.ts`
- `PolicyGovernanceService.test.ts`
- `PolicyLifecycleService.test.ts`
- `PolicyRegistry.test.ts`

Run tests:
```bash
npm test src/lib/decision-engine/registry
```

## Migration

To migrate existing policies to the registry:

```bash
npx ts-node scripts/migrate-policies-to-registry.ts
```

This will:
1. Load existing policies from the old system
2. Create v1.0.0 entries in the registry
3. Set them as active
4. Log creation in audit trail

## Development Principles

### 1. **Keep PolicyRegistry Thin**
- Only orchestration and RBAC
- Business logic in services

### 2. **Atomic Statistics**
- Never read-modify-write
- Always use Postgres function

### 3. **Audit Everything**
- Log all changes via `PolicyAuditService`
- Include reason for state changes

### 4. **Multi-Version Safety**
- Only one `is_active = true` per policy
- Use composite key (policy_id, version)

### 5. **Soft Delete Only**
- Never hard delete
- Filter `deleted_at IS NULL` in queries

### 6. **Governance First**
- Check governance before publishing
- Validate dates and ownership

### 7. **RBAC Always**
- Check permissions before writes
- Use enforce functions for clarity

## Next Steps

See `docs/decision-engine/WEEK_1_2_POLICY_REGISTRY_TASKS.md` for:
- [ ] Day 8-9: Integration & RBAC Testing
- [ ] Day 10-11: Migration Script
- [ ] Day 12-13: Unit & Integration Tests
- [ ] Day 14: API Documentation

---

**Enterprise-Grade v2.0** - Built with Microsoft/Amazon best practices
