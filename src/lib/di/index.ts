/**
 * Dependency Injection Module
 * 
 * Exports all DI utilities for Bella ERP extension system.
 * 
 * @module di
 */

// Service Container
export {
  ServiceContainer,
  ServiceLifetime,
  globalContainer,
  createServiceContainer,
  type ServiceFactory
} from './ServiceContainer';

// Extension Registry
export {
  ExtensionRegistry,
  extensionRegistry
} from './ExtensionRegistry';

// Bootstrap utilities
export {
  bootstrapExtensions,
  cleanupExtensions,
  getExtensionStats
} from './bootstrap.example';
