'use server';

/**
 * Architecture Repository & ARB Actions
 * Phase C – Enterprise Governance Platform
 *
 * Governance: Constitution #1 (Zero Silent DB Failures), #3 (Strict Types), #8 (Immutable Finalized)
 */

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type DecisionType = 'ADR' | 'BDR' | 'SDR' | 'TDR' | 'AIDR';
export type DecisionStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';
export type ArbVerdict = 'approved' | 'rejected' | 'needs_revision' | 'abstain';
export type DebtCategory = 'code' | 'architecture' | 'data' | 'security' | 'infra' | 'test' | 'doc';
export type DebtStatus = 'open' | 'in_progress' | 'resolved' | 'accepted_risk' | 'wont_fix';
export type DebtSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ArchDecision {
  id: string;
  adr_code: string;
  title: string;
  status: DecisionStatus;
  decision_type: DecisionType;
  context: string;
  decision: string;
  rationale: string;
  consequences: string | null;
  superseded_by: string | null;
  tags: string[];
  author: string | null;
  reviewed_by: string[];
  created_at: string;
  updated_at: string;
}

export interface ArbReview {
  id: string;
  adr_id: string;
  reviewer_name: string;
  verdict: ArbVerdict;
  comments: string | null;
  reviewed_at: string;
}

export interface TechDebt {
  id: string;
  debt_code: string;
  title: string;
  description: string;
  category: DebtCategory;
  severity: DebtSeverity;
  effort_days: number;
  affected_module: string | null;
  status: DebtStatus;
  remediation_plan: string | null;
  target_quarter: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaturityScore {
  id: string;
  assessment_date: string;
  dimension: string;
  score: number;
  notes: string | null;
  assessed_by: string | null;
  created_at: string;
}

export interface IndustryPack {
  id: string;
  pack_code: string;
  pack_name: string;
  description: string | null;
  version: string;
  status: 'draft' | 'review' | 'active' | 'deprecated' | 'sunset';
  enabled_capabilities: string[];
  country_packs: string[];
  compliance_standards: string[];
  maturity_level: number;
  is_frozen: boolean;
  frozen_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiAgent {
  id: string;
  agent_code: string;
  agent_name: string;
  description: string | null;
  agent_type: 'assistant' | 'autopilot' | 'copilot' | 'evaluator' | 'orchestrator' | 'classifier';
  model: string;
  status: 'draft' | 'active' | 'deprecated' | 'disabled';
  skills: string[];
  avg_latency_ms: number | null;
  total_calls: number;
  total_tokens_used: number;
  monthly_cost_usd: number;
  enabled_for_tenants: string[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Architecture Decisions (ADR) CRUD
// ---------------------------------------------------------------------------
export async function getArchDecisionsAction(): Promise<{
  data: ArchDecision[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('arch_decisions')
    .select('*')
    .order('adr_code', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as ArchDecision[], error: null };
}

export async function createAdrAction(payload: {
  adr_code: string;
  title: string;
  decision_type: DecisionType;
  context: string;
  decision: string;
  rationale: string;
  consequences?: string;
  tags?: string[];
  author?: string;
}): Promise<{ success: boolean; error: string | null; id?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('arch_decisions')
    .insert({
      adr_code: payload.adr_code,
      title: payload.title,
      decision_type: payload.decision_type,
      context: payload.context,
      decision: payload.decision,
      rationale: payload.rationale,
      consequences: payload.consequences ?? null,
      tags: payload.tags ?? [],
      author: payload.author ?? null,
      status: 'proposed',
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/architecture');
  return { success: true, error: null, id: (data as { id: string }).id };
}

export async function updateAdrStatusAction(
  adrId: string,
  status: DecisionStatus,
  supersededBy?: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('arch_decisions')
    .update({
      status,
      superseded_by: supersededBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', adrId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/architecture');
  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// ARB Review Actions
// ---------------------------------------------------------------------------
export async function getArbReviewsAction(adrId: string): Promise<{
  data: ArbReview[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('arch_arb_reviews')
    .select('*')
    .eq('adr_id', adrId)
    .order('reviewed_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as ArbReview[], error: null };
}

export async function submitArbReviewAction(payload: {
  adrId: string;
  reviewerName: string;
  verdict: ArbVerdict;
  comments?: string;
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.from('arch_arb_reviews').insert({
    adr_id: payload.adrId,
    reviewer_name: payload.reviewerName,
    verdict: payload.verdict,
    comments: payload.comments ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Auto-update ADR reviewed_by list
  const { data: adr } = await supabase
    .from('arch_decisions')
    .select('reviewed_by')
    .eq('id', payload.adrId)
    .single();

  if (adr) {
    const existingReviewers = (adr as { reviewed_by: string[] }).reviewed_by ?? [];
    if (!existingReviewers.includes(payload.reviewerName)) {
      await supabase
        .from('arch_decisions')
        .update({
          reviewed_by: [...existingReviewers, payload.reviewerName],
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.adrId);
    }
  }

  revalidatePath('/dashboard/architecture');
  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// Tech Debt Register
// ---------------------------------------------------------------------------
export async function getTechDebtAction(): Promise<{
  data: TechDebt[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('arch_tech_debt')
    .select('*')
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as TechDebt[], error: null };
}

export async function updateDebtStatusAction(
  debtId: string,
  status: DebtStatus
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('arch_tech_debt')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', debtId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/architecture');
  return { success: true, error: null };
}

// ---------------------------------------------------------------------------
// Platform Maturity Scorecard
// ---------------------------------------------------------------------------
export async function getMaturityScoresAction(): Promise<{
  data: MaturityScore[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('arch_maturity_scores')
    .select('*')
    .order('assessment_date', { ascending: false })
    .limit(12); // Last 12 assessment records

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as MaturityScore[], error: null };
}

// ---------------------------------------------------------------------------
// Industry Pack Registry
// ---------------------------------------------------------------------------
export async function getIndustryPacksAction(): Promise<{
  data: IndustryPack[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('platform_industry_packs')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as IndustryPack[], error: null };
}

// ---------------------------------------------------------------------------
// AI Agent Registry
// ---------------------------------------------------------------------------
export async function getAiAgentsAction(): Promise<{
  data: AiAgent[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('platform_ai_agents')
    .select('*')
    .order('agent_type', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as AiAgent[], error: null };
}

export async function getAiPlatformSummaryAction(): Promise<{
  totalAgents: number;
  activeAgents: number;
  totalCallsThisMonth: number;
  totalTokensUsed: number;
  estimatedMonthlyCostUsd: number;
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('platform_ai_agents')
    .select('status, total_calls, total_tokens_used, monthly_cost_usd');

  if (error) {
    return {
      totalAgents: 0,
      activeAgents: 0,
      totalCallsThisMonth: 0,
      totalTokensUsed: 0,
      estimatedMonthlyCostUsd: 0,
      error: error.message,
    };
  }

  const agents = (data ?? []) as Array<{
    status: string;
    total_calls: number;
    total_tokens_used: number;
    monthly_cost_usd: number;
  }>;

  const activeAgents = agents.filter((a) => a.status === 'active');

  return {
    totalAgents: agents.length,
    activeAgents: activeAgents.length,
    totalCallsThisMonth: agents.reduce((s, a) => s + a.total_calls, 0),
    totalTokensUsed: agents.reduce((s, a) => s + a.total_tokens_used, 0),
    estimatedMonthlyCostUsd: agents.reduce((s, a) => s + Number(a.monthly_cost_usd), 0),
    error: null,
  };
}
