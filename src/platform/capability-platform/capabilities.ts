import {
  ResourceEvent,
  ResourceRef,
  AssigneeUser,
} from './types';
import { eventBus } from './event-bus';
import { resourceRegistry } from './resource-registry';

/**
 * 1. Assignment Capability
 */
export class AssignmentCapability {
  public async assignResource(
    resource: ResourceRef,
    targetUser: AssigneeUser,
    assignerUser: AssigneeUser
  ): Promise<ResourceEvent> {
    const event: ResourceEvent = {
      id: `evt-${Date.now()}`,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      eventType: 'resource.assigned',
      actorId: assignerUser.id,
      actorName: assignerUser.name,
      payload: {
        assignedToUserId: targetUser.id,
        assignedToUserName: targetUser.name,
        assignedByUserId: assignerUser.id,
        assignedByUserName: assignerUser.name,
      },
      timestamp: new Date().toISOString(),
    };

    await eventBus.publish(event);
    return event;
  }
}

/**
 * 2. SLA Capability
 */
export class SLACapability {
  constructor() {
    // Auto-subscribe to resource.assigned event to trigger Accept SLA
    eventBus.subscribe('resource.assigned', async event => {
      const manifest = resourceRegistry.get(event.resourceType);
      if (!manifest) return;

      const acceptStage = manifest.slaMetadata.stages.find(s => s.stage === 'accept');
      const timeoutMinutes = acceptStage ? acceptStage.timeoutMinutes : 30;

      const deadline = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

      await eventBus.publish({
        id: `sla-start-${Date.now()}`,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        eventType: 'resource.sla_started',
        actorId: 'system',
        actorName: 'SLA Capability',
        payload: {
          stage: 'accept',
          deadlineTime: deadline,
          timeoutMinutes,
        },
        timestamp: new Date().toISOString(),
      });
    });
  }
}

/**
 * 3. Workflow Capability
 */
export class WorkflowCapability {
  public async executeTransition(
    resource: ResourceRef,
    actionCode: string,
    actor: AssigneeUser,
    notes?: string
  ): Promise<ResourceEvent> {
    const manifest = resourceRegistry.get(resource.resourceType);
    const transition = manifest?.workflowMetadata.transitions.find(t => t.actionCode === actionCode);

    const event: ResourceEvent = {
      id: `wf-${Date.now()}`,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      eventType: 'resource.workflow_transition',
      actorId: actor.id,
      actorName: actor.name,
      payload: {
        actionCode,
        fromState: transition?.fromState || 'unknown',
        toState: transition?.toState || actionCode,
        isTerminal: transition?.isTerminal || false,
        notes,
      },
      timestamp: new Date().toISOString(),
    };

    await eventBus.publish(event);
    return event;
  }
}

/**
 * 4. Rotation Capability
 */
export class RotationCapability {
  public async rotateTarget(
    resource: ResourceRef,
    currentAssigneeId?: string,
    currentRotationCount: number = 0,
    strategy: string = 'RoundRobin',
    reason: string = 'sla_breached'
  ): Promise<ResourceEvent> {
    const manifest = resourceRegistry.get(resource.resourceType);
    let nextAssignee: AssigneeUser = { id: 'user-backup', name: 'Quản Lý Dự Phòng' };

    if (manifest?.getNextRotationAssignee) {
      nextAssignee = await manifest.getNextRotationAssignee(resource, currentAssigneeId, strategy);
    }

    const newCount = currentRotationCount + 1;

    const event: ResourceEvent = {
      id: `rot-${Date.now()}`,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      eventType: 'resource.rotated',
      actorId: 'system',
      actorName: 'Rotation Capability',
      payload: {
        fromUserId: currentAssigneeId,
        toUserId: nextAssignee.id,
        toUserName: nextAssignee.name,
        rotationNumber: newCount,
        reason,
        strategy,
      },
      timestamp: new Date().toISOString(),
    };

    await eventBus.publish(event);
    return event;
  }
}

/**
 * 5. Notification Capability
 */
export class NotificationCapability {
  constructor() {
    // Subscribe to all resource events for multi-channel dispatch
    eventBus.subscribe('resource.assigned', async event => {
      this.dispatchNotification(event, 'Giao việc mới', `Bạn vừa được phân công một ${event.resourceType} mới.`);
    });
    eventBus.subscribe('resource.rotated', async event => {
      this.dispatchNotification(event, 'Xoay vòng công việc', `Một ${event.resourceType} đã được chuyển cho bạn.`);
    });
  }

  private dispatchNotification(event: ResourceEvent, title: string, body: string) {
    const manifest = resourceRegistry.get(event.resourceType);
    const customText = manifest?.formatNotification ? manifest.formatNotification(event) : { title, body };
    console.log(`[Notification Capability] [${event.resourceType}:${event.resourceId}] ${customText.title}: ${customText.body}`);
  }
}

/**
 * Instantiate Singleton Capabilities
 */
export const assignmentCapability = new AssignmentCapability();
export const slaCapability = new SLACapability();
export const workflowCapability = new WorkflowCapability();
export const rotationCapability = new RotationCapability();
export const notificationCapability = new NotificationCapability();
