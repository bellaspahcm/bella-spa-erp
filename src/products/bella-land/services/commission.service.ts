/**
 * BELLA LAND — COMMISSION PRODUCT SERVICE
 *
 * Coordinates agent commission calculations for signed contracts.
 * Consumes the public ICommissionContract, enforcing manifest validations.
 *
 * @module src/products/bella-land/services/commission.service
 */

import { ICommissionContract, CommissionRow } from '../../../platform/real-estate/contracts/commission.contract';
import { bellaLandManifest } from '../manifest';

export class CommissionProductService {
  constructor(private readonly commissionContract: ICommissionContract) {}

  private assertCapability(capabilityId: string) {
    const capabilities = bellaLandManifest.capabilities || [];
    if (!capabilities.includes(capabilityId)) {
      throw new Error(`MANIFEST_VIOLATION: Capability '${capabilityId}' is not enabled in product manifest.`);
    }
  }

  private assertWorkflow(workflowId: string) {
    const workflows = bellaLandManifest.workflows || [];
    if (!workflows.includes(workflowId)) {
      throw new Error(`MANIFEST_VIOLATION: Workflow '${workflowId}' is not enabled in product manifest.`);
    }
  }

  /**
   * Triggers commission calculation inside the Kernel for a signed contract.
   */
  async calculateCommission(tenantId: string, contractId: string): Promise<CommissionRow> {
    this.assertCapability('commission_policy_command');
    this.assertWorkflow('property_sales_lifecycle');

    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!contractId) throw new Error('CONTRACT_BOUNDARY_VIOLATION: contractId is required');

    return this.commissionContract.calculateCommission(tenantId, contractId);
  }
}
