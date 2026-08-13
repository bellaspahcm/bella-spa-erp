import { IEducationRuleGovernancePort, GradingRule } from '../../education/ports/rule-governance.port';
import { RuleEngineService } from '../rule-engine/rule-engine.service';
import { createClient } from '@/lib/supabase-server';
import crypto from 'crypto';

export class EducationRuleGovernanceAdapter implements IEducationRuleGovernancePort {
  public async getActiveGradingRule(tenantId: string): Promise<GradingRule> {
    const supabase = createClient();
    const service = new RuleEngineService(supabase, tenantId);
    
    // Aligned Domain & Rule: Domain = 'education.enrollment', Key = 'education.grading_rule'
    const rule = await service.getActiveRuleVersion('education.grading_rule');
    if (!rule) {
      throw new Error('Active grading rule not found in Rule Governance');
    }

    // A. Enforce domain constraint at runtime
    if (rule.domain !== 'education.enrollment') {
      throw new Error(`Rule Governance Config Error: Rule domain mismatch. Expected "education.enrollment", got "${rule.domain}"`);
    }

    const scaleType = rule.conditions.rules.find(r => r.field === 'scaleType')?.value as GradingRule['scaleType'];
    const passingThreshold = rule.actionParams.passingThreshold as number;

    // Strict runtime discriminated validation (No cast fallbacks, exact limits check)
    if (scaleType === 'scale_10') {
      if (passingThreshold === undefined || typeof passingThreshold !== 'number' || !isFinite(passingThreshold) || passingThreshold < 0 || passingThreshold > 10) {
        throw new Error(`Rule Governance Config Error: Threshold ${passingThreshold} out of bounds for scale_10`);
      }
      return {
        scaleType: 'scale_10',
        passingThreshold,
        ruleVersion: rule.version,
        checksum: crypto.createHash('sha256').update(JSON.stringify(rule)).digest('hex'),
      };
    } else if (scaleType === 'percentage') {
      if (passingThreshold === undefined || typeof passingThreshold !== 'number' || !isFinite(passingThreshold) || passingThreshold < 0 || passingThreshold > 100) {
        throw new Error(`Rule Governance Config Error: Threshold ${passingThreshold} out of bounds for percentage`);
      }
      return {
        scaleType: 'percentage',
        passingThreshold,
        ruleVersion: rule.version,
        checksum: crypto.createHash('sha256').update(JSON.stringify(rule)).digest('hex'),
      };
    } else if (scaleType === 'gpa_4') {
      if (passingThreshold === undefined || typeof passingThreshold !== 'number' || !isFinite(passingThreshold) || passingThreshold < 0 || passingThreshold > 4) {
        throw new Error(`Rule Governance Config Error: Threshold ${passingThreshold} out of bounds for gpa_4`);
      }
      return {
        scaleType: 'gpa_4',
        passingThreshold,
        ruleVersion: rule.version,
        checksum: crypto.createHash('sha256').update(JSON.stringify(rule)).digest('hex'),
      };
    }

    throw new Error(`Rule Governance Config Error: Invalid scaleType "${scaleType}"`);
  }
}
