/**
 * @fileoverview Contract Engine — Business Commitment Lifecycle
 *
 * Manages long-term commitments between parties across all verticals.
 * A Contract is the formal agreement/commitment that binds a Journey
 * to a set of deliverables, payments, or services.
 *
 * Vertical examples:
 * - Healthcare:   Treatment Plan Contract, BHYT Coverage, Package/Membership
 * - Auto:         Repair Order, Warranty Contract, Installment Plan
 * - Real Estate:  Deposit Contract, Sale Contract, Lease Agreement
 * - Beauty/Spa:   Membership Card, Service Package, Subscription
 *
 * Contract vs Invoice distinction:
 * - Contract: The AGREEMENT (what will be done and how much)
 * - Invoice:  The BILLING (what was done and payment request)
 *
 * @module platform/contract
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ContractType =
  // Healthcare
  | 'treatment_plan'
  | 'bhyt_coverage'
  | 'health_membership'
  | 'service_package'
  // Auto
  | 'repair_order'
  | 'warranty'
  | 'extended_warranty'
  | 'installment_plan'
  // Real Estate
  | 'deposit_agreement'
  | 'sale_contract'
  | 'lease_agreement'
  // Beauty/Spa
  | 'spa_membership'
  | 'spa_package'
  | string;

export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'suspended'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type PaymentScheduleFrequency = 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface PaymentSchedule {
  readonly frequency: PaymentScheduleFrequency;
  readonly installments?: number;
  readonly amountPerInstallment?: number;
  readonly dueDay?: number;        // Day of month for monthly payments
  readonly nextDueDate?: Date;
}

export interface ContractParty {
  readonly partyId: string;
  readonly role: 'provider' | 'client' | 'guarantor' | 'insurer';
}

export interface ContractLineItem {
  readonly code: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discount?: number;
  readonly subtotal: number;
}

export interface Contract {
  readonly id: string;
  readonly tenantId: string;
  readonly vertical: string;
  readonly contractType: ContractType;
  readonly contractNumber?: string;
  /** All parties to this contract */
  readonly parties: ContractParty[];
  /** The Journey this contract belongs to (optional) */
  readonly journeyId?: string;
  readonly status: ContractStatus;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly totalValue?: number;
  readonly currency: string;
  readonly paymentSchedule?: PaymentSchedule;
  readonly lineItems: ContractLineItem[];
  readonly terms: Record<string, unknown>;  // Contract-specific terms (BHYT %, warranty period...)
  readonly signedAt?: Date;
  readonly signedBy?: string;
  // Auditing & Optimistic Locking
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
  readonly createdBy?: string;
}

export interface CreateContractInput {
  readonly vertical: string;
  readonly contractType: ContractType;
  readonly contractNumber?: string;
  readonly parties: ContractParty[];
  readonly journeyId?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly totalValue?: number;
  readonly currency?: string;
  readonly paymentSchedule?: PaymentSchedule;
  readonly lineItems?: ContractLineItem[];
  readonly terms?: Record<string, unknown>;
}

export interface ContractFilter {
  readonly vertical?: string;
  readonly contractType?: ContractType;
  readonly partyId?: string;
  readonly journeyId?: string;
  readonly status?: ContractStatus;
  readonly limit?: number;
  readonly offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface IContractRepository {
  create(tenantId: string, input: CreateContractInput, actorId: string): Promise<Contract>;
  findById(tenantId: string, id: string): Promise<Contract | null>;
  findMany(tenantId: string, filter?: ContractFilter): Promise<Contract[]>;
  activate(tenantId: string, contractId: string, expectedVersion: number, actorId: string): Promise<Contract>;
  suspend(tenantId: string, contractId: string, reason: string, expectedVersion: number, actorId: string): Promise<Contract>;
  complete(tenantId: string, contractId: string, expectedVersion: number, actorId: string): Promise<Contract>;
  cancel(tenantId: string, contractId: string, reason: string, expectedVersion: number, actorId: string): Promise<Contract>;
  markSigned(tenantId: string, contractId: string, signedBy: string, expectedVersion: number): Promise<Contract>;
  softDelete(tenantId: string, contractId: string, actorId: string): Promise<void>;
}

/**
 * ContractEngine — Business Commitment Lifecycle Management.
 *
 * Manages the lifecycle of formal agreements between parties.
 * Prevents each vertical from building their own contract management
 * by providing a shared, versioned, auditable contract system.
 */
class ContractEngine {
  private repository: IContractRepository | null = null;

  setRepository(repo: IContractRepository): void {
    this.repository = repo;
  }

  private get repo(): IContractRepository {
    if (!this.repository) {
      throw new Error('[ContractEngine] Repository not initialized. Call setRepository() first via CompositionEngine.');
    }
    return this.repository;
  }

  /** Draft a new contract */
  async draft(tenantId: string, input: CreateContractInput, actorId: string): Promise<Contract> {
    return this.repo.create(tenantId, input, actorId);
  }

  /** Get contract by ID */
  async getById(tenantId: string, id: string): Promise<Contract | null> {
    return this.repo.findById(tenantId, id);
  }

  /** Get all contracts for a party (in any role) */
  async getByParty(tenantId: string, partyId: string, filter?: Partial<ContractFilter>): Promise<Contract[]> {
    return this.repo.findMany(tenantId, { ...filter, partyId });
  }

  /** Get contracts linked to a Journey */
  async getByJourney(tenantId: string, journeyId: string): Promise<Contract[]> {
    return this.repo.findMany(tenantId, { journeyId });
  }

  /** Activate a signed contract */
  async activate(tenantId: string, contractId: string, expectedVersion: number, actorId: string): Promise<Contract> {
    return this.repo.activate(tenantId, contractId, expectedVersion, actorId);
  }

  /** Mark contract as signed (e.g. after digital signature received) */
  async markSigned(tenantId: string, contractId: string, signedBy: string, expectedVersion: number): Promise<Contract> {
    return this.repo.markSigned(tenantId, contractId, signedBy, expectedVersion);
  }

  /** Complete a fulfilled contract */
  async complete(tenantId: string, contractId: string, expectedVersion: number, actorId: string): Promise<Contract> {
    return this.repo.complete(tenantId, contractId, expectedVersion, actorId);
  }

  /** Cancel a contract with reason */
  async cancel(tenantId: string, contractId: string, reason: string, expectedVersion: number, actorId: string): Promise<Contract> {
    return this.repo.cancel(tenantId, contractId, reason, expectedVersion, actorId);
  }
}

export const contractEngine = new ContractEngine();
