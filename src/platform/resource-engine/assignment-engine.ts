import { ResourceAssignment, ResourceType } from './types';
import { ResourceSLAEngine } from './sla-engine';
import { AssigneeTarget } from './rotation-engine';

export class ResourceAssignmentEngine {
  private slaEngine: ResourceSLAEngine;

  constructor(slaEngine: ResourceSLAEngine) {
    this.slaEngine = slaEngine;
  }

  public assignResource(
    resourceType: ResourceType,
    resourceId: string,
    targetUser: AssigneeTarget,
    assignerId: string,
    assignerName: string
  ): {
    assignment: ResourceAssignment;
    slaTimer: ReturnType<ResourceSLAEngine['startTimer']>;
  } {
    const nowISO = new Date().toISOString();

    const assignment: ResourceAssignment = {
      id: `asg-${Date.now()}`,
      resourceType,
      resourceId,
      assignedToUserId: targetUser.id,
      assignedToUserName: targetUser.name,
      assignedByUserId: assignerId,
      assignedByUserName: assignerName,
      assignedAt: nowISO,
      status: 'waiting_accept',
    };

    const slaTimer = this.slaEngine.startTimer(resourceType, resourceId, 'accept');

    return { assignment, slaTimer };
  }
}
