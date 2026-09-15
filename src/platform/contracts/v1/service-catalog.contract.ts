/**
 * Service Catalog Contract v1.0
 *
 * **Purpose:** Platform contract for service catalog management across verticals (Beauty, Healthcare, Auto, Education)
 *
 * **Ownership:** Platform Contracts Layer (NOT vertical-specific)
 *
 * **Bounded Context:** Service Catalog
 * - What services does the business offer? (name, price, duration, category)
 * - Service variants (Basic, Premium, Deluxe)
 * - Service packages (bundles)
 * - Service availability (branches, staff skills, resources)
 * - Service lifecycle (active, archived, visible)
 *
 * **NOT Service Inventory:**
 * - Does NOT own inventory items (physical goods)
 * - Does NOT own stock quantity, warehouse, location
 * - Does NOT own stock movements (IN, OUT, TRANSFER)
 * - Does NOT own consumption deduction, reorder logic
 * - product_usage (service → consumables mapping) is inventory-related metadata, NOT catalog capability
 *
 * **Extraction Source:** Bella Spa packages table (catalog fields only)
 *
 * **Semantic Scope:** Service definitions, pricing, availability, lifecycle
 * **Deferred:** Service inventory, product usage tracking, stock management
 *
 * **Architecture Decision Records:**
 * - ADR-005: E7 Logistics reuse rejected (Service ≠ InventoryItem semantics)
 * - ADR-006: Platform Contracts layer (temporal + catalog capabilities)
 *
 * **Consumer Fit:**
 * - Bella Spa: Service catalog (haircut, facial, massage packages)
 * - Bella Haircut: Service catalog (haircut, styling, coloring packages)
 * - Bella Nail: Service catalog (manicure, pedicure, nail art packages)
 * - Healthcare: Treatment catalog (consultation, therapy, procedure packages)
 * - Auto: Service catalog (maintenance, repair, inspection packages)
 * - Education: Course catalog (courses, programs, certifications)
 *
 * **Version:** 1.0.0
 * **Date:** 2026-09-15
 * **Status:** Platform Contract (cross-vertical)
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — SERVICE CATALOG DOMAIN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Service Entity — Core service definition
 *
 * **Scope:** Service catalog metadata (name, price, duration, category, availability)
 * **Excludes:** product_usage (inventory-related metadata, not catalog capability)
 */
export interface Service {
  // Identity
  id: string;
  tenant_id: string;
  service_code?: string; // Optional code for integration/invoicing
  name: string;
  description: string | null;

  // Classification
  module_key: string; // Business vertical (beauty_spa, haircut, nail, healthcare, auto, education)
  service_kind: string; // Service type (single, package, subscription)
  service_category: string | null; // Category (facial, haircut, consultation, etc.)

  // Pricing
  price: number | null; // Current selling price
  full_price: number; // Base/original price (before discount)
  price_floor: number | null; // Minimum allowed price (franchise constraint)
  price_cap: number | null; // Maximum allowed price (franchise constraint)

  // Duration
  duration: string | null; // Human-readable duration ("90 phút/buổi")
  default_duration_minutes: number; // Machine-readable duration (minutes)
  estimated_duration: number | null; // Estimated actual duration (may differ from default)

  // Package/Bundle specific
  total_sessions: number; // Number of sessions in package (1 for single service)
  session_multiplier: number | null; // Session count multiplier for flexible packages

  // Availability & Requirements
  requires_resource: boolean; // Requires physical resource (room, bed, equipment)
  default_resource_type: string | null; // Resource type if required
  required_workers: number | null; // Number of staff required to perform service

  // Beauty-specific
  before_after_required: boolean; // Requires before/after photos (beauty treatments)
  care_note_template: string | null; // Template for care notes/instructions

  // Staff Compensation
  ktv_commission: number | null; // Staff commission amount

  // Content
  details: string[] | null; // Service details/features (bulleted list)
  offer: string | null; // Promotional offer text

  // Franchise/Template
  is_hq_template: boolean | null; // Is this a headquarters template?
  template_id: string | null; // Template this service is based on
  allowed_franchise_override: boolean | null; // Can franchises override pricing?

  // Lifecycle
  status: string | null; // active, inactive, archived
  metadata: Record<string, unknown> | null; // Extensible metadata

  // Audit
  created_at: string;
  updated_at: string | null;
}

/**
 * Service Variant — Service variations (Basic, Premium, Deluxe)
 *
 * **Example:** Haircut Basic ($20, 30min), Haircut Premium ($35, 45min), Haircut Deluxe ($50, 60min)
 */
export interface ServiceVariant {
  id: string;
  service_id: string; // Parent service
  tenant_id: string;
  variant_name: string; // Basic, Premium, Deluxe, etc.
  price: number;
  duration_minutes: number;
  description: string | null;
  is_active: boolean;
  sort_order: number; // Display order
  created_at: string;
  updated_at: string | null;
}

/**
 * Service Package — Bundle of multiple services
 *
 * **Example:** "Spa Day Package" = Massage + Facial + Manicure
 */
export interface ServicePackage {
  id: string;
  tenant_id: string;
  package_name: string;
  package_description: string | null;
  included_service_ids: string[]; // List of service IDs in bundle
  bundle_price: number; // Package price (usually discounted)
  individual_price_sum: number; // Sum of individual service prices
  discount_amount: number; // bundle_price - individual_price_sum
  discount_percentage: number; // (discount_amount / individual_price_sum) * 100
  total_duration_minutes: number; // Sum of all service durations
  is_active: boolean;
  valid_from: string | null; // Package validity period
  valid_to: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Service Availability — Which branches offer which services
 */
export interface ServiceBranchAvailability {
  service_id: string;
  branch_id: string;
  tenant_id: string;
  is_available: boolean;
  unavailable_reason: string | null; // Why service is unavailable at this branch
  created_at: string;
  updated_at: string | null;
}

/**
 * Service Staff Requirement — Which staff skills are required for service
 */
export interface ServiceStaffRequirement {
  service_id: string;
  required_skill: string; // Skill code/name (haircut_basic, facial_advanced, etc.)
  tenant_id: string;
  proficiency_level: string | null; // beginner, intermediate, advanced, expert
  is_mandatory: boolean; // Must have this skill vs nice to have
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT/OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateServiceInput {
  tenant_id: string;
  name: string;
  description?: string | null;
  module_key: string;
  service_kind: string;
  service_category?: string | null;
  price?: number | null;
  full_price: number;
  price_floor?: number | null;
  price_cap?: number | null;
  duration?: string | null;
  default_duration_minutes: number;
  estimated_duration?: number | null;
  total_sessions?: number;
  session_multiplier?: number | null;
  requires_resource?: boolean;
  default_resource_type?: string | null;
  required_workers?: number | null;
  before_after_required?: boolean;
  care_note_template?: string | null;
  ktv_commission?: number | null;
  details?: string[] | null;
  offer?: string | null;
  is_hq_template?: boolean | null;
  template_id?: string | null;
  allowed_franchise_override?: boolean | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateServiceInput {
  service_id: string;
  tenant_id: string;
  name?: string;
  description?: string | null;
  service_kind?: string;
  service_category?: string | null;
  price?: number | null;
  full_price?: number;
  price_floor?: number | null;
  price_cap?: number | null;
  duration?: string | null;
  default_duration_minutes?: number;
  estimated_duration?: number | null;
  total_sessions?: number;
  session_multiplier?: number | null;
  requires_resource?: boolean;
  default_resource_type?: string | null;
  required_workers?: number | null;
  before_after_required?: boolean;
  care_note_template?: string | null;
  ktv_commission?: number | null;
  details?: string[] | null;
  offer?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateServiceOutput {
  success: boolean;
  service: Service;
  error?: string;
}

export interface UpdateServiceOutput {
  success: boolean;
  service: Service;
  error?: string;
}

export interface ServiceListFilters {
  tenant_id: string;
  module_key?: string;
  service_kind?: string;
  service_category?: string;
  status?: string;
  is_active?: boolean;
  branch_id?: string; // Filter by availability at branch
  min_price?: number;
  max_price?: number;
  search_query?: string; // Search by name/description
  page?: number;
  page_size?: number;
}

export interface ServiceListResponse {
  services: Service[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface CreateServiceVariantInput {
  service_id: string;
  tenant_id: string;
  variant_name: string;
  price: number;
  duration_minutes: number;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateServicePackageInput {
  tenant_id: string;
  package_name: string;
  package_description?: string | null;
  included_service_ids: string[];
  bundle_price: number;
  valid_from?: string | null;
  valid_to?: string | null;
}

export interface SetServiceBranchAvailabilityInput {
  service_id: string;
  branch_id: string;
  tenant_id: string;
  is_available: boolean;
  unavailable_reason?: string | null;
}

export interface SetServiceStaffRequirementInput {
  service_id: string;
  tenant_id: string;
  required_skill: string;
  proficiency_level?: string | null;
  is_mandatory?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * IServiceCatalog — Platform contract for service catalog management
 *
 * **Capabilities:**
 * 1. Service CRUD operations
 * 2. Service variants management
 * 3. Service packages (bundles)
 * 4. Service availability by branch
 * 5. Service staff requirements
 * 6. Service lifecycle management
 * 7. Service search and filtering
 *
 * **Bounded Context:** Service Catalog (NOT Service Inventory)
 * **Semantic Scope:** Service definitions, pricing, availability, lifecycle
 * **Excluded:** Inventory management, stock tracking, product usage, consumption deduction
 */
export interface IServiceCatalog {
  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get service by ID
   *
   * **Tenant Isolation:** Returns null if service doesn't belong to tenant
   */
  getService(
    serviceId: string,
    tenantId: string,
  ): Promise<Service | null>;

  /**
   * List services with filters
   *
   * **Tenant Isolation:** Only returns services belonging to tenant
   * **Pagination:** Supports page/page_size for large catalogs
   */
  listServices(
    filters: ServiceListFilters,
  ): Promise<ServiceListResponse>;

  /**
   * Create new service
   *
   * **Validation:**
   * - Tenant module scope (service must belong to enabled vertical)
   * - Price constraints (price_floor <= price <= price_cap if set)
   * - Duration validation (default_duration_minutes > 0)
   *
   * **Audit:** Records service creation in audit log
   */
  createService(
    input: CreateServiceInput,
  ): Promise<CreateServiceOutput>;

  /**
   * Update existing service
   *
   * **Validation:**
   * - Tenant ownership (cannot modify other tenant's services)
   * - Module scope (cannot change to disabled vertical)
   * - Price constraints
   *
   * **Audit:** Records old/new values in audit log
   */
  updateService(
    input: UpdateServiceInput,
  ): Promise<UpdateServiceOutput>;

  /**
   * Delete service
   *
   * **Constraints:**
   * - Cannot delete if service has active bookings/appointments
   * - Soft delete (status = 'archived') recommended over hard delete
   *
   * **Audit:** Records deletion with service snapshot
   */
  deleteService(
    serviceId: string,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE VARIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get service variants
   *
   * **Example:** Haircut service → [Basic, Premium, Deluxe] variants
   */
  getServiceVariants(
    serviceId: string,
    tenantId: string,
  ): Promise<ServiceVariant[]>;

  /**
   * Create service variant
   *
   * **Validation:**
   * - Parent service must exist and belong to tenant
   * - variant_name must be unique within service
   * - price > 0, duration_minutes > 0
   */
  createServiceVariant(
    input: CreateServiceVariantInput,
  ): Promise<{ success: boolean; variant: ServiceVariant; error?: string }>;

  /**
   * Update service variant
   */
  updateServiceVariant(
    variantId: string,
    tenantId: string,
    updates: Partial<Omit<ServiceVariant, 'id' | 'service_id' | 'tenant_id' | 'created_at'>>,
  ): Promise<{ success: boolean; variant: ServiceVariant; error?: string }>;

  /**
   * Delete service variant
   */
  deleteServiceVariant(
    variantId: string,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE PACKAGES (BUNDLES)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get service packages for tenant
   *
   * **Example:** "Spa Day Package" = Massage + Facial + Manicure (discounted bundle)
   */
  getServicePackages(
    tenantId: string,
    filters?: { is_active?: boolean; valid_on_date?: string },
  ): Promise<ServicePackage[]>;

  /**
   * Create service package (bundle)
   *
   * **Validation:**
   * - All included_service_ids must exist and belong to tenant
   * - bundle_price > 0
   * - Calculates discount automatically (individual_price_sum - bundle_price)
   *
   * **Business Rule:** Bundle price is usually less than sum of individual prices (discount)
   */
  createServicePackage(
    input: CreateServicePackageInput,
  ): Promise<{ success: boolean; package: ServicePackage; error?: string }>;

  /**
   * Update service package
   */
  updateServicePackage(
    packageId: string,
    tenantId: string,
    updates: Partial<Omit<ServicePackage, 'id' | 'tenant_id' | 'created_at'>>,
  ): Promise<{ success: boolean; package: ServicePackage; error?: string }>;

  /**
   * Delete service package
   */
  deleteServicePackage(
    packageId: string,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get services available at branch
   *
   * **Use Case:** Show only services available at customer's selected branch
   */
  getServicesByBranch(
    branchId: string,
    tenantId: string,
    filters?: { service_kind?: string; service_category?: string },
  ): Promise<Service[]>;

  /**
   * Set service availability at branch
   *
   * **Use Case:**
   * - Branch doesn't have equipment for certain services
   * - Branch staff don't have skills for certain services
   * - Temporary unavailability (maintenance, staff shortage)
   */
  setServiceBranchAvailability(
    input: SetServiceBranchAvailabilityInput,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Get service availability status across all branches
   */
  getServiceAvailabilityByBranches(
    serviceId: string,
    tenantId: string,
  ): Promise<ServiceBranchAvailability[]>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE STAFF REQUIREMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set service staff skill requirements
   *
   * **Use Case:** Define which staff skills are required to perform service
   * **Example:** "Advanced Facial" requires "facial_advanced" skill + "expert" proficiency
   */
  setServiceStaffRequirement(
    input: SetServiceStaffRequirementInput,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Get service staff requirements
   */
  getServiceStaffRequirements(
    serviceId: string,
    tenantId: string,
  ): Promise<ServiceStaffRequirement[]>;

  /**
   * Get eligible staff for service
   *
   * **Use Case:** Find staff who have required skills to perform service
   * **Returns:** List of staff IDs who meet service skill requirements
   */
  getEligibleStaffForService(
    serviceId: string,
    branchId: string,
    tenantId: string,
  ): Promise<string[]>; // staff IDs

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Activate service (make available for booking)
   */
  activateService(
    serviceId: string,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Deactivate service (temporarily unavailable, don't show in catalog)
   */
  deactivateService(
    serviceId: string,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Archive service (permanently retired, keep for historical records)
   */
  archiveService(
    serviceId: string,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Search services by name/description
   *
   * **Use Case:** Customer search bar, admin service lookup
   * **Search:** Full-text search on name + description
   */
  searchServices(
    tenantId: string,
    query: string,
    filters?: {
      module_key?: string;
      service_category?: string;
      min_price?: number;
      max_price?: number;
      branch_id?: string;
    },
  ): Promise<Service[]>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Service Catalog Invariants (Business Rules)
 *
 * **I1. Tenant Isolation:**
 * - All operations MUST enforce tenant_id isolation
 * - Service cannot be accessed/modified by different tenant
 *
 * **I2. Module Scope:**
 * - Service module_key MUST be in tenant's enabled_modules
 * - Cannot create service for disabled vertical
 *
 * **I3. Price Constraints:**
 * - price >= 0 (free services allowed)
 * - full_price > 0 (base price must be positive)
 * - IF price_floor set: price >= price_floor
 * - IF price_cap set: price <= price_cap
 * - price_floor <= price_cap (if both set)
 *
 * **I4. Duration Constraints:**
 * - default_duration_minutes > 0
 * - estimated_duration >= 0 (0 = instant service)
 *
 * **I5. Package Constraints:**
 * - total_sessions >= 1 (minimum one session)
 * - session_multiplier >= 1 (if set)
 *
 * **I6. Service Lifecycle:**
 * - status IN ('active', 'inactive', 'archived')
 * - Active service can be booked
 * - Inactive service hidden from catalog but not deleted
 * - Archived service retained for history only
 *
 * **I7. Service Variants:**
 * - variant_name UNIQUE within (service_id, tenant_id)
 * - Variant price > 0, duration_minutes > 0
 *
 * **I8. Service Packages:**
 * - All included_service_ids MUST exist and belong to same tenant
 * - bundle_price > 0
 * - individual_price_sum = SUM(service.price for service in included_service_ids)
 * - discount_amount = individual_price_sum - bundle_price
 * - discount_percentage = (discount_amount / individual_price_sum) * 100
 *
 * **I9. Branch Availability:**
 * - Service can be unavailable at some branches
 * - Default: service available at all branches
 * - Explicit unavailability requires reason
 *
 * **I10. Staff Requirements:**
 * - Service can require specific staff skills
 * - Mandatory skills MUST be met to perform service
 * - Optional skills nice to have but not required
 *
 * **I11. Catalog Boundary (NOT Inventory):**
 * - Service Catalog defines WHAT services offered (name, price, duration)
 * - Service Catalog does NOT own inventory items (product_usage is metadata, not capability)
 * - Service Catalog does NOT own stock quantity/movements
 * - Inventory management is separate bounded context (IInventoryEngine or E7 Logistics)
 */

/**
 * Contract Version History:
 *
 * **v1.0.0 (2026-09-15):**
 * - Initial extraction from Bella Spa packages table
 * - Semantic scope: Service catalog only (inventory deferred)
 * - Platform ownership: Cross-vertical capability
 * - Excluded product_usage field (inventory-related metadata)
 * - Consumer fit: Spa, Haircut, Nail, Healthcare, Auto, Education
 */

