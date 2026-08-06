import type { PlatformContext } from '@/platform';
import type { KnowledgeEntry } from '@/platform/knowledge';
import { healthcareKnowledgeEngine } from '../kernel/knowledge-engine';

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM PROVIDER INTERFACES
// (These represent the DI targets for Platform Core Engines)
// ═══════════════════════════════════════════════════════════════════════════

export interface RuleCheckResult {
  readonly triggered: boolean;
  readonly warnings: string[];
  readonly blockers: string[];
}

export interface KnowledgeProvider {
  search(query: string, _context: PlatformContext): Promise<KnowledgeEntry[]>;
  verifyRules(facts: Record<string, unknown>, _context: PlatformContext): Promise<RuleCheckResult>;
}

export interface PolicyViolation {
  readonly code: string;
  readonly message: string;
}

export interface PolicyResult {
  readonly satisfied: boolean;
  readonly violations: PolicyViolation[];
}

export interface PolicyProvider {
  evaluate(policyCode: string, input: Record<string, unknown>, _context: PlatformContext): Promise<PolicyResult>;
}

export interface WorkflowProvider {
  startInstance(definitionId: string, journeyId: string, _context: PlatformContext): Promise<string>;
  executeStep(instanceId: string, stepName: string, _context: PlatformContext): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTHCARE SPECIFIC IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

export class HealthcareKnowledgeProvider implements KnowledgeProvider {
  async search(query: string, _context: PlatformContext): Promise<KnowledgeEntry[]> {
    const results = await healthcareKnowledgeEngine.searchIcd10Diseases(
      context.tenant.id,
      query
    );
    return results.map((r) => r.entry);
  }

  async verifyRules(facts: Record<string, unknown>, _context: PlatformContext): Promise<RuleCheckResult> {
    const allergies = (facts.allergies as string[]) || [];
    const prescribedDrugs = (facts.prescribed_drugs as string[]) || [];

    const check = await healthcareKnowledgeEngine.checkPrescriptionSafety(
      context.tenant.id,
      allergies,
      prescribedDrugs
    );

    return {
      triggered: check.triggered,
      warnings: check.warnings,
      blockers: check.blockers,
    };
  }
}

export class HealthcarePolicyProvider implements PolicyProvider {
  async evaluate(policyCode: string, input: Record<string, unknown>, _context: PlatformContext): Promise<PolicyResult> {
    // Basic evaluation logic. For production, this will invoke Platform PolicyEngine.
    const violations: PolicyViolation[] = [];

    if (policyCode === 'DRUG_AGE_LIMIT') {
      const age = Number(input.age);
      const isDangerousDrug = input.drugCode === 'J01CR02'; // Augmentin
      if (isDangerousDrug && age < 2) {
        violations.push({
          code: 'AGE_BELOW_MINIMUM',
          message: 'Kháng sinh Augmentin không khuyên dùng cho trẻ dưới 2 tuổi mà không có giám sát đặc biệt.',
        });
      }
    }

    return {
      satisfied: violations.length === 0,
      violations,
    };
  }
}

export class HealthcareWorkflowProvider implements WorkflowProvider {
  async startInstance(definitionId: string, journeyId: string, _context: PlatformContext): Promise<string> {
    console.log(`[HealthcareWorkflowProvider] Starting workflow definition ${definitionId} for journey ${journeyId}`);
    return crypto.randomUUID();
  }

  async executeStep(instanceId: string, stepName: string, _context: PlatformContext): Promise<void> {
    console.log(`[HealthcareWorkflowProvider] Executing workflow step ${stepName} on instance ${instanceId}`);
  }
}
