/**
 * Shipment Management Contract - Logistics Platform
 *
 * Defines the public API for shipment lifecycle management.
 * Primary contract for Logistics OS - handles shipment creation, tracking, and delivery.
 *
 * Shipment Lifecycle:
 *   DRAFT → PENDING_PICKUP → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
 *   Any state → CANCELLED (with reason)
 *   DELIVERED → RETURNED (if return initiated)
 *
 * Architecture Compliance:
 *   - Product → Contract → Engine pattern
 *   - No direct Core modification
 *   - Event-driven integration
 *   - Strictly typed, no `any` types
 *
 * @module platform/logistics/contracts/shipment-management.contract
 */

import type {
  EngineResponse,
  EngineHealthStatus,
  Shipment,
  ShipmentStatus,
  ShipmentType,
  ShipmentPriority,
  ShipmentItem,
  Location,
  TrackingEvent,
  Weight,
  Volume,
} from '../shared-kernel/types';

// ============================================================================
// Shipment Request Types
// ============================================================================

export interface CreateShipmentRequest {
  /** Idempotency key — prevents duplicate shipment creation */
  requestId: string;
  tenantId: string;
  type: ShipmentType;
  priority: ShipmentPriority;
  origin: Location;
  destination: Location;
  plannedPickupDate: string; // ISO 8601 datetime
  plannedDeliveryDate: string;
  items: ShipmentItem[];
  carrierId?: string;
  specialInstructions?: string;
  createdBy: string;
}

export interface UpdateShipmentStatusRequest {
  /** Idempotency key — prevents duplicate status updates */
  requestId: string;
  tenantId: string;
  shipmentId: string;
  newStatus: ShipmentStatus;
  location?: Location;
  notes?: string;
  performedBy: string;
}

export interface AssignCarrierRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  shipmentId: string;
  carrierId: string;
  assignedBy: string;
}

export interface AssignRouteRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  shipmentId: string;
  routeId: string;
  assignedBy: string;
}

export interface RecordPickupRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  shipmentId: string;
  actualPickupDate: string; // ISO 8601 datetime
  location?: Location;
  pickedUpBy: string;
  notes?: string;
}

export interface RecordDeliveryRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  shipmentId: string;
  actualDeliveryDate: string; // ISO 8601 datetime
  location?: Location;
  deliveredBy: string;
  recipientName: string;
  recipientSignature?: string; // Base64 encoded signature image
  notes?: string;
}

export interface InitiateReturnRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  originalShipmentId: string;
  reason: string;
  initiatedBy: string;
}

export interface CancelShipmentRequest {
  /** Idempotency key */
  requestId: string;
  tenantId: string;
  shipmentId: string;
  reason: string;
  cancelledBy: string;
}

export interface GetShipmentRequest {
  tenantId: string;
  shipmentId: string;
}

export interface GetShipmentsByStatusRequest {
  tenantId: string;
  statuses: ShipmentStatus[];
  limit?: number;
  offset?: number;
}

export interface TrackShipmentRequest {
  tenantId: string;
  shipmentId?: string;
  shipmentNumber?: string;
}

export interface GetShipmentsByCarrierRequest {
  tenantId: string;
  carrierId: string;
  dateFrom?: string;
  dateTo?: string;
  status?: ShipmentStatus[];
  limit?: number;
  offset?: number;
}

export interface GetShipmentMetricsRequest {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  carrierId?: string;
  type?: ShipmentType;
}

// ============================================================================
// Shipment Response Types
// ============================================================================

export interface CreateShipmentResult {
  shipment: Shipment;
  shipmentNumber: string;
}

export interface TrackShipmentResult {
  shipment: Shipment;
  currentLocation?: Location;
  estimatedDeliveryDate?: string;
  trackingHistory: TrackingEvent[];
}

export interface ShipmentMetrics {
  totalShipments: number;
  deliveredShipments: number;
  inTransitShipments: number;
  pendingShipments: number;
  cancelledShipments: number;
  returnedShipments: number;
  onTimeDeliveryRate: number; // percentage
  averageDeliveryTime: number; // hours
  averagePickupTime: number; // hours from creation to pickup
  totalWeight?: Weight;
  totalVolume?: Volume;
}

// ============================================================================
// Shipment Domain Events
// ============================================================================

export interface ShipmentCreatedPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  type: ShipmentType;
  priority: ShipmentPriority;
  origin: Location;
  destination: Location;
  plannedPickupDate: string;
  plannedDeliveryDate: string;
  status: ShipmentStatus; // Should be 'draft'
  createdBy: string;
  createdAt: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentPickedUpPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  status: ShipmentStatus; // Should be 'picked-up'
  actualPickupDate: string;
  location?: Location;
  pickedUpBy: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentInTransitPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  status: ShipmentStatus; // Should be 'in-transit'
  currentLocation?: Location;
  carrierId?: string;
  routeId?: string;
  timestamp: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentOutForDeliveryPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  status: ShipmentStatus; // Should be 'out-for-delivery'
  currentLocation?: Location;
  estimatedDeliveryTime?: string;
  timestamp: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentDeliveredPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  status: ShipmentStatus; // Should be 'delivered'
  actualDeliveryDate: string;
  location?: Location;
  deliveredBy: string;
  recipientName: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentFailedDeliveryPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  status: ShipmentStatus; // Should be 'failed-delivery'
  attemptedDeliveryDate: string;
  failureReason: string;
  nextAttemptDate?: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentReturnedPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  originalShipmentId: string;
  status: ShipmentStatus; // Should be 'returned'
  returnReason: string;
  returnedAt: string;
  correlationId: string;
  causationId: string;
}

export interface ShipmentCancelledPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  status: ShipmentStatus; // Should be 'cancelled'
  cancellationReason: string;
  cancelledBy: string;
  cancelledAt: string;
  correlationId: string;
  causationId: string;
}

export interface CarrierAssignedPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  carrierId: string;
  assignedBy: string;
  assignedAt: string;
  correlationId: string;
  causationId: string;
}

export interface RouteAssignedPayload {
  shipmentId: string;
  shipmentNumber: string;
  tenantId: string;
  routeId: string;
  assignedBy: string;
  assignedAt: string;
  correlationId: string;
  causationId: string;
}

// ============================================================================
// Shipment Management Contract Metadata (for Contract Registry)
// ============================================================================

import type { ContractMetadata } from '../../host/contract-registry/types';

export const SHIPMENT_MANAGEMENT_CONTRACT: ContractMetadata = {
  name: 'shipment-management',
  version: '1.0.0',
  type: 'engine',
  description: 'Shipment Management Engine — complete shipment lifecycle from creation to delivery',
  owner: 'Logistics Platform Team',
  status: 'active',

  // API endpoints
  endpoints: [
    {
      path: '/api/shipment-management/create',
      method: 'POST',
      operationId: 'createShipment',
      summary: 'Create a new shipment',
      requestSchema: {
        schemaId: 'create-shipment-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'type', 'priority', 'origin', 'destination', 'plannedPickupDate', 'plannedDeliveryDate', 'items', 'createdBy'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['standard', 'express', 'overnight', 'international', 'freight', 'courier'] },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent', 'critical'] },
            origin: { type: 'object' },
            destination: { type: 'object' },
            plannedPickupDate: { type: 'string', format: 'date-time' },
            plannedDeliveryDate: { type: 'string', format: 'date-time' },
            items: { type: 'array', items: { type: 'object' } },
            carrierId: { type: 'string', format: 'uuid' },
            specialInstructions: { type: 'string' },
            createdBy: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'create-shipment-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['logistics-operator', 'warehouse-manager', 'admin'] }],
    },
    {
      path: '/api/shipment-management/update-status',
      method: 'POST',
      operationId: 'updateShipmentStatus',
      summary: 'Update shipment status',
      requestSchema: {
        schemaId: 'update-shipment-status-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'shipmentId', 'newStatus', 'performedBy'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            shipmentId: { type: 'string', format: 'uuid' },
            newStatus: { type: 'string', enum: ['draft', 'pending-pickup', 'picked-up', 'in-transit', 'out-for-delivery', 'delivered', 'failed-delivery', 'returned', 'cancelled'] },
            location: { type: 'object' },
            notes: { type: 'string' },
            performedBy: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'shipment-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['logistics-operator', 'driver', 'admin'] }],
    },
    {
      path: '/api/shipment-management/track',
      method: 'POST',
      operationId: 'trackShipment',
      summary: 'Track a shipment by ID or tracking number',
      requestSchema: {
        schemaId: 'track-shipment-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            shipmentId: { type: 'string', format: 'uuid' },
            shipmentNumber: { type: 'string' },
          },
        },
      },
      responseSchema: {
        schemaId: 'track-shipment-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer' }],
    },
  ],

  // Domain events
  events: [
    {
      eventType: 'ShipmentCreated',
      version: '1.0.0',
      summary: 'Published when a new shipment is created',
      description: 'Triggers downstream workflows: carrier assignment, route optimization, inventory reservation',
      payloadSchema: {
        schemaId: 'shipment-created-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['shipmentId', 'shipmentNumber', 'tenantId', 'type', 'priority', 'origin', 'destination', 'plannedPickupDate', 'plannedDeliveryDate', 'status', 'createdBy', 'createdAt', 'correlationId', 'causationId'],
        },
      },
      publisher: 'shipment-management',
      subscribers: ['route-engine', 'carrier-engine', 'notification-hub', 'billing-engine'],
    },
    {
      eventType: 'ShipmentPickedUp',
      version: '1.0.0',
      summary: 'Published when shipment is picked up',
      description: 'Triggers: route activation, customer notification, inventory deduction',
      payloadSchema: {
        schemaId: 'shipment-picked-up-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object' },
      },
      publisher: 'shipment-management',
      subscribers: ['route-engine', 'notification-hub', 'inventory-engine'],
    },
    {
      eventType: 'ShipmentDelivered',
      version: '1.0.0',
      summary: 'Published when shipment is delivered',
      description: 'Triggers: final billing, delivery confirmation notification, quality metrics update',
      payloadSchema: {
        schemaId: 'shipment-delivered-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object' },
      },
      publisher: 'shipment-management',
      subscribers: ['billing-engine', 'notification-hub', 'analytics-engine'],
    },
    {
      eventType: 'ShipmentCancelled',
      version: '1.0.0',
      summary: 'Published when shipment is cancelled',
      description: 'Triggers: carrier notification, inventory release, refund processing',
      payloadSchema: {
        schemaId: 'shipment-cancelled-payload',
        version: '1.0.0',
        inline: true,
        schema: { type: 'object' },
      },
      publisher: 'shipment-management',
      subscribers: ['carrier-engine', 'billing-engine', 'notification-hub', 'inventory-engine'],
    },
  ],

  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Shipment Management Engine Contract Interface
// ============================================================================

/**
 * Shipment Management Engine Contract
 * 
 * Primary contract for Logistics OS shipment operations.
 * All Product Vertical implementations must go through this contract.
 */
export interface ShipmentManagementContract {
  readonly engineName: string;
  readonly engineVersion: string;

  /**
   * Create a new shipment.
   * 
   * Creates a shipment in DRAFT status.
   * Generates unique shipment tracking number.
   * Publishes ShipmentCreated event.
   * 
   * Idempotent: same requestId returns same result.
   */
  createShipment(request: CreateShipmentRequest): Promise<EngineResponse<CreateShipmentResult>>;

  /**
   * Update shipment status.
   * 
   * Validates state transitions.
   * Records tracking event.
   * Publishes appropriate domain event based on new status.
   * 
   * Idempotent: same requestId returns same result.
   */
  updateShipmentStatus(request: UpdateShipmentStatusRequest): Promise<EngineResponse<Shipment>>;

  /**
   * Assign carrier to shipment.
   * 
   * Validates carrier availability.
   * Publishes CarrierAssigned event.
   */
  assignCarrier(request: AssignCarrierRequest): Promise<EngineResponse<Shipment>>;

  /**
   * Assign route to shipment.
   * 
   * Validates route compatibility.
   * Publishes RouteAssigned event.
   */
  assignRoute(request: AssignRouteRequest): Promise<EngineResponse<Shipment>>;

  /**
   * Record shipment pickup.
   * 
   * Transitions: PENDING_PICKUP → PICKED_UP.
   * Records actual pickup time.
   * Publishes ShipmentPickedUp event.
   */
  recordPickup(request: RecordPickupRequest): Promise<EngineResponse<Shipment>>;

  /**
   * Record shipment delivery.
   * 
   * Transitions: OUT_FOR_DELIVERY → DELIVERED.
   * Records delivery proof (signature, photo).
   * Publishes ShipmentDelivered event.
   */
  recordDelivery(request: RecordDeliveryRequest): Promise<EngineResponse<Shipment>>;

  /**
   * Initiate shipment return.
   * 
   * Creates reverse shipment.
   * Links to original shipment.
   * Publishes ShipmentReturned event.
   */
  initiateReturn(request: InitiateReturnRequest): Promise<EngineResponse<CreateShipmentResult>>;

  /**
   * Cancel shipment.
   * 
   * Can cancel from any non-terminal state.
   * Requires documented reason.
   * Publishes ShipmentCancelled event.
   */
  cancelShipment(request: CancelShipmentRequest): Promise<EngineResponse<Shipment>>;

  /**
   * Get shipment by ID.
   */
  getShipment(request: GetShipmentRequest): Promise<EngineResponse<Shipment>>;

  /**
   * Get shipments by status.
   */
  getShipmentsByStatus(request: GetShipmentsByStatusRequest): Promise<EngineResponse<Shipment[]>>;

  /**
   * Track shipment with full history.
   * 
   * Returns current location, status, and complete tracking history.
   * Public-facing endpoint for customer tracking.
   */
  trackShipment(request: TrackShipmentRequest): Promise<EngineResponse<TrackShipmentResult>>;

  /**
   * Get shipments for a specific carrier.
   */
  getShipmentsByCarrier(request: GetShipmentsByCarrierRequest): Promise<EngineResponse<Shipment[]>>;

  /**
   * Get shipment metrics for analytics.
   */
  getShipmentMetrics(request: GetShipmentMetricsRequest): Promise<EngineResponse<ShipmentMetrics>>;

  /**
   * Health check endpoint for monitoring.
   */
  healthCheck(): Promise<EngineHealthStatus>;
}
