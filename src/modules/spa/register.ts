/**
 * Spa Module Registration
 * 
 * This file registers the SpaModuleAdapter with the core platform's module registry.
 * It should be called once during application initialization.
 * 
 * @module SpaModuleRegistration
 * @see {@link ../../../docs/architecture/module-system.md} for module system architecture
 * 
 * **Requirements**: REQ-3.3.3
 * 
 * **Responsibilities**:
 * - Export registration function to be called on app startup
 * - Instantiate SpaModuleAdapter and register it with moduleRegistry
 * - Log successful registration for debugging
 * - Handle registration errors gracefully
 * 
 * **Usage**:
 * ```typescript
 * // In src/app/layout.tsx or app entry point
 * import { registerSpaModule } from '@/modules/spa/register';
 * 
 * // Register on app startup
 * registerSpaModule();
 * ```
 */

import { moduleRegistry } from '@/core/adapters/registry';
import { spaModuleAdapter } from './adapters/SpaModuleAdapter';

/**
 * Register the Spa Module Adapter with the core platform.
 * 
 * @remarks
 * This function should be called once during application initialization,
 * typically in the root layout file (`src/app/layout.tsx`). It registers
 * the SpaModuleAdapter with the module registry, making spa-specific
 * behavior available to all core services.
 * 
 * **Registration Process**:
 * 1. Imports the singleton spaModuleAdapter instance
 * 2. Registers it with the moduleRegistry
 * 3. Logs successful registration (visible in console)
 * 4. Throws error if registration fails
 * 
 * **Error Handling**:
 * - Throws DuplicateModuleError if spa adapter already registered
 * - Throws Error if adapter is invalid
 * - Error is logged and re-thrown to fail fast during startup
 * 
 * **Lifecycle**:
 * - Called once per application lifecycle
 * - Must be called before any core services invoke spa adapter
 * - Should be called synchronously during module imports
 * 
 * @throws {DuplicateModuleError} If spa adapter already registered
 * @throws {Error} If adapter validation fails
 * 
 * @example
 * ```typescript
 * // In src/app/layout.tsx
 * import { registerSpaModule } from '@/modules/spa/register';
 * 
 * // Register before rendering
 * registerSpaModule();
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>{children}</body>
 *     </html>
 *   );
 * }
 * ```
 */
export function registerSpaModule(): void {
  try {
    // Register the spa module adapter with the core registry
    moduleRegistry.register(spaModuleAdapter);
    
    // Console log is already handled by moduleRegistry.register()
    // It will output: "[ModuleRegistry] Registered adapter: Bella Spa & Babycare (spa)"
  } catch (error) {
    // Log registration error and re-throw to fail fast
    console.error('[SpaModule] Failed to register spa module adapter:', error);
    throw error;
  }
}
