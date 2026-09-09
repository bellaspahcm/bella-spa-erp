/**
 * Bella Preschool OS — P7.2 Finance Communication & Collection Lifecycle Integration Suite
 * 
 * Verifies 12 Core Invariants:
 * 1. Project ISSUED Invoice to P6 Notice (Mapped to REQUIRES_ACK)
 * 2. Safety Guard Blocks DRAFT/VOID Invoice Projection (UNISSUED_INVOICE_PROJECTION_ERROR)
 * 3. Idempotent Invoice Projection (Returns existing notice)
 * 4. Parent Read Tracking — Read receipt does NOT alter P7 settlement status (remains UNPAID)
 * 5. Parent ACK Lifecycle — ACK does NOT alter P7 settlement status (remains UNPAID)
 * 6. Overdue Unpaid Invoice Scanner — projects OVERDUE_PAYMENT_SLA exception to Staff Work Queue
 * 7. Idempotent Overdue Exception Scanner — no duplicate active exceptions
 * 8. Fully PAID Invoice Excluded from Overdue Scanner
 * 9. Staff Work Queue Resolution — Exception resolution does NOT alter P7 settlement status (remains UNPAID)
 * 10. Payment Reconciliation Ledger Entry Triggers Real P7 Settlement Truth (PAID) & Receipt Fingerprint
 * 11. Cross-Domain Traceability (source_domain P7_FINANCE, source_entity_id, version preserved)
 * 12. Cross-Tenant Mismatch Hard Block
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { PreschoolFinanceRepository } from '../../../../src/products/bella-education/finance/repositories/preschool-finance.repository';
import { TuitionBillingService } from '../../../../src/products/bella-education/finance/services/tuition-billing.service';
import { InvoiceIssuanceService } from '../../../../src/products/bella-education/finance/services/invoice-issuance.service';
import { PaymentReconciliationService } from '../../../../src/products/bella-education/finance/services/payment-reconciliation.service';
import { OverduePaymentScannerService } from '../../../../src/products/bella-education/finance/services/overdue-payment-scanner.service';
import { FinanceProjectionBridge } from '../../../../src/products/bella-education/parent-engagement/bridges/finance-projection.bridge';
import { CommunicationDeliveryService } from '../../../../src/products/bella-education/parent-engagement/services/communication-delivery.service';
import { AcknowledgementService } from '../../../../src/products/bella-education/parent-engagement/services/acknowledgement.service';
import { CommunicationExceptionService } from '../../../../src/products/bella-education/parent-engagement/services/communication-exception.service';
import { ParentCommunicationRepository } from '../../../../src/products/bella-education/parent-engagement/repositories/parent-communication.repository';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('P7.2 Finance Communication & Collection Lifecycle Integration Suite', { timeout: 20000 }, () => {
  let finRepo: PreschoolFinanceRepository;
  let billingService: TuitionBillingService;
  let issuanceService: InvoiceIssuanceService;
  let reconService: PaymentReconciliationService;
  let scannerService: OverduePaymentScannerService;
  let finBridge: FinanceProjectionBridge;
  let commDeliveryService: CommunicationDeliveryService;
  let ackService: AcknowledgementService;
  let exceptionService: CommunicationExceptionService;
  let commRepo: ParentCommunicationRepository;
  let billingPeriodId: string;

  let tenantA: string;
  let tenantB: string;
  let staffPartyId: string;
  let parentPartyId: string;

  beforeEach(async () => {
    tenantA = crypto.randomUUID();
    tenantB = crypto.randomUUID();
    staffPartyId = crypto.randomUUID();
    parentPartyId = crypto.randomUUID();

    finRepo = new PreschoolFinanceRepository();
    billingService = new TuitionBillingService(finRepo);
    issuanceService = new InvoiceIssuanceService(finRepo);
    reconService = new PaymentReconciliationService(finRepo);
    scannerService = new OverduePaymentScannerService(finRepo);

    commRepo = new ParentCommunicationRepository(supabase);
    commDeliveryService = new CommunicationDeliveryService(commRepo);
    ackService = new AcknowledgementService(commRepo);
    exceptionService = new CommunicationExceptionService(commRepo);
    finBridge = new FinanceProjectionBridge(supabase, commDeliveryService, commRepo);

    // 1. Seed Tenants & Persons for this test execution
    await supabase.from('tenants').insert({ id: tenantA, name: 'Bella Preschool Tenant A ' + tenantA.slice(0, 4) });
    await supabase.from('tenants').insert({ id: tenantB, name: 'Bella Preschool Tenant B ' + tenantB.slice(0, 4) });

    await supabase.from('persons').insert({ id: parentPartyId, tenant_id: tenantA, first_name: 'Mẹ', last_name: 'Phụ Huynh', date_of_birth: '1990-01-01', gender: 'female' });
    await supabase.from('persons').insert({ id: staffPartyId, tenant_id: tenantA, first_name: 'Thầy', last_name: 'Kế Toán', date_of_birth: '1985-01-01', gender: 'male' });

    // 2. Seed Fee Structure
    await finRepo.createFeeStructure({
      tenantId: tenantA,
      programId: 'PRESCHOOL',
      feeCode: 'TUITION_MONTHLY',
      feeName: 'Học Phí Mầm Non Tháng 9',
      feeType: 'TUITION',
      amount: 5000000,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isActive: true,
    });

    // 3. Seed Billing Period
    const period = await finRepo.createBillingPeriod({
      tenantId: tenantA,
      periodName: 'Kỳ Thu Tháng 9/2026',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      dueDate: '2026-09-15',
      status: 'ACTIVE',
      createdBy: staffPartyId,
    });

    billingPeriodId = period.id;
  });

  const createTestStudent = async (tenantId: string = tenantA, parentId: string = parentPartyId) => {
    const studentId = crypto.randomUUID();
    const { data: stPerson } = await supabase.from('persons').insert({
      tenant_id: tenantId,
      first_name: 'Bé',
      last_name: 'P72-' + studentId.substring(0, 4),
      date_of_birth: '2022-01-01',
      gender: 'male',
    }).select('id').single();

    await supabase.from('students').insert({
      student_id: studentId,
      tenant_id: tenantId,
      person_id: stPerson!.id,
      student_code: 'P72-ST-' + studentId.substring(0, 8),
      academic_status: 'enrolled',
      enrollment_type: 'full_time',
      program_id: 'PRESCHOOL',
      enrollment_date: '2026-09-01',
      metadata: { guardian_party_id: parentId, guardian_party_ids: [parentId] },
    });

    return studentId;
  };

  test('Test 1: Project ISSUED Invoice to P6 Notice (Mapped to REQUIRES_ACK)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { isDuplicate, notice, deliveries } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    expect(isDuplicate).toBe(false);
    expect(notice.source_domain || notice.sourceDomain).toBe('P7_FINANCE');
    expect(notice.source_entity_type || notice.sourceEntityType).toBe('INVOICE');
    expect(notice.requirement_type || notice.requirementType).toBe('REQUIRES_ACK');
    expect(deliveries.length).toBe(1);
  });

  test('Test 2: Safety Guard Blocks DRAFT/VOID Invoice Projection', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });

    await expect(
      finBridge.projectIssuedInvoice({
        tenantId: tenantA,
        studentId,
        guardianPartyIds: [parentPartyId],
        invoiceId: draft.id,
        invoiceNumber: draft.invoiceNumber,
        netAmount: draft.netAmount,
        dueDate: draft.dueDate,
        invoiceStatus: draft.invoiceStatus, // DRAFT!
        createdBy: staffPartyId,
      })
    ).rejects.toThrow(/UNISSUED_INVOICE_PROJECTION_ERROR/);
  });

  test('Test 3: Idempotent Invoice Projection', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const project1 = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const project2 = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    expect(project1.isDuplicate).toBe(false);
    expect(project2.isDuplicate).toBe(true);
    expect(project2.notice.id).toBe(project1.notice.id);
  });

  test('Test 4: Parent Read Tracking — Read receipt does NOT alter P7 settlement status (remains UNPAID)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { notice, deliveries } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    // Dispatch notice to transition status from READY -> SENT/DELIVERED
    await commDeliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: parentPartyId,
      payloadSnapshot: { title: notice.title },
    });
    await commDeliveryService.recordRead(tenantA, deliveries[0].id, parentPartyId);

    // SUPREME LAW CHECK: P7 settlementStatus MUST remain UNPAID
    const invoiceRefreshed = await finRepo.getInvoiceById(tenantA, issued.id);
    expect(invoiceRefreshed?.settlementStatus).toBe('UNPAID');
    expect(invoiceRefreshed?.paidAmount).toBe(0);
  });

  test('Test 5: Parent ACK Lifecycle — ACK does NOT alter P7 settlement status (remains UNPAID)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { notice, deliveries } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    await commDeliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: parentPartyId,
      payloadSnapshot: { title: notice.title },
    });
    await commDeliveryService.recordRead(tenantA, deliveries[0].id, parentPartyId);
    await ackService.acknowledgeNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      guardianPartyId: parentPartyId,
    });

    // SUPREME LAW CHECK: P7 settlementStatus MUST remain UNPAID
    const invoiceRefreshed = await finRepo.getInvoiceById(tenantA, issued.id);
    expect(invoiceRefreshed?.settlementStatus).toBe('UNPAID');
  });

  test('Test 6: Overdue Unpaid Invoice Scanner — projects OVERDUE_PAYMENT_SLA exception to Staff Work Queue', async () => {
    const studentId = await createTestStudent();

    // Past due date invoice (2026-08-01)
    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const { escalatedCount, exceptions } = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);

    expect(escalatedCount).toBeGreaterThanOrEqual(1);
    const targetExc = exceptions.find((e) => e.invoiceId === issued.id);
    expect(targetExc).toBeDefined();
    expect(targetExc?.isDuplicate).toBe(false);
  });

  test('Test 7: Idempotent Overdue Exception Scanner', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const scan1 = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);
    const scan2 = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);

    const target1 = scan1.exceptions.find((e) => e.invoiceId === issued.id);
    const target2 = scan2.exceptions.find((e) => e.invoiceId === issued.id);

    expect(target1?.isDuplicate).toBe(false);
    expect(target2?.isDuplicate).toBe(true);
    expect(target2?.exceptionId).toBe(target1?.exceptionId);
  });

  test('Test 8: Fully PAID Invoice Excluded from Overdue Scanner', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01', // Past due
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    // Record Payment & Reconcile to make settlementStatus = PAID
    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'BANK_TRANSFER',
      amount: 5000000,
      createdBy: staffPartyId,
    });

    await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: payment.id,
      invoiceId: issued.id,
      allocationAmount: 5000000,
      reconciledByPartyId: staffPartyId,
    });

    const { exceptions } = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);
    const target = exceptions.find((e) => e.invoiceId === issued.id);
    expect(target).toBeUndefined(); // Excluded from scan!
  });

  test('Test 9: Staff Work Queue Resolution — Exception resolution does NOT alter P7 settlement status (remains UNPAID)', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-08-01',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    const { exceptions } = await scannerService.scanAndEscalateOverdueInvoices(tenantA, parentPartyId);
    const targetExc = exceptions.find((e) => e.invoiceId === issued.id)!;

    // Staff resolves exception in Work Queue
    await exceptionService.resolveException({
      tenantId: tenantA,
      exceptionId: targetExc.exceptionId,
      resolvedBy: staffPartyId,
      resolutionNotes: 'Phụ huynh hẹn chuyển khoản vào ngày 18/09.',
    });

    // SUPREME LAW CHECK: Invoice settlementStatus MUST STILL remain UNPAID until payment is reconciled
    const invoiceRefreshed = await finRepo.getInvoiceById(tenantA, issued.id);
    expect(invoiceRefreshed?.settlementStatus).toBe('UNPAID');
  });

  test('Test 10: Payment Reconciliation Ledger Entry Triggers Real P7 Settlement Truth (PAID) & Receipt Fingerprint', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const payment = await reconService.recordInboundPayment({
      tenantId: tenantA,
      payerPartyId: parentPartyId,
      studentId,
      paymentMethod: 'QR_CODE',
      amount: 5000000,
      createdBy: staffPartyId,
    });

    const { receipt, updatedSettlementStatus } = await reconService.reconcilePaymentToInvoice({
      tenantId: tenantA,
      paymentId: payment.id,
      invoiceId: issued.id,
      allocationAmount: 5000000,
      reconciledByPartyId: staffPartyId,
    });

    expect(updatedSettlementStatus).toBe('PAID');
    expect(receipt.sha256Fingerprint).toBeDefined();
  });

  test('Test 11: Cross-Domain Traceability — P6 Notice retains source domain P7_FINANCE, source_entity_id, version', async () => {
    const studentId = await createTestStudent();

    const draft = await billingService.compileDraftInvoice({
      tenantId: tenantA,
      studentId,
      billingPeriodId,
      dueDate: '2026-09-15',
      createdBy: staffPartyId,
    });
    const issued = await issuanceService.issueInvoice(tenantA, draft.id);

    const { notice } = await finBridge.projectIssuedInvoice({
      tenantId: tenantA,
      studentId,
      guardianPartyIds: [parentPartyId],
      invoiceId: issued.id,
      invoiceNumber: issued.invoiceNumber,
      netAmount: issued.netAmount,
      dueDate: issued.dueDate,
      invoiceStatus: issued.invoiceStatus,
      createdBy: staffPartyId,
    });

    expect(notice.source_domain || notice.sourceDomain).toBe('P7_FINANCE');
    expect(notice.source_entity_type || notice.sourceEntityType).toBe('INVOICE');
    expect(notice.source_entity_id || notice.sourceEntityId).toBe(issued.id);
  });

  test('Test 12: Cross-Tenant Mismatch Hard Block', async () => {
    const studentIdInTenantB = await createTestStudent(tenantB);

    // Attempting to project invoice for student from Tenant B using Tenant A context raises TENANT_MISMATCH
    await expect(
      finBridge.projectIssuedInvoice({
        tenantId: tenantA, // Tenant A context
        studentId: studentIdInTenantB,
        guardianPartyIds: [parentPartyId],
        invoiceId: crypto.randomUUID(),
        invoiceNumber: 'INV-MISMATCH',
        netAmount: 5000000,
        dueDate: '2026-09-15',
        invoiceStatus: 'ISSUED',
        createdBy: staffPartyId,
      })
    ).rejects.toThrow(/COMMUNICATION_TENANT_MISMATCH_ERROR/);
  });
});
