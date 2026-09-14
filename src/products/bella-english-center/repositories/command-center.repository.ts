/**
 * E9 - English Center Chain Command Center Repository
 *
 * Read-only repository for product-owned E2-E8 projections.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  CommandCenterAttendanceRow,
  CommandCenterClassRow,
  CommandCenterEngagementMessageRow,
  CommandCenterEngagementRecipientRow,
  CommandCenterEnrollmentRow,
  CommandCenterInvoiceRow,
  CommandCenterOperationalRows,
  CommandCenterProgressRow,
  CommandCenterSessionRow,
  CommandCenterTeacherBranchRow,
} from '../types/command-center.types';

export class ChainCommandCenterRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async loadOperationalRows(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterOperationalRows> {
    const [
      enrollments,
      classes,
      teacherBranches,
      sessions,
      attendance,
      progress,
      invoices,
      engagementMessages,
      engagementRecipients,
    ] = await Promise.all([
      this.listEnrollments(input),
      this.listClasses(input),
      this.listTeacherBranches(input),
      this.listSessions(input),
      this.listAttendance(input),
      this.listProgress(input),
      this.listInvoices(input),
      this.listEngagementMessages(input),
      this.listEngagementRecipients(input.tenantId, input.asOf),
    ]);

    return {
      enrollments,
      classes,
      teacherBranches,
      sessions,
      attendance,
      progress,
      invoices,
      engagementMessages,
      engagementRecipients,
    };
  }

  private async listEnrollments(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterEnrollmentRow[]> {
    let query = this.supabase
      .from('english_center_enrollments')
      .select('id, tenant_id, branch_id, class_id, created_at')
      .eq('tenant_id', input.tenantId)
      .lte('created_at', input.asOf);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterEnrollmentRow[];
  }

  private async listClasses(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterClassRow[]> {
    let query = this.supabase
      .from('english_center_classes')
      .select('id, tenant_id, branch_id, teacher_id, capacity, enrolled_count, status, created_at')
      .eq('tenant_id', input.tenantId)
      .lte('created_at', input.asOf);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterClassRow[];
  }

  private async listTeacherBranches(input: {
    tenantId: string;
    branchIds?: readonly string[];
  }): Promise<CommandCenterTeacherBranchRow[]> {
    let query = this.supabase
      .from('english_center_teacher_branches')
      .select('id, tenant_id, teacher_id, branch_id, status')
      .eq('tenant_id', input.tenantId);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterTeacherBranchRow[];
  }

  private async listSessions(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterSessionRow[]> {
    let query = this.supabase
      .from('english_center_class_sessions')
      .select('id, tenant_id, branch_id, class_id, teacher_id, status, starts_at, ends_at')
      .eq('tenant_id', input.tenantId)
      .lte('starts_at', input.asOf);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterSessionRow[];
  }

  private async listAttendance(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterAttendanceRow[]> {
    let query = this.supabase
      .from('english_center_session_attendance')
      .select('id, tenant_id, branch_id, english_enrollment_id, status, recorded_at')
      .eq('tenant_id', input.tenantId)
      .lte('recorded_at', input.asOf);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterAttendanceRow[];
  }

  private async listProgress(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterProgressRow[]> {
    let query = this.supabase
      .from('english_center_learning_progress')
      .select('id, tenant_id, branch_id, english_enrollment_id, progress_label, recorded_at')
      .eq('tenant_id', input.tenantId)
      .lte('recorded_at', input.asOf);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterProgressRow[];
  }

  private async listInvoices(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterInvoiceRow[]> {
    let query = this.supabase
      .from('english_center_tuition_invoices')
      .select('id, tenant_id, branch_id, settlement_status, outstanding_amount_minor, due_date, created_at')
      .eq('tenant_id', input.tenantId)
      .lte('created_at', input.asOf);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterInvoiceRow[];
  }

  private async listEngagementMessages(input: {
    tenantId: string;
    branchIds?: readonly string[];
    asOf: string;
  }): Promise<CommandCenterEngagementMessageRow[]> {
    let query = this.supabase
      .from('english_center_engagement_messages')
      .select('id, tenant_id, branch_id, acknowledgement_status, created_at')
      .eq('tenant_id', input.tenantId)
      .lte('created_at', input.asOf);

    query = this.applyBranchFilter(query, input.branchIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CommandCenterEngagementMessageRow[];
  }

  private async listEngagementRecipients(
    tenantId: string,
    asOf: string
  ): Promise<CommandCenterEngagementRecipientRow[]> {
    const { data, error } = await this.supabase
      .from('english_center_engagement_recipients')
      .select('id, tenant_id, message_id, delivery_status, created_at')
      .eq('tenant_id', tenantId)
      .lte('created_at', asOf);

    if (error) throw error;
    return (data || []) as CommandCenterEngagementRecipientRow[];
  }

  private applyBranchFilter<QueryBuilder>(
    query: QueryBuilder,
    branchIds?: readonly string[]
  ): QueryBuilder {
    if (!branchIds || branchIds.length === 0) return query;
    return (query as { in: (column: string, values: readonly string[]) => QueryBuilder })
      .in('branch_id', branchIds);
  }
}
