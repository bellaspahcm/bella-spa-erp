/**
 * Business Process Composition Types
 * 
 * Defines how business processes are composed from independent policies.
 * 
 * Key Concept:
 * - A Business Process is a composition of Policy Providers
 * - Each Policy Provider evaluates independently
 * - Results are aggregated into a Process Result
 * - Policies can have dependencies (for topological execution)
 */

import type { DecisionContext } from '@/lib/decision-engine/types/decision-context';
import type { PayrollProvider, SalaryComponent } from '@/lib/decision-engine/types/payroll-types';

/**
 * Policy Execution Result
 * 
 * Wraps the result of a single policy evaluation with metadata.
 */
export interface PolicyExecutionResult<T = unknown> {
  /** Policy that generated this result */
  policyName: string;
  
  /** Policy type (e.g., 'BaseSalaryPolicy', 'RewardPolicy') */
  policyType: string;
  
  /** Execution status */
  status: 'success' | 'failure' | 'skipped';
  
  /** Result data (if successful) */
  data?: T;
  
  /** Error (if failed) */
  error?: string;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Metadata from policy evaluation */
  metadata?: Record<string, unknown>;
}

/**
 * Business Process Result
 * 
 * Aggregated result from all policy executions in a process.
 */
export interface ProcessResult<T = unknown> {
  /** Process name */
  processName: string;
  
  /** Process version */
  processVersion: string;
  
  /** Execution status */
  status: 'success' | 'partial_success' | 'failure';
  
  /** Aggregated result */
  result: T;
  
  /** Individual policy results */
  policyResults: PolicyExecutionResult[];
  
  /** Total execution time */
  totalExecutionTime: number;
  
  /** Process metadata */
  metadata: {
    /** Number of policies executed */
    policiesExecuted: number;
    
    /** Number of successful policies */
    policiesSucceeded: number;
    
    /** Number of failed policies */
    policiesFailed: number;
    
    /** Number of skipped policies */
    policiesSkipped: number;
    
    /** Policy composition (which policies applied) */
    policyComposition: string[];
    
    /** Execution mode (sequential, parallel, topological) */
    executionMode: 'sequential' | 'parallel' | 'topological';
  };
}

/**
 * Policy Dependency
 * 
 * Defines dependencies between policies for topological execution.
 */
export interface PolicyDependency {
  /** Policy name */
  policyName: string;
  
  /** Dependencies (policy names that must execute first) */
  dependencies: string[];
}

/**
 * Business Process Configuration
 */
export interface ProcessConfig {
  /** Process name */
  name: string;
  
  /** Process version */
  version: string;
  
  /** Execution mode */
  executionMode?: 'sequential' | 'parallel' | 'topological';
  
  /** Policy dependencies (for topological execution) */
  dependencies?: PolicyDependency[];
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Continue on policy failure? */
  continueOnFailure?: boolean;
}

/**
 * Business Process Interface
 * 
 * A business process composes multiple policy providers into a single workflow.
 * 
 * NOTE: TContext does NOT need to extend DecisionContext.
 * This allows domain-specific contexts (e.g., BookingDecisionContext)
 * that have their own fields without forcing standard Decision Engine fields.
 */
export interface BusinessProcess<TContext, TResult> {
  /** Process configuration */
  config: ProcessConfig;
  
  /** Policy providers in this process */
  policies: PayrollProvider<unknown>[];
  
  /**
   * Execute the business process
   * 
   * @param context - Decision context (domain-specific)
   * @returns Process result with aggregated policy outputs
   */
  execute(context: TContext): Promise<ProcessResult<TResult>>;
  
  /**
   * Validate process configuration
   * 
   * @returns Validation errors (empty if valid)
   */
  validate(): string[];
}

/**
 * Payroll Process Result
 * 
 * Specific result type for Payroll business process.
 */
export interface PayrollProcessResult {
  /** Employee ID */
  employeeId: string;
  
  /** Month/Year */
  monthYear: string;
  
  /** Total salary */
  totalSalary: number;
  
  /** Salary components from each policy */
  components: SalaryComponent[];
  
  /** Breakdown by component type */
  breakdown: {
    baseSalary: number;
    compensation: number;
    penalties: number;
    adjustments: number;
  };
}
