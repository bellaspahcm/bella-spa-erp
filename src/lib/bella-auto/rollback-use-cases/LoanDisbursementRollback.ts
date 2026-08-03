/**
 * Bella Auto - Loan Disbursement Rollback Use Case
 * 
 * Business Flow:
 * 1. Customer applies for financing (70% loan, 30% down payment)
 * 2. Bank approves loan
 * 3. Loan disbursed → Impact: Revenue (bank payment received), Contract (update status), Commission
 * 
 * Rollback Scenario:
 * - Bank disbursement reversed (fraud detected, wrong account)
 * - Customer cancels before delivery
 * - Loan terms changed mid-process
 * - Need to revert revenue recognition and commission
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRollbackEngine } from '../engines/BusinessRollbackEngine';

export interface LoanDisbursementData {
  loanId: string;
  contractId: string;
  customerId: string;
  vehicleId: string;
  bankName: string;
  loanAmount: number;
  loanTerm: number; // months
  interestRate: number; // %
  monthlyPayment: number;
  disbursedAt: string;
  disbursedBy: string;
  salesPersonId: string;
  salesCommission: number;
}

export class LoanDisbursementRollback {
  private engine: BusinessRollbackEngine;

  constructor(private supabase: SupabaseClient) {
    this.engine = new BusinessRollbackEngine(supabase);
  }

  /**
   * Register loan disbursement transaction
   */
  async registerLoanDisbursement(
    tenantId: string,
    data: LoanDisbursementData,
    userId: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Create transaction
      const { data: transaction, error: txError } = await this.supabase
        .from('auto_business_transactions')
        .insert({
          tenant_id: tenantId,
          transaction_type: 'loan_disbursement',
          entity_type: 'auto_loan',
          entity_id: data.loanId,
          status: 'completed',
          metadata: {
            customer_id: data.customerId,
            contract_id: data.contractId,
            bank_name: data.bankName,
            loan_amount: data.loanAmount,
            created_by_email: userId,
          },
        })
        .select()
        .single();

      if (txError || !transaction) {
        return { success: false, error: txError?.message || 'Failed to create transaction' };
      }

      const steps = [];
      let stepOrder = 1;

      // Step 1: Create loan record
      const loanRecord = {
        id: data.loanId,
        tenant_id: tenantId,
        contract_id: data.contractId,
        customer_id: data.customerId,
        vehicle_id: data.vehicleId,
        bank_name: data.bankName,
        loan_amount: data.loanAmount,
        loan_term: data.loanTerm,
        interest_rate: data.interestRate,
        monthly_payment: data.monthlyPayment,
        status: 'disbursed',
        disbursed_at: data.disbursedAt,
        disbursed_by: data.disbursedBy,
      };

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_loans',
        target_record_id: data.loanId,
        before_snapshot: null,
        after_snapshot: loanRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 2: Update contract with loan info
      const { data: contract } = await this.supabase
        .from('auto_bookings')
        .select('*')
        .eq('id', data.contractId)
        .single();

      if (contract) {
        const beforeSnapshot = { ...contract };
        const afterSnapshot = {
          ...contract,
          financing_method: 'bank_loan',
          loan_amount: data.loanAmount,
          down_payment: contract.total_price - data.loanAmount,
          payment_status: 'financed',
          updated_at: new Date().toISOString(),
        };

        await this.supabase
          .from('auto_bookings')
          .update({
            financing_method: afterSnapshot.financing_method,
            loan_amount: afterSnapshot.loan_amount,
            down_payment: afterSnapshot.down_payment,
            payment_status: afterSnapshot.payment_status,
          })
          .eq('id', contract.id);

        steps.push({
          transaction_id: transaction.id,
          step_order: stepOrder++,
          action_type: 'UPDATE',
          target_table: 'auto_bookings',
          target_record_id: contract.id,
          before_snapshot: beforeSnapshot,
          after_snapshot: afterSnapshot,
          status: 'executed',
          executed_at: new Date().toISOString(),
        });
      }

      // Step 3: Create revenue record (bank payment)
      const revenueId = crypto.randomUUID();
      const revenueRecord = {
        id: revenueId,
        tenant_id: tenantId,
        transaction_type: 'loan_disbursement',
        entity_id: data.loanId,
        customer_id: data.customerId,
        amount: data.loanAmount,
        recorded_at: data.disbursedAt,
        status: 'confirmed',
        payment_method: 'bank_transfer',
        payer: data.bankName,
      };

      await this.supabase.from('auto_revenue').insert(revenueRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_revenue',
        target_record_id: revenueId,
        before_snapshot: null,
        after_snapshot: revenueRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 4: Create sales commission
      const commissionId = crypto.randomUUID();
      const commissionRecord = {
        id: commissionId,
        tenant_id: tenantId,
        sales_person_id: data.salesPersonId,
        transaction_type: 'loan_disbursement',
        entity_id: data.loanId,
        contract_id: data.contractId,
        commission_amount: data.salesCommission,
        commission_rate: (data.salesCommission / data.loanAmount) * 100,
        status: 'pending',
        earned_at: data.disbursedAt,
      };

      await this.supabase.from('auto_commissions').insert(commissionRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_commissions',
        target_record_id: commissionId,
        before_snapshot: null,
        after_snapshot: commissionRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 5: Create accounting entry (debit bank, credit revenue)
      const accountingId = crypto.randomUUID();
      const accountingRecord = {
        id: accountingId,
        tenant_id: tenantId,
        transaction_type: 'loan_disbursement',
        entity_id: data.loanId,
        debit_account: '1121', // Tiền gửi ngân hàng
        credit_account: '5111', // Doanh thu bán xe
        amount: data.loanAmount,
        description: `Giải ngân từ ${data.bankName} - Hợp đồng ${data.contractId}`,
        transaction_date: data.disbursedAt,
        status: 'confirmed',
      };

      await this.supabase.from('auto_accounting_entries').insert(accountingRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_accounting_entries',
        target_record_id: accountingId,
        before_snapshot: null,
        after_snapshot: accountingRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 6: Create journey touchpoint
      const touchpointId = crypto.randomUUID();
      const touchpointRecord = {
        id: touchpointId,
        tenant_id: tenantId,
        customer_id: data.customerId,
        channel: 'financing',
        direction: 'inbound',
        title: `Giải ngân vay: ${data.bankName}`,
        content: `Số tiền: ${data.loanAmount.toLocaleString()}đ, Kỳ hạn: ${data.loanTerm} tháng`,
        interacted_at: data.disbursedAt,
        staff_id: data.disbursedBy,
      };

      await this.supabase.from('auto_touchpoints').insert(touchpointRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_touchpoints',
        target_record_id: touchpointId,
        before_snapshot: null,
        after_snapshot: touchpointRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Insert all steps
      const { error: stepsError } = await this.supabase
        .from('auto_transaction_steps')
        .insert(steps);

      if (stepsError) {
        return { success: false, error: stepsError.message };
      }

      return { success: true, transactionId: transaction.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Rollback loan disbursement
   */
  async rollbackLoanDisbursement(
    transactionId: string,
    reason: string,
    userId: string,
    userEmail: string
  ): Promise<{ success: boolean; error?: string; stepsRolledBack?: number }> {
    return this.engine.executeRollback({
      transactionId,
      reason,
      executedBy: userId,
      executedByEmail: userEmail,
    });
  }
}
