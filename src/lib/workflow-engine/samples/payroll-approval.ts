/**
 * Payroll Approval Workflow
 * 
 * Real-world workflow demonstrating:
 * - Multiple Decision Engine calls (KPI, deductions, commission)
 * - Parallel decision evaluation
 * - Human-in-the-loop approvals (pause/resume)
 * - State management across long-running processes
 * 
 * Business Process:
 * 1. Calculate salary components (KPI, deductions, commission) in parallel
 * 2. Aggregate total salary
 * 3. Manager approval (pause workflow)
 * 4. Finance review (pause workflow)
 * 5. Publish salary record
 * 6. Generate accounting expense entry
 */

import type { WorkflowDefinition } from '../types';
import { DecisionStep, ActionStep, ParallelStep } from '../steps';
import type { IDecisionEngine } from '../steps/DecisionStep';

/**
 * Approval service interface (mock for demonstration)
 */
export interface IApprovalService {
  requestApproval(params: {
    executionId: string;
    approverId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * Payroll service interface (mock for demonstration)
 */
export interface IPayrollService {
  publish(params: {
    employeeId: string;
    month: string;
    totalSalary: number;
    status: string;
  }): Promise<{ id: string }>;
}

/**
 * Accounting service interface (mock for demonstration)
 */
export interface IAccountingService {
  createExpense(params: {
    type: string;
    amount: number;
    employeeId: string;
    month: string;
  }): Promise<{ id: string }>;
}

/**
 * Create Payroll Approval Workflow
 * 
 * @param decisionEngine - Decision Engine instance
 * @param services - Business services
 * @returns WorkflowDefinition
 */
export function createPayrollApprovalWorkflow(
  decisionEngine: IDecisionEngine,
  services: {
    approval: IApprovalService;
    payroll: IPayrollService;
    accounting: IAccountingService;
  }
): WorkflowDefinition {
  return {
    id: 'payroll-approval-v1',
    version: '1.0.0',
    name: 'Payroll Approval Workflow',
    description: 'Calculate salary components, obtain approvals, and publish salary',
    
    steps: [
      // Step 1: Calculate salary components in parallel (Decision Engine)
      new ParallelStep(
        'calculate-salary-components',
        [
          new DecisionStep(
            'calculate-kpi',
            decisionEngine,
            {
              decisionType: 'kpi-eligibility',
              ruleType: 'if-then',
              rule: {
                condition: {
                  and: [
                    { field: 'totalSessions', operator: '>=', value: 26 },
                    { field: 'avgRating', operator: '>=', value: 4.5 }
                  ]
                },
                action: { bonusAmount: 3000000 }
              },
              outputKey: 'kpiResult',
              module: 'payroll'
            },
            'Calculate KPI bonus based on sessions and rating'
          ),
          
          new DecisionStep(
            'calculate-deductions',
            decisionEngine,
            {
              decisionType: 'attendance-deduction',
              ruleType: 'if-then',
              rule: {
                condition: {
                  or: [
                    { field: 'lateDays', operator: '>', value: 0 },
                    { field: 'absentDays', operator: '>', value: 0 }
                  ]
                },
                action: { deductionAmount: { formula: 'lateDays * 100000 + absentDays * 300000' } }
              },
              outputKey: 'deductionResult',
              module: 'payroll'
            },
            'Calculate attendance-based deductions'
          ),
          
          new DecisionStep(
            'calculate-commission',
            decisionEngine,
            {
              decisionType: 'commission-calculation',
              ruleType: 'if-then',
              rule: {
                condition: { field: 'completedSessions', operator: '>', value: 0 }
              },
              outputKey: 'commissionResult',
              module: 'payroll'
            },
            'Calculate session-based commission'
          )
        ],
        'all', // Wait for all calculations
        'Calculate all salary components in parallel using Decision Engine'
      ),

      // Step 2: Aggregate total salary
      new ActionStep(
        'aggregate-salary',
        async (ctx) => {
          const kpiResult = ctx.data.kpiResult as any;
          const deductionResult = ctx.data.deductionResult as any;
          const commissionResult = ctx.data.commissionResult as any;
          const baseSalary = ctx.data.baseSalary as number;
          
          const totalSalary =
            baseSalary +
            (kpiResult?.bonusAmount ?? 0) +
            (commissionResult?.amount ?? 0) -
            (deductionResult?.deductionAmount ?? 0);
          
          return {
            totalSalary,
            breakdown: {
              baseSalary,
              kpiBonus: kpiResult?.bonusAmount ?? 0,
              commission: commissionResult?.amount ?? 0,
              deductions: deductionResult?.deductionAmount ?? 0
            }
          };
        },
        'Sum all salary components to calculate total salary'
      ),
      
      // Step 3: Manager approval (pause workflow)
      new ActionStep(
        'request-manager-approval',
        async (ctx) => {
          await services.approval.requestApproval({
            executionId: ctx.executionId,
            approverId: ctx.data.managerId as string,
            data: {
              employeeId: ctx.data.employeeId,
              totalSalary: ctx.data.totalSalary,
              breakdown: ctx.data.breakdown
            }
          });
          
          // Pause workflow - will be resumed when manager approves
          return {
            managerApprovalRequested: true,
            _control: { pause: true }
          };
        },
        'Request manager approval and pause workflow'
      ),
      
      // Step 4: Finance review (resume after manager approval)
      new ActionStep(
        'request-finance-review',
        async (ctx) => {
          await services.approval.requestApproval({
            executionId: ctx.executionId,
            approverId: ctx.data.financeManagerId as string,
            data: {
              employeeId: ctx.data.employeeId,
              totalSalary: ctx.data.totalSalary,
              breakdown: ctx.data.breakdown,
              managerApproved: true
            }
          });
          
          // Pause workflow again - will be resumed when finance approves
          return {
            financeReviewRequested: true,
            _control: { pause: true }
          };
        },
        'Request finance review and pause workflow'
      ),
      
      // Step 5: Publish salary record
      new ActionStep(
        'publish-salary',
        async (ctx) => {
          const salaryRecord = await services.payroll.publish({
            employeeId: ctx.data.employeeId as string,
            month: ctx.data.month as string,
            totalSalary: ctx.data.totalSalary as number,
            status: 'published'
          });
          
          return {
            salaryRecordId: salaryRecord.id,
            salaryPublished: true
          };
        },
        'Publish approved salary record'
      ),
      
      // Step 6: Generate accounting expense entry
      new ActionStep(
        'create-expense',
        async (ctx) => {
          const expense = await services.accounting.createExpense({
            type: 'salary',
            amount: ctx.data.totalSalary as number,
            employeeId: ctx.data.employeeId as string,
            month: ctx.data.month as string
          });
          
          return {
            expenseId: expense.id,
            expenseCreated: true
          };
        },
        'Create accounting expense entry for salary payment'
      )
    ],
    
    defaultRetryPolicy: {
      maxAttempts: 3,
      delayMs: 2000,
      backoff: 'exponential'
    },
    
    timeout: 86400000, // 24 hours (long-running with approvals)
    
    metadata: {
      category: 'payroll',
      author: 'Bella ERP Team',
      requiresApproval: true,
      approvalSteps: ['request-manager-approval', 'request-finance-review']
    }
  };
}

/**
 * Example usage:
 * 
 * ```typescript
 * const workflow = createPayrollApprovalWorkflow(decisionEngine, services);
 * 
 * // Initial execution
 * const result = await workflowEngine.execute(workflow, {
 *   tenantId: 'bella-spa-vietnam',
 *   userId: 'hr-manager-123',
 *   data: {
 *     employeeId: 'ktv-456',
 *     month: '2026-06',
 *     baseSalary: 8000000,
 *     totalSessions: 28,
 *     avgRating: 4.7,
 *     completedSessions: 28,
 *     lateDays: 0,
 *     absentDays: 0,
 *     managerId: 'manager-789',
 *     financeManagerId: 'finance-012'
 *   }
 * });
 * 
 * // Workflow pauses at manager approval
 * console.log(result.status); // 'paused'
 * 
 * // Later: Manager approves → Resume workflow
 * await workflowEngine.resume(result.executionId);
 * 
 * // Workflow pauses again at finance review
 * 
 * // Later: Finance approves → Resume workflow
 * await workflowEngine.resume(result.executionId);
 * 
 * // Workflow completes: salary published + expense created
 * ```
 */
