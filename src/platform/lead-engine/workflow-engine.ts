import { ManagedLead, LeadOutcome } from './types';
import { LeadRuleEngine } from './rule-engine';
import { LeadSLAEngine } from './sla-engine';
import { LeadRotationEngine, SalesAgent } from './rotation-engine';
import { LeadAuditEngine } from './audit-engine';

export class LeadWorkflowEngine {
  private ruleEngine: LeadRuleEngine;
  private slaEngine: LeadSLAEngine;
  private rotationEngine: LeadRotationEngine;

  constructor(
    ruleEngine: LeadRuleEngine,
    slaEngine: LeadSLAEngine,
    rotationEngine: LeadRotationEngine
  ) {
    this.ruleEngine = ruleEngine;
    this.slaEngine = slaEngine;
    this.rotationEngine = rotationEngine;
  }

  /**
   * Sale thực hiện hành động "Nhận Lead" (Accept Lead)
   */
  public acceptLead(lead: ManagedLead, saleId: string, saleName: string): ManagedLead {
    const nowISO = new Date().toISOString();

    // 1. Hoàn thành Accept SLA Timer
    let updatedLead = this.slaEngine.completeCurrentTimer(lead);

    // 2. Chuyển trạng thái sang in_progress
    updatedLead = {
      ...updatedLead,
      state: 'in_progress',
      acceptedAt: nowISO,
      updatedAt: nowISO,
    };

    // 3. Ghi log Timeline
    updatedLead = LeadAuditEngine.recordEvent(
      updatedLead,
      'lead_accepted',
      saleId,
      saleName,
      `Sale [${saleName}] đã xác nhận nhận Lead thành công.`
    );

    // 4. Kích hoạt Follow-up #1 SLA Timer (2 giờ)
    updatedLead = this.slaEngine.startFollowupTimer(updatedLead, 'followup_1');

    return updatedLead;
  }

  /**
   * Sale cập nhật kết quả chăm sóc (Submit Lead Outcome)
   */
  public submitOutcome(
    lead: ManagedLead,
    outcome: LeadOutcome,
    notes: string,
    saleId: string,
    saleName: string,
    availableSales: SalesAgent[] = []
  ): ManagedLead {
    const nowISO = new Date().toISOString();

    // 1. Hoàn thành SLA Timer hiện tại
    let updatedLead = this.slaEngine.completeCurrentTimer(lead);

    const isNoAnswer = outcome === 'NO_ANSWER';
    const newNoAnswerCount = isNoAnswer ? lead.noAnswerCount + 1 : 0;

    updatedLead = {
      ...updatedLead,
      currentOutcome: outcome,
      noAnswerCount: newNoAnswerCount,
      notes: notes ? `${lead.notes ? lead.notes + ' | ' : ''}${notes}` : lead.notes,
      updatedAt: nowISO,
    };

    // 2. Ghi log sự kiện Followup
    updatedLead = LeadAuditEngine.recordEvent(
      updatedLead,
      'followup_logged',
      saleId,
      saleName,
      `Đã cập nhật phản hồi lần chăm sóc: [${outcome}]. Ghi chú: ${notes || 'Không có'}`,
      { outcome, notes }
    );

    // 3. Đánh giá trạng thái kế tiếp

    // Case A: Thành công (BOOKING) -> Chuyển Converted & Dừng SLA
    if (outcome === 'BOOKING') {
      updatedLead = {
        ...updatedLead,
        state: 'converted',
      };
      return LeadAuditEngine.recordEvent(
        updatedLead,
        'lead_converted',
        saleId,
        saleName,
        `🎉 Chúc mừng! Lead đã chốt thành công Booking / Hợp đồng.`
      );
    }

    // Case B: Thất bại / Rác (LOST, INVALID, WRONG_NUMBER, BLACKLIST) -> Đóng Lead
    if (['LOST', 'INVALID', 'WRONG_NUMBER', 'NOT_INTERESTED', 'BLACKLIST'].includes(outcome)) {
      updatedLead = {
        ...updatedLead,
        state: 'lost',
      };
      return LeadAuditEngine.recordEvent(
        updatedLead,
        'lead_closed',
        saleId,
        saleName,
        `Đã đóng Lead do kết quả chăm sóc là [${outcome}].`
      );
    }

    // Case C: Không nghe máy (NO_ANSWER) -> Kiểm tra điều kiện Rotate
    if (this.ruleEngine.shouldRotateOnOutcome(outcome, newNoAnswerCount)) {
      return this.rotationEngine.rotateLead(
        updatedLead,
        availableSales,
        'max_attempts_no_answer',
        saleId,
        saleName
      );
    }

    // Case D: Tiếp tục chăm sóc (CONTACTED, CALL_BACK, INTERESTED, NO_ANSWER lần 1) -> Khởi tạo Follow-up #2 SLA Timer
    return this.slaEngine.startFollowupTimer(updatedLead, 'followup_2');
  }

  /**
   * Xử lý Timeout SLA (Quá hạn chờ nhận lead)
   */
  public handleAcceptTimeout(
    lead: ManagedLead,
    availableSales: SalesAgent[]
  ): ManagedLead {
    if (lead.state !== 'waiting_accept') return lead;

    let updatedLead = LeadAuditEngine.recordEvent(
      lead,
      'sla_breached',
      'system',
      'SLA Engine',
      `⚠️ Quá hạn ${this.ruleEngine.getConfig().acceptWindowMinutes} phút chưa nhận lead!`
    );

    // Tự động xoay lead
    return this.rotationEngine.rotateLead(
      updatedLead,
      availableSales,
      'sla_accept_timeout',
      'system',
      'SLA Engine'
    );
  }
}
