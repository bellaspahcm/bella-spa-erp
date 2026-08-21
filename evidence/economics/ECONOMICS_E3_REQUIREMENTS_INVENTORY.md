# ECONOMICS E3 — REQUIREMENTS INVENTORY (FREIGHT AUDIT & PAYMENT)

**Document Type:** Requirements Lock (Pre-Implementation)  
**Status:** 🔒 LOCKED  
**Version:** 1.0.0  
**Lock Date:** 2026-08-21  
**Vertical:** Freight Audit & Payment

---

## 🎯 E3 VERTICAL SELECTION

**Selected Vertical:** Freight Audit & Payment

**Selection Rationale:**
1. **LOW overlap with Route Management** (financial vs operational domain)
2. **Tests different complexity patterns** (workflow vs state machine)
3. **Avoids reuse inflation** (domain distance prevents artificial leverage)
4. **Real business value** (invoice reconciliation, payment approval)
5. **Tests platform breadth** (can handle financial domain patterns?)

**Comparison to Route Management:**

| Dimension | Route Management | Freight Audit & Payment |
|-----------|------------------|-------------------------|
| Domain | Operational (delivery) | Financial (reconciliation) |
| Primary Pattern | State machine | Approval workflow |
| Cross-Entity | Route ↔ Shipment ↔ Vehicle | Invoice ↔ Shipment ↔ Rate ↔ Carrier |
| Calculations | Geographic (distance, duration) | Financial (rate matching, variance) |
| Compliance | Delivery audit | Financial audit, SOX |
| Shared Entities | Shipment, Carrier (moderate) | Shipment, Carrier (minimal usage) |

**Domain Distance:** HIGH → better test of platform-level reuse

---

## 📋 SCOPE BOUNDARY (LOCKED)

### What's In Scope

**Core Capabilities:**
- Invoice ingestion and storage
- Freight charge line-item management
- Rate validation against carrier contracts
- Accessorial charge verification
- Discrepancy detection and management
- Approval workflow (submit → review → approve)
- Audit trail for all financial operations
- Payment status tracking

**NOT In Scope (To Keep E3 Focused):**
- ❌ Full accounting/ERP integration (GL posting)
- ❌ Payment gateway integration (ACH, wire transfer)
- ❌ Tax calculation and compliance
- ❌ Multi-currency support
- ❌ Treasury/cash management
- ❌ Carrier dispute negotiation workflow
- ❌ Reporting/BI dashboards

**Rationale:** E3 is a measurement experiment, not a production product. Scope must be sufficient to test hypothesis without unnecessary complexity.

---

## 📊 REQUIREMENTS (LOCKED)

### R1: Create Freight Invoice

**Description:** Ingest carrier freight invoice with header and line-item details

**Acceptance Criteria:**
- Invoice header: invoice_number, carrier_id, invoice_date, due_date, total_amount
- Line items: shipment_id, charge_type, amount, description
- Tenant isolation (RLS)
- Idempotency (duplicate invoice detection)
- Audit trail (created_by, created_at)

**Complexity Drivers:**
- Multi-entity coordination (Invoice ↔ Shipment ↔ Carrier)
- Financial data validation (amounts, dates)
- Idempotency pattern

**Category Estimate:** Likely B (Contract/Engine pattern) + some D (invoice-specific logic)

---

### R2: Validate Rate Against Contract

**Description:** Match invoice line-item charges against contracted carrier rates

**Acceptance Criteria:**
- Retrieve contracted rate for shipment (origin, destination, service level, weight)
- Compare invoice amount vs contracted rate
- Calculate variance (absolute and percentage)
- Flag discrepancies > threshold (e.g., 5%)
- Store validation result

**Complexity Drivers:**
- Rate lookup logic (multi-dimensional matching)
- Financial calculations (variance, percentage)
- Business rule validation (threshold)

**Category Estimate:** Likely D (rate matching algorithm is novel) + B (validation pattern)

---

### R3: Validate Accessorial Charges

**Description:** Verify that accessorial charges (fuel surcharge, detention, etc.) are legitimate

**Acceptance Criteria:**
- Identify accessorial charge types
- Validate against shipment events (e.g., detention requires delay event)
- Validate charge amount against accessorial rate schedule
- Flag unauthorized or excessive charges

**Complexity Drivers:**
- Business rule validation (charge legitimacy)
- Cross-entity verification (charge ↔ shipment events)
- Rate schedule lookup

**Category Estimate:** Likely B (validation pattern) + D (accessorial logic)

---

### R4: Calculate Total Invoice Variance

**Description:** Aggregate all line-item variances to determine total invoice discrepancy

**Acceptance Criteria:**
- Sum of all line-item variances
- Variance by charge type (base rate, fuel, accessorials)
- Percentage variance vs total invoice
- Variance classification (within tolerance, requires review, reject)

**Complexity Drivers:**
- Aggregation logic
- Classification rules
- Financial calculations

**Category Estimate:** Likely B (aggregation pattern) + D (classification logic)

---

### R5: Create Discrepancy Record

**Description:** When variance exceeds threshold, create discrepancy for review

**Acceptance Criteria:**
- Discrepancy record: invoice_id, line_item_id, expected_amount, actual_amount, variance, reason
- Status: open, under_review, resolved, escalated
- Assignment to reviewer
- Event published: DiscrepancyCreated

**Complexity Drivers:**
- State management (discrepancy lifecycle)
- Event-driven integration
- Assignment logic

**Category Estimate:** Likely B (state machine + event pattern)

---

### R6: Submit Invoice for Approval

**Description:** Move validated invoice to approval workflow

**Acceptance Criteria:**
- Status transition: draft → pending_approval
- Validation: Invoice must be validated (R2-R4 complete)
- Approval required if: variance exists OR total > threshold
- Event published: InvoiceSubmitted

**Complexity Drivers:**
- Workflow state transition
- Business rule (approval criteria)
- Event-driven integration

**Category Estimate:** Likely B (workflow pattern)

---

### R7: Approve Invoice

**Description:** Reviewer approves invoice for payment

**Acceptance Criteria:**
- Status transition: pending_approval → approved
- Authorization check (only authorized users can approve)
- Variance acceptance (reviewer accepts calculated variance)
- Approval timestamp and approver_id recorded
- Event published: InvoiceApproved

**Complexity Drivers:**
- Workflow state transition
- Authorization logic
- Audit trail

**Category Estimate:** Likely B (workflow pattern) + A (authorization may reuse platform)

---

### R8: Reject Invoice

**Description:** Reviewer rejects invoice with reason

**Acceptance Criteria:**
- Status transition: pending_approval → rejected
- Rejection reason required
- Event published: InvoiceRejected
- Notification to carrier (future: out of scope for E3)

**Complexity Drivers:**
- Workflow state transition
- Event-driven integration

**Category Estimate:** Likely B (workflow pattern)

---

### R9: Mark Invoice as Paid

**Description:** Record that invoice has been paid (payment execution out of scope)

**Acceptance Criteria:**
- Status transition: approved → paid
- Payment date, payment_reference recorded
- Invoice locked (no further changes)
- Event published: InvoicePaid

**Complexity Drivers:**
- State transition (terminal state)
- Immutability enforcement

**Category Estimate:** Likely B (state machine pattern)

---

### R10: Query Invoices

**Description:** Retrieve invoices by various filters

**Acceptance Criteria:**
- Query by: status, carrier, date range, shipment_id
- Pagination support
- Tenant isolation (RLS)
- Sort by invoice_date, total_amount

**Complexity Drivers:**
- Standard query operations
- Tenant isolation verification

**Category Estimate:** Likely A (CRUD pattern reuse) + B (query pattern)

---

### R11: Get Invoice by ID

**Description:** Retrieve single invoice with all line items and discrepancies

**Acceptance Criteria:**
- Return invoice header
- Return all line items
- Return all discrepancies
- Return approval history
- Tenant isolation (RLS)

**Complexity Drivers:**
- Standard CRUD
- Multi-entity aggregation

**Category Estimate:** Likely A (CRUD pattern) + B (aggregation pattern)

---

### R12: Reopen Invoice

**Description:** Allow reopening of rejected invoice for resubmission

**Acceptance Criteria:**
- Status transition: rejected → draft
- Validation: Only rejected invoices can be reopened
- Audit trail (reopened_by, reopened_at)
- Event published: InvoiceReopened

**Complexity Drivers:**
- State machine (reverse transition)
- Business rule validation

**Category Estimate:** Likely B (state machine pattern)

---

### R13: Bulk Invoice Operations

**Description:** Support bulk status updates or approvals

**Acceptance Criteria:**
- Bulk approve: multiple invoices pending_approval → approved
- Bulk reject: multiple invoices pending_approval → rejected
- Transaction boundaries (all or nothing)
- Event published per invoice

**Complexity Drivers:**
- Bulk operation pattern
- Transaction management
- Event-driven integration (multiple events)

**Category Estimate:** Likely B (bulk pattern) + coordination

---

### R14: Invoice Metrics

**Description:** Analytics for invoice processing

**Acceptance Criteria:**
- Total invoices by status
- Total variance by carrier
- Average processing time (submitted → approved)
- Approval rate (approved / total submitted)
- Tenant-isolated

**Complexity Drivers:**
- Aggregation queries
- Time-based calculations
- Tenant isolation

**Category Estimate:** Likely B (analytics pattern)

---

### R15: Idempotency for All Operations

**Description:** All invoice operations must be idempotent

**Acceptance Criteria:**
- Idempotency key for create/update operations
- Duplicate detection within 24 hours
- Return existing result if duplicate detected

**Complexity Drivers:**
- Idempotency pattern (established in Gate B)

**Category Estimate:** Likely A (pattern reuse from Route/Shipment)

---

## 📊 REQUIREMENTS SUMMARY

**Total Requirements:** 15

| Requirement | Domain | Complexity | Estimated Category |
|-------------|--------|------------|-------------------|
| R1: Create Invoice | CRUD | Medium | B + D |
| R2: Validate Rate | Validation | High | D + B |
| R3: Validate Accessorials | Validation | High | B + D |
| R4: Calculate Variance | Calculation | Medium | B + D |
| R5: Create Discrepancy | State Management | Medium | B |
| R6: Submit for Approval | Workflow | Medium | B |
| R7: Approve Invoice | Workflow | Medium | B + A |
| R8: Reject Invoice | Workflow | Low | B |
| R9: Mark Paid | State Management | Low | B |
| R10: Query Invoices | CRUD | Low | A + B |
| R11: Get Invoice by ID | CRUD | Low | A + B |
| R12: Reopen Invoice | State Management | Medium | B |
| R13: Bulk Operations | Coordination | Medium | B |
| R14: Invoice Metrics | Analytics | Medium | B |
| R15: Idempotency | Pattern | Low | A |

**Complexity Breakdown:**
- High: 2 (R2, R3)
- Medium: 8 (R1, R4, R5, R6, R7, R12, R13, R14)
- Low: 5 (R8, R9, R10, R11, R15)

**Estimated Category Distribution:**
- Category A (Direct reuse): ~10-15% (idempotency, CRUD, RLS)
- Category B (Pattern reuse): ~50-60% (workflow, state machine, validation)
- Category C (Config reuse): ~10-15% (database, RLS, audit)
- Category D (Novel work): ~20-25% (rate matching, accessorial logic, variance calculation)

**This is ESTIMATE ONLY. Actual classification during E3 implementation.**

---

## 🧪 COMPLEXITY CLASSIFICATION (PER E1 DEFINITION 1)

### Data Model Complexity

**Entities:**
1. FreightInvoice (header)
2. InvoiceLineItem (charges)
3. Discrepancy (variance records)
4. ApprovalHistory (workflow audit)
5. CarrierRate (for validation — may exist or be new)

**Classification:** **MEDIUM-HIGH** (4-5 new entities)

---

### Business Rules Complexity

**Rules:**
- Rate matching (multi-dimensional lookup)
- Variance calculation (financial math)
- Accessorial validation (event correlation)
- Approval criteria (threshold-based)
- State transition rules (workflow)
- Idempotency (pattern)

**Classification:** **HIGH** (financial validation + workflow logic)

---

### Cross-Entity Coordination

**Coordination:**
- Invoice ↔ Shipment (line items reference shipments)
- Invoice ↔ Carrier (rate validation)
- Invoice ↔ Rate (contract lookup)
- Discrepancy ↔ Invoice (variance tracking)
- ApprovalHistory ↔ Invoice (workflow)

**Classification:** **MEDIUM-HIGH** (3-5 relationships with coordination)

---

### External Integration

**Integration:**
- Carrier rate lookup (may be internal database)
- Shipment data access (via Shipment Contract)
- Event publishing (DiscrepancyCreated, InvoiceApproved, etc.)
- Audit trail (platform capability)

**Classification:** **MEDIUM** (2-3 integrations, mostly internal)

---

### Compliance Requirements

**Compliance:**
- Financial audit trail (SOX-level)
- Tenant isolation (RLS)
- Approval authorization
- Invoice immutability after payment
- Idempotency

**Classification:** **HIGH** (financial compliance + audit)

---

### Overall Complexity: **HIGH**

**Justification:**
- Financial domain with validation complexity
- Workflow state machine (6+ states)
- Multi-entity coordination
- High compliance requirements (financial audit)
- 15 requirements with genuine business logic

**Comparable to Gate B Complexity₁:** YES ✅

---

## 🎯 COMPARISON TO BASELINE (C₁)

### Gate B (Route Management) Profile

- Complexity: HIGH
- Requirements: 17
- Domain: Operational (logistics)
- Pattern: State machine + geographic calculations
- LOC: 1,912
- Engineering-Days: 27.5 (estimated)

### E3 (Freight Audit) Profile

- Complexity: HIGH
- Requirements: 15
- Domain: Financial (reconciliation)
- Pattern: Workflow + financial validation
- LOC: TBD (to be measured)
- Engineering-Days: TBD (to be measured)

**Comparability:** ✅ VALID

**Rationale:**
- Both HIGH complexity
- Similar requirement count (15 vs 17, within 12% range)
- Different domains (tests platform breadth)
- Different primary patterns (workflow vs state machine)
- Both require cross-entity coordination and compliance

---

## 📊 EXPECTED ARCHITECTURE CHALLENGES

### Challenge 1: Rate Matching Algorithm

**Nature:** Financial calculation (rate lookup + variance)

**Potential Pressure:**
- Core financial primitive needed?
- Kernel rate abstraction needed?
- Extension utility sufficient?

**Boundary Solution Hypothesis:**
- Extension: Rate matching utilities
- Engine: Validation logic
- Contract: Rate lookup boundary

**Core Involvement Expected:** 🟢 NONE (unless gap discovered)

---

### Challenge 2: Approval Workflow

**Nature:** Multi-stage workflow (submit → review → approve → pay)

**Potential Pressure:**
- Core workflow orchestrator needed?
- Kernel workflow abstraction needed?
- State machine pattern sufficient?

**Boundary Solution Hypothesis:**
- Engine: Workflow state machine
- Event: Workflow state transitions
- Contract: Approval boundary

**Core Involvement Expected:** 🟢 NONE (workflow = domain concern)

---

### Challenge 3: Financial Audit Trail

**Nature:** Immutability + approval history

**Potential Pressure:**
- Core audit service needed?
- Platform audit capability reusable?

**Boundary Solution Hypothesis:**
- Category C: Reuse platform audit trail
- Engine: Financial-specific audit logic

**Core Involvement Expected:** 🟢 NONE (reuse existing audit)

---

### Challenge 4: Invoice ↔ Shipment Coordination

**Nature:** Invoice line items reference shipments

**Potential Pressure:**
- Cross-domain transaction coordinator needed?
- Shipment Contract boundary sufficient?

**Boundary Solution Hypothesis:**
- Call Shipment Contract for shipment data
- Event-driven integration for updates

**Core Involvement Expected:** 🟢 NONE (Contract boundary sufficient, per Gate B evidence)

---

### Challenge 5: Bulk Operations

**Nature:** Bulk approve/reject with transaction boundaries

**Potential Pressure:**
- Distributed transaction coordinator needed?
- Local transaction sufficient?

**Boundary Solution Hypothesis:**
- Local transaction (PostgreSQL)
- Loop through invoices with event publication

**Core Involvement Expected:** 🟢 NONE (same pattern as Gate B R9)

---

## 🔒 REQUIREMENTS LOCK COMMITMENT

**This requirements inventory is LOCKED.**

**Prohibited After Lock:**
- ❌ Adding requirements to inflate LOC
- ❌ Removing requirements to reduce C₂
- ❌ Changing scope to hit time targets
- ❌ Simplifying validation logic to avoid complexity

**Authorized:**
- ✅ Implementation per requirements as stated
- ✅ Boundary decisions based on architecture merit
- ✅ Unexpected work logged if discovered
- ✅ Scope clarifications (not expansions)

**Pre-Registration Commitment (from E1):**
> "Requirements locked before implementation. Scope will not be adjusted to improve C₂/T₂ metrics."

---

## 📋 E3 NEXT STEPS

**Immediate:**
1. ✅ Requirements locked (15 requirements)
2. ✅ Complexity classified (HIGH)
3. ⏳ Set E3 start date
4. ⏳ Begin daily tracking

**During E3:**
1. Implement requirements R1-R15
2. Classify EVERY LOC as A/B/C/D during implementation
3. Log engineering-days DAILY
4. Log coordination + rework + unexpected work
5. Verify regression gates WEEKLY

**After E3:**
1. Calculate C₂, T₂, V₂, Reuse₂ (E4)
2. Compare to C₁ baseline (E4)
3. Assess H1/H2/H3 (E5)
4. Report results honestly (E5)

---

## 🎯 SUCCESS DEFINITION (REMINDER)

**E3 Experiment Success:**
> Requirements implemented with honest measurement. A/B/C/D classified. Regression gates passed. Methodology followed.

**E3 Hypothesis Success:**
> C₂ < 8.25 days ∧ T₂ < 13.75 days ∧ Leverage > 70%

**Critical Distinction:**
```
Experiment success ≠ Hypothesis success

C₂ = 20 days → Experiment ✅, Hypothesis ❌
Still valuable evidence: "Financial domain requires 73% of Route Management effort"
```

---

## 🔐 FINAL LOCK

**Requirements Status:** 🔒 LOCKED  
**Complexity:** HIGH (verified comparable to C₁)  
**Vertical:** Freight Audit & Payment  
**Requirements Count:** 15  
**Version:** 1.0.0  
**Lock Date:** 2026-08-21

**E3 authorized to proceed to implementation.**

**Next Document:** Daily work logs with A/B/C/D classification

---

**Document Owner:** Kiro AI  
**Phase:** Economics E3  
**Status:** 🔒 REQUIREMENTS LOCKED

---

**END OF E3 REQUIREMENTS INVENTORY**
