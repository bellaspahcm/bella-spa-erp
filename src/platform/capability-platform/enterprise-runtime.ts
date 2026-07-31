import { ResourceRef, AssigneeUser } from './types';
import { resourceRegistry } from './resource-registry';
import { capabilityRegistry } from './capability-registry';
import { eventBus } from './event-bus';
import { projectionEngine } from './projections';
import { assignmentCapability, workflowCapability, rotationCapability } from './capabilities';

export class EnterpriseExecutionRuntime {
  private static instance: EnterpriseExecutionRuntime;

  private constructor() {
    // Register default capabilities into CapabilityRegistry
    capabilityRegistry.register({
      key: 'assignment',
      execute: (params) =>
        assignmentCapability.assignResource(
          params.resource as ResourceRef,
          params.targetUser as AssigneeUser,
          params.assignerUser as AssigneeUser
        ),
    });

    capabilityRegistry.register({
      key: 'workflow',
      execute: (params) =>
        workflowCapability.executeTransition(
          params.resource as ResourceRef,
          params.actionCode as string,
          params.actor as AssigneeUser,
          params.notes as string | undefined
        ),
    });

    capabilityRegistry.register({
      key: 'rotation',
      execute: (params) =>
        rotationCapability.rotateTarget(
          params.resource as ResourceRef,
          params.currentAssigneeId as string | undefined,
          params.currentRotationCount as number | undefined,
          params.strategy as string | undefined,
          params.reason as string | undefined
        ),
    });
  }

  public static getInstance(): EnterpriseExecutionRuntime {
    if (!EnterpriseExecutionRuntime.instance) {
      EnterpriseExecutionRuntime.instance = new EnterpriseExecutionRuntime();
    }
    return EnterpriseExecutionRuntime.instance;
  }

  public async execute(params: {
    capabilityKey: string;
    resource: ResourceRef;
    payload: Record<string, unknown>;
  }): Promise<unknown> {
    const capability = capabilityRegistry.get(params.capabilityKey);
    if (!capability) {
      throw new Error(`[EnterpriseRuntime] Capability '${params.capabilityKey}' is not registered.`);
    }

    const providerManifest = resourceRegistry.get(params.resource.resourceType);
    if (!providerManifest) {
      console.warn(`[EnterpriseRuntime] No ResourceProvider registered for '${params.resource.resourceType}'`);
    }

    // Execute capability
    const result = await capability.execute({
      resource: params.resource,
      providerManifest,
      ...params.payload,
    });

    return result;
  }

  public getDashboardStats() {
    return projectionEngine.getDashboardProjection();
  }

  public getTimelineHistory(resourceType?: string, resourceId?: string) {
    return eventBus.getEventHistory(resourceType, resourceId);
  }
}

export const enterpriseRuntime = EnterpriseExecutionRuntime.getInstance();
