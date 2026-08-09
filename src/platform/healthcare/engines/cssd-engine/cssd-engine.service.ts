/**
 * CSSD Engine Service
 * 
 * Healthcare Platform engine for Central Sterile Services Department operations.
 * 
 * @module platform/healthcare/engines/cssd-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CssdEngineContract,
  RegisterEquipmentRequest,
  StartCssdCycleRequest,
  CompleteCssdCycleRequest,
  IssueEquipmentRequest,
  ReturnEquipmentRequest,
  Equipment,
  CssdCycle,
  OREquipmentUsage,
  TraceabilityReport,
} from '../../contracts/cssd-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class CssdEngineService implements CssdEngineContract {
  readonly engineName = 'cssd-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(private readonly supabase: SupabaseClient) {}

  async registerEquipment(request: RegisterEquipmentRequest): Promise<EngineResponse<Equipment>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'registerEquipment',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_equipment')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('serial_number', request.serialNumber)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  name: existing.name,
                  serialNumber: existing.serial_number,
                  status: existing.status as 'available' | 'in_use' | 'sterile_hold' | 'maintenance',
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

      const { data, error } = await this.supabase
        .from('hc_equipment')
        .insert({
          tenant_id: request.tenantId,
          name: request.name,
          serial_number: request.serialNumber,
          status: 'available',
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'EQUIPMENT_REGISTRATION_FAILED',
            message: `Failed to register equipment: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: {
          id: data.id,
          tenantId: data.tenant_id,
          name: data.name,
          serialNumber: data.serial_number,
          status: data.status as 'available' | 'in_use' | 'sterile_hold' | 'maintenance',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
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

  async startCycle(request: StartCssdCycleRequest): Promise<EngineResponse<CssdCycle>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'startCssdCycle',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_cssd_cycles')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('cycle_number', request.cycleNumber)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  cycleNumber: existing.cycle_number,
                  startedAt: existing.started_at,
                  completedAt: existing.completed_at,
                  indicatorResult: existing.indicator_result as 'pass' | 'fail' | 'pending' | null,
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

      // Create cycle record
      const { data: cycle, error: cycleError } = await this.supabase
        .from('hc_cssd_cycles')
        .insert({
          tenant_id: request.tenantId,
          cycle_number: request.cycleNumber,
          started_at: request.startedAt,
          indicator_result: 'pending',
        })
        .select()
        .single();

      if (cycleError || !cycle) {
        return {
          success: false,
          error: {
            code: 'CYCLE_CREATION_FAILED',
            message: `Failed to start CSSD cycle: ${cycleError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Add cycle items
      const itemsToInsert = request.equipmentIds.map(eqId => ({
        tenant_id: request.tenantId,
        cssd_cycle_id: cycle.id,
        equipment_id: eqId,
        status: 'processing',
      }));

      const { error: itemsError } = await this.supabase
        .from('hc_cssd_cycle_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback cycle creation
        await this.supabase.from('hc_cssd_cycles').delete().eq('id', cycle.id);
        return {
          success: false,
          error: {
            code: 'ITEMS_MAPPING_FAILED',
            message: `Failed to insert cycle items: ${itemsError.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Update equipment status to sterile_hold during cycle
      await this.supabase
        .from('hc_equipment')
        .update({ status: 'sterile_hold' })
        .in('id', request.equipmentIds)
        .eq('tenant_id', request.tenantId);

      return {
        success: true,
        data: {
          id: cycle.id,
          tenantId: cycle.tenant_id,
          cycleNumber: cycle.cycle_number,
          startedAt: cycle.started_at,
          completedAt: cycle.completed_at,
          indicatorResult: cycle.indicator_result as 'pass' | 'fail' | 'pending' | null,
          createdAt: cycle.created_at,
          updatedAt: cycle.updated_at,
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

  async completeCycle(request: CompleteCssdCycleRequest): Promise<EngineResponse<CssdCycle>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'completeCssdCycle',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_cssd_cycles')
              .select('*')
              .eq('id', request.cycleId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  cycleNumber: existing.cycle_number,
                  startedAt: existing.started_at,
                  completedAt: existing.completed_at,
                  indicatorResult: existing.indicator_result as 'pass' | 'fail' | 'pending' | null,
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

      // Fetch items in cycle
      const { data: items, error: fetchItemsError } = await this.supabase
        .from('hc_cssd_cycle_items')
        .select('equipment_id')
        .eq('cssd_cycle_id', request.cycleId)
        .eq('tenant_id', request.tenantId);

      if (fetchItemsError || !items) {
        return {
          success: false,
          error: {
            code: 'FETCH_ITEMS_FAILED',
            message: 'Failed to retrieve cycle items',
            timestamp: new Date().toISOString(),
          },
        };
      }

      const equipmentIds = items.map(it => it.equipment_id);
      const targetStatus = request.indicatorResult === 'pass' ? 'sterilized' : 'failed';
      const equipmentStatus = request.indicatorResult === 'pass' ? 'available' : 'sterile_hold';

      // Update cycle status
      const { data: cycle, error: cycleError } = await this.supabase
        .from('hc_cssd_cycles')
        .update({
          completed_at: request.completedAt,
          indicator_result: request.indicatorResult,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.cycleId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (cycleError || !cycle) {
        return {
          success: false,
          error: {
            code: 'CYCLE_COMPLETION_FAILED',
            message: `Failed to complete CSSD cycle: ${cycleError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Update cycle items
      await this.supabase
        .from('hc_cssd_cycle_items')
        .update({ status: targetStatus })
        .eq('cssd_cycle_id', request.cycleId)
        .eq('tenant_id', request.tenantId);

      // Update equipment status
      if (equipmentIds.length > 0) {
        await this.supabase
          .from('hc_equipment')
          .update({ status: equipmentStatus })
          .in('id', equipmentIds)
          .eq('tenant_id', request.tenantId);
      }

      // Publish event
      await eventBus.publish({
        eventType: 'hos.cssd.cycle.completed.v1',
        tenantId: request.tenantId,
        aggregateId: cycle.id,
        aggregateType: 'encounter', // generic base
        payload: {
          cssdCycleId: cycle.id,
          cycleNumber: cycle.cycleNumber,
          indicatorResult: cycle.indicator_result,
        },
      });

      return {
        success: true,
        data: {
          id: cycle.id,
          tenantId: cycle.tenant_id,
          cycleNumber: cycle.cycle_number,
          startedAt: cycle.started_at,
          completedAt: cycle.completed_at,
          indicatorResult: cycle.indicator_result as 'pass' | 'fail' | 'pending' | null,
          createdAt: cycle.created_at,
          updatedAt: cycle.updated_at,
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

  async issueEquipment(request: IssueEquipmentRequest): Promise<EngineResponse<OREquipmentUsage>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'issueEquipment',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_or_equipment_usage')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('surgical_case_id', request.surgicalCaseId)
              .eq('equipment_id', request.equipmentId)
              .eq('cssd_cycle_id', request.cssdCycleId)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  equipmentId: existing.equipment_id,
                  cssdCycleId: existing.cssd_cycle_id,
                  usedAt: existing.used_at,
                  returnedAt: existing.returned_at,
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

      // Enforce Invariant: Equipment must be available
      const { data: equip, error: equipError } = await this.supabase
        .from('hc_equipment')
        .select('*')
        .eq('id', request.equipmentId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (equipError || !equip) {
        return {
          success: false,
          error: {
            code: 'EQUIPMENT_NOT_FOUND',
            message: 'Equipment not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (equip.status !== 'available') {
        return {
          success: false,
          error: {
            code: 'EQUIPMENT_UNAVAILABLE',
            message: `Equipment status is ${equip.status}, must be available`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Enforce Invariant: CSSD Cycle must have passed biological indicator
      const { data: cycle, error: cycleError } = await this.supabase
        .from('hc_cssd_cycles')
        .select('*')
        .eq('id', request.cssdCycleId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (cycleError || !cycle) {
        return {
          success: false,
          error: {
            code: 'CYCLE_NOT_FOUND',
            message: 'Sterilization cycle not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (cycle.indicator_result !== 'pass') {
        return {
          success: false,
          error: {
            code: 'STERILIZATION_FAILED',
            message: 'Cannot issue: Biological indicator result is not pass',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Insert usage
      const { data, error } = await this.supabase
        .from('hc_or_equipment_usage')
        .insert({
          tenant_id: request.tenantId,
          surgical_case_id: request.surgicalCaseId,
          equipment_id: request.equipmentId,
          cssd_cycle_id: request.cssdCycleId,
          used_at: request.usedAt,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'ISSUE_FAILED',
            message: `Failed to issue equipment: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Update equipment status to in_use
      await this.supabase
        .from('hc_equipment')
        .update({ status: 'in_use' })
        .eq('id', request.equipmentId)
        .eq('tenant_id', request.tenantId);

      return {
        success: true,
        data: {
          id: data.id,
          tenantId: data.tenant_id,
          surgicalCaseId: data.surgical_case_id,
          equipmentId: data.equipment_id,
          cssdCycleId: data.cssd_cycle_id,
          usedAt: data.used_at,
          returnedAt: data.returned_at,
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

  async returnEquipment(request: ReturnEquipmentRequest): Promise<EngineResponse<OREquipmentUsage>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'returnEquipment',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_or_equipment_usage')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('surgical_case_id', request.surgicalCaseId)
              .eq('equipment_id', request.equipmentId)
              .eq('cssd_cycle_id', request.cssdCycleId)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  equipmentId: existing.equipment_id,
                  cssdCycleId: existing.cssd_cycle_id,
                  usedAt: existing.used_at,
                  returnedAt: existing.returned_at,
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

      const { data, error } = await this.supabase
        .from('hc_or_equipment_usage')
        .update({
          returned_at: request.returnedAt,
        })
        .eq('tenant_id', request.tenantId)
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('equipment_id', request.equipmentId)
        .eq('cssd_cycle_id', request.cssdCycleId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'RETURN_FAILED',
            message: `Failed to return equipment: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Update equipment status to sterile_hold (must undergo sterilization before being available again)
      await this.supabase
        .from('hc_equipment')
        .update({ status: 'sterile_hold' })
        .eq('id', request.equipmentId)
        .eq('tenant_id', request.tenantId);

      return {
        success: true,
        data: {
          id: data.id,
          tenantId: data.tenant_id,
          surgicalCaseId: data.surgical_case_id,
          equipmentId: data.equipment_id,
          cssdCycleId: data.cssd_cycle_id,
          usedAt: data.used_at,
          returnedAt: data.returned_at,
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

  async getEquipmentTraceability(tenantId: string, surgicalCaseId: string): Promise<EngineResponse<TraceabilityReport[]>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_or_equipment_usage')
        .select(`
          equipment_id,
          used_at,
          returned_at,
          hc_equipment(name, serial_number),
          hc_cssd_cycles(id, cycle_number, started_at, completed_at, indicator_result)
        `)
        .eq('surgical_case_id', surgicalCaseId)
        .eq('tenant_id', tenantId);

      if (error) {
        return {
          success: false,
          error: {
            code: 'TRACEABILITY_QUERY_FAILED',
            message: `Failed to query traceability: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const report: TraceabilityReport[] = (data || []).map((row: Record<string, unknown>) => {
        const eq = row.hc_equipment;
        const cyc = row.hc_cssd_cycles;
        return {
          equipmentId: row.equipment_id,
          equipmentName: eq?.name || '',
          serialNumber: eq?.serial_number || '',
          cssdCycleId: cyc?.id || '',
          cycleNumber: cyc?.cycle_number || '',
          startedAt: cyc?.started_at || '',
          completedAt: cyc?.completed_at || null,
          indicatorResult: cyc?.indicator_result || null,
          usedAt: row.used_at,
          returnedAt: row.returned_at,
        };
      });

      return {
        success: true,
        data: report,
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
        .from('hc_equipment')
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
