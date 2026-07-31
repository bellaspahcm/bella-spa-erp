/**
 * Bella EIP — Notification Capability (Phase 2 Runtime)
 * Handles In-App Alerts, Zalo OA Messages, and Email Notifications for Resource SLA & Rotations
 */

import { supabase } from '@/lib/supabase';
import { ResourceRef, UniversalExecutionContext } from './types';
import { resourceDBService } from './resource-db-service';

export interface NotificationPayload {
  tenantId: string;
  recipientId: string;
  title: string;
  message: string;
  type?: 'SLA_WARNING' | 'SLA_BREACH' | 'RESOURCE_ROTATED' | 'ESCALATION';
  channel?: 'IN_APP' | 'ZALO_OA' | 'EMAIL';
  resource?: ResourceRef;
  metadata?: Record<string, unknown>;
}

export class NotificationCapability {
  /**
   * Send In-App Notification & Persist to app_notifications
   */
  public async sendNotification(
    payload: NotificationPayload,
    context?: UniversalExecutionContext
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dbPayload = {
        tenant_id: payload.tenantId,
        user_id: payload.recipientId,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'SLA_WARNING',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('app_notifications').insert(dbPayload);

      if (error) {
        if (context?.services?.logger) {
          context.services.logger('error', 'Failed to insert app_notification: %s', error.message);
        }
        return { success: false, error: error.message };
      }

      // Log Audit Event
      if (payload.resource) {
        await resourceDBService.logAuditEvent(
          payload.resource,
          'resource.notification.sent.v1',
          context?.actor.userId || 'system',
          context?.actor.userName || 'System Notification Engine',
          `Notification sent to user ${payload.recipientId}: ${payload.title}`
        );
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Helper: Send SLA Warning Alert
   */
  public async sendSLAWarningAlert(
    resource: ResourceRef,
    recipientId: string,
    resourceLabel: string,
    remainingMinutes: number,
    context?: UniversalExecutionContext
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendNotification(
      {
        tenantId: resource.tenantId,
        recipientId,
        title: `⏰ Cảnh báo SLA: ${resourceLabel}`,
        message: `Resource ${resource.resourceId} chỉ còn ${remainingMinutes} phút trước khi trễ SLA và bị tự động xoay vòng!`,
        type: 'SLA_WARNING',
        channel: 'IN_APP',
        resource,
      },
      context
    );
  }

  /**
   * Helper: Send Rotation Alert to New Owner
   */
  public async sendRotationAlert(
    resource: ResourceRef,
    newOwnerId: string,
    resourceLabel: string,
    previousOwnerName: string,
    context?: UniversalExecutionContext
  ): Promise<{ success: boolean; error?: string }> {
    return this.sendNotification(
      {
        tenantId: resource.tenantId,
        recipientId: newOwnerId,
        title: `🔄 Bạn nhận được ${resourceLabel} mới!`,
        message: `Resource ${resource.resourceId} đã được hệ thống chuyển tự động từ ${previousOwnerName} sang cho bạn chăm sóc.`,
        type: 'RESOURCE_ROTATED',
        channel: 'IN_APP',
        resource,
      },
      context
    );
  }
}

export const notificationCapability = new NotificationCapability();
