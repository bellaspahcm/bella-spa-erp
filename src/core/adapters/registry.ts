/**
 * Module registry for managing module adapters at runtime.
 * 
 * @remarks
 * The ModuleRegistry provides centralized management of module adapters,
 * allowing core services to invoke module-specific behavior without
 * direct dependencies on module implementations.
 * 
 * **Design Decisions**:
 * - In-memory Map storage for O(1) lookup performance
 * - Singleton pattern ensures single registry instance across app
 * - Validation prevents duplicate module ID registration
 * - Graceful `get()` vs. error-throwing `getRequired()`
 * 
 * **Architecture Pattern**:
 * ```typescript
 * // Module registration (during app startup)
 * moduleRegistry.register(spaAdapter);
 * 
 * // Core service invokes adapter
 * const adapter = moduleRegistry.get(context.moduleId);
 * if (adapter?.validateBookingRules) {
 *   await adapter.validateBookingRules(order, context);
 * }
 * ```
 * 
 * @module ModuleRegistry
 */

import type { ModuleAdapter, ModuleId } from '@/core/types';
import {
  isModuleAdapter,
  DuplicateModuleError,
  AdapterNotFoundError,
} from './types';

/**
 * Module registry class for managing module adapters.
 * 
 * @remarks
 * This class provides methods to register, retrieve, and check
 * for module adapters. It ensures only one adapter per moduleId
 * can be registered and provides both graceful and strict retrieval.
 * 
 * **Usage**:
 * - Use `register()` during app initialization to register adapters
 * - Use `get()` in core services when adapter is optional
 * - Use `getRequired()` when adapter must exist (throws if missing)
 * - Use `has()` to check if adapter exists before retrieval
 */
class ModuleRegistry {
  /**
   * Internal storage for registered adapters.
   * Using Map for O(1) lookup performance.
   */
  private adapters = new Map<ModuleId, ModuleAdapter>();

  /**
   * Register a module adapter in the registry.
   * 
   * @param adapter - Module adapter implementing ModuleAdapter interface
   * @throws {DuplicateModuleError} If adapter with same moduleId already registered
   * @throws {Error} If adapter does not implement ModuleAdapter interface
   * 
   * @remarks
   * This method should be called during application startup, typically
   * in module registration files (e.g., `src/modules/spa/register.ts`).
   * 
   * Validates that:
   * 1. The adapter implements the ModuleAdapter interface
   * 2. No adapter with the same moduleId is already registered
   * 
   * @example
   * ```typescript
   * // In src/modules/spa/register.ts
   * import { moduleRegistry } from '@/core/adapters';
   * import { SpaModuleAdapter } from './adapters/SpaModuleAdapter';
   * 
   * const spaAdapter = new SpaModuleAdapter();
   * moduleRegistry.register(spaAdapter);
   * ```
   */
  register(adapter: ModuleAdapter): void {
    // Validate adapter implements ModuleAdapter interface
    if (!isModuleAdapter(adapter)) {
      throw new Error('Invalid adapter: must implement ModuleAdapter interface');
    }

    // Check for duplicate registration
    if (this.adapters.has(adapter.moduleId)) {
      throw new DuplicateModuleError(adapter.moduleId);
    }

    // Register adapter
    this.adapters.set(adapter.moduleId, adapter);
    
    // Log successful registration (helpful for debugging)
    if (typeof console !== 'undefined') {
      console.log(`[ModuleRegistry] Registered adapter: ${adapter.moduleName} (${adapter.moduleId})`);
    }
  }

  /**
   * Retrieve a module adapter by ID (graceful, returns undefined if not found).
   * 
   * @param moduleId - Module identifier
   * @returns Module adapter if found, undefined otherwise
   * 
   * @remarks
   * Use this method when the adapter is optional. Core services should
   * check for undefined and provide fallback behavior.
   * 
   * This is the preferred method for most core service usage, as it
   * allows graceful degradation when modules are not enabled.
   * 
   * @example
   * ```typescript
   * // In core service
   * const adapter = moduleRegistry.get(context.moduleId);
   * if (adapter?.validateBookingRules) {
   *   const isValid = await adapter.validateBookingRules(order, context);
   *   if (!isValid) {
   *     throw new Error('Booking validation failed');
   *   }
   * }
   * ```
   */
  get(moduleId: ModuleId): ModuleAdapter | undefined {
    return this.adapters.get(moduleId);
  }

  /**
   * Retrieve a module adapter by ID (strict, throws if not found).
   * 
   * @param moduleId - Module identifier
   * @returns Module adapter
   * @throws {AdapterNotFoundError} If adapter not found
   * 
   * @remarks
   * Use this method when the adapter MUST exist for the operation
   * to proceed. This is appropriate when:
   * - The module is known to be enabled in tenant configuration
   * - The operation cannot proceed without module-specific behavior
   * - You want to fail fast with a clear error message
   * 
   * @example
   * ```typescript
   * // In module-specific API route
   * const adapter = moduleRegistry.getRequired('spa');
   * const pricing = await adapter.calculatePricing(item, context);
   * ```
   */
  getRequired(moduleId: ModuleId): ModuleAdapter {
    const adapter = this.adapters.get(moduleId);
    if (!adapter) {
      throw new AdapterNotFoundError(moduleId);
    }
    return adapter;
  }

  /**
   * Check if a module adapter is registered.
   * 
   * @param moduleId - Module identifier
   * @returns True if adapter registered, false otherwise
   * 
   * @remarks
   * Use this method for conditional logic based on adapter availability.
   * This is useful for:
   * - Enabling/disabling UI features based on module availability
   * - Conditional routing in API endpoints
   * - Feature detection in middleware
   * 
   * @example
   * ```typescript
   * // In dashboard component
   * const showSpaWidgets = moduleRegistry.has('spa');
   * 
   * // In API route
   * if (!moduleRegistry.has(requestedModule)) {
   *   return res.status(404).json({ error: 'Module not available' });
   * }
   * ```
   */
  has(moduleId: ModuleId): boolean {
    return this.adapters.has(moduleId);
  }

  /**
   * Get all registered module IDs.
   * 
   * @returns Array of registered module IDs
   * 
   * @remarks
   * Useful for:
   * - Displaying available modules in admin UI
   * - Iterating over all modules for aggregated operations
   * - Debugging and logging
   * 
   * @example
   * ```typescript
   * // In admin dashboard
   * const availableModules = moduleRegistry.getAllModuleIds();
   * console.log('Available modules:', availableModules);
   * 
   * // In analytics service
   * const allModuleIds = moduleRegistry.getAllModuleIds();
   * const revenueByModule = await Promise.all(
   *   allModuleIds.map(id => getModuleRevenue(id))
   * );
   * ```
   */
  getAllModuleIds(): ModuleId[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Clear all registered adapters.
   * 
   * @remarks
   * This method is primarily for testing purposes. It allows tests
   * to reset the registry to a clean state between test runs.
   * 
   * **⚠️ WARNING**: Do not use in production code. This will remove
   * all registered adapters and may break application functionality.
   * 
   * @internal
   * 
   * @example
   * ```typescript
   * // In test setup
   * beforeEach(() => {
   *   moduleRegistry.clear();
   * });
   * ```
   */
  clear(): void {
    this.adapters.clear();
  }
}

/**
 * Singleton instance of the module registry.
 * 
 * @remarks
 * This singleton ensures a single registry instance across the entire
 * application. Import and use this instance in both module registration
 * code and core services.
 * 
 * **Rationale for Singleton**:
 * - Ensures consistent adapter availability across all services
 * - Avoids duplicate registrations
 * - Simplifies import patterns (no need to pass registry around)
 * - Matches the singleton nature of modules (one adapter per module)
 * 
 * @example
 * ```typescript
 * // Module registration
 * import { moduleRegistry } from '@/core/adapters';
 * moduleRegistry.register(myAdapter);
 * 
 * // Core service usage
 * import { moduleRegistry } from '@/core/adapters';
 * const adapter = moduleRegistry.get('spa');
 * ```
 */
export const moduleRegistry = new ModuleRegistry();
