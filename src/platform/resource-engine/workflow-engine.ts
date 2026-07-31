import { ResourceWorkflowProviderContract, ResourceType } from './types';
import { ResourceSLAEngine } from './sla-engine';
import { ResourceRotationEngine, AssigneeTarget } from './rotation-engine';
import { ResourceRuleEngine } from './rule-engine';

export class ResourceWorkflowEngine {
  private ruleEngine: ResourceRuleEngine;
  private slaEngine: ResourceSLAEngine;
  private rotationEngine: ResourceRotationEngine;
  private providers: Map<ResourceType, ResourceWorkflowProviderContract> = new Map();

  constructor(
    ruleEngine: ResourceRuleEngine,
    slaEngine: ResourceSLAEngine,
    rotationEngine: ResourceRotationEngine
  ) {
    this.ruleEngine = ruleEngine;
    this.slaEngine = slaEngine;
    this.rotationEngine = rotationEngine;
  }

  public registerProvider(provider: ResourceWorkflowProviderContract): void {
    this.providers.set(provider.resourceType, provider);
  }

  public processOutcome(
    resourceType: ResourceType,
    resourceId: string,
    outcomeCode: string,
    currentAttemptCount: number = 0,
    currentRotationCount: number = 0,
    currentUserId?: string,
    currentUserName?: string,
    availableAssignees: AssigneeTarget[] = []
  ) {
    const provider = this.providers.get(resourceType);
    const parsedOutcome = provider ? provider.parseOutcome(outcomeCode) : {
      isSuccess: outcomeCode === 'SUCCESS' || outcomeCode === 'BOOKING' || outcomeCode === 'RESOLVED',
      isFailure: outcomeCode === 'LOST' || outcomeCode === 'CANCELLED',
      requiresNextStage: outcomeCode === 'CONTACTED' || outcomeCode === 'CALL_BACK',
      incrementsAttemptCount: outcomeCode === 'NO_ANSWER',
      nextState: outcomeCode,
    };

    const newAttemptCount = parsedOutcome.incrementsAttemptCount ? currentAttemptCount + 1 : 0;
    const shouldRotate = this.ruleEngine.shouldRotateOnAttempts(newAttemptCount);

    if (shouldRotate) {
      const rotationResult = this.rotationEngine.rotateTarget(
        resourceType,
        resourceId,
        currentUserId,
        currentUserName,
        currentRotationCount,
        availableAssignees,
        'max_attempts_reached'
      );

      return {
        action: 'ROTATE' as const,
        parsedOutcome,
        newAttemptCount: 0,
        rotationResult,
        nextState: rotationResult.isMaxRotationsReached ? 'archived' : 'waiting_accept',
      };
    }

    if (parsedOutcome.isSuccess) {
      return {
        action: 'COMPLETE' as const,
        parsedOutcome,
        newAttemptCount,
        nextState: 'converted',
      };
    }

    if (parsedOutcome.isFailure) {
      return {
        action: 'CLOSE' as const,
        parsedOutcome,
        newAttemptCount,
        nextState: 'lost',
      };
    }

    return {
      action: 'NEXT_STAGE' as const,
      parsedOutcome,
      newAttemptCount,
      nextState: 'in_progress',
    };
  }
}
