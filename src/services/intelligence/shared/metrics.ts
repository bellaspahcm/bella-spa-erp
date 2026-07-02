/**
 * Metrics Collection for Intelligence Layer
 * Phase 8: Optimization & Production Readiness
 * 
 * Prometheus-compatible metrics for monitoring
 */

// ============================================================================
// METRIC TYPES
// ============================================================================

export interface Counter {
  name: string;
  help: string;
  labelNames: string[];
  value: Map<string, number>;
}

export interface Gauge {
  name: string;
  help: string;
  labelNames: string[];
  value: Map<string, number>;
}

export interface Histogram {
  name: string;
  help: string;
  labelNames: string[];
  buckets: number[];
  observations: Map<string, number[]>;
}

// ============================================================================
// METRICS REGISTRY
// ============================================================================

class MetricsRegistry {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  
  // Counter operations
  registerCounter(name: string, help: string, labelNames: string[] = []): Counter {
    const counter: Counter = {
      name,
      help,
      labelNames,
      value: new Map(),
    };
    this.counters.set(name, counter);
    return counter;
  }
  
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const counter = this.counters.get(name);
    if (!counter) return;
    
    const key = this.getLabelKey(labels);
    counter.value.set(key, (counter.value.get(key) || 0) + value);
  }
  
  // Gauge operations
  registerGauge(name: string, help: string, labelNames: string[] = []): Gauge {
    const gauge: Gauge = {
      name,
      help,
      labelNames,
      value: new Map(),
    };
    this.gauges.set(name, gauge);
    return gauge;
  }
  
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const gauge = this.gauges.get(name);
    if (!gauge) return;
    
    const key = this.getLabelKey(labels);
    gauge.value.set(key, value);
  }
  
  // Histogram operations
  registerHistogram(name: string, help: string, buckets: number[], labelNames: string[] = []): Histogram {
    const histogram: Histogram = {
      name,
      help,
      labelNames,
      buckets,
      observations: new Map(),
    };
    this.histograms.set(name, histogram);
    return histogram;
  }
  
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const histogram = this.histograms.get(name);
    if (!histogram) return;
    
    const key = this.getLabelKey(labels);
    const observations = histogram.observations.get(key) || [];
    observations.push(value);
    histogram.observations.set(key, observations);
  }
  
  // Export metrics in Prometheus format
  exportMetrics(): string {
    let output = '';
    
    // Export counters
    for (const [name, counter] of this.counters) {
      output += `# HELP ${name} ${counter.help}\n`;
      output += `# TYPE ${name} counter\n`;
      for (const [labels, value] of counter.value) {
        output += `${name}${labels} ${value}\n`;
      }
    }
    
    // Export gauges
    for (const [name, gauge] of this.gauges) {
      output += `# HELP ${name} ${gauge.help}\n`;
      output += `# TYPE ${name} gauge\n`;
      for (const [labels, value] of gauge.value) {
        output += `${name}${labels} ${value}\n`;
      }
    }
    
    // Export histograms
    for (const [name, histogram] of this.histograms) {
      output += `# HELP ${name} ${histogram.help}\n`;
      output += `# TYPE ${name} histogram\n`;
      for (const [labels, observations] of histogram.observations) {
        const sorted = [...observations].sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        // Calculate bucket counts
        for (const bucket of histogram.buckets) {
          const bucketCount = sorted.filter((v) => v <= bucket).length;
          output += `${name}_bucket${this.appendBucket(labels, bucket)} ${bucketCount}\n`;
        }
        output += `${name}_bucket${this.appendBucket(labels, '+Inf')} ${count}\n`;
        output += `${name}_sum${labels} ${sum}\n`;
        output += `${name}_count${labels} ${count}\n`;
      }
    }
    
    return output;
  }
  
  private getLabelKey(labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) return '';
    const pairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(',')}}`;
  }
  
  private appendBucket(labels: string, bucket: number | string): string {
    if (labels === '') return `{le="${bucket}"}`;
    return labels.replace('}', `,le="${bucket}"}`);
  }
}

export const metricsRegistry = new MetricsRegistry();

// ============================================================================
// INTELLIGENCE LAYER METRICS
// ============================================================================

// Forecast metrics
export const forecastRequestsTotal = metricsRegistry.registerCounter(
  'intelligence_forecast_requests_total',
  'Total number of forecast requests',
  ['forecast_type', 'model_name', 'status']
);

export const forecastDurationSeconds = metricsRegistry.registerHistogram(
  'intelligence_forecast_duration_seconds',
  'Duration of forecast computation',
  [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
  ['forecast_type', 'model_name']
);

export const forecastAccuracy = metricsRegistry.registerGauge(
  'intelligence_forecast_accuracy',
  'Current forecast accuracy percentage',
  ['forecast_type', 'model_name']
);

// Recommendation metrics
export const recommendationRequestsTotal = metricsRegistry.registerCounter(
  'intelligence_recommendation_requests_total',
  'Total number of recommendation requests',
  ['recommendation_type', 'algorithm', 'status']
);

export const recommendationDurationSeconds = metricsRegistry.registerHistogram(
  'intelligence_recommendation_duration_seconds',
  'Duration of recommendation computation',
  [0.01, 0.05, 0.1, 0.5, 1.0, 2.0],
  ['recommendation_type', 'algorithm']
);

export const recommendationRelevanceScore = metricsRegistry.registerGauge(
  'intelligence_recommendation_relevance_score',
  'Average relevance score of recommendations',
  ['recommendation_type', 'algorithm']
);

// Cache metrics
export const cacheHitsTotal = metricsRegistry.registerCounter(
  'intelligence_cache_hits_total',
  'Total number of cache hits',
  ['cache_type']
);

export const cacheMissesTotal = metricsRegistry.registerCounter(
  'intelligence_cache_misses_total',
  'Total number of cache misses',
  ['cache_type']
);

export const cacheSize = metricsRegistry.registerGauge(
  'intelligence_cache_size',
  'Current cache size in entries',
  ['cache_type']
);

// Database metrics
export const dbQueryDurationSeconds = metricsRegistry.registerHistogram(
  'intelligence_db_query_duration_seconds',
  'Duration of database queries',
  [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
  ['query_name']
);

export const mvRefreshDurationSeconds = metricsRegistry.registerHistogram(
  'intelligence_mv_refresh_duration_seconds',
  'Duration of materialized view refresh',
  [1, 5, 10, 30, 60, 120, 300],
  ['view_name']
);


export const mvRefreshErrorsTotal = metricsRegistry.registerCounter(
  'intelligence_mv_refresh_errors_total',
  'Total number of materialized view refresh failures',
  ['view_name']
);

export const dbPoolActiveConnections = metricsRegistry.registerGauge(
  'intelligence_db_pool_active_connections',
  'Number of active database connections',
  []
);

export const dbPoolMaxConnections = metricsRegistry.registerGauge(
  'intelligence_db_pool_max_connections',
  'Maximum number of database connections',
  []
);

// API metrics
export const apiRequestsTotal = metricsRegistry.registerCounter(
  'intelligence_api_requests_total',
  'Total number of API requests',
  ['endpoint', 'method', 'status']
);

export const apiDurationSeconds = metricsRegistry.registerHistogram(
  'intelligence_api_duration_seconds',
  'Duration of API requests',
  [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
  ['endpoint', 'method']
);

// External API metrics (Marketing Intelligence)
export const externalApiRequestsTotal = metricsRegistry.registerCounter(
  'intelligence_external_api_requests_total',
  'Total number of external API requests',
  ['provider', 'status']
);

export const externalApiLatencySeconds = metricsRegistry.registerHistogram(
  'intelligence_external_api_latency_seconds',
  'Latency of external API calls',
  [0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
  ['provider']
);

export const externalApiSyncErrorsTotal = metricsRegistry.registerCounter(
  'intelligence_external_api_sync_errors_total',
  'Total number of external API sync failures',
  ['provider']
);

// Data freshness metrics
export const lastDataRefreshTimestamp = metricsRegistry.registerGauge(
  'intelligence_last_data_refresh_timestamp_seconds',
  'Unix timestamp of last successful data refresh',
  ['data_source']
);
