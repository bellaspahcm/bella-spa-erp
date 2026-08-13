/**
 * Education OS — Workflow Registry Public Contract Interface
 */

export interface WorkflowDefinition {
  readonly tenantId: string;
  readonly workflowName: string;
  readonly initialState: string;
  readonly allowedTransitions: Record<string, string[]>;
}

export interface IWorkflowRegistryContract {
  /**
   * Retrieves workflow definition resolved dynamically for the given tenant.
   * Enforces configuration context isolation.
   */
  getWorkflow(tenantId: string, workflowName: string, requesterTenantId: string): Promise<WorkflowDefinition>;
}
