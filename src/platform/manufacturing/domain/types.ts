/**
 * MANUFACTURING OS - DOMAIN TYPES
 * 
 * Shared domain types for Manufacturing OS.
 * 
 * @module platform/manufacturing/domain
 */

/**
 * Product Reference
 * Simplified product information for work orders
 */
export interface ProductReference {
  id: string;
  sku: string;
  name: string;
}

/**
 * Manufacturing Metrics
 * Common metrics across Manufacturing domain
 */
export interface ManufacturingMetrics {
  totalWorkOrders: number;
  completedWorkOrders: number;
  activeWorkOrders: number;
  totalProduction: number;
  avgQualityRate: number; // percentage
  avgCompletionTime: number; // hours
}
