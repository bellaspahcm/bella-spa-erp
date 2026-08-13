/**
 * Real Estate Kernel — Property Contract Public Contract
 *
 * Defines the public sales contract for generating and signing buy-sale property agreements.
 *
 * @module platform/real-estate/contracts/property.contract
 */

import type { Database } from '@/types/database.types';

export type ContractRow = Database['public']['Tables']['re_contracts']['Row'];

export interface InstallmentInput {
  dueDate: string;
  percentage: number;
}

export interface IPropertyContract {
  /**
   * Creates a draft contract with payment installment schedules linked to a product.
   */
  createContract(params: {
    tenantId: string;
    productId: string;
    customerId: string;
    contractPrice: number;
    installments: InstallmentInput[];
  }): Promise<ContractRow>;

  /**
   * Signs the contract, transitioning the property inventory state to CONTRACTED inside the Kernel
   * and emitting financial outbox events to the Accounting system.
   */
  signContract(tenantId: string, contractId: string): Promise<void>;
}
