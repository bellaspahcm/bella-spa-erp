'use client';

/**
 * useRuleEngine — React hook for Governed Business Rule Engine (D3)
 * Constitution Law 2: Product packs must consume engines via hooks, not direct DB.
 *
 * Governance reminder: D3 handles BUSINESS rules only.
 * ❌ NEVER use this hook for clinical safety rules (drug interactions, allergy blocks).
 *    Those belong in ClinicalSafetyEngine (Phase C).
 */

import { useCallback } from 'react';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import {
  RuleEngineService,
  CreateRuleParams,
  EvaluateRuleParams,
  ApproveRuleParams,
  RuleDomain,
} from '@/platform/host/rule-engine';

async function getEngineInstance(): Promise<RuleEngineService> {
  const supabase = await createDevelopmentBypassClient();
  const user = await getCurrentUser();
  const tenantId = user?.tenant_id ?? '88888888-8888-8888-8888-888888888888';
  return new RuleEngineService(supabase, tenantId);
}

export function useRuleEngine() {
  const createRule = useCallback(
    async (params: CreateRuleParams) => {
      const engine = await getEngineInstance();
      return engine.createRule(params);
    },
    []
  );

  const approveRule = useCallback(
    async (params: ApproveRuleParams) => {
      const engine = await getEngineInstance();
      return engine.approveRule(params);
    },
    []
  );

  const activateRule = useCallback(
    async (ruleId: string) => {
      const engine = await getEngineInstance();
      return engine.activateRule(ruleId);
    },
    []
  );

  const suspendRule = useCallback(
    async (ruleId: string, reason: string) => {
      const engine = await getEngineInstance();
      return engine.suspendRule(ruleId, reason);
    },
    []
  );

  const retireRule = useCallback(
    async (ruleId: string) => {
      const engine = await getEngineInstance();
      return engine.retireRule(ruleId);
    },
    []
  );

  const evaluateRule = useCallback(
    async (params: EvaluateRuleParams) => {
      const engine = await getEngineInstance();
      return engine.evaluateRule(params);
    },
    []
  );

  const evaluateAllActiveRules = useCallback(
    async (
      domain: RuleDomain,
      contextType: string,
      inputData: Record<string, unknown>,
      contextId?: string,
      evaluatedBy?: string
    ) => {
      const engine = await getEngineInstance();
      return engine.evaluateAllActiveRules(domain, contextType, inputData, contextId, evaluatedBy);
    },
    []
  );

  const getActiveRuleVersion = useCallback(
    async (ruleKey: string) => {
      const engine = await getEngineInstance();
      return engine.getActiveRuleVersion(ruleKey);
    },
    []
  );

  return {
    createRule,
    approveRule,
    activateRule,
    suspendRule,
    retireRule,
    evaluateRule,
    evaluateAllActiveRules,
    getActiveRuleVersion,
  };
}
