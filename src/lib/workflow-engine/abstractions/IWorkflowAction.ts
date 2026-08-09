/**
 * Workflow Action Interface
 * 
 * Abstraction cho workflow actions. Cho phép mở rộng Workflow Engine với các
 * actions mới (Email, Webhook, Notification, Zalo, AI) mà không cần sửa Core.
 * 
 * @example
 * ```typescript
 * class EmailAction implements IWorkflowAction {
 *   readonly actionType = 'email';
 *   readonly version = '1.0.0';
 *   
 *   async execute(context: WorkflowContext) {
 *     await sendEmail(context.config);
 *     return { success: true };
 *   }
 *   
 *   validate(config: ActionConfig) {
 *     if (!config.to || !config.subject) {
 *       return { valid: false, errors: ['Missing required fields'] };
 *     }
 *     return { valid: true };
 *   }
 *   
 *   async rollback(context: WorkflowContext) {
 *     // Send cancellation email if needed
 *   }
 * }
 * ```
 */

/**
 * Workflow execution context passed to action
 */
export interface WorkflowContext {
  /** Unique workflow execution ID */
  executionId: string;
  
  /** Workflow definition ID */
  workflowId: string;
  
  /** Current step ID */
  stepId: string;
  
  /** Action configuration (type-specific) */
  config: ActionConfig;
  
  /** Input data for this action */
  input: Record<string, unknown>;
  
  /** Output data from previous steps */
  previousOutputs?: Record<string, unknown>;
  
  /** Tenant context */
  tenantId: string;
  
  /** User who triggered workflow */
  userId?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Action configuration structure
 */
export interface ActionConfig {
  /** Action type (must match IWorkflowAction.actionType) */
  actionType: string;
  
  /** Action-specific configuration */
  [key: string]: unknown;
}

/**
 * Action execution result
 */
export interface ActionResult {
  /** Whether action executed successfully */
  success: boolean;
  
  /** Output data from action (available to next steps) */
  output?: Record<string, unknown>;
  
  /** Error message if failed */
  error?: string;
  
  /** Whether action can be retried on failure */
  retryable?: boolean;
  
  /** Number of retry attempts made */
  retryCount?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Action configuration validation result
 */
export interface ActionValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  
  /** Validation errors (if invalid) */
  errors?: string[];
  
  /** Validation warnings (non-blocking) */
  warnings?: string[];
}

/**
 * Workflow Action Interface
 * 
 * Core abstraction for workflow actions. All workflow actions must implement
 * this interface.
 * 
 * Design principles:
 * - Idempotent: Actions should be safe to retry
 * - Async: All operations are async
 * - Rollback support: Actions should implement rollback when possible
 * - Type-safe: Strong typing with TypeScript
 * - Composable: Multiple actions can be chained in workflow
 */
export interface IWorkflowAction {
  /**
   * Unique action type identifier (e.g., 'email', 'webhook', 'notification')
   */
  readonly actionType: string;
  
  /**
   * Action version (semver format)
   */
  readonly version: string;
  
  /**
   * Action display name (optional, for UI)
   */
  readonly displayName?: string;
  
  /**
   * Action description (optional, for UI)
   */
  readonly description?: string;
  
  /**
   * Execute the workflow action
   * 
   * @param context - Workflow execution context
   * @returns Action result with success status and output
   * @throws Error if action fails critically (non-retryable)
   * 
   * @example
   * ```typescript
   * const result = await action.execute({
   *   executionId: 'exec-123',
   *   workflowId: 'wf-456',
   *   stepId: 'step-1',
   *   config: { to: 'user@example.com', subject: 'Hello' },
   *   input: { userName: 'John' },
   *   tenantId: 'tenant-1'
   * });
   * 
   * if (result.success) {
   *   console.log('Action completed:', result.output);
   * }
   * ```
   */
  execute(context: WorkflowContext): Promise<ActionResult>;
  
  /**
   * Validate action configuration before execution
   * 
   * @param config - Action configuration to validate
   * @returns Validation result with errors/warnings
   * 
   * @example
   * ```typescript
   * const validation = action.validate({
   *   actionType: 'email',
   *   to: 'user@example.com',
   *   subject: 'Hello'
   * });
   * 
   * if (!validation.valid) {
   *   console.error('Invalid config:', validation.errors);
   * }
   * ```
   */
  validate(config: ActionConfig): ActionValidationResult;
  
  /**
   * Rollback action if workflow fails
   * 
   * Optional: Not all actions can be rolled back (e.g., sent email).
   * If rollback is not possible, implementation should be a no-op.
   * 
   * @param context - Original workflow execution context
   * @returns void (throws on rollback failure)
   * 
   * @example
   * ```typescript
   * try {
   *   await action.rollback(context);
   *   console.log('Action rolled back successfully');
   * } catch (err: unknown) {
   *   console.error('Rollback failed:', err);
   * }
   * ```
   */
  rollback?(context: WorkflowContext): Promise<void>;
  
  /**
   * Get action configuration schema (optional, for UI)
   * 
   * Returns JSON Schema for action configuration.
   * Used by workflow designer UI for validation and auto-completion.
   * 
   * @returns JSON Schema object or undefined
   */
  getConfigSchema?(): Record<string, unknown>;
}

/**
 * Action registry for managing multiple workflow actions
 * 
 * @example
 * ```typescript
 * const registry = new WorkflowActionRegistry();
 * registry.register(new EmailAction());
 * registry.register(new WebhookAction());
 * registry.register(new NotificationAction());
 * 
 * const action = registry.getAction('email');
 * const result = await action.execute(context);
 * ```
 */
export class WorkflowActionRegistry {
  private actions: Map<string, IWorkflowAction> = new Map();
  
  /**
   * Register a new action
   * @throws Error if action with same type already exists
   */
  register(action: IWorkflowAction): void {
    if (this.actions.has(action.actionType)) {
      throw new Error(`Action '${action.actionType}' already registered`);
    }
    this.actions.set(action.actionType, action);
  }
  
  /**
   * Get action by type
   * @throws Error if action type not found
   */
  getAction(actionType: string): IWorkflowAction {
    const action = this.actions.get(actionType);
    if (!action) {
      throw new Error(`Action type not found: ${actionType}`);
    }
    return action;
  }
  
  /**
   * Check if action type is registered
   */
  hasAction(actionType: string): boolean {
    return this.actions.has(actionType);
  }
  
  /**
   * Get all registered actions
   */
  getAllActions(): IWorkflowAction[] {
    return Array.from(this.actions.values());
  }
  
  /**
   * Get all registered action types
   */
  getActionTypes(): string[] {
    return Array.from(this.actions.keys());
  }
}

/**
 * Helper function to create action config with type safety
 * 
 * @example
 * ```typescript
 * const emailConfig = createActionConfig<EmailActionConfig>({
 *   actionType: 'email',
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   body: 'Welcome!'
 * });
 * ```
 */
export function createActionConfig<T extends ActionConfig>(config: T): T {
  if (!config.actionType) {
    throw new Error('actionType is required');
  }
  return config;
}

/**
 * Helper function to create action result
 * 
 * @example
 * ```typescript
 * return createActionResult({
 *   success: true,
 *   output: { emailSent: true, messageId: '123' }
 * });
 * ```
 */
export function createActionResult(result: Partial<ActionResult>): ActionResult {
  return {
    success: result.success ?? false,
    output: result.output,
    error: result.error,
    retryable: result.retryable ?? false,
    retryCount: result.retryCount ?? 0,
    metadata: result.metadata
  };
}

/**
 * Base action class with common functionality
 * 
 * @example
 * ```typescript
 * class MyAction extends BaseWorkflowAction {
 *   readonly actionType = 'my-action';
 *   readonly version = '1.0.0';
 *   
 *   async execute(context: WorkflowContext) {
 *     // Implementation
 *     return this.success({ result: 'done' });
 *   }
 * }
 * ```
 */
export abstract class BaseWorkflowAction implements IWorkflowAction {
  abstract readonly actionType: string;
  abstract readonly version: string;
  readonly displayName?: string;
  readonly description?: string;
  
  abstract execute(context: WorkflowContext): Promise<ActionResult>;
  
  /**
   * Default validation: check if actionType matches
   */
  validate(config: ActionConfig): ActionValidationResult {
    if (config.actionType !== this.actionType) {
      return {
        valid: false,
        errors: [`Expected actionType '${this.actionType}', got '${config.actionType}'`]
      };
    }
    return { valid: true };
  }
  
  /**
   * Default rollback: no-op
   */
  async rollback(_context: WorkflowContext): Promise<void> {
    // No-op by default
  }
  
  /**
   * Helper: Create success result
   */
  protected success(output?: Record<string, unknown>, metadata?: Record<string, unknown>): ActionResult {
    return { success: true, output, metadata };
  }
  
  /**
   * Helper: Create failure result
   */
  protected failure(error: string, retryable = false, metadata?: Record<string, unknown>): ActionResult {
    return { success: false, error, retryable, metadata };
  }
}
