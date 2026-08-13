/**
 * Real Estate Kernel — Commission Public Contract
 *
 * Defines the public contract for calculating and managing sales agent commissions.
 *
 * @module platform/real-estate/contracts/commission.contract
 */

import type { Database } from '@/types/database.types';

export type CommissionRow = Database['public']['Tables']['re_commissions']['Row'];

export interface ICommissionContract {
  /**
   * Calculates commissions for a signed contract based on agent allocation policies,
   * inserting pending entries into the database.
   */
  calculateCommission(tenantId: string, contractId: string): Promise<CommissionRow>;
}
