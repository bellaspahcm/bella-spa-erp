/**
 * Decision Engine Platform - Bootstrap & DI Integration
 * 
 * Bootstrap Decision Engine with dependencies and providers.
 * Supports multiple initialization patterns.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6, 20
 */

import type { IEventPublisher } from '@/lib/events/abstractions/IEventPublisher';
import { InMemoryEventPublisher } from '@/lib/events/publishers/InMemoryEventPublisher';
import { ConsoleLogger, NoOpLogger, type ILogger } from '@/lib/logger';
import type { IDecisionProvider } from './abstractions';
import {
  DecisionEngine,
  DecisionProviderRegistry,
  createDecisionEngine,
  createProviderRegistry,
} from './core';
import { RuleProvider } from './providers';

/**
 * Bootstrap options
 */
export interface BootstrapOptions {
  /**
   * Event publisher (defaults to InMemoryEventPublisher)
   */
  eventPublisher?: IEventPublisher;

  /**
   * Logger (defaults to ConsoleLogger in dev, NoOpLogger in production)
   */
  logger?: ILogger;

  /**
   * Providers to register (defaults to [RuleProvider])
   */
  providers?: IDecisionProvider[];

  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Decision Engine instance with registry
 */
export interface DecisionEngineInstance {
  /**
   * Decision Engine orchestrator
   */
  engine: DecisionEngine;

  /**
   * Provider registry (for dynamic provider registration)
   */
  registry: DecisionProviderRegistry;

  /**
   * Event publisher (for subscribing to decision events)
   */
  eventPublisher: IEventPublisher;

  /**
   * Logger (for custom logging)
   */
  logger: ILogger;
}

/**
 * Bootstrap Decision Engine with default configuration
 * 
 * Creates a ready-to-use Decision Engine instance with:
 * - RuleProvider registered
 * - InMemoryEventPublisher
 * - ConsoleLogger (dev) or NoOpLogger (production)
 * 
 * @param options - Bootstrap options
 * @returns DecisionEngineInstance
 * 
 * @example
 * ```typescript
 * import { bootstrapDecisionEngine } from '@/lib/decision-engine';
 * 
 * const { engine } = bootstrapDecisionEngine();
 * 
 * const result = await engine.evaluate(context);
 * ```
 * 
 * @example With Custom Configuration
 * ```typescript
 * import { bootstrapDecisionEngine } from '@/lib/decision-engine';
 * import { MyCustomProvider } from './providers/MyCustomProvider';
 * 
 * const { engine, registry } = bootstrapDecisionEngine({
 *   providers: [new RuleProvider(), new MyCustomProvider()],
 *   debug: true
 * });
 * ```
 */
export function bootstrapDecisionEngine(
  options: BootstrapOptions = {}
): DecisionEngineInstance {
  // Create dependencies
  const eventPublisher = options.eventPublisher || new InMemoryEventPublisher();
  const logger = options.logger || createDefaultLogger(options.debug);

  // Create registry
  const registry = createProviderRegistry();

  // Register providers
  const providers = options.providers || [new RuleProvider()];
  for (const provider of providers) {
    registry.register(provider);
  }

  // Create engine
  const engine = createDecisionEngine({
    registry,
    eventPublisher,
    logger,
  });

  // Log bootstrap info
  if (options.debug) {
    logger.info('Decision Engine bootstrapped', {
      providers: registry.listProviders(),
      ruleTypes: registry.listRuleTypes(),
    });
  }

  return {
    engine,
    registry,
    eventPublisher,
    logger,
  };
}

/**
 * Create default logger based on environment
 * @private
 */
function createDefaultLogger(debug?: boolean): ILogger {
  if (debug || process.env.NODE_ENV === 'development') {
    return new ConsoleLogger();
  }
  return new NoOpLogger();
}

/**
 * Bootstrap Decision Engine for testing
 * 
 * Creates a Decision Engine instance suitable for testing:
 * - NoOpLogger (silent)
 * - InMemoryEventPublisher
 * - Custom providers (if provided)
 * 
 * @param providers - Providers to register (defaults to [RuleProvider])
 * @returns DecisionEngineInstance
 * 
 * @example
 * ```typescript
 * import { bootstrapForTesting } from '@/lib/decision-engine';
 * 
 * describe('BookingService', () => {
 *   it('should approve booking', async () => {
 *     const { engine } = bootstrapForTesting();
 *     
 *     const result = await engine.evaluate(context);
 *     expect(result.approved).toBe(true);
 *   });
 * });
 * ```
 */
export function bootstrapForTesting(
  providers?: IDecisionProvider[]
): DecisionEngineInstance {
  return bootstrapDecisionEngine({
    eventPublisher: new InMemoryEventPublisher(),
    logger: new NoOpLogger(),
    providers: providers || [new RuleProvider()],
    debug: false,
  });
}

/**
 * Bootstrap Decision Engine for production
 * 
 * Creates a Decision Engine instance suitable for production:
 * - NoOpLogger (replace with production logger)
 * - Custom EventPublisher (replace with production event bus)
 * - Custom providers
 * 
 * @param options - Bootstrap options
 * @returns DecisionEngineInstance
 * 
 * @example
 * ```typescript
 * import { bootstrapForProduction } from '@/lib/decision-engine';
 * import { KafkaEventPublisher } from '@/lib/events/publishers/KafkaEventPublisher';
 * import { DatadogLogger } from '@/lib/logger/DatadogLogger';
 * 
 * const { engine } = bootstrapForProduction({
 *   eventPublisher: new KafkaEventPublisher(),
 *   logger: new DatadogLogger(),
 *   providers: [new RuleProvider(), new BIProvider()]
 * });
 * ```
 */
export function bootstrapForProduction(
  options: Required<Pick<BootstrapOptions, 'eventPublisher' | 'logger'>> &
    Partial<Pick<BootstrapOptions, 'providers'>>
): DecisionEngineInstance {
  return bootstrapDecisionEngine({
    ...options,
    debug: false,
  });
}

/**
 * Singleton instance (lazy initialization)
 */
let singletonInstance: DecisionEngineInstance | null = null;

/**
 * Get singleton Decision Engine instance
 * 
 * Useful for application-wide shared instance.
 * Lazy initialization on first call.
 * 
 * @param options - Bootstrap options (only used on first call)
 * @returns DecisionEngineInstance
 * 
 * @example
 * ```typescript
 * import { getDecisionEngine } from '@/lib/decision-engine';
 * 
 * // First call initializes
 * const { engine } = getDecisionEngine({ debug: true });
 * 
 * // Subsequent calls return same instance
 * const { engine: sameEngine } = getDecisionEngine();
 * ```
 */
export function getDecisionEngine(
  options?: BootstrapOptions
): DecisionEngineInstance {
  if (!singletonInstance) {
    singletonInstance = bootstrapDecisionEngine(options);
  }
  return singletonInstance;
}

/**
 * Reset singleton instance (for testing)
 * 
 * @example
 * ```typescript
 * import { resetDecisionEngine } from '@/lib/decision-engine';
 * 
 * afterEach(() => {
 *   resetDecisionEngine();
 * });
 * ```
 */
export function resetDecisionEngine(): void {
  singletonInstance = null;
}

/**
 * Create Decision Engine instance manually (advanced)
 * 
 * For full control over dependencies.
 * 
 * @param registry - Provider registry
 * @param eventPublisher - Event publisher
 * @param logger - Logger
 * @returns DecisionEngine
 * 
 * @example
 * ```typescript
 * import { createDecisionEngineManual } from '@/lib/decision-engine';
 * 
 * const registry = createProviderRegistry();
 * registry.register(new RuleProvider());
 * 
 * const engine = createDecisionEngineManual(
 *   registry,
 *   new InMemoryEventPublisher(),
 *   new ConsoleLogger()
 * );
 * ```
 */
export function createDecisionEngineManual(
  registry: DecisionProviderRegistry,
  eventPublisher: IEventPublisher,
  logger: ILogger
): DecisionEngine {
  return createDecisionEngine({
    registry,
    eventPublisher,
    logger,
  });
}

/**
 * Provider registration helper
 * 
 * Register provider to existing engine instance.
 * 
 * @param instance - Decision Engine instance
 * @param provider - Provider to register
 * 
 * @example
 * ```typescript
 * import { getDecisionEngine, registerProvider } from '@/lib/decision-engine';
 * import { MyCustomProvider } from './providers/MyCustomProvider';
 * 
 * const instance = getDecisionEngine();
 * registerProvider(instance, new MyCustomProvider());
 * ```
 */
export function registerProvider(
  instance: DecisionEngineInstance,
  provider: IDecisionProvider
): void {
  instance.registry.register(provider);

  instance.logger.info('Provider registered', {
    provider: provider.name,
    supportedRuleTypes: provider.supportedRuleTypes,
  });
}

/**
 * Subscribe to decision events helper
 * 
 * @param instance - Decision Engine instance
 * @param eventType - Event type to subscribe
 * @param handler - Event handler
 * 
 * @example
 * ```typescript
 * import { getDecisionEngine, subscribeToDecisions } from '@/lib/decision-engine';
 * 
 * const instance = getDecisionEngine();
 * 
 * subscribeToDecisions(instance, 'decision.evaluated', async (event) => {
 *   console.log('Decision made:', event.data.approved);
 *   await auditLog.save(event);
 * });
 * ```
 */
export function subscribeToDecisions(
  instance: DecisionEngineInstance,
  eventType: string,
  handler: (event: any) => void | Promise<void>
): void {
  instance.eventPublisher.subscribe(eventType, handler);

  instance.logger.debug('Event subscription added', {
    eventType,
  });
}
