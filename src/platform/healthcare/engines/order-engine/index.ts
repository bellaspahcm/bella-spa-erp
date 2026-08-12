// ===========================
// Core Engine Services
// ===========================
export { ClinicalOrderService } from './services/clinical-order.service';
export { OrderEngineService } from './order-engine.service';

// ===========================
// Factory Functions
// ===========================
export {
  createClinicalOrderService,
  getClinicalOrderService,
  resetClinicalOrderService,
} from './order-engine.factory';

// ===========================
// Registration Functions
// ===========================
export {
  registerOrderEngine,
  unregisterOrderEngine,
} from './order-engine.registration';

// ===========================
// Contract Definitions
// ===========================
export {
  ORDER_ENGINE_CONTRACT,
  type OrderEngineContract,
} from '../../contracts/order-engine.contract';
export type {
  ClinicalOrder,
  OrderType,
  OrderStatus,
  OrderPriority,
  CdsCheckStatus,
  MedicationOrderDetails,
  LabOrderDetails,
  ImagingOrderDetails,
  GenericOrderDetails,
  CdsOverrideRecord,
  CreateOrderRequest,
  ApproveOrderRequest,
  DiscontinueOrderRequest,
  OverrideCdsWarningRequest,
  GetActiveOrdersRequest,
  CreateOrderResult,
} from '../../contracts/order-engine.contract';
