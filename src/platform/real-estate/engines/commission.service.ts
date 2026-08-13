/**
 * Real Estate Kernel — Commission Engine Service
 *
 * Implements ICommissionContract, calculating sales commission allocations
 * triggered by active property contracts.
 *
 * @module platform/real-estate/engines/commission.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ICommissionContract, CommissionRow } from '../contracts/commission.contract';
import type { Database } from '@/types/database.types';

export class CommissionService implements ICommissionContract {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Calculates agent commission (defaulting to 2% base rate) and saves pending transaction.
   */
  async calculateCommission(tenantId: string, contractId: string): Promise<CommissionRow> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');

    // 1. Fetch active contract details
    const { data: contract, error: contractError } = await this.supabase
      .from('re_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('tenant_id', tenantId)
      .single();

    if (contractError || !contract) {
      throw new Error(`DATABASE_ERROR: Failed to load contract for commission check: ${contractError?.message || 'Not found'}`);
    }

    if (contract.state !== 'ACTIVE') {
      throw new Error(`COMMISSION_VIOLATION: Cannot calculate commission for inactive contract status: ${contract.state}`);
    }

    // 2. Resolve agent ID (defaulting to a system agent or user if available)
    const agentId = '00000000-0000-0000-0000-000000000000'; // Default system agent fallback
    const baseAmount = contract.contract_price;
    const commissionRate = 2.0; // 2% flat rate
    const commissionAmount = Math.round(baseAmount * (commissionRate / 100));

    // 3. Save pending commission record
    const { data, error } = await this.supabase
      .from('re_commissions')
      .insert({
        tenant_id: tenantId,
        contract_id: contractId,
        agent_id: agentId,
        base_amount: baseAmount,
        commission_amount: commissionAmount,
        status: 'pending'
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`DATABASE_ERROR: Failed to register commission record: ${error.message}`);
    }

    return data;
  }
}
