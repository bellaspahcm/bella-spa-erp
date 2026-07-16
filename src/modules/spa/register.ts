/**
 * Spa Module Registration
 * 
 * Registers SpaModuleAdapter in the global module registry.
 * This enables conflict detection and capacity validation for both:
 * - Baby Care Spa (module: 'spa')
 * - Beauty Spa (module: 'beauty_spa')
 * 
 * **Why Single Adapter for Both:**
 * - Same business logic (KTV assignment, time conflicts, break time buffer)
 * - Same capacity rules (15-min break, daily limits, overlap detection)
 * - Configuration-driven differences (stored in tenant.capacity_config)
 * 
 * **Conflict Detection Features:**
 * 1. Time overlap detection
 * 2. Break time buffer enforcement (15 min default)
 * 3. Daily capacity limits
 * 4. Concurrent session limits
 * 5. Working hours validation
 * 
 * **Architecture:**
 * - Core services call `moduleRegistry.get(moduleId)`
 * - Adapter implements `validateBookingRules()`
 * - CapacityManagementProvider handles actual validation
 * - Tenant-specific config from database
 * 
 * @module SpaModuleRegistration
 */

import { moduleRegistry } from '@/core/adapters/registry';
import { SpaModuleAdapter } from './adapters/SpaModuleAdapter';
import type { ModuleAdapter } from '@/core/types';

/**
 * Register Spa module adapter.
 * 
 * This function is called during application initialization to ensure
 * the SpaModuleAdapter is available for all booking operations.
 */
export function registerSpaModule(): void {
  try {
    // Register for Baby Care Spa (original module)
    const spaAdapter = new SpaModuleAdapter();
    moduleRegistry.register(spaAdapter);
    console.log('[SpaModule] ✅ Registered adapter for module: spa (Baby Care Spa)');

    // Register for Beauty Spa (same logic, different tenant)
    // Create a new instance to allow independent state if needed
    const beautySpaAdapter = new SpaModuleAdapter();
    
    // Override moduleId and moduleName for beauty_spa
    // This is a workaround to reuse the same adapter class
    // @ts-expect-error - Overriding readonly properties for module aliasing
    beautySpaAdapter.moduleId = 'beauty_spa';
    // @ts-expect-error - Overriding readonly properties for module aliasing
    beautySpaAdapter.moduleName = 'Beauty Spa Module';
    
    moduleRegistry.register(beautySpaAdapter as ModuleAdapter);
    console.log('[SpaModule] ✅ Registered adapter for module: beauty_spa (Beauty Spa)');

    // Verify registration
    if (moduleRegistry.has('spa') && moduleRegistry.has('beauty_spa')) {
      console.log('[SpaModule] ✅ Both spa and beauty_spa modules registered successfully');
    } else {
      console.error('[SpaModule] ❌ Module registration verification failed');
    }
  } catch (error) {
    console.error('[SpaModule] ❌ Failed to register module adapters:', error);
    // Log but don't throw - allow app to continue even if registration fails
    // Booking validation will gracefully skip if adapter not found
  }
}

/**
 * Check if spa modules are registered.
 * 
 * Utility function to verify module registration status.
 * Useful for debugging and health checks.
 * 
 * @returns Object with registration status for each module
 */
export function checkSpaModuleRegistration(): {
  spa: boolean;
  beauty_spa: boolean;
  allRegistered: boolean;
} {
  const spaRegistered = moduleRegistry.has('spa');
  const beautySpaRegistered = moduleRegistry.has('beauty_spa');
  
  return {
    spa: spaRegistered,
    beauty_spa: beautySpaRegistered,
    allRegistered: spaRegistered && beautySpaRegistered,
  };
}

/**
 * Auto-register on module import.
 * 
 * This ensures the adapter is registered as soon as this module is imported,
 * typically during Next.js initialization or in middleware.
 */
registerSpaModule();

// Export for manual registration if needed
export { SpaModuleAdapter };
