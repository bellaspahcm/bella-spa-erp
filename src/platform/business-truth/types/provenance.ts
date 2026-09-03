/**
 * @fileoverview Business Truth Provenance Types
 * 
 * Q0 Contract Dimension 4: Provenance (WHY / FROM WHERE)
 * 
 * Tracks sources, reasoning, alternatives, and conflicts.
 * Essential for transparency and auditability.
 * 
 * @module platform/business-truth/types/provenance
 */

/**
 * Type of evidence source.
 */
export type EvidenceType =
  | 'WEB'
  | 'DOCUMENT'
  | 'API_DOCS'
  | 'BELLA_KERNEL'    // Existing Bella code
  | 'BELLA_PATTERN'   // Bella architecture pattern
  | 'REPOSITORY'
  | 'DATABASE'
  | 'EXPERT'
  | 'REGULATORY'
  | 'INDUSTRY_STANDARD';

/**
 * Strength of evidence.
 */
export type EvidenceStrength =
  | 'STRONG'      // Multiple independent sources, high credibility
  | 'MODERATE'    // Single credible source or multiple weak sources
  | 'WEAK'        // Anecdotal, single weak source
  | 'ASSUMPTION'; // No direct evidence, assumption made

/**
 * Evidence supporting a Business Truth.
 */
export interface Evidence {
  id: string;
  type: EvidenceType;
  source: string; // URL, file path, or identifier
  excerpt?: string;
  relevance: string;
  strength: EvidenceStrength;
  timestamp: Date;
}

/**
 * Alternative model or approach considered.
 */
export interface Alternative {
  option: string;
  description: string;
  pros: string[];
  cons: string[];
  evidence: Evidence[];
  tradeoffs: string;
}

/**
 * Conflict between evidence sources.
 */
export interface Conflict {
  evidenceA: Evidence;
  evidenceB: Evidence;
  nature: string; // Description of contradiction
  resolution?: string; // How conflict was resolved (if resolved)
}

/**
 * Provenance metadata for a Business Truth.
 * 
 * Tracks the complete lineage of how a truth was discovered,
 * reasoned about, and validated.
 */
export interface Provenance {
  sources: Evidence[];
  derivedFrom?: string[]; // IDs of parent Business Truths
  reasoning?: string;
  alternatives: Alternative[];
  conflicts: Conflict[];
}
