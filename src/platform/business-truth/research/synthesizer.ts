/**
 * @fileoverview Evidence Synthesizer
 * 
 * Aggregates evidence from multiple sources, detects patterns,
 * identifies conflicts and alternatives, calculates confidence.
 * 
 * @module platform/business-truth/research/synthesizer
 */

import type { Evidence } from '../types/business-truth';
import type { Alternative, Conflict } from '../types/provenance';
import type { SynthesisResult } from './types';

/**
 * Evidence Synthesizer.
 * 
 * Synthesizes evidence from multiple collectors into coherent patterns.
 */
export class EvidenceSynthesizer {
  /**
   * Synthesize evidence into patterns, conflicts, alternatives.
   * 
   * @param evidence - All collected evidence
   * @returns Synthesis result
   */
  synthesize(evidence: Evidence[]): SynthesisResult {
    if (evidence.length === 0) {
      return {
        patterns: [],
        conflicts: [],
        alternatives: [],
        confidenceScore: 0,
        assumptions: ['No evidence available']
      };
    }
    
    // Extract patterns
    const patterns = this.extractPatterns(evidence);
    
    // Detect conflicts
    const conflicts = this.detectConflicts(evidence);
    
    // Identify alternatives
    const alternatives = this.identifyAlternatives(evidence, patterns);
    
    // Calculate confidence
    const confidenceScore = this.calculateConfidence(evidence, conflicts);
    
    // Identify assumptions
    const assumptions = this.identifyAssumptions(evidence, patterns);
    
    return {
      patterns,
      conflicts,
      alternatives,
      confidenceScore,
      assumptions
    };
  }
  
  /**
   * Extract common patterns from evidence.
   */
  private extractPatterns(evidence: Evidence[]): string[] {
    const patterns: string[] = [];
    
    // Group evidence by type
    const bellaEvidence = evidence.filter(e => e.type === 'BELLA_KERNEL' || e.type === 'BELLA_PATTERN');
    const webEvidence = evidence.filter(e => e.type === 'WEB');
    
    // Bella patterns are strong indicators
    if (bellaEvidence.length > 0) {
      patterns.push('Bella kernel patterns available for reuse');
      
      // Check what kernel structures exist
      for (const e of bellaEvidence) {
        if (e.content?.structure?.hasDomain) {
          patterns.push('Domain layer pattern (entities, value objects)');
        }
        if (e.content?.structure?.hasContracts) {
          patterns.push('Contract-based interface pattern');
        }
        if (e.content?.structure?.hasEngines) {
          patterns.push('Engine-based business logic pattern');
        }
      }
    }
    
    // Web patterns indicate industry standards
    if (webEvidence.length > 0) {
      patterns.push('Industry-standard operational patterns');
    }
    
    return [...new Set(patterns)];  // Deduplicate
  }
  
  /**
   * Detect conflicts between evidence sources.
   */
  private detectConflicts(evidence: Evidence[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Simple conflict detection: different sources with different strengths
    const strongEvidence = evidence.filter(e => e.strength === 'STRONG');
    const weakEvidence = evidence.filter(e => e.strength === 'WEAK');
    
    if (strongEvidence.length > 0 && weakEvidence.length > 0) {
      // Potential conflict between strong and weak sources
      conflicts.push({
        evidenceA: strongEvidence[0],
        evidenceB: weakEvidence[0],
        nature: 'Evidence strength discrepancy',
        resolution: 'Prefer strong evidence (Bella patterns) over weak evidence'
      });
    }
    
    return conflicts;
  }
  
  /**
   * Identify alternative approaches from evidence.
   */
  private identifyAlternatives(evidence: Evidence[], patterns: string[]): Alternative[] {
    const alternatives: Alternative[] = [];
    
    // If multiple kernels found, might indicate alternatives
    const kernels = evidence.filter(e => e.type === 'BELLA_KERNEL');
    
    if (kernels.length > 1) {
      // Multiple kernels suggest alternative implementation patterns
      for (const kernel of kernels) {
        alternatives.push({
          option: `Use ${kernel.content?.kernelName || 'unknown'} kernel pattern`,
          description: `Reuse existing ${kernel.content?.kernelName || 'unknown'} kernel architecture`,
          pros: ['Proven Bella pattern', 'Reusable'],
          cons: ['May need adaptation'],
          evidence: [kernel],
          tradeoffs: 'Reusability vs exact fit'
        });
      }
    }
    
    return alternatives;
  }
  
  /**
   * Calculate overall confidence score.
   */
  private calculateConfidence(evidence: Evidence[], conflicts: Conflict[]): number {
    if (evidence.length === 0) return 0;
    
    // Base confidence on evidence quality
    let totalStrength = 0;
    let maxPossible = evidence.length * 3;  // STRONG = 3
    
    for (const e of evidence) {
      switch (e.strength) {
        case 'STRONG':
          totalStrength += 3;
          break;
        case 'MODERATE':
          totalStrength += 2;
          break;
        case 'WEAK':
          totalStrength += 1;
          break;
      }
    }
    
    let confidence = totalStrength / maxPossible;
    
    // Reduce confidence if conflicts exist
    if (conflicts.length > 0) {
      confidence *= 0.8;  // 20% reduction per conflict group
    }
    
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Identify assumptions made during synthesis.
   */
  private identifyAssumptions(evidence: Evidence[], patterns: string[]): string[] {
    const assumptions: string[] = [];
    
    // Evidence-based assumptions
    if (evidence.length < 3) {
      assumptions.push('Limited evidence available');
    }
    
    const hasWebEvidence = evidence.some(e => e.type === 'WEB');
    const hasBellaEvidence = evidence.some(e => e.type === 'BELLA_KERNEL');
    
    if (!hasWebEvidence) {
      assumptions.push('No web/industry-standard evidence consulted');
    }
    
    if (!hasBellaEvidence) {
      assumptions.push('No existing Bella patterns found');
    }
    
    // Pattern-based assumptions
    if (patterns.length === 0) {
      assumptions.push('No clear patterns identified');
    }
    
    return assumptions;
  }
}
