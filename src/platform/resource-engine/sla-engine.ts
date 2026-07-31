import { ResourceSLATimer, ResourceType } from './types';
import { ResourceRuleEngine } from './rule-engine';

export interface ResourceSLAStatusDisplay {
  label: string;
  badgeColor: 'blue' | 'amber' | 'red' | 'emerald' | 'slate';
  remainingMinutes: number;
  isBreached: boolean;
  isCompleted: boolean;
}

export class ResourceSLAEngine {
  private ruleEngine: ResourceRuleEngine;

  constructor(ruleEngine: ResourceRuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  public startTimer(
    resourceType: ResourceType,
    resourceId: string,
    stage: string
  ): ResourceSLATimer {
    const nowISO = new Date().toISOString();
    let deadlineISO: string;

    if (stage === 'accept') {
      deadlineISO = this.ruleEngine.calculateAcceptDeadline(nowISO);
    } else if (stage === 'stage1' || stage === 'followup_1') {
      deadlineISO = this.ruleEngine.calculateStage1Deadline(nowISO);
    } else {
      deadlineISO = this.ruleEngine.calculateStage2Deadline(nowISO);
    }

    return {
      id: `sla-${Date.now()}`,
      resourceType,
      resourceId,
      stage,
      startTime: nowISO,
      deadlineTime: deadlineISO,
      isBreached: false,
      isCompleted: false,
    };
  }

  public completeTimer(timer: ResourceSLATimer): ResourceSLATimer {
    return {
      ...timer,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };
  }

  public evaluateTimer(timer?: ResourceSLATimer, state?: string): ResourceSLAStatusDisplay {
    if (state === 'converted' || state === 'resolved' || state === 'completed') {
      return { label: '✅ Hoàn thành', badgeColor: 'emerald', remainingMinutes: 0, isBreached: false, isCompleted: true };
    }
    if (state === 'lost' || state === 'closed' || state === 'archived') {
      return { label: '🔒 Đã đóng', badgeColor: 'slate', remainingMinutes: 0, isBreached: false, isCompleted: true };
    }

    if (!timer || timer.isCompleted) {
      return { label: '⚪ Đã qua SLA', badgeColor: 'slate', remainingMinutes: 0, isBreached: false, isCompleted: true };
    }

    const now = Date.now();
    const deadline = new Date(timer.deadlineTime).getTime();
    const diffMinutes = Math.floor((deadline - now) / (60 * 1000));

    if (diffMinutes < 0) {
      return {
        label: `⏰ Quá hạn (${Math.abs(diffMinutes)} ph)`,
        badgeColor: 'red',
        remainingMinutes: diffMinutes,
        isBreached: true,
        isCompleted: false,
      };
    }

    if (diffMinutes <= this.ruleEngine.getConfig().reminderBeforeMinutes) {
      return {
        label: `⚠️ Sắp hết hạn (${diffMinutes} ph)`,
        badgeColor: 'amber',
        remainingMinutes: diffMinutes,
        isBreached: false,
        isCompleted: false,
      };
    }

    return {
      label: `⏳ Còn ${diffMinutes} ph`,
      badgeColor: 'blue',
      remainingMinutes: diffMinutes,
      isBreached: false,
      isCompleted: false,
    };
  }
}
