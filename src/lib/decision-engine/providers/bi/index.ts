/**
 * Decision Engine Platform - BI Provider Module
 * 
 * Business Intelligence Provider for data-driven decisions.
 * 
 * @module providers/bi
 */

// Types
export type {
  BIQueryType,
  ComparisonOperator,
  AggregationFunction,
  TimeRange,
  SQLQuery,
  AggregationQuery,
  TimeSeriesQuery,
  MetricQuery,
  BIQuery,
  BIQueryResult,
  Threshold,
  BIQueryWithThreshold,
  QueryParameterSchema,
  QueryValidationResult,
  BIQueryOptions,
} from './types';

export {
  validateQueryParameters,
  evaluateThreshold,
  parseTimeRange,
  buildWhereClause,
} from './types';

// Query Builder
export {
  QueryBuilder,
  SQLQueryBuilder,
  AggregationQueryBuilder,
  TimeSeriesQueryBuilder,
  ThresholdBuilder,
  sql,
  aggregation,
  timeSeries,
  threshold,
} from './QueryBuilder';

// BI Client Interface
export type {
  DatabaseConfig,
  ConnectionHealth,
  QueryStats,
  ITransaction,
  IBIClient,
  DatabaseSchema,
  TableSchema,
  ColumnSchema,
  IndexSchema,
} from './IBIClient';

export {
  BIClientError,
  ConnectionError,
  QueryError,
  QueryTimeoutError,
  TransactionError,
  BaseBIClient,
  createBIClient,
} from './IBIClient';

// BI Provider
export type { BIProviderConfig } from './BIProvider';

export { BIProvider, createBIProvider } from './BIProvider';
