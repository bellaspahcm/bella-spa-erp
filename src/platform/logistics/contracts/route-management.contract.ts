/**
 * Route Management Contract - Logistics Platform
 *
 * Defines the public API for route planning, optimization, and execution.
 * Handles route lifecycle from creation through completion, including waypoint management
 * and integration with shipments, carriers, and warehouses.
 *
 * Route Lifecycle:
 *   PLANNED → ASSIGNED → IN_PROGRESS → COMPLETED
 *   Any state → CANCELLED (with reason)
 *
 * Architecture Compliance:
 *   - Product → Contract → Engine pattern
 *   - No direct Core modification
 *   - Event-driven integration with Shipment Management
 *   - Strictly typed, no `any` types
 *
 * @module platform/logistics/contracts/route-management.contract
 */

import type {
  EngineResponse,
  EngineHealthStatus,
  Route,
  RouteStatus,
  Waypoint,
  Location,
  Distance,
} from '../shared-kernel/types';

// ============================================================================
// Route Request Types
// ============================================================================

export interface CreateRouteRequest {
  /** Idempotency key — prevents duplicate route creation */
  requestId: string;
  tenantId: string;
  routeNumber?: string; // Auto-generated if not provided
  vehicleId?: string;
  driverId?: string;
  plannedDepartureTime: string; // ISO 8601 datetime
  plannedArrivalTime: string;
  waypoints: WaypointInput[];
  maxWeight?: number; // kg
  maxVolume?: number; // cubic meters
  createdBy: string;
}

export interface WaypointInput {
  sequence: number;
  location: Location;
  type: 'origin' | 'pickup' | 'delivery' | 'hub' | 'destination';
  plannedArrival: string; // ISO 8601 datetime
  shipmentIds: string[];
  action: 'pickup' | 'delivery' | 'stopover';
  notes?: string;
}

export interface AssignShipmentsRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  routeId: string;
  shipmentIds: string[];
  waypointSequence?: number; // Which waypoint these shipments belong to
  validateCapacity: boolean; // If true, validate weight/volume constraints
  assignedBy: string;
}

export interface ValidateCapacityRequest {
  tenantId: string;
  routeId: string;
  shipmentIds: string[]; // Shipments to validate
}

export interface CapacityValidationResult {
  valid: boolean;
  totalWeight: number;
  totalVolume: number;
  maxWeight?: number;
  maxVolume?: number;
  violations: CapacityViolation[];
}

export interface CapacityViolation {
  type: 'weight' | 'volume';
  current: number;
  max: number;
  excess: number;
}

export interface OptimizeRouteRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  routeId: string;
  objective: 'distance' | 'time';
  preserveFirstLast: boolean; // Keep origin and destination fixed
  optimizedBy: string;
}

export interface StartRouteRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  routeId: string;
  actualDepartureTime: string; // ISO 8601 datetime
  startedBy: string;
}

export interface CompleteWaypointRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  routeId: string;
  waypointSequence: number;
  actualArrival: string; // ISO 8601 datetime
  notes?: string;
  completedBy: string;
}

export interface CompleteRouteRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  routeId: string;
  actualArrivalTime: string; // ISO 8601 datetime
  completedBy: string;
}

export interface CancelRouteRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  routeId: string;
  reason: string;
  unassignShipments: boolean; // If true, unlink all shipments from route
  cancelledBy: string;
}

export interface ReassignShipmentRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  shipmentId: string;
  fromRouteId: string;
  toRouteId: string;
  toWaypointSequence: number;
  reason: string;
  reassignedBy: string;
}

export interface RecordDeliveryFailureRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  routeId: string;
  waypointSequence: number;
  shipmentId: string;
  failureReason: string;
  attemptedDeliveryTime: string; // ISO 8601 datetime
  nextAttemptDate?: string;
  recordedBy: string;
}

export interface GetRouteRequest {
  tenantId: string;
  routeId: string;
}

export interface GetRoutesByStatusRequest {
  tenantId: string;
  statuses: RouteStatus[];
  limit?: number;
  offset?: number;
}

export interface GetRoutesByDriverRequest {
  tenantId: string;
  driverId: string;
  dateFrom?: string; // ISO 8601 date
  dateTo?: string;
  status?: RouteStatus[];
  limit?: number;
  offset?: number;
}

export interface GetRoutesByVehicleRequest {
  tenantId: string;
  vehicleId: string;
  dateFrom?: string;
  dateTo?: string;
  status?: RouteStatus[];
  limit?: number;
  offset?: number;
}

export interface GetRouteMetricsRequest {
  tenantId: string;
  dateFrom: string; // ISO 8601 date
  dateTo: string;
  driverId?: string;
  vehicleId?: string;
  status?: RouteStatus[];
}

// ============================================================================
// Route Response Types
// ============================================================================

export interface CreateRouteResult {
  route: Route;
  routeNumber: string;
}

export interface RouteMetrics {
  totalRoutes: number;
  completedRoutes: number;
  inProgressRoutes: number;
  cancelledRoutes: number;
  averageRouteDistance: number; // km
  averageRouteDuration: number; // minutes
  averageWaypoints: number;
  averageShipmentsPerRoute: number;
  onTimeCompletionRate: number; // percentage
  totalDistanceCovered: Distance;
  totalDeliveries: number;
  totalPickups: number;
  failedDeliveries: number;
}

export interface OptimizationResult {
  originalDistance: Distance;
  optimizedDistance: Distance;
  savings: Distance;
  savingsPercentage: number;
  originalSequence: number[];
  optimizedSequence: number[];
}

// ============================================================================
// Route Domain Events
// ============================================================================

export interface RouteCreatedPayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  vehicleId?: string;
  driverId?: string;
  plannedDepartureTime: string;
  plannedArrivalTime: string;
  waypointCount: number;
  shipmentCount: number;
  status: RouteStatus; // Should be 'planned'
  createdBy: string;
  createdAt: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentsAssignedToRoutePayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  shipmentIds: string[];
  waypointSequence?: number;
  assignedBy: string;
  assignedAt: string;
  correlationId: string;
  causationId: string;
}

export interface RouteOptimizedPayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  optimization: OptimizationResult;
  optimizedBy: string;
  optimizedAt: string;
  correlationId: string;
  causationId: string;
}

export interface RouteStartedPayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  status: RouteStatus; // Should be 'in-progress'
  actualDepartureTime: string;
  driverId?: string;
  vehicleId?: string;
  startedBy: string;
  correlationId: string;
  causationId: string;
}

export interface WaypointCompletedPayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  waypointSequence: number;
  waypointType: 'origin' | 'pickup' | 'delivery' | 'hub' | 'destination';
  action: 'pickup' | 'delivery' | 'stopover';
  actualArrival: string;
  shipmentIds: string[]; // Affected shipments at this waypoint
  completedBy: string;
  timestamp: string;
  correlationId: string;
  causationId: string;
}

export interface RouteCompletedPayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  status: RouteStatus; // Should be 'completed'
  actualArrivalTime: string;
  actualDuration: number; // minutes
  totalDistance?: Distance;
  completedWaypoints: number;
  completedBy: string;
  correlationId: string;
  causationId: string;
}

export interface RouteCancelledPayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  status: RouteStatus; // Should be 'cancelled'
  reason: string;
  shipmentsUnassigned: boolean;
  affectedShipmentIds: string[];
  cancelledBy: string;
  cancelledAt: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentReassignedPayload {
  shipmentId: string;
  tenantId: string;
  fromRouteId: string;
  toRouteId: string;
  toWaypointSequence: number;
  reason: string;
  reassignedBy: string;
  reassignedAt: string;
  correlationId: string;
  causationId: string;
}

export interface DeliveryFailedAtWaypointPayload {
  routeId: string;
  routeNumber: string;
  tenantId: string;
  waypointSequence: number;
  shipmentId: string;
  failureReason: string;
  attemptedDeliveryTime: string;
  nextAttemptDate?: string;
  recordedBy: string;
  timestamp: string;
  correlationId: string;
  causationId: string;
}

// ============================================================================
// Route Management Contract Metadata (for Contract Registry)
// ============================================================================

import type { ContractMetadata } from '../../host/contract-registry/types';

export const ROUTE_MANAGEMENT_CONTRACT: ContractMetadata = {
  name: 'route-management',
  version: '1.0.0',
  type: 'engine',
  description: 'Route Management Engine — route planning, optimization, and execution for logistics operations',
  owner: 'Logistics Platform Team',
  status: 'active',

  // API endpoints
  endpoints: [
    {
      path: '/api/route-management/create',
      method: 'POST',
      operationId: 'createRoute',
      summary: 'Create a new delivery route',
      requestSchema: {
        schemaId: 'create-route-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'plannedDepartureTime', 'plannedArrivalTime', 'waypoints', 'createdBy'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            routeNumber: { type: 'string' },
            vehicleId: { type: 'string', format: 'uuid' },
            driverId: { type: 'string', format: 'uuid' },
            plannedDepartureTime: { type: 'string', format: 'date-time' },
            plannedArrivalTime: { type: 'string', format: 'date-time' },
            waypoints: { type: 'array', items: { type: 'object' } },
            maxWeight: { type: 'number' },
            maxVolume: { type: 'number' },
            createdBy: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'create-route-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['logistics-operator', 'route-planner', 'admin'] }],
    },
    {
      path: '/api/route-management/assign-shipments',
      method: 'POST',
      operationId: 'assignShipments',
      summary: 'Assign shipments to a route',
      requestSchema: {
        schemaId: 'assign-shipments-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'routeId', 'shipmentIds', 'validateCapacity', 'assignedBy'],
        },
      },
      responseSchema: {
        schemaId: 'route-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['logistics-operator', 'route-planner', 'admin'] }],
    },
    {
      path: '/api/route-management/start',
      method: 'POST',
      operationId: 'startRoute',
      summary: 'Start route execution',
      requestSchema: {
        schemaId: 'start-route-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'routeId', 'actualDepartureTime', 'startedBy'],
        },
      },
      responseSchema: {
        schemaId: 'route-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['driver', 'logistics-operator', 'admin'] }],
    },
    {
      path: '/api/route-management/complete-waypoint',
      method: 'POST',
      operationId: 'completeWaypoint',
      summary: 'Mark a waypoint as completed',
      requestSchema: {
        schemaId: 'complete-waypoint-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'routeId', 'waypointSequence', 'actualArrival', 'completedBy'],
        },
      },
      responseSchema: {
        schemaId: 'route-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['driver', 'logistics-operator', 'admin'] }],
    },
  ],

  // Domain events
  events: [
    {
      eventType: 'RouteCreated',
      version: '1.0.0',
      summary: 'Published when a new route is created',
      description: 'Triggers downstream workflows: vehicle assignment, driver notification, route optimization',
      payloadSchema: {
        schemaId: 'route-created-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object' },
      },
      publisher: 'route-management',
      subscribers: ['shipment-management', 'notification-hub', 'vehicle-management'],
    },
    {
      eventType: 'WaypointCompleted',
      version: '1.0.0',
      summary: 'Published when a waypoint is completed',
      description: 'Triggers: shipment status updates (pickup/delivery), customer notifications',
      payloadSchema: {
        schemaId: 'waypoint-completed-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object' },
      },
      publisher: 'route-management',
      subscribers: ['shipment-management', 'notification-hub'],
    },
    {
      eventType: 'RouteCompleted',
      version: '1.0.0',
      summary: 'Published when entire route is completed',
      description: 'Triggers: route performance analytics, driver settlement, vehicle availability update',
      payloadSchema: {
        schemaId: 'route-completed-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object' },
      },
      publisher: 'route-management',
      subscribers: ['analytics-engine', 'billing-engine', 'vehicle-management'],
    },
    {
      eventType: 'RouteCancelled',
      version: '1.0.0',
      summary: 'Published when a route is cancelled',
      description: 'Triggers: shipment reassignment, driver notification, vehicle release',
      payloadSchema: {
        schemaId: 'route-cancelled-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object' },
      },
      publisher: 'route-management',
      subscribers: ['shipment-management', 'notification-hub', 'vehicle-management'],
    },
  ],

  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Route Management Engine Contract Interface
// ============================================================================

/**
 * Route Management Engine Contract
 * 
 * Primary contract for Logistics OS route operations.
 * Handles route planning, optimization, execution, and integration with shipments.
 */
export interface RouteManagementContract {
  readonly engineName: string;
  readonly engineVersion: string;

  /**
   * Create a new route.
   * 
   * Creates a route in PLANNED status with waypoints.
   * Generates unique route number if not provided.
   * Publishes RouteCreated event.
   * 
   * Idempotent: same requestId returns same result.
   */
  createRoute(request: CreateRouteRequest): Promise<EngineResponse<CreateRouteResult>>;

  /**
   * Assign shipments to a route.
   * 
   * Validates capacity constraints if requested.
   * Links shipments to route via Shipment Contract.
   * Publishes ShipmentsAssignedToRoute event.
   * 
   * Idempotent: same requestId returns same result.
   */
  assignShipments(request: AssignShipmentsRequest): Promise<EngineResponse<Route>>;

  /**
   * Validate route capacity constraints.
   * 
   * Calculates total weight/volume of assigned shipments.
   * Compares against route capacity limits.
   * Returns violations if any.
   */
  validateCapacity(request: ValidateCapacityRequest): Promise<EngineResponse<CapacityValidationResult>>;

  /**
   * Optimize route waypoint sequence.
   * 
   * Uses optimization algorithm to minimize distance or time.
   * Can preserve first/last waypoints (origin/destination).
   * Publishes RouteOptimized event.
   * 
   * Idempotent: same requestId returns same result.
   */
  optimizeRoute(request: OptimizeRouteRequest): Promise<EngineResponse<Route>>;

  /**
   * Start route execution.
   * 
   * Transitions: PLANNED → IN_PROGRESS.
   * Records actual departure time.
   * Publishes RouteStarted event.
   * 
   * Idempotent: same requestId returns same result.
   */
  startRoute(request: StartRouteRequest): Promise<EngineResponse<Route>>;

  /**
   * Mark waypoint as completed.
   * 
   * Records actual arrival time.
   * Publishes WaypointCompleted event (triggers shipment status updates).
   * 
   * Idempotent: same requestId returns same result.
   */
  completeWaypoint(request: CompleteWaypointRequest): Promise<EngineResponse<Route>>;

  /**
   * Complete entire route.
   * 
   * Transitions: IN_PROGRESS → COMPLETED.
   * Calculates actual duration and distance.
   * Publishes RouteCompleted event.
   * 
   * Idempotent: same requestId returns same result.
   */
  completeRoute(request: CompleteRouteRequest): Promise<EngineResponse<Route>>;

  /**
   * Cancel a route.
   * 
   * Can cancel from PLANNED or IN_PROGRESS states.
   * Optionally unassigns all shipments.
   * Publishes RouteCancelled event.
   * 
   * Idempotent: same requestId returns same result.
   */
  cancelRoute(request: CancelRouteRequest): Promise<EngineResponse<Route>>;

  /**
   * Reassign shipment from one route to another.
   * 
   * Validates target route capacity.
   * Updates both routes and shipment.
   * Publishes ShipmentReassigned event.
   * 
   * Idempotent: same requestId returns same result.
   */
  reassignShipment(request: ReassignShipmentRequest): Promise<EngineResponse<Route>>;

  /**
   * Record delivery failure at waypoint.
   * 
   * Marks waypoint with failure reason.
   * Publishes DeliveryFailedAtWaypoint event (triggers shipment status update).
   * 
   * Idempotent: same requestId returns same result.
   */
  recordDeliveryFailure(request: RecordDeliveryFailureRequest): Promise<EngineResponse<Route>>;

  /**
   * Get route by ID.
   */
  getRoute(request: GetRouteRequest): Promise<EngineResponse<Route>>;

  /**
   * Get routes by status.
   */
  getRoutesByStatus(request: GetRoutesByStatusRequest): Promise<EngineResponse<Route[]>>;

  /**
   * Get routes by driver.
   */
  getRoutesByDriver(request: GetRoutesByDriverRequest): Promise<EngineResponse<Route[]>>;

  /**
   * Get routes by vehicle.
   */
  getRoutesByVehicle(request: GetRoutesByVehicleRequest): Promise<EngineResponse<Route[]>>;

  /**
   * Get route performance metrics.
   */
  getRouteMetrics(request: GetRouteMetricsRequest): Promise<EngineResponse<RouteMetrics>>;

  /**
   * Health check endpoint for monitoring.
   */
  healthCheck(): Promise<EngineHealthStatus>;
}
