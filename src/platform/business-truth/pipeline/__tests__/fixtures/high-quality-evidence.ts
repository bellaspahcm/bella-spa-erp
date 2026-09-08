/**
 * @fileoverview High-Quality Evidence Fixtures for M4
 * 
 * These fixtures are designed to legitimately pass M3 critique standards.
 * 
 * CRITICAL: These are NOT test bypasses. They represent production-quality
 * evidence that SHOULD pass governed pipeline.
 * 
 * For M4 negative tests, use weak fixtures to prove governance blocks them.
 */

import type { Evidence } from '../../../types/business-truth';

/**
 * Create high-quality Bella kernel evidence.
 * 
 * Meets M3 requirements:
 * - Multiple evidence sources (≥ minEvidenceCount)
 * - Strong evidence strength
 * - Clear relevance
 * - Proper provenance
 * - NO alternatives (single clear pattern)
 */
export function createHighQualityBellaEvidence(industry: string): Evidence[] {
  const now = new Date();
  
  return [
    // Single BELLA_KERNEL to avoid alternatives
    {
      id: `bella-evidence-${industry}-1`,
      type: 'BELLA_KERNEL',
      source: 'src/platform/spa/domain/service.entity.ts',
      excerpt: 'export class Service { id: string; name: string; description: string; price: Money; duration: Duration; }',
      relevance: `${industry} industry uses Service entity pattern from Spa Kernel`,
      strength: 'STRONG',
      timestamp: now,
      content: {
        kernelName: 'Spa',
        pattern: 'Service-based business model'
      }
    },
    // Supporting evidence from patterns (not additional kernels)
    {
      id: `bella-evidence-${industry}-2`,
      type: 'BELLA_PATTERN',
      source: 'src/platform/spa/domain/patterns/appointment.pattern.ts',
      excerpt: 'Appointment scheduling pattern with service assignment',
      relevance: `${industry} can use appointment pattern for service booking`,
      strength: 'STRONG',
      timestamp: now
    },
    {
      id: `bella-evidence-${industry}-3`,
      type: 'BELLA_PATTERN',
      source: 'src/platform/spa/domain/patterns/membership.pattern.ts',
      excerpt: 'Membership pattern: recurring service relationships',
      relevance: `${industry} can use membership pattern for customer retention`,
      strength: 'STRONG',
      timestamp: now
    }
  ];
}

/**
 * Create weak evidence for negative tests.
 * 
 * These SHOULD be blocked by M3 critique.
 */
export function createWeakEvidence(industry: string): Evidence[] {
  return [
    {
      id: `weak-evidence-${industry}-1`,
      type: 'WEB',
      source: 'https://example.com',
      excerpt: 'Some industry info',
      relevance: 'Vague relevance',
      strength: 'WEAK',
      timestamp: new Date()
    }
  ];
}

/**
 * Create contradictory evidence for negative tests.
 * 
 * These SHOULD be blocked by M3 contradiction detection.
 */
export function createContradictoryEvidence(industry: string): Evidence[] {
  const now = new Date();
  
  return [
    {
      id: `contra-evidence-${industry}-1`,
      type: 'DOCUMENT',
      source: 'doc-a.md',
      excerpt: `${industry} uses approach A`,
      relevance: 'Approach A',
      strength: 'MODERATE',
      timestamp: now
    },
    {
      id: `contra-evidence-${industry}-2`,
      type: 'DOCUMENT',
      source: 'doc-b.md',
      excerpt: `${industry} uses approach B (contradicts A)`,
      relevance: 'Approach B (contradicts A)',
      strength: 'MODERATE',
      timestamp: now
    }
  ];
}
