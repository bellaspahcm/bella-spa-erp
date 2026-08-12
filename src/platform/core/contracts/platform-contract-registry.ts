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

  public registerContract<T = unknown>(
    nameOrMeta: string | (Partial<ContractMetadata> & { name: string; implementation?: unknown }),
    implementation?: T,
    metadata?: Partial<ContractMetadata>
  ): void {
    let name: string;
    let impl: unknown;
    let metaPartial: Partial<ContractMetadata> | undefined;

    if (typeof nameOrMeta === 'object' && nameOrMeta !== null) {
      name = nameOrMeta.name;
      impl = nameOrMeta.implementation || nameOrMeta;
      metaPartial = nameOrMeta;
    } else {
      name = nameOrMeta;
      impl = implementation;
      metaPartial = metadata;
    }

    if (!name || !impl) {
      throw new Error('Contract name and implementation must be provided');
    }

    this.contracts.set(name, impl);

    const now = new Date().toISOString();
    const meta: ContractMetadata = {
      name,
      version: metaPartial?.version || '1.0.0',
      type: metaPartial?.type || 'engine',
      description: metaPartial?.description || `Contract implementation for ${name}`,
      owner: metaPartial?.owner || 'platform',
      status: metaPartial?.status || 'active',
      registeredAt: metaPartial?.registeredAt || now,
      updatedAt: now,
      metadata: metaPartial?.metadata,
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
