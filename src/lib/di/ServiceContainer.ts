/**
 * Simple Dependency Injection Container
 * 
 * Lightweight DI container using factory pattern. Supports:
 * - Service registration by key
 * - Singleton, Scoped, and Transient lifetimes
 * - Factory functions for lazy initialization
 * - Type-safe service resolution
 * 
 * Design principles:
 * - Simple: No reflection, no decorators, no complex metadata
 * - Type-safe: Full TypeScript support
 * - Explicit: All registrations are manual and visible
 * - Lightweight: No external dependencies
 * 
 * @example
 * ```typescript
 * const container = new ServiceContainer();
 * 
 * // Register singleton
 * container.registerSingleton('emailService', () => new EmailService());
 * 
 * // Register transient
 * container.registerTransient('logger', () => new Logger());
 * 
 * // Resolve service
 * const emailService = container.resolve<EmailService>('emailService');
 * 
 * // Clear all instances
 * await container.dispose();
 * ```
 */

/**
 * Service lifetime enumeration
 */
export enum ServiceLifetime {
  /** Single instance for entire application lifetime */
  Singleton = 'singleton',
  
  /** Single instance per scope (e.g., per HTTP request) */
  Scoped = 'scoped',
  
  /** New instance every time */
  Transient = 'transient'
}

/**
 * Service factory function type
 */
export type ServiceFactory<T = unknown> = (container: ServiceContainer) => T;

/**
 * Service descriptor
 */
interface ServiceDescriptor<T = unknown> {
  /** Unique service key */
  key: string;
  
  /** Factory function to create instance */
  factory: ServiceFactory<T>;
  
  /** Service lifetime */
  lifetime: ServiceLifetime;
  
  /** Cached singleton instance (if lifetime is singleton) */
  instance?: T;
}

/**
 * Simple Dependency Injection Container
 * 
 * Manages service registration and resolution with lifetime support.
 * 
 * Features:
 * - Singleton: One instance for entire app
 * - Scoped: One instance per scope (future: per HTTP request)
 * - Transient: New instance every resolution
 * - Lazy initialization: Services created on first resolve
 * - Type safety: Generic resolve() method
 * - Disposal: Cleanup all managed instances
 */
export class ServiceContainer {
  private services: Map<string, ServiceDescriptor> = new Map();
  private scopedInstances: Map<string, unknown> = new Map();
  
  /**
   * Register a singleton service
   * 
   * Singleton services are created once and reused for entire app lifetime.
   * 
   * @example
   * ```typescript
   * container.registerSingleton('config', () => new ConfigService());
   * container.registerSingleton('db', (c) => new Database(c.resolve('config')));
   * ```
   */
  registerSingleton<T>(key: string, factory: ServiceFactory<T>): void {
    if (this.services.has(key)) {
      throw new Error(`Service '${key}' is already registered`);
    }
    
    this.services.set(key, {
      key,
      factory,
      lifetime: ServiceLifetime.Singleton
    });
  }
  
  /**
   * Register a scoped service
   * 
   * Scoped services are created once per scope (e.g., per HTTP request).
   * Currently behaves like singleton (scope management not implemented yet).
   * 
   * @example
   * ```typescript
   * container.registerScoped('requestContext', () => new RequestContext());
   * ```
   */
  registerScoped<T>(key: string, factory: ServiceFactory<T>): void {
    if (this.services.has(key)) {
      throw new Error(`Service '${key}' is already registered`);
    }
    
    this.services.set(key, {
      key,
      factory,
      lifetime: ServiceLifetime.Scoped
    });
  }
  
  /**
   * Register a transient service
   * 
   * Transient services are created every time they are resolved.
   * 
   * @example
   * ```typescript
   * container.registerTransient('logger', () => new Logger());
   * container.registerTransient('uuid', () => crypto.randomUUID());
   * ```
   */
  registerTransient<T>(key: string, factory: ServiceFactory<T>): void {
    if (this.services.has(key)) {
      throw new Error(`Service '${key}' is already registered`);
    }
    
    this.services.set(key, {
      key,
      factory,
      lifetime: ServiceLifetime.Transient
    });
  }
  
  /**
   * Resolve a service by key
   * 
   * @param key - Service key
   * @returns Service instance
   * @throws Error if service not found
   * 
   * @example
   * ```typescript
   * const config = container.resolve<ConfigService>('config');
   * const logger = container.resolve<Logger>('logger');
   * ```
   */
  resolve<T>(key: string): T {
    const descriptor = this.services.get(key);
    
    if (!descriptor) {
      throw new Error(`Service not found: ${key}`);
    }
    
    switch (descriptor.lifetime) {
      case ServiceLifetime.Singleton:
        return this.resolveSingleton<T>(descriptor);
        
      case ServiceLifetime.Scoped:
        return this.resolveScoped<T>(descriptor);
        
      case ServiceLifetime.Transient:
        return this.resolveTransient<T>(descriptor);
        
      default:
        throw new Error(`Unknown lifetime: ${descriptor.lifetime}`);
    }
  }
  
  /**
   * Try to resolve a service (returns undefined if not found)
   * 
   * @param key - Service key
   * @returns Service instance or undefined
   * 
   * @example
   * ```typescript
   * const logger = container.tryResolve<Logger>('logger');
   * if (logger) {
   *   logger.log('Service found');
   * }
   * ```
   */
  tryResolve<T>(key: string): T | undefined {
    try {
      return this.resolve<T>(key);
    } catch {
      return undefined;
    }
  }
  
  /**
   * Check if service is registered
   * 
   * @param key - Service key
   * @returns true if service is registered
   * 
   * @example
   * ```typescript
   * if (container.has('logger')) {
   *   const logger = container.resolve<Logger>('logger');
   * }
   * ```
   */
  has(key: string): boolean {
    return this.services.has(key);
  }
  
  /**
   * Get all registered service keys
   * 
   * @returns Array of service keys
   * 
   * @example
   * ```typescript
   * const keys = container.getServiceKeys();
   * console.log('Registered services:', keys);
   * ```
   */
  getServiceKeys(): string[] {
    return Array.from(this.services.keys());
  }
  
  /**
   * Clear all scoped instances
   * 
   * Called at the end of a scope (e.g., end of HTTP request).
   * Currently a no-op since scope management is not implemented.
   */
  clearScope(): void {
    this.scopedInstances.clear();
  }
  
  /**
   * Dispose container and cleanup all managed instances
   * 
   * Calls dispose() method on all singleton/scoped instances if available.
   * 
   * @example
   * ```typescript
   * // On application shutdown
   * await container.dispose();
   * ```
   */
  async dispose(): Promise<void> {
    // Dispose singleton instances
    for (const descriptor of this.services.values()) {
      const disposable = descriptor.instance as unknown as { dispose?: () => Promise<void> };
      if (disposable && typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    }
    
    // Dispose scoped instances
    for (const instance of this.scopedInstances.values()) {
      const disposable = instance as unknown as { dispose?: () => Promise<void> };
      if (disposable && typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    }
    
    // Clear all
    this.services.clear();
    this.scopedInstances.clear();
  }
  
  /**
   * Resolve singleton service
   */
  private resolveSingleton<T>(descriptor: ServiceDescriptor): T {
    // Return cached instance if exists
    if (descriptor.instance !== undefined) {
      return descriptor.instance as T;
    }
    
    // Create new instance and cache it
    const instance = descriptor.factory(this) as T;
    descriptor.instance = instance;
    
    return instance;
  }
  
  /**
   * Resolve scoped service
   * 
   * Currently behaves like singleton (scope management not implemented).
   * Future: Should respect HTTP request scope.
   */
  private resolveScoped<T>(descriptor: ServiceDescriptor): T {
    // Check if instance exists in current scope
    const cached = this.scopedInstances.get(descriptor.key);
    if (cached !== undefined) {
      return cached as T;
    }
    
    // Create new instance and cache in scope
    const instance = descriptor.factory(this) as T;
    this.scopedInstances.set(descriptor.key, instance);
    
    return instance;
  }
  
  /**
   * Resolve transient service
   * 
   * Always creates new instance.
   */
  private resolveTransient<T>(descriptor: ServiceDescriptor): T {
    return descriptor.factory(this) as T;
  }
}

/**
 * Global service container instance
 * 
 * Use this for application-wide service registration.
 * 
 * @example
 * ```typescript
 * // In app initialization
 * import { globalContainer } from '@/lib/di/ServiceContainer';
 * 
 * globalContainer.registerSingleton('emailService', () => new EmailService());
 * globalContainer.registerSingleton('logger', () => new Logger());
 * 
 * // In business logic
 * const emailService = globalContainer.resolve<EmailService>('emailService');
 * ```
 */
export const globalContainer = new ServiceContainer();

/**
 * Helper function to create a new service container
 * 
 * Useful for testing or isolated service graphs.
 * 
 * @example
 * ```typescript
 * const testContainer = createServiceContainer();
 * testContainer.registerSingleton('logger', () => new MockLogger());
 * ```
 */
export function createServiceContainer(): ServiceContainer {
  return new ServiceContainer();
}
