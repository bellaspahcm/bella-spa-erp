/**
 * Bella Preschool OS — P7.2 Overdue Payment SLA Scanner & Work Queue Escalation Service
 * 
 * Domain Responsibility:
 * 1. Scans ISSUED unpaid or partially paid invoices past their due date
 * 2. Idempotently projects OVERDUE_PAYMENT_SLA exceptions to the Staff Work Queue (edu_comm_exceptions)
 * 
 * SUPREME LAWS VERIFIED:
 * - P7 Finance alone dictates PAID/UNPAID settlement truth based on reconciliation ledger entries.
 * - Marking a P6 notice as READ or resolving a Staff Exception DOES NOT mutate financial settlement status.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
type PreschoolFinanceClient = SupabaseClient<Database>;

function createDefaultFinanceClient(): PreschoolFinanceClient {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseKey) {
    throw new Error('OVERDUE_PAYMENT_SCANNER_CONFIG_ERROR: Supabase key is required.');
  }
  return createClient<Database>(supabaseUrl, supabaseKey);
}

export class OverduePaymentScannerService {
  constructor(
    private readonly client: PreschoolFinanceClient = createDefaultFinanceClient(),
  ) {}

  /**
   * Scans overdue invoices for a tenant and projects OVERDUE_PAYMENT_SLA exceptions idempotently
   */
  async scanAndEscalateOverdueInvoices(tenantId: string): Promise<{
    escalatedCount: number;
    exceptions: Array<{ invoiceId: string; exceptionId: string; isDuplicate: boolean }>;
  }> {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Query overdue invoices (ISSUED, UNPAID or PARTIALLY_PAID, due_date < today)
    const { data: overdueInvoices, error } = await this.client
      .from('edu_fin_invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('invoice_status', 'ISSUED')
      .neq('settlement_status', 'PAID')
      .lt('due_date', todayStr);

    if (error) {
      throw new Error(`FINANCE_SCANNER_ERROR: Failed to query overdue invoices: ${error.message}`);
    }

    const results: Array<{ invoiceId: string; exceptionId: string; isDuplicate: boolean }> = [];

    for (const inv of overdueInvoices || []) {
      if (!inv.student_party_id) continue;

      const { data: guardianRelationship, error: guardianError } = await this.client
        .from('party_relationships')
        .select('source_party_id')
        .eq('tenant_id', tenantId)
        .eq('target_party_id', inv.student_party_id)
        .eq('relationship_type', 'guardian_of')
        .limit(1)
        .maybeSingle();

      if (guardianError) {
        throw new Error(`FINANCE_SCANNER_ERROR: Failed to resolve invoice guardian: ${guardianError.message}`);
      }
      if (!guardianRelationship?.source_party_id) continue;

      // 2. Fetch P6 notice associated with this invoice
      const { data: notice } = await this.client
        .from('edu_comm_notices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('source_domain', 'P7_FINANCE')
        .eq('source_entity_type', 'INVOICE')
        .eq('source_entity_id', inv.id)
        .maybeSingle();

      if (!notice) continue;

      // 3. Idempotent check for active exception
      const { data: existingExc } = await this.client
        .from('edu_comm_exceptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('notice_id', notice.id)
        .eq('exception_type', 'OVERDUE_PAYMENT_SLA')
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .maybeSingle();

      if (existingExc) {
        results.push({
          invoiceId: inv.id,
          exceptionId: existingExc.id,
          isDuplicate: true,
        });
        continue;
      }

      // 4. Create Overdue Exception in Staff Work Queue
      const { data: newExc, error: excErr } = await this.client
        .from('edu_comm_exceptions')
        .insert({
          tenant_id: tenantId,
          notice_id: notice.id,
          student_id: inv.student_party_id,
          guardian_party_id: guardianRelationship.source_party_id,
          exception_type: 'OVERDUE_PAYMENT_SLA',
          severity: 'HIGH',
          assigned_role: 'ADMIN',
          status: 'OPEN',
        })
        .select()
        .single();

      if (excErr || !newExc) {
        if (excErr?.message.includes('idx_edu_comm_exceptions_idempotent') || excErr?.code === '23505') {
          // Idempotent catch
          continue;
        }
        throw new Error(`FINANCE_SCANNER_ERROR: Failed to escalate overdue exception: ${excErr?.message}`);
      }

      results.push({
        invoiceId: inv.id,
        exceptionId: newExc.id,
        isDuplicate: false,
      });
    }

    return {
      escalatedCount: results.filter((r) => !r.isDuplicate).length,
      exceptions: results,
    };
  }
}
