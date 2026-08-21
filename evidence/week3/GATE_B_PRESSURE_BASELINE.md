# GATE B — PRESSURE BASELINE (REQUIREMENT → ABSTRACTION MAP)

**Date:** 2026-08-21  
**Gate:** B - Route Management Under Pressure  
**Status:** ✅ LOCKED (Implementation Baseline Established)

---

## 🎯 OBJECTIVE

Establish formal abstraction ownership mapping BEFORE implementation.  
Document expected architectural layer for each requirement.

**Purpose:** Enable pressure detection by comparing actual implementation vs baseline expectations.

---

## 📊 ABSTRACTION OWNERSHIP MAP

### Requirement → Layer Mapping

| Req | Requirement | Core | Kernel | Contract | Engine | Extension | Pressure Expected |
|-----|-------------|------|--------|----------|--------|-----------|-------------------|
| R1 | Create Route | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO |
| R2 | Assign Shipments | ❌ | ✅ Type | ✅ Existing | ✅ New | ❌ | 🟢 NO (via Shipment Contract) |
| R3 | Validate Capacity | ❌ | ✅ Type | ❌ | ✅ New | ❌ | 🟢 NO |
| R4 | Calculate Distance | ❌ | ❌ | ❌ | ✅ New | ✅ New | 🟢 NO (Extension utility) |
| R5 | Optimize Sequence | ❌ | ❌ | ❌ | ✅ New | ❌ | 🟢 NO |
| R6 | Start Route | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO |
| R7 | Complete Waypoint | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO (event-driven) |
| R8 | Complete Route | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO |
| R9 | Cancel Route | ❌ | ❌ | ✅ New | ✅ New | ❌ | 🟢 NO (boundary coordination) |
| R10 | Reassign Shipment | ❌ | ❌ | ✅ Existing | ✅ New | ❌ | 🟢 NO |
| R11 | Get Route by ID | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO |
| R12 | Get by Status | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO |
| R13 | Get by Driver | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO |
| R14 | Metrics | ❌ | ✅ Type | ✅ New | ✅ New | ❌ | 🟢 NO |
| R15 | Validate Time Windows | ❌ | ✅ Type | ❌ | ✅ New | ❌ | 🟢 NO |
| R16 | Failed Delivery | ❌ | ❌ | ✅ New | ✅ New | ❌ | 🟢 NO (event-driven) |
| R17 | Idempotency | ❌ | ❌ | ❌ | ✅ New | ❌ | 🟢 NO (established pattern) |

**Summary:**
- **Core involvement:** 0/17 requirements
- **Kernel (types only):** 11/17 (Route, Waypoint, RouteStatus already exist)
- **Contract (new):** 15/17 (Route Management Contract to be created)
- **Engine (new):** 17/17 (Route Engine to be created)
- **Extension (new):** 1/17 (Geographic utilities)

---

## 🔍 DETAILED ABSTRACTION ANALYSIS

### Layer 1: Platform Core

**Expected Involvement:** ZERO

**Justification:**
- Route Management is domain-specific Logistics concern
- Core provides: Tenant isolation, Event bus, Audit, Temporal, CDS, Governance
- None of Route's requirements touch Core abstractions
- All complexity absorbed at Logistics boundary

**Baseline:** Core modifications = 0

---

### Layer 2: Logistics Kernel (Types)

**Expected Involvement:** Types ONLY (no new types needed)

**Existing Types Used:**
```typescript
// Already defined in src/platform/logistics/shared-kernel/types.ts
interface Route {
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
  shipments: string[];
  totalDistance?: Distance;
  estimatedDuration?: number;
  actualDuration?: number;
  createdAt: string;
  updatedAt: string;
}

interface Waypoint {
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

type RouteStatus = 'planned' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
```

**Assessment:**
- Route type: ✅ COMPLETE (all fields needed for R1-R17)
- Waypoint type: ✅ COMPLETE
- RouteStatus: ✅ COMPLETE
- Location, Distance: ✅ Already exist

**Baseline:** 0 new Kernel types needed

---

### Layer 3: Route Management Contract (NEW)

**Expected Scope:** ~300 LOC

**Contract Methods Required:**

```typescript
interface RouteManagementContract {
  // R1: Create Route
  createRoute(request: CreateRouteRequest): Promise<EngineResponse<Route>>;
  
  // R2: Assign Shipments
  assignShipments(request: AssignShipmentsRequest): Promise<EngineResponse<Route>>;
  
  // R3: Validate Capacity
  validateCapacity(request: ValidateCapacityRequest): Promise<EngineResponse<CapacityValidationResult>>;
  
  // R4: Calculate Distance (internal utility, not exposed in contract)
  
  // R5: Optimize Sequence
  optimizeRoute(request: OptimizeRouteRequest): Promise<EngineResponse<Route>>;
  
  // R6: Start Route
  startRoute(request: StartRouteRequest): Promise<EngineResponse<Route>>;
  
  // R7: Complete Waypoint
  completeWaypoint(request: CompleteWaypointRequest): Promise<EngineResponse<Route>>;
  
  // R8: Complete Route
  completeRoute(request: CompleteRouteRequest): Promise<EngineResponse<Route>>;
  
  // R9: Cancel Route
  cancelRoute(request: CancelRouteRequest): Promise<EngineResponse<Route>>;
  
  // R10: Reassign Shipment
  reassignShipment(request: ReassignShipmentRequest): Promise<EngineResponse<Route>>;
  
  // R11: Get Route
  getRoute(request: GetRouteRequest): Promise<EngineResponse<Route>>;
  
  // R12: Get by Status
  getRoutesByStatus(request: GetRoutesByStatusRequest): Promise<EngineResponse<Route[]>>;
  
  // R13: Get by Driver
  getRoutesByDriver(request: GetRoutesByDriverRequest): Promise<EngineResponse<Route[]>>;
  
  // R14: Metrics
  getRouteMetrics(request: GetRouteMetricsRequest): Promise<EngineResponse<RouteMetrics>>;
  
  // R15: Validate Time Windows (internal, called during createRoute)
  
  // R16: Handle Failed Delivery
  recordDeliveryFailure(request: RecordDeliveryFailureRequest): Promise<EngineResponse<Route>>;
  
  // R17: Idempotency handled via requestId in all requests
  
  // Health check
  healthCheck(): Promise<EngineHealthStatus>;
}
```

**Request/Response Types:** ~20 interfaces

**Domain Events:** ~8 event types

**Contract Metadata:** ContractMetadata registration

**Baseline:** 1 new contract file, ~300 LOC

---

### Layer 4: Route Engine (NEW)

**Expected Scope:** ~600 LOC

**Implementation Components:**

1. **Database Operations (~200 LOC)**
   - Route CRUD
   - Waypoint CRUD
   - Idempotency key tracking
   - Transaction management

2. **Business Logic (~250 LOC)**
   - Capacity validation
   - Distance calculation (calls Extension)
   - Route optimization (simple nearest-neighbor)
   - Time window validation
   - Status transitions
   - State machine logic

3. **Event Publishing (~50 LOC)**
   - RouteCreated
   - RouteStarted
   - WaypointCompleted
   - RouteCompleted
   - RouteCancelled
   - DeliveryFailed
   - ShipmentReassigned

4. **Cross-Engine Integration (~100 LOC)**
   - Call Shipment Contract for assignment
   - Coordinate state updates
   - Handle cross-entity transactions

**Baseline:** 1 new engine file, ~600 LOC

---

### Layer 5: Extension (Geographic Utilities)

**Expected Scope:** ~50 LOC

**Utility Functions:**

```typescript
// src/platform/logistics/extensions/geo-utils.ts

/**
 * Calculate distance between two geographic points using Haversine formula
 */
function calculateDistance(
  point1: GeoCoordinates,
  point2: GeoCoordinates
): Distance;

/**
 * Calculate total route distance for waypoints
 */
function calculateRouteDistance(
  waypoints: Waypoint[]
): Distance;

/**
 * Estimate travel duration based on distance and average speed
 */
function estimateDuration(
  distance: Distance,
  averageSpeed: number // km/h
): number; // minutes
```

**Baseline:** 1 new extension file, ~50 LOC

---

## 🎯 CROSS-ENTITY INTEGRATION PATTERNS

### Pattern 1: Route → Shipment Assignment (R2)

**Scenario:** Assign shipments to route

**Integration:**
```
Route Engine → Shipment Contract.assignRoute()
```

**Boundary:** Route Engine calls existing Shipment Contract method

**Pressure:** 🟢 NO (Shipment Contract already provides `assignRoute()`)

---

### Pattern 2: Waypoint Completion → Shipment Status Update (R7)

**Scenario:** Completing pickup waypoint should update shipment to 'picked-up'

**Integration:**
```
Route Engine → Event Bus → Shipment Engine
```

**Flow:**
1. Route Engine marks waypoint completed
2. Route Engine publishes `WaypointCompleted` event
3. Shipment Engine subscribes to event
4. Shipment Engine updates shipment status

**Boundary:** Event-driven, loose coupling

**Pressure:** 🟢 NO (standard event pattern)

---

### Pattern 3: Route Cancellation → Bulk Shipment Update (R9)

**Scenario:** Cancelling route must unassign all shipments

**Integration:**
```
Route Engine → (loop) → Shipment Contract.assignRoute(null)
```

**Flow:**
1. Route Engine begins transaction
2. Route status → 'cancelled'
3. For each shipment: call Shipment Contract.assignRoute({ routeId: null })
4. Commit transaction
5. Publish RouteCancelled event

**Boundary:** Coordinated calls through Contract boundary

**Pressure:** 🟢 NO (boundary coordination pattern)

---

### Pattern 4: Failed Delivery → Shipment Status Update (R16)

**Scenario:** Delivery failure at waypoint affects shipment

**Integration:**
```
Route Engine → Event Bus → Shipment Engine
```

**Flow:**
1. Route Engine records waypoint failure
2. Route Engine publishes `DeliveryFailed` event
3. Shipment Engine updates status to 'failed-delivery'

**Boundary:** Event-driven

**Pressure:** 🟢 NO (standard event pattern)

---

## 📊 PRESSURE DETECTION CRITERIA

### What Constitutes "Core Pressure"?

A requirement creates Core pressure if:

1. **Core Modification Required:**
   - Adding field to Core entity (e.g., Tenant, User)
   - Modifying Core service behavior
   - Adding Core abstraction

2. **Core Abstraction Insufficient:**
   - Existing Core capability cannot support requirement
   - Workaround creates architectural smell
   - Technical debt accumulates

3. **Boundary Solution Inadequate:**
   - Cannot implement via Contract/Engine/Extension
   - Violates encapsulation
   - Creates coupling between verticals

### What Does NOT Constitute Pressure?

1. **Adding Logistics-specific types** → Kernel, not Core
2. **Creating new Contract** → Expected for new domain
3. **Implementing Engine logic** → Domain behavior, not platform concern
4. **Using Extension utilities** → Designed for domain-specific code
5. **Event-driven integration** → Standard pattern
6. **Calling existing Contracts** → Boundary coordination

---

## 🎯 BASELINE LOCKED

### Expected Implementation Footprint

| Layer | New Files | Expected LOC | Modifications to Existing |
|-------|-----------|--------------|---------------------------|
| **Core** | 0 | 0 | 0 |
| **Kernel** | 0 | 0 | 0 (types already exist) |
| **Contract** | 1 | ~300 | 0 |
| **Engine** | 1 | ~600 | 0 |
| **Extension** | 1 | ~50 | 0 |
| **Tests** | 2 | ~400 | 0 |
| **Migration** | 0 | 0 | 0 (route tables already exist) |

**Total New Code:** ~1,350 LOC  
**Core Modifications:** 0

### Expected Pressure Events

**Baseline:** 0 pressure events

**Rationale:** All 17 requirements have confirmed boundary solutions

**If Pressure Emerges:**
- Must be genuine architectural insufficiency
- Must document via Pressure Event template
- Must attempt all boundary alternatives first
- Must provide evidence of why Core modification necessary

---

## ✅ BASELINE VERIFICATION

**Pre-Implementation Checklist:**

- [x] All 17 requirements mapped to abstraction layers
- [x] No Core involvement required
- [x] Kernel types confirmed complete (no new types needed)
- [x] Contract scope defined (~300 LOC)
- [x] Engine scope defined (~600 LOC)
- [x] Extension scope defined (~50 LOC)
- [x] Cross-entity integration patterns documented
- [x] Pressure detection criteria established
- [x] Expected LOC footprint calculated
- [x] Baseline locked for evidence comparison

---

## 🚦 AUTHORIZATION

**Pressure Baseline:** ✅ ESTABLISHED  
**Expected Core Modifications:** 0  
**Expected Pressure Events:** 0  
**Implementation Authorization:** ✅ GRANTED

**Measurement Protocol:**
- During implementation, compare actual vs baseline
- Any deviation from baseline → investigate
- If Core modification attempted → create Pressure Event
- Let evidence determine actual outcome

**Next Step:** B3 - Implement Route Contract

---

**Document Owner:** Kiro AI  
**Gate:** B  
**Status:** LOCKED  
**Date:** 2026-08-21

---

**END OF PRESSURE BASELINE**
