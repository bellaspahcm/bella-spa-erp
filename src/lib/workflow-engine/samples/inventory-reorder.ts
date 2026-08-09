/**
 * Inventory Reorder Workflow
 * 
 * Real-world workflow demonstrating:
 * - Decision Engine for reorder evaluation
 * - Conditional branching (reorder vs skip)
 * - Action steps with compensation
 * - Audit trail for compliance
 * 
 * Business Process:
 * 1. Fetch current inventory levels
 * 2. Evaluate reorder decision (Decision Engine)
 * 3. If reorder needed → Create PO → Notify supplier → Update inventory → Audit
 * 4. If not needed → Skip reorder steps
 */

import type { WorkflowDefinition } from '../types';
import { DecisionStep, ActionStep, ConditionStep } from '../steps';
import type { IDecisionEngine } from '../steps/DecisionStep';

/**
 * Inventory service interface (mock for demonstration)
 */
export interface IInventoryService {
  getByProduct(productId: string): Promise<{ quantity: number }>;
  
  updateExpectedStock(params: {
    productId: string;
    expectedQuantity: number;
    expectedDate: string;
  }): Promise<void>;
}

/**
 * Purchase order service interface (mock for demonstration)
 */
export interface IPurchaseOrderService {
  create(params: {
    productId: string;
    quantity: number;
    supplierId: string;
  }): Promise<{ id: string }>;
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
}

/**
 * Audit service interface (mock for demonstration)
 */
export interface IAuditService {
  log(params: {
    action: string;
    productId: string;
    quantity: number;
    reason: string;
  }): Promise<void>;
}

/**
 * Create Inventory Reorder Workflow
 * 
 * @param decisionEngine - Decision Engine instance
 * @param services - Business services
 * @returns WorkflowDefinition
 */
export function createInventoryReorderWorkflow(
  decisionEngine: IDecisionEngine,
  services: {
    inventory: IInventoryService;
    purchaseOrder: IPurchaseOrderService;
    notification: INotificationService;
    audit: IAuditService;
  }
): WorkflowDefinition {
  return {
    id: 'inventory-reorder-v1',
    version: '1.0.0',
    name: 'Inventory Reorder Workflow',
    description: 'Evaluate inventory levels and automatically reorder when needed',
    
    steps: [
      // Step 1: Fetch current inventory
      new ActionStep(
        'fetch-inventory',
        async (ctx) => {
          const productId = ctx.data.productId as string;
          const inventory = await services.inventory.getByProduct(productId);
          
          return { currentStock: inventory.quantity };
        },
        'Fetch current inventory quantity for product',
        {
          maxAttempts: 3,
          delayMs: 1000,
          backoff: 'exponential'
        }
      ),
      
      // Step 2: Evaluate reorder decision (Decision Engine)
      new DecisionStep(
        'evaluate-reorder',
        decisionEngine,
        {
          decisionType: 'inventory-reorder',
          ruleType: 'if-then',
          rule: {
            condition: {
              and: [
                { field: 'currentStock', operator: '<', value: 50 },
                { field: 'demandForecast', operator: '>', value: 100 }
              ]
            },
            action: {
              reorder: true,
              quantity: { formula: 'demandForecast * 1.2 - currentStock' }
            }
          },
          outputKey: 'reorderDecision',
          module: 'inventory'
        },
        'Evaluate if reorder is needed based on stock level and demand forecast',
        {
          maxAttempts: 2,
          delayMs: 1000
        }
      ),

      // Step 3: Conditional branch based on reorder decision
      new ConditionStep(
        'reorder-branch',
        (ctx) => {
          const decision = ctx.data.reorderDecision as unknown;
          return decision?.outcome === 'APPROVE' || decision?.reorder === true;
        },
        'create-purchase-order', // If reorder needed
        'skip-reorder',          // If not needed
        'Branch to reorder path if needed, otherwise skip'
      ),
      
      // Step 4: Create purchase order (Action)
      new ActionStep(
        'create-purchase-order',
        async (ctx) => {
          const decision = ctx.data.reorderDecision as unknown;
          
          const po = await services.purchaseOrder.create({
            productId: ctx.data.productId as string,
            quantity: decision.quantity,
            supplierId: ctx.data.supplierId as string
          });
          
          return {
            purchaseOrderId: po.id,
            orderQuantity: decision.quantity
          };
        },
        'Create purchase order for reorder quantity',
        {
          maxAttempts: 3,
          delayMs: 2000,
          backoff: 'exponential'
        },
        false, // Don't continue on error
        // Compensation: Cancel purchase order if workflow fails
        async (ctx) => {
          // In real implementation, would call purchaseOrder.cancel()
          console.log('Compensating: Cancel PO', ctx.data.purchaseOrderId);
        }
      ),
      
      // Step 5: Notify supplier (Action)
      new ActionStep(
        'notify-supplier',
        async (ctx) => {
          await services.notification.sendEmail({
            to: ctx.data.supplierEmail as string,
            template: 'purchase-order-created',
            data: {
              poId: ctx.data.purchaseOrderId,
              productId: ctx.data.productId,
              quantity: ctx.data.orderQuantity
            }
          });
          
          return { supplierNotified: true };
        },
        'Send purchase order notification to supplier',
        {
          maxAttempts: 2,
          delayMs: 1000
        },
        true // Continue on error (notification failure shouldn't block workflow)
      ),
      
      // Step 6: Update expected inventory (Action)
      new ActionStep(
        'update-expected-inventory',
        async (ctx) => {
          await services.inventory.updateExpectedStock({
            productId: ctx.data.productId as string,
            expectedQuantity: ctx.data.orderQuantity as number,
            expectedDate: ctx.data.expectedDeliveryDate as string
          });
          
          return { inventoryUpdated: true };
        },
        'Update expected stock levels in inventory system'
      ),
      
      // Step 7: Audit log (Action)
      new ActionStep(
        'audit-reorder',
        async (ctx) => {
          const decision = ctx.data.reorderDecision as unknown;
          
          await services.audit.log({
            action: 'inventory-reorder',
            productId: ctx.data.productId as string,
            quantity: ctx.data.orderQuantity as number,
            reason: decision.explanation ?? 'Automated reorder based on stock level and demand'
          });
          
          return { auditLogged: true };
        },
        'Create audit trail for reorder action'
      ),
      
      // Step 3b (alternative branch): Skip reorder
      new ActionStep(
        'skip-reorder',
        async (ctx) => {
          const decision = ctx.data.reorderDecision as unknown;
          
          await services.audit.log({
            action: 'inventory-reorder-skipped',
            productId: ctx.data.productId as string,
            quantity: 0,
            reason: decision.explanation ?? 'Stock level sufficient, no reorder needed'
          });
          
          return {
            reorderSkipped: true,
            _control: { skipRemaining: true } // Skip remaining steps
          };
        },
        'Log that reorder was skipped and end workflow'
      )
    ],
    
    defaultRetryPolicy: {
      maxAttempts: 3,
      delayMs: 2000,
      backoff: 'exponential'
    },
    
    timeout: 120000, // 2 minutes
    
    metadata: {
      category: 'inventory',
      author: 'Bella ERP Team',
      automationLevel: 'full'
    }
  };
}

/**
 * Example usage:
 * 
 * ```typescript
 * const workflow = createInventoryReorderWorkflow(decisionEngine, services);
 * 
 * const result = await workflowEngine.execute(workflow, {
 *   tenantId: 'bella-spa-vietnam',
 *   userId: 'inventory-manager-123',
 *   data: {
 *     productId: 'prod-001',
 *     supplierId: 'supplier-456',
 *     supplierEmail: 'supplier@example.com',
 *     demandForecast: 150,
 *     expectedDeliveryDate: '2026-07-20'
 *   }
 * });
 * 
 * if (result.status === 'completed') {
 *   if (result.output.purchaseOrderId) {
 *     console.log('Reorder completed. PO:', result.output.purchaseOrderId);
 *   } else {
 *     console.log('Reorder skipped. Stock level sufficient.');
 *   }
 * }
 * ```
 */
