/**
 * @fileoverview Core Business Truth Types
 * 
 * Q0 Contract: Complete Business Truth structure integrating all 6 dimensions.
 * 
 * This is the central data structure representing a validated, governed piece
 * of business knowledge that E10 Factory can consume to build Industry OS.
 * 
 * @module platform/business-truth/types/business-truth
 */

import type { TruthStatus } from './lifecycle';
import type { Authority } from './authority';
import type { Provenance } from './provenance';
import type { Confidence } from './confidence';

// ============================================================================
// DIMENSION 1: CONTENT TYPE
// ============================================================================

/**
 * Type of business knowledge content.
 */
export type ContentType = 
  | 'ENTITY'       // Business objects (Customer, Order, MenuItem)
  | 'PROCESS'      // Workflows (OrderFulfillment, InventorySync)
  | 'RULE'         // Business logic (pricing, validation)
  | 'INVARIANT'    // Constraints (Order.total = sum(lines))
  | 'RELATIONSHIP' // Connections (Order → Customer)
  | 'EVENT';       // Occurrences (OrderPlaced, PaymentReceived)

/**
 * Base content structure.
 */
export interface BusinessTruthContent {
  name: string;
  description: string;
}

/**
 * Entity content (business objects).
 */
export interface EntityContent extends BusinessTruthContent {
  attributes: Array<{
    name: string;
    type: string;
    optional?: boolean;
    constraints?: string[];
  }>;
  relationships?: string[]; // IDs of related RELATIONSHIP truths
}

/**
 * Process content (workflows).
 */
export interface ProcessContent extends BusinessTruthContent {
  steps: Array<{
    order: number;
    name: string;
    description?: string;
  }>;
  rules: string[]; // IDs of related RULE truths
}

/**
 * Rule content (business logic).
 */
export interface RuleContent extends BusinessTruthContent {
  logic: string; // Formal or semi-formal representation
  enforcement: 'SYSTEM' | 'POLICY';
  businessImpact: string;
}

/**
 * Invariant content (constraints that must hold).
 */
export interface InvariantContent extends BusinessTruthContent {
  constraint: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  enforcementPoint: 'DATABASE' | 'APPLICATION' | 'BUSINESS_LOGIC';
}

/**
 * Relationship content (entity connections).
 */
export interface RelationshipContent extends BusinessTruthContent {
  sourceEntity: string; // ID of source ENTITY truth
  targetEntity: string; // ID of target ENTITY truth
  cardinality: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
  cascadeRules?: Array<{
    action: 'DELETE' | 'UPDATE';
    behavior: 'CASCADE' | 'RESTRICT' | 'SET_NULL';
  }>;
}

/**
 * Event content (domain events).
 */
export interface EventContent extends BusinessTruthContent {
  trigger: string;
  payload: Record<string, any>;
  handlers?: string[]; // IDs of related PROCESS truths
}

// ============================================================================
// DIMENSION 2: EPISTEMIC STATUS
// ============================================================================

/**
 * Epistemic status (HOW the truth was known).
 * 
 * This describes the knowledge acquisition method,
 * independent of governance lifecycle status.
 */
export type EpistemicStatus =
  | 'OBSERVATION'  // Direct evidence from source (no reasoning)
  | 'INFERENCE'    // Derived via reasoning (deterministic)
  | 'BELIEF'       // Probable but uncertain, or multiple valid options
  | 'KNOWLEDGE';   // Justified, validated, no reasonable doubt

// ============================================================================
// BUSINESS TRUTH PRIMITIVE
// ============================================================================

/**
 * Business Truth represents a validated, governed piece of business knowledge
 * that E10 Factory can consume to build Industry OS.
 * 
 * Integrates all 6 Q0 Contract dimensions:
 * 1. Content Type (WHAT)
 * 2. Epistemic Status (HOW KNOWN)
 * 3. Authority & Approval (WHO DECIDED)
 * 4. Provenance (WHY / FROM WHERE)
 * 5. Confidence & Uncertainty
 * 6. Status Lifecycle
 */
export interface BusinessTruth {
  // Metadata
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Dimension 1: Content Type (WHAT)
  contentType: ContentType;
  content: BusinessTruthContent;
  
  // Dimension 2: Epistemic Status (HOW KNOWN)
  epistemicStatus: EpistemicStatus;
  
  // Dimension 3: Authority & Approval (WHO DECIDED)
  authority: Authority;
  
  // Dimension 4: Provenance (WHY / FROM WHERE)
  provenance: Provenance;
  
  // Dimension 5: Confidence & Uncertainty
  confidence: Confidence;
  
  // Dimension 6: Status Lifecycle
  status: TruthStatus;
}

// ============================================================================
// BUSINESS TRUTH DOCUMENT (E10 Input)
// ============================================================================

/**
 * Business Truth Document metadata.
 */
export interface BTDMetadata {
  industryOS: string;
  version: string;
  createdAt: Date;
  lastModified: Date;
  approvedBy: string;
  approvalDate: Date;
}

/**
 * Business Truth Document.
 * 
 * Container for all Business Truths for an Industry OS.
 * This is what E10 Factory consumes.
 */
export interface BusinessTruthDocument {
  metadata: BTDMetadata;
  truths: BusinessTruth[];
}
