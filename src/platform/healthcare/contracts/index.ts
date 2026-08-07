/**
 * Healthcare Platform Engine Contracts
 * 
 * Central export for all Healthcare Platform engine contract definitions.
 * 
 * @module platform/healthcare/contracts
 */

export * from './bed-engine.contract';
export * from './nursing-engine.contract';
export * from './pharmacy-engine.contract';

// Import contract metadata for registration
import { BED_ENGINE_CONTRACT } from './bed-engine.contract';
import { NURSING_ENGINE_CONTRACT } from './nursing-engine.contract';
import { PHARMACY_ENGINE_CONTRACT } from './pharmacy-engine.contract';

/**
 * All Healthcare Platform engine contracts
 * Use this array to register all contracts at startup
 */
export const HEALTHCARE_ENGINE_CONTRACTS = [
  BED_ENGINE_CONTRACT,
  NURSING_ENGINE_CONTRACT,
  PHARMACY_ENGINE_CONTRACT,
];
