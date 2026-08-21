/**
 * Route Management Engine - Logistics Platform
 *
 * Implements route planning, optimization, and execution logic.
 * Handles route lifecycle, waypoint management, and shipment coordination.
 *
 * Architecture Compliance:
 * - Product → Contract → Engine pattern
 * - No direct Core modification
 * - Event-driven integration with Shipment Management
 * - Strictly typed, no `any` types
 * - Idempotent operations via requestId
 *
 * @module platform/logistics/engines/route-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EngineResponse,
  EngineHealthStatus,
  Route,
  RouteStatus,
  Waypoint,
  Distance,
} from '../shared-kernel/types';

import type {
  RouteManagementContract,
  CreateRouteRequest,
  CreateRouteResult,
  AssignShipmentsRequest,
  ValidateCapacityRequest,
  CapacityValidationResult,
  CapacityViolation,
  OptimizeRouteRequest,
  OptimizationResult,
  StartRouteRequest,
  CompleteWaypointRequest,
  CompleteRouteRequest,
  CancelRouteRequest,
  ReassignShipmentRequest,
  RecordDeliveryFailureRequest,
  GetRouteRequest,
  GetRoutesByStatusRequest,
  GetRoutesByDriverRequest,
  GetRoutesByVehicleRequest,
  GetRouteMetricsRequest,
  RouteMetrics,
} from '../contracts/route-management.contract';

import {
  calculateRouteDistance,
  estimateDuration,
  calculateWaypointDistance,
} from '../extensions/geo-utils';

// ============================================================================
// Database Row Types
// ============================================================================

interface RouteRow {
  id: string;
  tenant_id: string;
  route_number: string;
  status: RouteStatus;
  vehicle_id: string | null;
  driver_id: string | null;
  planned_departure_time: string;
  actual_departure_time: string | null;
  planned_arrival_time: string;
  actual_arrival_time: string | null;
  max_weight: number | null;
  max_volume: number | null;
  total_distance_km: number | null;
  estimated_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_modified_by: string;
}

interface WaypointRow {
  id: string;
  route_id: string;
  sequence: number;
  location: unknown; // JSONB
  waypoint_type: 'origin' | 'pickup' | 'delivery' | 'hub' | 'destination';
  planned_arrival: string;
  actual_arrival: string | null;
  action: 'pickup' | 'delivery' | 'stopover';
  completed: boolean;
  notes: string | null;
  created_at: string;
}

interface RouteShipmentRow {
  route_id: string;
  shipment_id: string;
  waypoint_sequence: number | null;
  assigned_at: string;
  assigned_by: string;
}

interface IdempotencyKeyRow {
  request_id: string;
  operation_type: string;
  response_data: unknown; // JSONB
  created_at: string;
}

// ============================================================================
// Route Engine Implementation
// ============================================================================

export class RouteEngineService implements RouteManagementContract {
  readonly engineName = 'route-management';
  readonly engineVersion = '1.0.0';

  constructor(private readonly supabase: SupabaseClient) {}

  // ==========================================================================
  // R1: Create Route
  // ==========================================================================

  async createRoute(request: CreateRouteRequest): Promise<EngineResponse<CreateRouteResult>> {
    const startTime = Date.now();

    try {
      // R17: Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'create-route');
      if (existing) {
        return existing as EngineResponse<CreateRouteResult>;
      }

      // Generate route number if not provided
      const routeNumber = request.routeNumber || await this.generateRouteNumber(request.tenantId);

      // R4: Calculate route distance if coordinates available
      const waypoints = request.waypoints.map((w) => ({
        sequence: w.sequence,
        location: w.location,
        type: w.type,
        plannedArrival: w.plannedArrival,
        actualArrival: undefined,
        shipmentIds: w.shipmentIds,
        action: w.action,
        completed: false,
        notes: w.notes,
      }));

      const totalDistance = calculateRouteDistance(waypoints);
      const estimatedDuration = estimateDuration(totalDistance);

      // Create route
      const { data: routeData, error: routeError } = await this.supabase
        .from('log_routes')
        .insert({
          tenant_id: request.tenantId,
          route_number: routeNumber,
          status: 'planned',
          vehicle_id: request.vehicleId || null,
          driver_id: request.driverId || null,
          planned_departure_time: request.plannedDepartureTime,
          planned_arrival_time: request.plannedArrivalTime,
          max_weight: request.maxWeight || null,
          max_volume: request.maxVolume || null,
          total_distance_km: totalDistance.value,
          estimated_duration_minutes: estimatedDuration,
          created_by: request.createdBy,
          last_modified_by: request.createdBy,
        })
        .select()
        .single();

      if (routeError || !routeData) {
        throw new Error(`Failed to create route: ${routeError?.message || 'Unknown error'}`);
      }

      const routeRow = routeData as RouteRow;

      // Create waypoints
      const waypointInserts = request.waypoints.map((w) => ({
        route_id: routeRow.id,
        sequence: w.sequence,
        location: w.location,
        waypoint_type: w.type,
        planned_arrival: w.plannedArrival,
        action: w.action,
        completed: false,
        notes: w.notes || null,
      }));

      const { error: waypointsError } = await this.supabase
        .from('log_route_waypoints')
        .insert(waypointInserts);

      if (waypointsError) {
        throw new Error(`Failed to create waypoints: ${waypointsError.message}`);
      }

      // R2: Assign shipments if provided
      const allShipmentIds = request.waypoints.flatMap((w) => w.shipmentIds);
      if (allShipmentIds.length > 0) {
        const shipmentInserts = allShipmentIds.map((shipmentId, index) => {
          const waypoint = request.waypoints.find((w) => w.shipmentIds.includes(shipmentId));
          return {
            route_id: routeRow.id,
            shipment_id: shipmentId,
            waypoint_sequence: waypoint?.sequence || null,
            assigned_by: request.createdBy,
          };
        });

        const { error: shipmentsError } = await this.supabase
          .from('log_route_shipments')
          .insert(shipmentInserts);

        if (shipmentsError) {
          throw new Error(`Failed to assign shipments: ${shipmentsError.message}`);
        }

        // Update shipment.route_id via Shipment Contract would go here
        // For now, direct update (integration pattern to be completed in B6)
        for (const shipmentId of allShipmentIds) {
          await this.supabase
            .from('log_shipments')
            .update({ route_id: routeRow.id })
            .eq('id', shipmentId)
            .eq('tenant_id', request.tenantId);
        }
      }

      const route = this.mapRouteRow(routeRow, waypoints, allShipmentIds);

      const result: CreateRouteResult = {
        route,
        routeNumber: route.routeNumber,
      };

      // Store idempotency
      await this.storeIdempotency(request.requestId, 'create-route', result);

      // TODO: Publish RouteCreated event (B6)

      return {
        success: true,
        data: result,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R2: Assign Shipments to Route
  // ==========================================================================

  async assignShipments(request: AssignShipmentsRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'assign-shipments');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Get route
      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found: ${request.routeId}`);
      }

      // R3: Validate capacity if requested
      if (request.validateCapacity) {
        const validation = await this.validateCapacity({
          tenantId: request.tenantId,
          routeId: request.routeId,
          shipmentIds: request.shipmentIds,
        });

        if (!validation.data?.valid) {
          throw new Error(
            `Capacity validation failed: ${validation.data?.violations.map((v) => `${v.type} exceeds by ${v.excess}`).join(', ')}`
          );
        }
      }

      // Insert route-shipment associations
      const shipmentInserts = request.shipmentIds.map((shipmentId) => ({
        route_id: request.routeId,
        shipment_id: shipmentId,
        waypoint_sequence: request.waypointSequence || null,
        assigned_by: request.assignedBy,
      }));

      const { error: insertError } = await this.supabase
        .from('log_route_shipments')
        .insert(shipmentInserts);

      if (insertError) {
        throw new Error(`Failed to assign shipments: ${insertError.message}`);
      }

      // Update shipment.route_id (integration with Shipment Contract)
      for (const shipmentId of request.shipmentIds) {
        await this.supabase
          .from('log_shipments')
          .update({ route_id: request.routeId })
          .eq('id', shipmentId)
          .eq('tenant_id', request.tenantId);
      }

      // Fetch updated route
      const updatedRoute = await this.getRouteById(request.tenantId, request.routeId);
      if (!updatedRoute) {
        throw new Error(`Failed to fetch updated route`);
      }

      await this.storeIdempotency(request.requestId, 'assign-shipments', updatedRoute);

      // TODO: Publish ShipmentsAssignedToRoute event (B6)

      return {
        success: true,
        data: updatedRoute,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R3: Validate Capacity Constraints
  // ==========================================================================

  async validateCapacity(
    request: ValidateCapacityRequest
  ): Promise<EngineResponse<CapacityValidationResult>> {
    const startTime = Date.now();

    try {
      // Get route capacity limits
      const { data: routeData, error: routeError } = await this.supabase
        .from('log_routes')
        .select('max_weight, max_volume')
        .eq('id', request.routeId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (routeError || !routeData) {
        throw new Error(`Route not found: ${request.routeId}`);
      }

      const maxWeight = (routeData as RouteRow).max_weight;
      const maxVolume = (routeData as RouteRow).max_volume;

      // Get shipment weights/volumes
      const { data: shipments, error: shipmentsError } = await this.supabase
        .from('log_shipments')
        .select('id, total_weight_kg, total_volume_m3')
        .in('id', request.shipmentIds)
        .eq('tenant_id', request.tenantId);

      if (shipmentsError) {
        throw new Error(`Failed to fetch shipments: ${shipmentsError.message}`);
      }

      let totalWeight = 0;
      let totalVolume = 0;

      for (const shipment of shipments || []) {
        totalWeight += (shipment as { total_weight_kg: number | null }).total_weight_kg || 0;
        totalVolume += (shipment as { total_volume_m3: number | null }).total_volume_m3 || 0;
      }

      const violations: CapacityViolation[] = [];

      if (maxWeight !== null && totalWeight > maxWeight) {
        violations.push({
          type: 'weight',
          current: totalWeight,
          max: maxWeight,
          excess: totalWeight - maxWeight,
        });
      }

      if (maxVolume !== null && totalVolume > maxVolume) {
        violations.push({
          type: 'volume',
          current: totalVolume,
          max: maxVolume,
          excess: totalVolume - maxVolume,
        });
      }

      const result: CapacityValidationResult = {
        valid: violations.length === 0,
        totalWeight,
        totalVolume,
        maxWeight: maxWeight || undefined,
        maxVolume: maxVolume || undefined,
        violations,
      };

      return {
        success: true,
        data: result,
        metadata: {
          requestId: `validate-${request.routeId}`,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, `validate-${request.routeId}`, startTime);
    }
  }

  // ==========================================================================
  // R5: Optimize Route Waypoint Sequence
  // ==========================================================================

  async optimizeRoute(request: OptimizeRouteRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'optimize-route');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Get route with waypoints
      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found: ${request.routeId}`);
      }

      // Simple nearest-neighbor optimization
      const optimizedWaypoints = this.optimizeWaypointsNearestNeighbor(
        route.waypoints,
        request.preserveFirstLast
      );

      // Update waypoint sequences
      for (let i = 0; i < optimizedWaypoints.length; i++) {
        await this.supabase
          .from('log_route_waypoints')
          .update({ sequence: i + 1 })
          .eq('route_id', request.routeId)
          .eq('sequence', optimizedWaypoints[i].sequence);
      }

      // Recalculate distance
      const newDistance = calculateRouteDistance(optimizedWaypoints);
      const newDuration = estimateDuration(newDistance);

      await this.supabase
        .from('log_routes')
        .update({
          total_distance_km: newDistance.value,
          estimated_duration_minutes: newDuration,
          last_modified_by: request.optimizedBy,
        })
        .eq('id', request.routeId)
        .eq('tenant_id', request.tenantId);

      const updatedRoute = await this.getRouteById(request.tenantId, request.routeId);
      if (!updatedRoute) {
        throw new Error(`Failed to fetch optimized route`);
      }

      await this.storeIdempotency(request.requestId, 'optimize-route', updatedRoute);

      // TODO: Publish RouteOptimized event (B6)

      return {
        success: true,
        data: updatedRoute,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R6: Start Route
  // ==========================================================================

  async startRoute(request: StartRouteRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'start-route');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Update route status
      const { error } = await this.supabase
        .from('log_routes')
        .update({
          status: 'in-progress',
          actual_departure_time: request.actualDepartureTime,
          last_modified_by: request.startedBy,
        })
        .eq('id', request.routeId)
        .eq('tenant_id', request.tenantId)
        .eq('status', 'planned'); // Only allow from planned state

      if (error) {
        throw new Error(`Failed to start route: ${error.message}`);
      }

      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found after update`);
      }

      await this.storeIdempotency(request.requestId, 'start-route', route);

      // TODO: Publish RouteStarted event (B6)

      return {
        success: true,
        data: route,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R7: Complete Waypoint
  // ==========================================================================

  async completeWaypoint(request: CompleteWaypointRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'complete-waypoint');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Update waypoint
      const { error } = await this.supabase
        .from('log_route_waypoints')
        .update({
          actual_arrival: request.actualArrival,
          completed: true,
          notes: request.notes || null,
        })
        .eq('route_id', request.routeId)
        .eq('sequence', request.waypointSequence);

      if (error) {
        throw new Error(`Failed to complete waypoint: ${error.message}`);
      }

      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found after waypoint completion`);
      }

      await this.storeIdempotency(request.requestId, 'complete-waypoint', route);

      // TODO: Publish WaypointCompleted event (B6) → triggers Shipment status updates

      return {
        success: true,
        data: route,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R8: Complete Route
  // ==========================================================================

  async completeRoute(request: CompleteRouteRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'complete-route');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Get route to calculate duration
      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found: ${request.routeId}`);
      }

      let actualDuration: number | null = null;
      if (route.actualDepartureTime) {
        const departure = new Date(route.actualDepartureTime).getTime();
        const arrival = new Date(request.actualArrivalTime).getTime();
        actualDuration = Math.round((arrival - departure) / (1000 * 60)); // minutes
      }

      // Update route status
      const { error } = await this.supabase
        .from('log_routes')
        .update({
          status: 'completed',
          actual_arrival_time: request.actualArrivalTime,
          actual_duration_minutes: actualDuration,
          last_modified_by: request.completedBy,
        })
        .eq('id', request.routeId)
        .eq('tenant_id', request.tenantId)
        .eq('status', 'in-progress');

      if (error) {
        throw new Error(`Failed to complete route: ${error.message}`);
      }

      const updatedRoute = await this.getRouteById(request.tenantId, request.routeId);
      if (!updatedRoute) {
        throw new Error(`Route not found after completion`);
      }

      await this.storeIdempotency(request.requestId, 'complete-route', updatedRoute);

      // TODO: Publish RouteCompleted event (B6)

      return {
        success: true,
        data: updatedRoute,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R9: Cancel Route
  // ==========================================================================

  async cancelRoute(request: CancelRouteRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'cancel-route');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Get route to find shipments
      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found: ${request.routeId}`);
      }

      // Update route status
      const { error: routeError } = await this.supabase
        .from('log_routes')
        .update({
          status: 'cancelled',
          last_modified_by: request.cancelledBy,
        })
        .eq('id', request.routeId)
        .eq('tenant_id', request.tenantId);

      if (routeError) {
        throw new Error(`Failed to cancel route: ${routeError.message}`);
      }

      // R9: Unassign shipments if requested
      if (request.unassignShipments && route.shipments.length > 0) {
        // Remove route-shipment associations
        const { error: deleteError } = await this.supabase
          .from('log_route_shipments')
          .delete()
          .eq('route_id', request.routeId);

        if (deleteError) {
          throw new Error(`Failed to unassign shipments: ${deleteError.message}`);
        }

        // Clear route_id from shipments
        for (const shipmentId of route.shipments) {
          await this.supabase
            .from('log_shipments')
            .update({ route_id: null })
            .eq('id', shipmentId)
            .eq('tenant_id', request.tenantId);
        }
      }

      const updatedRoute = await this.getRouteById(request.tenantId, request.routeId);
      if (!updatedRoute) {
        throw new Error(`Route not found after cancellation`);
      }

      await this.storeIdempotency(request.requestId, 'cancel-route', updatedRoute);

      // TODO: Publish RouteCancelled event (B6)

      return {
        success: true,
        data: updatedRoute,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R10: Reassign Shipment
  // ==========================================================================

  async reassignShipment(request: ReassignShipmentRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'reassign-shipment');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Remove from old route
      const { error: deleteError } = await this.supabase
        .from('log_route_shipments')
        .delete()
        .eq('route_id', request.fromRouteId)
        .eq('shipment_id', request.shipmentId);

      if (deleteError) {
        throw new Error(`Failed to remove shipment from old route: ${deleteError.message}`);
      }

      // Add to new route
      const { error: insertError } = await this.supabase
        .from('log_route_shipments')
        .insert({
          route_id: request.toRouteId,
          shipment_id: request.shipmentId,
          waypoint_sequence: request.toWaypointSequence,
          assigned_by: request.reassignedBy,
        });

      if (insertError) {
        throw new Error(`Failed to assign shipment to new route: ${insertError.message}`);
      }

      // Update shipment.route_id
      await this.supabase
        .from('log_shipments')
        .update({ route_id: request.toRouteId })
        .eq('id', request.shipmentId)
        .eq('tenant_id', request.tenantId);

      const newRoute = await this.getRouteById(request.tenantId, request.toRouteId);
      if (!newRoute) {
        throw new Error(`Failed to fetch new route`);
      }

      await this.storeIdempotency(request.requestId, 'reassign-shipment', newRoute);

      // TODO: Publish ShipmentReassigned event (B6)

      return {
        success: true,
        data: newRoute,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R16: Record Delivery Failure
  // ==========================================================================

  async recordDeliveryFailure(
    request: RecordDeliveryFailureRequest
  ): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      // Check idempotency
      const existing = await this.checkIdempotency(request.requestId, 'record-delivery-failure');
      if (existing) {
        return existing as EngineResponse<Route>;
      }

      // Update waypoint notes with failure
      const failureNote = `DELIVERY FAILED: ${request.failureReason}. Attempted: ${request.attemptedDeliveryTime}. Next attempt: ${request.nextAttemptDate || 'TBD'}`;

      const { error } = await this.supabase
        .from('log_route_waypoints')
        .update({ notes: failureNote })
        .eq('route_id', request.routeId)
        .eq('sequence', request.waypointSequence);

      if (error) {
        throw new Error(`Failed to record delivery failure: ${error.message}`);
      }

      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found after recording failure`);
      }

      await this.storeIdempotency(request.requestId, 'record-delivery-failure', route);

      // TODO: Publish DeliveryFailedAtWaypoint event (B6) → triggers Shipment status update

      return {
        success: true,
        data: route,
        metadata: {
          requestId: request.requestId,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, request.requestId, startTime);
    }
  }

  // ==========================================================================
  // R11: Get Route by ID
  // ==========================================================================

  async getRoute(request: GetRouteRequest): Promise<EngineResponse<Route>> {
    const startTime = Date.now();

    try {
      const route = await this.getRouteById(request.tenantId, request.routeId);
      if (!route) {
        throw new Error(`Route not found: ${request.routeId}`);
      }

      return {
        success: true,
        data: route,
        metadata: {
          requestId: `get-${request.routeId}`,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, `get-${request.routeId}`, startTime);
    }
  }

  // ==========================================================================
  // R12: Get Routes by Status
  // ==========================================================================

  async getRoutesByStatus(request: GetRoutesByStatusRequest): Promise<EngineResponse<Route[]>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.supabase
        .from('log_routes')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .in('status', request.statuses)
        .order('created_at', { ascending: false })
        .range(request.offset || 0, (request.offset || 0) + (request.limit || 50) - 1);

      if (error) {
        throw new Error(`Failed to fetch routes: ${error.message}`);
      }

      const routes: Route[] = [];
      for (const row of data || []) {
        const route = await this.getRouteById(request.tenantId, (row as RouteRow).id);
        if (route) routes.push(route);
      }

      return {
        success: true,
        data: routes,
        metadata: {
          requestId: `get-by-status`,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, 'get-by-status', startTime);
    }
  }

  // ==========================================================================
  // R13: Get Routes by Driver
  // ==========================================================================

  async getRoutesByDriver(request: GetRoutesByDriverRequest): Promise<EngineResponse<Route[]>> {
    const startTime = Date.now();

    try {
      let query = this.supabase
        .from('log_routes')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('driver_id', request.driverId);

      if (request.dateFrom) {
        query = query.gte('planned_departure_time', request.dateFrom);
      }

      if (request.dateTo) {
        query = query.lte('planned_departure_time', request.dateTo);
      }

      if (request.status) {
        query = query.in('status', request.status);
      }

      const { data, error } = await query
        .order('planned_departure_time', { ascending: false })
        .range(request.offset || 0, (request.offset || 0) + (request.limit || 50) - 1);

      if (error) {
        throw new Error(`Failed to fetch routes: ${error.message}`);
      }

      const routes: Route[] = [];
      for (const row of data || []) {
        const route = await this.getRouteById(request.tenantId, (row as RouteRow).id);
        if (route) routes.push(route);
      }

      return {
        success: true,
        data: routes,
        metadata: {
          requestId: `get-by-driver-${request.driverId}`,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, `get-by-driver-${request.driverId}`, startTime);
    }
  }

  // ==========================================================================
  // R13 (Vehicle variant): Get Routes by Vehicle
  // ==========================================================================

  async getRoutesByVehicle(request: GetRoutesByVehicleRequest): Promise<EngineResponse<Route[]>> {
    const startTime = Date.now();

    try {
      let query = this.supabase
        .from('log_routes')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('vehicle_id', request.vehicleId);

      if (request.dateFrom) {
        query = query.gte('planned_departure_time', request.dateFrom);
      }

      if (request.dateTo) {
        query = query.lte('planned_departure_time', request.dateTo);
      }

      if (request.status) {
        query = query.in('status', request.status);
      }

      const { data, error } = await query
        .order('planned_departure_time', { ascending: false })
        .range(request.offset || 0, (request.offset || 0) + (request.limit || 50) - 1);

      if (error) {
        throw new Error(`Failed to fetch routes: ${error.message}`);
      }

      const routes: Route[] = [];
      for (const row of data || []) {
        const route = await this.getRouteById(request.tenantId, (row as RouteRow).id);
        if (route) routes.push(route);
      }

      return {
        success: true,
        data: routes,
        metadata: {
          requestId: `get-by-vehicle-${request.vehicleId}`,
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, `get-by-vehicle-${request.vehicleId}`, startTime);
    }
  }

  // ==========================================================================
  // R14: Get Route Metrics
  // ==========================================================================

  async getRouteMetrics(request: GetRouteMetricsRequest): Promise<EngineResponse<RouteMetrics>> {
    const startTime = Date.now();

    try {
      let query = this.supabase
        .from('log_routes')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .gte('created_at', request.dateFrom)
        .lte('created_at', request.dateTo);

      if (request.driverId) {
        query = query.eq('driver_id', request.driverId);
      }

      if (request.vehicleId) {
        query = query.eq('vehicle_id', request.vehicleId);
      }

      if (request.status) {
        query = query.in('status', request.status);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch route metrics: ${error.message}`);
      }

      const routes = data || [];
      const completed = routes.filter((r) => (r as RouteRow).status === 'completed');
      const inProgress = routes.filter((r) => (r as RouteRow).status === 'in-progress');
      const cancelled = routes.filter((r) => (r as RouteRow).status === 'cancelled');

      let totalDistance = 0;
      let totalDuration = 0;
      let totalWaypoints = 0;
      let onTimeCount = 0;

      for (const route of completed) {
        const r = route as RouteRow;
        totalDistance += r.total_distance_km || 0;
        totalDuration += r.actual_duration_minutes || 0;

        // Simple on-time check
        if (r.actual_arrival_time && r.planned_arrival_time) {
          const planned = new Date(r.planned_arrival_time).getTime();
          const actual = new Date(r.actual_arrival_time).getTime();
          if (actual <= planned) onTimeCount++;
        }
      }

      // Count waypoints
      const { data: waypointsData } = await this.supabase
        .from('log_route_waypoints')
        .select('route_id, action')
        .in(
          'route_id',
          routes.map((r) => (r as RouteRow).id)
        );

      const deliveries = (waypointsData || []).filter((w) => (w as { action: string }).action === 'delivery').length;
      const pickups = (waypointsData || []).filter((w) => (w as { action: string }).action === 'pickup').length;

      totalWaypoints = (waypointsData || []).length;

      // Count shipments
      const { data: shipmentsData } = await this.supabase
        .from('log_route_shipments')
        .select('route_id')
        .in(
          'route_id',
          routes.map((r) => (r as RouteRow).id)
        );

      const totalShipments = (shipmentsData || []).length;

      const metrics: RouteMetrics = {
        totalRoutes: routes.length,
        completedRoutes: completed.length,
        inProgressRoutes: inProgress.length,
        cancelledRoutes: cancelled.length,
        averageRouteDistance: completed.length > 0 ? totalDistance / completed.length : 0,
        averageRouteDuration: completed.length > 0 ? totalDuration / completed.length : 0,
        averageWaypoints: routes.length > 0 ? totalWaypoints / routes.length : 0,
        averageShipmentsPerRoute: routes.length > 0 ? totalShipments / routes.length : 0,
        onTimeCompletionRate: completed.length > 0 ? (onTimeCount / completed.length) * 100 : 0,
        totalDistanceCovered: { value: totalDistance, unit: 'km' },
        totalDeliveries: deliveries,
        totalPickups: pickups,
        failedDeliveries: 0, // Would need failure tracking
      };

      return {
        success: true,
        data: metrics,
        metadata: {
          requestId: 'get-metrics',
          engineVersion: this.engineVersion,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return this.handleError(error, 'get-metrics', startTime);
    }
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase.from('log_routes').select('id').limit(1);

      return {
        status: error ? 'unhealthy' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: error ? 'error' : 'ok',
        },
        message: error?.message,
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

  private async getRouteById(tenantId: string, routeId: string): Promise<Route | null> {
    const { data: routeData, error: routeError } = await this.supabase
      .from('log_routes')
      .select('*')
      .eq('id', routeId)
      .eq('tenant_id', tenantId)
      .single();

    if (routeError || !routeData) return null;

    const routeRow = routeData as RouteRow;

    // Fetch waypoints
    const { data: waypointsData } = await this.supabase
      .from('log_route_waypoints')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence');

    const waypoints: Waypoint[] = (waypointsData || []).map((w) => {
      const wp = w as WaypointRow;
      return {
        sequence: wp.sequence,
        location: wp.location as unknown as { type: string; address: unknown; coordinates?: unknown },
        type: wp.waypoint_type,
        plannedArrival: wp.planned_arrival,
        actualArrival: wp.actual_arrival || undefined,
        shipmentIds: [],
        action: wp.action,
        completed: wp.completed,
        notes: wp.notes || undefined,
      };
    });

    // Fetch shipment IDs
    const { data: shipmentsData } = await this.supabase
      .from('log_route_shipments')
      .select('shipment_id, waypoint_sequence')
      .eq('route_id', routeId);

    const shipmentIds = (shipmentsData || []).map((s) => (s as RouteShipmentRow).shipment_id);

    // Map waypoint shipments
    for (const shipment of shipmentsData || []) {
      const rs = shipment as RouteShipmentRow;
      if (rs.waypoint_sequence !== null) {
        const waypoint = waypoints.find((w) => w.sequence === rs.waypoint_sequence);
        if (waypoint) waypoint.shipmentIds.push(rs.shipment_id);
      }
    }

    return this.mapRouteRow(routeRow, waypoints, shipmentIds);
  }

  private mapRouteRow(row: RouteRow, waypoints: Waypoint[], shipmentIds: string[]): Route {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      routeNumber: row.route_number,
      status: row.status,
      vehicleId: row.vehicle_id || undefined,
      driverId: row.driver_id || undefined,
      plannedDepartureTime: row.planned_departure_time,
      actualDepartureTime: row.actual_departure_time || undefined,
      plannedArrivalTime: row.planned_arrival_time,
      actualArrivalTime: row.actual_arrival_time || undefined,
      waypoints,
      shipments: shipmentIds,
      totalDistance: row.total_distance_km ? { value: row.total_distance_km, unit: 'km' } : undefined,
      estimatedDuration: row.estimated_duration_minutes || undefined,
      actualDuration: row.actual_duration_minutes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async generateRouteNumber(tenantId: string): Promise<string> {
    const { count } = await this.supabase
      .from('log_routes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const routeCount = (count || 0) + 1;
    return `RT-${Date.now()}-${routeCount.toString().padStart(6, '0')}`;
  }

  private optimizeWaypointsNearestNeighbor(
    waypoints: Waypoint[],
    preserveFirstLast: boolean
  ): Waypoint[] {
    if (waypoints.length <= 2) return waypoints;

    const optimized: Waypoint[] = [];
    const remaining = [...waypoints];

    // Start with first waypoint if preserving
    if (preserveFirstLast) {
      optimized.push(remaining.shift()!);
    }

    // Nearest neighbor greedy algorithm
    while (remaining.length > (preserveFirstLast ? 1 : 0)) {
      const current = optimized[optimized.length - 1];
      let nearest: Waypoint | null = null;
      let minDistance = Infinity;

      for (const candidate of remaining) {
        if (preserveFirstLast && remaining.length === 1) break;

        const distance = calculateWaypointDistance(current, candidate);
        if (distance && distance.value < minDistance) {
          minDistance = distance.value;
          nearest = candidate;
        }
      }

      if (nearest) {
        optimized.push(nearest);
        remaining.splice(remaining.indexOf(nearest), 1);
      } else {
        optimized.push(remaining.shift()!);
      }
    }

    // Add last waypoint if preserving
    if (preserveFirstLast && remaining.length > 0) {
      optimized.push(remaining[0]);
    }

    return optimized;
  }

  private async checkIdempotency(
    requestId: string,
    operationType: string
  ): Promise<EngineResponse<unknown> | null> {
    const { data, error } = await this.supabase
      .from('log_idempotency_keys')
      .select('response_data')
      .eq('request_id', requestId)
      .eq('operation_type', operationType)
      .single();

    if (error || !data) return null;

    const row = data as IdempotencyKeyRow;
    return row.response_data as EngineResponse<unknown>;
  }

  private async storeIdempotency(
    requestId: string,
    operationType: string,
    responseData: unknown
  ): Promise<void> {
    await this.supabase.from('log_idempotency_keys').insert({
      request_id: requestId,
      operation_type: operationType,
      response_data: responseData,
    });
  }

  private handleError(error: unknown, requestId: string, startTime: number): EngineResponse<never> {
    return {
      success: false,
      error: {
        code: 'ROUTE_ENGINE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        requestId,
        engineVersion: this.engineVersion,
        executionTimeMs: Date.now() - startTime,
      },
    };
  }
}
