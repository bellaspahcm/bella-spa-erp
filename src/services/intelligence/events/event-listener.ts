/**
 * Business Event Listener
 * 
 * Extends the Accounting Outbox Pattern to support Intelligence Layer.
 * Listens to business events and triggers cache invalidation.
 * 
 * Architecture:
 * 1. Accounting Outbox Pattern (existing) → Handles accounting transactions
 * 2. Business Event Listener (new) → Extends outbox to Intelligence Layer
 * 3. Cache Invalidation → Automatically triggered by events
 * 
 * Event Flow:
 * 1. Business transaction (e.g., BookingConfirmed) → Insert to accounting_outbox
 * 2. Accounting Worker Cron → Processes outbox → Posts journal entries
 * 3. (NEW) Event Listener → Polls accounting_outbox → Emits BusinessEvent
 * 4. (NEW) Event Handlers → Receive events → Invalidate cache
 * 5. Next Intelligence query → Cache miss → Fetch fresh data from DB
 * 
 * Implementation Strategy:
 * - Poll accounting_outbox table every 5 seconds (lightweight query)
 * - Track last processed timestamp to avoid re-processing
 * - Emit events to registered handlers
 * - Non-blocking: Event handler errors don't block polling
 */

import { BusinessEventType, EventError, type EventListener, type BusinessEvent, type EventHandler } from '../shared/types';
import { createClient } from '@/lib/supabase-client';
import type { Database } from '@/types/database.types';
import type { AccountingEventType } from '@/lib/accounting-outbox';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BusinessEventListenerConfig {
  /**
   * Polling interval in milliseconds.
   * @default 5000 (5 seconds)
   */
  pollingIntervalMs?: number;

  /**
   * Enable console logging for debugging.
   * @default false (production should be false to avoid log spam)
   */
  enableLogging?: boolean;

  /**
   * Tenant ID to filter events.
   * If provided, only events for this tenant will be processed.
   */
  tenantId?: string;
}

type OutboxRow = Database['public']['Tables']['accounting_outbox']['Row'];

// ─────────────────────────────────────────────────────────────────────────────
// Mapping: AccountingEventType → BusinessEventType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map accounting event types to business event types.
 * Some accounting events map to multiple business events.
 */
const ACCOUNTING_TO_BUSINESS_EVENT_MAP: Record<AccountingEventType, BusinessEventType[]> = {
  PACKAGE_SALE: [
    BusinessEventType.BOOKING_CREATED,
    BusinessEventType.BOOKING_CONFIRMED,
    BusinessEventType.REVENUE_RECORDED,
  ],
  SESSION_DONE: [
    BusinessEventType.SESSION_COMPLETED,
    BusinessEventType.REVENUE_RECORDED,
  ],
  EXPENSE_RECORDED: [
    BusinessEventType.EXPENSE_RECORDED,
  ],
  SALARY_PAID: [
    BusinessEventType.SALARY_PUBLISHED,
    BusinessEventType.SALARY_FINALIZED,
  ],
  INVENTORY_CONSUMED: [
    // No direct mapping yet (future enhancement)
  ],
  REFUND_ISSUED: [
    BusinessEventType.BOOKING_CANCELLED,
  ],
  INTER_BRANCH_CLEARING: [
    // Internal accounting event, no business event mapping
  ],
  MANUAL_ENTRY: [
    BusinessEventType.JOURNAL_ENTRY_POSTED,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Business Event Listener Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class BusinessEventListener implements EventListener {
  private handlers = new Map<BusinessEventType, EventHandler[]>();
  private isRunning = false;
  private pollingInterval?: NodeJS.Timeout;
  private lastProcessedTimestamp: Date;
  private readonly config: Required<BusinessEventListenerConfig>;

  constructor(config: BusinessEventListenerConfig = {}) {
    this.config = {
      pollingIntervalMs: config.pollingIntervalMs ?? 5000,
      enableLogging: config.enableLogging ?? false,
      tenantId: config.tenantId || '',
    };

    // Start from current time (don't process historical events on startup)
    this.lastProcessedTimestamp = new Date();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  on(eventType: BusinessEventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    if (this.config.enableLogging) {
      console.log(`[EventListener] Registered handler for ${eventType}`);
    }
  }

  onMany(eventTypes: BusinessEventType[], handler: EventHandler): void {
    for (const eventType of eventTypes) {
      this.on(eventType, handler);
    }
  }

  async emit(event: BusinessEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.length === 0) {
      return; // No handlers registered for this event type
    }

    // Execute all handlers concurrently
    const promises = handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(
          `[EventListener] Handler error for ${event.eventType}:`,
          error instanceof Error ? error.message : error
        );
        // Don't throw - continue processing other handlers
      }
    });

    await Promise.all(promises);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[EventListener] Already running');
      return;
    }

    this.isRunning = true;
    console.info('[EventListener] Starting event listener');

    // Start polling loop
    this.pollingInterval = setInterval(() => {
      this.poll().catch((error) => {
        console.error('[EventListener] Polling error:', error);
      });
    }, this.config.pollingIntervalMs);

    // Unref so it doesn't prevent Node.js from exiting
    this.pollingInterval.unref();

    // Run first poll immediately
    await this.poll();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[EventListener] Not running');
      return;
    }

    this.isRunning = false;
    console.info('[EventListener] Stopping event listener');

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Poll accounting_outbox for new events.
   */
  private async poll(): Promise<void> {
    try {
      const supabase = createClient();

      // Query accounting_outbox for new COMPLETED events
      let query = supabase
        .from('accounting_outbox')
        .select('*')
        .eq('status', 'COMPLETED')
        .gt('updated_at', this.lastProcessedTimestamp.toISOString())
        .order('updated_at', { ascending: true })
        .limit(100); // Process max 100 events per poll

      // Filter by tenant if configured
      if (this.config.tenantId) {
        query = query.eq('tenant_id', this.config.tenantId);
      }

      const { data: outboxRows, error } = await query;

      if (error) {
        throw new EventError('Failed to poll accounting_outbox', error);
      }

      if (!outboxRows || outboxRows.length === 0) {
        return; // No new events
      }

      if (this.config.enableLogging) {
        console.log(`[EventListener] Polled ${outboxRows.length} new events`);
      }

      // Process each event
      for (const row of outboxRows) {
        await this.processOutboxRow(row);
      }

      // Update last processed timestamp
      const lastRow = outboxRows[outboxRows.length - 1];
      if (lastRow.created_at) {
        this.lastProcessedTimestamp = new Date(lastRow.created_at);
      }
    } catch (error) {
      console.error('[EventListener] Poll error:', error);
      // Don't throw - continue polling
    }
  }

  /**
   * Process a single accounting_outbox row and emit business events.
   */
  private async processOutboxRow(row: OutboxRow): Promise<void> {
    try {
      // Map accounting event type to business event types
      const businessEventTypes = ACCOUNTING_TO_BUSINESS_EVENT_MAP[row.event_type as AccountingEventType] || [];

      if (businessEventTypes.length === 0) {
        // No mapping found, skip
        return;
      }

      // Emit all mapped business events
      for (const businessEventType of businessEventTypes) {
        const businessEvent: BusinessEvent = {
          eventType: businessEventType,
          tenantId: row.tenant_id,
          entityId: row.reference_id,
          entityType: row.reference_type,
          timestamp: new Date(row.created_at),
          payload: (row.payload as Record<string, unknown>) || {},
        };

        await this.emit(businessEvent);

        if (this.config.enableLogging) {
          console.log(`[EventListener] Emitted ${businessEventType} for ${row.reference_type}:${row.reference_id}`);
        }
      }
    } catch (error) {
      console.error(
        `[EventListener] Error processing outbox row ${row.id}:`,
        error instanceof Error ? error.message : error
      );
      // Don't throw - continue processing other rows
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global singleton instance of BusinessEventListener.
 */
let eventListenerInstance: BusinessEventListener | null = null;

/**
 * Get or create the singleton BusinessEventListener instance.
 */
export function getEventListener(config?: BusinessEventListenerConfig): BusinessEventListener {
  if (!eventListenerInstance) {
    eventListenerInstance = new BusinessEventListener(config);
  }
  return eventListenerInstance;
}

/**
 * Reset the singleton instance.
 * Used in testing or when changing configuration.
 */
export async function resetEventListener(): Promise<void> {
  if (eventListenerInstance) {
    await eventListenerInstance.stop();
    eventListenerInstance = null;
  }
}
