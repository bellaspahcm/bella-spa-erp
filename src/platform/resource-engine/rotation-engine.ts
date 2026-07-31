import { ResourceRotationRecord, ResourceType } from './types';
import { ResourceRuleEngine } from './rule-engine';

export interface AssigneeTarget {
  id: string;
  name: string;
  role?: string;
}

export class ResourceRotationEngine {
  private ruleEngine: ResourceRuleEngine;

  constructor(ruleEngine: ResourceRuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  public rotateTarget(
    resourceType: ResourceType,
    resourceId: string,
    currentUserId?: string,
    currentUserName?: string,
    currentRotationCount: number = 0,
    availableAssignees: AssigneeTarget[] = [],
    reason: string = 'sla_breached'
  ): {
    nextAssignee?: AssigneeTarget;
    rotationRecord?: ResourceRotationRecord;
    isMaxRotationsReached: boolean;
    newRotationCount: number;
  } {
    const isMaxReached = this.ruleEngine.isMaxRotationsReached(currentRotationCount);
    if (isMaxReached) {
      return {
        isMaxRotationsReached: true,
        newRotationCount: currentRotationCount,
      };
    }

    const eligible = availableAssignees.filter(a => a.id !== currentUserId);
    const nextAssignee = eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : { id: 'user-backup', name: 'Quản Lý Dự Phòng' };

    const newCount = currentRotationCount + 1;

    const rotationRecord: ResourceRotationRecord = {
      id: `rot-${Date.now()}`,
      resourceType,
      resourceId,
      fromUserId: currentUserId,
      fromUserName: currentUserName,
      toUserId: nextAssignee.id,
      toUserName: nextAssignee.name,
      rotationNumber: newCount,
      reason,
      rotatedAt: new Date().toISOString(),
    };

    return {
      nextAssignee,
      rotationRecord,
      isMaxRotationsReached: false,
      newRotationCount: newCount,
    };
  }
}
