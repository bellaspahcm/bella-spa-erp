/**
 * Real Estate Kernel — Property Contract Service
 *
 * Implements IPropertyContract, handling contract creation, signing transitions,
 * and double-entry ledger generation via the shared IAccountingContract.
 *
 * @module platform/real-estate/engines/property.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IPropertyContract, ContractRow, InstallmentInput } from '../contracts/property.contract';
import { PropertyUnitRepository } from '../repositories/property-unit.repository';
import { IAccountingContract } from '../../accounting/contracts/accounting.contract';
import type { Database } from '@/types/database.types';

export class PropertyService implements IPropertyContract {
  constructor(
    private readonly repository: PropertyUnitRepository,
    private readonly accountingContract: IAccountingContract,
    private readonly supabase: SupabaseClient<Database>
  ) {}

  /**
   * Creates a draft buy-sale contract.
   */
  async createContract(params: {
    tenantId: string;
    productId: string;
    customerId: string;
    contractPrice: number;
    installments: InstallmentInput[];
  }): Promise<ContractRow> {
    if (!params.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!params.productId) throw new Error('PRODUCT_BOUNDARY_VIOLATION: productId is required');

    // 1. Verify property unit exists
    const unit = await this.repository.findById(this.supabase, params.tenantId, params.productId);
    if (!unit) throw new Error('Product unit not found');

    // 2. Insert draft contract
    const contractNo = `HĐMB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error } = await this.supabase
      .from('re_contracts')
      .insert({
        tenant_id: params.tenantId,
        product_id: params.productId,
        customer_id: params.customerId,
        contract_number: contractNo,
        contract_price: params.contractPrice,
        state: 'DRAFT',
        installments: params.installments as unknown as Database['public']['Tables']['re_contracts']['Insert']['installments']
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`DATABASE_ERROR: Failed to create contract record: ${error.message}`);
    }

    return data;
  }

  /**
   * Signs a contract, transition status of unit to CONTRACTED and posts ledger double-entries.
   */
  async signContract(tenantId: string, contractId: string): Promise<void> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');

    // 1. Fetch contract
    const { data: contract, error: contractError } = await this.supabase
      .from('re_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('tenant_id', tenantId)
      .single();

    if (contractError || !contract) {
      throw new Error(`DATABASE_ERROR: Failed to load contract or invalid tenant: ${contractError?.message || 'Not found'}`);
    }

    // 2. Fetch property unit
    const unit = await this.repository.findById(this.supabase, tenantId, contract.product_id);
    if (!unit) throw new Error('Associated product unit not found');

    // 3. Perform FSM transition check inside Domain aggregate root: BOOKED/DEPOSITED -> CONTRACTED
    // (If the unit is currently booked or deposited, transition it to contracted)
    if (unit.status === 'booked') {
      unit.depositPaid();
    }
    unit.signContract();

    // 4. Save unit state back to database
    await this.repository.save(this.supabase, unit);

    // 5. Update contract state to ACTIVE
    const { error: updateError } = await this.supabase
      .from('re_contracts')
      .update({
        state: 'ACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('id', contractId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw new Error(`DATABASE_ERROR: Failed to update contract state: ${updateError.message}`);
    }

    // 6. Post double-entry ledger to Accounting Kernel via Shared Accounting Contract
    // Debit Account 131 (Accounts Receivable) / Credit Account 5111 (Property Sales Revenue)
    const ledgerResult = await this.accountingContract.postJournalEntry({
      tenantId,
      description: `Ghi nhận doanh thu ký Hợp đồng Mua bán số ${contract.contract_number}`,
      referenceType: 'contract',
      referenceId: contractId,
      lines: [
        { accountCode: '131', debitAmount: contract.contract_price, creditAmount: 0 },
        { accountCode: '5111', debitAmount: 0, creditAmount: contract.contract_price }
      ]
    });

    if (!ledgerResult.success) {
      throw new Error(`LEDGER_POSTING_FAILED: Failed to post journal entry: ${ledgerResult.error}`);
    }
  }
}
