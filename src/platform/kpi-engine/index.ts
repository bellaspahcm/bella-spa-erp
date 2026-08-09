/**
 * @fileoverview Platform KPI Engine
 *
 * Define, evaluate, and monitor Key Performance Indicators across all verticals.
 * Supports: compute-on-demand, target tracking, threshold alerts, period comparison.
 *
 * @module platform/kpi-engine
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type KpiUnit = 'number' | 'currency' | 'percent' | 'duration_hours' | 'duration_days' | 'count' | string;
export type KpiStatus = 'critical' | 'below' | 'on_track' | 'above' | 'exceeded' | 'no_data';
export type KpiDirection = 'higher_is_better' | 'lower_is_better';

export interface KpiPeriod {
  from: Date;
  to: Date;
  label?: string; // e.g. '2026-07', 'Q3-2026', 'Week 31'
}

export interface KpiThreshold {
  /** Below this value → 'critical' */
  critical?: number;
  /** Below this value → 'below', at or above → 'on_track' */
  warning?: number;
  /** At or above this value → 'above' */
  target?: number;
  /** At or above this value → 'exceeded' */
  stretch?: number;
}

export interface KpiDefinition {
  /** Unique key (e.g. 'crm.lead.conversion_rate', 'hr.ktv.avg_sessions') */
  key: string;
  name: string;
  description?: string;
  unit: KpiUnit;
  direction: KpiDirection;
  /** Category for grouping on dashboard */
  category: string;
  /** Vertical/module this KPI belongs to */
  vertical?: string;
  /** Threshold values for status classification */
  threshold?: KpiThreshold;
  /**
   * Compute function — receives period and context, returns numeric value.
   * Injected by each vertical; platform only stores the definition + calls it.
   */
  compute: (period: KpiPeriod, context: KpiComputeContext) => Promise<number | null>;
  /** Comparison period offset in days (for delta calculation) */
  comparisonOffsetDays?: number;
}

export interface KpiComputeContext {
  tenantId: string;
  branchId?: string;
  userId?: string;
  params?: Record<string, unknown>;
}

export interface KpiResult {
  key: string;
  name: string;
  unit: KpiUnit;
  direction: KpiDirection;
  category: string;
  vertical?: string;
  /** The computed value (null if no data) */
  value: number | null;
  /** Target value from threshold config */
  target?: number;
  /** Delta vs comparison period (positive = improved) */
  delta?: number;
  /** Delta as % of comparison period value */
  deltaPercent?: number;
  /** Classification based on thresholds */
  status: KpiStatus;
  /** Formatted display value */
  displayValue: string;
  /** The period this result covers */
  period: { from: string; to: string; label?: string };
  /** When this result was computed */
  computedAt: string;
  /** Execution time */
  executionMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function classifyStatus(value: number, threshold: KpiThreshold, direction: KpiDirection): KpiStatus {
  const t = threshold;
  if (direction === 'higher_is_better') {
    if (t.stretch !== undefined && value >= t.stretch) return 'exceeded';
    if (t.target !== undefined && value >= t.target) return 'above';
    if (t.warning !== undefined && value >= t.warning) return 'on_track';
    if (t.critical !== undefined && value < t.critical) return 'critical';
    return 'below';
  } else {
    // lower_is_better
    if (t.critical !== undefined && value > t.critical) return 'critical';
    if (t.target !== undefined && value <= t.target) return 'above';
    if (t.warning !== undefined && value <= t.warning) return 'on_track';
    return 'below';
  }
}

function formatValue(value: number | null, unit: KpiUnit): string {
  if (value === null) return 'N/A';
  switch (unit) {
    case 'currency':
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'duration_hours':
      return `${value.toFixed(1)}h`;
    case 'duration_days':
      return `${value.toFixed(1)} ngày`;
    default:
      return value % 1 === 0 ? value.toLocaleString('vi-VN') : value.toFixed(2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Engine
// ─────────────────────────────────────────────────────────────────────────────

class KpiEngineClass {
  private readonly definitions = new Map<string, KpiDefinition>();

  /** Register a KPI definition */
  define(kpi: KpiDefinition): void {
    this.definitions.set(kpi.key, kpi);
  }

  /** Get a KPI definition */
  getDefinition(key: string): KpiDefinition | undefined {
    return this.definitions.get(key);
  }

  /** List all definitions (optionally by category or vertical) */
  listDefinitions(filter?: { category?: string; vertical?: string }): KpiDefinition[] {
    let defs = Array.from(this.definitions.values());
    if (filter?.category) defs = defs.filter((d) => d.category === filter.category);
    if (filter?.vertical) defs = defs.filter((d) => d.vertical === filter.vertical);
    return defs;
  }

  /**
   * Evaluate a single KPI.
   * @throws if KPI key not found
   */
  async evaluate(key: string, period: KpiPeriod, context: KpiComputeContext): Promise<KpiResult> {
    const def = this.definitions.get(key);
    if (!def) throw new Error(`[KpiEngine] KPI not found: "${key}"`);

    const start = Date.now();
    let value: number | null = null;
    let delta: number | undefined;
    let deltaPercent: number | undefined;

    try {
      value = await def.compute(period, context);

      // Compute comparison period delta
      if (value !== null && def.comparisonOffsetDays) {
        const offsetMs = def.comparisonOffsetDays * 24 * 60 * 60 * 1000;
        const compPeriod: KpiPeriod = {
          from: new Date(period.from.getTime() - offsetMs),
          to: new Date(period.to.getTime() - offsetMs),
        };
        const prevValue = await def.compute(compPeriod, context);
        if (prevValue !== null && prevValue !== 0) {
          delta = value - prevValue;
          deltaPercent = (delta / Math.abs(prevValue)) * 100;
        }
      }
    } catch (err: unknown) {
      console.error('[KpiEngine] Compute failed for key %s:', key, err);
      value = null;
    }

    const executionMs = Date.now() - start;
    const status: KpiStatus = value === null ? 'no_data' : (def.threshold ? classifyStatus(value, def.threshold, def.direction) : 'on_track');

    return {
      key,
      name: def.name,
      unit: def.unit,
      direction: def.direction,
      category: def.category,
      vertical: def.vertical,
      value,
      target: def.threshold?.target,
      delta,
      deltaPercent,
      status,
      displayValue: formatValue(value, def.unit),
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        label: period.label,
      },
      computedAt: new Date().toISOString(),
      executionMs,
    };
  }

  /**
   * Evaluate multiple KPIs in parallel.
   * Failed KPIs return status 'no_data' and don't throw.
   */
  async evaluateAll(
    keys: string[],
    period: KpiPeriod,
    context: KpiComputeContext
  ): Promise<KpiResult[]> {
    return Promise.all(
      keys.map((key) =>
        this.evaluate(key, period, context).catch((err) => {
          console.error('[KpiEngine] evaluateAll failed for %s:', key, err);
          const def = this.definitions.get(key);
          return {
            key,
            name: def?.name ?? key,
            unit: def?.unit ?? 'number',
            direction: def?.direction ?? 'higher_is_better',
            category: def?.category ?? 'unknown',
            value: null,
            status: 'no_data' as KpiStatus,
            displayValue: 'N/A',
            period: { from: period.from.toISOString(), to: period.to.toISOString() },
            computedAt: new Date().toISOString(),
            executionMs: 0,
          };
        })
      )
    );
  }

  /**
   * Evaluate all KPIs matching a category/vertical.
   */
  async evaluateGroup(
    filter: { category?: string; vertical?: string },
    period: KpiPeriod,
    context: KpiComputeContext
  ): Promise<KpiResult[]> {
    const keys = this.listDefinitions(filter).map((d) => d.key);
    return this.evaluateAll(keys, period, context);
  }

  /** Build a monthly KpiPeriod helper */
  static monthPeriod(year: number, month: number): KpiPeriod {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);
    return { from, to, label: `${year}-${String(month).padStart(2, '0')}` };
  }

  /** Build a current-month KpiPeriod */
  static currentMonth(): KpiPeriod {
    const now = new Date();
    return KpiEngineClass.monthPeriod(now.getFullYear(), now.getMonth() + 1);
  }
}

export const kpiEngine = new KpiEngineClass();
export { KpiEngineClass };
