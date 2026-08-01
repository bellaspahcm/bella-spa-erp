/**
 * @fileoverview Platform Activity Stream Engine
 *
 * Records and queries human-readable activity streams across all verticals.
 * Used for: audit logs UI, user timelines, resource history, admin activity feeds.
 *
 * ActivityStream pattern: Actor → Verb → Object [→ Target]
 * E.g. "Alice ASSIGNED lead-123 TO Bob"
 *
 * ARCHITECTURE:
 * - In-memory ring buffer (default) — zero-config, fast
 * - Pluggable persistence backend: call `activityStream.useBackend(adapter)`
 *   to persist to Supabase, Redis, or any store
 * - Event correlation: entries can reference a `correlationId` to group
 *   related actions across a single business flow
 *
 * @module platform/activity-stream
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityVerb =
  | 'created'       | 'updated'      | 'deleted'
  | 'assigned'      | 'reassigned'   | 'accepted'
  | 'completed'     | 'cancelled'    | 'rejected'
  | 'approved'      | 'submitted'    | 'published'
  | 'rotated'       | 'escalated'    | 'closed'
  | 'logged_in'     | 'logged_out'   | 'exported'
  | 'commented'     | 'attached'     | 'transitioned'
  | 'signed'        | 'viewed'       | 'imported'
  | string;

export interface ActivityObject {
  /** Object type (e.g. 'lead', 'apartment', 'salary_record', 'contract') */
  type: string;
  /** Object ID */
  id: string;
  /** Human-readable label */
  label?: string;
  /** URL to view object (optional) */
  href?: string;
}

export interface ActivityActor {
  userId: string;
  userName: string;
  avatarUrl?: string;
  role?: string;
}

export interface ActivityEntry {
  /** Unique entry ID */
  id: string;
  /** Tenant isolation */
  tenantId: string;
  /** Who did the action */
  actor: ActivityActor;
  /** What they did (verb) */
  verb: ActivityVerb;
  /** What they acted on */
  object: ActivityObject;
  /** Who/what they acted toward (optional) */
  target?: ActivityObject;
  /** Human-readable description (pre-rendered) */
  summary: string;
  /** Category for filtering (e.g. 'crm', 'hr', 'finance') */
  category?: string;
  /** Additional structured metadata */
  metadata?: Record<string, unknown>;
  /**
   * Correlation ID — groups all activities from the same business transaction.
   * E.g. a booking confirmation might trigger 3 activities (booking created,
   * revenue recorded, notification sent) all sharing the same correlationId.
   */
  correlationId?: string;
  /** ISO timestamp */
  timestamp: string;
}

export interface StreamFilter {
  tenantId: string;
  actorId?: string;
  objectType?: string;
  objectId?: string;
  verb?: ActivityVerb;
  category?: string;
  correlationId?: string;
  /** ISO string: include entries after this time */
  from?: string;
  /** ISO string: include entries before this time */
  to?: string;
  limit?: number;
  offset?: number;
}

export type ActivityStreamSubscriber = (entry: ActivityEntry) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Persistence Backend Contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Implement this interface to swap in a real database backend.
 *
 * @example Supabase implementation:
 * ```ts
 * export const supabaseActivityBackend: IActivityStreamBackend = {
 *   async write(entry) {
 *     const { error } = await supabase.from('activity_stream').insert({
 *       id: entry.id,
 *       tenant_id: entry.tenantId,
 *       actor_user_id: entry.actor.userId,
 *       actor_user_name: entry.actor.userName,
 *       verb: entry.verb,
 *       object_type: entry.object.type,
 *       object_id: entry.object.id,
 *       object_label: entry.object.label,
 *       target_type: entry.target?.type,
 *       target_id: entry.target?.id,
 *       summary: entry.summary,
 *       category: entry.category,
 *       metadata: entry.metadata,
 *       correlation_id: entry.correlationId,
 *       timestamp: entry.timestamp,
 *     });
 *     if (error) throw error;
 *   },
 *   async query(filter) {
 *     let q = supabase.from('activity_stream')
 *       .select('*')
 *       .eq('tenant_id', filter.tenantId)
 *       .order('timestamp', { ascending: false })
 *       .range(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 50) - 1);
 *     if (filter.actorId) q = q.eq('actor_user_id', filter.actorId);
 *     if (filter.objectType) q = q.eq('object_type', filter.objectType);
 *     if (filter.objectId) q = q.eq('object_id', filter.objectId);
 *     if (filter.verb) q = q.eq('verb', filter.verb);
 *     if (filter.category) q = q.eq('category', filter.category);
 *     if (filter.correlationId) q = q.eq('correlation_id', filter.correlationId);
 *     if (filter.from) q = q.gte('timestamp', filter.from);
 *     if (filter.to) q = q.lte('timestamp', filter.to);
 *     const { data, error } = await q;
 *     if (error) throw error;
 *     return (data ?? []).map(row => ({
 *       id: row.id, tenantId: row.tenant_id,
 *       actor: { userId: row.actor_user_id, userName: row.actor_user_name },
 *       verb: row.verb,
 *       object: { type: row.object_type, id: row.object_id, label: row.object_label },
 *       target: row.target_type ? { type: row.target_type, id: row.target_id } : undefined,
 *       summary: row.summary, category: row.category,
 *       metadata: row.metadata, correlationId: row.correlation_id,
 *       timestamp: row.timestamp,
 *     }));
 *   },
 * };
 * ```
 */
export interface IActivityStreamBackend {
  /**
   * Persist a new activity entry.
   * Must throw on failure (Rule #1: Zero Silent Database Failures).
   */
  write(entry: ActivityEntry): Promise<void>;

  /**
   * Query activity entries with filters.
   * Returns newest-first.
   */
  query(filter: StreamFilter): Promise<ActivityEntry[]>;

  /**
   * Optional: count entries matching filter without pagination.
   */
  count?(filter: StreamFilter): Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Stream Engine
// ─────────────────────────────────────────────────────────────────────────────

class ActivityStreamEngineClass {
  /**
   * In-memory ring buffer (per tenant) — zero-config fallback.
   * Max 1000 entries per tenant in memory.
   */
  private readonly store = new Map<string, ActivityEntry[]>();
  private readonly MAX_PER_TENANT = 1000;

  /** Optional pluggable persistence backend */
  private backend: IActivityStreamBackend | null = null;

  /** Global subscribers (for real-time feeds) */
  private readonly subscribers = new Set<ActivityStreamSubscriber>();

  // ── Backend Registration ──────────────────────────────────────────────────

  /**
   * Register a persistence backend.
   * Once set, all new `record()` calls will also persist to this backend.
   * The in-memory buffer still operates as an L1 cache.
   */
  useBackend(backend: IActivityStreamBackend): void {
    this.backend = backend;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Record a new activity entry.
   * - Writes to in-memory ring buffer immediately (sync).
   * - Persists to backend asynchronously if one is registered.
   * - Notifies all active subscribers synchronously.
   */
  record(entry: Omit<ActivityEntry, 'id' | 'timestamp'>): ActivityEntry {
    const full: ActivityEntry = {
      ...entry,
      id: `act_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    // L1: Store in tenant ring buffer
    if (!this.store.has(entry.tenantId)) {
      this.store.set(entry.tenantId, []);
    }
    const list = this.store.get(entry.tenantId)!;
    list.unshift(full); // newest first
    if (list.length > this.MAX_PER_TENANT) {
      list.splice(this.MAX_PER_TENANT);
    }

    // L2: Persist to backend (non-blocking — errors logged, not swallowed)
    if (this.backend) {
      this.backend.write(full).catch((err) => {
        console.error(
          '[ActivityStream] Backend write failed for entry %s (type=%s, verb=%s):',
          full.id, full.object.type, full.verb, err
        );
      });
    }

    // Notify subscribers
    for (const sub of this.subscribers) {
      try { sub(full); } catch { /* non-fatal */ }
    }

    return full;
  }

  /**
   * Helper: record with auto-generated summary and correlation support.
   */
  log(params: {
    tenantId: string;
    actor: ActivityActor;
    verb: ActivityVerb;
    object: ActivityObject;
    target?: ActivityObject;
    summary?: string;
    category?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
  }): ActivityEntry {
    const autoSummary = params.summary ??
      `${params.actor.userName} ${params.verb} ${params.object.label ?? params.object.id}` +
      (params.target ? ` → ${params.target.label ?? params.target.id}` : '');

    return this.record({
      tenantId: params.tenantId,
      actor: params.actor,
      verb: params.verb,
      object: params.object,
      target: params.target,
      summary: autoSummary,
      category: params.category,
      metadata: params.metadata,
      correlationId: params.correlationId,
    });
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /**
   * Query the activity stream with filters.
   * - If backend registered: delegates to backend for full history.
   * - Otherwise: queries in-memory buffer.
   * Returns entries sorted newest-first.
   */
  async getStreamAsync(filter: StreamFilter): Promise<ActivityEntry[]> {
    if (this.backend) {
      return this.backend.query(filter);
    }
    return this.getStream(filter);
  }

  /**
   * Synchronous query against in-memory buffer only.
   * Use `getStreamAsync` if you want backend data.
   */
  getStream(filter: StreamFilter): ActivityEntry[] {
    const entries = this.store.get(filter.tenantId) ?? [];
    let result = entries;

    if (filter.actorId)      result = result.filter((e) => e.actor.userId === filter.actorId);
    if (filter.objectType)   result = result.filter((e) => e.object.type === filter.objectType);
    if (filter.objectId)     result = result.filter((e) => e.object.id === filter.objectId);
    if (filter.verb)         result = result.filter((e) => e.verb === filter.verb);
    if (filter.category)     result = result.filter((e) => e.category === filter.category);
    if (filter.correlationId) result = result.filter((e) => e.correlationId === filter.correlationId);
    if (filter.from)         result = result.filter((e) => e.timestamp >= filter.from!);
    if (filter.to)           result = result.filter((e) => e.timestamp <= filter.to!);

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return result.slice(offset, offset + limit);
  }

  /**
   * Get activity stream for a specific resource.
   */
  async getResourceStream(
    tenantId: string,
    objectType: string,
    objectId: string,
    limit = 20
  ): Promise<ActivityEntry[]> {
    return this.getStreamAsync({ tenantId, objectType, objectId, limit });
  }

  /**
   * Get all activities in a correlation group (a single business transaction).
   */
  async getCorrelatedActivities(tenantId: string, correlationId: string): Promise<ActivityEntry[]> {
    return this.getStreamAsync({ tenantId, correlationId, limit: 100 });
  }

  /** Count (async, uses backend if available) */
  async countStream(filter: StreamFilter): Promise<number> {
    if (this.backend?.count) {
      return this.backend.count(filter);
    }
    const entries = await this.getStreamAsync({ ...filter, limit: this.MAX_PER_TENANT, offset: 0 });
    return entries.length;
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /** Subscribe to new activity entries in real time */
  subscribe(handler: ActivityStreamSubscriber): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  // ── Admin / Testing ───────────────────────────────────────────────────────

  /** Clear in-memory tenant stream (admin/testing only) */
  clearTenant(tenantId: string): void {
    this.store.delete(tenantId);
  }

  /** Check if a backend is registered */
  hasBackend(): boolean {
    return this.backend !== null;
  }
}

export const activityStream = new ActivityStreamEngineClass();
