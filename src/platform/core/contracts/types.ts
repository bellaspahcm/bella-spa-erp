/**
 * Common Core — Contract Registry & Subsystem Discovery Abstractions
 * 
 * Domain-agnostic contracts for registering, discovering, and resolving engine/subsystem contracts.
 * 
 * @module platform/core/contracts
 */

export type ContractType = 'engine' | 'service' | 'api' | 'event' | 'rpc';
export type ContractStatus = 'draft' | 'active' | 'deprecated' | 'retired';

export interface ContractMetadata {
  name: string;
  version: string;
  type: ContractType;
  description: string;
  owner: string;
  status: ContractStatus;
  registeredAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface PlatformContractRegistry {
  registerContract<T = unknown>(name: string, implementation: T, metadata?: Partial<ContractMetadata>): void;
  getContract<T = unknown>(name: string): T;
  hasContract(name: string): boolean;
  getMetadata(name: string): ContractMetadata | undefined;
  listContracts(): ContractMetadata[];
  clear(): void;
}
