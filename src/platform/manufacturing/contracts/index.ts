/**
 * MANUFACTURING OS - CONTRACT EXPORTS
 * 
 * Public API for Manufacturing OS canonical capabilities.
 * 
 * @module platform/manufacturing/contracts
 */

// M1: Work Order Management
export * from './work-order.contract';

// M2: Production Tracking
export type { 
  IProductionTrackingContract,
  ProductionRecord,
  RecordProductionRequest,
  ProductionSummary,
  ProductionStatus,
} from './production-tracking.contract';
