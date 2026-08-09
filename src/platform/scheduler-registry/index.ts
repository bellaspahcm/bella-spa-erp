/**
 * @fileoverview Platform Scheduler Registry
 *
 * Centralized registry for scheduled tasks and cron jobs.
 * - Named job registration with cron-like schedules
 * - Manual trigger support
 * - Execution history tracking
 * - Tenant-scoped and global schedules
 * - Last-run / next-run tracking
 * - Integration with Integration Hub for async execution
 *
 * NOTE: This is a registry and scheduler — actual execution via
 *       setInterval in dev or Edge Cron / Vercel Cron in production.
 *
 * @module platform/scheduler-registry
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleInterval =
  | 'every_minute'
  | 'every_5_minutes'
  | 'every_15_minutes'
  | 'every_30_minutes'
  | 'hourly'
  | 'every_6_hours'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | string; // cron expression or custom label

export type ScheduledJobStatus = 'active' | 'paused' | 'disabled' | 'running';

export interface ScheduledJobDefinition {
  /** Unique key across the platform (e.g. 'accounting.worker', 'sla.scanner') */
  key: string;
  name: string;
  description?: string;
  /** Cron expression or named interval */
  schedule: ScheduleInterval;
  /** Tenant scope (null = runs for all tenants) */
  tenantId: string | null;
  /** The job handler */
  handler: (context: ScheduleContext) => Promise<ScheduleJobResult>;
  /** Max execution time before timeout warning (ms) */
  timeoutMs?: number;
  /** Whether to run immediately on registration */
  runOnStart?: boolean;
  /** Tags for filtering */
  tags?: string[];
}

export interface ScheduleContext {
  /** Which tenant this run is for (null = global run) */
  tenantId: string | null;
  jobKey: string;
  runId: string;
  /** ISO: when this run was triggered */
  triggeredAt: string;
  /** 'scheduled' | 'manual' */
  triggerType: 'scheduled' | 'manual';
}

export interface ScheduleJobResult {
  success: boolean;
  message?: string;
  recordsProcessed?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface JobRunRecord {
  runId: string;
  jobKey: string;
  tenantId: string | null;
  triggerType: 'scheduled' | 'manual';
  status: 'running' | 'completed' | 'failed' | 'timeout';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  result?: ScheduleJobResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interval → milliseconds mapping
// ─────────────────────────────────────────────────────────────────────────────

const INTERVAL_MS: Record<ScheduleInterval, number> = {
  every_minute:    60 * 1000,
  every_5_minutes: 5 * 60 * 1000,
  every_15_minutes:15 * 60 * 1000,
  every_30_minutes:30 * 60 * 1000,
  hourly:          60 * 60 * 1000,
  every_6_hours:   6 * 60 * 60 * 1000,
  daily:           24 * 60 * 60 * 1000,
  weekly:          7 * 24 * 60 * 60 * 1000,
  monthly:         30 * 24 * 60 * 60 * 1000,
};

function getIntervalMs(schedule: ScheduleInterval): number {
  return INTERVAL_MS[schedule] ?? 60 * 60 * 1000; // default hourly
}

function generateRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Registry
// ─────────────────────────────────────────────────────────────────────────────

class SchedulerRegistryClass {
  private readonly jobs = new Map<string, ScheduledJobDefinition>();
  private readonly jobStatus = new Map<string, ScheduledJobStatus>();
  private readonly runHistory = new Map<string, JobRunRecord[]>(); // jobKey → runs (newest first)
  private readonly lastRun = new Map<string, string>();  // jobKey → ISO timestamp
  private readonly nextRun = new Map<string, string>();  // jobKey → ISO timestamp
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  private readonly MAX_HISTORY_PER_JOB = 50;

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a scheduled job.
   * In production, actual scheduling is done by Vercel Cron / Edge Cron.
   * This registry tracks metadata and provides manual trigger + history.
   */
  register(def: ScheduledJobDefinition): void {
    this.jobs.set(def.key, def);
    this.jobStatus.set(def.key, 'active');

    const intervalMs = getIntervalMs(def.schedule);
    this.nextRun.set(def.key, new Date(Date.now() + intervalMs).toISOString());

    // In development: set up actual interval
    if (typeof globalThis.setInterval !== 'undefined' && def.runOnStart !== false) {
      const timer = setInterval(() => {
        this.trigger(def.key, 'scheduled').catch((err) => {
          console.error('[Scheduler] Auto-trigger failed for job %s:', def.key, err);
        });
      }, intervalMs);
      this.timers.set(def.key, timer);
    }
  }

  /** Deregister a job and stop its timer */
  deregister(key: string): boolean {
    const timer = this.timers.get(key);
    if (timer) { clearInterval(timer); this.timers.delete(key); }
    this.jobStatus.delete(key);
    return this.jobs.delete(key);
  }

  // ── Control ───────────────────────────────────────────────────────────────

  pause(key: string): boolean {
    if (!this.jobs.has(key)) return false;
    const timer = this.timers.get(key);
    if (timer) { clearInterval(timer); this.timers.delete(key); }
    this.jobStatus.set(key, 'paused');
    return true;
  }

  resume(key: string): boolean {
    const def = this.jobs.get(key);
    if (!def) return false;
    this.jobStatus.set(key, 'active');
    const intervalMs = getIntervalMs(def.schedule);
    const timer = setInterval(() => {
      this.trigger(key, 'scheduled').catch((err) => {
        console.error('[Scheduler] Auto-trigger failed for job %s:', key, err);
      });
    }, intervalMs);
    this.timers.set(key, timer);
    this.nextRun.set(key, new Date(Date.now() + intervalMs).toISOString());
    return true;
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Manually trigger a job by key.
   * Works in both dev and production (Vercel Cron calls this).
   */
  async trigger(key: string, triggerType: 'scheduled' | 'manual' = 'manual'): Promise<JobRunRecord> {
    const def = this.jobs.get(key);
    if (!def) throw new Error(`[Scheduler] Job not found: ${key}`);

    const status = this.jobStatus.get(key);
    if (status === 'paused' || status === 'disabled') {
      throw new Error(`[Scheduler] Job "${key}" is ${status} — cannot trigger`);
    }

    const runId = generateRunId();
    const startedAt = new Date().toISOString();
    const runRecord: JobRunRecord = {
      runId, jobKey: key, tenantId: def.tenantId,
      triggerType, status: 'running', startedAt,
    };

    this.jobStatus.set(key, 'running');
    this.recordRun(key, runRecord);

    const ctx: ScheduleContext = {
      tenantId: def.tenantId,
      jobKey: key,
      runId,
      triggeredAt: startedAt,
      triggerType,
    };

    const startMs = Date.now();

    try {
      const result = await def.handler(ctx);
      const durationMs = Date.now() - startMs;

      runRecord.status = result.success ? 'completed' : 'failed';
      runRecord.finishedAt = new Date().toISOString();
      runRecord.durationMs = durationMs;
      runRecord.result = result;

      this.lastRun.set(key, runRecord.finishedAt);
      const intervalMs = getIntervalMs(def.schedule);
      this.nextRun.set(key, new Date(Date.now() + intervalMs).toISOString());
    } catch (err: unknown) {
      runRecord.status = 'failed';
      runRecord.finishedAt = new Date().toISOString();
      runRecord.durationMs = Date.now() - startMs;
      runRecord.result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
      console.error('[Scheduler] Job "%s" failed on run %s:', key, runId, err);
    } finally {
      this.jobStatus.set(key, status === 'running' ? 'active' : (status ?? 'active'));
    }

    return runRecord;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  getJob(key: string): ScheduledJobDefinition | undefined {
    return this.jobs.get(key);
  }

  listJobs(filter?: { tenantId?: string | null; tags?: string[] }): Array<ScheduledJobDefinition & {
    status: ScheduledJobStatus;
    lastRun?: string;
    nextRun?: string;
  }> {
    let defs = Array.from(this.jobs.values());
    if (filter?.tenantId !== undefined) {
      defs = defs.filter((d) => d.tenantId === filter.tenantId);
    }
    if (filter?.tags?.length) {
      defs = defs.filter((d) => filter.tags!.some((t) => d.tags?.includes(t)));
    }
    return defs.map((d) => ({
      ...d,
      status: this.jobStatus.get(d.key) ?? 'active',
      lastRun: this.lastRun.get(d.key),
      nextRun: this.nextRun.get(d.key),
    }));
  }

  getRunHistory(key: string, limit = 20): JobRunRecord[] {
    return (this.runHistory.get(key) ?? []).slice(0, limit);
  }

  getLastRun(key: string): string | undefined {
    return this.lastRun.get(key);
  }

  getNextRun(key: string): string | undefined {
    return this.nextRun.get(key);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private recordRun(key: string, record: JobRunRecord): void {
    if (!this.runHistory.has(key)) this.runHistory.set(key, []);
    const history = this.runHistory.get(key)!;
    history.unshift(record);
    if (history.length > this.MAX_HISTORY_PER_JOB) history.splice(this.MAX_HISTORY_PER_JOB);
  }
}

export const schedulerRegistry = new SchedulerRegistryClass();
