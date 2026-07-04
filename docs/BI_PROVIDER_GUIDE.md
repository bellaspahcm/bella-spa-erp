# BI Provider Guide

**Decision Engine Platform - Business Intelligence Provider**

Version: 1.0.0  
Last Updated: 2026-06-22

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Query Types](#query-types)
4. [Query Builder](#query-builder)
5. [Threshold Evaluation](#threshold-evaluation)
6. [Database Clients](#database-clients)
7. [Real-World Examples](#real-world-examples)
8. [Testing](#testing)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The **BI Provider** enables data-driven decisions by executing database queries and evaluating results against thresholds. It integrates seamlessly with the Decision Engine Platform to provide business intelligence-based decision-making.

### Key Features

- **4 Query Types**: SQL, Aggregation, Time-Series, Metric
- **Database Agnostic**: PostgreSQL, MySQL, SQLite, MSSQL, Oracle support
- **Fluent API**: Type-safe query builder with method chaining
- **Threshold Evaluation**: 9 comparison operators (>, >=, <, <=, =, !=, between, in, not_in)
- **Connection Pooling**: Efficient database connection management
- **Query Caching**: Configurable result caching (default: 300s TTL)
- **Error Resilient**: Graceful degradation on failures
- **Type-Safe**: Full TypeScript support

### Architecture

```
DecisionEngine
    ↓
BIProvider (implements IDecisionProvider)
    ↓
IBIClient (database abstraction)
    ↓
Concrete Client (PostgreSQL, MySQL, Mock)
    ↓
Database
```

---

## Quick Start

### Installation

```bash
# Core Decision Engine (already installed)
# For PostgreSQL support:
npm install pg @types/pg

# For MySQL support:
npm install mysql2 @types/mysql2
```

### Basic Usage

```typescript
import {
  createDecisionEngine,
  createProviderRegistry,
  createBIProvider,
  createMockBIClient,
  aggregation,
  threshold,
} from '@/lib/decision-engine';

// 1. Create database client
const client = createMockBIClient({ database: 'bella_spa' });

// Seed test data
client.setMockData('bookings', [
  { id: 1, customer_id: 123, status: 'approved', amount: 1000000 },
  { id: 2, customer_id: 123, status: 'approved', amount: 2000000 },
]);

await client.connect();

// 2. Create BI Provider
const biProvider = createBIProvider({
  client,
  enableCaching: true,
  cacheTTL: 600, // 10 minutes
});

// 3. Register with Decision Engine
const registry = createProviderRegistry();
registry.register(biProvider);

const engine = createDecisionEngine({ registry });

// 4. Evaluate decision
const context = {
  tenantId: 'bella-spa-vn',
  module: 'booking',
  decisionType: 'loyalty-tier',
  ruleType: 'aggregation',
  rule: {
    query: aggregation()
      .table('bookings')
      .count()
      .where('customer_id', 123)
      .where('status', 'approved')
      .build(),
    threshold: threshold().gte(2).build(),
    description: 'VIP customer check (>= 2 approved bookings)',
  },
  data: { customerId: 123 },
};

const result = await engine.evaluate(context);

if (result.approved) {
  console.log('Customer is VIP!');
  console.log('Reason:', result.reason);
  console.log('Confidence:', result.confidence);
}
```

---

## Query Types

### 1. SQL Query

Raw SQL with parameter binding.

```typescript
import { sql } from '@/lib/decision-engine';

const query = sql('SELECT COUNT(*) as total FROM bookings WHERE customer_id = :customerId AND status = :status')
  .params({ customerId: 123, status: 'approved' })
  .single() // Expect single row
  .build();

const context = {
  // ...
  ruleType: 'sql-query',
  rule: {
    query,
    threshold: threshold().gte(5).build(),
  },
};
```

### 2. Aggregation Query

Type-safe aggregation operations.

```typescript
import { aggregation } from '@/lib/decision-engine';

// COUNT
const countQuery = aggregation()
  .table('bookings')
  .count()
  .where('status', 'approved')
  .build();

// SUM
const sumQuery = aggregation()
  .table('bookings')
  .sum('amount')
  .where('customer_id', 123)
  .where('status', 'approved')
  .build();

// AVG
const avgQuery = aggregation()
  .table('sessions')
  .avg('rating')
  .where('ktv_id', 456)
  .timeRange({ start: '2024-01-01', end: '2024-12-31' })
  .build();

// MIN/MAX
const minQuery = aggregation()
  .table('bookings')
  .min('amount')
  .build();
```

### 3. Time-Series Query

Analytics over time periods.

```typescript
import { timeSeries } from '@/lib/decision-engine';

const query = timeSeries()
  .table('revenue')
  .metric('total_amount')
  .function('SUM')
  .timeRange({
    start: '2024-01-01',
    end: '2024-12-31',
    granularity: 'month',
  })
  .groupBy('branch_id')
  .build();
```

### 4. Metric Query

Pre-defined metrics.

```typescript
const query = {
  type: 'metric' as const,
  metricId: 'customer-lifetime-value',
  parameters: { customerId: 123 },
  timeRange: { start: '2024-01-01', end: '2024-12-31' },
};
```

---

## Query Builder

### Fluent API

```typescript
import { aggregation } from '@/lib/decision-engine';

const query = aggregation()
  .table('bookings')                          // Required: table name
  .count()                                    // Aggregation function
  .where('status', 'approved')                // Filter (equality)
  .where('type', ['spa', 'massage'])          // Filter (IN array)
  .groupBy('customer_id', 'branch_id')        // GROUP BY
  .timeRange({ start: '2024-01-01', end: '2024-12-31' })  // Time filter
  .timeColumn('created_at')                   // Time column (default: created_at)
  .build();
```

### Aggregation Functions

```typescript
.count()              // COUNT(*)
.count('column')      // COUNT(column)
.sum('amount')        // SUM(amount)
.avg('rating')        // AVG(rating)
.min('price')         // MIN(price)
.max('price')         // MAX(price)
```

### Filters

```typescript
// Equality
.where('status', 'approved')

// IN array
.where('type', ['spa', 'massage', 'facial'])

// Multiple filters (AND)
.where('status', 'approved')
.where('customer_id', 123)
.where('branch_id', 1)

// Bulk filters
.filters({
  status: 'approved',
  customer_id: 123,
  branch_id: 1
})
```

---

## Threshold Evaluation

### Comparison Operators

```typescript
import { threshold } from '@/lib/decision-engine';

// Greater than
threshold().gt(100).build()                    // > 100

// Greater than or equal
threshold().gte(50).build()                    // >= 50

// Less than
threshold().lt(10).build()                     // < 10

// Less than or equal
threshold().lte(5).build()                     // <= 5

// Equal
threshold().eq(42).build()                     // = 42
threshold().eq('VIP').build()                  // = 'VIP' (string)

// Not equal
threshold().neq(0).build()                     // != 0

// Between (inclusive)
threshold().between(10, 20).build()            // BETWEEN 10 AND 20

// In list
threshold().in([1, 2, 3]).build()              // IN (1, 2, 3)
threshold().in(['bronze', 'silver', 'gold']).build()  // IN ('bronze', 'silver', 'gold')

// Not in list
threshold().notIn([0, -1]).build()             // NOT IN (0, -1)
```

### Fallback Values

```typescript
// Fallback to true if query returns null/undefined
threshold().gte(100).fallback(true).build()

// Fallback to false (default)
threshold().gte(100).fallback(false).build()
```

---

## Database Clients

### Mock Client (Testing)

```typescript
import { createMockBIClient } from '@/lib/decision-engine';

const client = createMockBIClient({ database: 'test' });

// Seed data
client.setMockData('bookings', [
  { id: 1, customer_id: 123, status: 'approved', amount: 1000000 },
  { id: 2, customer_id: 123, status: 'approved', amount: 2000000 },
]);

await client.connect();

// Simulate failures
client.simulateFailure('Database connection lost');

// Configure latency
client.setQueryDelay(100); // 100ms

// Clear data
client.clearMockData();
```

### PostgreSQL Client (Production)

```typescript
import { createPostgreSQLClient } from '@/lib/decision-engine';

const client = createPostgreSQLClient({
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'bella_spa',
  user: 'postgres',
  password: 'password',
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  ssl: {
    rejectUnauthorized: false,
  },
});

await client.connect();

// Health check
const health = await client.healthCheck();
console.log('Database:', health.connected ? 'connected' : 'disconnected');
console.log('Latency:', health.latency, 'ms');

// Connection stats
const stats = client.getConnectionStats();
console.log('Active:', stats.active, 'Idle:', stats.idle);
```

---

## Real-World Examples

### Example 1: VIP Customer Detection

**Use Case**: Automatically upgrade customers to VIP tier if they have >= 10 approved bookings.

```typescript
const vipCheckContext = {
  tenantId: 'bella-spa-vn',
  module: 'customer',
  decisionType: 'vip-tier-upgrade',
  ruleType: 'aggregation',
  rule: {
    query: aggregation()
      .table('bookings')
      .count()
      .where('customer_id', customerId)
      .where('status', 'approved')
      .timeRange({ start: '2024-01-01', end: '2024-12-31' })
      .build(),
    threshold: threshold().gte(10).build(),
    description: 'VIP tier requires >= 10 approved bookings',
  },
  data: { customerId },
};

const result = await engine.evaluate(vipCheckContext);

if (result.approved) {
  await customerService.upgradeToVIP(customerId);
  await notificationService.send(customerId, 'Congratulations! You are now a VIP customer!');
}
```

### Example 2: High-Value Transaction Approval

**Use Case**: Auto-approve transactions if customer lifetime value >= 50 million VND.

```typescript
const approvalContext = {
  tenantId: 'bella-spa-vn',
  module: 'booking',
  decisionType: 'auto-approval',
  ruleType: 'aggregation',
  rule: {
    query: aggregation()
      .table('bookings')
      .sum('amount')
      .where('customer_id', customerId)
      .where('status', 'approved')
      .build(),
    threshold: threshold().gte(50000000).build(),
    description: 'High-value customer (LTV >= 50M VND)',
  },
  data: { customerId, transactionAmount: 5000000 },
};

const result = await engine.evaluate(approvalContext);

if (result.approved) {
  await bookingService.autoApprove(bookingId);
} else {
  await bookingService.requireManualApproval(bookingId);
}
```

### Example 3: KTV Performance Threshold

**Use Case**: Award bonus if KTV average rating >= 4.5 stars.

```typescript
const bonusContext = {
  tenantId: 'bella-spa-vn',
  module: 'hr',
  decisionType: 'bonus-eligibility',
  ruleType: 'aggregation',
  rule: {
    query: aggregation()
      .table('sessions')
      .avg('rating')
      .where('ktv_id', ktvId)
      .where('status', 'completed')
      .timeRange({ start: '2024-01-01', end: '2024-12-31' })
      .build(),
    threshold: threshold().gte(4.5).build(),
    description: 'Excellent service (avg rating >= 4.5)',
  },
  data: { ktvId },
};

const result = await engine.evaluate(bonusContext);

if (result.approved) {
  await salaryService.awardBonus(ktvId, 'EXCELLENT_SERVICE');
}
```

### Example 4: Branch Revenue Target

**Use Case**: Check if branch revenue meets monthly target.

```typescript
const revenueContext = {
  tenantId: 'bella-spa-vn',
  module: 'finance',
  decisionType: 'target-achievement',
  ruleType: 'aggregation',
  rule: {
    query: aggregation()
      .table('revenue')
      .sum('amount')
      .where('branch_id', branchId)
      .where('status', 'confirmed')
      .timeRange({ start: '2024-06-01', end: '2024-06-30' })
      .build(),
    threshold: threshold().gte(100000000).build(), // 100M VND target
    description: 'Monthly revenue target (>= 100M VND)',
  },
  data: { branchId, month: '2024-06' },
};

const result = await engine.evaluate(revenueContext);

if (result.approved) {
  await rewardService.awardBranchBonus(branchId);
}
```

---

## Testing

### Unit Testing with MockBIClient

```typescript
import { createMockBIClient, createBIProvider, aggregation, threshold } from '@/lib/decision-engine';

describe('CustomerService', () => {
  let client: MockBIClient;
  let provider: BIProvider;

  beforeEach(async () => {
    client = createMockBIClient({ database: 'test' });
    
    client.setMockData('bookings', [
      { id: 1, customer_id: 123, status: 'approved', amount: 1000000 },
      { id: 2, customer_id: 123, status: 'approved', amount: 2000000 },
    ]);

    await client.connect();
    provider = createBIProvider({ client });
  });

  afterEach(async () => {
    await provider.close();
  });

  it('should detect VIP customer', async () => {
    const context = {
      tenantId: 'test',
      module: 'customer',
      decisionType: 'vip-check',
      ruleType: 'aggregation',
      rule: {
        query: aggregation().table('bookings').count().where('customer_id', 123).build(),
        threshold: threshold().gte(2).build(),
      },
      data: { customerId: 123 },
    };

    const result = await provider.evaluate(context);
    expect(result.approved).toBe(true);
  });
});
```

---

## Best Practices

### 1. Query Performance

```typescript
// ✅ Good: Use indexes and filters
aggregation()
  .table('bookings')
  .count()
  .where('customer_id', 123)  // Indexed column
  .where('status', 'approved')
  .timeRange({ start: '2024-01-01', end: '2024-12-31' })
  .build()

// ❌ Bad: Full table scan
aggregation()
  .table('bookings')
  .count()
  .build()
```

### 2. Cache Configuration

```typescript
// ✅ Good: Cache stable queries
createBIProvider({
  client,
  enableCaching: true,
  cacheTTL: 600,  // 10 minutes
})

// ✅ Good: Disable cache for real-time data
createBIProvider({
  client,
  enableCaching: false,  // Real-time inventory check
})
```

### 3. Error Handling

```typescript
const result = await engine.evaluate(context);

if (result.error) {
  console.error('Decision failed:', result.error.message);
  
  // Fallback logic
  if (result.error.code === 'QUERY_TIMEOUT') {
    return handleSlowQuery();
  }
  
  if (result.error.code === 'BI_QUERY_ERROR') {
    return handleDatabaseError();
  }
}
```

### 4. Connection Pooling

```typescript
// ✅ Good: Reuse client across requests
const client = createPostgreSQLClient(config);
await client.connect();
const provider = createBIProvider({ client });

// ❌ Bad: Create new client per request
// DON'T DO THIS
async function handleRequest() {
  const client = createPostgreSQLClient(config);
  await client.connect();
  // ...
  await client.disconnect();
}
```

---

## Troubleshooting

### Issue 1: Query Timeout

**Symptom**: `QueryTimeoutError: Query timeout after 30000ms`

**Solution**:
```typescript
// Increase timeout
const context = {
  // ...
  options: {
    timeout: 60000,  // 60 seconds
  },
};

// Or optimize query with indexes
```

### Issue 2: Connection Pool Exhausted

**Symptom**: `ConnectionError: Connection pool exhausted`

**Solution**:
```typescript
// Increase pool size
const client = createPostgreSQLClient({
  // ...
  pool: {
    min: 5,
    max: 20,  // Increased from 10
  },
});
```

### Issue 3: Cache Stale Data

**Symptom**: Decision based on old data

**Solution**:
```typescript
// Invalidate cache when data changes
await engine.invalidateCache('tenant-id', 'booking');

// Or reduce TTL
createBIProvider({
  client,
  cacheTTL: 60,  // 1 minute
})
```

### Issue 4: Scalar Value Extraction Failed

**Symptom**: `Cannot extract scalar value from result`

**Solution**:
```typescript
// Ensure query returns single value
aggregation()
  .table('bookings')
  .count()  // Returns single number
  .build()

// NOT multiple columns
// aggregation().table('bookings').count('*').sum('amount')  // ❌
```

---

## Summary

The BI Provider enables powerful data-driven decisions with:

- ✅ Type-safe query builder
- ✅ Multiple database support
- ✅ Efficient connection pooling
- ✅ Configurable caching
- ✅ Comprehensive error handling
- ✅ Full testing support

For more examples, see the test files in `src/lib/decision-engine/providers/bi/__tests__/`.

---

**Next Steps**:
1. Install database driver (`pg` for PostgreSQL)
2. Implement PostgreSQLClient query translation
3. Add production logging and monitoring
4. Create custom metrics for your use case

**Reference**:
- Architecture: `docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md`
- Implementation Roadmap: `docs/DECISION_ENGINE_IMPLEMENTATION_ROADMAP.md`
- API Documentation: Inline JSDoc in source files
