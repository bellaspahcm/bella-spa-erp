/**
 * Extension Registry
 * 
 * Central registry for all extension points trong Bella ERP.
 * Provides type-safe registration và resolution cho:
 * - Decision Providers
 * - Workflow Actions
 * - Event Publishers
 * - Integration Adapters
 * 
 * @example
 * ```typescript
 * import { extensionRegistry } from '@/lib/di/ExtensionRegistry';
 * 
 * // Register extensions
 * extensionRegistry.registerDecisionProvider(new RuleProvider());
 * extensionRegistry.registerWorkflowAction(new EmailAction(config));
 * extensionRegistry.registerEventPublisher(new InMemoryEventPublisher());
 * extensionRegistry.registerIntegrationAdapter(new ZaloAdapter(config));
 * 
 * // Resolve extensions
 * const provider = extensionRegistry.getDecisionProvider('rule');
 * const action = extensionRegistry.getWorkflowAction('email');
 * const publisher = extensionRegistry.getEventPublisher('in-memory');
 * const adapter = extensionRegistry.getIntegrationAdapter('zalo');
 * ```
 */

import type { IDecisionProvider } from '../decision-engine/abstractions/IDecisionProvider';
import type { IWorkflowAction } from '../workflow-engine/abstractions/IWorkflowAction';
import type { IEventPublisher } from '../events/abstractions/IEventPublisher';
import type { IIntegrationAdapter } from '../integrations/abstractions/IIntegrationAdapter';

/**
 * Extension Registry Class
 * 
 * Manages all extension point registrations.
 * Thread-safe, singleton pattern.
 */
export class ExtensionRegistry {
  private decisionProviders: Map<string, IDecisionProvider> = new Map();
  private workflowActions: Map<string, IWorkflowAction> = new Map();
  private eventPublishers: Map<string, IEventPublisher> = new Map();
  private integrationAdapters: Map<string, IIntegrationAdapter> = new Map();
  
  private defaultEventPublisher?: IEventPublisher;
  
  // ========================================
  // Decision Provider Registry
  // ========================================
  
  /**
   * Register a decision provider
   * 
   * @param provider - Decision provider implementation
   * @throws Error if provider with same name already registered
   * 
   * @example
   * ```typescript
   * extensionRegistry.registerDecisionProvider(new RuleProvider());
   * extensionRegistry.registerDecisionProvider(new AIProvider());
   * ```
   */
  registerDecisionProvider(provider: IDecisionProvider): void {
    if (this.decisionProviders.has(provider.name)) {
      throw new Error(`Decision provider '${provider.name}' is already registered`);
    }
    this.decisionProviders.set(provider.name, provider);
  }
  
  /**
   * Get decision provider by name
   * 
   * @param name - Provider name
   * @returns Decision provider instance
   * @throws Error if provider not found
   */
  getDecisionProvider(name: string): IDecisionProvider {
    const provider = this.decisionProviders.get(name);
    if (!provider) {
      throw new Error(`Decision provider not found: ${name}`);
    }
    return provider;
  }
  
  /**
   * Get all registered decision providers
   */
  getAllDecisionProviders(): IDecisionProvider[] {
    return Array.from(this.decisionProviders.values());
  }
  
  /**
   * Check if decision provider is registered
   */
  hasDecisionProvider(name: string): boolean {
    return this.decisionProviders.has(name);
  }
  
  // ========================================
  // Workflow Action Registry
  // ========================================
  
  /**
   * Register a workflow action
   * 
   * @param action - Workflow action implementation
   * @throws Error if action with same type already registered
   * 
   * @example
   * ```typescript
   * extensionRegistry.registerWorkflowAction(new EmailAction(config));
   * extensionRegistry.registerWorkflowAction(new WebhookAction());
   * ```
   */
  registerWorkflowAction(action: IWorkflowAction): void {
    if (this.workflowActions.has(action.actionType)) {
      throw new Error(`Workflow action '${action.actionType}' is already registered`);
    }
    this.workflowActions.set(action.actionType, action);
  }
  
  /**
   * Get workflow action by type
   * 
   * @param actionType - Action type (e.g., 'email', 'webhook')
   * @returns Workflow action instance
   * @throws Error if action not found
   */
  getWorkflowAction(actionType: string): IWorkflowAction {
    const action = this.workflowActions.get(actionType);
    if (!action) {
      throw new Error(`Workflow action not found: ${actionType}`);
    }
    return action;
  }
  
  /**
   * Get all registered workflow actions
   */
  getAllWorkflowActions(): IWorkflowAction[] {
    return Array.from(this.workflowActions.values());
  }
  
  /**
   * Check if workflow action is registered
   */
  hasWorkflowAction(actionType: string): boolean {
    return this.workflowActions.has(actionType);
  }
  
  // ========================================
  // Event Publisher Registry
  // ========================================
  
  /**
   * Register an event publisher
   * 
   * @param publisher - Event publisher implementation
   * @param setAsDefault - Set as default publisher (optional)
   * @throws Error if publisher with same name already registered
   * 
   * @example
   * ```typescript
   * extensionRegistry.registerEventPublisher(new InMemoryEventPublisher(), true);
   * extensionRegistry.registerEventPublisher(new RedisEventPublisher());
   * ```
   */
  registerEventPublisher(publisher: IEventPublisher, setAsDefault = false): void {
    if (this.eventPublishers.has(publisher.name)) {
      throw new Error(`Event publisher '${publisher.name}' is already registered`);
    }
    this.eventPublishers.set(publisher.name, publisher);
    
    // Set as default if requested or if it's the first publisher
    if (setAsDefault || this.eventPublishers.size === 1) {
      this.defaultEventPublisher = publisher;
    }
  }
  
  /**
   * Get event publisher by name
   * 
   * @param name - Publisher name
   * @returns Event publisher instance
   * @throws Error if publisher not found
   */
  getEventPublisher(name: string): IEventPublisher {
    const publisher = this.eventPublishers.get(name);
    if (!publisher) {
      throw new Error(`Event publisher not found: ${name}`);
    }
    return publisher;
  }
  
  /**
   * Get default event publisher
   * 
   * @returns Default event publisher
   * @throws Error if no default publisher set
   */
  getDefaultEventPublisher(): IEventPublisher {
    if (!this.defaultEventPublisher) {
      throw new Error('No default event publisher set');
    }
    return this.defaultEventPublisher;
  }
  
  /**
   * Get all registered event publishers
   */
  getAllEventPublishers(): IEventPublisher[] {
    return Array.from(this.eventPublishers.values());
  }
  
  /**
   * Check if event publisher is registered
   */
  hasEventPublisher(name: string): boolean {
    return this.eventPublishers.has(name);
  }
  
  // ========================================
  // Integration Adapter Registry
  // ========================================
  
  /**
   * Register an integration adapter
   * 
   * @param adapter - Integration adapter implementation
   * @throws Error if adapter with same provider already registered
   * 
   * @example
   * ```typescript
   * extensionRegistry.registerIntegrationAdapter(new ZaloAdapter(config));
   * extensionRegistry.registerIntegrationAdapter(new MetaAdapter(config));
   * ```
   */
  registerIntegrationAdapter(adapter: IIntegrationAdapter): void {
    if (this.integrationAdapters.has(adapter.provider)) {
      throw new Error(`Integration adapter '${adapter.provider}' is already registered`);
    }
    this.integrationAdapters.set(adapter.provider, adapter);
  }
  
  /**
   * Get integration adapter by provider
   * 
   * @param provider - Provider name (e.g., 'zalo', 'meta')
   * @returns Integration adapter instance
   * @throws Error if adapter not found
   */
  getIntegrationAdapter(provider: string): IIntegrationAdapter {
    const adapter = this.integrationAdapters.get(provider);
    if (!adapter) {
      throw new Error(`Integration adapter not found: ${provider}`);
    }
    return adapter;
  }
  
  /**
   * Get all registered integration adapters
   */
  getAllIntegrationAdapters(): IIntegrationAdapter[] {
    return Array.from(this.integrationAdapters.values());
  }
  
  /**
   * Check if integration adapter is registered
   */
  hasIntegrationAdapter(provider: string): boolean {
    return this.integrationAdapters.has(provider);
  }
  
  // ========================================
  // Lifecycle Management
  // ========================================
  
  /**
   * Dispose all registered extensions
   * 
   * Calls close()/dispose() on all extensions that support cleanup.
   * Should be called on application shutdown.
   * 
   * @example
   * ```typescript
   * // On application shutdown
   * process.on('SIGTERM', async () => {
   *   await extensionRegistry.dispose();
   * });
   * ```
   */
  async dispose(): Promise<void> {
    // Close all event publishers
    await Promise.all(
      Array.from(this.eventPublishers.values()).map(p => p.close())
    );
    
    // Dispose integration adapters if they have dispose method
    for (const adapter of this.integrationAdapters.values()) {
      const disposable = adapter as unknown as { dispose?: () => Promise<void> };
      if (typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    }
    
    // Clear all registrations
    this.decisionProviders.clear();
    this.workflowActions.clear();
    this.eventPublishers.clear();
    this.integrationAdapters.clear();
    this.defaultEventPublisher = undefined;
  }
  
  /**
   * Get registry statistics
   * 
   * @returns Statistics object with counts
   */
  getStats(): {
    decisionProviders: number;
    workflowActions: number;
    eventPublishers: number;
    integrationAdapters: number;
  } {
    return {
      decisionProviders: this.decisionProviders.size,
      workflowActions: this.workflowActions.size,
      eventPublishers: this.eventPublishers.size,
      integrationAdapters: this.integrationAdapters.size
    };
  }
}

/**
 * Global extension registry instance
 * 
 * Use this for application-wide extension registration.
 * 
 * @example
 * ```typescript
 * // In app initialization
 * import { extensionRegistry } from '@/lib/di/ExtensionRegistry';
 * import { RuleProvider } from '@/lib/decision-engine/providers/RuleProvider';
 * import { EmailAction } from '@/lib/workflow-engine/actions/EmailAction';
 * 
 * extensionRegistry.registerDecisionProvider(new RuleProvider());
 * extensionRegistry.registerWorkflowAction(new EmailAction(emailConfig));
 * 
 * // In business logic
 * const provider = extensionRegistry.getDecisionProvider('rule');
 * const action = extensionRegistry.getWorkflowAction('email');
 * ```
 */
export const extensionRegistry = new ExtensionRegistry();
