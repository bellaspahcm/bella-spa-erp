/**
 * @fileoverview M4 Intelligence Pipeline Module
 * 
 * End-to-end governed intelligence lifecycle orchestration.
 * 
 * Connects M2 (Research) → M3 (Critique) → M1 (Authorization)
 * 
 * CRITICAL GOVERNANCE:
 * - No PROPOSED → CANONICAL shortcuts
 * - No CRITIQUED → CANONICAL shortcuts
 * - No confidence bypasses
 * - No AI self-approval
 * - Authorization uses actual M1 machinery
 * 
 * @module platform/business-truth/pipeline
 */

export * from './types';
export * from './intelligence-pipeline';
