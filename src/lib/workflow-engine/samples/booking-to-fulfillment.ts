/**
 * Booking-to-Fulfillment Workflow
 * 
 * Real-world workflow demonstrating:
 * - Decision Engine integration (auto-approval check)
 * - Conditional branching (approved vs rejected)
 * - Action steps (reserve inventory, assign KTV)
 * - Parallel execution (send notifications)
 * 
 * Business Process:
 * 1. Check auto-approval eligibility (Decision Engine)
 * 2. If approved → Reserve inventory → Assign KTV → Send confirmations
 * 3. If rejected → Send pending approval notice
 */

import type { WorkflowDefinition } from '../types';
import { DecisionStep, ActionStep, ConditionStep, ParallelStep } from '../steps';
import type { IDecisionEngine } from '../steps/DecisionStep';

/**
 * Booking service interface (mock for demonstration)
 */
export interface IBookingService {
  finalize(params: {
    bookingId: string;
    status: string;
    reservationId: string;
    assignedKtvId: string;
  }): Promise<void>;
}

/**
 * Inventory service interface (mock for demonstration)
 */
export interface IInventoryService {
  reserve(params: {
    productIds: string[];
    sessionDate: string;
    tenantId: string;
  }): Promise<{ id: string }>;
}

/**
 * KTV service interface (mock for demonstration)
 */
export interface IKtvService {
  autoAssign(params: {
    sessionDate: string;
    serviceType: string;
    tenantId: string;
  }): Promise<{ ktvId: string }>;
}

/**
 * Notification service interface (mock for demonstration)
 */
export interface INotificationService {
  sendEmail(params: {
    to: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
  
  sendSMS(params: {
    to: string;
    message: string;
  }): Promise<void>;
}

/**
 * Create Booking-to-Fulfillment Workflow
 * 
 * @param decisionEngine - Decision Engine instance
 * @param services - Business services
 * @returns WorkflowDefinition
 */
export function createBookingToFulfillmentWorkflow(
  decisionEngine: IDecisionEngine,
  services: {
    inventory: IInventoryService;
    ktv: IKtvService;
    notification: INotificationService;
    booking: IBookingService;
  }
): WorkflowDefinition {
  return {
    id: 'booking-to-fulfillment-v1',
    version: '1.0.0',
    name: 'Booking to Fulfillment Workflow',
    description: 'Orchestrate booking creation, approval, inventory reservation, and KTV assignment',
    
    steps: [
      // Step 1: Check auto-approval eligibility (Decision Engine)
      new DecisionStep(
        'check-auto-approval',
        decisionEngine,
        {
          decisionType: 'auto-approval',
          ruleType: 'if-then',
          rule: {
            condition: {
              and: [
                { field: 'totalAmount', operator: '<', value: 5000000 },
                { field: 'customer.membershipTier', operator: '===', value: 'VIP' }
              ]
            },
            action: { approved: true }
          },
          outputKey: 'approvalResult'
        },
        'Check if booking qualifies for auto-approval based on amount and customer tier',
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoff: 'exponential'
        }
      ),

      // Step 2: Conditional branch based on approval result
      new ConditionStep(
        'approval-branch',
        (ctx) => {
          const result = ctx.data.approvalResult as unknown;
          return result?.outcome === 'APPROVE' || result?.approved === true;
        },
        'reserve-inventory',      // If approved
        'notify-pending-approval', // If not approved
        'Branch to fulfillment path if approved, otherwise notify pending approval'
      ),
      
      // Step 3a: Reserve inventory (Action)
      new ActionStep(
        'reserve-inventory',
        async (ctx) => {
          const booking = ctx.data.booking as unknown;
          
          const reservation = await services.inventory.reserve({
            productIds: booking.productIds,
            sessionDate: booking.sessionDate,
            tenantId: ctx.tenantId
          });
          
          return { reservationId: reservation.id };
        },
        'Reserve inventory for booking products',
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoff: 'exponential'
        },
        false, // Don't continue on error
        // Compensation: Release reservation if workflow fails
        async (ctx) => {
          // In real implementation, would call services.inventory.releaseReservation()
          console.log('Compensating: Release reservation', ctx.data.reservationId);
        }
      ),
      
      // Step 3b: Assign KTV (Action)
      new ActionStep(
        'assign-ktv',
        async (ctx) => {
          const booking = ctx.data.booking as unknown;
          
          const assignment = await services.ktv.autoAssign({
            sessionDate: booking.sessionDate,
            serviceType: booking.serviceType,
            tenantId: ctx.tenantId
          });
          
          return { assignedKtvId: assignment.ktvId };
        },
        'Auto-assign available KTV for the session',
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoff: 'exponential'
        }
      ),
      
      // Step 4: Send confirmation notifications in parallel
      new ParallelStep(
        'send-notifications',
        [
          new ActionStep(
            'notify-customer',
            async (ctx) => {
              const booking = ctx.data.booking as unknown;
              
              await services.notification.sendEmail({
                to: booking.customerEmail,
                template: 'booking-confirmed',
                data: {
                  bookingId: booking.id,
                  sessionDate: booking.sessionDate,
                  assignedKtvId: ctx.data.assignedKtvId
                }
              });
              
              return { customerNotified: true };
            },
            'Send booking confirmation email to customer'
          ),
          
          new ActionStep(
            'notify-ktv',
            async (ctx) => {
              await services.notification.sendSMS({
                to: ctx.data.assignedKtvId as string,
                message: `New booking assigned: ${(ctx.data.booking as unknown).id}`
              });
              
              return { ktvNotified: true };
            },
            'Send SMS notification to assigned KTV'
          )
        ],
        'allSettled', // Don't fail if one notification fails
        'Send confirmation notifications to customer and KTV in parallel'
      ),
      
      // Step 5: Finalize booking (Action)
      new ActionStep(
        'finalize-booking',
        async (ctx) => {
          const booking = ctx.data.booking as unknown;
          
          await services.booking.finalize({
            bookingId: booking.id,
            status: 'confirmed',
            reservationId: ctx.data.reservationId as string,
            assignedKtvId: ctx.data.assignedKtvId as string
          });
          
          return { bookingFinalized: true };
        },
        'Mark booking as confirmed and finalized'
      ),
      
      // Step 3c (alternative branch): Notify pending approval
      new ActionStep(
        'notify-pending-approval',
        async (ctx) => {
          const booking = ctx.data.booking as unknown;
          
          await services.notification.sendEmail({
            to: booking.customerEmail,
            template: 'booking-pending-approval',
            data: {
              bookingId: booking.id,
              reason: (ctx.data.approvalResult as unknown)?.explanation ?? 'Requires manager approval'
            }
          });
          
          return {
            notificationSent: true,
            _control: { skipRemaining: true } // Skip remaining steps
          };
        },
        'Send pending approval notification to customer'
      )
    ],
    
    defaultRetryPolicy: {
      maxAttempts: 3,
      delayMs: 1000
    },
    
    timeout: 60000, // 1 minute
    
    metadata: {
      category: 'booking',
      author: 'Bella ERP Team',
      version: '1.0.0'
    }
  };
}

/**
 * Example usage:
 * 
 * ```typescript
 * const workflow = createBookingToFulfillmentWorkflow(decisionEngine, services);
 * 
 * const result = await workflowEngine.execute(workflow, {
 *   tenantId: 'bella-spa-vietnam',
 *   userId: 'customer-123',
 *   data: {
 *     booking: {
 *       id: 'booking-456',
 *       customerId: 'customer-123',
 *       totalAmount: 3500000,
 *       productIds: ['prod-1', 'prod-2'],
 *       sessionDate: '2026-07-15',
 *       serviceType: 'massage',
 *       customerEmail: 'customer@example.com'
 *     },
 *     customer: {
 *       membershipTier: 'VIP'
 *     }
 *   }
 * });
 * 
 * if (result.status === 'completed') {
 *   console.log('Booking fulfilled:', result.output);
 * }
 * ```
 */
