/**
 * Action Step
 * 
 * Executes business logic or side-effect operations (e.g., send email, update database,
 * call external API).
 * 
 * @example
 * ```typescript
 * const sendEmailStep = new ActionStep(
 *   'send-confirmation',
 *   async (context) => {
 *     await emailService.send({
 *       to: context.data.customerEmail,
 *       subject: 'Booking Confirmed',
 *       template: 'booking-confirmation'
 *     });
 *     return { emailSent: true };
 *   }
 * );
 * ```
 */

import type { IStep, WorkflowContext, StepOutput } from '../types';

/**
 * Action handler function type
 */
export type ActionHandler = (context: WorkflowContext) => Promise<StepOutput>;

/**
 * Compensation handler function type (for rollback)
 */
export type CompensationHandler = (context: WorkflowContext) => Promise<void>;

/**
 * Action Step Implementation
 * 
 * Executes arbitrary business logic provided by the handler function.
 * Supports compensation for rollback scenarios.
 */
export class ActionStep implements IStep {
  readonly type = 'action' as const;
  
  constructor(
    public readonly name: string,
    private readonly handler: ActionHandler,
    public readonly description?: string,
    public readonly retryPolicy?: {
      maxAttempts: number;
      delayMs: number;
      backoff?: 'linear' | 'exponential';
      maxDelayMs?: number;
    },
    public readonly continueOnError?: boolean,
    private readonly compensationHandler?: CompensationHandler
  ) {}
  
  async execute(context: WorkflowContext): Promise<StepOutput> {
    // Execute the action handler
    return this.handler(context);
  }
  
  /**
   * Compensation logic (rollback)
   */
  async compensate(context: WorkflowContext): Promise<void> {
    if (this.compensationHandler) {
      await this.compensationHandler(context);
    }
    // If no compensation handler provided, no-op
  }
}

/**
 * Helper function to create ActionStep with type safety
 * 
 * @example
 * ```typescript
 * const step = createActionStep({
 *   name: 'reserve-inventory',
 *   handler: async (ctx) => {
 *     const reservation = await inventoryService.reserve(ctx.data.productIds);
 *     return { reservationId: reservation.id };
 *   },
 *   compensationHandler: async (ctx) => {
 *     await inventoryService.releaseReservation(ctx.data.reservationId);
 *   }
 * });
 * ```
 */
export function createActionStep(params: {
  name: string;
  handler: ActionHandler;
  description?: string;
  retryPolicy?: ActionStep['retryPolicy'];
  continueOnError?: boolean;
  compensationHandler?: CompensationHandler;
}): ActionStep {
  return new ActionStep(
    params.name,
    params.handler,
    params.description,
    params.retryPolicy,
    params.continueOnError,
    params.compensationHandler
  );
}
