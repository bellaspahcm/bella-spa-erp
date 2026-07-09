/**
 * Rule Management UI - Type Definitions
 * 
 * TypeScript types for workflow and rule management.
 */

// ============================================================
// Workflow Definition Types
// ============================================================

export type WorkflowStatus = 'draft' | 'testing' | 'published' | 'archived';

export type WorkflowCategory = 
  | 'booking' 
  | 'payroll' 
  | 'inventory' 
  | 'hr' 
  | 'finance' 
  | 'customer'
  | 'operational';

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  workflowId: string;
  name: string;
  description?: string;
  category: WorkflowCategory;
  config: WorkflowConfig;
  version: string;
  status: WorkflowStatus;
  createdBy?: string;
  updatedBy?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowConfig {
  steps: WorkflowStep[];
  defaultRetryPolicy?: RetryPolicy;
  timeout?: number;  // milliseconds
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'decision' | 'action' | 'condition' | 'parallel';
  config: StepConfig;
  retryPolicy?: RetryPolicy;
  continueOnError?: boolean;
  compensation?: CompensationConfig;
}

export interface StepConfig {
  // For DecisionStep
  decisionType?: string;
  ruleType?: string;
  outputKey?: string;
  
  // For ActionStep
  handler?: string;  // Function name or reference
  
  // For ConditionStep
  predicate?: string;  // Expression or reference
  trueBranch?: string;  // Next step name
  falseBranch?: string;  // Next step name
  
  // For ParallelStep
  steps?: WorkflowStep[];
  strategy?: 'all' | 'race' | 'allSettled';
  
  // Common
  description?: string;
  [key: string]: unknown;
}

export interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  backoff?: 'linear' | 'exponential';
}

export interface CompensationConfig {
  handler: string;
  onError?: boolean;
}

// ============================================================
// Workflow Rule Types
// ============================================================

export type RuleType = 'condition' | 'action' | 'decision' | 'validation';

export interface WorkflowRule {
  id: string;
  tenantId: string;
  workflowId: string;
  ruleName: string;
  ruleType: RuleType;
  ruleConfig: RuleConfig;
  priority: number;
  enabled: boolean;
  description?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleConfig {
  // For condition rules
  if?: ConditionExpression;
  then?: ActionExpression;
  else?: ActionExpression;
  
  // For action rules
  action?: ActionExpression;
  
  // For decision rules
  evaluate?: string;  // Expression to evaluate
  output?: Record<string, unknown>;
  
  // For validation rules
  validate?: ValidationExpression[];
  
  // Common
  [key: string]: unknown;
}

export interface ConditionExpression {
  and?: ConditionExpression[];
  or?: ConditionExpression[];
  not?: ConditionExpression;
  field?: string;
  operator?: ComparisonOperator;
  value?: unknown;
}

export type ComparisonOperator = 
  | '===' | '!==' 
  | '>' | '>=' | '<' | '<=' 
  | 'contains' | 'startsWith' | 'endsWith'
  | 'in' | 'notIn'
  | 'matches';  // regex

export interface ActionExpression {
  type: string;
  params?: Record<string, unknown>;
}

export interface ValidationExpression {
  field: string;
  rules: ValidationRule[];
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: unknown;
  message?: string;
}

// ============================================================
// Workflow Version Types
// ============================================================

export interface WorkflowVersion {
  id: string;
  tenantId: string;
  workflowId: string;
  version: string;
  snapshot: WorkflowConfig;
  changelog?: string;
  createdBy?: string;
  createdAt: string;
}

// ============================================================
// Rule Simulation Types
// ============================================================

export interface RuleSimulation {
  id: string;
  tenantId: string;
  workflowId: string;
  ruleId?: string;
  inputData: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  trace?: ExecutionTrace[];
  success: boolean;
  errorMessage?: string;
  executionTimeMs?: number;
  createdBy?: string;
  createdAt: string;
}

export interface ExecutionTrace {
  stepName: string;
  stepType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  executionTimeMs?: number;
}

// ============================================================
// API Request/Response Types
// ============================================================

// Create workflow
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  category: WorkflowCategory;
  config: WorkflowConfig;
}

export interface CreateWorkflowResponse {
  workflowId: string;
  success: boolean;
}

// Update workflow
export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  config?: WorkflowConfig;
  status?: WorkflowStatus;
}

export interface UpdateWorkflowResponse {
  success: boolean;
}

// Publish workflow
export interface PublishWorkflowRequest {
  changelog?: string;
}

export interface PublishWorkflowResponse {
  version: string;
  publishedAt: string;
  success: boolean;
}

// Create rule
export interface CreateRuleRequest {
  workflowId: string;
  ruleName: string;
  ruleType: RuleType;
  ruleConfig: RuleConfig;
  priority?: number;
  enabled?: boolean;
  description?: string;
}

export interface CreateRuleResponse {
  ruleId: string;
  success: boolean;
}

// Update rule
export interface UpdateRuleRequest {
  ruleConfig?: RuleConfig;
  priority?: number;
  enabled?: boolean;
  description?: string;
}

export interface UpdateRuleResponse {
  success: boolean;
}

// Simulate rule
export interface SimulateRuleRequest {
  inputData: Record<string, unknown>;
}

export interface SimulateRuleResponse {
  success: boolean;
  outputData?: Record<string, unknown>;
  trace?: ExecutionTrace[];
  executionTimeMs: number;
  errorMessage?: string;
}

// List workflows
export interface ListWorkflowsQuery {
  category?: WorkflowCategory;
  status?: WorkflowStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListWorkflowsResponse {
  workflows: WorkflowDefinition[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================
// UI Component Types
// ============================================================

// For React Flow (Workflow Designer)
export interface FlowNode {
  id: string;
  type: 'decision' | 'action' | 'condition' | 'parallel' | 'start' | 'end';
  position: { x: number; y: number };
  data: {
    label: string;
    config: StepConfig;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'default' | 'smoothstep' | 'straight';
}

// For Condition Builder
export interface ConditionBuilderState {
  conditions: ConditionExpression[];
  operator: 'and' | 'or';
}

// For Rule Builder
export interface RuleBuilderState {
  ruleName: string;
  ruleType: RuleType;
  ruleConfig: RuleConfig;
  isValid: boolean;
  errors: Record<string, string>;
}

// ============================================================
// Workflow Execution Statistics
// ============================================================

export interface WorkflowExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTimeMs: number;
  successRate: number;
}

// ============================================================
// Helper Types
// ============================================================

export type WorkflowWithRules = WorkflowDefinition & {
  rules: WorkflowRule[];
};

export type WorkflowVersionHistory = {
  versions: WorkflowVersion[];
  current: string;
};
