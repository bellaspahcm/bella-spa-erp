/**
 * Decision Engine Platform - Abstractions
 * 
 * Core abstractions and interfaces for Decision Engine Platform.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 6
 */

export type {
  IDecisionProvider,
  IDecisionProviderMetadata,
  ProviderFactory,
  ProviderRegistrationOptions,
} from './IDecisionProvider';

export { BaseDecisionProvider } from './IDecisionProvider';
