import { IWorkflowRegistryContract, WorkflowDefinition } from './workflow-registry.contract';

// Central configuration registry. Tenant IDs are scoped only within config maps.
const WORKFLOW_REGISTRY: Record<string, Record<string, WorkflowDefinition>> = {
  'tenant-standard': {
    'student_enrollment': {
      tenantId: 'tenant-standard',
      workflowName: 'student_enrollment',
      initialState: 'active',
      allowedTransitions: {
        'active': ['completed', 'cancelled'],
      },
    },
  },
  'tenant-strict': {
    'student_enrollment': {
      tenantId: 'tenant-strict',
      workflowName: 'student_enrollment',
      initialState: 'pending_approval',
      allowedTransitions: {
        'pending_approval': ['active', 'rejected'],
        'active': ['completed', 'cancelled'],
      },
    },
  },
  'tenant-corporate': {
    'student_enrollment': {
      tenantId: 'tenant-corporate',
      workflowName: 'student_enrollment',
      initialState: 'active',
      allowedTransitions: {
        'active': ['completed', 'cancelled'],
      },
    },
  },
};

export class WorkflowRegistryContractImpl implements IWorkflowRegistryContract {
  public async getWorkflow(tenantId: string, workflowName: string, requesterTenantId: string): Promise<WorkflowDefinition> {
    // Rule D: Configuration Context Isolation
    if (tenantId !== requesterTenantId) {
      throw new Error(`CONFIGURATION_CONTEXT_ISOLATION_VIOLATION: Requester tenant '${requesterTenantId}' is not authorized to access configurations for tenant '${tenantId}'.`);
    }

    const tenantWorkflows = WORKFLOW_REGISTRY[tenantId];
    if (!tenantWorkflows) {
      throw new Error(`WORKFLOW_NOT_FOUND: Tenant '${tenantId}' configurations are not registered.`);
    }

    const workflow = tenantWorkflows[workflowName];
    if (!workflow) {
      throw new Error(`WORKFLOW_NOT_FOUND: Workflow '${workflowName}' is not defined for tenant '${tenantId}'.`);
    }

    return workflow;
  }
}
