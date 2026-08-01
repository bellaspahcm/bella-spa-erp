import { ManagedLead, SLATimer } from './types';
import { LeadRuleEngine } from './rule-engine';
import { LeadAuditEngine } from './audit-engine';

export interface SLAStatusDisplay {
  label: string;
  badgeColor: 'blue' | 'amber' | 'red' | 'emerald' | 'slate';
  remainingMinutes: number;
  isBreached: boolean;
  isCompleted: boolean;
}

export class LeadSLAEngine {
  private ruleEngine: LeadRuleEngine;

  constructor(ruleEngine: LeadRuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  /**
   * Tạo timer SLA khi gán lead cho Sale (Chờ nhận lead - Accept SLA)
   */
  public startAcceptTimer(lead: ManagedLead): ManagedLead {
    const nowISO = new Date().toISOString();
    const deadlineISO = this.ruleEngine.calculateAcceptDeadline(nowISO);

    const timer: SLATimer = {
      id: `sla-${Date.now()}`,
      leadId: lead.id,
      stage: 'accept',
      startTime: nowISO,
      deadlineTime: deadlineISO,
      isBreached: false,
      isCompleted: false,
    };

    const updatedLead: ManagedLead = {
      ...lead,
      activeSLATimer: timer,
      updatedAt: nowISO,
    };

    return LeadAuditEngine.recordEvent(
      updatedLead,
      'sla_timer_started',
      'system',
      'SLA Engine',
      `Đã khởi tạo SLA chờ nhận lead (${this.ruleEngine.getConfig().acceptWindowMinutes} phút). Hạn chót: ${new Date(deadlineISO).toLocaleTimeString('vi-VN')}`
    );
  }

  /**
   * Tạo timer SLA cho Follow-up sau khi Sale đã bấm "Nhận Lead"
   */
  public startFollowupTimer(lead: ManagedLead, stage: 'followup_1' | 'followup_2' = 'followup_1'): ManagedLead {
    const nowISO = new Date().toISOString();
    const deadlineISO = stage === 'followup_1'
      ? this.ruleEngine.calculateFollowup1Deadline(nowISO)
      : this.ruleEngine.calculateFollowup2Deadline(nowISO);

    const timer: SLATimer = {
      id: `sla-${Date.now()}`,
      leadId: lead.id,
      stage,
      startTime: nowISO,
      deadlineTime: deadlineISO,
      isBreached: false,
      isCompleted: false,
    };

    const labelStage = stage === 'followup_1' ? 'Follow-up #1 (2 giờ)' : 'Follow-up #2 (24 giờ)';

    const updatedLead: ManagedLead = {
      ...lead,
      activeSLATimer: timer,
      updatedAt: nowISO,
    };

    return LeadAuditEngine.recordEvent(
      updatedLead,
      'sla_timer_started',
      'system',
      'SLA Engine',
      `Đã khởi tạo SLA chăm sóc ${labelStage}. Hạn chót: ${new Date(deadlineISO).toLocaleString('vi-VN')}`
    );
  }

  /**
   * Đánh dấu hoàn thành Timer SLA hiện tại
   */
  public completeCurrentTimer(lead: ManagedLead): ManagedLead {
    if (!lead.activeSLATimer) return lead;

    const completedTimer: SLATimer = {
      ...lead.activeSLATimer,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };

    return {
      ...lead,
      activeSLATimer: completedTimer,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Tính toán thông tin hiển thị Badge SLA thời gian thực
   */
  public evaluateSLAStatus(lead: ManagedLead): SLAStatusDisplay {
    if (lead.state === 'converted') {
      return { label: 'Đã chốt HĐ', badgeColor: 'emerald', remainingMinutes: 0, isBreached: false, isCompleted: true };
    }
    if (lead.state === 'lost' || lead.state === 'archived') {
      return { label: 'Đã đóng Lead', badgeColor: 'slate', remainingMinutes: 0, isBreached: false, isCompleted: true };
    }

    const timer = lead.activeSLATimer;
    if (!timer || timer.isCompleted) {
      return { label: 'Đã hoàn thành SLA', badgeColor: 'slate', remainingMinutes: 0, isBreached: false, isCompleted: true };
    }

    const now = Date.now();
    const deadline = new Date(timer.deadlineTime).getTime();
    const diffMinutes = Math.floor((deadline - now) / (60 * 1000));
    const stageLabel = timer.stage === 'accept' ? 'Chờ nhận' : timer.stage === 'followup_1' ? 'Followup #1' : 'Followup #2';

    if (diffMinutes < 0) {
      return {
        label: `Quá hạn ${stageLabel} (${Math.abs(diffMinutes)} ph)`,
        badgeColor: 'red',
        remainingMinutes: diffMinutes,
        isBreached: true,
        isCompleted: false,
      };
    }

    if (diffMinutes <= this.ruleEngine.getConfig().reminderBeforeMinutes) {
      return {
        label: `Sắp hết hạn ${stageLabel} (${diffMinutes} ph)`,
        badgeColor: 'amber',
        remainingMinutes: diffMinutes,
        isBreached: false,
        isCompleted: false,
      };
    }

    return {
      label: `${stageLabel}: còn ${diffMinutes} ph`,
      badgeColor: 'blue',
      remainingMinutes: diffMinutes,
      isBreached: false,
      isCompleted: false,
    };
  }
}
