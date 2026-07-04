/**
 * Decision Engine Platform - Providers
 * 
 * Decision providers implementing IDecisionProvider interface.
 * 
 * Phase 1: RuleProvider (if-then rules)
 * Phase 2: BIProvider (BI queries) - future
 * Phase 3: CompositeProvider (multi-source) - future
 * Phase 4: AIProvider (ML models) - future
 * Phase 5: ExternalProvider, ManualProvider - future
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 12
 */

export { RuleProvider } from './RuleProvider';
export type { IfThenRule } from './RuleProvider';

// Future providers
// export { BIProvider } from './BIProvider';
// export { AIProvider } from './AIProvider';
// export { ExternalProvider } from './ExternalProvider';
// export { ManualProvider } from './ManualProvider';
// export { CompositeProvider } from './CompositeProvider';
