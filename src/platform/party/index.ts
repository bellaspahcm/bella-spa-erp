/**
 * @fileoverview Party Engine — Identity Aggregate
 *
 * Manages the identity of all entities across all verticals:
 * - Healthcare: Patient, Doctor, Nurse, Hospital, Insurer
 * - Auto: Buyer, Dealer, Technician, Workshop
 * - Real Estate: Investor, Developer, Broker
 *
 * Party is the IDENTITY aggregate only.
 * Business state lives in Journey (not here).
 *
 * @module platform/party
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type PartyType = 'person' | 'organization';

export type RelationshipType =
  | 'parent_of'
  | 'child_of'
  | 'guardian_of'
  | 'works_for'
  | 'member_of'
  | 'owner_of'
  | 'referred_by'
  | 'belongs_to'
  | 'insures'
  | 'manages'
  | string;

export type IdentifierType =
  | 'cccd'
  | 'passport'
  | 'bhyt'
  | 'tax_id'
  | 'external_his_id'
  | 'crm_id'
  | 'license_number'
  | 'employee_code'
  | string;

export interface PartyIdentifier {
  readonly type: IdentifierType;
  readonly value: string;
  readonly issuedAt?: Date;
  readonly expiresAt?: Date;
}

export interface PartyRole {
  readonly vertical: string;         // 'healthcare' | 'auto' | 'real_estate'
  readonly roleType: string;         // 'patient' | 'doctor' | 'buyer' | 'technician'
  readonly attributes: Record<string, unknown>;  // role-specific metadata
  readonly activeFrom?: Date;
  readonly activeTo?: Date;
}

export interface PartyRelationship {
  readonly targetPartyId: string;
  readonly type: RelationshipType;
  readonly attributes?: Record<string, unknown>;
  readonly activeFrom?: Date;
  readonly activeTo?: Date;
}

export interface Party {
  readonly id: string;
  readonly tenantId: string;
  readonly partyType: PartyType;
  readonly displayName: string;
  readonly legalName?: string;
  readonly taxCode?: string;
  // Person-specific
  readonly dob?: Date;
  readonly gender?: 'male' | 'female' | 'other';
  readonly bloodType?: string;
  // Dynamic external identifiers (CCCD, BHYT, Passport...)
  readonly identifiers: PartyIdentifier[];
  // Roles across verticals
  readonly roles: PartyRole[];
  // Relationships (Guardian, Works For, Parent...)
  readonly relationships: PartyRelationship[];
  // Auditing & Optimistic Locking
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

export interface CreatePartyInput {
  readonly partyType: PartyType;
  readonly displayName: string;
  readonly legalName?: string;
  readonly taxCode?: string;
  readonly dob?: Date;
  readonly gender?: 'male' | 'female' | 'other';
  readonly bloodType?: string;
  readonly initialRole?: Omit<PartyRole, 'attributes'> & { attributes?: Record<string, unknown> };
  readonly initialIdentifiers?: PartyIdentifier[];
}

export interface AddRoleInput {
  readonly partyId: string;
  readonly vertical: string;
  readonly roleType: string;
  readonly attributes?: Record<string, unknown>;
  readonly activeFrom?: Date;
  readonly activeTo?: Date;
}

export interface AddRelationshipInput {
  readonly sourcePartyId: string;
  readonly targetPartyId: string;
  readonly type: RelationshipType;
  readonly attributes?: Record<string, unknown>;
}

export interface PartySearchFilter {
  readonly partyType?: PartyType;
  readonly vertical?: string;
  readonly roleType?: string;
  readonly identifierType?: IdentifierType;
  readonly identifierValue?: string;
  readonly displayNameLike?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTY ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface IPartyRepository {
  create(tenantId: string, input: CreatePartyInput, actorId: string): Promise<Party>;
  findById(tenantId: string, id: string): Promise<Party | null>;
  findByIdentifier(tenantId: string, type: IdentifierType, value: string): Promise<Party | null>;
  search(tenantId: string, filter: PartySearchFilter): Promise<Party[]>;
  addRole(tenantId: string, input: AddRoleInput, actorId: string): Promise<Party>;
  addRelationship(tenantId: string, input: AddRelationshipInput, actorId: string): Promise<void>;
  update(tenantId: string, partyId: string, patch: Partial<CreatePartyInput>, expectedVersion: number, actorId: string): Promise<Party>;
  softDelete(tenantId: string, partyId: string, actorId: string): Promise<void>;
}

/**
 * PartyEngine — Identity Aggregate management for all verticals.
 *
 * Usage:
 *   const party = await partyEngine.register(ctx, { partyType: 'person', displayName: 'Nguyễn Văn A' });
 */
class PartyEngine {
  private repository: IPartyRepository | null = null;

  /** Register a repository implementation (injected at bootstrap by Composition Engine) */
  setRepository(repo: IPartyRepository): void {
    this.repository = repo;
  }

  private get repo(): IPartyRepository {
    if (!this.repository) {
      throw new Error('[PartyEngine] Repository not initialized. Call setRepository() first via CompositionEngine.');
    }
    return this.repository;
  }

  /** Register a new Party (Person or Organization) */
  async register(
    tenantId: string,
    input: CreatePartyInput,
    actorId: string
  ): Promise<Party> {
    return this.repo.create(tenantId, input, actorId);
  }

  /** Find Party by ID */
  async findById(tenantId: string, id: string): Promise<Party | null> {
    return this.repo.findById(tenantId, id);
  }

  /** Find Party by an external identifier (CCCD, BHYT, HIS ID...) */
  async findByIdentifier(
    tenantId: string,
    type: IdentifierType,
    value: string
  ): Promise<Party | null> {
    return this.repo.findByIdentifier(tenantId, type, value);
  }

  /** Search parties by filter criteria */
  async search(tenantId: string, filter: PartySearchFilter): Promise<Party[]> {
    return this.repo.search(tenantId, filter);
  }

  /** Assign a role to a Party (e.g. assign 'doctor' role to a person in 'healthcare') */
  async assignRole(tenantId: string, input: AddRoleInput, actorId: string): Promise<Party> {
    return this.repo.addRole(tenantId, input, actorId);
  }

  /** Create a directional relationship between two parties */
  async linkParties(tenantId: string, input: AddRelationshipInput, actorId: string): Promise<void> {
    if (input.sourcePartyId === input.targetPartyId) {
      throw new Error('[PartyEngine] Cannot create self-referential relationship.');
    }
    return this.repo.addRelationship(tenantId, input, actorId);
  }

  /** Soft-delete a Party */
  async archive(tenantId: string, partyId: string, actorId: string): Promise<void> {
    return this.repo.softDelete(tenantId, partyId, actorId);
  }
}

export const partyEngine = new PartyEngine();
