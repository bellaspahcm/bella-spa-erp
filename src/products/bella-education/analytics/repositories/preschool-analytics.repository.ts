/**
 * Bella Preschool OS — Preschool Analytics Persistence Repository (P10)
 * File: src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts
 *
 * Provides read-only query access across P1–P9 domain tables with mandatory tenant_id isolation.
 * Supreme Architectural Law: Analytics owns metrics/projections, NEVER operational truth.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export class PreschoolAnalyticsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // 1. Enrollment Metrics (P1/P3)
  async getEnrollmentRawData(tenantId: string) {
    // Primary student table in Education Platform is `students`
    let { data: students } = await this.supabase
      .from('students')
      .select('student_id, academic_status, metadata')
      .eq('tenant_id', tenantId)
      .in('academic_status', ['enrolled', 'ENROLLED']);

    if (!students || students.length === 0) {
      const { data: fallbackStudents } = await this.supabase
        .from('edu_students')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .in('status', ['ENROLLED', 'enrolled']);
      if (fallbackStudents) students = fallbackStudents as any[];
    }

    // Try preschool_classrooms first, fallback to edu_classrooms / courses
    let { data: classrooms } = await this.supabase
      .from('preschool_classrooms')
      .select('id, name, max_capacity')
      .eq('tenant_id', tenantId);

    if (!classrooms || classrooms.length === 0) {
      const { data: fallbackRooms } = await this.supabase
        .from('edu_classrooms')
        .select('id, name, max_capacity')
        .eq('tenant_id', tenantId);
      if (fallbackRooms) classrooms = fallbackRooms as any[];
    }

    return {
      enrolledStudents: students || [],
      classrooms: classrooms || [],
    };
  }

  // 2. Attendance Metrics (P3)
  async getAttendanceRawData(tenantId: string, dateStr: string) {
    // Try edu_daily_care_records first
    let { data: attendance } = await this.supabase
      .from('edu_daily_care_records')
      .select('id, student_id, attendance_status, record_date')
      .eq('tenant_id', tenantId)
      .eq('record_date', dateStr);

    if (!attendance || attendance.length === 0) {
      const { data: fallbackAtt } = await this.supabase
        .from('edu_care_daily_records')
        .select('id, student_id, attendance_status, record_date')
        .eq('tenant_id', tenantId)
        .eq('record_date', dateStr);
      if (fallbackAtt) attendance = fallbackAtt as any[];
    }

    return attendance || [];
  }

  // 3. Care & Safety Metrics (P4)
  async getCareSafetyRawData(tenantId: string, dateStr: string) {
    const [{ data: incidents }, { data: medLogs }] = await Promise.all([
      this.supabase.from('edu_care_health_incidents').select('id, status').eq('tenant_id', tenantId).in('status', ['REPORTED', 'UNDER_OBSERVATION']),
      this.supabase.from('edu_care_medication_logs').select('id, status, scheduled_date').eq('tenant_id', tenantId).eq('scheduled_date', dateStr).eq('status', 'SCHEDULED'),
    ]);

    return {
      activeIncidents: incidents || [],
      pendingMedications: medLogs || [],
    };
  }

  // 4. Learning & Development Metrics (P5)
  async getLearningRawData(tenantId: string) {
    const [{ data: draftPortfolios }, { data: pendingObservations }] = await Promise.all([
      this.supabase.from('edu_dev_portfolio_versions').select('id, status').eq('tenant_id', tenantId).eq('status', 'DRAFT'),
      this.supabase.from('edu_dev_observations').select('id, verification_status').eq('tenant_id', tenantId).eq('verification_status', 'PENDING'),
    ]);

    return {
      draftPortfolios: draftPortfolios || [],
      pendingObservations: pendingObservations || [],
    };
  }

  // 5. Parent Engagement Metrics (P6)
  async getParentEngagementRawData(tenantId: string) {
    const { data: deliveries } = await this.supabase
      .from('edu_comm_deliveries')
      .select(`
        id, 
        delivery_status, 
        notice:edu_comm_notices!inner(policy_requirement)
      `)
      .eq('tenant_id', tenantId)
      .in('delivery_status', ['SENT', 'READ']);

    return deliveries || [];
  }

  // 6. Finance & Billing Metrics (P7)
  async getFinanceRawData(tenantId: string, dateStr: string) {
    const [{ data: invoices }, { data: reconciliations }] = await Promise.all([
      this.supabase.from('edu_fin_invoices').select('id, gross_amount, net_amount, invoice_status, settlement_status, due_date').eq('tenant_id', tenantId).eq('invoice_status', 'ISSUED'),
      this.supabase.from('edu_fin_reconciliation_ledger').select('id, invoice_id, allocated_amount').eq('tenant_id', tenantId),
    ]);

    return {
      invoices: invoices || [],
      reconciliations: reconciliations || [],
    };
  }

  // 7. Workforce & Scheduling Metrics (P8)
  async getWorkforceRawData(tenantId: string, dateStr: string) {
    const [{ data: nonCompliantSnapshots }, { data: staffingExceptions }] = await Promise.all([
      this.supabase.from('edu_sched_compliance_snapshots').select('id, compliance_state, snapshot_date').eq('tenant_id', tenantId).eq('snapshot_date', dateStr).neq('compliance_state', 'COMPLIANT'),
      this.supabase.from('edu_comm_exceptions').select('id, exception_type, status').eq('tenant_id', tenantId).eq('exception_type', 'RATIO_SHORTAGE').eq('status', 'OPEN'),
    ]);

    return {
      activeViolations: nonCompliantSnapshots || [],
      openExceptions: staffingExceptions || [],
    };
  }

  // 8. Facilities & Maintenance Metrics (P9)
  async getFacilitiesRawData(tenantId: string, dateStr: string) {
    const [{ data: unhealthyAssets }, { data: unhealthyZones }, { data: overdueSchedules }, { data: safetyExceptions }] = await Promise.all([
      this.supabase.from('edu_fac_assets').select('id, operational_status').eq('tenant_id', tenantId).in('operational_status', ['OUT_OF_SERVICE', 'UNDER_INSPECTION']),
      this.supabase.from('edu_fac_zones').select('id, operational_status').eq('tenant_id', tenantId).eq('operational_status', 'OUT_OF_SERVICE'),
      this.supabase.from('edu_fac_inspection_schedules').select('id, next_due_date').eq('tenant_id', tenantId).lt('next_due_date', dateStr),
      this.supabase.from('edu_comm_exceptions').select('id, exception_type, status').eq('tenant_id', tenantId).eq('exception_type', 'SAFETY_DEFECT').eq('status', 'OPEN'),
    ]);

    return {
      unhealthyAssets: unhealthyAssets || [],
      unhealthyZones: unhealthyZones || [],
      overdueSchedules: overdueSchedules || [],
      safetyExceptions: safetyExceptions || [],
    };
  }
}
