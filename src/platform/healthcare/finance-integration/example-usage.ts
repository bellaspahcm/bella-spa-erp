/**
 * F5.6 C7-H1 Hospital Finance Integration — Example Usage
 * 
 * Simple examples showing how to use Hospital Finance Adapter
 * 
 * @see docs/implementation/F5_6_C7_H1_IMPLEMENTATION_GUIDE.md
 */

import { FinanceEventPublisher } from '../../integration-hub/finance-event-publisher';
import { HospitalFinanceAdapter } from './hospital-finance-adapter';

/**
 * Initialize Hospital Finance Adapter
 */
function initializeAdapter(): HospitalFinanceAdapter {
  const publisher = new FinanceEventPublisher({
    financeOsEndpoint: process.env.FINANCE_OS_ENDPOINT || 'http://localhost:3000/api/finance',
    sourceSystem: 'HOSPITAL_OS',
    sourceVersion: '1.0.0',
  });
  
  return new HospitalFinanceAdapter(publisher);
}

/**
 * Example 1: Patient Service Completed
 * 
 * When: Doctor completes consultation with patient
 * Finance Impact: Revenue + AR (Patient)
 */
export async function examplePatientServiceCompleted() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishPatientServiceCompleted({
    tenantId: 'tenant_a',
    patientId: 'PAT-001',
    patientType: 'OUTPATIENT',
    encounterId: 'ENC-001',
    encounterType: 'CONSULTATION',
    serviceId: 'SRV-001',
    serviceType: 'CONSULTATION',
    amount: '500000',
    currency: 'VND',
  });
  
  console.log('Finance Event Result:', result);
  // Output:
  // {
  //   event_id: '...',
  //   status: 'CREATED',
  //   transaction_id: 'TXN-...',
  //   processed_at: '2026-08-16T10:30:00Z'
  // }
}

/**
 * Example 2: Patient Payment Received
 * 
 * When: Patient pays bill at cashier
 * Finance Impact: Cash + AR Settlement
 */
export async function examplePatientPaymentReceived() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishPatientPaymentReceived({
    tenantId: 'tenant_a',
    patientId: 'PAT-001',
    billId: 'BILL-001',
    amount: '500000',
    currency: 'VND',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 3: Medication Dispensed
 * 
 * When: Pharmacist dispenses medication to patient
 * Finance Impact: COGS + Inventory Reduction
 */
export async function exampleMedicationDispensed() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishMedicationDispensed({
    tenantId: 'tenant_a',
    medicationId: 'MED-001',
    medicationName: 'Paracetamol 500mg',
    quantity: 20,
    unit: 'tablets',
    amount: '150000', // Cost value, not selling price
    currency: 'VND',
    patientId: 'PAT-001',
    encounterId: 'ENC-001',
    batchNumber: 'BATCH-2026-08-001',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 4: Medication Stock Received
 * 
 * When: Pharmacy receives medication from supplier
 * Finance Impact: Inventory + AP
 */
export async function exampleMedicationStockReceived() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishMedicationStockReceived({
    tenantId: 'tenant_a',
    medicationId: 'MED-001',
    medicationName: 'Paracetamol 500mg',
    quantity: 1000,
    unit: 'tablets',
    amount: '5000000',
    currency: 'VND',
    purchaseOrderId: 'PO-001',
    supplierId: 'SUP-001',
    supplierName: 'ABC Pharma',
    goodsReceiptId: 'GR-001',
    batchNumber: 'BATCH-2026-08-001',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 5: Supplier Prepayment
 * 
 * When: Hospital pays supplier advance
 * Finance Impact: Vendor Prepayment + Cash Reduction
 */
export async function exampleSupplierPrepayment() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishSupplierPrepaymentMade({
    tenantId: 'tenant_a',
    purchaseOrderId: 'PO-002',
    supplierId: 'SUP-002',
    supplierName: 'XYZ Medical Supplies',
    amount: '3000000',
    currency: 'VND',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 6: Supplier Payment
 * 
 * When: Hospital pays supplier invoice
 * Finance Impact: AP Settlement + Cash Reduction
 */
export async function exampleSupplierPayment() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishSupplierPaymentMade({
    tenantId: 'tenant_a',
    supplierId: 'SUP-001',
    supplierName: 'ABC Pharma',
    invoiceId: 'INV-SUP-001',
    amount: '5000000',
    currency: 'VND',
    goodsReceiptId: 'GR-001',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 7: Insurance Service
 * 
 * When: Service completed with insurance coverage
 * Finance Impact: Revenue + AR (Insurance)
 */
export async function exampleInsuranceService() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishInsuranceServiceCompleted({
    tenantId: 'tenant_a',
    patientId: 'PAT-002',
    patientType: 'INPATIENT',
    encounterId: 'ENC-002',
    encounterType: 'ADMISSION',
    serviceId: 'SRV-002',
    serviceType: 'PROCEDURE',
    billId: 'BILL-002',
    insurancePlanId: 'INS-PLAN-001',
    amount: '2000000', // Insurance-covered portion
    currency: 'VND',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 8: Insurance Settlement
 * 
 * When: Insurance payment received
 * Finance Impact: Cash + AR (Insurance) Settlement
 */
export async function exampleInsuranceSettlement() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishInsuranceSettlementReceived({
    tenantId: 'tenant_a',
    patientId: 'PAT-002',
    billId: 'BILL-002',
    insurancePlanId: 'INS-PLAN-001',
    claimId: 'CLAIM-001',
    claimedAmount: '2000000',
    settledAmount: '1800000', // May differ from claim
    adjustmentAmount: '200000',
    adjustmentReason: 'Co-pay',
    amount: '1800000',
    currency: 'VND',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 9: Patient Refund
 * 
 * When: Refund issued to patient (service cancellation)
 * Finance Impact: Cash Reduction + Revenue Reversal
 */
export async function examplePatientRefund() {
  const adapter = initializeAdapter();
  
  const result = await adapter.publishPatientRefundIssued({
    tenantId: 'tenant_a',
    patientId: 'PAT-003',
    billId: 'BILL-003',
    refundId: 'REFUND-001',
    refundReason: 'Service cancellation',
    amount: '100000',
    currency: 'VND',
  });
  
  console.log('Finance Event Result:', result);
}

/**
 * Example 10: Complete Patient Flow
 * 
 * Simulates complete patient journey:
 * 1. Service completed → Revenue + AR
 * 2. Medication dispensed → COGS + Inventory
 * 3. Patient pays → Cash + AR Settlement
 */
export async function exampleCompletePatientFlow() {
  const adapter = initializeAdapter();
  
  console.log('=== Complete Patient Flow ===\n');
  
  // Step 1: Service completed
  console.log('Step 1: Service completed');
  const serviceResult = await adapter.publishPatientServiceCompleted({
    tenantId: 'tenant_a',
    patientId: 'PAT-999',
    encounterId: 'ENC-999',
    serviceId: 'SRV-999',
    amount: '500000',
    currency: 'VND',
  });
  console.log('  → Transaction:', serviceResult.transaction_id);
  
  // Step 2: Medication dispensed
  console.log('\nStep 2: Medication dispensed');
  const medicationResult = await adapter.publishMedicationDispensed({
    tenantId: 'tenant_a',
    medicationId: 'MED-001',
    medicationName: 'Paracetamol 500mg',
    quantity: 20,
    unit: 'tablets',
    amount: '150000',
    currency: 'VND',
    patientId: 'PAT-999',
    encounterId: 'ENC-999',
  });
  console.log('  → Transaction:', medicationResult.transaction_id);
  
  // Step 3: Patient pays
  console.log('\nStep 3: Patient payment');
  const paymentResult = await adapter.publishPatientPaymentReceived({
    tenantId: 'tenant_a',
    patientId: 'PAT-999',
    billId: 'BILL-999',
    amount: '650000', // Service + Medication
    currency: 'VND',
  });
  console.log('  → Transaction:', paymentResult.transaction_id);
  
  console.log('\n=== Flow Complete ===');
  console.log('Financial Transactions Created:', 3);
  console.log('  1. Revenue + AR (Service)');
  console.log('  2. COGS + Inventory (Medication)');
  console.log('  3. Cash + AR Settlement (Payment)');
}

/**
 * Example 11: Idempotency Test
 * 
 * Demonstrates that same event sent multiple times creates only ONE transaction
 */
export async function exampleIdempotencyTest() {
  const adapter = initializeAdapter();
  
  const eventParams = {
    tenantId: 'tenant_a',
    patientId: 'PAT-IDEM-001',
    encounterId: 'ENC-IDEM-001',
    serviceId: 'SRV-IDEM-001',
    amount: '500000',
    currency: 'VND',
    idempotencyKey: 'test_idempotency_001', // SAME KEY
  };
  
  console.log('=== Idempotency Test ===\n');
  
  // Attempt 1
  console.log('Attempt 1: Publishing event...');
  const result1 = await adapter.publishPatientServiceCompleted(eventParams);
  console.log('  Status:', result1.status);
  console.log('  Transaction:', result1.transaction_id);
  
  // Attempt 2 (retry)
  console.log('\nAttempt 2: Publishing same event...');
  const result2 = await adapter.publishPatientServiceCompleted(eventParams);
  console.log('  Status:', result2.status);
  console.log('  Transaction:', result2.transaction_id);
  
  // Attempt 3 (retry)
  console.log('\nAttempt 3: Publishing same event...');
  const result3 = await adapter.publishPatientServiceCompleted(eventParams);
  console.log('  Status:', result3.status);
  console.log('  Transaction:', result3.transaction_id);
  
  console.log('\n=== Result ===');
  console.log('All 3 attempts return same transaction:', result1.transaction_id === result2.transaction_id && result2.transaction_id === result3.transaction_id);
  console.log('Status changed from CREATED → ALREADY_PROCESSED:', result1.status === 'CREATED' && result2.status === 'ALREADY_PROCESSED');
}

// Run examples (for testing)
if (require.main === module) {
  (async () => {
    try {
      // Run example flow
      await exampleCompletePatientFlow();
      
      // Test idempotency
      await exampleIdempotencyTest();
    } catch (error) {
      console.error('Error running examples:', error);
    }
  })();
}
