/**
 * Factory Canonical Scope Derivation Rule
 * 
 * Deterministic machinery for deriving canonical implementation scope from
 * multi-source evidence.
 * 
 * Authority ordering:
 * 1. DB migrations (authoritative persistence)
 * 2. Generated types from real DB (authoritative contract)
 * 3. RLS policies (authoritative governance)
 * 4. Existing domain (evidence of intent)
 * 5. Behavioral tests (evidence of requirements)
 * 6. Historical/deleted code (evidence of history, NOT authority)
 * 
 * Proven behavior source: E8.1 Education OS autonomous scope derivation
 * 
 * @see docs/architecture/E8_EDUCATION_KERNEL_EVIDENCE.md
 */

export interface CanonicalEvidence {
  migration: boolean;      // Table/schema exists in migrations
  generatedTypes: boolean; // Type exists in generated database.types.ts
  rls: boolean;            // RLS policy exists for tenant isolation
  domain: boolean;         // Domain entity/aggregate exists
  tests: boolean;          // Behavioral tests exist
  historical?: boolean;    // Implementation existed but was deleted
}

export type ScopeDecision = 
  | 'CONFORM'         // Implementation matches canonical evidence
  | 'RECONSTRUCT'     // Canonical persistence exists but domain missing
  | 'DEFER'           // Insufficient canonical evidence
  | 'BLOCK'           // Evidence contradictions detected
  | 'DO_NOT_REVIVE';  // Historical only, not canonical

export interface ScopeDerivationResult {
  decision: ScopeDecision;
  reason: string;
  evidence: CanonicalEvidence;
}

/**
 * Derive canonical scope decision from evidence using explicit rules.
 * 
 * CRITICAL: This function uses deterministic predicate logic, NOT scoring heuristics.
 * 
 * @param evidence Multi-source canonical evidence
 * @returns Scope decision with reasoning
 */
export function deriveCanonicalScope(evidence: CanonicalEvidence): ScopeDerivationResult {
  // Rule 1: Historical-only evidence → DO_NOT_REVIVE
  if (evidence.historical && !evidence.migration && !evidence.generatedTypes && !evidence.rls) {
    return {
      decision: 'DO_NOT_REVIVE',
      reason: 'Historical implementation only - no current canonical persistence evidence',
      evidence,
    };
  }

  // Rule 2: Migration/Types mismatch → BLOCK
  if (evidence.migration && !evidence.generatedTypes) {
    return {
      decision: 'BLOCK',
      reason: 'Contract drift detected: migration exists but generated types missing',
      evidence,
    };
  }

  if (!evidence.migration && evidence.generatedTypes) {
    return {
      decision: 'BLOCK',
      reason: 'Orphaned generated type: types exist without corresponding migration',
      evidence,
    };
  }

  // Rule 3: Canonical persistence without RLS → BLOCK
  if (evidence.migration && evidence.generatedTypes && !evidence.rls) {
    return {
      decision: 'BLOCK',
      reason: 'Governance gap: canonical table exists without RLS/tenant isolation',
      evidence,
    };
  }

  // Rule 4: Full canonical chain + domain → CONFORM
  if (evidence.migration && evidence.generatedTypes && evidence.rls && evidence.domain) {
    return {
      decision: 'CONFORM',
      reason: 'Complete canonical evidence: persistence + contract + governance + domain',
      evidence,
    };
  }

  // Rule 5: Canonical persistence without domain → RECONSTRUCT
  // This is the E8 Attendance/Assessment case
  if (evidence.migration && evidence.generatedTypes && evidence.rls && !evidence.domain) {
    return {
      decision: 'RECONSTRUCT',
      reason: 'Canonical drift: authoritative persistence exists but domain implementation missing',
      evidence,
    };
  }

  // Rule 6: Domain without canonical persistence → DEFER
  if (evidence.domain && !evidence.migration) {
    return {
      decision: 'DEFER',
      reason: 'Speculative implementation: domain exists without canonical persistence authority',
      evidence,
    };
  }

  // Rule 7: Tests without persistence → DEFER
  if (evidence.tests && !evidence.migration && !evidence.domain) {
    return {
      decision: 'DEFER',
      reason: 'Tests for non-canonical capability - insufficient persistence evidence',
      evidence,
    };
  }

  // Rule 8: Orphaned RLS without migration → DEFER (could be BLOCK, choosing lenient)
  if (evidence.rls && !evidence.migration && !evidence.generatedTypes) {
    return {
      decision: 'DEFER',
      reason: 'Orphaned RLS policy without canonical persistence',
      evidence,
    };
  }

  // Rule 9: No evidence at all → DEFER
  if (!evidence.migration && !evidence.generatedTypes && !evidence.rls && !evidence.domain && !evidence.tests) {
    return {
      decision: 'DEFER',
      reason: 'No canonical evidence found',
      evidence,
    };
  }

  // Fallback: Insufficient evidence → DEFER
  return {
    decision: 'DEFER',
    reason: 'Insufficient canonical evidence - cannot determine scope deterministically',
    evidence,
  };
}

/**
 * Collect canonical evidence for a specific entity from repository state.
 * 
 * @param entityName Entity to analyze (e.g., 'Course', 'Attendance')
 * @param options Paths to evidence sources
 */
export async function collectCanonicalEvidence(
  entityName: string,
  options: {
    industryScope: string;
    migrationsPath?: string;
    generatedTypesPath?: string;
    domainPath?: string;
    testsPath?: string;
  }
): Promise<CanonicalEvidence> {
  // Delegate to evidence-collector.ts
  // This function signature maintained for backward compatibility
  const { collectEvidence } = await import('./evidence-collector');
  
  return collectEvidence(entityName, {
    industryScope: options.industryScope,
    migrationsPath: options.migrationsPath,
    generatedTypesPath: options.generatedTypesPath,
    domainBasePath: options.domainPath,
    testBasePath: options.testsPath,
  });
}
