/**
 * Capability Registry Service
 * 
 * Access layer for query capability risk classification.
 * Holds runtime cache for risk classifications.
 * 
 * @module platform/host/capability-registry
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CapabilityRiskClassification } from './types';

export class CapabilityRegistryService {
  private static instance: CapabilityRegistryService | null = null;
  private readonly cache: Map<string, CapabilityRiskClassification>;

  private constructor(private readonly supabase: SupabaseClient) {
    this.cache = new Map();
  }

  /**
   * Initialize the CapabilityRegistryService singleton
   */
  public static initialize(supabase: SupabaseClient): CapabilityRegistryService {
    if (!CapabilityRegistryService.instance) {
      CapabilityRegistryService.instance = new CapabilityRegistryService(supabase);
    }
    return CapabilityRegistryService.instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): CapabilityRegistryService {
    if (!CapabilityRegistryService.instance) {
      throw new Error('CapabilityRegistryService not initialized. Call initialize() first.');
    }
    return CapabilityRegistryService.instance;
  }

  /**
   * Fetch classification for a specific capability ID
   */
  public async getCapability(capabilityId: string): Promise<CapabilityRiskClassification | undefined> {
    if (this.cache.has(capabilityId)) {
      return this.cache.get(capabilityId);
    }

    const { data, error } = await this.supabase
      .from('capability_risk_registry')
      .select('*')
      .eq('capability_id', capabilityId)
      .maybeSingle();

    if (error) {
      throw new Error(`[CapabilityRegistry] Failed to fetch capability classification: ${error.message}`);
    }

    if (!data) {
      return undefined;
    }

    const classification: CapabilityRiskClassification = {
      capabilityId: data.capability_id,
      capabilityName: data.capability_name,
      domain: data.domain,
      scaleFactor: data.scale_factor,
      clinicalCriticality: data.clinical_criticality,
      blastRadius: data.blast_radius,
      riskScore: data.risk_score,
      calculatedTier: data.calculated_tier as 'T1' | 'T2' | 'T3',
      overrideRule: data.override_rule,
      finalTier: data.final_tier as 'T1' | 'T2' | 'T3',
      rolloutPolicy: data.rollout_policy,
      safetyProfile: data.safety_profile,
      governanceStatus: data.governance_status,
      notes: data.notes,
      sourceDocument: data.source_document,
      sourceVersion: data.source_version,
      generatedAt: data.generated_at,
      generatedFromHash: data.generated_from_hash,
      matrixSignature: data.matrix_signature,
      approvedBy: data.approved_by as { approvers: string[] },
      approvedAt: data.approved_at,
      generatorVersion: data.generator_version,
    };

    this.cache.set(capabilityId, classification);
    return classification;
  }

  /**
   * Fetch all capability classifications
   */
  public async getAllCapabilities(): Promise<CapabilityRiskClassification[]> {
    const { data, error } = await this.supabase
      .from('capability_risk_registry')
      .select('*');

    if (error) {
      throw new Error(`[CapabilityRegistry] Failed to fetch all capability classifications: ${error.message}`);
    }

    return (data || []).map(row => ({
      capabilityId: row.capability_id,
      capabilityName: row.capability_name,
      domain: row.domain,
      scaleFactor: row.scale_factor,
      clinicalCriticality: row.clinical_criticality,
      blastRadius: row.blast_radius,
      riskScore: row.risk_score,
      calculatedTier: row.calculated_tier as 'T1' | 'T2' | 'T3',
      overrideRule: row.override_rule,
      finalTier: row.final_tier as 'T1' | 'T2' | 'T3',
      rolloutPolicy: row.rollout_policy,
      safetyProfile: row.safety_profile,
      governanceStatus: row.governance_status,
      notes: row.notes,
      sourceDocument: row.source_document,
      sourceVersion: row.source_version,
      generatedAt: row.generated_at,
      generatedFromHash: row.generated_from_hash,
      matrixSignature: row.matrix_signature,
      approvedBy: row.approved_by as { approvers: string[] },
      approvedAt: row.approved_at,
      generatorVersion: row.generator_version,
    }));
  }

  /**
   * Clear cache for testing purposes
   */
  public clearCache(): void {
    this.cache.clear();
  }
}
