/**
 * @fileoverview Journey Engine — Business Aggregate Root
 *
 * The Journey is the highest-level Business Aggregate Root in the platform.
 * It represents a long-running, multi-phase process involving a Party.
 *
 * Healthcare:  Patient Implant Journey (8 months)
 * Auto:        Car Purchase Journey, Repair Journey
 * Real Estate: Property Investment Journey
 * Beauty:      Customer Treatment Journey
 *
 * Structure:
 *   Journey
 *     └── SubJourneys (distinct phases with own lifecycle)
 *           └── Milestones (progress markers with AI validation)
 *                 └── Encounters (individual operational interactions)
 *
 * @module platform/journey
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type JourneyStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type SubJourneyStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface JourneyMilestone {
  readonly id: string;
  readonly journeyId: string;
  readonly subJourneyId?: string;
  readonly name: string;
  readonly description?: string;
  readonly status: MilestoneStatus;
  readonly targetDate?: Date;
  readonly completedAt?: Date;
  readonly aiValidationDetails?: Record<string, unknown>;
  readonly createdAt: Date;
}

export interface SubJourney {
  readonly id: string;
  readonly journeyId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description?: string;
  readonly status: SubJourneyStatus;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly milestones: JourneyMilestone[];
  readonly version: number;
  readonly createdAt: Date;
}

export interface Journey {
  readonly id: string;
  readonly tenantId: string;
  readonly vertical: string;            // 'healthcare' | 'auto' | 'real_estate'
  readonly journeyType: string;         // 'implant_care' | 'car_repair' | 'property_purchase'
  readonly primaryPartyId: string;      // The main Party (Patient, Buyer, Investor...)
  readonly status: JourneyStatus;
  readonly startedAt: Date;
  readonly expectedEndAt?: Date;
  readonly completedAt?: Date;
  readonly aiSummary?: string;
  readonly metadata: Record<string, unknown>;
  readonly subJourneys: SubJourney[];
  // Auditing & Optimistic Locking
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly deletedAt?: Date;
}

export interface CreateJourneyInput {
  readonly vertical: string;
  readonly journeyType: string;
  readonly primaryPartyId: string;
  readonly expectedEndAt?: Date;
  readonly metadata?: Record<string, unknown>;
  readonly initialSubJourneys?: Array<{
    readonly name: string;
    readonly description?: string;
    readonly milestones?: Array<{
      readonly name: string;
      readonly targetDate?: Date;
    }>;
  }>;
}

export interface UpdateMilestoneInput {
  readonly milestoneId: string;
  readonly status: MilestoneStatus;
  readonly aiValidationDetails?: Record<string, unknown>;
}

export interface JourneyFilter {
  readonly vertical?: string;
  readonly journeyType?: string;
  readonly primaryPartyId?: string;
  readonly status?: JourneyStatus;
  readonly limit?: number;
  readonly offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface IJourneyRepository {
  create(tenantId: string, input: CreateJourneyInput, actorId: string): Promise<Journey>;
  findById(tenantId: string, id: string): Promise<Journey | null>;
  findMany(tenantId: string, filter?: JourneyFilter): Promise<Journey[]>;
  updateStatus(tenantId: string, journeyId: string, status: JourneyStatus, expectedVersion: number, actorId: string): Promise<Journey>;
  addSubJourney(tenantId: string, journeyId: string, name: string, description?: string): Promise<SubJourney>;
  activateSubJourney(tenantId: string, subJourneyId: string, actorId: string): Promise<SubJourney>;
  completeSubJourney(tenantId: string, subJourneyId: string, actorId: string): Promise<SubJourney>;
  updateMilestone(tenantId: string, input: UpdateMilestoneInput, actorId: string): Promise<JourneyMilestone>;
  updateAiSummary(tenantId: string, journeyId: string, summary: string): Promise<void>;
  softDelete(tenantId: string, journeyId: string, actorId: string): Promise<void>;
}

/**
 * JourneyEngine — Business Aggregate Root Management.
 *
 * The journey encapsulates the full business lifecycle of a Party's
 * long-running process. AI uses journey context (not individual encounters)
 * to produce meaningful insights.
 */
class JourneyEngine {
  private repository: IJourneyRepository | null = null;

  setRepository(repo: IJourneyRepository): void {
    this.repository = repo;
  }

  private get repo(): IJourneyRepository {
    if (!this.repository) {
      throw new Error('[JourneyEngine] Repository not initialized. Call setRepository() first via CompositionEngine.');
    }
    return this.repository;
  }

  /** Start a new Journey for a Party */
  async startJourney(tenantId: string, input: CreateJourneyInput, actorId: string): Promise<Journey> {
    return this.repo.create(tenantId, input, actorId);
  }

  /** Get a Journey by ID (includes sub-journeys and milestones) */
  async getJourney(tenantId: string, id: string): Promise<Journey | null> {
    return this.repo.findById(tenantId, id);
  }

  /** Find all journeys for a Party */
  async getPartysJourneys(tenantId: string, partyId: string, vertical?: string): Promise<Journey[]> {
    return this.repo.findMany(tenantId, { primaryPartyId: partyId, vertical });
  }

  /** Pause a journey (e.g. patient on medical hold) */
  async pauseJourney(tenantId: string, journeyId: string, expectedVersion: number, actorId: string): Promise<Journey> {
    return this.repo.updateStatus(tenantId, journeyId, 'paused', expectedVersion, actorId);
  }

  /** Complete a journey */
  async completeJourney(tenantId: string, journeyId: string, expectedVersion: number, actorId: string): Promise<Journey> {
    return this.repo.updateStatus(tenantId, journeyId, 'completed', expectedVersion, actorId);
  }

  /** Add a new sub-journey phase to an existing journey */
  async addPhase(tenantId: string, journeyId: string, name: string, description?: string): Promise<SubJourney> {
    return this.repo.addSubJourney(tenantId, journeyId, name, description);
  }

  /** Advance a milestone to a new status */
  async advanceMilestone(tenantId: string, input: UpdateMilestoneInput, actorId: string): Promise<JourneyMilestone> {
    return this.repo.updateMilestone(tenantId, input, actorId);
  }

  /** AI updates the summary of a journey after analysis */
  async updateAiSummary(tenantId: string, journeyId: string, summary: string): Promise<void> {
    return this.repo.updateAiSummary(tenantId, journeyId, summary);
  }
}

export const journeyEngine = new JourneyEngine();
