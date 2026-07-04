/**
 * Decision Engine Platform - DecisionProviderRegistry
 * 
 * Provider selector and manager. Stores registered providers and selects
 * appropriate provider based on DecisionContext.ruleType.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6
 */

import type {
  IDecisionProvider,
  IDecisionProviderMetadata,
  ProviderRegistrationOptions,
} from '../abstractions';

/**
 * Provider registration entry (internal)
 */
interface ProviderEntry {
  provider: IDecisionProvider;
  ruleTypes: string[];
  priority: number;
  metadata?: IDecisionProviderMetadata;
}

/**
 * Provider conflict error
 */
export class ProviderConflictError extends Error {
  constructor(
    ruleType: string,
    existingProvider: string,
    newProvider: string
  ) {
    super(
      `Provider conflict: Rule type "${ruleType}" is already handled by "${existingProvider}". ` +
        `Cannot register "${newProvider}" for the same rule type.`
    );
    this.name = 'ProviderConflictError';
  }
}

/**
 * Provider not found error
 */
export class ProviderNotFoundError extends Error {
  constructor(ruleType: string) {
    super(
      `No provider found for rule type: "${ruleType}". ` +
        `Make sure a provider supporting this rule type is registered.`
    );
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * DecisionProviderRegistry - Provider selector and manager
 * 
 * Responsibilities:
 * 1. Store registered providers
 * 2. Select provider based on ruleType
 * 3. Validate provider registration (detect conflicts)
 * 4. Support provider discovery (list, inspect)
 * 
 * Design Principles:
 * 1. First registered wins (if same rule type)
 * 2. Providers are immutable after registration
 * 3. Registry is thread-safe (no concurrent modification)
 * 4. Registry validates provider on registration
 * 
 * @example Basic Usage
 * ```typescript
 * const registry = new DecisionProviderRegistry();
 * 
 * // Register providers
 * registry.register(new RuleProvider());
 * registry.register(new BIProvider());
 * 
 * // Get provider for rule type
 * const provider = registry.getProvider('if-then');
 * 
 * // List all providers
 * const providerNames = registry.listProviders();
 * ```
 * 
 * @example Advanced Registration with Options
 * ```typescript
 * const registry = new DecisionProviderRegistry();
 * 
 * registry.register(new RuleProvider(), {
 *   priority: 10,
 *   metadata: {
 *     description: 'Rule-based decision provider',
 *     version: '1.0.0'
 *   }
 * });
 * ```
 */
export class DecisionProviderRegistry {
  /**
   * Map: ruleType -> ProviderEntry
   * @private
   */
  private readonly ruleTypeToProvider = new Map<string, ProviderEntry>();

  /**
   * Map: providerName -> ProviderEntry
   * @private
   */
  private readonly nameToProvider = new Map<string, ProviderEntry>();

  /**
   * Register a decision provider
   * 
   * Validates provider and registers it for all supported rule types.
   * Throws error if there's a conflict (same rule type already registered).
   * 
   * @param provider - Provider instance to register
   * @param options - Registration options (optional)
   * @throws ProviderConflictError - If rule type conflict detected
   * @throws Error - If provider validation fails
   * 
   * @example
   * ```typescript
   * const registry = new DecisionProviderRegistry();
   * const ruleProvider = new RuleProvider();
   * 
   * registry.register(ruleProvider);
   * ```
   * 
   * @example With Options
   * ```typescript
   * registry.register(new BIProvider(), {
   *   priority: 20,
   *   metadata: {
   *     description: 'Business Intelligence provider',
   *     version: '2.0.0'
   *   }
   * });
   * ```
   */
  register(
    provider: IDecisionProvider,
    options?: Partial<ProviderRegistrationOptions>
  ): void {
    // Validate provider
    this.validateProvider(provider);

    // Determine rule types (from provider or options)
    const ruleTypes =
      options?.overrideRuleTypes || provider.supportedRuleTypes;

    if (!ruleTypes || ruleTypes.length === 0) {
      throw new Error(
        `Provider "${provider.name}" has no supported rule types. ` +
          `Provide supportedRuleTypes or overrideRuleTypes.`
      );
    }

    // Check for conflicts
    for (const ruleType of ruleTypes) {
      const existing = this.ruleTypeToProvider.get(ruleType);
      if (existing) {
        // Check priority (higher priority wins)
        const newPriority = options?.priority ?? 0;
        if (newPriority <= existing.priority) {
          throw new ProviderConflictError(
            ruleType,
            existing.provider.name,
            provider.name
          );
        }
        // Higher priority - will override
      }
    }

    // Check for duplicate provider name
    if (this.nameToProvider.has(provider.name)) {
      throw new Error(
        `Provider with name "${provider.name}" is already registered. ` +
          `Provider names must be unique.`
      );
    }

    // Create provider entry
    const entry: ProviderEntry = {
      provider,
      ruleTypes,
      priority: options?.priority ?? 0,
      metadata: options?.metadata,
    };

    // Register provider for each rule type
    for (const ruleType of ruleTypes) {
      this.ruleTypeToProvider.set(ruleType, entry);
    }

    // Register by name
    this.nameToProvider.set(provider.name, entry);
  }

  /**
   * Get provider by rule type
   * 
   * Returns provider that supports the given rule type, or undefined if not found.
   * 
   * @param ruleType - Rule type to look up
   * @returns Provider instance or undefined
   * 
   * @example
   * ```typescript
   * const provider = registry.getProvider('if-then');
   * 
   * if (provider) {
   *   const result = await provider.evaluate(context);
   * }
   * ```
   */
  getProvider(ruleType: string): IDecisionProvider | undefined {
    const entry = this.ruleTypeToProvider.get(ruleType);
    return entry?.provider;
  }

  /**
   * Get provider by rule type (throws if not found)
   * 
   * Same as getProvider(), but throws ProviderNotFoundError if provider not found.
   * Useful when provider is required.
   * 
   * @param ruleType - Rule type to look up
   * @returns Provider instance
   * @throws ProviderNotFoundError - If no provider found for rule type
   * 
   * @example
   * ```typescript
   * try {
   *   const provider = registry.getProviderOrThrow('if-then');
   *   const result = await provider.evaluate(context);
   * } catch (error) {
   *   if (error instanceof ProviderNotFoundError) {
   *     // Handle missing provider
   *   }
   * }
   * ```
   */
  getProviderOrThrow(ruleType: string): IDecisionProvider {
    const provider = this.getProvider(ruleType);
    if (!provider) {
      throw new ProviderNotFoundError(ruleType);
    }
    return provider;
  }

  /**
   * Get provider by name
   * 
   * @param name - Provider name
   * @returns Provider instance or undefined
   * 
   * @example
   * ```typescript
   * const provider = registry.getProviderByName('RuleProvider');
   * ```
   */
  getProviderByName(name: string): IDecisionProvider | undefined {
    const entry = this.nameToProvider.get(name);
    return entry?.provider;
  }

  /**
   * Check if rule type is supported
   * 
   * @param ruleType - Rule type to check
   * @returns True if a provider supports this rule type
   * 
   * @example
   * ```typescript
   * if (registry.hasProvider('if-then')) {
   *   // Can evaluate if-then rules
   * }
   * ```
   */
  hasProvider(ruleType: string): boolean {
    return this.ruleTypeToProvider.has(ruleType);
  }

  /**
   * List all registered providers
   * 
   * Returns array of unique provider names.
   * 
   * @returns Array of provider names
   * 
   * @example
   * ```typescript
   * const providers = registry.listProviders();
   * // ['RuleProvider', 'BIProvider', 'AIProvider']
   * ```
   */
  listProviders(): string[] {
    return Array.from(this.nameToProvider.keys());
  }

  /**
   * List all supported rule types
   * 
   * Returns array of all rule types supported by registered providers.
   * 
   * @returns Array of rule types
   * 
   * @example
   * ```typescript
   * const ruleTypes = registry.listRuleTypes();
   * // ['if-then', 'decision-table', 'bi-query', 'ml-model']
   * ```
   */
  listRuleTypes(): string[] {
    return Array.from(this.ruleTypeToProvider.keys());
  }

  /**
   * Get provider metadata
   * 
   * @param providerName - Provider name
   * @returns Provider metadata or undefined
   * 
   * @example
   * ```typescript
   * const metadata = registry.getProviderMetadata('RuleProvider');
   * console.log(metadata?.description);
   * console.log(metadata?.version);
   * ```
   */
  getProviderMetadata(
    providerName: string
  ): IDecisionProviderMetadata | undefined {
    const entry = this.nameToProvider.get(providerName);
    return entry?.metadata;
  }

  /**
   * Get provider info (for debugging/documentation)
   * 
   * @param providerName - Provider name
   * @returns Provider info object
   * 
   * @example
   * ```typescript
   * const info = registry.getProviderInfo('RuleProvider');
   * console.log(info?.supportedRuleTypes);
   * console.log(info?.priority);
   * ```
   */
  getProviderInfo(providerName: string): {
    name: string;
    supportedRuleTypes: string[];
    priority: number;
    metadata?: IDecisionProviderMetadata;
  } | undefined {
    const entry = this.nameToProvider.get(providerName);
    if (!entry) return undefined;

    return {
      name: entry.provider.name,
      supportedRuleTypes: entry.ruleTypes,
      priority: entry.priority,
      metadata: entry.metadata,
    };
  }

  /**
   * Clear all registered providers
   * 
   * Useful for testing or hot-reload scenarios.
   * 
   * @example
   * ```typescript
   * registry.clear();
   * registry.register(new RuleProviderV2()); // Register new version
   * ```
   */
  clear(): void {
    this.ruleTypeToProvider.clear();
    this.nameToProvider.clear();
  }

  /**
   * Get registry statistics
   * 
   * @returns Registry statistics
   * 
   * @example
   * ```typescript
   * const stats = registry.getStats();
   * console.log(`Providers: ${stats.providerCount}`);
   * console.log(`Rule types: ${stats.ruleTypeCount}`);
   * ```
   */
  getStats(): {
    providerCount: number;
    ruleTypeCount: number;
    providers: Array<{
      name: string;
      ruleTypes: string[];
    }>;
  } {
    return {
      providerCount: this.nameToProvider.size,
      ruleTypeCount: this.ruleTypeToProvider.size,
      providers: Array.from(this.nameToProvider.values()).map((entry) => ({
        name: entry.provider.name,
        ruleTypes: entry.ruleTypes,
      })),
    };
  }

  /**
   * Validate provider (internal)
   * 
   * @private
   */
  private validateProvider(provider: IDecisionProvider): void {
    if (!provider) {
      throw new Error('Provider is required');
    }

    if (!provider.name) {
      throw new Error('Provider must have a name');
    }

    if (typeof provider.evaluate !== 'function') {
      throw new Error(`Provider "${provider.name}" must implement evaluate()`);
    }

    if (typeof provider.canHandle !== 'function') {
      throw new Error(
        `Provider "${provider.name}" must implement canHandle()`
      );
    }

    if (!Array.isArray(provider.supportedRuleTypes)) {
      throw new Error(
        `Provider "${provider.name}" supportedRuleTypes must be an array`
      );
    }
  }
}

/**
 * Create a new provider registry instance
 * 
 * Factory function for convenience.
 * 
 * @returns New DecisionProviderRegistry instance
 * 
 * @example
 * ```typescript
 * import { createProviderRegistry } from '@/lib/decision-engine';
 * 
 * const registry = createProviderRegistry();
 * registry.register(new RuleProvider());
 * ```
 */
export function createProviderRegistry(): DecisionProviderRegistry {
  return new DecisionProviderRegistry();
}
