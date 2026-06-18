# Internal Testing Plan - Bella ERP API

## Purpose

Before onboarding external partners, conduct thorough internal testing to validate the API, identify issues, and refine documentation.

---

## Testing Team

### Recommended Team
- **API Developer** (1-2 people): Test technical implementation
- **Frontend Developer** (1 person): Test integration in Bella ERP frontend
- **QA Engineer** (1 person): Execute test plans & document bugs
- **Product Manager** (1 person): Validate use cases & user flows

---

## Testing Timeline

**Duration**: 1 week (can run in parallel with other work)

```
Day 1: Setup & Basic Testing
Day 2-3: Integration Development
Day 4: End-to-End Testing
Day 5: Bug Fixes & Documentation Updates
```

---

## Day 1: Setup & Basic Testing

### Morning: Environment Setup

**Tasks**:
- [ ] Generate internal test API key (`pk_test_bella_internal`)
- [ ] Import Postman collection
- [ ] Configure Postman environment
- [ ] Test "Test API Key" endpoint
- [ ] Seed sandbox data
- [ ] Test all endpoints in Postman (24 requests)

**Success Criteria**:
- ✅ All 24 Postman requests succeed
- ✅ Test scripts pass
- ✅ No 500 errors
- ✅ Response times < 500ms

**Bugs to Watch For**:
- Authentication issues
- Missing environment variables
- Database schema issues
- Response format inconsistencies

### Afternoon: Documentation Review

**Tasks**:
- [ ] Read Getting Started guide
- [ ] Follow code examples (TypeScript, Python, PHP)
- [ ] Identify confusing sections
- [ ] Test code examples in sandbox
- [ ] Document improvements needed

**Deliverable**: List of documentation issues

---

## Day 2-3: Integration Development

### Goal
Implement real integration in Bella ERP frontend to test API in realistic scenario.

### Use Case: Order Management

**Scenario**: Replace direct database queries with API calls in order management module.

**Endpoints to Test**:
1. `POST /v1/orders` - Create order
2. `GET /v1/orders` - List orders
3. `GET /v1/orders/{id}` - Get order details
4. `PATCH /v1/orders/{id}` - Update order
5. `POST /v1/orders/{id}/complete` - Complete order
6. `POST /v1/orders/{id}/cancel` - Cancel order

### Implementation Checklist

**Step 1: Create API Client**
```typescript
// src/lib/api/bella-api-client.ts
import { createClient } from '@/lib/supabase/client';

export class BellaAPIClient {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_BELLA_API_KEY!;
    this.baseURL = process.env.NEXT_PUBLIC_BELLA_API_URL!;
  }

  async createOrder(data: CreateOrderInput) {
    const response = await fetch(`${this.baseURL}/orders`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  // ... other methods
}
```

**Step 2: Implement in Component**
```typescript
// src/app/(dashboard)/orders/create/page.tsx
'use client';

import { useState } from 'react';
import { BellaAPIClient } from '@/lib/api/bella-api-client';

export default function CreateOrderPage() {
  const [loading, setLoading] = useState(false);
  const apiClient = new BellaAPIClient();

  async function handleSubmit(data: FormData) {
    setLoading(true);
    try {
      const result = await apiClient.createOrder({
        customer_id: data.get('customer_id') as string,
        items: JSON.parse(data.get('items') as string),
      });
      
      console.log('Order created:', result.data.id);
      router.push(`/orders/${result.data.id}`);
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order');
    } finally {
      setLoading(false);
    }
  }

  // ... render form
}
```

**Step 3: Test All Scenarios**
- [ ] Create order with valid data
- [ ] Create order with invalid data (expect 400)
- [ ] Create order without customer_id (expect 422)
- [ ] Get order that exists
- [ ] Get order that doesn't exist (expect 404)
- [ ] Update order
- [ ] Complete order
- [ ] Cancel order

**Step 4: Error Handling**
- [ ] Handle network errors
- [ ] Handle 4xx errors (show user message)
- [ ] Handle 5xx errors (retry with backoff)
- [ ] Handle rate limit (429)

---

## Day 4: End-to-End Testing

### Test Scenarios

**Scenario 1: Complete Order Lifecycle**
1. Customer calls spa to book appointment
2. Staff creates order via Bella ERP (via API)
3. Customer arrives, service delivered
4. Staff marks order as completed (via API)
5. Customer pays
6. Staff records payment (via API)
7. System generates invoice (via API)

**Expected**: All API calls succeed, data consistent

---

**Scenario 2: Webhook Testing**
1. Subscribe to webhook events
2. Create test order
3. Verify webhook received
4. Verify signature is valid
5. Process webhook event
6. Unsubscribe

**Expected**: Webhook delivered within 5 seconds

---

**Scenario 3: Rate Limit Testing**
1. Make 60 requests in 1 minute
2. 61st request should return 429
3. Wait for reset time
4. Retry succeeds

**Expected**: Rate limit enforced correctly

---

**Scenario 4: Error Recovery**
1. Create order with invalid data
2. Fix data and retry with same idempotency key
3. Verify only 1 order created

**Expected**: Idempotency works

---

**Scenario 5: Sandbox Reset**
1. Create test data in sandbox
2. Reset sandbox via API
3. Verify data cleared
4. Seed test data
5. Verify sample data created

**Expected**: Sandbox reset works

---

## Day 5: Bug Fixes & Documentation

### Bug Triage

For each bug found:
1. Document in GitHub Issues
2. Assign severity (Critical/High/Medium/Low)
3. Assign to developer
4. Fix before external pilot

**Priority**:
- Critical: Blocks integration (fix immediately)
- High: Major functionality broken (fix before pilot)
- Medium: Minor issue, workaround available (fix if time)
- Low: Enhancement, documentation (backlog)

### Documentation Updates

Based on testing, update:
- [ ] Confusing sections in Getting Started
- [ ] Add missing code examples
- [ ] Clarify error messages
- [ ] Update FAQ with new questions
- [ ] Add troubleshooting tips

---

## Testing Checklist

### Functional Testing ✅

**Authentication**
- [ ] Valid API key works
- [ ] Invalid API key rejected
- [ ] Inactive API key rejected
- [ ] Missing API key rejected

**CRUD Operations**
- [ ] Create (POST)
- [ ] Read (GET)
- [ ] Update (PATCH)
- [ ] Delete (DELETE)
- [ ] List with pagination
- [ ] Filter by status
- [ ] Sort by field

**Business Logic**
- [ ] Order completion updates inventory
- [ ] Payment links to correct order
- [ ] Invoice generated after payment
- [ ] Webhook sent on order creation

### Security Testing ✅

**Tenant Isolation**
- [ ] Cannot access other tenant's data
- [ ] Cannot inject tenant_id in request

**Input Validation**
- [ ] SQL injection blocked
- [ ] XSS attempts blocked
- [ ] Invalid JSON rejected
- [ ] Missing required fields rejected

**API Key Security**
- [ ] API key in header only (not query params)
- [ ] API key not logged in responses
- [ ] API key rotation works

### Performance Testing ✅

**Response Times**
- [ ] GET < 200ms (p95)
- [ ] POST < 500ms (p95)
- [ ] List < 300ms (p95)

**Rate Limiting**
- [ ] Enforced correctly
- [ ] Headers present (X-RateLimit-*)
- [ ] Retry-After header on 429

**Load Testing** (optional)
- [ ] 100 concurrent requests
- [ ] 1000 requests/minute
- [ ] No errors under load

### Integration Testing ✅

**End-to-End Workflows**
- [ ] Order lifecycle (create → complete)
- [ ] Payment flow (create → confirm)
- [ ] Webhook delivery (subscribe → receive → verify)
- [ ] Error recovery (retry after failure)

### Documentation Testing ✅

**Code Examples**
- [ ] TypeScript examples work
- [ ] Python examples work
- [ ] PHP examples work
- [ ] cURL examples work

**Postman Collection**
- [ ] All requests work
- [ ] Test scripts pass
- [ ] Variables auto-populate
- [ ] Environments configured correctly

---

## Deliverables

After 1 week of internal testing:

1. **Bug Report**
   - List of all bugs found
   - Severity & priority assigned
   - Resolution status

2. **Documentation Updates**
   - List of confusing sections
   - Suggested improvements
   - Missing code examples identified

3. **Performance Report**
   - Response time metrics
   - Rate limit validation
   - Load testing results (if done)

4. **Integration Example**
   - Working code example using API
   - Demonstrates best practices
   - Can be shared with partners

5. **Go/No-Go Decision**
   - Are we ready for external pilot?
   - Critical issues resolved?
   - Documentation sufficient?

---

## Success Criteria

**Ready for External Pilot if**:
- ✅ Zero critical bugs
- ✅ All high-priority bugs fixed
- ✅ Documentation clear & accurate
- ✅ Code examples tested & working
- ✅ Performance meets SLA
- ✅ Security testing passed
- ✅ Integration example completed

**Not Ready if**:
- ❌ Critical bugs remain
- ❌ Documentation confusing
- ❌ Performance issues
- ❌ Security concerns

---

## Next Steps

After internal testing:

1. **If Ready**:
   - Update documentation based on feedback
   - Fix all critical & high bugs
   - Proceed to external pilot (Task #14)

2. **If Not Ready**:
   - Fix blocking issues
   - Re-test
   - Delay external pilot until ready

---

**Testing Lead**: [Name]  
**Start Date**: [YYYY-MM-DD]  
**Target Completion**: [YYYY-MM-DD]  
**Status**: [Not Started / In Progress / Complete]

---

**Last Updated**: 2026-06-18  
**Version**: 1.0
