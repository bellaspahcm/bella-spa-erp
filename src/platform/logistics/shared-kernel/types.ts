/**
 * Logistics Platform Shared Kernel - Type Definitions
 * 
 * Common types shared across all Logistics Platform engines.
 * These types provide the foundational domain model for logistics operations.
 * 
 * Architecture Compliance:
 * - Product Vertical: Uses Platform Core + Logistics Kernel
 * - No Core modifications required
 * - Contract-first design
 * - Law 11: Strictly typed, no `any` types allowed
 * 
 * @module platform/logistics/shared-kernel/types
 */

// ============================================================================
// Core Response Types
// ============================================================================

/**
 * Standard engine response wrapper
 * All engines must return this response type for consistent error handling
 */
export interface EngineResponse<T> {
  success: boolean;
  data?: T;
  error?: EngineError;
  metadata?: EngineResponseMetadata;
}

export interface EngineError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface EngineResponseMetadata {
  requestId: string;
  engineVersion: string;
  executionTimeMs: number;
  dataSource?: string;
}

// ============================================================================
// Logistics Domain Types
// ============================================================================

/**
 * Shipment (Aggregate Root for Logistics Domain)
 * Core entity tracking goods movement from origin to destination
 */
export interface Shipment {
  id: string;
  tenantId: string;
  shipmentNumber: string; // Human-readable tracking number
  status: ShipmentStatus;
  type: ShipmentType;
  priority: ShipmentPriority;
  origin: Location;
  destination: Location;
  plannedPickupDate: string; // ISO 8601 datetime
  actualPickupDate?: string;
  plannedDeliveryDate: string;
  actualDeliveryDate?: string;
  carrierId?: string;
  routeId?: string;
  items: ShipmentItem[];
  totalWeight?: Weight;
  totalVolume?: Volume;
  specialInstructions?: string;
  trackingEvents: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

export type ShipmentStatus =
  | 'draft'
  | 'pending-pickup'
  | 'picked-up'
  | 'in-transit'
  | 'out-for-delivery'
  | 'delivered'
  | 'failed-delivery'
  | 'returned'
  | 'cancelled';

export type ShipmentType =
  | 'standard'
  | 'express'
  | 'overnight'
  | 'international'
  | 'freight'
  | 'courier';

export type ShipmentPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent'
  | 'critical';

export interface ShipmentItem {
  id: string;
  sku?: string;
  description: string;
  quantity: number;
  weight?: Weight;
  dimensions?: Dimensions;
  value?: Money;
  hazardous: boolean;
  requiresRefrigeration: boolean;
  fragile: boolean;
  metadata?: Record<string, unknown>;
}

export interface Weight {
  value: number;
  unit: 'kg' | 'lb' | 'g' | 'oz' | 't';
}

export interface Volume {
  value: number;
  unit: 'm3' | 'ft3' | 'l' | 'gal';
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'm' | 'in' | 'ft';
}

export interface Money {
  amount: number;
  currency: string; // ISO 4217 currency code
}

/**
 * Location (Geographic point for shipment origin/destination)
 */
export interface Location {
  type: LocationType;
  name?: string;
  address: Address;
  coordinates?: GeoCoordinates;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: OperatingHours;
  specialInstructions?: string;
}

export type LocationType =
  | 'warehouse'
  | 'distribution-center'
  | 'store'
  | 'customer'
  | 'port'
  | 'airport'
  | 'pickup-point';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
}

export interface OperatingHours {
  monday?: TimeRange;
  tuesday?: TimeRange;
  wednesday?: TimeRange;
  thursday?: TimeRange;
  friday?: TimeRange;
  saturday?: TimeRange;
  sunday?: TimeRange;
}

export interface TimeRange {
  open: string; // HH:mm format
  close: string; // HH:mm format
}

/**
 * TrackingEvent (Audit trail for shipment status changes)
 */
export interface TrackingEvent {
  id: string;
  shipmentId: string;
  eventType: TrackingEventType;
  status: ShipmentStatus;
  timestamp: string; // ISO 8601 datetime
  location?: Location;
  description: string;
  performedBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type TrackingEventType =
  | 'created'
  | 'pickup-scheduled'
  | 'picked-up'
  | 'departed-origin'
  | 'in-transit'
  | 'arrived-hub'
  | 'departed-hub'
  | 'out-for-delivery'
  | 'delivery-attempted'
  | 'delivered'
  | 'delivery-failed'
  | 'returned-to-sender'
  | 'cancelled'
  | 'exception';

/**
 * Route (Optimized path for shipment delivery)
 */
export interface Route {
  id: string;
  tenantId: string;
  routeNumber: string;
  status: RouteStatus;
  vehicleId?: string;
  driverId?: string;
  plannedDepartureTime: string;
  actualDepartureTime?: string;
  plannedArrivalTime: string;
  actualArrivalTime?: string;
  waypoints: Waypoint[];
  shipments: string[]; // Shipment IDs
  totalDistance?: Distance;
  estimatedDuration?: number; // minutes
  actualDuration?: number;
  createdAt: string;
  updatedAt: string;
}

export type RouteStatus =
  | 'planned'
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

export interface Waypoint {
  sequence: number;
  location: Location;
  type: WaypointType;
  plannedArrival: string;
  actualArrival?: string;
  shipmentIds: string[];
  action: 'pickup' | 'delivery' | 'stopover';
  completed: boolean;
  notes?: string;
}

export type WaypointType =
  | 'origin'
  | 'pickup'
  | 'delivery'
  | 'hub'
  | 'destination';

export interface Distance {
  value: number;
  unit: 'km' | 'mi' | 'm' | 'ft';
}

/**
 * Warehouse (Storage facility for inventory)
 */
export interface Warehouse {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: WarehouseType;
  status: WarehouseStatus;
  location: Location;
  capacity: WarehouseCapacity;
  currentUtilization: WarehouseUtilization;
  zones: WarehouseZone[];
  managerId?: string;
  operatingHours?: OperatingHours;
  features: WarehouseFeature[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type WarehouseType =
  | 'distribution-center'
  | 'fulfillment-center'
  | 'cross-dock'
  | 'cold-storage'
  | 'bonded-warehouse'
  | 'third-party-logistics';

export type WarehouseStatus =
  | 'operational'
  | 'maintenance'
  | 'closed'
  | 'temporary-closure';

export interface WarehouseCapacity {
  totalArea: number; // square meters
  storageVolume: number; // cubic meters
  palletPositions?: number;
  temperatureZones?: TemperatureZone[];
}

export interface WarehouseUtilization {
  usedArea: number;
  usedVolume: number;
  usedPalletPositions?: number;
  utilizationPercentage: number;
}

export interface WarehouseZone {
  id: string;
  code: string;
  name: string;
  type: ZoneType;
  capacity: number;
  currentOccupancy: number;
  temperatureControlled: boolean;
  temperatureRange?: TemperatureRange;
}

export type ZoneType =
  | 'receiving'
  | 'storage'
  | 'picking'
  | 'packing'
  | 'shipping'
  | 'returns'
  | 'quarantine'
  | 'hazardous';

export type TemperatureZone =
  | 'ambient'
  | 'chilled'
  | 'frozen'
  | 'deep-frozen';

export interface TemperatureRange {
  min: number; // Celsius
  max: number;
  unit: 'celsius' | 'fahrenheit';
}

export type WarehouseFeature =
  | 'temperature-controlled'
  | 'hazmat-certified'
  | 'security-24-7'
  | 'automated-systems'
  | 'dock-doors'
  | 'rail-access'
  | 'customs-clearance';

/**
 * Carrier (Third-party logistics provider)
 */
export interface Carrier {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: CarrierType;
  status: CarrierStatus;
  serviceLevel: ServiceLevel[];
  coverage: GeographicCoverage[];
  contact: CarrierContact;
  credentials?: CarrierCredentials;
  performanceMetrics?: CarrierPerformance;
  createdAt: string;
  updatedAt: string;
}

export type CarrierType =
  | 'express-courier'
  | 'freight'
  | 'air-freight'
  | 'ocean-freight'
  | 'rail'
  | 'last-mile'
  | 'third-party-logistics';

export type CarrierStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'under-review';

export interface ServiceLevel {
  code: string;
  name: string;
  type: ShipmentType;
  transitTime: TransitTime;
  trackingAvailable: boolean;
  signatureRequired: boolean;
  insuranceIncluded: boolean;
  maxWeight?: Weight;
  maxDimensions?: Dimensions;
}

export interface TransitTime {
  min: number; // business days
  max: number;
  guaranteed: boolean;
}

export interface GeographicCoverage {
  countryCode: string;
  regions?: string[];
  postalCodePattern?: string;
  deliveryType: 'domestic' | 'international';
}

export interface CarrierContact {
  phone: string;
  email: string;
  website?: string;
  supportPhone?: string;
  supportEmail?: string;
  emergencyPhone?: string;
}

export interface CarrierCredentials {
  apiKey?: string;
  accountNumber?: string;
  billingCode?: string;
  integrationEndpoint?: string;
  lastVerified?: string;
}

export interface CarrierPerformance {
  onTimeDeliveryRate: number; // percentage
  damageRate: number;
  lostShipmentRate: number;
  averageTransitTime: number; // days
  customerSatisfactionScore?: number;
  lastUpdated: string;
}

// ============================================================================
// Engine Contract Base
// ============================================================================

/**
 * Base interface for all Logistics Platform engine contracts
 * All engines must implement this interface
 */
export interface EngineContract {
  readonly engineName: string;
  readonly engineVersion: string;
  readonly contractVersion: string;

  /**
   * Health check endpoint for monitoring
   */
  healthCheck(): Promise<EngineHealthStatus>;
}

export interface EngineHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database?: 'ok' | 'error';
    eventBus?: 'ok' | 'error';
    dependencies?: Record<string, 'ok' | 'error'>;
  };
  message?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base interface for all Logistics Platform domain events
 */
export interface DomainEvent<T = Record<string, unknown>> {
  eventType: string;
  eventVersion: string;
  eventId: string;
  timestamp: string;
  tenantId: string;
  aggregateId: string; // Shipment ID (aggregate root)
  aggregateType: 'shipment';
  payload: T;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  causationId?: string;
  source: string; // Engine name
}

// ============================================================================
// Query & Filter Types
// ============================================================================

export interface ShipmentQuery {
  tenantId: string;
  status?: ShipmentStatus[];
  type?: ShipmentType[];
  carrierId?: string;
  originCountry?: string;
  destinationCountry?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface RouteQuery {
  tenantId: string;
  status?: RouteStatus[];
  vehicleId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface WarehouseQuery {
  tenantId: string;
  status?: WarehouseStatus[];
  type?: WarehouseType[];
  country?: string;
  minCapacity?: number;
  features?: WarehouseFeature[];
}
