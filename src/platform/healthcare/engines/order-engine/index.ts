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
// NOTE: Contract re-exports removed to break circular module resolution
// Consumers should import directly from:
//   src/platform/healthcare/contracts/order-engine.contract
//
// Previous circular dependency:
//   order-engine/index.ts → ../../contracts → order-engine/contracts/ (CYCLE)
//
// This re-export pattern caused TypeScript compiler hang when processing
// order-engine/**/*.ts glob due to circular module resolution.
