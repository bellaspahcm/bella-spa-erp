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
export * from './or-engine.contract';
export * from './surgical-engine.contract';
export * from './anesthesia-engine.contract';
export * from './cssd-engine.contract';
export * from './pacu-engine.contract';
export * from './or-readiness-engine.contract';
export * from './icu-engine.contract';
export * from './emergency-engine.contract';
export * from './blood-bank-engine.contract';
export * from './cds-engine.contract';
export * from './order-engine.contract';
export * from './sterilization.contract';
export * from './temporal-engine.contract';
export * from './rule-governance.contract';
export * from './clinical-audit.contract';

// Import contract metadata for registration
import { BED_ENGINE_CONTRACT } from './bed-engine.contract';
import { NURSING_ENGINE_CONTRACT } from './nursing-engine.contract';
import { PHARMACY_ENGINE_CONTRACT } from './pharmacy-engine.contract';
import { OR_ENGINE_CONTRACT } from './or-engine.contract';
import { SURGICAL_ENGINE_CONTRACT } from './surgical-engine.contract';
import { ANESTHESIA_ENGINE_CONTRACT } from './anesthesia-engine.contract';
import { CSSD_ENGINE_CONTRACT } from './cssd-engine.contract';
import { PACU_ENGINE_CONTRACT } from './pacu-engine.contract';
import { OR_READINESS_ENGINE_CONTRACT } from './or-readiness-engine.contract';
import { CDS_ENGINE_CONTRACT } from './cds-engine.contract';
import { ORDER_ENGINE_CONTRACT } from './order-engine.contract';

/**
 * All Healthcare Platform engine contracts
 * Use this array to register all contracts at startup
 */
export const HEALTHCARE_ENGINE_CONTRACTS = [
  BED_ENGINE_CONTRACT,
  NURSING_ENGINE_CONTRACT,
  PHARMACY_ENGINE_CONTRACT,
  OR_ENGINE_CONTRACT,
  SURGICAL_ENGINE_CONTRACT,
  ANESTHESIA_ENGINE_CONTRACT,
  CSSD_ENGINE_CONTRACT,
  PACU_ENGINE_CONTRACT,
  OR_READINESS_ENGINE_CONTRACT,
  CDS_ENGINE_CONTRACT,
  ORDER_ENGINE_CONTRACT,
];

