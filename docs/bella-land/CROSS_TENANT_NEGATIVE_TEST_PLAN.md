# Bella Land - Minimal Cross-Tenant Negative Test Suite

**Purpose:** Verify tenant isolation before RC seal  
**Scope:** Minimal — ONE representative test per critical entity  
**Timeline:** 30 minutes (4 tests)  
**Blocking:** YES — RC cannot seal without this evidence

---

## 🎯 Goal

Prove that **Tenant B cannot access Tenant A's data** for critical entities:
- Projects
- Apartments
- Customers
- Reservations

**NOT testing:**
- Every RLS policy
- Every permutation
- Every field-level restriction

**ONLY testing:**
- Basic cross-tenant read isolation (SELECT returns 0 rows)
- Proves RLS is enforced at runtime

---

## 📋 Test Cases (4 Required)

### Test 1: Projects Tenant Isolation

```typescript
test('Projects: Tenant B cannot read Tenant A project', async () => {
  // Setup: Tenant A creates project
  const clientA = createAuthenticatedClient(tenantAUser);
  const projectA = await clientA
    .from('real_estate_projects')
    .insert({ name: 'Tenant A Project', status: 'active' })
    .select()
    .single();
  
  expect(projectA.data).toBeDefined();
  const projectId = projectA.data!.id;
  
  // Test: Tenant B attempts to read
  const clientB = createAuthenticatedClient(tenantBUser);
  const { data, error } = await clientB
    .from('real_estate_projects')
    .select('*')
    .eq('id', projectId);
  
  // Verify: RLS blocks access
  expect(data).toHaveLength(0); // RLS filters it out
  console.log('✅ Tenant B cannot read Tenant A project');
});
```

**Pass Criteria:**
- Tenant A creates project: SUCCESS
- Tenant B SELECT same project: 0 rows returned
- NO error (RLS silently filters)

---

### Test 2: Apartments Tenant Isolation

```typescript
test('Apartments: Tenant B cannot read Tenant A apartment', async () => {
  // Setup: Tenant A creates apartment
  const clientA = createAuthenticatedClient(tenantAUser);
  const projectA = await clientA
    .from('real_estate_projects')
    .insert({ name: 'Project A', status: 'active' })
    .select()
    .single();
  
  const apartmentA = await clientA
    .from('real_estate_products')
    .insert({
      project_id: projectA.data!.id,
      product_code: 'A101',
      product_type: 'apartment',
      area: 50,
      unit_price: 1000000,
      status: 'available'
    })
    .select()
    .single();
  
  expect(apartmentA.data).toBeDefined();
  const apartmentId = apartmentA.data!.id;
  
  // Test: Tenant B attempts to read
  const clientB = createAuthenticatedClient(tenantBUser);
  const { data } = await clientB
    .from('real_estate_products')
    .select('*')
    .eq('id', apartmentId);
  
  // Verify: RLS blocks access
  expect(data).toHaveLength(0);
  console.log('✅ Tenant B cannot read Tenant A apartment');
});
```

**Pass Criteria:**
- Tenant A creates apartment: SUCCESS
- Tenant B SELECT same apartment: 0 rows returned

---

### Test 3: Customers Tenant Isolation

```typescript
test('Customers: Tenant B cannot read Tenant A customer', async () => {
  // Setup: Tenant A creates customer
  const clientA = createAuthenticatedClient(tenantAUser);
  const customerA = await clientA
    .from('re_customers')
    .insert({
      name: 'Customer A',
      phone: '0900000001',
      email: 'customer.a@test.com'
    })
    .select()
    .single();
  
  expect(customerA.data).toBeDefined();
  const customerId = customerA.data!.id;
  
  // Test: Tenant B attempts to read
  const clientB = createAuthenticatedClient(tenantBUser);
  const { data } = await clientB
    .from('re_customers')
    .select('*')
    .eq('id', customerId);
  
  // Verify: RLS blocks access
  expect(data).toHaveLength(0);
  console.log('✅ Tenant B cannot read Tenant A customer');
});
```

**Pass Criteria:**
- Tenant A creates customer: SUCCESS
- Tenant B SELECT same customer: 0 rows returned

---

### Test 4: Reservations Tenant Isolation

```typescript
test('Reservations: Tenant B cannot read Tenant A reservation', async () => {
  // Setup: Tenant A creates full reservation
  const clientA = createAuthenticatedClient(tenantAUser);
  
  // Create project, apartment, customer
  const project = await clientA.from('real_estate_projects')
    .insert({ name: 'Project A', status: 'active' })
    .select().single();
  
  const apartment = await clientA.from('real_estate_products')
    .insert({
      project_id: project.data!.id,
      product_code: 'A101',
      product_type: 'apartment',
      area: 50,
      unit_price: 1000000,
      status: 'available'
    })
    .select().single();
  
  const customer = await clientA.from('re_customers')
    .insert({ name: 'Customer A', phone: '0900000001' })
    .select().single();
  
  // Create reservation
  const reservation = await clientA.from('re_reservations')
    .insert({
      project_id: project.data!.id,
      product_id: apartment.data!.id,
      customer_id: customer.data!.id,
      reservation_type: 'booking',
      deposit_amount: 50000
    })
    .select().single();
  
  expect(reservation.data).toBeDefined();
  const reservationId = reservation.data!.id;
  
  // Test: Tenant B attempts to read
  const clientB = createAuthenticatedClient(tenantBUser);
  const { data } = await clientB
    .from('re_reservations')
    .select('*')
    .eq('id', reservationId);
  
  // Verify: RLS blocks access
  expect(data).toHaveLength(0);
  console.log('✅ Tenant B cannot read Tenant A reservation');
});
```

**Pass Criteria:**
- Tenant A creates full reservation: SUCCESS
- Tenant B SELECT same reservation: 0 rows returned

---

## 🛠️ Implementation

### Test File Location
```
e2e/tests/bella-land-tenant-isolation.spec.ts
```

### Required Helpers

```typescript
// Create authenticated Supabase client for specific tenant user
function createAuthenticatedClient(userEmail: string) {
  // Use existing e2e/helpers/supabase-admin.ts utilities
  // Mock auth session with specific tenant_id
  return supabaseClient;
}
```

### Execution

```bash
# Run isolation tests
npx playwright test e2e/tests/bella-land-tenant-isolation.spec.ts

# OR using Jest if integration test
npm run test:integration -- bella-land-tenant-isolation
```

---

## ✅ Pass Criteria (Suite Level)

**ALL 4 tests must pass:**
- ✅ Projects: Tenant B gets 0 rows
- ✅ Apartments: Tenant B gets 0 rows
- ✅ Customers: Tenant B gets 0 rows
- ✅ Reservations: Tenant B gets 0 rows

**NO failures acceptable:**
- 🔴 Tenant B gets data → RLS BROKEN → BLOCK RC
- 🔴 Any test errors → Investigate immediately

---

## 🔴 If Tests Fail

### Failure Response

```text
IF Tenant B can read Tenant A data:
1. BLOCK RC immediately
2. Review RLS policy for that table
3. Check:
   - Policy exists?
   - Policy enabled?
   - Policy logic correct?
   - Service-role bypass?
   - WITH CHECK clause?
4. Fix RLS policy
5. Re-run test
6. MUST pass before RC seal
```

### Common Issues

**Service-role client bypass:**
```typescript
// ❌ WRONG - bypasses RLS
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ✅ CORRECT - respects RLS
const supabase = createClient(url, ANON_KEY);
// Then authenticate as specific user
```

**Missing USING clause:**
```sql
-- ❌ WRONG - allows all reads
CREATE POLICY "read" ON table FOR SELECT USING (true);

-- ✅ CORRECT - filters by tenant
CREATE POLICY "read" ON table FOR SELECT 
  USING (tenant_id = auth.tenant_id());
```

---

## 📊 Timeline

**Estimated:** 30 minutes
- Setup: 10 minutes (helpers + tenant users)
- Write tests: 15 minutes (4 tests)
- Run + verify: 5 minutes

**Blocking:** YES
- Cannot seal RC without this evidence
- Multi-tenant product requires negative tenant tests

---

## 🎯 Deliverable

**Required before RC seal:**
```text
✅ 4/4 tests passing
✅ Evidence file: test-results/bella-land-tenant-isolation-report.html
✅ Console log showing all ✅ PASS
✅ Screenshot/trace showing 0 rows returned for cross-tenant queries
```

**Documentation:**
```text
BELLA LAND RC CHECKLIST

Critical Workflows         ✅
Database Integrity         ✅
Tenant Isolation Evidence  ✅ (4/4 negative tests PASS)
                           ↑
                    REQUIRED FOR RC SEAL
```

---

**Status:** 🔴 REQUIRED — Cannot skip  
**Priority:** Execute after critical workflows verified  
**Timeline:** 30 minutes  
**Evidence:** Test results + proof of RLS enforcement
