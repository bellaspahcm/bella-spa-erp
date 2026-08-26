/**
 * Refactored Bed Engine Service (DDD + Event-Driven + Concurrency Protection)
 *
 * Implements BedEngineContract using Bed aggregate root and SupabaseBedRepository.
 *
 * @module platform/healthcare/engines/bed-engine
 */

import type {
  BedEngineContract,
  BedAllocationRequest,
  BedReleaseRequest,
  BedTransferRequest,
  BedQueryRequest,
} from '../../contracts/bed-engine.contract';
import type { EngineResponse, Bed as SharedBed } from '../../shared-kernel/types';
import { IBedRepository, BedOccupancyConflictError } from './repositories/supabase-bed.repository';
import { BED_EVENT_TYPES } from './events/bed.events';
import { eventBus } from '@/platform/host/event-bus';

export class BedEngineService implements BedEngineContract {
  readonly engineName = 'bed-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(private readonly repository: IBedRepository) {}

  async allocateBed(request: BedAllocationRequest): Promise<EngineResponse<SharedBed>> {
    try {
      // 1. Find available bed
      const bed = await this.repository.findAvailableBed(
        request.tenantId,
        request.wardId,
        request.preferredBedId
      );

      if (!bed) {
        return {
          success: false,
          error: {
            code: 'NO_BEDS_AVAILABLE',
            message: `No available bed found in ward ${request.wardId}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 2. Domain state transition
      bed.allocate({
        admissionId: request.admissionId,
        patientPartyId: request.patientId,
        encounterId: request.encounterId,
      });

      // 3. Persist with conditional update (Race-Condition Protection)
      const saved = await this.repository.save(bed);

      // 4. Publish BedAllocated event
      await eventBus.publish({
        eventType: BED_EVENT_TYPES.BED_ALLOCATED,
        tenantId: saved.tenantId,
        aggregateId: saved.id,
        aggregateType: 'Bed',
        payload: {
          bedId: saved.id,
          tenantId: saved.tenantId,
          wardId: saved.wardId,
          bedCode: saved.bedCode,
          bedType: saved.bedType,
          patientPartyId: request.patientId,
          admissionId: request.admissionId,
          encounterId: request.encounterId,
          allocatedAt: saved.occupancy!.assignedAt,
          dailyRate: saved.dailyRate,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: this.mapToSharedBed(saved),
      };
    } catch (err: unknown) {
      if (err instanceof BedOccupancyConflictError) {
        return {
          success: false,
          error: {
            code: 'CONCURRENCY_CONFLICT',
            message: err.message,
            timestamp: new Date().toISOString(),
          },
        };
      }
      return {
        success: false,
        error: {
          code: 'ALLOCATION_ERROR',
          message: err instanceof Error ? err.message : 'Failed to allocate bed',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async releaseBed(request: BedReleaseRequest): Promise<EngineResponse<SharedBed>> {
    try {
      const bed = await this.repository.findById(request.tenantId, request.bedId);
      if (!bed) {
        return {
          success: false,
          error: {
            code: 'BED_NOT_FOUND',
            message: `Bed ${request.bedId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      bed.release(request.reason);
      const saved = await this.repository.save(bed);

      await eventBus.publish({
        eventType: BED_EVENT_TYPES.BED_RELEASED,
        tenantId: saved.tenantId,
        aggregateId: saved.id,
        aggregateType: 'Bed',
        payload: {
          bedId: saved.id,
          tenantId: saved.tenantId,
          wardId: saved.wardId,
          bedCode: saved.bedCode,
          reason: request.reason,
          releasedAt: new Date().toISOString(),
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: this.mapToSharedBed(saved),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'RELEASE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to release bed',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async transferBed(request: BedTransferRequest): Promise<EngineResponse<{
    fromBed: SharedBed;
    toBed: SharedBed;
    transferId: string;
  }>> {
    try {
      const fromBed = await this.repository.findById(request.tenantId, request.fromBedId);
      const toBed = await this.repository.findById(request.tenantId, request.toBedId);

      if (!fromBed || !toBed) {
        return {
          success: false,
          error: {
            code: 'BED_NOT_FOUND',
            message: 'Source or target bed not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      fromBed.release('transfer');
      toBed.allocate({
        admissionId: request.admissionId,
        patientPartyId: request.patientId,
        encounterId: request.encounterId,
      });

      const savedFrom = await this.repository.save(fromBed);
      const savedTo = await this.repository.save(toBed);

      const transferId = `trf-${Date.now()}`;

      await eventBus.publish({
        eventType: BED_EVENT_TYPES.BED_TRANSFERRED,
        tenantId: request.tenantId,
        aggregateId: transferId,
        aggregateType: 'BedTransfer',
        payload: {
          tenantId: request.tenantId,
          fromBedId: savedFrom.id,
          toBedId: savedTo.id,
          patientPartyId: request.patientId,
          admissionId: request.admissionId,
          encounterId: request.encounterId,
          transferredAt: new Date().toISOString(),
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: {
          fromBed: this.mapToSharedBed(savedFrom),
          toBed: this.mapToSharedBed(savedTo),
          transferId,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'TRANSFER_ERROR',
          message: err instanceof Error ? err.message : 'Failed to transfer bed',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async queryBeds(request: BedQueryRequest): Promise<EngineResponse<SharedBed[]>> {
    try {
      // If wardId not specified, query all beds for the tenant
      const beds = request.wardId
        ? await this.repository.findAllInWard(request.tenantId, request.wardId)
        : await this.repository.findAll(request.tenantId);

      let filtered = beds;

      if (request.status) {
        filtered = filtered.filter((b) => b.status === request.status);
      }
      if (request.bedType) {
        filtered = filtered.filter((b) => b.bedType === request.bedType);
      }

      return {
        success: true,
        data: filtered.map((b) => this.mapToSharedBed(b)),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: err instanceof Error ? err.message : 'Failed to query beds',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getBedById(tenantId: string, bedId: string): Promise<EngineResponse<SharedBed>> {
    try {
      const bed = await this.repository.findById(tenantId, bedId);
      if (!bed) {
        return {
          success: false,
          error: {
            code: 'BED_NOT_FOUND',
            message: `Bed ${bedId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }
      return { success: true, data: this.mapToSharedBed(bed) };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'GET_ERROR',
          message: err instanceof Error ? err.message : 'Error fetching bed',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private mapToSharedBed(bed: Bed): SharedBed {
    const snap = typeof bed.toSnapshot === 'function' ? bed.toSnapshot() : bed;
    return {
      id: snap.id,
      tenantId: snap.tenantId,
      bedNumber: snap.bedCode,
      wardId: snap.wardId,
      roomNumber: undefined,
      bedType: snap.bedType as SharedBed['bedType'],
      status: snap.status as SharedBed['status'],
      features: [],
      assignedPatientId: snap.occupancy?.patientPartyId,
      assignedAdmissionId: snap.occupancy?.admissionId,
      assignedAt: snap.occupancy?.assignedAt,
      metadata: { dailyRate: snap.dailyRate },
      createdAt: snap.createdAt,
      updatedAt: snap.updatedAt,
    };
  }
}
