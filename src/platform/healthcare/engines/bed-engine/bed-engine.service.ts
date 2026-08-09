/**
 * Bed Engine Service
 * 
 * Healthcare Platform engine for bed management operations.
 * 
 * **STATUS:** PLACEHOLDER - Week 3-4 Implementation
 * **TODO:** Implement full service logic
 * 
 * Constitution Compliance:
 * - Law 1: All operations reference Encounter aggregate root
 * - Law 2: Provides abstraction over direct DB access
 * - Law 3: Decoupled from Hospital Product Pack
 * - Law 5: Publishes domain events (BedAllocated, BedReleased, BedTransferred)
 * 
 * @module platform/healthcare/engines/bed-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BedEngineContract,
  BedAllocationRequest,
  BedReleaseRequest,
  BedTransferRequest,
  BedQueryRequest,
} from '../../contracts/bed-engine.contract';
import type { EngineResponse, Bed, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '@/platform/host/event-bus';

export class BedEngineService implements BedEngineContract {
  readonly engineName = 'bed-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(
    private readonly supabase: SupabaseClient,
    // TODO: Inject ContractRegistryService
  ) {}

  async allocateBed(request: BedAllocationRequest): Promise<EngineResponse<Bed>> {
    try {
      // 1. Find available bed
      let query = this.supabase
        .from('hc_beds')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('ward_id', request.wardId)
        .eq('status', 'available');

      if (request.bedType) {
        query = query.eq('bed_type', request.bedType);
      }

      if (request.preferredBedId) {
        query = query.eq('id', request.preferredBedId);
      }

      const { data: beds, error: queryError } = await query.limit(1);

      // 🔍 DEBUG LOGGING
      console.log('[BedEngine] allocateBed debug:', {
        request,
        queryError: queryError?.message,
        foundBeds: beds?.length || 0,
        timestamp: new Date().toISOString(),
      });

      if (queryError || !beds || beds.length === 0) {
        // Additional debug query to understand why no beds found
        const { data: allWardBeds } = await this.supabase
          .from('hc_beds')
          .select('id, bed_code, ward_id, status, bed_type')
          .eq('tenant_id', request.tenantId)
          .eq('ward_id', request.wardId);

        console.error('[BedEngine] No beds available. Debug info:', {
          requestedWardId: request.wardId,
          requestedBedType: request.bedType,
          requestedPreferredBedId: request.preferredBedId,
          allBedsInWard: allWardBeds,
          totalBedsInWard: allWardBeds?.length || 0,
          bedsStatusBreakdown: allWardBeds?.reduce((acc: Record<string, number>, bed: any) => {
            acc[bed.status] = (acc[bed.status] || 0) + 1;
            return acc;
          }, {}) || {},
          queryError: queryError?.message,
        });

        return {
          success: false,
          error: {
            code: 'NO_BEDS_AVAILABLE',
            message: 'No available beds matching criteria',
            details: {
              requestedWardId: request.wardId,
              requestedBedType: request.bedType,
              requestedPreferredBedId: request.preferredBedId,
              totalBedsInWard: allWardBeds?.length || 0,
              bedsStatusBreakdown: allWardBeds?.reduce((acc: Record<string, number>, bed: any) => {
                acc[bed.status] = (acc[bed.status] || 0) + 1;
                return acc;
              }, {}) || {},
            },
            timestamp: new Date().toISOString(),
          },
        };
      }

      const bed = beds[0];

      // 2. Update bed status to occupied
      const { data: updatedBed, error: updateError } = await this.supabase
        .from('hc_beds')
        .update({
          status: 'occupied',
          current_patient_id: request.patientId, // ✅ Fixed: current_patient_id
          current_admission_id: request.admissionId, // ✅ Fixed: current_admission_id
          updated_at: new Date().toISOString(),
        })
        .eq('id', bed.id)
        .select()
        .single();

      if (updateError || !updatedBed) {
        return {
          success: false,
          error: {
            code: 'BED_UPDATE_FAILED',
            message: 'Failed to allocate bed',
            details: { error: updateError },
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 3. Publish BedAllocated event
      await eventBus.publish({
        eventType: 'BedAllocated',
        tenantId: request.tenantId,
        aggregateId: updatedBed.id,
        aggregateType: 'Bed',
        payload: {
          bedId: updatedBed.id,
          bedCode: updatedBed.bed_number,
          bedType: updatedBed.bed_type,
          wardId: updatedBed.ward_id,
          patientId: request.patientId,
          admissionId: request.admissionId,
          encounterId: request.encounterId,
          allocatedAt: updatedBed.assigned_at!,
          dailyRate: updatedBed.daily_rate || 0,
        },
        userId: request.userId,
      });

      console.log(`[BedEngine] Allocated bed ${bed.id} to patient ${request.patientId}`);

      return {
        success: true,
        data: updatedBed as Bed,
        metadata: {
          requestId: crypto.randomUUID(),
          engineVersion: this.engineVersion,
          executionTimeMs: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ALLOCATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async releaseBed(request: BedReleaseRequest): Promise<EngineResponse<Bed>> {
    try {
      // 1. Get bed and validate it's occupied
      const { data: bed, error: getError } = await this.supabase
        .from('hc_beds')
        .select('*')
        .eq('id', request.bedId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (getError || !bed) {
        return {
          success: false,
          error: {
            code: 'BED_NOT_FOUND',
            message: 'Bed not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (bed.status !== 'occupied') {
        return {
          success: false,
          error: {
            code: 'BED_NOT_OCCUPIED',
            message: 'Bed is not occupied',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 2. Update bed status based on reason
      const newStatus = request.reason === 'discharge' || request.reason === 'transfer' ? 'cleaning' : 'available';

      const { data: updatedBed, error: updateError } = await this.supabase
        .from('hc_beds')
        .update({
          status: newStatus,
          assigned_patient_id: null,
          assigned_admission_id: null,
          assigned_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.bedId)
        .select()
        .single();

      if (updateError || !updatedBed) {
        return {
          success: false,
          error: {
            code: 'BED_RELEASE_FAILED',
            message: 'Failed to release bed',
            details: { error: updateError },
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 3. TODO: Publish BedReleased event

      console.log(`[BedEngine] Released bed ${request.bedId} (reason: ${request.reason})`);

      return {
        success: true,
        data: updatedBed as Bed,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RELEASE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async transferBed(request: BedTransferRequest): Promise<EngineResponse<{
    fromBed: Bed;
    toBed: Bed;
    transferId: string;
  }>> {
    try {
      // 1. Validate both beds
      const { data: fromBed, error: fromError } = await this.supabase
        .from('hc_beds')
        .select('*')
        .eq('id', request.fromBedId)
        .eq('tenant_id', request.tenantId)
        .single();

      const { data: toBed, error: toError } = await this.supabase
        .from('hc_beds')
        .select('*')
        .eq('id', request.toBedId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fromError || !fromBed || toError || !toBed) {
        return {
          success: false,
          error: {
            code: 'BED_NOT_FOUND',
            message: 'One or both beds not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (fromBed.status !== 'occupied') {
        return {
          success: false,
          error: {
            code: 'FROM_BED_NOT_OCCUPIED',
            message: 'Source bed is not occupied',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (toBed.status !== 'available') {
        return {
          success: false,
          error: {
            code: 'TO_BED_NOT_AVAILABLE',
            message: 'Target bed is not available',
            timestamp: new Date().toISOString(),
          },
        };
      }

      const transferId = crypto.randomUUID();
      const now = new Date().toISOString();

      // 2. Release from bed
      const { data: updatedFromBed } = await this.supabase
        .from('hc_beds')
        .update({
          status: 'available',
          assigned_patient_id: null,
          assigned_admission_id: null,
          assigned_at: null,
          updated_at: now,
        })
        .eq('id', request.fromBedId)
        .select()
        .single();

      // 3. Allocate to bed
      const { data: updatedToBed } = await this.supabase
        .from('hc_beds')
        .update({
          status: 'occupied',
          assigned_patient_id: request.patientId,
          assigned_admission_id: request.admissionId,
          assigned_at: now,
          updated_at: now,
        })
        .eq('id', request.toBedId)
        .select()
        .single();

      // 4. TODO: Publish BedTransferred event

      console.log(`[BedEngine] Transferred patient ${request.patientId} from bed ${request.fromBedId} to ${request.toBedId}`);

      return {
        success: true,
        data: {
          fromBed: updatedFromBed as Bed,
          toBed: updatedToBed as Bed,
          transferId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TRANSFER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async queryBeds(request: BedQueryRequest): Promise<EngineResponse<Bed[]>> {
    try {
      let query = this.supabase
        .from('hc_beds')
        .select('*')
        .eq('tenant_id', request.tenantId);

      if (request.wardId) {
        query = query.eq('ward_id', request.wardId);
      }

      if (request.bedType) {
        query = query.eq('bed_type', request.bedType);
      }

      if (request.status) {
        query = query.eq('status', request.status);
      }

      if (request.assignedPatientId) {
        query = query.eq('current_patient_id', request.assignedPatientId); // ✅ Fixed: current_patient_id not assigned_patient_id
      }

      const { data, error } = await query.order('bed_code', { ascending: true }); // ✅ Fixed: bed_code not bed_number

      if (error) {
        return {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message: 'Failed to query beds',
            details: { error },
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: (data || []) as Bed[],
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getBedById(tenantId: string, bedId: string): Promise<EngineResponse<Bed>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_beds')
        .select('*')
        .eq('id', bedId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'BED_NOT_FOUND',
            message: 'Bed not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: data as Bed,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      // Check database connection
      const { error } = await this.supabase
        .from('hc_beds')
        .select('id')
        .limit(1);

      return {
        status: error ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: error ? 'error' : 'ok',
          eventBus: 'ok', // TODO: Check Event Bus when wired
        },
        message: error ? 'Database connection issue' : undefined,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }
}

// TODO Week 3-4: Implement full service
// TODO Week 3-4: Add unit tests (bed-engine.test.ts)
// TODO Week 3-4: Add integration tests (bed-engine.integration.test.ts)
// TODO Week 3-4: Register contract in Contract Registry
// TODO Week 3-4: Add Event Bus event publishing
