/**
 * Decision Engine Platform - BI Provider Types
 * 
 * Type definitions for Business Intelligence queries and results.
 * Supports SQL queries, aggregations, and time-series analytics.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6
 */

/**
 * BI Query type
 */
export type BIQueryType = 
  | 'sql'           // Raw SQL query
  | 'aggregation'   // Aggregation query (SUM, AVG, COUNT, etc.)
  | 'time-series'   // Time-series analytics
  | 'metric';       // Single metric query

/**
 * Comparison operator for threshold evaluation
 */
export type ComparisonOperator = 
  | '>'
  | '>='
  | '<'
  | '<='
  | '='
  | '!='
  | 'between'
  | 'in'
  | 'not_in';

/**
 * Aggregation function
 */
export type AggregationFunction = 
  | 'SUM'
  | 'AVG'
  | 'COUNT'
  | 'MIN'
  | 'MAX'
  | 'MEDIAN'
  | 'STDDEV'
  | 'PERCENTILE';

/**
 * Time range for time-series queries
 */
export interface TimeRange {
  /** Start time (ISO 8601 or timestamp) */
  start: string | number | Date;
  /** End time (ISO 8601 or timestamp) */
  end: string | number | Date;
  /** Granularity (e.g., 'day', 'week', 'month') */
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
}

/**
 * SQL Query definition
 */
export interface SQLQuery {
  type: 'sql';
  /** SQL query string with parameter placeholders */
  query: string;
  /** Query parameters (for prepared statements) */
  parameters?: Record<string, unknown>;
  /** Expected result type */
  resultType?: 'single' | 'multiple' | 'scalar';
}

/**
 * Aggregation Query definition
 */
export interface AggregationQuery {
  type: 'aggregation';
  /** Table or view name */
  table: string;
  /** Aggregation function */
  function: AggregationFunction;
  /** Column to aggregate */
  column: string;
  /** WHERE clause conditions */
  filters?: Record<string, unknown>;
  /** GROUP BY columns */
  groupBy?: string[];
  /** Time range filter */
  timeRange?: TimeRange;
  /** Time column name (default: 'created_at') */
  timeColumn?: string;
}

/**
 * Time-Series Query definition
 */
export interface TimeSeriesQuery {
  type: 'time-series';
  /** Table or view name */
  table: string;
  /** Metric to track */
  metric: string;
  /** Aggregation function */
  function: AggregationFunction;
  /** Time range */
  timeRange: TimeRange;
  /** Time column name (default: 'created_at') */
  timeColumn?: string;
  /** WHERE clause conditions */
  filters?: Record<string, unknown>;
  /** GROUP BY columns (besides time) */
  groupBy?: string[];
}

/**
 * Metric Query definition
 */
export interface MetricQuery {
  type: 'metric';
  /** Metric identifier */
  metricId: string;
  /** Metric parameters */
  parameters?: Record<string, unknown>;
  /** Time range (optional) */
  timeRange?: TimeRange;
}

/**
 * Union type for all BI query types
 */
export type BIQuery = SQLQuery | AggregationQuery | TimeSeriesQuery | MetricQuery;

/**
 * BI Query Result
 */
export interface BIQueryResult<T = unknown> {
  /** Query result value */
  value: T;
  /** Result metadata */
  metadata?: {
    /** Number of rows returned */
    rowCount?: number;
    /** Query execution time (ms) */
    executionTime?: number;
    /** Database used */
    database?: string;
    /** Query hash (for caching) */
    queryHash?: string;
  };
}

/**
 * Threshold definition for decision evaluation
 */
export interface Threshold {
  /** Comparison operator */
  operator: ComparisonOperator;
  /** Threshold value */
  value: number | string | number[] | string[];
  /** Optional fallback value */
  fallback?: boolean;
}

/**
 * BI Query with threshold for decision-making
 */
export interface BIQueryWithThreshold {
  /** BI query definition */
  query: BIQuery;
  /** Decision threshold */
  threshold: Threshold;
  /** Optional description */
  description?: string;
}

/**
 * Query parameter validation schema
 */
export interface QueryParameterSchema {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  /** Is required */
  required: boolean;
  /** Default value */
  default?: unknown;
  /** Validation pattern (for strings) */
  pattern?: string;
  /** Min value (for numbers) */
  min?: number;
  /** Max value (for numbers) */
  max?: number;
}

/**
 * Query validation result
 */
export interface QueryValidationResult {
  /** Is valid */
  valid: boolean;
  /** Validation errors */
  errors?: string[];
}

/**
 * BI Query options
 */
export interface BIQueryOptions {
  /** Query timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable query caching */
  cache?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Max rows to return */
  maxRows?: number;
  /** Enable query explanation (EXPLAIN) */
  explain?: boolean;
}

/**
 * Validate query parameters against schema
 * 
 * @param parameters - Query parameters
 * @param schema - Parameter schema
 * @returns Validation result
 */
export function validateQueryParameters(
  parameters: Record<string, unknown>,
  schema: QueryParameterSchema[]
): QueryValidationResult {
  const errors: string[] = [];

  for (const param of schema) {
    const value = parameters[param.name];

    // Check required
    if (param.required && value === undefined) {
      errors.push(`Parameter '${param.name}' is required`);
      continue;
    }

    // Skip if optional and not provided
    if (value === undefined) {
      continue;
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== param.type && param.type !== 'date') {
      errors.push(
        `Parameter '${param.name}' must be of type ${param.type}, got ${actualType}`
      );
      continue;
    }

    // String pattern validation
    if (param.type === 'string' && param.pattern && typeof value === 'string') {
      const regex = new RegExp(param.pattern);
      if (!regex.test(value)) {
        errors.push(
          `Parameter '${param.name}' does not match pattern ${param.pattern}`
        );
      }
    }

    // Number range validation
    if (param.type === 'number' && typeof value === 'number') {
      if (param.min !== undefined && value < param.min) {
        errors.push(
          `Parameter '${param.name}' must be >= ${param.min}, got ${value}`
        );
      }
      if (param.max !== undefined && value > param.max) {
        errors.push(
          `Parameter '${param.name}' must be <= ${param.max}, got ${value}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Evaluate threshold comparison
 * 
 * @param value - Actual value from query
 * @param threshold - Threshold definition
 * @returns True if threshold is met
 */
export function evaluateThreshold(
  value: number | string,
  threshold: Threshold
): boolean {
  const { operator, value: thresholdValue } = threshold;

  // Numeric comparison
  if (typeof value === 'number' && typeof thresholdValue === 'number') {
    switch (operator) {
      case '>':
        return value > thresholdValue;
      case '>=':
        return value >= thresholdValue;
      case '<':
        return value < thresholdValue;
      case '<=':
        return value <= thresholdValue;
      case '=':
        return value === thresholdValue;
      case '!=':
        return value !== thresholdValue;
      case 'between':
        if (Array.isArray(thresholdValue) && thresholdValue.length === 2) {
          return value >= thresholdValue[0] && value <= thresholdValue[1];
        }
        return false;
      case 'in':
        if (Array.isArray(thresholdValue)) {
          return thresholdValue.includes(value);
        }
        return false;
      case 'not_in':
        if (Array.isArray(thresholdValue)) {
          return !thresholdValue.includes(value);
        }
        return false;
      default:
        return false;
    }
  }

  // String comparison
  if (typeof value === 'string' && typeof thresholdValue === 'string') {
    switch (operator) {
      case '=':
        return value === thresholdValue;
      case '!=':
        return value !== thresholdValue;
      case 'in':
        if (Array.isArray(thresholdValue)) {
          return thresholdValue.includes(value);
        }
        return false;
      case 'not_in':
        if (Array.isArray(thresholdValue)) {
          return !thresholdValue.includes(value);
        }
        return false;
      default:
        return false;
    }
  }

  return false;
}

/**
 * Parse time range to database format
 * 
 * @param timeRange - Time range definition
 * @returns Start and end timestamps
 */
export function parseTimeRange(timeRange: TimeRange): {
  start: Date;
  end: Date;
} {
  const start =
    timeRange.start instanceof Date
      ? timeRange.start
      : new Date(timeRange.start);

  const end =
    timeRange.end instanceof Date ? timeRange.end : new Date(timeRange.end);

  return { start, end };
}

/**
 * Build SQL WHERE clause from filters
 * 
 * @param filters - Filter conditions
 * @returns WHERE clause and parameters
 */
export function buildWhereClause(filters: Record<string, unknown>): {
  clause: string;
  parameters: Record<string, unknown>;
} {
  const conditions: string[] = [];
  const parameters: Record<string, unknown> = {};

  let paramIndex = 1;

  for (const [key, value] of Object.entries(filters)) {
    if (value === null) {
      conditions.push(`${key} IS NULL`);
    } else if (Array.isArray(value)) {
      const paramName = `param${paramIndex}`;
      conditions.push(`${key} IN (:${paramName})`);
      parameters[paramName] = value;
      paramIndex++;
    } else {
      const paramName = `param${paramIndex}`;
      conditions.push(`${key} = :${paramName}`);
      parameters[paramName] = value;
      paramIndex++;
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    parameters,
  };
}
