/**
 * Common Core — Platform Contract Registry Implementation
 * 
 * In-memory thread-safe registry for binding and resolving engine contracts across industries.
 * 
 * @module platform/core/contracts/platform-contract-registry
 */

import { ContractMetadata, PlatformContractRegistry } from './types';

export class CoreContractRegistry implements PlatformContractRegistry {
  private contracts = new Map<string, unknown>();
  private metadataMap = new Map<string, ContractMetadata>();

  public registerContract<T = unknown>(name: string, implementation: T, metadata?: Partial<ContractMetadata>): void {
    if (!name || !implementation) {
      throw new Error('Contract name and implementation must be provided');
    }

    this.contracts.set(name, implementation);

    const now = new Date().toISOString();
    const meta: ContractMetadata = {
      name,
      version: metadata?.version || '1.0.0',
      type: metadata?.type || 'engine',
      description: metadata?.description || `Contract implementation for ${name}`,
      owner: metadata?.owner || 'platform',
      status: metadata?.status || 'active',
      registeredAt: metadata?.registeredAt || now,
      updatedAt: now,
      metadata: metadata?.metadata,
    };

    this.metadataMap.set(name, meta);
  }

  public getContract<T = unknown>(name: string): T {
    const contract = this.contracts.get(name);
    if (!contract) {
      throw new Error(`Contract '${name}' not found in Platform Contract Registry`);
    }
    return contract as T;
  }

  public hasContract(name: string): boolean {
    return this.contracts.has(name);
  }

  public getMetadata(name: string): ContractMetadata | undefined {
    return this.metadataMap.get(name);
  }

  public listContracts(): ContractMetadata[] {
    return Array.from(this.metadataMap.values());
  }

  public clear(): void {
    this.contracts.clear();
    this.metadataMap.clear();
  }
}
