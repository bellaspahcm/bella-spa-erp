/**
 * Platform Contracts
 * 
 * Cross-vertical generic capability contracts.
 * 
 * **Classification:**
 * - Semantically generic (no vertical-specific domain concepts)
 * - Cross-vertical consumers (multiple verticals use same contract)
 * - Business rules external (consumers implement, not contract)
 * - Broadly applicable (any vertical can reuse)
 * 
 * **Vertical-specific contracts belong in:**
 * - src/platform/healthcare/contracts/ (Healthcare vertical)
 * - src/platform/logistics/ (Logistics vertical)
 * - src/platform/education/contracts/ (Education vertical)
 * - src/platform/real-estate/contracts/ (Real Estate vertical)
 * 
 * **Related:**
 * - ADR-006: Temporal Platform Layer for Cross-Vertical Capabilities
 * 
 * @module platform/contracts
 */

export * from './v1';
