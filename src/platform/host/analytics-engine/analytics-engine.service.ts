/**
 * Analytics Engine Service — D4: Multi-Level Rollup Analytics Engine
 * Platform-Level: src/platform/host/analytics-engine/
 *
 * Constitution: Law 3 (Platform Host), Law 5 (Event-First), Law 11 (Zero any)
 *
 * Rollup Levels:
 *   L0: Raw metric events (recordMetric)
 *   L1: Per-tenant daily aggregates (rollupDaily)
 *   L2: Per-tenant monthly aggregates (rollupMonthly)
 *   L3: Cross-tenant enterprise aggregates (rollupEnterprise)
 *       → ONLY for metrics defined in platform_enterprise_metric_definitions
 *       → NOT a simple SELECT SUM FROM all_tenants
 *       → Explicit tenant_scope, aggregation_policy, visibility_policy per metric
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Json } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import type { DomainEvent } from '@/platform/host/event-bus/types';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface MetricEvent {
  metricKey: string;               // e.g. 'spa.booking.revenue'
  metricDomain: string;            // e.g. 'beauty_spa', 'healthcare'
  value: number;
  unit?: string;                   // 'VND', 'count', 'percent'
  dimensions?: Record<string, string | number | boolean>;  // { branch_id, service_type }
  sourceType?: string;
  sourceId?: string;
  sourceEventType?: string;
  occurredAt?: string;             // ISO 8601, defaults to NOW()
  metadata?: Record<string, unknown>;
}

export interface DailyRollup {
  tenantId: string;
  metricKey: string;
  metricDomain: string;
  periodDate: string;
  totalValue: number;
  countEvents: number;
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  rolledUpAt: string;
}

export interface MonthlyRollup {
  tenantId: string;
  metricKey: string;
  metricDomain: string;
  periodMonth: string;
  totalValue: number;
  countEvents: number;
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  sourceDailyCount: number;
  rolledUpAt: string;
}

export interface EnterpriseMetricDefinition {
  metricKey: string;
  metricName: string;
  metricDomain: string;
  unit?: string;
  aggregationPolicy: 'SUM' | 'AVG' | 'COUNT' | 'MAX' | 'MIN';
  tenantScope: string[] | null;    // null = all tenants
  visibilityPolicy: string;
}

export interface EnterpriseRollup {
  metricKey: string;
  periodMonth: string;
  aggregationPolicy: string;
  tenantCount: number;
  includedTenants: string[];
  totalValue: number;
  avgValue: number | null;
  maxValue: number | null;
  minValue: number | null;
  rolledUpAt: string;
}

export interface TenantDashboard {
  tenantId: string;
  periodMonth: string;
  metrics: Array<{
    metricKey: string;
    metricDomain: string;
    totalValue: number;
    countEvents: number;
    avgValue: number | null;
  }>;
}

// ─────────────────────────────────────────────────────────────────
// AnalyticsEngineService
// ─────────────────────────────────────────────────────────────────
export class AnalyticsEngineService {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly tenantId: string
  ) {}

  // ────────────────────────────────────────────────
  // L0: recordMetric — raw event insertion
  // ────────────────────────────────────────────────
  async recordMetric(params: MetricEvent): Promise<void> {
    const { error } = await this.supabase
      .from('platform_metric_events')
      .insert({
        tenant_id: this.tenantId,
        metric_key: params.metricKey,
        metric_domain: params.metricDomain,
        value: params.value,
        unit: params.unit ?? null,
        dimensions: params.dimensions ?? {},
        source_type: params.sourceType ?? null,
        source_id: params.sourceId ?? null,
        source_event_type: params.sourceEventType ?? null,
        occurred_at: params.occurredAt ?? new Date().toISOString(),
        metadata: (params.metadata ?? {}) as Json,
      });

    if (error) throw new Error(`recordMetric failed: ${error.message}`);

    await this.publishEvent('platform.metric.recorded.v1', crypto.randomUUID(), {
      metricKey: params.metricKey,
      metricDomain: params.metricDomain,
      value: params.value,
    });
  }

  // ────────────────────────────────────────────────
  // L1: rollupDaily — aggregate L0 events for a specific date
  //     Called nightly by scheduler (e.g. pg_cron at 01:00 AM)
  // ────────────────────────────────────────────────
  async rollupDaily(periodDate: string): Promise<number> {
    // Aggregate L0 → L1 for this tenant and date
    const { data: aggregates, error } = await this.supabase
      .from('platform_metric_events')
      .select('metric_key, metric_domain, value')
      .eq('tenant_id', this.tenantId)
      .eq('period_date', periodDate);

    if (error) throw new Error(`rollupDaily fetch failed: ${error.message}`);
    if (!aggregates || aggregates.length === 0) return 0;

    // Group by metric_key + metric_domain
    const grouped: Record<string, {
      metricKey: string;
      metricDomain: string;
      values: number[];
    }> = {};

    for (const row of aggregates) {
      const key = `${row.metric_key}::${row.metric_domain}`;
      if (!grouped[key]) {
        grouped[key] = { metricKey: row.metric_key, metricDomain: row.metric_domain, values: [] };
      }
      grouped[key]!.values.push(Number(row.value));
    }

    let upsertCount = 0;
    for (const group of Object.values(grouped)) {
      const vals = group.values;
      const total = vals.reduce((a, b) => a + b, 0);
      const avg = total / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);

      const { error: upsertError } = await this.supabase
        .from('platform_daily_rollups')
        .upsert({
          tenant_id: this.tenantId,
          metric_key: group.metricKey,
          metric_domain: group.metricDomain,
          period_date: periodDate,
          total_value: total,
          count_events: vals.length,
          min_value: min,
          max_value: max,
          avg_value: avg,
          event_count: vals.length,
          rolled_up_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,metric_key,period_date' });

      if (upsertError) throw new Error(`rollupDaily upsert failed for ${group.metricKey}: ${upsertError.message}`);
      upsertCount++;
    }

    await this.publishEvent('platform.metric.daily_rollup.completed.v1', crypto.randomUUID(), {
      periodDate,
      metricsRolledUp: upsertCount,
    });

    return upsertCount;
  }

  // ────────────────────────────────────────────────
  // L2: rollupMonthly — aggregate L1 daily rollups for a month
  // ────────────────────────────────────────────────
  async rollupMonthly(periodMonth: string): Promise<number> {
    const [yearStr, monthStr] = periodMonth.split('-');
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthStr = nextMonth < 10 ? `0${nextMonth}` : `${nextMonth}`;
    const nextMonthFirstDay = `${nextYear}-${nextMonthStr}-01`;

    const { data: dailyData, error } = await this.supabase
      .from('platform_daily_rollups')
      .select('metric_key, metric_domain, total_value, min_value, max_value, count_events')
      .eq('tenant_id', this.tenantId)
      .gte('period_date', `${periodMonth}-01`)
      .lt('period_date', nextMonthFirstDay);

    if (error) throw new Error(`rollupMonthly fetch failed: ${error.message}`);
    if (!dailyData || dailyData.length === 0) return 0;

    const grouped: Record<string, {
      metricKey: string;
      metricDomain: string;
      totals: number[];
      mins: number[];
      maxes: number[];
      counts: number[];
    }> = {};

    for (const row of dailyData) {
      const key = `${row.metric_key}::${row.metric_domain}`;
      if (!grouped[key]) {
        grouped[key] = { metricKey: row.metric_key, metricDomain: row.metric_domain, totals: [], mins: [], maxes: [], counts: [] };
      }
      const g = grouped[key]!;
      g.totals.push(Number(row.total_value));
      if (row.min_value !== null) g.mins.push(Number(row.min_value));
      if (row.max_value !== null) g.maxes.push(Number(row.max_value));
      g.counts.push(Number(row.count_events));
    }

    let upsertCount = 0;
    for (const group of Object.values(grouped)) {
      const total = group.totals.reduce((a, b) => a + b, 0);
      const countTotal = group.counts.reduce((a, b) => a + b, 0);

      const { error: upsertError } = await this.supabase
        .from('platform_monthly_rollups')
        .upsert({
          tenant_id: this.tenantId,
          metric_key: group.metricKey,
          metric_domain: group.metricDomain,
          period_month: periodMonth,
          total_value: total,
          count_events: countTotal,
          min_value: group.mins.length > 0 ? Math.min(...group.mins) : null,
          max_value: group.maxes.length > 0 ? Math.max(...group.maxes) : null,
          avg_value: countTotal > 0 ? total / countTotal : null,
          source_daily_count: group.totals.length,
          rolled_up_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,metric_key,period_month' });

      if (upsertError) throw new Error(`rollupMonthly upsert failed: ${upsertError.message}`);
      upsertCount++;
    }

    await this.publishEvent('platform.metric.monthly_rollup.completed.v1', crypto.randomUUID(), {
      periodMonth,
      metricsRolledUp: upsertCount,
    });

    return upsertCount;
  }

  // ────────────────────────────────────────────────
  // L3: rollupEnterprise — explicit cross-tenant aggregation
  //     ONLY for metrics in platform_enterprise_metric_definitions.
  //     Respects tenantScope and aggregationPolicy per metric.
  // ────────────────────────────────────────────────
  async rollupEnterprise(periodMonth: string): Promise<number> {
    // 1. Fetch metric definitions (the explicit enterprise boundary)
    const { data: definitions, error: defError } = await this.supabase
      .from('platform_enterprise_metric_definitions')
      .select('*');

    if (defError) throw new Error(`rollupEnterprise: cannot fetch definitions: ${defError.message}`);
    if (!definitions || definitions.length === 0) return 0;

    let rollupCount = 0;

    for (const def of definitions) {
      // 2. Fetch monthly rollups for this metric across all (or scoped) tenants
      let query = this.supabase
        .from('platform_monthly_rollups')
        .select('tenant_id, total_value, count_events, min_value, max_value, avg_value')
        .eq('metric_key', def.metric_key)
        .eq('period_month', periodMonth);

      // Respect explicit tenantScope
      const tenantScope = def.tenant_scope as string[] | null;
      if (tenantScope && tenantScope.length > 0) {
        query = query.in('tenant_id', tenantScope);
      }

      const { data: tenantData, error: dataError } = await query;
      if (dataError) {
        console.error(`rollupEnterprise: failed for metric ${def.metric_key}:`, dataError.message);
        continue;
      }
      if (!tenantData || tenantData.length === 0) continue;

      const values = tenantData.map(r => Number(r.total_value));
      const includedTenants = tenantData.map(r => r.tenant_id);

      let enterpriseValue: number;
      switch (def.aggregation_policy) {
        case 'SUM':   enterpriseValue = values.reduce((a, b) => a + b, 0); break;
        case 'AVG':   enterpriseValue = values.reduce((a, b) => a + b, 0) / values.length; break;
        case 'COUNT': enterpriseValue = values.length; break;
        case 'MAX':   enterpriseValue = Math.max(...values); break;
        case 'MIN':   enterpriseValue = Math.min(...values); break;
        default:      enterpriseValue = values.reduce((a, b) => a + b, 0);
      }

      const { error: upsertError } = await this.supabase
        .from('platform_enterprise_rollups')
        .upsert({
          metric_key: def.metric_key,
          period_month: periodMonth,
          aggregation_policy: def.aggregation_policy,
          tenant_count: tenantData.length,
          included_tenants: includedTenants,
          total_value: enterpriseValue,
          avg_value: def.aggregation_policy === 'AVG' ? enterpriseValue : null,
          max_value: Math.max(...values),
          min_value: Math.min(...values),
          rolled_up_at: new Date().toISOString(),
        }, { onConflict: 'metric_key,period_month' });

      if (upsertError) {
        console.error(`rollupEnterprise upsert failed for ${def.metric_key}:`, upsertError.message);
        continue;
      }
      rollupCount++;
    }

    await this.publishEvent('platform.metric.enterprise_rollup.completed.v1', crypto.randomUUID(), {
      periodMonth,
      metricsRolledUp: rollupCount,
    });

    return rollupCount;
  }

  // ────────────────────────────────────────────────
  // getTenantDashboard — L2 summary for a tenant
  // ────────────────────────────────────────────────
  async getTenantDashboard(periodMonth: string): Promise<TenantDashboard> {
    const { data, error } = await this.supabase
      .from('platform_monthly_rollups')
      .select('metric_key, metric_domain, total_value, count_events, avg_value')
      .eq('tenant_id', this.tenantId)
      .eq('period_month', periodMonth)
      .order('metric_key');

    if (error) throw new Error(`getTenantDashboard failed: ${error.message}`);

    return {
      tenantId: this.tenantId,
      periodMonth,
      metrics: (data ?? []).map(row => ({
        metricKey: row.metric_key,
        metricDomain: row.metric_domain,
        totalValue: Number(row.total_value),
        countEvents: Number(row.count_events),
        avgValue: row.avg_value !== null ? Number(row.avg_value) : null,
      })),
    };
  }

  // ────────────────────────────────────────────────
  // Private
  // ────────────────────────────────────────────────
  private async publishEvent(
    eventType: Parameters<typeof eventBus.publish>[0]['eventType'],
    aggregateId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: DomainEvent<Record<string, unknown>> = {
      eventId: crypto.randomUUID(),
      eventType,
      eventVersion: '1.0.0',
      tenantId: this.tenantId,
      aggregateId,
      aggregateType: 'platform_metric',
      payload,
      occurredAt: new Date().toISOString(),
    };
    await eventBus.publish(event);
  }
}
