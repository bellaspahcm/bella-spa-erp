/**
 * @fileoverview Platform Integration Hub — Dead Letter Queue (DLQ)
 *
 * Reliable job queue with:
 * - Priority levels and scheduling
 * - Exponential backoff retry
 * - Dead Letter Queue for permanently failed jobs
 * - Job lifecycle tracking
 * - Pluggable processor pattern
 *
 * Use for: MISA sync, webhook delivery, Facebook lead import,
 *          outbound API calls, async report generation.
 *
 * @module platform/integration-hub
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'dead_letter' | 'cancelled';
export type JobPriority = 'critical' | 'high' | 'normal' | 'low';

export type IntegrationJobType =
  | 'misa.sync.journal'
  | 'misa.sync.invoice'
  | 'webhook.deliver'
  | 'facebook.lead.import'
  | 'zalo.message.send'
  | 'email.send'
  | 'report.generate'
  | 'data.export'
  | 'salary.recalculate'
  | string;

export interface IntegrationJob<TPayload = Record<string, unknown>> {
  id: string;
  type: IntegrationJobType;
  tenantId: string;
  payload: TPayload;
  priority: JobPriority;
  status: JobStatus;
  /** Current attempt count (0-indexed) */
  attempt: number;
  /** Max allowed attempts before DLQ */
  maxAttempts: number;
  /** ISO: when to run */
  scheduledAt: string;
  /** ISO: when job was created */
  createdAt: string;
  /** ISO: when last processed */
  lastProcessedAt?: string;
  /** ISO: when completed/failed permanently */
  finishedAt?: string;
  /** Last error message */
  lastError?: string;
  /** All error history */
  errorHistory?: string[];
  /** Result from successful processing */
  result?: unknown;
  /** Tags for filtering */
  tags?: string[];
}

export interface JobResult {
  success: boolean;
  result?: unknown;
  error?: string;
  /** If true, retry will be skipped and job goes to DLQ immediately */
  fatal?: boolean;
}

export type JobHandler<TPayload = Record<string, unknown>> = (
  job: IntegrationJob<TPayload>
) => Promise<JobResult>;

export interface ProcessBatchResult {
  processed: number;
  completed: number;
  failed: number;
  dlq: number;
  skipped: number;
}

export interface DlqEntry {
  job: IntegrationJob;
  reason: string;
  movedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry Backoff
// ─────────────────────────────────────────────────────────────────────────────

const BACKOFF_SCHEDULE_SECONDS = [30, 120, 600, 1800, 7200]; // 30s, 2m, 10m, 30m, 2h

function nextScheduledAt(attempt: number): string {
  const delaySeconds = BACKOFF_SCHEDULE_SECONDS[Math.min(attempt, BACKOFF_SCHEDULE_SECONDS.length - 1)];
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

function generateJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration Hub
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<JobPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

class IntegrationHubClass {
  private readonly queue = new Map<string, IntegrationJob>();
  private readonly handlers = new Map<string, JobHandler>();
  private readonly dlq = new Map<string, DlqEntry>();

  // ── Job Registration ───────────────────────────────────────────────────────

  /** Register a handler for a job type */
  register<TPayload = Record<string, unknown>>(type: IntegrationJobType, handler: JobHandler<TPayload>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  // ── Enqueueing ────────────────────────────────────────────────────────────

  /** Enqueue a new job */
  enqueue<TPayload = Record<string, unknown>>(params: {
    type: IntegrationJobType;
    tenantId: string;
    payload: TPayload;
    priority?: JobPriority;
    maxAttempts?: number;
    scheduledAt?: string;
    tags?: string[];
  }): IntegrationJob<TPayload> {
    const job: IntegrationJob<TPayload> = {
      id: generateJobId(),
      type: params.type,
      tenantId: params.tenantId,
      payload: params.payload,
      priority: params.priority ?? 'normal',
      status: 'queued',
      attempt: 0,
      maxAttempts: params.maxAttempts ?? 5,
      scheduledAt: params.scheduledAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
      tags: params.tags,
    };
    this.queue.set(job.id, job as IntegrationJob);
    return job;
  }

  // ── Processing ────────────────────────────────────────────────────────────

  /**
   * Process a batch of ready jobs.
   * @param batchSize max jobs to process in one call (default 10)
   */
  async processBatch(batchSize = 10): Promise<ProcessBatchResult> {
    const result: ProcessBatchResult = { processed: 0, completed: 0, failed: 0, dlq: 0, skipped: 0 };
    const now = new Date().toISOString();

    // Pick ready jobs sorted by priority then scheduledAt
    const readyJobs = Array.from(this.queue.values())
      .filter((j) => j.status === 'queued' && j.scheduledAt <= now)
      .sort((a, b) => {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return pd !== 0 ? pd : a.scheduledAt.localeCompare(b.scheduledAt);
      })
      .slice(0, batchSize);

    for (const job of readyJobs) {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        job.status = 'failed';
        job.lastError = `No handler registered for job type: ${job.type}`;
        result.skipped++;
        continue;
      }

      job.status = 'processing';
      job.lastProcessedAt = new Date().toISOString();
      result.processed++;

      try {
        const jobResult = await handler(job);

        if (jobResult.success) {
          job.status = 'completed';
          job.result = jobResult.result;
          job.finishedAt = new Date().toISOString();
          this.queue.delete(job.id);
          result.completed++;
        } else {
          // Fatal error → DLQ immediately
          if (jobResult.fatal) {
            this.moveToDlq(job, jobResult.error ?? 'Fatal error, no retry');
            result.dlq++;
          } else {
            this.scheduleRetry(job, jobResult.error ?? 'Job failed');
            result.failed++;
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.scheduleRetry(job, errMsg);
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Process a single job by ID.
   */
  async processJob(jobId: string): Promise<JobResult> {
    const job = this.queue.get(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    const handler = this.handlers.get(job.type);
    if (!handler) return { success: false, error: `No handler for ${job.type}`, fatal: true };

    job.status = 'processing';
    job.lastProcessedAt = new Date().toISOString();

    try {
      const result = await handler(job);
      if (result.success) {
        job.status = 'completed';
        job.result = result.result;
        job.finishedAt = new Date().toISOString();
        this.queue.delete(jobId);
      } else if (result.fatal) {
        this.moveToDlq(job, result.error ?? 'Fatal error');
      } else {
        this.scheduleRetry(job, result.error ?? 'Unknown error');
      }
      return result;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.scheduleRetry(job, errMsg);
      return { success: false, error: errMsg };
    }
  }

  // ── Queue Management ──────────────────────────────────────────────────────

  getJob(jobId: string): IntegrationJob | undefined {
    return this.queue.get(jobId);
  }

  cancelJob(jobId: string): boolean {
    const job = this.queue.get(jobId);
    if (!job || job.status === 'processing') return false;
    job.status = 'cancelled';
    job.finishedAt = new Date().toISOString();
    this.queue.delete(jobId);
    return true;
  }

  listJobs(filter?: {
    tenantId?: string;
    type?: string;
    status?: JobStatus;
    limit?: number;
  }): IntegrationJob[] {
    let jobs = Array.from(this.queue.values());
    if (filter?.tenantId) jobs = jobs.filter((j) => j.tenantId === filter.tenantId);
    if (filter?.type) jobs = jobs.filter((j) => j.type === filter.type);
    if (filter?.status) jobs = jobs.filter((j) => j.status === filter.status);
    return jobs.slice(0, filter?.limit ?? 100);
  }

  queueSize(tenantId?: string): number {
    let jobs = Array.from(this.queue.values()).filter((j) => j.status === 'queued');
    if (tenantId) jobs = jobs.filter((j) => j.tenantId === tenantId);
    return jobs.length;
  }

  // ── DLQ Management ────────────────────────────────────────────────────────

  getDlq(tenantId?: string): DlqEntry[] {
    let entries = Array.from(this.dlq.values());
    if (tenantId) entries = entries.filter((e) => e.job.tenantId === tenantId);
    return entries.sort((a, b) => b.movedAt.localeCompare(a.movedAt));
  }

  /** Re-enqueue a DLQ job (reset attempt count) */
  retryFromDlq(jobId: string): IntegrationJob | undefined {
    const entry = this.dlq.get(jobId);
    if (!entry) return undefined;
    this.dlq.delete(jobId);
    const retried: IntegrationJob = {
      ...entry.job,
      status: 'queued',
      attempt: 0,
      scheduledAt: new Date().toISOString(),
      lastError: undefined,
      errorHistory: entry.job.errorHistory,
    };
    this.queue.set(retried.id, retried);
    return retried;
  }

  clearDlq(tenantId?: string): number {
    let count = 0;
    for (const [k, v] of [...this.dlq.entries()]) {
      if (!tenantId || v.job.tenantId === tenantId) {
        this.dlq.delete(k);
        count++;
      }
    }
    return count;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private scheduleRetry(job: IntegrationJob, error: string): void {
    job.attempt += 1;
    job.lastError = error;
    job.errorHistory = [...(job.errorHistory ?? []), `[Attempt ${job.attempt}] ${error}`];

    if (job.attempt >= job.maxAttempts) {
      this.moveToDlq(job, error);
    } else {
      job.status = 'queued';
      job.scheduledAt = nextScheduledAt(job.attempt);
    }
  }

  private moveToDlq(job: IntegrationJob, reason: string): void {
    job.status = 'dead_letter';
    job.finishedAt = new Date().toISOString();
    job.lastError = reason;
    this.dlq.set(job.id, { job: { ...job }, reason, movedAt: new Date().toISOString() });
    this.queue.delete(job.id);

    console.error('[IntegrationHub DLQ] Job moved to dead letter queue. Type: %s, ID: %s, Reason: %s',
      job.type, job.id, reason);
  }
}

export const integrationHub = new IntegrationHubClass();
