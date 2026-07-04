/**
 * Decision Engine Platform - Type Definitions
 * 
 * Core type definitions for Decision Engine Platform.
 * All types follow the frozen architecture specification.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md
 */

// DecisionContext exports
export type {
  DecisionContext,
  DecisionUser,
  DecisionOptions,
} from './DecisionContext';

export {
  createDecisionContext,
  validateDecisionContext,
  sanitizeDecisionContext,
} from './DecisionContext';

// DecisionResult exports
export type {
  DecisionResult,
  DecisionAction,
  DecisionError,
} from './DecisionResult';

export {
  createSuccessResult,
  createFallbackResult,
  createErrorResult,
  interpretResult,
  validateDecisionResult,
  sanitizeDecisionResult,
} from './DecisionResult';
