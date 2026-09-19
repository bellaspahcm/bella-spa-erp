/**
 * Healthcare Kernel Service Locator
 * 
 * Provides contract-based access to Healthcare engines.
 * Products import this locator, NOT engine implementations.
 * 
 * **Architecture Pattern:** Product → Contract → Service Locator → Engine
 * 
 * **Purpose:** Enforce contract-first principle (ADR-002 + Constitution Law 3)
 * 
 * **Usage Example:**
 * ```typescript
 * // ❌ OLD (P1 violation - direct engine import)
 * import { BedEngineService } from '@/platform/healthcare/engines/bed-engine';
 * const bedEngine = new BedEngineService(supabase);
 * 
 * // ✅ NEW (contract-first via service locator)
 * import { getHealthcareService } from '@/platform/healthcare';
 * import type { BedEngineContract } from '@/platform/healthcare/contracts/bed-engine.contract';
 * 
 * const bedEngine = getHealthcareService<BedEngineContract>('bed-engine');
 * ```
 * 
 * **Benefits:**
 * 1. Products only depend on contracts, not implementations
 * 2. Engine implementations can change without breaking Products
 * 3. Enables mocking for tests (mock service locator, not engines)
 * 4. Enforces Architecture Constitution compliance
 * 5. Type-safe service resolution
 * 
 * **Implementation Note:** 
 * Engines are lazy-loaded to avoid circular dependencies and improve startup time.
 * 
 * @module platform/healthcare/service-locator
 * @implements ADR-002 (Contract-First Architecture)
 * @implements Constitution Law 3 (Contract-Only Access)
 * @since Week 2 Day 3 (P1 Remediation)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Import all contract types (NOT engine implementations)
import type { BedEngineContract } from './contracts/bed-engine.contract';
import type { CdsEngineContract } from './contracts/cds-engine.contract';
import type { NursingEngineContract } from './contracts/nursing-engine.contract';
import type { OrderEngineContract } from './contracts/order-engine.contract';
import type { PharmacyEngineContract } from './contracts/pharmacy-engine.contract';
import type { OREngineContract } from './contracts/or-engine.contract';
import type { SurgicalEngineContract } from './contracts/surgical-engine.contract';
import type { AnesthesiaEngineContract } from './contracts/anesthesia-engine.contract';

/**
 * Healthcare Service Map
 * 
 * Maps service names to their contract types.
 * Only includes operational engines with implemented contracts.
 * 
 * Note: encounter-engine and laboratory-engine exist but use metadata-only contracts
 * (no exported TypeScript interfaces). Access via service locator returns unknown type.
 */
export type HealthcareServiceMap = {
  // Operational Healthcare Engines with TypeScript contracts
  'bed-engine': BedEngineContract;
  'cds-engine': CdsEngineContract;
  'nursing-engine': NursingEngineContract;
  'order-engine': OrderEngineContract;
  'pharmacy-engine': PharmacyEngineContract;
  'or-engine': OREngineContract;
  'surgical-engine': SurgicalEngineContract;
  'anesthesia-engine': AnesthesiaEngineContract;
  
  // Metadata-only contracts (runtime available, no TS type)
  'encounter-engine': unknown;
  'laboratory-engine': unknown;
};

/**
 * Service key type (for type-safe service name lookup)
 */
export type ServiceKey = keyof HealthcareServiceMap;

/**
 * Service instance cache
 * 
 * Caches instantiated services to avoid recreating them on every call.
 * Key: service name, Value: engine instance
 */
const serviceCache = new Map<ServiceKey, unknown>();

/**
 * Get Healthcare Kernel service by contract name.
 * 
 * This is the ONLY way Products should access Healthcare engines.
 * Direct engine imports are a P1 Architecture violation.
 * 
 * @template T - The contract type (inferred from serviceName)
 * @param serviceName - Name of the service to retrieve (e.g., 'bed-engine')
 * @param supabase - Supabase client (required for engine initialization)
 * @returns Engine instance implementing the requested contract
 * 
 * @example
 * ```typescript
 * import { getHealthcareService } from '@/platform/healthcare';
 * import type { BedEngineContract } from '@/platform/healthcare/contracts/bed-engine.contract';
 * import { createClient } from '@/lib/supabase-client';
 * 
 * const supabase = createClient();
 * const bedEngine = getHealthcareService<BedEngineContract>('bed-engine', supabase);
 * 
 * const result = await bedEngine.allocateBed({
 *   tenantId: 'tenant-123',
 *   encounterId: 'enc-456',
 *   patientId: 'pat-789',
 *   wardId: 'ward-001',
 *   bedType: 'standard',
 * });
 * ```
 * 
 * @throws Error if service name is not recognized
 */
export function getHealthcareService<T extends HealthcareServiceMap[ServiceKey]>(
  serviceName: ServiceKey,
  supabase: SupabaseClient<Database>
): T {
  // Check cache first
  if (serviceCache.has(serviceName)) {
    return serviceCache.get(serviceName) as T;
  }

  // Lazy-load engine implementation
  let serviceInstance: unknown;

  switch (serviceName) {
    case 'bed-engine': {
      const { BedEngineService } = require('./engines/bed-engine');
      serviceInstance = new BedEngineService(supabase);
      break;
    }
    case 'cds-engine': {
      const { CdsEngineService } = require('./engines/cds-engine');
      serviceInstance = new CdsEngineService(supabase);
      break;
    }
    case 'encounter-engine': {
      const { EncounterEngineService } = require('./engines/encounter-engine');
      serviceInstance = new EncounterEngineService(supabase);
      break;
    }
    case 'nursing-engine': {
      const { NursingEngineService } = require('./engines/nursing-engine');
      serviceInstance = new NursingEngineService(supabase);
      break;
    }
    case 'order-engine': {
      const { OrderEngineService } = require('./engines/order-engine');
      serviceInstance = new OrderEngineService(supabase);
      break;
    }
    case 'pharmacy-engine': {
      const { PharmacyEngineService } = require('./engines/pharmacy-engine');
      serviceInstance = new PharmacyEngineService(supabase);
      break;
    }
    case 'laboratory-engine': {
      const { LaboratoryEngineService } = require('./engines/laboratory-engine');
      serviceInstance = new LaboratoryEngineService(supabase);
      break;
    }
    case 'or-engine': {
      const { OREngineService } = require('./engines/or-engine');
      serviceInstance = new OREngineService(supabase);
      break;
    }
    case 'surgical-engine': {
      const { SurgicalEngineService } = require('./engines/surgical-engine');
      serviceInstance = new SurgicalEngineService(supabase);
      break;
    }
    case 'anesthesia-engine': {
      const { AnesthesiaEngineService } = require('./engines/anesthesia-engine');
      serviceInstance = new AnesthesiaEngineService(supabase);
      break;
    }
    default: {
      throw new Error(
        `Healthcare service '${serviceName}' not found. ` +
        `Available services: ${Array.from(serviceCache.keys()).join(', ')}`
      );
    }
  }

  // Cache the instance
  serviceCache.set(serviceName, serviceInstance);

  return serviceInstance as T;
}

/**
 * Clear service cache (for testing)
 * 
 * Clears all cached service instances, forcing re-initialization on next access.
 * Useful for testing different configurations or mocking.
 */
export function clearServiceCache(): void {
  serviceCache.clear();
}

/**
 * Check if service is cached
 * 
 * @param serviceName - Service name to check
 * @returns true if service is already instantiated and cached
 */
export function isServiceCached(serviceName: ServiceKey): boolean {
  return serviceCache.has(serviceName);
}
