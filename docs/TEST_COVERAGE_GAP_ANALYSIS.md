# Test Coverage Gap Analysis & Remediation Roadmap

**Generated**: 2026-06-19  
**Status**: 🟡 Partial Coverage - Business-Critical Gaps Identified

---

## Executive Summary

Current test suite contains **120+ test files** covering unit tests, integration tests, and some E2E scenarios. However, **critical business regression gaps exist** in the following areas:

- ✅ **Accounting Engine**: Covered (double-entry, outbox, idempotency)
- ✅ **Negative Cases**: Partial coverage (7 negative scenarios)
- ⚠️ **Booking Lifecycle**: Only happy path covered
- ❌ **Payment / Refund**: Missing full refund flow E2E
- ❌ **Payroll Closing**: Missing month-end salary finalization flow
- ❌ **Accounting Posting**: Missing actual journal entry verification
- ⚠️ **Permission / RLS**: Has RLS compliance tests but missing granular role-based access tests
- ❌ **Partner API / API Key**: Has auth tests but missing full CRUD lifecycle for external partners
- ⚠️ **Negative Cases**: Only 7 scenarios covered, need more edge cases

---

## Current Coverage Assessment

### 1. Booking Lifecycle ⚠️ **Partial Coverage**

**Existing Tests:**
- ✅ `e2e-order-lifecycle-real.test.ts`: Create booking → assign KTV → complete session → payment → salary
- ✅ `booking.test.ts`: Unit tests for booking creation
- ✅ `create-booking-payment-status.test.ts`: Payment status transitions
- ✅ `e2e-negative-pipeline.test.ts`: Cancelled booking scenario

**Missing Scenarios:**
- ❌ **Booking Modification**: Change KTV, change package, change date
- ❌ **Session Rescheduling**: KTV requests reschedule, admin approves
- ❌ **Booking Cancellation Flow**: Full cancellation with deposit refund
- ❌ **Partial Session Completion**: Customer stops after 5/10 sessions
- ❌ **Overbooking Prevention**: Double-booking same KTV at same time
- ❌ **Multi-Branch Booking**: Customer books at Branch A, completes at Branch B

**Priority**: 🔴 HIGH - Core revenue flow

---

### 2. Payment / Refund ❌ **Critical Gap**

**Existing Tests:**
- ✅ `payment-business-rule-audit.test.ts`: Payment validation rules
- ✅ `payment-webhook.test.ts`: External payment gateway webhooks
- ✅ `manual-payment-idempotency.test.ts`: Idempotency checks
- ⚠️ `e2e-pipeline.test.ts`: Deposit + remaining payment happy path

**Missing Scenarios:**
- ❌ **Full Refund E2E**: Customer cancels, admin issues full refund, accounting entry reversal
- ❌ **Partial Refund**: Customer completes 5/10 sessions, refunds remaining
- ❌ **Refund with Commission Clawback**: Refund triggers KTV commission adjustment
- ❌ **Multi-Payment Method**: Deposit via bank transfer, remaining via cash
- ❌ **Payment Gateway Timeout**: Webhook arrives late, booking already manually completed
- ❌ **Overpayment Handling**: Customer pays 6M for 5M package, system auto-creates credit
- ❌ **Split Payment**: Multiple family members pay for one booking

**Priority**: 🔴 CRITICAL - Revenue leakage risk

---

### 3. Payroll Closing ❌ **Critical Gap**

**Existing Tests:**
- ✅ `salary-recalculation-lifecycle.test.ts`: Salary recalculation logic
- ✅ `salary-reconciliation.test.ts`: AI vs manual salary reconciliation
- ✅ `admin-salary-actions.test.ts`: Salary publish/confirm actions
- ✅ `ktv-salary-confirmation.test.ts`: KTV confirms own salary

**Missing Scenarios:**
- ❌ **Month-End Payroll Close E2E**: Admin closes May payroll, all salaries locked, KPI finalized
- ❌ **Payroll Reopen**: Admin reopens locked month due to error
- ❌ **KTV Pro-Rata Salary**: KTV joins mid-month, salary calculated proportionally
- ❌ **KTV Leaves Mid-Month**: Leave request approved, salary adjusted
- ❌ **Salary Dispute Resolution**: KTV disputes salary, admin investigates, adjusts, republishes
- ❌ **Salary Advance**: KTV requests advance, admin approves, deducted from next month
- ❌ **Cross-Month Session**: Session completed on May 31, counted in June payroll

**Priority**: 🔴 CRITICAL - Labor cost accuracy

---

### 4. Accounting Posting ❌ **Critical Gap**

**Existing Tests:**
- ✅ `accounting-engine.test.ts`: Double-entry posting logic
- ✅ `accounting-outbox.test.ts`: Outbox pattern, idempotency
- ✅ `session-completion-accounting.test.ts`: Session completion triggers accounting entry
- ✅ `dual-mode-accounting.test.ts`: Both cash and accrual modes

**Missing Scenarios:**
- ❌ **End-to-End Accounting Verification**: Create booking → payment → complete session → **verify actual GL entries in journal_entries table**
- ❌ **Trial Balance Reconciliation**: After month close, verify trial balance (total debits = total credits)
- ❌ **P&L Account Classification**: Verify revenue accounts (3xxx), expense accounts (6xxx), asset accounts (1xxx)
- ❌ **Inter-Branch Clearing Journal**: Branch A owes Branch B, verify reciprocal entries
- ❌ **Manual Journal Reversal**: Admin posts adjusting entry, then reverses it
- ❌ **Accounting Period Lock**: Month locked, verify no new entries can be posted for that month
- ❌ **VAT Calculation**: Package price includes VAT, verify VAT account (3331) is credited correctly

**Priority**: 🔴 CRITICAL - Financial reporting integrity

---

### 5. Permission / RLS ⚠️ **Partial Coverage**

**Existing Tests:**
- ✅ `rls-compliance.test.ts`: RLS policy validation
- ✅ `auth-guards.test.ts`: Role-based route protection
- ✅ `api-key-middleware.test.ts`: Partner API authentication
- ✅ `tenant-isolation-source-guards.test.ts`: Tenant data isolation

**Missing Scenarios:**
- ❌ **Branch Manager Permission Scope**: Branch manager can only see their branch data, not HQ
- ❌ **KTV Permission Scope**: KTV can only see their own schedule, salary, customer list
- ❌ **Accountant Permission Scope**: Accountant can view all financial data but cannot approve salaries
- ❌ **Cross-Tenant Data Leak Test**: Tenant A user tries to access Tenant B booking via direct API call
- ❌ **Privilege Escalation**: Regular user tries to update their role to admin
- ❌ **Soft-Deleted Record Access**: User tries to access deleted customer via old bookmark
- ❌ **RLS Bypass via RPC**: Verify RPC functions respect RLS (e.g., `get_monthly_pnl`)

**Priority**: 🟡 HIGH - Security compliance

---

### 6. Partner API / API Key ⚠️ **Partial Coverage**

**Existing Tests:**
- ✅ `api-key-middleware.test.ts`: API key authentication, tenant resolution
- ⚠️ Missing full CRUD lifecycle for external partners

**Missing Scenarios:**
- ❌ **Partner API - Create Booking**: External partner creates booking via API, verify tenant isolation
- ❌ **Partner API - Query Orders**: Partner queries their orders, cannot see other partners' orders
- ❌ **Partner API - Webhook Delivery**: Partner webhook endpoint receives order status updates
- ❌ **Partner API - Rate Limiting**: Partner exceeds rate limit, returns 429
- ❌ **Partner API - Invalid API Key Rotation**: Old key expires, partner uses new key successfully
- ❌ **Partner API - Scope Restrictions**: Partner with read-only scope cannot create bookings
- ❌ **Partner API - Idempotency Key**: Duplicate request with same idempotency key returns cached response

**Priority**: 🟡 MEDIUM - Third-party integration reliability

---

### 7. Negative Cases ⚠️ **Partial Coverage**

**Existing Tests:**
- ✅ `e2e-negative-pipeline.test.ts`: 7 negative scenarios (cancelled booking, overpayment, inventory shortage, locked month, audit tampering, zero payment, missing fields)

**Missing Scenarios:**
- ❌ **Concurrent Session Completion**: Two KTVs try to complete the same session simultaneously
- ❌ **Double Payment Race Condition**: Customer pays twice for same booking within 1 second
- ❌ **Orphaned Session Logs**: Booking deleted but session logs still exist
- ❌ **Invalid Discount Code**: Customer applies expired/invalid promo code
- ❌ **Session Review After Booking Cancellation**: Customer tries to review cancelled session
- ❌ **KTV Salary Over-Commission**: KTV completes 100 sessions, commission exceeds revenue
- ❌ **Negative Balance**: Refund amount exceeds total paid (accounting entry should fail)
- ❌ **Invalid Date Range**: Booking start date > end date
- ❌ **Package Not Available**: Customer books package that's been disabled
- ❌ **KTV Double Assignment**: Same KTV assigned to 2 overlapping sessions

**Priority**: 🟡 MEDIUM - Edge case handling

---

## Remediation Roadmap

### Phase 1: Critical Business Flows (Week 1-2)
**Goal**: Achieve 80% coverage of revenue-generating flows

1. **Payment / Refund E2E** (Priority 🔴)
   - [ ] `e2e-refund-full.test.ts`: Full refund with accounting reversal
   - [ ] `e2e-refund-partial.test.ts`: Partial refund with commission clawback
   - [ ] `e2e-payment-multi-method.test.ts`: Split payments across methods

2. **Accounting Posting Verification** (Priority 🔴)
   - [ ] `e2e-accounting-gl-verification.test.ts`: End-to-end GL entry verification
   - [ ] `accounting-trial-balance.test.ts`: Trial balance reconciliation
   - [ ] `accounting-period-lock.test.ts`: Month lock prevents new entries

3. **Payroll Closing** (Priority 🔴)
   - [ ] `e2e-payroll-month-close.test.ts`: Month-end payroll finalization
   - [ ] `salary-pro-rata.test.ts`: Mid-month join/leave salary calculation
   - [ ] `salary-dispute-resolution.test.ts`: Salary adjustment and republish

### Phase 2: Security & Permission (Week 3)
**Goal**: Eliminate privilege escalation and data leak risks

4. **Granular Permission Tests** (Priority 🟡)
   - [ ] `permission-branch-manager.test.ts`: Branch manager scope isolation
   - [ ] `permission-ktv-scope.test.ts`: KTV can only see own data
   - [ ] `permission-cross-tenant-leak.test.ts`: Tenant A cannot access Tenant B
   - [ ] `permission-rpc-rls.test.ts`: RPC functions respect RLS

### Phase 3: Partner API & Integrations (Week 4)
**Goal**: Ensure third-party integration reliability

5. **Partner API Lifecycle** (Priority 🟡)
   - [ ] `partner-api-create-booking.test.ts`: Partner creates booking via API
   - [ ] `partner-api-rate-limit.test.ts`: Rate limiting enforcement
   - [ ] `partner-api-webhook-delivery.test.ts`: Webhook delivery reliability

### Phase 4: Edge Cases & Negative Scenarios (Week 5)
**Goal**: Harden system against edge cases

6. **Additional Negative Cases** (Priority 🟡)
   - [ ] `negative-concurrent-completion.test.ts`: Race condition handling
   - [ ] `negative-orphaned-data.test.ts`: Orphaned records cleanup
   - [ ] `negative-over-commission.test.ts`: Commission cap enforcement

---

## Test Metrics Target

| Metric | Current | Target (Phase 1) | Target (Final) |
|--------|---------|------------------|----------------|
| **Unit Test Coverage** | ~85% | 90% | 95% |
| **E2E Happy Path** | 3 scenarios | 10 scenarios | 15 scenarios |
| **E2E Negative Cases** | 7 scenarios | 15 scenarios | 25 scenarios |
| **Business Flow Coverage** | 40% | 80% | 95% |
| **RLS/Permission Tests** | 4 tests | 10 tests | 15 tests |
| **Partner API Tests** | 3 tests | 8 tests | 12 tests |

---

## Test Execution Strategy

### Continuous Integration (CI)
- **Pre-commit**: Run unit tests + linting
- **PR validation**: Run all unit tests + critical E2E tests (~5 min)
- **Nightly build**: Run full E2E suite (~20 min)
- **Pre-deployment**: Run smoke tests + accounting engine tests

### Test Data Management
- Use **in-memory mock store** for unit tests (fast, isolated)
- Use **real Supabase test instance** for E2E tests (slow, realistic)
- Use **seed scripts** to populate test data before E2E runs
- Use **teardown scripts** to cleanup test data after E2E runs

### Test Categorization (Jest Tags)
```bash
# Run only accounting tests
npm test -- --testNamePattern="Accounting"

# Run only E2E tests
npm test -- --testNamePattern="E2E"

# Run only negative tests
npm test -- --testNamePattern="Negative"

# Run only security tests
npm test -- --testNamePattern="RLS|Permission|Security"
```

---

## Conclusion

Current test suite provides **good foundation** for unit tests and some E2E scenarios, but **business-critical gaps exist** in:
1. Payment/Refund full lifecycle
2. Accounting journal entry verification
3. Payroll month-end closing
4. Granular permission/RLS enforcement
5. Partner API full CRUD lifecycle

**Immediate Action**: Prioritize **Phase 1** (Payment/Refund + Accounting + Payroll) to close the most critical revenue and compliance gaps.

---

**Next Steps**:
1. Review this document with stakeholders
2. Assign test development to QA/Dev team
3. Set up test execution pipeline in CI/CD
4. Track progress in Jira/Linear with this roadmap
