/**
 * @fileoverview Asset Engine — Managed Asset Lifecycle
 *
 * Manages entities that are owned, tracked, and cared for
 * (as opposed to Resource Engine which manages schedulable entities).
 *
 * Asset vs Resource distinction:
 * - Resource: Something you SCHEDULE (Doctor's time, Dental Chair, MRI machine)
 * - Asset: Something you MANAGE and TRACK (a Patient's tooth, a Car, an Apartment)
 *
 * Vertical examples:
 * - Healthcare: Tooth (#14), Implant fixture, X-Ray film, CBCT scan, Medical device
 * - Auto:       Vehicle (VIN: ABC123), Engine assembly, Battery (EV), Tire set
 * - Real Estate: Apartment (Unit 12B), Parking space (P-05), Building common area
 * - Retail:     Inventory item, Serial-tracked product
 *
 * @module platform/asset
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AssetType =
  // Healthcare
  | 'tooth'
  | 'implant_fixture'
  | 'xray_film'
  | 'cbct_scan'
  | 'medical_device'
  // Auto
  | 'vehicle'
  | 'engine_assembly'
  | 'battery'
  | 'tire_set'
  // Real Estate
  | 'apartment_unit'
  | 'parking_space'
  | 'building'
  // Retail
  | 'inventory_item'
  | string;

export type AssetStatus =
  | 'healthy'
  | 'damaged'
  | 'under_repair'
  | 'replaced'
  | 'retired'
  | 'active'
  | 'sold'
  | 'leased'
  | 'available'
  | string;

export interface AssetEvent {
  readonly eventType: string; // 'condition_changed', 'ownership_transferred', 'maintenance_completed'
  readonly description: string;
  readonly recordedBy?: string;
  readonly occurredAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface Asset {
  readonly id: string;
  readonly tenantId: string;
  readonly vertical: string;
  readonly assetType: AssetType;
  readonly name: string;
  readonly description?: string;
  /** The Party who owns or is associated with this asset */
  readonly ownerPartyId?: string;
  readonly status: AssetStatus;
  /** Contextual metadata (e.g. tooth position, VIN number, unit number) */
  readonly metadata: Record<string, unknown>;
  /** History of notable events on this asset */
  readonly events: AssetEvent[];
  // Auditing & Optimistic Locking
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

export interface CreateAssetInput {
  readonly vertical: string;
  readonly assetType: AssetType;
  readonly name: string;
  readonly description?: string;
  readonly ownerPartyId?: string;
  readonly status?: AssetStatus;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateAssetStatusInput {
  readonly assetId: string;
  readonly status: AssetStatus;
  readonly event: Omit<AssetEvent, 'occurredAt'>;
  readonly expectedVersion: number;
}

export interface AssetFilter {
  readonly vertical?: string;
  readonly assetType?: AssetType;
  readonly ownerPartyId?: string;
  readonly status?: AssetStatus;
  readonly limit?: number;
  readonly offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSET ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface IAssetRepository {
  create(tenantId: string, input: CreateAssetInput, actorId: string): Promise<Asset>;
  findById(tenantId: string, id: string): Promise<Asset | null>;
  findByOwner(tenantId: string, ownerPartyId: string, filter?: Partial<AssetFilter>): Promise<Asset[]>;
  findMany(tenantId: string, filter?: AssetFilter): Promise<Asset[]>;
  updateStatus(tenantId: string, input: UpdateAssetStatusInput, actorId: string): Promise<Asset>;
  transferOwnership(tenantId: string, assetId: string, newOwnerPartyId: string, expectedVersion: number, actorId: string): Promise<Asset>;
  softDelete(tenantId: string, assetId: string, actorId: string): Promise<void>;
}

/**
 * AssetEngine — Managed Asset Lifecycle.
 *
 * Tracks and manages assets across their entire lifecycle:
 * from creation (tooth examination, vehicle purchase) through
 * status changes (implant placed, car damaged) to retirement.
 */
class AssetEngine {
  private repository: IAssetRepository | null = null;

  setRepository(repo: IAssetRepository): void {
    this.repository = repo;
  }

  private get repo(): IAssetRepository {
    if (!this.repository) {
      throw new Error('[AssetEngine] Repository not initialized. Call setRepository() first via CompositionEngine.');
    }
    return this.repository;
  }

  /** Register a new managed asset */
  async register(tenantId: string, input: CreateAssetInput, actorId: string): Promise<Asset> {
    return this.repo.create(tenantId, { ...input, status: input.status ?? 'active' }, actorId);
  }

  /** Get an asset by ID */
  async getById(tenantId: string, id: string): Promise<Asset | null> {
    return this.repo.findById(tenantId, id);
  }

  /** Get all assets belonging to a Party */
  async getByOwner(tenantId: string, ownerPartyId: string, filter?: Partial<AssetFilter>): Promise<Asset[]> {
    return this.repo.findByOwner(tenantId, ownerPartyId, filter);
  }

  /** Update the status of an asset (e.g. tooth condition changed after treatment) */
  async updateStatus(tenantId: string, input: UpdateAssetStatusInput, actorId: string): Promise<Asset> {
    return this.repo.updateStatus(tenantId, input, actorId);
  }

  /** Transfer asset ownership between parties */
  async transferOwnership(
    tenantId: string,
    assetId: string,
    newOwnerPartyId: string,
    expectedVersion: number,
    actorId: string
  ): Promise<Asset> {
    return this.repo.transferOwnership(tenantId, assetId, newOwnerPartyId, expectedVersion, actorId);
  }

  /** Archive an asset (soft delete) */
  async archive(tenantId: string, assetId: string, actorId: string): Promise<void> {
    return this.repo.softDelete(tenantId, assetId, actorId);
  }
}

export const assetEngine = new AssetEngine();
