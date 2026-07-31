/**
 * Bella EIP — Escalation Capability (Phase 2 Runtime)
 * Automatically triggers Manager Escalation when SLA breached or max rotation count exceeded
 */

import { ResourceRef, UniversalExecutionContext } from './types';
import { notificationCapability } from './notification-capability';
import { resourceDBService } from './resource-db-service';

export interface EscalationRule {
  maxRotationAttempts: number;
  managerRoleId: string;
  managerUserId?: string;
  autoEscalateOnBreach: boolean;
}

export class EscalationCapability {
  private defaultRule: EscalationRule = {
    maxRotationAttempts: 3,
    managerRoleId: 'floor_manager',
    autoEscalateOnBreach: true,
  };

  /**
   * Evaluates if a Resource requires Manager Escalation
   */
  public async evaluateAndEscalate(
    resource: ResourceRef,
    currentRotationCount: number,
    isSLABreached: boolean,
    managerUserId: string,
    rule: Partial<EscalationRule> = {},
    context?: UniversalExecutionContext
  ): Promise<{ escalated: boolean; reason?: string }> {
    const activeRule = { ...this.defaultRule, ...rule };

    const shouldEscalate =
      currentRotationCount >= activeRule.maxRotationAttempts ||
      (isSLABreached && activeRule.autoEscalateOnBreach);

    if (!shouldEscalate) {
      return { escalated: false };
    }

    const reason =
      currentRotationCount >= activeRule.maxRotationAttempts
        ? `Đã xoay vòng quá ${activeRule.maxRotationAttempts} lần mà chưa có Sale xác nhận chăm sóc.`
        : `Resource bị trễ SLA nghiêm trọng cần sự can thiệp của Quản lý.`;

    // 1. Send High-Priority Notification to Floor Manager
    await notificationCapability.sendNotification(
      {
        tenantId: resource.tenantId,
        recipientId: managerUserId,
        title: `🚨 LEO THANG QUẢN LÝ (ESCALATION): ${resource.resourceType.toUpperCase()} #${resource.resourceId}`,
        message: `Hệ thống vừa kích hoạt Leo Thang cho Quản lý sàn. Lý do: ${reason}`,
        type: 'ESCALATION',
        channel: 'IN_APP',
        resource,
      },
      context
    );

    // 2. Log Escalation Audit Fact Event
    await resourceDBService.logAuditEvent(
      resource,
      'resource.escalated.v1',
      context?.actor.userId || 'system_escalation_engine',
      context?.actor.userName || 'System Escalation Engine',
      `Escalated Resource ${resource.resourceId} to Floor Manager (${managerUserId}). Reason: ${reason}`,
      { rotationCount: currentRotationCount, isSLABreached, reason }
    );

    return { escalated: true, reason };
  }
}

export const escalationCapability = new EscalationCapability();
