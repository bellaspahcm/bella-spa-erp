import { ManagedLead, RotationRecord } from './types';
import { LeadRuleEngine } from './rule-engine';
import { LeadAuditEngine } from './audit-engine';

export interface SalesAgent {
  id: string;
  name: string;
  role: string;
}

export class LeadRotationEngine {
  private ruleEngine: LeadRuleEngine;

  constructor(ruleEngine: LeadRuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  /**
   * Thực hiện xoay lead sang Sale tiếp theo trong danh sách đội ngũ Sale
   */
  public rotateLead(
    lead: ManagedLead,
    availableSales: SalesAgent[],
    reason: RotationRecord['reason'],
    actorId: string = 'system',
    actorName: string = 'Lead Rotation Engine'
  ): ManagedLead {
    const currentRotationCount = lead.rotationCount + 1;
    const isMaxReached = this.ruleEngine.isMaxRotationsReached(lead.rotationCount);

    // Nếu đã hết số vòng xoay quy định -> Chuyển Quản lý hoặc Đóng Lead
    if (isMaxReached) {
      const escalatedLead: ManagedLead = {
        ...lead,
        state: 'archived',
        assignedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return LeadAuditEngine.recordEvent(
        escalatedLead,
        'escalated_to_manager',
        actorId,
        actorName,
        `Lead đã xoay quá ${this.ruleEngine.getConfig().maxRotations} vòng tối đa. Đã tự động lưu kho / chuyển cho Quản lý sàn xử lý trực tiếp.`
      );
    }

    // Chọn Sale tiếp theo khác với Sale hiện tại
    const eligibleSales = availableSales.filter(s => s.id !== lead.currentSaleId);
    const nextSale = eligibleSales.length > 0
      ? eligibleSales[Math.floor(Math.random() * eligibleSales.length)]
      : { id: 'sale-backup', name: 'Sale Dự Phòng', role: 'Sale Specialist' };

    const rotationRecord: RotationRecord = {
      id: `rot-${Date.now()}`,
      leadId: lead.id,
      fromSaleId: lead.currentSaleId,
      fromSaleName: lead.currentSaleName,
      toSaleId: nextSale.id,
      toSaleName: nextSale.name,
      rotationNumber: currentRotationCount,
      reason,
      rotatedAt: new Date().toISOString(),
    };

    const updatedLead: ManagedLead = {
      ...lead,
      state: 'waiting_accept',
      currentSaleId: nextSale.id,
      currentSaleName: nextSale.name,
      assignedAt: new Date().toISOString(),
      acceptedAt: undefined,
      noAnswerCount: 0, // Reset đếm sau khi rotate sang Sale mới
      rotationCount: currentRotationCount,
      rotationHistory: [rotationRecord, ...(lead.rotationHistory || [])],
      updatedAt: new Date().toISOString(),
    };

    const reasonLabel = reason === 'sla_accept_timeout'
      ? 'Quá hạn 30 phút chưa nhận'
      : reason === 'max_attempts_no_answer'
      ? 'Chăm sóc 2 lần không nghe máy'
      : 'Quyết định từ Quản lý';

    return LeadAuditEngine.recordEvent(
      updatedLead,
      'lead_rotated',
      actorId,
      actorName,
      `Đã xoay Lead (vòng ${currentRotationCount}/${this.ruleEngine.getConfig().maxRotations}) từ [${lead.currentSaleName || 'Chưa phân'}] sang [${nextSale.name}]. Lý do: ${reasonLabel}`,
      { rotationRecord }
    );
  }
}
