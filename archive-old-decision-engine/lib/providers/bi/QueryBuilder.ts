/**
 * Decision Engine Platform - BI Query Builder
 * 
 * Fluent query builder for constructing BI queries programmatically.
 * Provides type-safe query construction with validation.
 * 
 * @see src/lib/decision-engine/providers/bi/types.ts
 */

import type {
  AggregationFunction,
  AggregationQuery,
  BIQuery,
  ComparisonOperator,
  SQLQuery,
  Threshold,
  TimeRange,
  TimeSeriesQuery,
} from './types';

/**
 * SQL Query Builder
 */
export class SQLQueryBuilder {
  private query: string = '';
  private parameters: Record<string, unknown> = {};
  private resultType: 'single' | 'multiple' | 'scalar' = 'multiple';

  /**
   * Set SQL query string
   */
  sql(query: string): this {
    this.query = query;
    return this;
  }

  /**
   * Set query parameters
   */
  params(parameters: Record<string, unknown>): this {
    this.parameters = { ...this.parameters, ...parameters };
    return this;
  }

  /**
   * Set single parameter
   */
  param(key: string, value: unknown): this {
    this.parameters[key] = value;
    return this;
  }

  /**
   * Expect single row result
   */
  single(): this {
    this.resultType = 'single';
    return this;
  }

  /**
   * Expect multiple rows result
   */
  multiple(): this {
    this.resultType = 'multiple';
    return this;
  }

  /**
   * Expect scalar value result
   */
  scalar(): this {
    this.resultType = 'scalar';
    return this;
  }

  /**
   * Build SQL query
   */
  build(): SQLQuery {
    if (!this.query) {
      throw new Error('SQL query is required');
    }

    return {
      type: 'sql',
      query: this.query,
      parameters: Object.keys(this.parameters).length > 0 ? this.parameters : undefined,
      resultType: this.resultType,
    };
  }
}

/**
 * Aggregation Query Builder
 */
export class AggregationQueryBuilder {
  private tableName: string = '';
  private aggFunction: AggregationFunction = 'COUNT';
  private columnName: string = '*';
  private filterConditions: Record<string, unknown> = {};
  private groupByColumns: string[] = [];
  private timeRangeValue?: TimeRange;
  private timeColumnName: string = 'created_at';

  /**
   * Set table name
   */
  table(name: string): this {
    this.tableName = name;
    return this;
  }

  /**
   * Set aggregation function
   */
  function(fn: AggregationFunction): this {
    this.aggFunction = fn;
    return this;
  }

  /**
   * Set column to aggregate
   */
  column(name: string): this {
    this.columnName = name;
    return this;
  }

  /**
   * COUNT aggregation
   */
  count(column: string = '*'): this {
    this.aggFunction = 'COUNT';
    this.columnName = column;
    return this;
  }

  /**
   * SUM aggregation
   */
  sum(column: string): this {
    this.aggFunction = 'SUM';
    this.columnName = column;
    return this;
  }

  /**
   * AVG aggregation
   */
  avg(column: string): this {
    this.aggFunction = 'AVG';
    this.columnName = column;
    return this;
  }

  /**
   * MIN aggregation
   */
  min(column: string): this {
    this.aggFunction = 'MIN';
    this.columnName = column;
    return this;
  }

  /**
   * MAX aggregation
   */
  max(column: string): this {
    this.aggFunction = 'MAX';
    this.columnName = column;
    return this;
  }

  /**
   * Add filter condition
   */
  where(key: string, value: unknown): this {
    this.filterConditions[key] = value;
    return this;
  }

  /**
   * Set all filters
   */
  filters(conditions: Record<string, unknown>): this {
    this.filterConditions = { ...this.filterConditions, ...conditions };
    return this;
  }

  /**
   * Add GROUP BY column
   */
  groupBy(...columns: string[]): this {
    this.groupByColumns.push(...columns);
    return this;
  }

  /**
   * Set time range filter
   */
  timeRange(range: TimeRange): this {
    this.timeRangeValue = range;
    return this;
  }

  /**
   * Set time column name
   */
  timeColumn(name: string): this {
    this.timeColumnName = name;
    return this;
  }

  /**
   * Build aggregation query
   */
  build(): AggregationQuery {
    if (!this.tableName) {
      throw new Error('Table name is required');
    }

    return {
      type: 'aggregation',
      table: this.tableName,
      function: this.aggFunction,
      column: this.columnName,
      filters: Object.keys(this.filterConditions).length > 0 ? this.filterConditions : undefined,
      groupBy: this.groupByColumns.length > 0 ? this.groupByColumns : undefined,
      timeRange: this.timeRangeValue,
      timeColumn: this.timeColumnName !== 'created_at' ? this.timeColumnName : undefined,
    };
  }
}

/**
 * Time-Series Query Builder
 */
export class TimeSeriesQueryBuilder {
  private tableName: string = '';
  private metricName: string = '';
  private aggFunction: AggregationFunction = 'COUNT';
  private timeRangeValue?: TimeRange;
  private timeColumnName: string = 'created_at';
  private filterConditions: Record<string, unknown> = {};
  private groupByColumns: string[] = [];

  /**
   * Set table name
   */
  table(name: string): this {
    this.tableName = name;
    return this;
  }

  /**
   * Set metric name
   */
  metric(name: string): this {
    this.metricName = name;
    return this;
  }

  /**
   * Set aggregation function
   */
  function(fn: AggregationFunction): this {
    this.aggFunction = fn;
    return this;
  }

  /**
   * Set time range
   */
  timeRange(range: TimeRange): this {
    this.timeRangeValue = range;
    return this;
  }

  /**
   * Set time column name
   */
  timeColumn(name: string): this {
    this.timeColumnName = name;
    return this;
  }

  /**
   * Add filter condition
   */
  where(key: string, value: unknown): this {
    this.filterConditions[key] = value;
    return this;
  }

  /**
   * Set all filters
   */
  filters(conditions: Record<string, unknown>): this {
    this.filterConditions = { ...this.filterConditions, ...conditions };
    return this;
  }

  /**
   * Add GROUP BY column
   */
  groupBy(...columns: string[]): this {
    this.groupByColumns.push(...columns);
    return this;
  }

  /**
   * Build time-series query
   */
  build(): TimeSeriesQuery {
    if (!this.tableName) {
      throw new Error('Table name is required');
    }
    if (!this.metricName) {
      throw new Error('Metric name is required');
    }
    if (!this.timeRangeValue) {
      throw new Error('Time range is required');
    }

    return {
      type: 'time-series',
      table: this.tableName,
      metric: this.metricName,
      function: this.aggFunction,
      timeRange: this.timeRangeValue,
      timeColumn: this.timeColumnName !== 'created_at' ? this.timeColumnName : undefined,
      filters: Object.keys(this.filterConditions).length > 0 ? this.filterConditions : undefined,
      groupBy: this.groupByColumns.length > 0 ? this.groupByColumns : undefined,
    };
  }
}

/**
 * Threshold Builder
 */
export class ThresholdBuilder {
  private operator: ComparisonOperator = '>';
  private thresholdValue: number | string | number[] | string[] = 0;
  private fallbackValue: boolean = false;

  /**
   * Greater than
   */
  gt(value: number): this {
    this.operator = '>';
    this.thresholdValue = value;
    return this;
  }

  /**
   * Greater than or equal
   */
  gte(value: number): this {
    this.operator = '>=';
    this.thresholdValue = value;
    return this;
  }

  /**
   * Less than
   */
  lt(value: number): this {
    this.operator = '<';
    this.thresholdValue = value;
    return this;
  }

  /**
   * Less than or equal
   */
  lte(value: number): this {
    this.operator = '<=';
    this.thresholdValue = value;
    return this;
  }

  /**
   * Equal
   */
  eq(value: number | string): this {
    this.operator = '=';
    this.thresholdValue = value;
    return this;
  }

  /**
   * Not equal
   */
  neq(value: number | string): this {
    this.operator = '!=';
    this.thresholdValue = value;
    return this;
  }

  /**
   * Between (inclusive)
   */
  between(min: number, max: number): this {
    this.operator = 'between';
    this.thresholdValue = [min, max];
    return this;
  }

  /**
   * In list
   */
  in(values: number[] | string[]): this {
    this.operator = 'in';
    this.thresholdValue = values;
    return this;
  }

  /**
   * Not in list
   */
  notIn(values: number[] | string[]): this {
    this.operator = 'not_in';
    this.thresholdValue = values;
    return this;
  }

  /**
   * Set fallback value
   */
  fallback(value: boolean): this {
    this.fallbackValue = value;
    return this;
  }

  /**
   * Build threshold
   */
  build(): Threshold {
    return {
      operator: this.operator,
      value: this.thresholdValue,
      fallback: this.fallbackValue,
    };
  }
}

/**
 * Main Query Builder
 */
export class QueryBuilder {
  /**
   * Start building SQL query
   */
  static sql(): SQLQueryBuilder {
    return new SQLQueryBuilder();
  }

  /**
   * Start building aggregation query
   */
  static aggregation(): AggregationQueryBuilder {
    return new AggregationQueryBuilder();
  }

  /**
   * Start building time-series query
   */
  static timeSeries(): TimeSeriesQueryBuilder {
    return new TimeSeriesQueryBuilder();
  }

  /**
   * Start building threshold
   */
  static threshold(): ThresholdBuilder {
    return new ThresholdBuilder();
  }
}

/**
 * Create SQL query
 * 
 * @example
 * ```typescript
 * const query = sql('SELECT * FROM users WHERE id = :id')
 *   .params({ id: 123 })
 *   .single()
 *   .build();
 * ```
 */
export function sql(query: string): SQLQueryBuilder {
  return new SQLQueryBuilder().sql(query);
}

/**
 * Create aggregation query
 * 
 * @example
 * ```typescript
 * const query = aggregation()
 *   .table('bookings')
 *   .count()
 *   .where('status', 'approved')
 *   .timeRange({ start: '2024-01-01', end: '2024-12-31' })
 *   .build();
 * ```
 */
export function aggregation(): AggregationQueryBuilder {
  return new AggregationQueryBuilder();
}

/**
 * Create time-series query
 * 
 * @example
 * ```typescript
 * const query = timeSeries()
 *   .table('sessions')
 *   .metric('revenue')
 *   .function('SUM')
 *   .timeRange({ start: '2024-01-01', end: '2024-12-31', granularity: 'month' })
 *   .groupBy('ktv_id')
 *   .build();
 * ```
 */
export function timeSeries(): TimeSeriesQueryBuilder {
  return new TimeSeriesQueryBuilder();
}

/**
 * Create threshold
 * 
 * @example
 * ```typescript
 * const threshold = threshold()
 *   .gte(1000000)
 *   .fallback(false)
 *   .build();
 * ```
 */
export function threshold(): ThresholdBuilder {
  return new ThresholdBuilder();
}
