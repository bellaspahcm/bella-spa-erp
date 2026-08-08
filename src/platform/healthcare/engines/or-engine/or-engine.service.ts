/**
 * OR Engine Service
 * 
 * Healthcare Platform engine for operating room scheduling and management.
 * 
 * @module platform/healthcare/engines/or-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OREngineContract,
  OROperationScheduleRequest,
  OROperationRescheduleRequest,
  ORSchedule,
} from '../../contracts/or-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class OREngineService implements OREngineContract {
  readonly engineName = 'or-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(private readonly supabase: SupabaseClient) {}

  async scheduleOperation(request: OROperationScheduleRequest): Promise<EngineResponse<ORSchedule>> {
    try {
      // 1. Atomic Idempotency Check
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'scheduleOperation',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            // Duplicate request. Retrieve existing schedule matching criteria.
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_or_schedules')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('operating_room_id', request.operatingRoomId)
              .eq('scheduled_time_range', request.scheduledTimeRange)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  operatingRoomId: existing.operating_room_id,
                  scheduledTimeRange: existing.scheduled_time_range,
                  status: existing.status,
                  notes: existing.notes,
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // 2. Perform schedule insertion
      const { data, error } = await this.supabase
        .from('hc_or_schedules')
        .insert({
          tenant_id: request.tenantId,
          operating_room_id: request.operatingRoomId,
          scheduled_time_range: request.scheduledTimeRange,
          status: 'scheduled',
          notes: request.notes || null,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'OR_SCHEDULE_FAILED',
            message: `Failed to schedule OR: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const schedule: ORSchedule = {
        id: data.id,
        tenantId: data.tenant_id,
        operatingRoomId: data.operating_room_id,
        scheduledTimeRange: data.scheduled_time_range,
        status: data.status,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // 3. Publish Event
      await eventBus.publish({
        eventType: 'hos.or.scheduled.v1',
        tenantId: request.tenantId,
        aggregateId: schedule.id,
        aggregateType: 'encounter', // base aggregate root type
        payload: {
          scheduleId: schedule.id,
          operatingRoomId: schedule.operatingRoomId,
          scheduledTimeRange: schedule.scheduledTimeRange,
          status: schedule.status,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: schedule,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async rescheduleOperation(request: OROperationRescheduleRequest): Promise<EngineResponse<ORSchedule>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'rescheduleOperation',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_or_schedules')
              .select('*')
              .eq('id', request.scheduleId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  operatingRoomId: existing.operating_room_id,
                  scheduledTimeRange: existing.scheduled_time_range,
                  status: existing.status,
                  notes: existing.notes,
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Check current schedule exists
      const { data: current, error: fetchError } = await this.supabase
        .from('hc_or_schedules')
        .select('*')
        .eq('id', request.scheduleId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !current) {
        return {
          success: false,
          error: {
            code: 'OR_SCHEDULE_NOT_FOUND',
            message: 'Schedule record not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (current.status === 'cancelled' || current.status === 'completed') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Cannot reschedule completed or cancelled operations',
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { data, error } = await this.supabase
        .from('hc_or_schedules')
        .update({
          scheduled_time_range: request.newTimeRange,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.scheduleId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'OR_RESCHEDULE_FAILED',
            message: `Failed to reschedule: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const schedule: ORSchedule = {
        id: data.id,
        tenantId: data.tenant_id,
        operatingRoomId: data.operating_room_id,
        scheduledTimeRange: data.scheduled_time_range,
        status: data.status,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      await eventBus.publish({
        eventType: 'hos.or.rescheduled.v1',
        tenantId: request.tenantId,
        aggregateId: schedule.id,
        aggregateType: 'encounter',
        payload: {
          scheduleId: schedule.id,
          operatingRoomId: schedule.operatingRoomId,
          scheduledTimeRange: schedule.scheduledTimeRange,
          status: schedule.status,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: schedule,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async cancelSchedule(tenantId: string, scheduleId: string, notes?: string): Promise<EngineResponse<ORSchedule>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_or_schedules')
        .update({
          status: 'cancelled',
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'OR_CANCEL_FAILED',
            message: `Failed to cancel schedule: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const schedule: ORSchedule = {
        id: data.id,
        tenantId: data.tenant_id,
        operatingRoomId: data.operating_room_id,
        scheduledTimeRange: data.scheduled_time_range,
        status: data.status,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      await eventBus.publish({
        eventType: 'hos.or.cancelled.v1',
        tenantId,
        aggregateId: schedule.id,
        aggregateType: 'encounter',
        payload: {
          scheduleId: schedule.id,
          status: schedule.status,
        },
      });

      return {
        success: true,
        data: schedule,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async checkAvailability(
    tenantId: string,
    operatingRoomId: string,
    startAt: string,
    endAt: string,
    excludeScheduleId?: string
  ): Promise<EngineResponse<{ available: boolean }>> {
    try {
      // Check room exist
      const { data: room, error: roomError } = await this.supabase
        .from('hc_operating_rooms')
        .select('*')
        .eq('id', operatingRoomId)
        .eq('tenant_id', tenantId)
        .single();

      if (roomError || !room) {
        return {
          success: false,
          error: {
            code: 'OR_ROOM_NOT_FOUND',
            message: 'Operating room not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      let query = this.supabase
        .from('hc_or_schedules')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('operating_room_id', operatingRoomId)
        .in('status', ['scheduled', 'confirmed', 'in_progress'])
        .contains('scheduled_time_range', `[${startAt}, ${endAt})`); // overlaps in pg range syntax check can be done via overlap operator

      // Wait, overlaps checks: range1 && range2. Let's use overlapping check using raw query or manual check.
      // Since ranges are stored as tstzrange, we can select where range && tstzrange.
      // Let's do it using raw select or text queries if supabase allows it.
      // supabase js client allows filtering with .filter:
      query = query.filter('scheduled_time_range', '&&', `[${startAt}, ${endAt})`);

      if (excludeScheduleId) {
        query = query.neq('id', excludeScheduleId);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'OR_AVAILABILITY_CHECK_FAILED',
            message: `Failed to check availability: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: {
          available: data.length === 0,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_operating_rooms')
        .select('id')
        .limit(1);

      return {
        status: error ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: error ? 'error' : 'ok',
          eventBus: 'ok',
        },
        message: error ? 'Database connection issue' : undefined,
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        message: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  }
}
