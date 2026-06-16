/**
 * Module adapter system exports.
 * 
 * @remarks
 * This barrel file exports the module registry and adapter utilities
 * for use throughout the application.
 * 
 * **Exports**:
 * - `moduleRegistry`: Singleton instance for adapter registration/lookup
 * - Utility types: Type guards and error classes for adapter validation
 * 
 * @module CoreAdapters
 */

// Core registry singleton
export { moduleRegistry } from './registry';

// Utility types and type guards
export {
  isModuleAdapter,
  ModuleRegistryError,
  DuplicateModuleError,
  AdapterNotFoundError,
} from './types';

// Re-export ModuleAdapter type from core types for convenience
export type { ModuleAdapter, ModuleId } from '@/core/types';
