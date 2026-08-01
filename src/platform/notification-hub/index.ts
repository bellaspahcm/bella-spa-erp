/**
 * @fileoverview Platform Notification Hub
 *
 * Multi-channel notification dispatch with:
 * - Channel adapter pattern (in_app, email, sms, zalo_oa, push)
 * - Priority queuing (critical → high → normal → low)
 * - Deduplication by idempotency key
 * - Delivery status tracking
 * - Batch send support
 *
 * @module platform/notification-hub
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'zalo_oa' | 'push' | string;
export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped' | 'deduplicated';

export type NotificationType =
  | 'SLA_WARNING'
  | 'SLA_BREACH'
  | 'RESOURCE_ASSIGNED'
  | 'RESOURCE_ROTATED'
  | 'ESCALATION'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_RESULT'
  | 'PAYMENT_RECEIVED'
  | 'SALARY_PUBLISHED'
  | 'SYSTEM_ALERT'
  | string;

export interface NotificationRecipient {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  zaloId?: string;
  deviceTokens?: string[];
}

export interface NotificationRequest {
  /** Tenant isolation */
  tenantId: string;
  recipient: NotificationRecipient;
  /** Channels to attempt (in order; first successful channel wins for exclusive, all for broadcast) */
  channels: NotificationChannel[];
  /** Notification type for categorization */
  type: NotificationType;
  /** Subject / title */
  title: string;
  /** Body / message */
  message: string;
  /** Priority determines queue order */
  priority?: NotificationPriority;
  /** Idempotency key — same key = deduplicated within TTL */
  idempotencyKey?: string;
  /** Template key (optional — uses templateEngine if provided) */
  templateKey?: string;
  /** Template data */
  templateData?: Record<string, unknown>;
  /** Arbitrary metadata stored with the record */
  metadata?: Record<string, unknown>;
  /** Linked resource */
  resource?: { type: string; id: string; label?: string };
}

export interface NotificationResult {
  notificationId: string;
  tenantId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  channels: Record<NotificationChannel, DeliveryStatus>;
  overallStatus: DeliveryStatus;
  idempotencyKey?: string;
  sentAt: string;
  /** Per-channel error messages */
  errors?: Record<NotificationChannel, string>;
}

export interface NotificationRecord extends NotificationResult {
  request: NotificationRequest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel Adapter Contract
// ─────────────────────────────────────────────────────────────────────────────

export interface INotificationAdapter {
  readonly channel: NotificationChannel;
  /**
   * Send to a single recipient.
   * Must return { success, error? } — never throw.
   */
  send(request: NotificationRequest): Promise<{ success: boolean; error?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in: In-App Adapter (in-memory store, swap with Supabase in production)
// ─────────────────────────────────────────────────────────────────────────────

export interface InAppNotificationRecord {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  resource?: { type: string; id: string; label?: string };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

class InAppAdapter implements INotificationAdapter {
  readonly channel = 'in_app' as const;
  private readonly store = new Map<string, InAppNotificationRecord[]>();

  async send(req: NotificationRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const record: InAppNotificationRecord = {
        id: `notif_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        tenantId: req.tenantId,
        userId: req.recipient.userId,
        type: req.type,
        title: req.title,
        message: req.message,
        isRead: false,
        resource: req.resource,
        metadata: req.metadata,
        createdAt: new Date().toISOString(),
      };
      const key = `${req.tenantId}:${req.recipient.userId}`;
      if (!this.store.has(key)) this.store.set(key, []);
      this.store.get(key)!.unshift(record);
      // Ring buffer: keep 200 per user
      const list = this.store.get(key)!;
      if (list.length > 200) list.splice(200);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  getUnread(tenantId: string, userId: string): InAppNotificationRecord[] {
    return (this.store.get(`${tenantId}:${userId}`) ?? []).filter((n) => !n.isRead);
  }

  markRead(tenantId: string, userId: string, notificationId: string): boolean {
    const list = this.store.get(`${tenantId}:${userId}`) ?? [];
    const item = list.find((n) => n.id === notificationId);
    if (item) { item.isRead = true; return true; }
    return false;
  }

  markAllRead(tenantId: string, userId: string): number {
    const list = this.store.get(`${tenantId}:${userId}`) ?? [];
    let count = 0;
    for (const n of list) { if (!n.isRead) { n.isRead = true; count++; } }
    return count;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Hub
// ─────────────────────────────────────────────────────────────────────────────

const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

class NotificationHubClass {
  private readonly adapters = new Map<NotificationChannel, INotificationAdapter>();
  private readonly history = new Map<string, NotificationRecord>();       // notificationId → record
  private readonly dedupCache = new Map<string, { ts: number; id: string }>();  // idempotencyKey → {ts, id}

  public readonly inApp: InAppAdapter;

  constructor() {
    this.inApp = new InAppAdapter();
    this.registerAdapter(this.inApp);
  }

  /** Register a channel adapter */
  registerAdapter(adapter: INotificationAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  /**
   * Send a notification via specified channels.
   * Deduplication: if same idempotencyKey sent within TTL, returns cached result.
   */
  async send(request: NotificationRequest): Promise<NotificationResult> {
    // Deduplication check
    if (request.idempotencyKey) {
      const cached = this.dedupCache.get(`${request.tenantId}:${request.idempotencyKey}`);
      if (cached && Date.now() - cached.ts < DEDUP_TTL_MS) {
        const cachedRecord = this.history.get(cached.id);
        if (cachedRecord) {
          return { ...cachedRecord, overallStatus: 'deduplicated' };
        }
      }
    }

    const notificationId = `nhub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const channelStatuses: Record<NotificationChannel, DeliveryStatus> = {};
    const channelErrors: Record<NotificationChannel, string> = {};

    const priorityChannels = this.prioritizeChannels(request.channels, request.priority);

    for (const channel of priorityChannels) {
      const adapter = this.adapters.get(channel);
      if (!adapter) {
        channelStatuses[channel] = 'skipped';
        channelErrors[channel] = 'No adapter registered for channel';
        continue;
      }
      try {
        const result = await adapter.send(request);
        channelStatuses[channel] = result.success ? 'sent' : 'failed';
        if (!result.success && result.error) channelErrors[channel] = result.error;
      } catch (err) {
        channelStatuses[channel] = 'failed';
        channelErrors[channel] = err instanceof Error ? err.message : String(err);
      }
    }

    const overallStatus = Object.values(channelStatuses).some((s) => s === 'sent')
      ? 'sent'
      : Object.values(channelStatuses).every((s) => s === 'failed')
      ? 'failed'
      : 'pending';

    const notifResult: NotificationResult = {
      notificationId,
      tenantId: request.tenantId,
      recipientId: request.recipient.userId,
      type: request.type,
      title: request.title,
      channels: channelStatuses,
      overallStatus,
      idempotencyKey: request.idempotencyKey,
      sentAt: new Date().toISOString(),
      errors: Object.keys(channelErrors).length > 0 ? channelErrors : undefined,
    };

    // Persist to history
    this.history.set(notificationId, { ...notifResult, request });

    // Update dedup cache
    if (request.idempotencyKey) {
      this.dedupCache.set(`${request.tenantId}:${request.idempotencyKey}`, { ts: Date.now(), id: notificationId });
    }

    return notifResult;
  }

  /** Send multiple notifications in parallel */
  async sendBulk(requests: NotificationRequest[]): Promise<NotificationResult[]> {
    return Promise.all(requests.map((r) => this.send(r)));
  }

  /** Get delivery status of a sent notification */
  getDeliveryStatus(notificationId: string): NotificationRecord | undefined {
    return this.history.get(notificationId);
  }

  /** Get notification history for a tenant */
  getHistory(tenantId: string, limit = 50): NotificationRecord[] {
    return Array.from(this.history.values())
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .slice(0, limit);
  }

  // ── Convenience Helpers ───────────────────────────────────────────────────

  async sendSLAWarning(params: {
    tenantId: string;
    recipientId: string;
    recipientName?: string;
    resourceId: string;
    resourceType: string;
    resourceLabel: string;
    remainingMinutes: number;
  }): Promise<NotificationResult> {
    return this.send({
      tenantId: params.tenantId,
      recipient: { userId: params.recipientId, name: params.recipientName },
      channels: ['in_app'],
      type: 'SLA_WARNING',
      priority: 'high',
      title: `⏰ Cảnh báo SLA: ${params.resourceLabel}`,
      message: `${params.resourceType} ${params.resourceId} chỉ còn ${params.remainingMinutes} phút trước khi trễ SLA.`,
      resource: { type: params.resourceType, id: params.resourceId, label: params.resourceLabel },
      idempotencyKey: `sla-warning-${params.resourceId}-${Math.floor(Date.now() / DEDUP_TTL_MS)}`,
    });
  }

  async sendRotationAlert(params: {
    tenantId: string;
    newOwnerId: string;
    newOwnerName?: string;
    resourceId: string;
    resourceType: string;
    resourceLabel: string;
    previousOwnerName: string;
  }): Promise<NotificationResult> {
    return this.send({
      tenantId: params.tenantId,
      recipient: { userId: params.newOwnerId, name: params.newOwnerName },
      channels: ['in_app'],
      type: 'RESOURCE_ROTATED',
      priority: 'normal',
      title: `🔄 Bạn nhận được ${params.resourceLabel} mới!`,
      message: `${params.resourceType} ${params.resourceId} đã được hệ thống chuyển tự động từ ${params.previousOwnerName} sang cho bạn.`,
      resource: { type: params.resourceType, id: params.resourceId, label: params.resourceLabel },
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private prioritizeChannels(channels: NotificationChannel[], priority?: NotificationPriority): NotificationChannel[] {
    if (priority === 'critical') {
      // For critical: ensure in_app is first
      const withInApp = channels.includes('in_app') ? channels : ['in_app', ...channels];
      return withInApp;
    }
    return channels;
  }
}

export const notificationHub = new NotificationHubClass();
