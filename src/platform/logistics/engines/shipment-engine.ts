/**
 * Shipment Engine - Logistics Platform
 *
 * Manages the complete shipment lifecycle from creation to delivery.
 * Primary engine for Logistics OS.
 *
 * Architecture Compliance:
 *   - Product → Contract → Engine pattern
 *   - No direct Core modification
 *   - Event-driven integration
 *   - Strictly typed, no `any` types
 *   - RLS enforced at database level
 *
 * @module platform/logistics/engines/shipment-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ShipmentManagementContract,
  CreateShipmentRequest,
  CreateShipmentResult,
  UpdateShipmentStatusRequest,
  AssignCarrierRequest,
  AssignRouteRequest,
  RecordPickupRequest,
  RecordDeliveryRequest,
  InitiateReturnRequest,
  CancelShipmentRequest,
  GetShipmentRequest,
  GetShipmentsByStatusRequest,
  TrackShipmentRequest,
  TrackShipmentResult,
  GetShipmentsByCarrierRequest,
  GetShipmentMetricsRequest,
  ShipmentMetrics,
} from '../contracts/shipment-management.contract';
import type {
  EngineResponse,
  EngineHealthStatus,
  Shipment,
  TrackingEvent,
  ShipmentStatus,
} from '../shared-kernel/types';
import { eventBus } from '@/platform/host/event-bus';

// ============================================================================
// Internal DB Row Types
// ============================================================================

interface ShipmentRow {
  id: string;
  tenant_id: string;
  shipment_number: string;
  status: string;
  type: string;
  priority: string;
  origin: Record<string, unknown>;
  destination: Record<string, unknown>;
  planned_pickup_date: string;
  actual_pickup_date: string | null;
  planned_delivery_date: string;
  actual_delivery_date: string | null;
  carrier_id: string | null;
  route_id: string | null;
  items: Record<string, unknown>[];
  total_weight: Record<string, unknown> | null;
  total_volume: Record<string, unknown> | null;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_modified_by: string;
}

interface TrackingEventRow {
  id: string;
  shipment_id: string;
  event_type: string;
  status: string;
  timestamp: string;
  location: Record<string, unknown> | null;
  description: string;
  performed_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface IdempotencyKeyRow {
  id: string;
  response_data: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

const ENGINE_VERSION = '1.0.0';
const SHIPMENT_NUMBER_PREFIX = 'SHIP';

// ============================================================================
// Shipment Engine Service
// ============================================================================

export class ShipmentEngineService implements ShipmentManagementContract {
  readonly engineName = 'shipment-management' as const;
  readonly engineVersion = ENGINE_VERSION;

  constructor(private readonly supabase: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // 1. Create Shipment
  // --------------------------------------------------------------------------

  async createShipment(
    request: CreateShipmentRequest
  ): Promise<EngineResponse<CreateShipmentResult>> {
    try {
      const now = new Date().toISOString();

      // Idempotency check
      const cached = await this.checkIdempotency<CreateShipmentResult>(request.requestId);
      if (cached) return { success: true, data: cached };

      // Generate unique shipment number
      const shipmentNumber = await this.generateShipmentNumber(request.tenantId);

      // Calculate total weight and volume from items
      const totalWeight = this.calculateTotalWeight(request.items);
      const totalVolume = this.calculateTotalVolume(request.items);

      // Insert shipment
      const { data: shipmentRow, error: insertError } = await this.supabase
        .from('log_shipments')
        .insert({
          tenant_id: request.tenantId,
          shipment_number: shipmentNumber,
          status: 'draft',
          type: request.type,
          priority: request.priority,
          origin: request.origin,
          destination: request.destination,
          planned_pickup_date: request.plannedPickupDate,
          planned_delivery_date: request.plannedDeliveryDate,
          items: request.items,
          total_weight: totalWeight,
          total_volume: totalVolume,
          carrier_id: request.carrierId,
          special_instructions: request.specialInstructions,
          created_by: request.createdBy,
          last_modified_by: request.createdBy,
        })
        .select()
        .single();

      if (insertError || !shipmentRow) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_CREATE_FAILED',
            message: insertError?.message ?? 'Failed to create shipment',
            timestamp: now,
          },
        };
      }

      // Create initial tracking event
      await this.createTrackingEvent({
        shipmentId: shipmentRow.id,
        eventType: 'created',
        status: 'draft',
        description: 'Shipment created',
        performedBy: request.createdBy,
      });

      const shipment = this.mapRowToShipment(shipmentRow, []);

      // Publish domain event
      await eventBus.publish({
        eventType: 'log.shipment.created.v1',
        aggregateId: shipment.id,
        aggregateType: 'shipment',
        tenantId: request.tenantId,
        payload: {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          tenantId: request.tenantId,
          type: request.type,
          priority: request.priority,
          origin: request.origin,
          destination: request.destination,
          plannedPickupDate: request.plannedPickupDate,
          plannedDeliveryDate: request.plannedDeliveryDate,
          status: 'draft',
          createdBy: request.createdBy,
          createdAt: now,
          correlationId: request.requestId,
          causationId: request.requestId,
        },
      });

      const result: CreateShipmentResult = {
        shipment,
        shipmentNumber,
      };

      await this.storeIdempotency(request.requestId, result);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 2. Update Shipment Status
  // --------------------------------------------------------------------------

  async updateShipmentStatus(
    request: UpdateShipmentStatusRequest
  ): Promise<EngineResponse<Shipment>> {
    try {
      const now = new Date().toISOString();

      // Idempotency check
      const cached = await this.checkIdempotency<Shipment>(request.requestId);
      if (cached) return { success: true, data: cached };

      // Get current shipment
      const { data: currentRow, error: fetchError } = await this.supabase
        .from('log_shipments')
        .select('*')
        .eq('id', request.shipmentId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !currentRow) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_NOT_FOUND',
            message: 'Shipment not found',
            timestamp: now,
          },
        };
      }

      // Validate state transition
      const transitionValid = this.isValidStatusTransition(
        currentRow.status as ShipmentStatus,
        request.newStatus
      );

      if (!transitionValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot transition from ${currentRow.status} to ${request.newStatus}`,
            timestamp: now,
          },
        };
      }

      // Update shipment status
      const { data: updatedRow, error: updateError } = await this.supabase
        .from('log_shipments')
        .update({
          status: request.newStatus,
          last_modified_by: request.performedBy,
          updated_at: now,
        })
        .eq('id', request.shipmentId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updatedRow) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_UPDATE_FAILED',
            message: updateError?.message ?? 'Failed to update shipment',
            timestamp: now,
          },
        };
      }

      // Create tracking event
      await this.createTrackingEvent({
        shipmentId: request.shipmentId,
        eventType: this.getEventTypeFromStatus(request.newStatus),
        status: request.newStatus,
        description: request.notes ?? `Status updated to ${request.newStatus}`,
        location: request.location,
        performedBy: request.performedBy,
      });

      // Get updated shipment with tracking events
      const shipment = await this.getShipmentWithEvents(request.shipmentId, request.tenantId);

      if (!shipment) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_FETCH_FAILED',
            message: 'Failed to fetch updated shipment',
            timestamp: now,
          },
        };
      }

      // Publish appropriate domain event
      await this.publishStatusEvent(shipment, request.requestId);

      await this.storeIdempotency(request.requestId, shipment);

      return { success: true, data: shipment };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3. Assign Carrier
  // --------------------------------------------------------------------------

  async assignCarrier(request: AssignCarrierRequest): Promise<EngineResponse<Shipment>> {
    try {
      const now = new Date().toISOString();

      const cached = await this.checkIdempotency<Shipment>(request.requestId);
      if (cached) return { success: true, data: cached };

      const { data: updatedRow, error: updateError } = await this.supabase
        .from('log_shipments')
        .update({
          carrier_id: request.carrierId,
          last_modified_by: request.assignedBy,
          updated_at: now,
        })
        .eq('id', request.shipmentId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updatedRow) {
        return {
          success: false,
          error: {
            code: 'CARRIER_ASSIGNMENT_FAILED',
            message: updateError?.message ?? 'Failed to assign carrier',
            timestamp: now,
          },
        };
      }

      const shipment = await this.getShipmentWithEvents(request.shipmentId, request.tenantId);

      if (!shipment) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_FETCH_FAILED',
            message: 'Failed to fetch shipment',
            timestamp: now,
          },
        };
      }

      await eventBus.publish({
        eventType: 'log.carrier.assigned.v1',
        aggregateId: shipment.id,
        aggregateType: 'shipment',
        tenantId: request.tenantId,
        payload: {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          tenantId: request.tenantId,
          carrierId: request.carrierId,
          assignedBy: request.assignedBy,
          assignedAt: now,
          correlationId: request.requestId,
          causationId: request.requestId,
        },
      });

      await this.storeIdempotency(request.requestId, shipment);

      return { success: true, data: shipment };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 4. Assign Route
  // --------------------------------------------------------------------------

  async assignRoute(request: AssignRouteRequest): Promise<EngineResponse<Shipment>> {
    try {
      const now = new Date().toISOString();

      const cached = await this.checkIdempotency<Shipment>(request.requestId);
      if (cached) return { success: true, data: cached };

      const { data: updatedRow, error: updateError } = await this.supabase
        .from('log_shipments')
        .update({
          route_id: request.routeId,
          last_modified_by: request.assignedBy,
          updated_at: now,
        })
        .eq('id', request.shipmentId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updatedRow) {
        return {
          success: false,
          error: {
            code: 'ROUTE_ASSIGNMENT_FAILED',
            message: updateError?.message ?? 'Failed to assign route',
            timestamp: now,
          },
        };
      }

      const shipment = await this.getShipmentWithEvents(request.shipmentId, request.tenantId);

      if (!shipment) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_FETCH_FAILED',
            message: 'Failed to fetch shipment',
            timestamp: now,
          },
        };
      }

      await eventBus.publish({
        eventType: 'log.route.assigned.v1',
        aggregateId: shipment.id,
        aggregateType: 'shipment',
        tenantId: request.tenantId,
        payload: {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          tenantId: request.tenantId,
          routeId: request.routeId,
          assignedBy: request.assignedBy,
          assignedAt: now,
          correlationId: request.requestId,
          causationId: request.requestId,
        },
      });

      await this.storeIdempotency(request.requestId, shipment);

      return { success: true, data: shipment };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. Record Pickup
  // --------------------------------------------------------------------------

  async recordPickup(request: RecordPickupRequest): Promise<EngineResponse<Shipment>> {
    return this.updateShipmentStatus({
      requestId: request.requestId,
      tenantId: request.tenantId,
      shipmentId: request.shipmentId,
      newStatus: 'picked-up',
      location: request.location,
      notes: request.notes ?? 'Shipment picked up',
      performedBy: request.pickedUpBy,
    });
  }

  // --------------------------------------------------------------------------
  // 6. Record Delivery
  // --------------------------------------------------------------------------

  async recordDelivery(request: RecordDeliveryRequest): Promise<EngineResponse<Shipment>> {
    try {
      const now = new Date().toISOString();

      const cached = await this.checkIdempotency<Shipment>(request.requestId);
      if (cached) return { success: true, data: cached };

      // Update shipment with actual delivery date
      const { data: updatedRow, error: updateError } = await this.supabase
        .from('log_shipments')
        .update({
          status: 'delivered',
          actual_delivery_date: request.actualDeliveryDate,
          last_modified_by: request.deliveredBy,
          updated_at: now,
        })
        .eq('id', request.shipmentId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updatedRow) {
        return {
          success: false,
          error: {
            code: 'DELIVERY_RECORD_FAILED',
            message: updateError?.message ?? 'Failed to record delivery',
            timestamp: now,
          },
        };
      }

      // Create tracking event with delivery details
      await this.createTrackingEvent({
        shipmentId: request.shipmentId,
        eventType: 'delivered',
        status: 'delivered',
        description: `Delivered to ${request.recipientName}`,
        location: request.location,
        performedBy: request.deliveredBy,
        metadata: {
          recipientName: request.recipientName,
          recipientSignature: request.recipientSignature,
          notes: request.notes,
        },
      });

      const shipment = await this.getShipmentWithEvents(request.shipmentId, request.tenantId);

      if (!shipment) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_FETCH_FAILED',
            message: 'Failed to fetch shipment',
            timestamp: now,
          },
        };
      }

      await eventBus.publish({
        eventType: 'log.shipment.delivered.v1',
        aggregateId: shipment.id,
        aggregateType: 'shipment',
        tenantId: request.tenantId,
        payload: {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          tenantId: request.tenantId,
          status: 'delivered',
          actualDeliveryDate: request.actualDeliveryDate,
          location: request.location,
          deliveredBy: request.deliveredBy,
          recipientName: request.recipientName,
          correlationId: request.requestId,
          causationId: request.requestId,
        },
      });

      await this.storeIdempotency(request.requestId, shipment);

      return { success: true, data: shipment };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 7. Initiate Return
  // --------------------------------------------------------------------------

  async initiateReturn(
    request: InitiateReturnRequest
  ): Promise<EngineResponse<CreateShipmentResult>> {
    try {
      const now = new Date().toISOString();

      // Get original shipment
      const { data: originalRow, error: fetchError } = await this.supabase
        .from('log_shipments')
        .select('*')
        .eq('id', request.originalShipmentId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !originalRow) {
        return {
          success: false,
          error: {
            code: 'ORIGINAL_SHIPMENT_NOT_FOUND',
            message: 'Original shipment not found',
            timestamp: now,
          },
        };
      }

      // Create return shipment (swap origin and destination)
      const returnShipmentRequest: CreateShipmentRequest = {
        requestId: request.requestId,
        tenantId: request.tenantId,
        type: originalRow.type,
        priority: 'normal',
        origin: originalRow.destination,
        destination: originalRow.origin,
        plannedPickupDate: now,
        plannedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        items: originalRow.items,
        carrierId: originalRow.carrier_id,
        specialInstructions: `Return: ${request.reason}`,
        createdBy: request.initiatedBy,
      };

      const result = await this.createShipment(returnShipmentRequest);

      if (result.success && result.data) {
        // Mark original shipment as returned
        await this.supabase
          .from('log_shipments')
          .update({
            status: 'returned',
            last_modified_by: request.initiatedBy,
            updated_at: now,
          })
          .eq('id', request.originalShipmentId)
          .eq('tenant_id', request.tenantId);

        await eventBus.publish({
          eventType: 'log.shipment.returned.v1',
          aggregateId: request.originalShipmentId,
          aggregateType: 'shipment',
          tenantId: request.tenantId,
          payload: {
            shipmentId: result.data.shipment.id,
            shipmentNumber: result.data.shipmentNumber,
            tenantId: request.tenantId,
            originalShipmentId: request.originalShipmentId,
            status: 'returned',
            returnReason: request.reason,
            returnedAt: now,
            correlationId: request.requestId,
            causationId: request.requestId,
          },
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 8. Cancel Shipment
  // --------------------------------------------------------------------------

  async cancelShipment(request: CancelShipmentRequest): Promise<EngineResponse<Shipment>> {
    try {
      const now = new Date().toISOString();

      const cached = await this.checkIdempotency<Shipment>(request.requestId);
      if (cached) return { success: true, data: cached };

      const { data: updatedRow, error: updateError } = await this.supabase
        .from('log_shipments')
        .update({
          status: 'cancelled',
          last_modified_by: request.cancelledBy,
          updated_at: now,
        })
        .eq('id', request.shipmentId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updatedRow) {
        return {
          success: false,
          error: {
            code: 'CANCELLATION_FAILED',
            message: updateError?.message ?? 'Failed to cancel shipment',
            timestamp: now,
          },
        };
      }

      await this.createTrackingEvent({
        shipmentId: request.shipmentId,
        eventType: 'cancelled',
        status: 'cancelled',
        description: `Cancelled: ${request.reason}`,
        performedBy: request.cancelledBy,
        metadata: { reason: request.reason },
      });

      const shipment = await this.getShipmentWithEvents(request.shipmentId, request.tenantId);

      if (!shipment) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_FETCH_FAILED',
            message: 'Failed to fetch shipment',
            timestamp: now,
          },
        };
      }

      await eventBus.publish({
        eventType: 'log.shipment.cancelled.v1',
        aggregateId: shipment.id,
        aggregateType: 'shipment',
        tenantId: request.tenantId,
        payload: {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          tenantId: request.tenantId,
          status: 'cancelled',
          cancellationReason: request.reason,
          cancelledBy: request.cancelledBy,
          cancelledAt: now,
          correlationId: request.requestId,
          causationId: request.requestId,
        },
      });

      await this.storeIdempotency(request.requestId, shipment);

      return { success: true, data: shipment };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 9. Get Shipment
  // --------------------------------------------------------------------------

  async getShipment(request: GetShipmentRequest): Promise<EngineResponse<Shipment>> {
    try {
      const shipment = await this.getShipmentWithEvents(request.shipmentId, request.tenantId);

      if (!shipment) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_NOT_FOUND',
            message: 'Shipment not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      return { success: true, data: shipment };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 10. Get Shipments by Status
  // --------------------------------------------------------------------------

  async getShipmentsByStatus(
    request: GetShipmentsByStatusRequest
  ): Promise<EngineResponse<Shipment[]>> {
    try {
      const { data: rows, error: fetchError } = await this.supabase
        .from('log_shipments')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .in('status', request.statuses)
        .order('created_at', { ascending: false })
        .range(request.offset ?? 0, (request.offset ?? 0) + (request.limit ?? 100) - 1);

      if (fetchError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: fetchError.message,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const shipments = await Promise.all(
        (rows ?? []).map((row) =>
          this.getShipmentWithEvents(row.id, request.tenantId).then((s) => s!)
        )
      );

      return { success: true, data: shipments.filter(Boolean) };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 11. Track Shipment
  // --------------------------------------------------------------------------

  async trackShipment(request: TrackShipmentRequest): Promise<EngineResponse<TrackShipmentResult>> {
    try {
      let shipmentId = request.shipmentId;

      // If tracking by shipment number, look up ID first
      if (!shipmentId && request.shipmentNumber) {
        const { data: row, error: fetchError } = await this.supabase
          .from('log_shipments')
          .select('id')
          .eq('tenant_id', request.tenantId)
          .eq('shipment_number', request.shipmentNumber)
          .single();

        if (fetchError || !row) {
          return {
            success: false,
            error: {
              code: 'SHIPMENT_NOT_FOUND',
              message: 'Shipment not found',
              timestamp: new Date().toISOString(),
            },
          };
        }

        shipmentId = row.id;
      }

      if (!shipmentId) {
        return {
          success: false,
          error: {
            code: 'MISSING_IDENTIFIER',
            message: 'Either shipmentId or shipmentNumber is required',
            timestamp: new Date().toISOString(),
          },
        };
      }

      const shipment = await this.getShipmentWithEvents(shipmentId, request.tenantId);

      if (!shipment) {
        return {
          success: false,
          error: {
            code: 'SHIPMENT_NOT_FOUND',
            message: 'Shipment not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Get latest tracking event for current location
      const latestEvent = shipment.trackingEvents[shipment.trackingEvents.length - 1];

      const result: TrackShipmentResult = {
        shipment,
        currentLocation: latestEvent?.location,
        estimatedDeliveryDate: shipment.plannedDeliveryDate,
        trackingHistory: shipment.trackingEvents,
      };

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 12. Get Shipments by Carrier
  // --------------------------------------------------------------------------

  async getShipmentsByCarrier(
    request: GetShipmentsByCarrierRequest
  ): Promise<EngineResponse<Shipment[]>> {
    try {
      let query = this.supabase
        .from('log_shipments')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('carrier_id', request.carrierId);

      if (request.dateFrom) {
        query = query.gte('created_at', request.dateFrom);
      }

      if (request.dateTo) {
        query = query.lte('created_at', request.dateTo);
      }

      if (request.status && request.status.length > 0) {
        query = query.in('status', request.status);
      }

      const { data: rows, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .range(request.offset ?? 0, (request.offset ?? 0) + (request.limit ?? 100) - 1);

      if (fetchError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: fetchError.message,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const shipments = await Promise.all(
        (rows ?? []).map((row) =>
          this.getShipmentWithEvents(row.id, request.tenantId).then((s) => s!)
        )
      );

      return { success: true, data: shipments.filter(Boolean) };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 13. Get Shipment Metrics
  // --------------------------------------------------------------------------

  async getShipmentMetrics(
    request: GetShipmentMetricsRequest
  ): Promise<EngineResponse<ShipmentMetrics>> {
    try {
      let query = this.supabase
        .from('log_shipments')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .gte('created_at', request.dateFrom)
        .lte('created_at', request.dateTo);

      if (request.carrierId) {
        query = query.eq('carrier_id', request.carrierId);
      }

      if (request.type) {
        query = query.eq('type', request.type);
      }

      const { data: rows, error: fetchError } = await query;

      if (fetchError) {
        return {
          success: false,
          error: {
            code: 'QUERY_FAILED',
            message: fetchError.message,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const shipments = rows ?? [];

      const metrics: ShipmentMetrics = {
        totalShipments: shipments.length,
        deliveredShipments: shipments.filter((s) => s.status === 'delivered').length,
        inTransitShipments: shipments.filter((s) => s.status === 'in-transit').length,
        pendingShipments: shipments.filter(
          (s) => s.status === 'draft' || s.status === 'pending-pickup'
        ).length,
        cancelledShipments: shipments.filter((s) => s.status === 'cancelled').length,
        returnedShipments: shipments.filter((s) => s.status === 'returned').length,
        onTimeDeliveryRate: this.calculateOnTimeDeliveryRate(shipments),
        averageDeliveryTime: this.calculateAverageDeliveryTime(shipments),
        averagePickupTime: this.calculateAveragePickupTime(shipments),
      };

      return { success: true, data: metrics };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 14. Health Check
  // --------------------------------------------------------------------------

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error: dbError } = await this.supabase.from('log_shipments').select('id').limit(1);

      return {
        status: dbError ? 'unhealthy' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbError ? 'error' : 'ok',
          eventBus: 'ok',
        },
        message: dbError ? dbError.message : 'All systems operational',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async checkIdempotency<T>(requestId: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from('log_idempotency_keys')
      .select('response_data')
      .eq('id', requestId)
      .single();

    if (error || !data) return null;

    return data.response_data as T;
  }

  private async storeIdempotency<T>(requestId: string, responseData: T): Promise<void> {
    await this.supabase.from('log_idempotency_keys').upsert({
      id: requestId,
      response_data: responseData as Record<string, unknown>,
      created_at: new Date().toISOString(),
    });
  }

  private async generateShipmentNumber(tenantId: string): Promise<string> {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${SHIPMENT_NUMBER_PREFIX}-${timestamp}-${random}`;
  }

  private calculateTotalWeight(items: { weight?: { value: number; unit: string } }[]): {
    value: number;
    unit: string;
  } | null {
    const totalKg = items.reduce((sum, item) => {
      if (!item.weight) return sum;
      // Convert to kg for consistency
      const valueInKg =
        item.weight.unit === 'lb' ? item.weight.value * 0.453592 : item.weight.value;
      return sum + valueInKg;
    }, 0);

    return totalKg > 0 ? { value: totalKg, unit: 'kg' } : null;
  }

  private calculateTotalVolume(items: { dimensions?: { length: number; width: number; height: number; unit: string } }[]): {
    value: number;
    unit: string;
  } | null {
    const totalM3 = items.reduce((sum, item) => {
      if (!item.dimensions) return sum;
      const { length, width, height, unit } = item.dimensions;
      let volumeM3 = (length * width * height) / 1000000; // cm³ to m³
      if (unit === 'm') volumeM3 = length * width * height;
      return sum + volumeM3;
    }, 0);

    return totalM3 > 0 ? { value: totalM3, unit: 'm3' } : null;
  }

  private async createTrackingEvent(params: {
    shipmentId: string;
    eventType: string;
    status: string;
    description: string;
    location?: unknown;
    performedBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.supabase.from('log_tracking_events').insert({
      shipment_id: params.shipmentId,
      event_type: params.eventType,
      status: params.status,
      timestamp: new Date().toISOString(),
      location: params.location,
      description: params.description,
      performed_by: params.performedBy,
      metadata: params.metadata,
    });
  }

  private async getShipmentWithEvents(
    shipmentId: string,
    tenantId: string
  ): Promise<Shipment | null> {
    const { data: shipmentRow, error: shipmentError } = await this.supabase
      .from('log_shipments')
      .select('*')
      .eq('id', shipmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (shipmentError || !shipmentRow) return null;

    const { data: eventRows, error: eventsError } = await this.supabase
      .from('log_tracking_events')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('timestamp', { ascending: true });

    const events = (eventRows ?? []).map(this.mapRowToTrackingEvent);

    return this.mapRowToShipment(shipmentRow, events);
  }

  private mapRowToShipment(row: ShipmentRow, trackingEvents: TrackingEvent[]): Shipment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      shipmentNumber: row.shipment_number,
      status: row.status as ShipmentStatus,
      type: row.type as Shipment['type'],
      priority: row.priority as Shipment['priority'],
      origin: row.origin as Shipment['origin'],
      destination: row.destination as Shipment['destination'],
      plannedPickupDate: row.planned_pickup_date,
      actualPickupDate: row.actual_pickup_date ?? undefined,
      plannedDeliveryDate: row.planned_delivery_date,
      actualDeliveryDate: row.actual_delivery_date ?? undefined,
      carrierId: row.carrier_id ?? undefined,
      routeId: row.route_id ?? undefined,
      items: row.items as Shipment['items'],
      totalWeight: row.total_weight as Shipment['totalWeight'],
      totalVolume: row.total_volume as Shipment['totalVolume'],
      specialInstructions: row.special_instructions ?? undefined,
      trackingEvents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      lastModifiedBy: row.last_modified_by,
    };
  }

  private mapRowToTrackingEvent(row: TrackingEventRow): TrackingEvent {
    return {
      id: row.id,
      shipmentId: row.shipment_id,
      eventType: row.event_type as TrackingEvent['eventType'],
      status: row.status as ShipmentStatus,
      timestamp: row.timestamp,
      location: row.location as TrackingEvent['location'],
      description: row.description,
      performedBy: row.performed_by ?? undefined,
      metadata: row.metadata as TrackingEvent['metadata'],
      createdAt: row.created_at,
    };
  }

  private isValidStatusTransition(current: ShipmentStatus, next: ShipmentStatus): boolean {
    const validTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
      draft: ['pending-pickup', 'cancelled'],
      'pending-pickup': ['picked-up', 'cancelled'],
      'picked-up': ['in-transit', 'cancelled'],
      'in-transit': ['out-for-delivery', 'failed-delivery', 'cancelled'],
      'out-for-delivery': ['delivered', 'failed-delivery', 'cancelled'],
      delivered: ['returned'],
      'failed-delivery': ['out-for-delivery', 'cancelled', 'returned'],
      returned: [],
      cancelled: [],
    };

    return validTransitions[current]?.includes(next) ?? false;
  }

  private getEventTypeFromStatus(status: ShipmentStatus): string {
    const mapping: Record<ShipmentStatus, string> = {
      draft: 'created',
      'pending-pickup': 'pickup-scheduled',
      'picked-up': 'picked-up',
      'in-transit': 'in-transit',
      'out-for-delivery': 'out-for-delivery',
      delivered: 'delivered',
      'failed-delivery': 'delivery-attempted',
      returned: 'returned-to-sender',
      cancelled: 'cancelled',
    };

    return mapping[status] ?? 'exception';
  }

  private async publishStatusEvent(shipment: Shipment, requestId: string): Promise<void> {
    const eventTypeMap: Record<ShipmentStatus, string> = {
      draft: 'log.shipment.created.v1',
      'pending-pickup': 'log.shipment.pickup_scheduled.v1',
      'picked-up': 'log.shipment.picked_up.v1',
      'in-transit': 'log.shipment.in_transit.v1',
      'out-for-delivery': 'log.shipment.out_for_delivery.v1',
      delivered: 'log.shipment.delivered.v1',
      'failed-delivery': 'log.shipment.failed_delivery.v1',
      returned: 'log.shipment.returned.v1',
      cancelled: 'log.shipment.cancelled.v1',
    };

    const eventType = eventTypeMap[shipment.status];
    if (!eventType) return;

    await eventBus.publish({
      eventType,
      aggregateId: shipment.id,
      aggregateType: 'shipment',
      tenantId: shipment.tenantId,
      payload: {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        tenantId: shipment.tenantId,
        status: shipment.status,
        timestamp: new Date().toISOString(),
        correlationId: requestId,
        causationId: requestId,
      },
    });
  }

  private calculateOnTimeDeliveryRate(shipments: ShipmentRow[]): number {
    const delivered = shipments.filter((s) => s.status === 'delivered');
    if (delivered.length === 0) return 0;

    const onTime = delivered.filter((s) => {
      if (!s.actual_delivery_date) return false;
      return new Date(s.actual_delivery_date) <= new Date(s.planned_delivery_date);
    });

    return (onTime.length / delivered.length) * 100;
  }

  private calculateAverageDeliveryTime(shipments: ShipmentRow[]): number {
    const delivered = shipments.filter(
      (s) => s.status === 'delivered' && s.actual_pickup_date && s.actual_delivery_date
    );
    if (delivered.length === 0) return 0;

    const totalHours = delivered.reduce((sum, s) => {
      const pickup = new Date(s.actual_pickup_date!).getTime();
      const delivery = new Date(s.actual_delivery_date!).getTime();
      return sum + (delivery - pickup) / (1000 * 60 * 60); // Convert to hours
    }, 0);

    return totalHours / delivered.length;
  }

  private calculateAveragePickupTime(shipments: ShipmentRow[]): number {
    const pickedUp = shipments.filter((s) => s.actual_pickup_date);
    if (pickedUp.length === 0) return 0;

    const totalHours = pickedUp.reduce((sum, s) => {
      const created = new Date(s.created_at).getTime();
      const pickup = new Date(s.actual_pickup_date!).getTime();
      return sum + (pickup - created) / (1000 * 60 * 60); // Convert to hours
    }, 0);

    return totalHours / pickedUp.length;
  }
}
