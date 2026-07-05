# Decision Engine API Contract - FROZEN

**Status**: ✅ **FROZEN** for Sprint 1 → Sprint 2 transition

**Effective Date**: June 22, 2026

**Philosophy**: "API contracts are promises to consumers. Break them rarely, version them clearly."

---

## Why Freeze API Contract?

### Benefits of Stable APIs
1. **Parallel Development**: Dashboard, mobile app, CLI tools, BI integrations can all develop independently
2. **Consumer Trust**: External teams/services can rely on consistent behavior
3. **Backward Compatibility**: Old clients continue working when server upgrades
4. **Integration Testing**: Test suites remain valid across deployments
5. **Documentation Stability**: API docs don't require constant updates

### Cost of Breaking Changes
- Dashboard needs to update fetch logic
- Mobile app requires new release
- BI dashboards break silently
- Integration tests fail
- Customer workflows disrupted

---

## Frozen Endpoints (v1.0.0)

### 1. Health Endpoint
**Route**: `GET /api/decision-engine/health`

**Response Schema** (FROZEN):
```typescript
{
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string; // ISO 8601
  decisionEngine: {
    uptime: string; // e.g., "2h15m30s"
    version: string; // e.g., "1.0.0"
    policyVersion: string; // e.g., "leave-policy@1.0.0"
    auditQueueDepth: number;
    retryRate: number; // 0.0 to 1.0 (percentage as decimal)
    dlqRate: number; // 0.0 to 1.0
    circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  };
}
```

**Guarantees**:
- ✅ Always returns HTTP 200 (even when `status: 'down'`)
- ✅ Response time < 100ms (no DB queries)
- ✅ All fields always present (never `null` or `undefined`)
- ✅ `auditQueueDepth`, `retryRate`, `dlqRate` are always numbers (0 if unavailable)

**Breaking Changes NOT Allowed**:
- ❌ Removing any field
- ❌ Changing field types
- ❌ Renaming fields
- ❌ Changing response format (e.g., wrapping in `{ data: {...} }`)

**Allowed Additions**:
- ✅ New optional fields (e.g., `decisionEngine.memoryUsageMB`)
- ✅ New status values (e.g., `status: 'maintenance'`)

---

### 2. Audit Query Endpoint
**Route**: `GET /api/decision-engine/audit`

**Query Parameters** (FROZEN):
```typescript
{
  decisionType?: string; // e.g., "leave-request-approval"
  tenantId?: string;
  userId?: string;
  status?: 'success' | 'error' | 'warning';
  startDate?: string; // ISO 8601 date
  endDate?: string; // ISO 8601 date
  limit?: number; // Default: 50, Max: 1000
  offset?: number; // Default: 0
  sortBy?: 'decision_timestamp' | 'execution_time_ms' | 'confidence_score';
  sortOrder?: 'asc' | 'desc'; // Default: 'desc'
}
```

**Response Schema** (FROZEN):
```typescript
{
  decisions: Array<{
    id: string; // decision_id
    decisionType: string;
    provider: string;
    approved: boolean | null;
    confidence: number | null; // 0.0 to 1.0
    executionTimeMs: number;
    status: 'success' | 'error' | 'warning';
    timestamp: string; // ISO 8601
    tenantId: string;
    userId: string | null;
    
    // Version info (MANDATORY for Time Machine)
    engineVersion: string;
    policyVersion: string;
    
    // Correlation
    correlationId: string | null;
    traceId: string | null;
    
    // Summary data
    rulesEvaluated: string[]; // Array of rule IDs
    output: {
      reason?: string;
      action?: string;
      recommendations?: string[];
    };
  }>;
  
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

**Guarantees**:
- ✅ Always returns HTTP 200 (even if 0 results)
- ✅ `decisions` is always an array (empty array if no results)
- ✅ `pagination.total` is accurate count
- ✅ `engineVersion` and `policyVersion` always present (never null)
- ✅ Results sorted by `decision_timestamp DESC` by default

**Breaking Changes NOT Allowed**:
- ❌ Removing any field from decision object
- ❌ Changing field types
- ❌ Removing `pagination` object
- ❌ Changing default sort order

**Allowed Additions**:
- ✅ New optional query parameters
- ✅ New optional fields in decision object
- ✅ New values for `status` enum

---

### 3. Audit Detail Endpoint
**Route**: `GET /api/decision-engine/audit/:id`

**Response Schema** (FROZEN):
```typescript
{
  decision: {
    id: string;
    decisionType: string;
    provider: string;
    approved: boolean | null;
    confidence: number | null;
    executionTimeMs: number;
    status: 'success' | 'error' | 'warning';
    timestamp: string;
    tenantId: string;
    userId: string | null;
    
    // Full context (NOT in list endpoint)
    inputContext: Record<string, any>;
    output: Record<string, any>;
    
    // Version snapshot (FULL detail)
    versionSnapshot: {
      engineVersion: string;
      policyVersions: Record<string, string>; // { "leave-policy": "1.0.0" }
      ruleVersions: Record<string, string>; // { "rule-123": "1.2.0" }
      providerVersions: Record<string, string>; // { "RuleProvider": "1.0.0" }
    };
    
    // Correlation
    correlationId: string | null;
    traceId: string | null;
    spanId: string | null;
    parentSpanId: string | null;
    
    // Execution details
    policiesExecuted: string[];
    matchedRules: Array<{
      ruleId: string;
      ruleName: string;
      priority: number;
      conditions?: string[];
    }>;
    
    // Audit log (execution timeline)
    auditLog: Array<{
      timestamp: string;
      level: 'info' | 'warn' | 'error';
      message: string;
    }>;
    
    // Optional advanced data
    resourceMetrics?: {
      cpuTimeMs?: number;
      memoryUsedMB?: number;
      dbQueries?: { count: number; totalTimeMs: number };
      remoteApiCalls?: { count: number; totalTimeMs: number };
    };
    
    businessOutcome?: {
      outcomeType: 'approved' | 'rejected' | 'modified' | 'info';
      revenueImpact?: number;
      costImpact?: number;
    };
    
    aiMetadata?: {
      provider: string;
      model: string;
      confidence?: number;
      tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalCost: number;
      };
    };
  };
}
```

**Guarantees**:
- ✅ Returns HTTP 404 if decision not found
- ✅ Returns HTTP 200 with full detail if found
- ✅ `versionSnapshot` always present (never null)
- ✅ `auditLog` always array (empty if no logs)
- ✅ Optional fields can be `null` or `undefined`

**Breaking Changes NOT Allowed**:
- ❌ Removing required fields
- ❌ Changing field types
- ❌ Changing `versionSnapshot` structure

**Allowed Additions**:
- ✅ New optional fields
- ✅ New nested objects in `resourceMetrics`, `businessOutcome`, `aiMetadata`

---

### 4. Replay Endpoint (Time Machine)
**Route**: `POST /api/decision-engine/replay/:id`

**Request Body**: (Optional)
```typescript
{
  policyVersion?: string; // Override with different policy version
  compareMode?: boolean; // Return side-by-side comparison
}
```

**Response Schema** (FROZEN):
```typescript
{
  original: {
    decisionId: string;
    approved: boolean | null;
    confidence: number | null;
    timestamp: string;
    versionSnapshot: {
      engineVersion: string;
      policyVersion: string;
    };
  };
  
  replayed: {
    approved: boolean | null;
    confidence: number | null;
    timestamp: string; // Replay timestamp
    versionSnapshot: {
      engineVersion: string;
      policyVersion: string; // May differ if overridden
    };
  };
  
  comparison: {
    match: boolean; // true if results identical
    differences: Array<{
      field: string;
      originalValue: any;
      replayedValue: any;
    }>;
    confidenceDelta: number; // replayed.confidence - original.confidence
  };
}
```

**Guarantees**:
- ✅ Returns HTTP 404 if original decision not found
- ✅ Returns HTTP 200 with comparison if replay succeeds
- ✅ `comparison.match` is deterministic (same inputs → same outputs)
- ✅ `differences` array always present (empty if match)
- ✅ Replay uses original `inputContext` from audit log

**Breaking Changes NOT Allowed**:
- ❌ Removing any field
- ❌ Changing comparison logic
- ❌ Changing response structure

**Allowed Additions**:
- ✅ New optional request parameters
- ✅ New fields in `comparison` object

---

### 5. Trace Viewer Endpoint
**Route**: `GET /api/decision-engine/trace/:traceId`

**Response Schema** (FROZEN):
```typescript
{
  traceId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  totalDuration: number; // milliseconds
  
  decisions: Array<{
    decisionId: string;
    decisionType: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: 'success' | 'error' | 'warning';
    
    // Rule execution timeline (for waterfall chart)
    rules: Array<{
      ruleId: string;
      ruleName: string;
      startOffset: number; // ms from trace start
      duration: number; // ms
      result: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
    }>;
    
    // Nested spans (for distributed tracing)
    spans?: Array<{
      spanId: string;
      parentSpanId: string | null;
      operationType: string; // e.g., "DB_QUERY", "API_CALL", "POLICY_EVAL"
      startOffset: number;
      duration: number;
      status: 'success' | 'error';
      metadata?: Record<string, any>;
    }>;
  }>;
}
```

**Guarantees**:
- ✅ Returns HTTP 404 if trace not found
- ✅ Returns HTTP 200 with waterfall data if found
- ✅ `rules` array sorted by `startOffset` (chronological)
- ✅ `spans` array sorted by `startOffset` if present
- ✅ All timestamps are ISO 8601
- ✅ All durations in milliseconds

**Breaking Changes NOT Allowed**:
- ❌ Removing any field
- ❌ Changing time units (always milliseconds)
- ❌ Changing timestamp format (always ISO 8601)

**Allowed Additions**:
- ✅ New `operationType` values
- ✅ New fields in `metadata`

---

### 6. Leave Approval Decision Endpoint
**Route**: `POST /api/leave-requests/:id/decide`

**Request Body** (FROZEN):
```typescript
{
  approverId: string;
  approverRole: 'staff' | 'manager' | 'admin';
  tenantId: string;
  notes?: string; // Optional approval notes
}
```

**Response Schema** (FROZEN):
```typescript
{
  success: boolean;
  approved: boolean;
  reason: string;
  decisionId: string;
  
  metadata: {
    confidence: number; // 0.0 to 1.0
    executionTimeMs: number;
    autoApproved?: boolean; // true if auto-approved (e.g., sick leave ≤ 3 days)
    requiresEscalation?: boolean; // true if needs higher authority
    blackoutPeriod?: string; // e.g., "tet-2026" if rejected due to blackout
  };
}
```

**Guarantees**:
- ✅ Returns HTTP 200 for successful decision (regardless of approved/rejected)
- ✅ Returns HTTP 404 if leave request not found
- ✅ Returns HTTP 403 if approver unauthorized
- ✅ `decisionId` always returned (for audit trail lookup)
- ✅ `confidence` always present (never null)
- ✅ Decision result persisted to database before response

**Breaking Changes NOT Allowed**:
- ❌ Removing any required field
- ❌ Changing field types
- ❌ Changing HTTP status codes for existing scenarios

**Allowed Additions**:
- ✅ New optional fields in `metadata`
- ✅ New values for `approverRole` enum
- ✅ New optional request body fields

---

## Version Metadata Requirements

**MANDATORY in ALL audit logs** (starting v1.0.0):

```typescript
{
  engineVersion: string; // e.g., "1.0.0"
  policyVersion: string; // e.g., "leave-policy@1.0.0"
  // Optional but recommended:
  ruleVersions?: Record<string, string>;
  providerVersions?: Record<string, string>;
}
```

**Purpose**:
- Enable Time Machine replay with exact policy versions
- Support regression testing after policy updates
- Track policy evolution over time
- Answer: "Which policy version produced this decision?"

**Usage in Replay**:
```bash
# Replay with original policy version
POST /api/decision-engine/replay/dec-123
# Uses: engineVersion="1.0.0", policyVersion="leave-policy@1.0.0"

# Replay with newer policy version
POST /api/decision-engine/replay/dec-123
{ "policyVersion": "leave-policy@1.2.0" }
# Uses: engineVersion="1.0.0" (original), policyVersion="leave-policy@1.2.0" (override)
```

---

## HTTP Status Code Conventions

**Consistent across all endpoints**:

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful request (data returned) |
| 201 | Created | New resource created (not used yet) |
| 400 | Bad Request | Invalid input (e.g., malformed JSON, missing required fields) |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Authenticated but not authorized for this resource |
| 404 | Not Found | Resource doesn't exist (e.g., decision ID, trace ID) |
| 422 | Unprocessable Entity | Valid JSON but business rule violation |
| 500 | Internal Server Error | Unexpected server error (NOT for business logic failures) |
| 503 | Service Unavailable | Temporary outage (e.g., database maintenance) |

**NEVER use**:
- ❌ 200 for errors with `{ success: false }` body (use proper 4xx/5xx)
- ❌ 500 for validation errors (use 400)
- ❌ 500 for business rule violations (use 422)

**Exception**: Health endpoint always returns 200 (even when `status: 'down'`)

---

## Error Response Format

**FROZEN schema**:
```typescript
{
  error: {
    code: string; // Machine-readable error code (e.g., "DECISION_NOT_FOUND")
    message: string; // Human-readable error message
    details?: Record<string, any>; // Optional additional context
    timestamp: string; // ISO 8601
    requestId?: string; // For support/debugging
  };
}
```

**Example**:
```json
{
  "error": {
    "code": "INSUFFICIENT_LEAVE_BALANCE",
    "message": "Employee has 3 days available but requested 5 days",
    "details": {
      "availableDays": 3,
      "requestedDays": 5,
      "employeeId": "emp-123"
    },
    "timestamp": "2026-06-22T10:30:00Z",
    "requestId": "req-abc-123"
  }
}
```

**Error Codes** (v1.0.0):
- `DECISION_NOT_FOUND` - 404
- `LEAVE_REQUEST_NOT_FOUND` - 404
- `TRACE_NOT_FOUND` - 404
- `INVALID_REQUEST_BODY` - 400
- `MISSING_REQUIRED_FIELD` - 400
- `INVALID_FIELD_TYPE` - 400
- `UNAUTHORIZED_APPROVER` - 403
- `INSUFFICIENT_LEAVE_BALANCE` - 422 (business rule)
- `EXCEEDS_MAXIMUM_DURATION` - 422 (business rule)
- `BLACKOUT_PERIOD` - 422 (business rule)
- `POLICY_EXECUTION_ERROR` - 500
- `DATABASE_ERROR` - 500
- `SERVICE_UNAVAILABLE` - 503

---

## Breaking Change Process

**If you MUST break the API**:

1. **Add new version prefix**: `/api/v2/decision-engine/...`
2. **Maintain v1 for 6 months minimum**
3. **Document migration guide**
4. **Announce deprecation 3 months in advance**
5. **Add `Deprecation` header to v1 responses**:
   ```
   Deprecation: Sun, 01 Jan 2027 00:00:00 GMT
   Link: <https://docs.bella-erp.com/api-migration-v2>; rel="deprecation"
   ```

**Versioning Strategy**:
- Major version (v1 → v2): Breaking changes
- Minor version (v1.0 → v1.1): Backward-compatible additions
- Patch version (v1.0.0 → v1.0.1): Bug fixes only

---

## Monitoring Contract Compliance

**Automated checks**:
```bash
# JSON Schema validation
npm run validate:api-schema

# Contract testing (Pact.io or similar)
npm run test:api-contract

# Backward compatibility check
npm run test:api-backward-compat
```

**CI/CD Gate**:
- ✅ All API tests pass
- ✅ Response schemas match OpenAPI spec
- ✅ No breaking changes detected
- ✅ Performance SLA met (p95 < 200ms)

---

## Consumer Registration

**Who is consuming this API?**

| Consumer | Endpoints Used | SLA |
|----------|---------------|-----|
| Dashboard (Web) | `/health`, `/audit`, `/audit/:id`, `/replay/:id`, `/trace/:traceId` | p95 < 200ms |
| Mobile App | `/leave-requests/:id/decide`, `/audit` | p95 < 300ms |
| BI Pipeline | `/audit` (batch queries) | p95 < 1s |
| Monitoring (Datadog) | `/health` (every 30s) | p95 < 50ms |
| CLI Tools | `/replay/:id`, `/audit` | p95 < 500ms |

**How to register**:
1. Open PR adding your service to table above
2. Specify which endpoints you'll use
3. Specify your SLA requirements
4. API team reviews and approves

---

## Change Log

### v1.0.0 (June 22, 2026) - Initial Release
- ✅ Health endpoint
- ✅ Audit query/detail endpoints
- ✅ Replay (Time Machine) endpoint
- ✅ Trace viewer endpoint
- ✅ Leave approval decision endpoint
- ✅ Version metadata in all audit logs

### Future (v1.1.0) - Planned Additions
- ⏳ Batch replay endpoint: `POST /api/decision-engine/replay/batch`
- ⏳ Policy comparison: `GET /api/decision-engine/policies/:id/diff/:version1/:version2`
- ⏳ Rule coverage report: `GET /api/decision-engine/analytics/rule-coverage`

---

## Sign-Off

**API Contract Frozen**: ✅ YES

**Effective Date**: June 22, 2026

**Review Cadence**: Quarterly (every 3 months)

**Next Review**: September 22, 2026

**Approval**:
- Product Manager: ✅
- Engineering Lead: ✅
- Dashboard Team: ✅
- Mobile Team: ✅
- BI Team: ✅

---

**Philosophy**: "Stable APIs enable autonomous teams. Breaking changes require justification, not just convenience."
