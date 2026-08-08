/**
 * Analytics Engine Contract — D4
 * Registers in Platform Contract Registry (Law 8)
 */

import { ContractDefinition } from '@/platform/host/contract-registry/contract-registry.service';

export const ANALYTICS_ENGINE_CONTRACT: ContractDefinition = {
  id: 'platform.analytics-engine',
  name: 'Platform Multi-Level Rollup Analytics Engine',
  version: '1.0.0',
  description:
    `Hierarchical analytics engine with 4 rollup levels: ` +
    `L0 (raw events) → L1 (daily per-tenant) → L2 (monthly per-tenant) → L3 (enterprise cross-tenant). ` +
    `L3 enterprise aggregation uses explicit boundary defined in platform_enterprise_metric_definitions: ` +
    `aggregationPolicy (SUM/AVG/COUNT/MAX/MIN), tenantScope, visibilityPolicy, retentionPolicy per metric. ` +
    `NOT a simple SELECT SUM FROM all_tenants.`,
  provider: 'platform.host',
  consumers: ['healthcare', 'beauty_spa', 'bella_auto', 'babycare', 'finance', 'platform'],
  methods: [
    {
      name: 'recordMetric',
      description: 'Record a raw L0 metric event',
      inputSchema: {
        type: 'object',
        required: ['metricKey', 'metricDomain', 'value'],
        properties: {
          metricKey: { type: 'string', description: 'e.g. spa.booking.revenue' },
          metricDomain: { type: 'string', description: 'e.g. beauty_spa, healthcare' },
          value: { type: 'number' },
          unit: { type: 'string', description: 'VND, count, percent, minutes' },
          dimensions: { type: 'object', description: 'Breakdown dimensions: { branch_id, service_type }' },
          sourceType: { type: 'string' },
          sourceId: { type: 'string', format: 'uuid' },
        },
      },
      outputSchema: { type: 'null' },
    },
    {
      name: 'rollupDaily',
      description: 'Aggregate L0 → L1 for a specific date (called by scheduler at 01:00 AM)',
      inputSchema: {
        type: 'object',
        required: ['periodDate'],
        properties: { periodDate: { type: 'string', format: 'date', description: 'YYYY-MM-DD' } },
      },
      outputSchema: { type: 'integer', description: 'Number of metric keys rolled up' },
    },
    {
      name: 'rollupMonthly',
      description: 'Aggregate L1 → L2 for a month (called after end-of-month daily rollup)',
      inputSchema: {
        type: 'object',
        required: ['periodMonth'],
        properties: { periodMonth: { type: 'string', description: 'YYYY-MM' } },
      },
      outputSchema: { type: 'integer', description: 'Number of metric keys rolled up' },
    },
    {
      name: 'rollupEnterprise',
      description: 'Aggregate L2 → L3 cross-tenant (ONLY for metrics in enterprise_metric_definitions)',
      inputSchema: {
        type: 'object',
        required: ['periodMonth'],
        properties: { periodMonth: { type: 'string', description: 'YYYY-MM' } },
      },
      outputSchema: { type: 'integer', description: 'Number of enterprise metrics rolled up' },
    },
    {
      name: 'getTenantDashboard',
      description: 'Get L2 monthly summary for this tenant',
      inputSchema: {
        type: 'object',
        required: ['periodMonth'],
        properties: { periodMonth: { type: 'string', description: 'YYYY-MM' } },
      },
      outputSchema: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' },
          periodMonth: { type: 'string' },
          metrics: { type: 'array' },
        },
      },
    },
  ],
  events: [
    'platform.metric.recorded.v1',
    'platform.metric.daily_rollup.completed.v1',
    'platform.metric.monthly_rollup.completed.v1',
    'platform.metric.enterprise_rollup.completed.v1',
  ],
  featureFlag: 'platform.analytics-engine.enabled',
  status: 'active',
  createdAt: '2026-08-08',
};
