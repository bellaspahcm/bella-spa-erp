/**
 * CSSD Sterilization Contract (Decoupled Integration Port)
 * 
 * Defines the read-only contract for verifying equipment sterilization
 * status from external Central Sterile Services Departments (CSSD).
 * 
 * @module platform/healthcare/contracts/sterilization-contract
 */

import { EngineContract } from '../shared-kernel/types';

export interface ISterilizationContract extends EngineContract {
  /**
   * Verifies if a given CSSD sterilization token is valid and sterile.
   */
  isSterile(tenantId: string, tokenId: string): Promise<boolean>;
}

export const STERILIZATION_CONTRACT_NAME = 'sterilization-contract';
