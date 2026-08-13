/**
 * BELLA LAND — CONTRACT PRODUCT SERVICE
 *
 * Orchestrates contract drafting and signing flows.
 * Consumes the public IPropertyContract, enforcing manifest validations.
 *
 * @module src/products/bella-land/services/contract.service
 */

import { IPropertyContract, ContractRow, InstallmentInput } from '../../../platform/real-estate/contracts/property.contract';
import { bellaLandManifest } from '../manifest';

export interface CreateContractDTO {
  tenantId: string;
  productId: string;
  customerId: string;
  contractPrice: number;
  installments: InstallmentInput[];
}

export class ContractProductService {
  constructor(private readonly propertyContract: IPropertyContract) {}

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
   * Creates a draft contract.
   */
  async createContract(dto: CreateContractDTO): Promise<ContractRow> {
    this.assertCapability('sales_contract_command');
    this.assertWorkflow('property_sales_lifecycle');

    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.productId) throw new Error('PRODUCT_BOUNDARY_VIOLATION: productId is required');

    return this.propertyContract.createContract(dto);
  }

  /**
   * Signs a contract, triggering Kernel status updates and double-entry ledger side-effects.
   */
  async signContract(tenantId: string, contractId: string): Promise<void> {
    this.assertCapability('sales_contract_command');
    this.assertWorkflow('property_sales_lifecycle');

    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!contractId) throw new Error('CONTRACT_BOUNDARY_VIOLATION: contractId is required');

    await this.propertyContract.signContract(tenantId, contractId);
  }
}
