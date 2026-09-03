/**
 * @fileoverview Provenance Tracker
 * 
 * Validates provenance completeness per Q0 Invariant #4.
 * 
 * @module platform/business-truth/validators/provenance-tracker
 */

import type { BusinessTruth } from '../types/business-truth';
import type { Provenance, Evidence, Alternative, Conflict } from '../types/provenance';

/**
 * Provenance validation result.
 */
export interface ProvenanceValidation {
  valid: boolean;
  missing: string[];
}

/**
 * Provenance Tracker.
 * 
 * Validates and manages Business Truth provenance.
 */
export class ProvenanceTracker {
  /**
   * Create provenance record for new truth.
   * 
   * @param sources - Evidence sources
   * @param reasoning - Reasoning explanation
   * @param derivedFrom - Parent truth IDs
   * @returns Provenance object
   */
  createProvenance(
    sources: Evidence[],
    reasoning?: string,
    derivedFrom?: string[]
  ): Provenance {
    return {
      sources,
      derivedFrom,
      reasoning,
      alternatives: [],
      conflicts: []
    };
  }
  
  /**
   * Add alternative model to provenance.
   * 
   * @param provenance - Existing provenance
   * @param alternative - Alternative to add
   * @returns Updated provenance
   */
  addAlternative(
    provenance: Provenance,
    alternative: Alternative
  ): Provenance {
    return {
      ...provenance,
      alternatives: [...provenance.alternatives, alternative]
    };
  }
  
  /**
   * Add conflict to provenance.
   * 
   * @param provenance - Existing provenance
   * @param conflict - Conflict to add
   * @returns Updated provenance
   */
  addConflict(
    provenance: Provenance,
    conflict: Conflict
  ): Provenance {
    return {
      ...provenance,
      conflicts: [...provenance.conflicts, conflict]
    };
  }
  
  /**
   * Validate provenance completeness per Q0 Invariant #4.
   * 
   * @param truth - Business truth to validate
   * @returns Validation result
   */
  validateCompleteness(truth: BusinessTruth): ProvenanceValidation {
    const missing: string[] = [];
    
    // INFERENCE requires sources
    if (truth.epistemicStatus === 'INFERENCE' && truth.provenance.sources.length === 0) {
      missing.push('sources (required for INFERENCE)');
    }
    
    // INFERENCE requires reasoning
    if (truth.epistemicStatus === 'INFERENCE' && !truth.provenance.reasoning) {
      missing.push('reasoning (required for INFERENCE)');
    }
    
    // Conflicts require resolution
    for (const conflict of truth.provenance.conflicts) {
      if (!conflict.resolution) {
        missing.push(`conflict resolution: ${conflict.nature}`);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
  
  /**
   * Extract Bella architecture evidence from provenance.
   * 
   * @param provenance - Provenance to check
   * @returns Bella evidence sources
   */
  extractBellaEvidence(provenance: Provenance): Evidence[] {
    return provenance.sources.filter(
      s => s.type === 'BELLA_KERNEL' || s.type === 'BELLA_PATTERN'
    );
  }
  
  /**
   * Check if provenance has alternatives (business decision required).
   * 
   * @param provenance - Provenance to check
   * @returns true if alternatives exist
   */
  hasAlternatives(provenance: Provenance): boolean {
    return provenance.alternatives.length > 0;
  }
  
  /**
   * Check if provenance has unresolved conflicts.
   * 
   * @param provenance - Provenance to check
   * @returns true if unresolved conflicts exist
   */
  hasUnresolvedConflicts(provenance: Provenance): boolean {
    return provenance.conflicts.some(c => !c.resolution);
  }
}
