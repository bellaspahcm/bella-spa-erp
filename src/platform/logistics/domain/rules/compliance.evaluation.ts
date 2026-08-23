/**
 * Logistics OS — Compliance Evaluation
 * 
 * Aggregates rule violations into compliance status for regulatory reporting.
 * 
 * Design Principles:
 * - Evidence aggregator (not decision engine)
 * - Deterministic evaluation
 * - Preserves individual rule evidence
 * - Returns facts (data), not commands (actions)
 * 
 * Boundary:
 * - E7.3 evaluates compliance → returns facts
 * - Product interprets facts → decides workflow
 * 
 * @module logistics/domain/rules/compliance.evaluation
 */

import { Rule, RuleResult, ViolationDetail, RuleEvidence } from './rule.types';
import { TraceabilityRecord, ComplianceStatus } from '../traceability.types';
import { Inventory } from '../inventory.types';

/**
 * Compliance Evaluation Context
 */
export interface ComplianceEvaluationContext {
  /** Entity being evaluated (Inventory or TraceabilityRecord) */
  entity: Inventory | TraceabilityRecord;
  
  /** Rules to evaluate */
  rules: Rule<any>[];
  
  /** Evaluation timestamp (for determinism) */
  evaluatedAt: Date;
  
  /** Additional context for rule evaluation */
  additionalContext?: Record<string, any>;
}

/**
 * Compliance Result
 * 
 * Aggregated compliance status with full evidence trail.
 */
export interface ComplianceResult {
  /** Overall compliance status */
  status: 'COMPLIANT' | 'NON_COMPLIANT';
  
  /** Evaluation timestamp */
  evaluatedAt: Date;
  
  /** Entity ID */
  entityId: string;
  
  /** Entity type */
  entityType: 'Inventory' | 'TraceabilityRecord';
  
  /** Aggregated violations (if any) */
  violations: ViolationDetail[];
  
  /** Individual rule results (preserves evidence) */
  ruleResults: RuleResult[];
  
  /** Summary metadata */
  summary: ComplianceSummary;
}

/**
 * Compliance Summary
 * 
 * High-level metrics for reporting.
 */
export interface ComplianceSummary {
  /** Total rules evaluated */
  totalRules: number;
  
  /** Rules passed */
  passed: number;
  
  /** Rules violated */
  violated: number;
  
  /** Violations by severity */
  violationsBySeverity: {
    ERROR: number;
    WARNING: number;
  };
  
  /** Violation codes (unique) */
  violationCodes: string[];
}

/**
 * Regulatory Mapping
 * 
 * Maps violation codes to regulatory requirements.
 */
export interface RegulatoryMapping {
  violationCode: string;
  regulatoryRequirements: RegulatoryRequirement[];
}

/**
 * Regulatory Requirement
 * 
 * Reference to specific regulation/standard.
 */
export interface RegulatoryRequirement {
  /** Regulation name (e.g., "FDA 21 CFR Part 11", "EU GMP") */
  regulation: string;
  
  /** Specific requirement section */
  section: string;
  
  /** Requirement description */
  description: string;
  
  /** Severity if violated */
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
}

/**
 * Compliance Report
 * 
 * Full compliance report with regulatory mappings.
 */
export interface ComplianceReport {
  /** Compliance result */
  result: ComplianceResult;
  
  /** Regulatory mappings (if violations exist) */
  regulatoryMappings?: RegulatoryMapping[];
  
  /** Report generation timestamp */
  generatedAt: Date;
  
  /** Report ID (for audit trail) */
  reportId: string;
}

/**
 * Evaluate Compliance
 * 
 * Aggregate rule evaluations into compliance status.
 * 
 * Invariants:
 * - Deterministic: same context → same result
 * - Evidence preservation: all rule evidence retained
 * - No side effects: read-only operation
 * - No workflow execution
 * 
 * @param context - Evaluation context
 * @returns ComplianceResult (facts, not commands)
 */
export function evaluateCompliance(
  context: ComplianceEvaluationContext
): ComplianceResult {
  const { entity, rules, evaluatedAt, additionalContext = {} } = context;
  
  // Extract entity ID
  const entityId = 'id' in entity ? entity.id.value : 'unknown';
  const entityType = 'lot_number' in entity || 'serial_number' in entity
    ? 'TraceabilityRecord'
    : 'Inventory';
  
  // Evaluate all rules
  const ruleResults: RuleResult[] = [];
  const violations: ViolationDetail[] = [];
  
  for (const rule of rules) {
    // Build rule context
    const ruleContext = {
      ...entity,
      ...additionalContext,
      evaluationDate: evaluatedAt, // Explicit time for determinism
    };
    
    // Evaluate rule
    const result = rule.evaluate(ruleContext);
    ruleResults.push(result);
    
    // Collect violations
    if (result.status === 'VIOLATION') {
      violations.push(result.violation);
    }
  }
  
  // Determine overall status
  const status: 'COMPLIANT' | 'NON_COMPLIANT' = violations.length > 0
    ? 'NON_COMPLIANT'
    : 'COMPLIANT';
  
  // Build summary
  const summary = buildComplianceSummary(ruleResults);
  
  return {
    status,
    evaluatedAt,
    entityId,
    entityType,
    violations,
    ruleResults,
    summary,
  };
}

/**
 * Build Compliance Summary
 * 
 * Internal helper to aggregate metrics.
 */
function buildComplianceSummary(ruleResults: RuleResult[]): ComplianceSummary {
  const totalRules = ruleResults.length;
  const passed = ruleResults.filter(r => r.status === 'PASS').length;
  const violated = ruleResults.filter(r => r.status === 'VIOLATION').length;
  
  const violations = ruleResults
    .filter(r => r.status === 'VIOLATION')
    .map(r => (r as any).violation as ViolationDetail);
  
  const violationsBySeverity = {
    ERROR: violations.filter(v => v.severity === 'ERROR').length,
    WARNING: violations.filter(v => v.severity === 'WARNING').length,
  };
  
  const violationCodes = [...new Set(violations.map(v => v.code))];
  
  return {
    totalRules,
    passed,
    violated,
    violationsBySeverity,
    violationCodes,
  };
}

/**
 * Generate Compliance Report
 * 
 * Create full compliance report with regulatory mappings.
 * 
 * @param result - Compliance result
 * @param mappings - Optional regulatory mappings
 * @returns ComplianceReport
 */
export function generateComplianceReport(
  result: ComplianceResult,
  mappings?: RegulatoryMapping[]
): ComplianceReport {
  const reportId = `RPT-${Date.now()}-${result.entityId}`;
  const generatedAt = new Date();
  
  // Filter mappings to only include relevant violations
  const relevantMappings = mappings?.filter(m =>
    result.violations.some(v => v.code === m.violationCode)
  );
  
  return {
    result,
    regulatoryMappings: relevantMappings,
    generatedAt,
    reportId,
  };
}

/**
 * Default Regulatory Mappings
 * 
 * Common mappings for logistics compliance.
 */
export const DEFAULT_REGULATORY_MAPPINGS: RegulatoryMapping[] = [
  {
    violationCode: 'INVENTORY_EXPIRED',
    regulatoryRequirements: [
      {
        regulation: 'FDA 21 CFR Part 211',
        section: '§211.137',
        description: 'Expiration dating must be established and maintained',
        severity: 'CRITICAL',
      },
      {
        regulation: 'EU GMP Chapter 5',
        section: '5.45',
        description: 'Expired materials shall not be used',
        severity: 'CRITICAL',
      },
    ],
  },
  {
    violationCode: 'LOT_NUMBER_REQUIRED',
    regulatoryRequirements: [
      {
        regulation: 'FDA 21 CFR Part 211',
        section: '§211.132',
        description: 'Each lot or batch must have a unique identifier',
        severity: 'CRITICAL',
      },
      {
        regulation: 'ISO 9001:2015',
        section: '8.5.2',
        description: 'Identification and traceability of products',
        severity: 'MAJOR',
      },
    ],
  },
  {
    violationCode: 'BROKEN_TRACEABILITY_CHAIN',
    regulatoryRequirements: [
      {
        regulation: 'FDA Food Safety Modernization Act (FSMA)',
        section: '§1.1305',
        description: 'Traceability records must be complete and accurate',
        severity: 'CRITICAL',
      },
      {
        regulation: 'EU Regulation 178/2002',
        section: 'Article 18',
        description: 'Traceability of food and feed must be ensured at all stages',
        severity: 'CRITICAL',
      },
    ],
  },
  {
    violationCode: 'COMPLIANCE_VIOLATION',
    regulatoryRequirements: [
      {
        regulation: 'General Compliance',
        section: 'N/A',
        description: 'Entity does not meet compliance requirements',
        severity: 'MAJOR',
      },
    ],
  },
];

/**
 * Map Violations to Regulatory Requirements
 * 
 * Lookup regulatory requirements for violation codes.
 * 
 * @param violations - Violations to map
 * @param mappings - Regulatory mappings (defaults to DEFAULT_REGULATORY_MAPPINGS)
 * @returns Filtered mappings
 */
export function mapViolationsToRegulations(
  violations: ViolationDetail[],
  mappings: RegulatoryMapping[] = DEFAULT_REGULATORY_MAPPINGS
): RegulatoryMapping[] {
  const violationCodes = violations.map(v => v.code);
  
  return mappings.filter(m => violationCodes.includes(m.violationCode));
}
