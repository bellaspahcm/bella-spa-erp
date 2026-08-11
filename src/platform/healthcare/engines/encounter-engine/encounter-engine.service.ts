/**
 * Encounter Engine Service Implementation
 * 
 * @layer Healthcare Platform → Encounter Engine
 * @責任 Service layer connecting domain + repository + event bus + audit
 * 
 * Flow:
 * Hospital UI → IEncounterEngine → EncounterEngineService → Encounter Aggregate → Repository → DB
 *                                          ↓
 *                                      Event Bus → Subscribers (Bed, Billing, Nursing, AI, etc.)
 */

import { EventBusService } from '@/platform/host/event-bus/event-bus.service';
import type { EventType } from '@/platform/host/event-bus/types';
import { SupabaseEncounterRepository } from './infrastructure/supabase-encounter.repository';
import { Encounter, type EncounterStatus, type EncounterClass, type EncounterType } from './domain/encounter.entity';
import type {
  IEncounterEngine,
  CreateEncounterRequest,
  CreateEncounterResponse,
  UpdateEncounterStatusRequest,
  UpdateEncounterStatusResponse,
  AddDiagnosisRequest,
  AddDiagnosisResponse,
  AssignProviderRequest,
  AssignProviderResponse,
  TransferEncounterRequest,
  TransferEncounterResponse,
  GetEncounterRequest,
  GetEncounterResponse,
  SearchEncountersRequest,
  SearchEncountersResponse,
  EncounterDTO,
} from './encounter-engine.interface';

export class EncounterEngineService implements IEncounterEngine {
  constructor(
    private readonly repository: SupabaseEncounterRepository,
    private readonly eventBus: EventBusService
  ) {}

  /**
   * ✅ Phase 3 - Create Encounter
   * Flow: Validate → Create Aggregate → Persist → Publish Event
   */
  async createEncounter(
    request: CreateEncounterRequest
  ): Promise<CreateEncounterResponse> {
    try {
      // 1. Validate tenant
      if (!request.tenantId) {
        return {
          success: false,
          error: 'Tenant ID is required',
        };
      }

      // 2. Validate patient
      if (!request.patientId) {
        return {
          success: false,
          error: 'Patient ID is required',
        };
      }

      // 3. Create aggregate using domain factory
      const encounter = Encounter.create({
        tenantId: request.tenantId,
        patientId: request.patientId,
        encounterType: (request.encounterType as EncounterType) || 'outpatient',
        encounterClass: (request.encounterClass as EncounterClass) || 'AMB',
        startDateTime: new Date(),
        serviceProviderId: request.admittingProviderId,
        departmentId: request.admittingDepartmentId,
        reasonCode: request.chiefComplaint ? [request.chiefComplaint] : undefined,
        isEmergency: request.priority === 'emergency',
        createdBy: request.userId,
      });

      // 4. Persist to database
      const saved = await this.repository.save(encounter);

      // 5. Publish domain events to Event Bus
      await this.publishEncounterCreated(saved, request.userId);

      return {
        success: true,
        encounter: this.mapToDTO(saved),
      };
    } catch (error) {
      console.error('[EncounterEngineService] createEncounter error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ✅ Phase 3 - Update Status
   * Supports state transitions: planned → arrived → triaged → in-progress → finished
   */
  async updateStatus(
    request: UpdateEncounterStatusRequest
  ): Promise<UpdateEncounterStatusResponse> {
    try {
      // 1. Load aggregate
      const encounter = await this.repository.findById(
        request.encounterId,
        request.tenantId
      );

      if (!encounter) {
        return {
          success: false,
          error: 'Encounter not found',
        };
      }

      // 2. Execute state transition using domain methods
      switch (request.status) {
        case 'arrived':
          encounter.arrive(request.userId);
          break;
        case 'triaged':
          encounter.triage(request.userId);
          break;
        case 'in-progress':
          // Resume from hold or start from arrived/triaged
          if (encounter.status === 'on-hold') {
            encounter.resume(request.userId);
          } else {
            encounter.start(request.userId);
          }
          break;
        case 'on-hold':
          encounter.hold(request.userId, request.reason);
          break;
        case 'finished':
          encounter.finish(request.userId);
          break;
        case 'cancelled':
          if (!request.reason) {
            return {
              success: false,
              error: 'Cancellation reason is required',
            };
          }
          encounter.cancel(request.userId, request.reason);
          break;
        default:
          return {
            success: false,
            error: `Invalid status transition: ${request.status}`,
          };
      }

      // 3. Persist
      const saved = await this.repository.save(encounter);

      // 4. Publish events
      await this.publishStatusChanged(saved, request.status as EncounterStatus, request.userId);

      return {
        success: true,
        encounter: this.mapToDTO(saved),
      };
    } catch (error) {
      console.error('[EncounterEngineService] updateStatus error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ✅ Phase 3 - Add Diagnosis
   */
  async addDiagnosis(
    request: AddDiagnosisRequest
  ): Promise<AddDiagnosisResponse> {
    try {
      // 1. Load encounter
      const encounter = await this.repository.findById(
        request.encounterId,
        request.tenantId
      );

      if (!encounter) {
        return {
          success: false,
          error: 'Encounter not found',
        };
      }

      // 2. Add diagnosis to aggregate
      encounter.addDiagnosis(
        {
          code: request.code,
          system: request.system,
          display: request.display || request.code, // ✅ Default to code if display missing
          type: request.isPrimary ? 'primary' : 'secondary',
          recordedDate: new Date().toISOString(),
        },
        request.userId
      );

      // 3. Persist
      const saved = await this.repository.save(encounter);

      // 4. Publish events
      await this.publishDiagnosisAdded(saved, request.code, request.userId);

      return {
        success: true,
        encounter: this.mapToDTO(saved),
      };
    } catch (error) {
      console.error('[EncounterEngineService] addDiagnosis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ✅ Phase 3 - Assign Provider
   */
  async assignProvider(
    request: AssignProviderRequest
  ): Promise<AssignProviderResponse> {
    try {
      // 1. Load encounter
      const encounter = await this.repository.findById(
        request.encounterId,
        request.tenantId
      );

      if (!encounter) {
        return {
          success: false,
          error: 'Encounter not found',
        };
      }

      // 2. Assign provider
      encounter.assignProvider(request.providerId, request.userId);

      // 3. Persist
      const saved = await this.repository.save(encounter);

      // 4. Publish events
      await this.publishProviderAssigned(saved, request.providerId, request.role, request.userId);

      return {
        success: true,
        encounter: this.mapToDTO(saved),
      };
    } catch (error) {
      console.error('[EncounterEngineService] assignProvider error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ✅ Phase 3 - Transfer Encounter
   */
  async transferEncounter(
    request: TransferEncounterRequest
  ): Promise<TransferEncounterResponse> {
    try {
      // 1. Load encounter
      const encounter = await this.repository.findById(
        request.encounterId,
        request.tenantId
      );

      if (!encounter) {
        return {
          success: false,
          error: 'Encounter not found',
        };
      }

      // 2. Transfer (entity requires both departmentId and locationId)
      if (!request.toDepartmentId || !request.toLocationId) {
        return {
          success: false,
          error: 'Both toDepartmentId and toLocationId are required for transfer',
        };
      }

      encounter.transfer(
        request.toDepartmentId,
        request.toLocationId,
        request.userId
      );

      // 3. Persist
      const saved = await this.repository.save(encounter);

      // 4. Publish events
      await this.publishEncounterTransferred(saved, request.toDepartmentId, request.toLocationId, request.userId);

      return {
        success: true,
        encounter: this.mapToDTO(saved),
      };
    } catch (error) {
      console.error('[EncounterEngineService] transferEncounter error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ✅ Phase 3 - Get Encounter
   */
  async getEncounter(
    request: GetEncounterRequest
  ): Promise<GetEncounterResponse> {
    try {
      const encounter = await this.repository.findById(
        request.encounterId,
        request.tenantId
      );

      if (!encounter) {
        return {
          success: false,
          error: 'Encounter not found',
        };
      }

      return {
        success: true,
        encounter: this.mapToDTO(encounter),
      };
    } catch (error) {
      console.error('[EncounterEngineService] getEncounter error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ✅ Phase 3 - Search Encounters
   */
  async searchEncounters(
    request: SearchEncountersRequest
  ): Promise<SearchEncountersResponse> {
    try {
      const result = await this.repository.search({
        tenantId: request.tenantId,
        patientId: request.patientId,
        status: request.status as EncounterStatus | undefined,
        encounterClass: request.encounterClass as EncounterClass | undefined,
        departmentId: request.departmentId,
        providerId: request.providerId,
        fromDate: request.fromDate,
        toDate: request.toDate,
        limit: request.limit || 50,
        offset: request.offset || 0,
      });

      return {
        success: true,
        encounters: result.items.map((e) => this.mapToDTO(e)),
        total: result.total,
      };
    } catch (error) {
      console.error('[EncounterEngineService] searchEncounters error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        encounters: [],
        total: 0,
      };
    }
  }

  /**
   * ✅ Phase 3 - Publish Event: Encounter Created
   */
  private async publishEncounterCreated(encounter: Encounter, userId: string): Promise<void> {
    try {
      await this.eventBus.publish({
        eventType: 'EncounterCreated',
        aggregateId: encounter.id,
        aggregateType: 'Encounter',
        tenantId: encounter.tenantId,
        payload: {
          encounterId: encounter.id,
          patientId: encounter.patientId,
          encounterType: encounter.encounterType,
          encounterClass: encounter.encounterClass,
          status: encounter.status,
        },
        userId,
      });
    } catch (error) {
      console.error('[EncounterEngineService] Failed to publish EncounterCreated:', error);
    }
  }

  /**
   * ✅ Phase 3 - Publish Event: Status Changed
   */
  private async publishStatusChanged(encounter: Encounter, newStatus: EncounterStatus, userId: string): Promise<void> {
    try {
      const eventTypeMap: Record<EncounterStatus, string> = {
        'planned': 'EncounterPlanned',
        'arrived': 'EncounterArrived',
        'triaged': 'EncounterTriaged',
        'in-progress': 'EncounterStarted',
        'on-hold': 'EncounterHeld',
        'finished': 'EncounterFinished',
        'cancelled': 'EncounterCancelled',
      };

      await this.eventBus.publish({
        eventType: (eventTypeMap[newStatus] || 'EncounterStatusChanged') as EventType,
        aggregateId: encounter.id,
        aggregateType: 'Encounter',
        tenantId: encounter.tenantId,
        payload: {
          encounterId: encounter.id,
          patientId: encounter.patientId,
          status: newStatus,
        },
        userId,
      });
    } catch (error) {
      console.error('[EncounterEngineService] Failed to publish status change:', error);
    }
  }

  /**
   * ✅ Phase 3 - Publish Event: Diagnosis Added
   */
  private async publishDiagnosisAdded(encounter: Encounter, diagnosisCode: string, userId: string): Promise<void> {
    try {
      await this.eventBus.publish({
        eventType: 'DiagnosisAdded',
        aggregateId: encounter.id,
        aggregateType: 'Encounter',
        tenantId: encounter.tenantId,
        payload: {
          encounterId: encounter.id,
          patientId: encounter.patientId,
          diagnosisCode,
        },
        userId,
      });
    } catch (error) {
      console.error('[EncounterEngineService] Failed to publish DiagnosisAdded:', error);
    }
  }

  /**
   * ✅ Phase 3 - Publish Event: Provider Assigned
   */
  private async publishProviderAssigned(encounter: Encounter, providerId: string, role: string, userId: string): Promise<void> {
    try {
      await this.eventBus.publish({
        eventType: 'ProviderAssigned',
        aggregateId: encounter.id,
        aggregateType: 'Encounter',
        tenantId: encounter.tenantId,
        payload: {
          encounterId: encounter.id,
          patientId: encounter.patientId,
          providerId,
          role,
        },
        userId,
      });
    } catch (error) {
      console.error('[EncounterEngineService] Failed to publish ProviderAssigned:', error);
    }
  }

  /**
   * ✅ Phase 3 - Publish Event: Encounter Transferred
   */
  private async publishEncounterTransferred(
    encounter: Encounter,
    toDepartmentId: string,
    toLocationId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.eventBus.publish({
        eventType: 'EncounterTransferred',
        aggregateId: encounter.id,
        aggregateType: 'Encounter',
        tenantId: encounter.tenantId,
        payload: {
          encounterId: encounter.id,
          patientId: encounter.patientId,
          toDepartmentId,
          toLocationId,
        },
        userId,
      });
    } catch (error) {
      console.error('[EncounterEngineService] Failed to publish EncounterTransferred:', error);
    }
  }

  /**
   * Map Encounter aggregate to DTO
   */
  private mapToDTO(encounter: Encounter): EncounterDTO {
    return {
      id: encounter.id,
      tenantId: encounter.tenantId,
      patientId: encounter.patientId,
      status: encounter.status as EncounterStatus,
      encounterClass: encounter.encounterClass as EncounterClass,
      encounterType: encounter.encounterType as EncounterType,
      admittingProviderId: encounter.serviceProviderId,
      admittingDepartmentId: encounter.departmentId,
      currentDepartmentId: encounter.departmentId,
      currentLocationId: encounter.locationId,
      chiefComplaint: encounter.reasonCode[0] || undefined,
      diagnoses: encounter.diagnosis.map((d) => ({
        code: d.code,
        system: d.system,
        display: d.display || '',
        isPrimary: d.type === 'primary',
        recordedAt: d.recordedDate,
        recordedBy: '', // TODO: Track in domain
      })),
      participants: [], // TODO: Track participants in domain
      registeredAt: encounter.period.start.toISOString(),
      startedAt: encounter.status === 'in-progress' ? new Date().toISOString() : undefined,
      finishedAt: encounter.period.end?.toISOString(),
      createdAt: encounter.provenance.createdAt.toISOString(),
      updatedAt: encounter.provenance.updatedAt.toISOString(),
      createdBy: encounter.provenance.createdBy,
      updatedBy: encounter.provenance.updatedBy,
    };
  }
}
