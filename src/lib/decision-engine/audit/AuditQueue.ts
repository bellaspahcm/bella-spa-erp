/**
 * Audit Queue System
 * 
 * In-memory queue with retry logic and DLQ for resilient audit logging.
 * 
 * Features:
 * - Exponential backoff retry (3 attempts)
 * - Dead Letter Queue (DLQ) for failed items
 * - Circuit breaker integration
 * - Background worker processing
 * - Metrics tracking (pending, failed, retrying)
 * 
 * Future: Can be replaced with Redis/BullMQ for distributed systems
 */

interface QueueItem {
  id: string;
  payload: any;
  attempt: number;
  maxAttempts: number;
  enqueuedAt: number;
  lastAttemptAt?: number;
  error?: string;
}

interface QueueMetrics {
  pending: number;
  processing: number;
  failed: number;
  deadLetters: number;
  retrying: number;
  successCount: number;
  failureCount: number;
}

export class AuditQueue {
  private queue: QueueItem[] = [];
  private dlq: QueueItem[] = []; // Dead Letter Queue
  private processing = new Set<string>();
  private isProcessing = false;
  private metrics: QueueMetrics = {
    pending: 0,
    processing: 0,
    failed: 0,
    deadLetters: 0,
    retrying: 0,
    successCount: 0,
    failureCount: 0,
  };

  constructor(
    private processor: (payload: any) => Promise<void>,
    private options: {
      maxAttempts?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      processingIntervalMs?: number;
      dlqMaxSize?: number;
    } = {}
  ) {
    this.options = {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      processingIntervalMs: 100,
      dlqMaxSize: 1000,
      ...options,
    };

    // Start background worker
    this.startWorker();
  }

  /**
   * Enqueue audit log item
   */
  enqueue(payload: any): void {
    const item: QueueItem = {
      id: this.generateId(),
      payload,
      attempt: 0,
      maxAttempts: this.options.maxAttempts!,
      enqueuedAt: Date.now(),
    };

    this.queue.push(item);
    this.metrics.pending = this.queue.length;
  }

  /**
   * Start background worker
   */
  private startWorker(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const processLoop = async () => {
      while (this.isProcessing) {
        await this.processNext();
        await this.sleep(this.options.processingIntervalMs!);
      }
    };

    processLoop().catch((error) => {
      console.error('Audit queue worker crashed:', error);
      this.isProcessing = false;
    });
  }

  /**
   * Process next item in queue
   */
  private async processNext(): Promise<void> {
    // Find item ready for processing
    const now = Date.now();
    const readyIndex = this.queue.findIndex((item) => {
      // Skip if already processing
      if (this.processing.has(item.id)) return false;

      // First attempt - process immediately
      if (item.attempt === 0) return true;

      // Retry with exponential backoff
      const delay = this.calculateDelay(item.attempt);
      const nextAttemptAt = (item.lastAttemptAt || 0) + delay;
      return now >= nextAttemptAt;
    });

    if (readyIndex === -1) {
      return; // No items ready
    }

    const item = this.queue[readyIndex];
    this.processing.add(item.id);
    this.metrics.processing = this.processing.size;

    try {
      // Attempt to process
      await this.processor(item.payload);

      // Success - remove from queue
      this.queue.splice(readyIndex, 1);
      this.processing.delete(item.id);
      this.metrics.successCount++;
      this.metrics.pending = this.queue.length;
      this.metrics.processing = this.processing.size;
    } catch (error) {
      // Failure - retry or move to DLQ
      item.attempt++;
      item.lastAttemptAt = Date.now();
      item.error = error instanceof Error ? error.message : String(error);
      this.processing.delete(item.id);

      if (item.attempt >= item.maxAttempts) {
        // Max retries reached - move to DLQ
        this.queue.splice(readyIndex, 1);
        this.moveToDLQ(item);
        this.metrics.failureCount++;
      } else {
        // Will retry
        this.metrics.retrying++;
      }

      this.metrics.pending = this.queue.length;
      this.metrics.processing = this.processing.size;
      this.metrics.failed = this.queue.filter((i) => i.attempt > 0).length;
    }
  }

  /**
   * Move item to Dead Letter Queue
   */
  private moveToDLQ(item: QueueItem): void {
    // Add to DLQ
    this.dlq.push(item);

    // Enforce max DLQ size (FIFO)
    if (this.dlq.length > this.options.dlqMaxSize!) {
      const removed = this.dlq.shift();
      console.warn('DLQ full, dropping oldest item:', removed?.id);
    }

    this.metrics.deadLetters = this.dlq.length;

    console.error('Audit log moved to DLQ after max retries:', {
      id: item.id,
      attempts: item.attempt,
      error: item.error,
      enqueuedAt: new Date(item.enqueuedAt).toISOString(),
    });
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateDelay(attempt: number): number {
    const delay = this.options.baseDelayMs! * Math.pow(2, attempt - 1);
    return Math.min(delay, this.options.maxDelayMs!);
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get Dead Letter Queue items
   */
  getDLQ(): QueueItem[] {
    return [...this.dlq];
  }

  /**
   * Retry item from DLQ
   */
  retryFromDLQ(itemId: string): boolean {
    const index = this.dlq.findIndex((item) => item.id === itemId);
    if (index === -1) return false;

    const item = this.dlq.splice(index, 1)[0];
    item.attempt = 0; // Reset attempts
    item.lastAttemptAt = undefined;
    this.queue.push(item);

    this.metrics.deadLetters = this.dlq.length;
    this.metrics.pending = this.queue.length;

    return true;
  }

  /**
   * Retry all items from DLQ
   */
  retryAllFromDLQ(): number {
    const count = this.dlq.length;
    while (this.dlq.length > 0) {
      const item = this.dlq.pop()!;
      item.attempt = 0;
      item.lastAttemptAt = undefined;
      this.queue.push(item);
    }

    this.metrics.deadLetters = 0;
    this.metrics.pending = this.queue.length;

    return count;
  }

  /**
   * Clear DLQ
   */
  clearDLQ(): number {
    const count = this.dlq.length;
    this.dlq = [];
    this.metrics.deadLetters = 0;
    return count;
  }

  /**
   * Stop worker (for graceful shutdown)
   */
  async stop(): Promise<void> {
    this.isProcessing = false;

    // Wait for processing items to complete (with timeout)
    const maxWait = 5000; // 5 seconds
    const start = Date.now();

    while (this.processing.size > 0 && Date.now() - start < maxWait) {
      await this.sleep(100);
    }

    if (this.processing.size > 0) {
      console.warn('Audit queue stopped with items still processing:', this.processing.size);
    }
  }

  /**
   * Get pending queue items (for inspection)
   */
  getPending(): QueueItem[] {
    return [...this.queue];
  }

  /**
   * Helper: Generate unique ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
