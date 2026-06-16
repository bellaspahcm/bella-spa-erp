/**
 * Adapter utility types for module system.
 * 
 * @remarks
 * This file contains utility types used by the module registry
 * and adapter system. These types assist with type narrowing,
 * validation, and adapter registration.
 */

import type { ModuleAdapter, ModuleId } from '@/core/types';

/**
 * Type guard to validate if an object implements ModuleAdapter interface.
 * 
 * @param value - Value to check
 * @returns True if value implements ModuleAdapter interface
 * 
 * @example
 * ```typescript
 * const adapter = getAdapterFromUnknownSource();
 * if (isModuleAdapter(adapter)) {
 *   moduleRegistry.register(adapter);
 * }
 * ```
 */
export function isModuleAdapter(value: unknown): value is ModuleAdapter {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  // Check required properties
  if (typeof obj.moduleId !== 'string') return false;
  if (typeof obj.moduleName !== 'string') return false;
  
  // All optional methods must be functions if present
  const optionalMethods = [
    'transformServiceItem',
    'transformBookingOrder',
    'validateBookingRules',
    'calculatePricing',
    'onBookingCompleted',
    'getModuleWidgets',
  ] as const;
  
  for (const method of optionalMethods) {
    if (obj[method] !== undefined && typeof obj[method] !== 'function') {
      return false;
    }
  }
  
  return true;
}

/**
 * Registry error types for module registration failures.
 */
export class ModuleRegistryError extends Error {
  constructor(
    message: string,
    public readonly moduleId?: ModuleId
  ) {
    super(message);
    this.name = 'ModuleRegistryError';
  }
}

/**
 * Error thrown when attempting to register a duplicate module ID.
 */
export class DuplicateModuleError extends ModuleRegistryError {
  constructor(moduleId: ModuleId) {
    super(`Module adapter already registered: ${moduleId}`, moduleId);
    this.name = 'DuplicateModuleError';
  }
}

/**
 * Error thrown when attempting to get a required adapter that doesn't exist.
 */
export class AdapterNotFoundError extends ModuleRegistryError {
  constructor(moduleId: ModuleId) {
    super(`Module adapter not found: ${moduleId}`, moduleId);
    this.name = 'AdapterNotFoundError';
  }
}
