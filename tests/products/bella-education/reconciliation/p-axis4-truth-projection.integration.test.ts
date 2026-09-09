/**
 * Bella Preschool OS — Axis 4 Product-Wide Truth & Projection Reconciliation Integration Test Suite
 * File: tests/products/bella-education/reconciliation/p-axis4-truth-projection.integration.test.ts
 *
 * Verifies Axis 4 Mandatory Reconciliation Requirements:
 * 1. P7 Finance Truth: Exception Queue RESOLVED without DB Payment Reconciliation ledger entry MUST STILL report full outstanding balance on Executive Dashboard.
 * 2. P8 Workforce Truth: Exception Queue RESOLVED without Roster Recalculation MUST STILL report active staffing violation on Executive Dashboard.
 * 3. P9 Facilities Truth: Exception Queue RESOLVED without Independent Safety Re-inspection PASS MUST STILL report out-of-service asset on Executive Dashboard.
 * 4. Full Canonical Resolution Loop: Genuine domain operations (P7 Payment Reconciled, P8 Substitute Assigned, P9 Safety PASS) successfully update Executive Projections.
 * 5. Cross-Tenant Reconciliation Isolation: Tenant A reconciliation events NEVER alter Tenant B executive projections.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { PreschoolAnalyticsRepository } from '../../../../src/products/bella-education/analytics/repositories/preschool-analytics.repository';
import { PreschoolAnalyticsService } from '../../../../src/products/bella-education/analytics/services/preschool-analytics.service';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Axis 4: Product-Wide Truth & Projection Reconciliation Integration Suite', () => {
  let tenantA: string;
  let tenantB: string;
  let repo: PreschoolAnalyticsRepository;
  let service: PreschoolAnalyticsService;
  const todayStr = new Date().toISOString().split('T')[0];

  beforeEach(async () => {
    tenantA = crypto.randomUUID();
    tenantB = crypto.randomUUID();
    repo = new PreschoolAnalyticsRepository(supabase);
    service = new PreschoolAnalyticsService(repo);

    await supabase.from('tenants').insert([
      { id: tenantA, name: `Tenant A ${tenantA.slice(0, 8)}` },
      { id: tenantB, name: `Tenant B ${tenantB.slice(0, 8)}` },
    ]);
  });

  async function seedBillingPeriod(tenantId: string): Promise<string> {
    const { data } = await supabase.from('edu_fin_billing_periods').insert({
      tenant_id: tenantId,
      period_name: 'Billing Period Sept 2026',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      due_date: '2026-09-15',
      status: 'ACTIVE',
      created_by: crypto.randomUUID(),
    }).select('id').single();
    return data!.id;
  }

  async function seedStudent(tenantId: string): Promise<string> {
    const studentId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    await supabase.from('persons').insert({
      id: personId,
      tenant_id: tenantId,
      first_name: 'An',
      last_name: 'Trần',
      date_of_birth: '2022-03-15',
      gender: 'female',
    });

    await supabase.from('students').insert({
      student_id: studentId,
      tenant_id: tenantId,
      person_id: personId,
      student_code: `STU-${studentId.slice(0, 8)}`,
      academic_status: 'enrolled',
      enrollment_type: 'full_time',
      program_id: 'PRESCHOOL',
      enrollment_date: todayStr,
    });

    return studentId;
  }

  it('Invariant 4.1: P7 Finance Truth Reconciliation — Work Queue RESOLVED without ledger reconciliation STILL reports outstanding balance', async () => {
    const periodId = await seedBillingPeriod(tenantA);
    const studentId = await seedStudent(tenantA);
    const invId = crypto.randomUUID();

    // 1. Create Invoice in P7 (Gross: 10,000,000 VND)
    await supabase.from('edu_fin_invoices').insert({
      id: invId,
      tenant_id: tenantA,
      student_id: studentId,
      invoice_number: 'INV-AXIS4-01',
      billing_period_id: periodId,
      gross_amount: 10000000,
      net_amount: 10000000,
      invoice_status: 'ISSUED',
      settlement_status: 'UNPAID',
      due_date: '2026-09-30',
      created_by: crypto.randomUUID(),
    });

    // 2. Project Exception into Work Queue & mark RESOLVED directly in Work Queue
    await supabase.from('edu_comm_exceptions').insert({
      tenant_id: tenantA,
      student_id: studentId,
      exception_type: 'OVERDUE_PAYMENT_SLA',
      severity: 'HIGH',
      assigned_role: 'FINANCE_MANAGER',
      status: 'RESOLVED',
    });

    // 3. Query Executive Dashboard — Outstanding balance MUST STILL be 10,000,000
    let dash = await service.getExecutiveDashboard(tenantA, todayStr);
    expect(dash.finance.invoicedGrossTotal).toBe(10000000);
    expect(dash.finance.reconciledCashCollected).toBe(0);
    expect(dash.finance.outstandingBalanceTotal).toBe(10000000);

    // 4. Perform Canonical P7 Payment & Ledger Reconciliation
    const paymentId = crypto.randomUUID();
    await supabase.from('edu_fin_payments').insert({
      id: paymentId,
      tenant_id: tenantA,
      payer_party_id: crypto.randomUUID(),
      student_id: studentId,
      payment_number: 'PAY-AXIS4-01',
      amount: 10000000,
      payment_method: 'BANK_TRANSFER',
      status: 'RECONCILED',
      created_by: crypto.randomUUID(),
    });

    await supabase.from('edu_fin_reconciliation_ledger').insert({
      tenant_id: tenantA,
      invoice_id: invId,
      payment_id: paymentId,
      allocated_amount: 10000000,
      reconciled_by_party_id: crypto.randomUUID(),
    });

    await supabase.from('edu_fin_invoices').update({ settlement_status: 'PAID' }).eq('id', invId);

    // 5. Emit Domain Event
    await service.handleDomainEvent({
      eventId: crypto.randomUUID(),
      tenantId: tenantA,
      eventType: 'PAYMENT_RECONCILED',
      sourceDomain: 'P7_FINANCE',
      entityId: invId,
      payload: { allocatedAmount: 10000000 },
      timestamp: new Date().toISOString(),
    });

    // 6. Query Executive Dashboard — Balance reconciled cleanly to 0
    dash = await service.getExecutiveDashboard(tenantA, todayStr);
    expect(dash.finance.reconciledCashCollected).toBe(10000000);
    expect(dash.finance.outstandingBalanceTotal).toBe(0);
  });

  it('Invariant 4.2: P8 Workforce Truth Reconciliation — Work Queue RESOLVED without Roster recalculation STILL reports staffing shortage', async () => {
    const shiftTemplateId = crypto.randomUUID();
    await supabase.from('edu_sched_shift_templates').insert({
      id: shiftTemplateId,
      tenant_id: tenantA,
      name: 'Shift Axis 4',
      code: 'SHIFT-AXIS4',
      start_time: '08:00:00',
      end_time: '12:00:00',
    });

    const classId = crypto.randomUUID();

    // 1. Seed P8 Shortage Violation
    await supabase.from('edu_sched_compliance_snapshots').insert({
      tenant_id: tenantA,
      snapshot_date: todayStr,
      classroom_id: classId,
      shift_template_id: shiftTemplateId,
      enrolled_children: 12,
      expected_children: 12,
      present_children: 12,
      required_caregivers: 2,
      assigned_caregivers: 1,
      compliance_state: 'SHORTAGE_VIOLATION',
      shortage_count: 1,
    });

    // 2. Mark Exception RESOLVED in Work Queue
    await supabase.from('edu_comm_exceptions').insert({
      tenant_id: tenantA,
      student_id: crypto.randomUUID(),
      exception_type: 'RATIO_SHORTAGE',
      severity: 'HIGH',
      assigned_role: 'STAFF_TEACHER',
      status: 'RESOLVED',
    });

    // 3. Query Dashboard — Staffing violation MUST STILL report 1
    let dash = await service.getExecutiveDashboard(tenantA, todayStr);
    expect(dash.workforce.activeStaffingViolations).toBe(1);
    expect(dash.workforce.openStaffingExceptions).toBe(0);

    // 4. Perform Canonical P8 Roster Recalculation (Assigned = 2 ➔ COMPLIANT)
    await supabase.from('edu_sched_compliance_snapshots').update({
      assigned_caregivers: 2,
      compliance_state: 'COMPLIANT',
      shortage_count: 0,
    }).eq('tenant_id', tenantA).eq('classroom_id', classId);

    // 5. Query Dashboard — Staffing violation is now 0
    dash = await service.getExecutiveDashboard(tenantA, todayStr);
    expect(dash.workforce.activeStaffingViolations).toBe(0);
  });

  it('Invariant 4.3: P9 Facilities Truth Reconciliation — Work Queue RESOLVED without safety re-inspection PASS STILL reports out-of-service asset', async () => {
    const facId = crypto.randomUUID();
    const zoneId = crypto.randomUUID();
    const assetId = crypto.randomUUID();

    await supabase.from('edu_fac_facilities').insert({ tenant_id: tenantA, id: facId, name: 'Fac Axis 4', code: 'FAC-A4' });
    await supabase.from('edu_fac_zones').insert({ tenant_id: tenantA, id: zoneId, facility_id: facId, name: 'Play Zone', zone_type: 'PLAYGROUND' });

    // 1. Seed Asset in OUT_OF_SERVICE state
    await supabase.from('edu_fac_assets').insert({
      id: assetId,
      tenant_id: tenantA,
      zone_id: zoneId,
      name: 'Slide 01',
      asset_category: 'PLAY_EQUIPMENT',
      operational_status: 'OUT_OF_SERVICE',
    });

    // 2. Mark exception RESOLVED in Work Queue
    await supabase.from('edu_comm_exceptions').insert({
      tenant_id: tenantA,
      student_id: crypto.randomUUID(),
      exception_type: 'SAFETY_DEFECT',
      severity: 'CRITICAL',
      assigned_role: 'FACILITIES_MANAGER',
      status: 'RESOLVED',
    });

    // 3. Query Dashboard — Asset MUST STILL report OUT_OF_SERVICE (1)
    let dash = await service.getExecutiveDashboard(tenantA, todayStr);
    expect(dash.facilities.outOfServiceAssetsCount).toBe(1);
    expect(dash.facilities.openSafetyExceptions).toBe(0);

    // 4. Perform Canonical Independent Safety Re-inspection PASS ➔ OPERATIONAL
    await supabase.from('edu_fac_assets').update({ operational_status: 'OPERATIONAL' }).eq('id', assetId);

    // 5. Query Dashboard — Asset is now OPERATIONAL (0 out-of-service)
    dash = await service.getExecutiveDashboard(tenantA, todayStr);
    expect(dash.facilities.outOfServiceAssetsCount).toBe(0);
  });

  it('Invariant 4.4: Cross-Tenant Projection & Reconciliation Isolation', async () => {
    const periodId = await seedBillingPeriod(tenantA);
    const studentId = await seedStudent(tenantA);
    const invId = crypto.randomUUID();

    // Tenant A has 5,000,000 invoice
    await supabase.from('edu_fin_invoices').insert({
      id: invId,
      tenant_id: tenantA,
      student_id: studentId,
      invoice_number: 'INV-TENANT-A',
      billing_period_id: periodId,
      gross_amount: 5000000,
      net_amount: 5000000,
      invoice_status: 'ISSUED',
      settlement_status: 'UNPAID',
      due_date: '2026-09-30',
      created_by: crypto.randomUUID(),
    });

    // Tenant B is clean
    const dashA_before = await service.getExecutiveDashboard(tenantA, todayStr);
    const dashB_before = await service.getExecutiveDashboard(tenantB, todayStr);

    expect(dashA_before.finance.invoicedGrossTotal).toBe(5000000);
    expect(dashB_before.finance.invoicedGrossTotal).toBe(0);

    // Reconcile Tenant A
    const paymentId = crypto.randomUUID();
    await supabase.from('edu_fin_payments').insert({
      id: paymentId,
      tenant_id: tenantA,
      payer_party_id: crypto.randomUUID(),
      student_id: studentId,
      payment_number: 'PAY-TENANT-A',
      amount: 5000000,
      payment_method: 'BANK_TRANSFER',
      status: 'RECONCILED',
      created_by: crypto.randomUUID(),
    });

    await supabase.from('edu_fin_reconciliation_ledger').insert({
      tenant_id: tenantA,
      invoice_id: invId,
      payment_id: paymentId,
      allocated_amount: 5000000,
      reconciled_by_party_id: crypto.randomUUID(),
    });

    // Verify Tenant B remains 0
    const dashB_after = await service.getExecutiveDashboard(tenantB, todayStr);
    expect(dashB_after.finance.invoicedGrossTotal).toBe(0);
    expect(dashB_after.finance.reconciledCashCollected).toBe(0);
  });
});
