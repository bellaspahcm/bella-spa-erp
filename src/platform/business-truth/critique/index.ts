/**
 * @fileoverview M3 Self-Critique Module
 * 
 * Governed critique layer that tests evidence sufficiency, unsupported
 * inference, contradictions, ambiguity, and downstream impact.
 * 
 * CRITICAL INVARIANTS:
 * - Critique ≠ Authorization
 * - CRITIQUED ≠ CANONICAL
 * - High assessment ≠ Auto-approval
 * - Lifecycle: PROPOSED → CRITIQUED → AUTHORIZATION → CANONICAL
 * 
 * @module platform/business-truth/critique
 */

export * from './types';
export * from './critique-engine';
export * from './orchestrator';
