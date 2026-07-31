import { ManagedLead } from './types';
import { LeadSLAEngine } from './sla-engine';
import { LeadAuditEngine } from './audit-engine';
import { SalesAgent } from './rotation-engine';

export class LeadAssignmentEngine {
  private slaEngine: LeadSLAEngine;

  constructor(slaEngine: LeadSLAEngine) {
    this.slaEngine = slaEngine;
  }

  /**
   * Phân bổ Lead ban đầu cho một Sale agent và kích hoạt SLA chờ nhận (Accept SLA 30m)
   */
  public assignLead(
    lead: ManagedLead,
    targetSale: SalesAgent,
    assignerId: string = 'system',
    assignerName: string = 'Lead Assignment Engine'
  ): ManagedLead {
    const nowISO = new Date().toISOString();

    let assignedLead: ManagedLead = {
      ...lead,
      state: 'waiting_accept',
      currentSaleId: targetSale.id,
      currentSaleName: targetSale.name,
      assignedAt: nowISO,
      updatedAt: nowISO,
    };

    // 1. Ghi nhận sự kiện phân công
    assignedLead = LeadAuditEngine.recordEvent(
      assignedLead,
      'lead_assigned',
      assignerId,
      assignerName,
      `Đã phân bổ Lead cho Sale [${targetSale.name}]. Trạng thái: Chờ nhận lead.`
    );

    // 2. Kích hoạt Timer SLA Chờ Nhận
    assignedLead = this.slaEngine.startAcceptTimer(assignedLead);

    return assignedLead;
  }
}
