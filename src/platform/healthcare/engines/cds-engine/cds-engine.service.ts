/**
 * CDS Engine Service — Phase C: Clinical Decision Support
 *
 * Clinical Intelligence Layer providing:
 *   1. Drug-Drug Interaction (DDI) checking (bidirectional)
 *   2. Allergy contraindication checking (ANAPHYLAXIS = absolute block)
 *   3. Protocol adherence checking (dose, age, weight, renal, hepatic, pregnancy)
 *
 * Architecture:
 *   - Global Clinical Knowledge (no tenant_id, governed centrally, append-only)
 *   - Tenant Clinical Policy (per-tenant enforcement overrides)
 *   - CDS Evaluation = Global KB merged with Tenant Policy
 *   - Every evaluation writes an immutable record to hc_clinical_calculations
 *
 * Constitution Compliance:
 *   - Law 1: Encounter is aggregate root (encounterId on all requests)
 *   - Law 5: Events published on BLOCK/ABSOLUTE_BLOCK decisions
 *   - Law 11: Zero `any` types
 *
 * @module platform/healthcare/engines/cds-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CdsEngineContract,
  CdsAlert,
  CdsCheckResult,
  CdsSeverity,
  CdsEnforcement,
  CheckDrugInteractionsRequest,
  CheckAllergyRequest,
  CheckProtocolAdherenceRequest,
  GenerateCdsSummaryRequest,
  RecordAllergyRequest,
  PatientAllergy,
  IDecisionContract,
} from '../../contracts/cds-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '@/platform/host/event-bus';
import { CdsContextSnapshot } from './domain/cds-context-snapshot.entity';
import { CdsDecision } from './domain/cds-decision.entity';
import * as crypto from 'crypto';

// ============================================================================
// Internal DB Row Types
// ============================================================================

interface DrugInteractionRow {
  id: string;
  drug_a_code: string;
  drug_b_code: string;
  severity: string;
  enforcement: string;
  mechanism: string | null;
  clinical_effect: string;
  management_guidance: string | null;
  evidence_level: string;
  source: string | null;
  kb_version: string;
}

interface TenantCdsPolicyRow {
  id: string;
  interaction_id: string | null;
  protocol_id: string | null;
  override_enforcement: string;
  policy_version: string;
}

interface PatientAllergyRow {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_id: string;
  allergen_type: string;
  allergen_code: string;
  allergen_name: string;
  reaction_type: string;
  severity: string;
  onset_date: string | null;
  recorded_by: string;
  is_active: boolean;
  created_at: string;
}

interface ClinicalProtocolRow {
  id: string;
  protocol_code: string;
  drug_code: string | null;
  drug_class: string | null;
  contraindication_type: string;
  condition_spec: Record<string, unknown>;
  severity: string;
  enforcement: string;
  guideline_source: string | null;
  kb_version: string;
}

// ============================================================================
// Constants
// ============================================================================

const ENGINE_VERSION = '1.0.0';
const KB_VERSION = '2026-08-01';
const POLICY_VERSION_DEFAULT = 'v1.0';

// ============================================================================
// CDS Engine Service
// ============================================================================

export class CdsEngineService implements CdsEngineContract, IDecisionContract {
  readonly engineName = 'cds-engine' as const;
  readonly engineVersion = ENGINE_VERSION;

  constructor(private readonly supabase: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // IDecisionContract implementation (H8-06, H8-08)
  // --------------------------------------------------------------------------

  async evaluate(request: {
    tenantId: string;
    encounterId: string;
    patientId: string;
    actionContext: {
      proposedDrugCode: string;
      proposedDrugClass?: string;
      proposedDoseMg?: number;
    } & Record<string, unknown>;
  }): Promise<EngineResponse<CdsCheckResult>> {
    const now = new Date().toISOString();
    const proposedDrug = request.actionContext.proposedDrugCode;

    interface AllergyContextItem {
      id: string;
      allergen_code: string;
      allergen_name: string;
      reaction_type?: string;
      severity?: string;
    }

    interface ActiveMedicationContextItem {
      code: string;
    }

    interface ActiveOrderContextItem {
      order_details?: {
        drugCode?: string;
      };
    }

    // 1. Context snapshot lookup (H8-03 Tenant Isolated)
    let allergies: AllergyContextItem[] = [];
    let activeMedications: string[] = [];
    let labResults: Record<string, unknown>[] = [];
    let vitalSigns: Record<string, unknown>[] = [];
    let diagnoses: Record<string, unknown>[] = [];
    let snapshotVersion = 0;
    let storedStatus: 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'ERROR' = 'UNAVAILABLE';
    let lastProcessedEventAt: string | null = null;

    try {
      const { data: snapshot } = await this.supabase
        .from('hc_clinical_context_snapshots')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('encounter_id', request.encounterId)
        .maybeSingle();

      if (snapshot) {
        allergies = (snapshot.allergies as AllergyContextItem[]) ?? [];
        activeMedications = (snapshot.active_medications as ActiveMedicationContextItem[] ?? []).map((m) => m.code || (m as unknown as string));
        labResults = (snapshot.lab_results as Record<string, unknown>[]) ?? [];
        vitalSigns = (snapshot.vital_signs as Record<string, unknown>[]) ?? [];
        diagnoses = (snapshot.diagnoses as Record<string, unknown>[]) ?? [];
        snapshotVersion = snapshot.projection_version;
        storedStatus = snapshot.projection_status as 'FRESH' | 'STALE' | 'UNAVAILABLE' | 'ERROR';
        lastProcessedEventAt = snapshot.last_processed_event_at;
      } else {
        // Fallback for tests: direct queries (backward compatibility)
        const { data: directAllergies } = await this.supabase
          .from('hc_patient_allergies')
          .select('*')
          .eq('tenant_id', request.tenantId)
          .eq('patient_id', request.patientId)
          .eq('is_active', true);
        allergies = (directAllergies as AllergyContextItem[]) ?? [];

        // For DDI: fallback to active orders
        const { data: activeOrders } = await this.supabase
          .from('hc_clinical_orders')
          .select('order_details')
          .eq('tenant_id', request.tenantId)
          .eq('encounter_id', request.encounterId)
          .eq('order_type', 'MEDICATION')
          .eq('order_status', 'APPROVED');
        
        activeMedications = (activeOrders as ActiveOrderContextItem[] ?? []).map((o) => o.order_details?.drugCode).filter((c): c is string => Boolean(c));
        
        // Add currentMedicationCodes if passed in actionContext (from older tests)
        if (Array.isArray(request.actionContext.currentMedicationCodes)) {
          const extraCodes = request.actionContext.currentMedicationCodes as string[];
          activeMedications = [...new Set([...activeMedications, ...extraCodes])];
        }
      }

      // Compute dynamic freshness (H8-08)
      let effectiveStatus = storedStatus;
      if (lastProcessedEventAt) {
        const ageMs = Date.now() - new Date(lastProcessedEventAt).getTime();
        if (ageMs > 300000) { // 300 seconds
          effectiveStatus = 'STALE';
        }
      }

      // 2. Perform clinical rule evaluations
      const alerts: CdsAlert[] = [];
      let hardBlocked = false;

      // Allergy Checks
      const matchingAllergy = allergies.find(
        (a) => a.allergen_code === proposedDrug || a.allergen_name === proposedDrug
      );
      if (matchingAllergy) {
        const isAnaphylaxis =
          matchingAllergy.reaction_type === 'ANAPHYLAXIS' ||
          matchingAllergy.severity === 'LIFE_THREATENING';
        const enforcement = isAnaphylaxis ? 'ABSOLUTE_BLOCK' : 'BLOCK';
        const severity = isAnaphylaxis ? 'CRITICAL' : 'WARNING';
        alerts.push({
          alertId: crypto.randomUUID(),
          alertType: 'ALLERGY',
          severity,
          enforcement,
          canOverride: enforcement !== 'ABSOLUTE_BLOCK',
          message: `Allergy contraindication: Patient has recorded allergy to ${proposedDrug}. Reaction: ${matchingAllergy.reaction_type || 'Unknown'}.`,
          sourceId: matchingAllergy.id,
        });
        if (enforcement === 'ABSOLUTE_BLOCK') hardBlocked = true;
      }

      // DDI Checks
      const { data: ddiRows } = await this.supabase
        .from('hc_drug_interactions')
        .select('*')
        .eq('is_active', true)
        .or(`drug_a_code.eq.${proposedDrug},drug_b_code.eq.${proposedDrug}`);

      for (const ddi of ddiRows ?? []) {
        const otherDrug = ddi.drug_a_code === proposedDrug ? ddi.drug_b_code : ddi.drug_a_code;
        if (activeMedications.includes(otherDrug)) {
          const enforcement = ddi.enforcement;
          alerts.push({
            alertId: crypto.randomUUID(),
            alertType: 'DRUG_INTERACTION',
            severity: ddi.severity as CdsSeverity,
            enforcement: enforcement as CdsEnforcement,
            canOverride: enforcement !== 'ABSOLUTE_BLOCK',
            message: `Drug interaction: ${proposedDrug} ↔ ${otherDrug}. ${ddi.clinical_effect}`,
            mechanism: ddi.mechanism ?? undefined,
            managementGuidance: ddi.management_guidance ?? undefined,
            evidenceLevel: ddi.evidence_level as 'A' | 'B' | 'C',
            sourceId: ddi.id,
          });
          if (enforcement === 'ABSOLUTE_BLOCK') hardBlocked = true;
        }
      }

      // Protocol checks
      const { data: protocols } = await this.supabase
        .from('hc_clinical_protocols')
        .select('*')
        .eq('is_active', true)
        .eq('drug_code', proposedDrug);

      for (const proto of protocols ?? []) {
        if (proto.contraindication_type === 'RENAL') {
          const eGFR = request.actionContext.patientEgfr ?? 100;
          const minEgfr = proto.condition_spec?.min_egfr;
          if (minEgfr && eGFR < minEgfr) {
            const enforcement = proto.enforcement;
            alerts.push({
              alertId: crypto.randomUUID(),
              alertType: 'PROTOCOL',
              severity: proto.severity as CdsSeverity,
              enforcement: enforcement as CdsEnforcement,
              canOverride: enforcement !== 'ABSOLUTE_BLOCK',
              message: `Protocol adherence warning: ${proto.protocol_code}. eGFR ${eGFR} < ${minEgfr}. ${proto.condition_spec?.note || ''}`,
              sourceId: proto.id,
            });
            if (enforcement === 'ABSOLUTE_BLOCK') hardBlocked = true;
          }
        }
      }

      // Freshness Escalation (H8-08): if snapshot is not FRESH, escalate warnings/allows to BLOCK
      if (effectiveStatus === 'STALE' || effectiveStatus === 'ERROR' || effectiveStatus === 'UNAVAILABLE') {
        for (const alert of alerts) {
          if (alert.enforcement === 'ACKNOWLEDGE' || alert.enforcement === 'INFORMATIONAL') {
            alert.enforcement = 'BLOCK';
            alert.severity = 'CRITICAL';
            alert.message = `[Escalated due to STALE clinical context] ${alert.message}`;
          }
        }
      }

      const finalPassed = !alerts.some((a) => a.enforcement === 'BLOCK' || a.enforcement === 'ABSOLUTE_BLOCK');
      const finalHardBlocked = alerts.some((a) => a.enforcement === 'ABSOLUTE_BLOCK');

      // 3. Generate evaluation fingerprint (H8-06 Deterministic)
      const ruleChecksum = alerts.map((a) => a.sourceId || 'default').sort().join('-');
      const fingerprint = CdsDecision.calculateFingerprint(
        request.actionContext,
        ENGINE_VERSION,
        ruleChecksum
      );

      // 4. Check cached decision
      const { data: cachedDecision } = await this.supabase
        .from('hc_clinical_decisions')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('evaluation_fingerprint', fingerprint)
        .maybeSingle();

      if (cachedDecision) {
        return {
          success: true,
          data: {
            passed: cachedDecision.result !== 'BLOCK',
            hardBlocked: cachedDecision.enforcement === 'ABSOLUTE_BLOCK',
            alerts: cachedDecision.input_snapshot.alerts || [],
            calculationId: cachedDecision.id,
            knowledgeBaseVersion: KB_VERSION,
            policyVersion: POLICY_VERSION_DEFAULT,
            evaluatedAt: cachedDecision.created_at,
          },
        };
      }

      // 5. Write to both legacy calculations (to satisfy old tests) and new clinical decisions (H8 standard)
      const decisionId = crypto.randomUUID();
      const calcId = await this.writeCalculationRecord({
        id: decisionId,
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientId: request.patientId,
        algorithmId: 'CDS_SUMMARY',
        inputSnapshot: {
          proposedDrug,
          activeMedications,
          actionContext: request.actionContext,
        },
        output: {
          alerts,
          alertCount: alerts.length,
        },
        decision: finalPassed ? 'PASSED' : 'BLOCKED',
        enforcement: finalHardBlocked ? 'ABSOLUTE_BLOCK' : (finalPassed ? 'INFORMATIONAL' : 'BLOCK'),
      });

      // Get or create a default system rule for referencing in the clinical decision log (H8-03 tenant scoped)
      let ruleId: string;
      const { data: defaultRule } = await this.supabase
        .from('hc_cds_rules')
        .select('id')
        .eq('tenant_id', request.tenantId)
        .eq('rule_code', 'CDS-SYSTEM-DEFAULT')
        .maybeSingle();

      if (defaultRule) {
        ruleId = defaultRule.id;
      } else {
        const newRuleId = crypto.randomUUID();
        await this.supabase
          .from('hc_cds_rules')
          .insert({
            id: newRuleId,
            tenant_id: request.tenantId,
            rule_code: 'CDS-SYSTEM-DEFAULT',
            rule_version: '1.0',
            conditions: {},
            outcome: 'ALLOW',
            enforcement: 'OVERRIDABLE',
            severity: 'LOW',
            rule_checksum: 'system-default-checksum',
            active: true
          });
        ruleId = newRuleId;
      }

      const decisionRow = {
        id: decisionId,
        tenant_id: request.tenantId,
        encounter_id: request.encounterId,
        patient_id: request.patientId,
        rule_id: ruleId,
        rule_version: '1.0',
        rule_checksum: ruleChecksum,
        context_snapshot_version: snapshotVersion,
        input_snapshot: { alerts, snapshotStatus: effectiveStatus },
        action_context: request.actionContext,
        result: finalPassed ? 'ALLOW' : 'BLOCK',
        enforcement: finalHardBlocked ? 'ABSOLUTE_BLOCK' : 'OVERRIDABLE',
        severity: finalHardBlocked ? 'CRITICAL' : (finalPassed ? 'LOW' : 'HIGH'),
        reasoning: alerts.map((a) => a.message).join('; '),
        evaluator_version: ENGINE_VERSION,
        evaluation_fingerprint: fingerprint,
        created_at: now,
      };

      const { error: insertError } = await this.supabase
        .from('hc_clinical_decisions')
        .insert(decisionRow);

      if (insertError) {
        if (insertError.code === '23505') {
          // unique constraint violation
          const { data: refetched } = await this.supabase
            .from('hc_clinical_decisions')
            .select('*')
            .eq('tenant_id', request.tenantId)
            .eq('evaluation_fingerprint', fingerprint)
            .single();
          if (refetched) {
            return {
              success: true,
              data: {
                passed: refetched.result !== 'BLOCK',
                hardBlocked: refetched.enforcement === 'ABSOLUTE_BLOCK',
                alerts: refetched.input_snapshot.alerts || [],
                calculationId: refetched.id,
                knowledgeBaseVersion: KB_VERSION,
                policyVersion: POLICY_VERSION_DEFAULT,
                evaluatedAt: refetched.created_at,
              },
            };
          }
        }
        throw new Error(`Failed to persist clinical decision: ${insertError.message}`);
      }

      // Publish block event if block happened (Law 5)
      if (!finalPassed) {
        await eventBus.publish({
          eventType: finalHardBlocked ? 'hos.cds.absolute_block.v1' : 'hos.cds.block.v1',
          tenantId: request.tenantId,
          aggregateId: request.encounterId,
          aggregateType: 'Encounter',
          payload: {
            decisionId,
            encounterId: request.encounterId,
            patientId: request.patientId,
            proposedDrugCode: proposedDrug,
            alerts,
          },
        });
      }

      return {
        success: true,
        data: {
          passed: finalPassed,
          hardBlocked: finalHardBlocked,
          alerts,
          calculationId: decisionId, // return the decisionId
          knowledgeBaseVersion: KB_VERSION,
          policyVersion: POLICY_VERSION_DEFAULT,
          evaluatedAt: now,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'CDS_EVALUATE_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error during CDS evaluation',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 1. Drug-Drug Interaction Check
  // --------------------------------------------------------------------------

  async checkDrugInteractions(
    request: CheckDrugInteractionsRequest
  ): Promise<EngineResponse<CdsCheckResult>> {
    try {
      const now = new Date().toISOString();
      const alerts: CdsAlert[] = [];

      if (request.currentMedicationCodes.length === 0) {
        // No active medications — no DDI possible
        const calcId = await this.writeCalculationRecord({
          tenantId: request.tenantId,
          encounterId: request.encounterId,
          patientId: request.patientId,
          algorithmId: 'DRUG_INTERACTION',
          inputSnapshot: {
            proposedDrug: request.proposedDrugCode,
            activeMedications: [],
          },
          output: { alerts: [] },
          decision: 'PASSED',
          enforcement: 'INFORMATIONAL',
          correlationId: request.correlationId,
          causationId: request.causationId,
        });

        return {
          success: true,
          data: {
            passed: true,
            hardBlocked: false,
            alerts: [],
            calculationId: calcId,
            knowledgeBaseVersion: KB_VERSION,
            policyVersion: POLICY_VERSION_DEFAULT,
            evaluatedAt: now,
          },
        };
      }

      // Fetch all DDI pairs involving proposed drug (bidirectional)
      const { data: ddiRows, error: ddiError } = await this.supabase
        .from('hc_drug_interactions')
        .select('*')
        .eq('is_active', true)
        .or(
          `drug_a_code.eq.${request.proposedDrugCode},drug_b_code.eq.${request.proposedDrugCode}`
        )
        .returns<DrugInteractionRow[]>();

      if (ddiError) throw new Error(`DDI query failed: ${ddiError.message}`);

      const ddiRowsSafe = ddiRows ?? [];

      // Fetch tenant policy overrides for the found interactions
      const interactionIds = ddiRowsSafe.map((r) => r.id);
      const tenantPolicies = await this.fetchTenantCdsPolicies(
        request.tenantId,
        interactionIds,
        []
      );

      // Match DDI pairs against current active medications
      for (const ddi of ddiRowsSafe) {
        const otherDrug =
          ddi.drug_a_code === request.proposedDrugCode
            ? ddi.drug_b_code
            : ddi.drug_a_code;

        if (!request.currentMedicationCodes.includes(otherDrug)) continue;

        // Resolve effective enforcement (tenant policy overrides global)
        const effectiveEnforcement = this.resolveEnforcement(
          ddi.enforcement,
          tenantPolicies.find((p) => p.interaction_id === ddi.id)?.override_enforcement
        );
        const policyVersion = this.resolvePolicyVersion(tenantPolicies, ddi.id, null);

        alerts.push({
          alertId: crypto.randomUUID(),
          alertType: 'DRUG_INTERACTION',
          severity: ddi.severity as CdsSeverity,
          enforcement: effectiveEnforcement,
          canOverride: effectiveEnforcement !== 'ABSOLUTE_BLOCK',
          message: `Drug interaction: ${request.proposedDrugCode} ↔ ${otherDrug}. ${ddi.clinical_effect}`,
          mechanism: ddi.mechanism ?? undefined,
          managementGuidance: ddi.management_guidance ?? undefined,
          evidenceLevel: ddi.evidence_level as 'A' | 'B' | 'C',
          sourceId: ddi.id,
        });

        // Publish event for BLOCK-level+ interactions
        if (effectiveEnforcement === 'BLOCK' || effectiveEnforcement === 'ABSOLUTE_BLOCK') {
          await eventBus.publish({
            eventType: 'hos.cds.drug_interaction.detected.v1',
            tenantId: request.tenantId,
            aggregateId: request.encounterId,
            aggregateType: 'Encounter',
            payload: {
              encounterId: request.encounterId,
              patientId: request.patientId,
              proposedDrug: request.proposedDrugCode,
              interactingDrug: otherDrug,
              severity: ddi.severity,
              enforcement: effectiveEnforcement,
              mechanism: ddi.mechanism,
            },
            correlationId: request.correlationId,
            causationId: request.causationId,
          });
        }
      }

      const decision = this.deriveDecision(alerts);
      const hardBlocked = alerts.some((a) => a.enforcement === 'ABSOLUTE_BLOCK');

      const calcId = await this.writeCalculationRecord({
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientId: request.patientId,
        algorithmId: 'DRUG_INTERACTION',
        inputSnapshot: {
          proposedDrug: request.proposedDrugCode,
          activeMedications: request.currentMedicationCodes,
        },
        output: { alerts },
        decision,
        enforcement: hardBlocked ? 'ABSOLUTE_BLOCK' : this.maxEnforcement(alerts),
        correlationId: request.correlationId,
        causationId: request.causationId,
      });

      return {
        success: true,
        data: {
          passed: decision === 'PASSED',
          hardBlocked,
          alerts,
          calculationId: calcId,
          knowledgeBaseVersion: KB_VERSION,
          policyVersion: POLICY_VERSION_DEFAULT,
          evaluatedAt: now,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'DDI_CHECK_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error in DDI check',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 2. Allergy Contraindication Check
  // --------------------------------------------------------------------------

  async checkAllergyContraindications(
    request: CheckAllergyRequest
  ): Promise<EngineResponse<CdsCheckResult>> {
    try {
      const now = new Date().toISOString();
      const alerts: CdsAlert[] = [];

      // Fetch active allergies for this patient
      const { data: allergyRows, error: allergyError } = await this.supabase
        .from('hc_patient_allergies')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('patient_id', request.patientId)
        .eq('is_active', true)
        .returns<PatientAllergyRow[]>();

      if (allergyError) throw new Error(`Allergy query failed: ${allergyError.message}`);

      const allergies = allergyRows ?? [];

      for (const allergy of allergies) {
        // Check if allergy matches proposed drug code or drug class
        const matchesDrug = allergy.allergen_code === request.proposedDrugCode;
        const matchesClass =
          request.proposedDrugClass !== undefined &&
          allergy.allergen_type === 'DRUG_CLASS' &&
          allergy.allergen_code === request.proposedDrugClass;

        if (!matchesDrug && !matchesClass) continue;

        // Determine enforcement: ANAPHYLAXIS or LIFE_THREATENING = ABSOLUTE_BLOCK
        const isAbsoluteBlock =
          allergy.reaction_type === 'ANAPHYLAXIS' ||
          allergy.severity === 'LIFE_THREATENING';

        const enforcement: CdsEnforcement = isAbsoluteBlock ? 'ABSOLUTE_BLOCK' : 'BLOCK';
        const severity: CdsSeverity = isAbsoluteBlock
          ? 'CRITICAL'
          : allergy.severity === 'SEVERE'
          ? 'CRITICAL'
          : 'WARNING';

        alerts.push({
          alertId: crypto.randomUUID(),
          alertType: 'ALLERGY',
          severity,
          enforcement,
          canOverride: !isAbsoluteBlock,
          message: `Allergy alert: Patient has recorded ${allergy.reaction_type} reaction to ${allergy.allergen_name} (${allergy.allergen_code}). Severity: ${allergy.severity}.`,
          sourceId: allergy.id,
        });

        // Always publish event for allergy blocks
        if (isAbsoluteBlock) {
          await eventBus.publish({
            eventType: 'hos.cds.allergy.blocked.v1',
            tenantId: request.tenantId,
            aggregateId: request.encounterId,
            aggregateType: 'Encounter',
            payload: {
              encounterId: request.encounterId,
              patientId: request.patientId,
              proposedDrug: request.proposedDrugCode,
              allergenCode: allergy.allergen_code,
              allergenName: allergy.allergen_name,
              reactionType: allergy.reaction_type,
              severity: allergy.severity,
            },
            correlationId: request.correlationId,
            causationId: request.causationId,
          });
        }
      }

      const decision = this.deriveDecision(alerts);
      const hardBlocked = alerts.some((a) => a.enforcement === 'ABSOLUTE_BLOCK');

      const calcId = await this.writeCalculationRecord({
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientId: request.patientId,
        algorithmId: 'ALLERGY_CHECK',
        inputSnapshot: {
          proposedDrug: request.proposedDrugCode,
          proposedDrugClass: request.proposedDrugClass,
          patientAllergyCount: allergies.length,
        },
        output: { alerts },
        decision,
        enforcement: hardBlocked ? 'ABSOLUTE_BLOCK' : this.maxEnforcement(alerts),
        correlationId: request.correlationId,
        causationId: request.causationId,
      });

      return {
        success: true,
        data: {
          passed: decision === 'PASSED',
          hardBlocked,
          alerts,
          calculationId: calcId,
          knowledgeBaseVersion: KB_VERSION,
          policyVersion: POLICY_VERSION_DEFAULT,
          evaluatedAt: now,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ALLERGY_CHECK_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error in allergy check',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3. Protocol Adherence Check
  // --------------------------------------------------------------------------

  async checkProtocolAdherence(
    request: CheckProtocolAdherenceRequest
  ): Promise<EngineResponse<CdsCheckResult>> {
    try {
      const now = new Date().toISOString();
      const alerts: CdsAlert[] = [];

      // Fetch matching protocols for drug code or drug class
      const { data: protocolRows, error: protocolError } = await this.supabase
        .from('hc_clinical_protocols')
        .select('*')
        .eq('is_active', true)
        .or(
          `drug_code.eq.${request.proposedDrugCode}` +
            (request.proposedDrugClass
              ? `,drug_class.eq.${request.proposedDrugClass}`
              : '')
        )
        .returns<ClinicalProtocolRow[]>();

      if (protocolError) throw new Error(`Protocol query failed: ${protocolError.message}`);

      const protocols = protocolRows ?? [];
      const protocolIds = protocols.map((p) => p.id);
      const tenantPolicies = await this.fetchTenantCdsPolicies(
        request.tenantId,
        [],
        protocolIds
      );

      for (const protocol of protocols) {
        const conditionSpec = protocol.condition_spec;
        let triggered = false;
        let triggeredMessage = '';

        switch (protocol.contraindication_type) {
          case 'PEDIATRIC':
          case 'AGE': {
            const minAge = conditionSpec['min_age_years'];
            if (
              typeof minAge === 'number' &&
              request.patientAgeYears !== undefined &&
              request.patientAgeYears < minAge
            ) {
              triggered = true;
              triggeredMessage = `Patient age (${request.patientAgeYears}y) is below minimum required age (${minAge}y) for ${request.proposedDrugCode}.`;
            }
            const maxAge = conditionSpec['max_age_years'];
            if (
              typeof maxAge === 'number' &&
              request.patientAgeYears !== undefined &&
              request.patientAgeYears > maxAge
            ) {
              triggered = true;
              triggeredMessage = `Patient age (${request.patientAgeYears}y) exceeds maximum recommended age (${maxAge}y) for ${request.proposedDrugCode}.`;
            }
            break;
          }

          case 'WEIGHT': {
            const minWeight = conditionSpec['min_weight_kg'];
            if (
              typeof minWeight === 'number' &&
              request.patientWeightKg !== undefined &&
              request.patientWeightKg < minWeight
            ) {
              triggered = true;
              triggeredMessage = `Patient weight (${request.patientWeightKg}kg) is below minimum required weight (${minWeight}kg) for ${request.proposedDrugCode}.`;
            }
            break;
          }

          case 'RENAL': {
            const minEgfr = conditionSpec['min_egfr'];
            if (
              typeof minEgfr === 'number' &&
              request.patientEgfr !== undefined &&
              request.patientEgfr < minEgfr
            ) {
              triggered = true;
              triggeredMessage = `Patient eGFR (${request.patientEgfr} mL/min) is below minimum required (${minEgfr}) for ${request.proposedDrugCode}.`;
            }
            break;
          }

          case 'HEPATIC': {
            const contraClasses = conditionSpec['contraindicated_classes'];
            if (
              Array.isArray(contraClasses) &&
              request.patientHepaticClass !== undefined &&
              contraClasses.includes(request.patientHepaticClass)
            ) {
              triggered = true;
              triggeredMessage = `Patient hepatic class (${request.patientHepaticClass}) is contraindicated for ${request.proposedDrugCode}.`;
            }
            break;
          }

          case 'PREGNANCY': {
            if (request.patientPregnant === true) {
              triggered = true;
              triggeredMessage = `${request.proposedDrugCode} is contraindicated in pregnancy (${conditionSpec['note'] ?? 'Pregnancy contraindication'}).`;
            }
            break;
          }

          case 'DOSE_LIMIT': {
            const maxDose = conditionSpec['max_daily_dose_mg'];
            if (
              typeof maxDose === 'number' &&
              request.proposedDoseMg !== undefined &&
              request.proposedDoseMg > maxDose
            ) {
              triggered = true;
              triggeredMessage = `Proposed dose (${request.proposedDoseMg}mg/day) exceeds maximum daily dose (${maxDose}mg/day) for ${request.proposedDrugCode}.`;
            }
            break;
          }
        }

        if (!triggered) continue;

        const effectiveEnforcement = this.resolveEnforcement(
          protocol.enforcement,
          tenantPolicies.find((p) => p.protocol_id === protocol.id)?.override_enforcement
        );

        alerts.push({
          alertId: crypto.randomUUID(),
          alertType: 'PROTOCOL',
          severity: protocol.severity as CdsSeverity,
          enforcement: effectiveEnforcement,
          canOverride: effectiveEnforcement !== 'ABSOLUTE_BLOCK',
          message: triggeredMessage,
          managementGuidance: conditionSpec['note'] as string | undefined,
          sourceId: protocol.id,
        });

        if (effectiveEnforcement === 'BLOCK' || effectiveEnforcement === 'ABSOLUTE_BLOCK') {
          await eventBus.publish({
            eventType: 'hos.cds.protocol.violated.v1',
            tenantId: request.tenantId,
            aggregateId: request.encounterId,
            aggregateType: 'Encounter',
            payload: {
              encounterId: request.encounterId,
              patientId: request.patientId,
              proposedDrug: request.proposedDrugCode,
              protocolCode: protocol.protocol_code,
              contraindicationType: protocol.contraindication_type,
              severity: protocol.severity,
              enforcement: effectiveEnforcement,
            },
            correlationId: request.correlationId,
            causationId: request.causationId,
          });
        }
      }

      const decision = this.deriveDecision(alerts);
      const hardBlocked = alerts.some((a) => a.enforcement === 'ABSOLUTE_BLOCK');

      const calcId = await this.writeCalculationRecord({
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientId: request.patientId,
        algorithmId: 'PROTOCOL_ADHERENCE',
        inputSnapshot: {
          proposedDrug: request.proposedDrugCode,
          proposedDrugClass: request.proposedDrugClass,
          proposedDoseMg: request.proposedDoseMg,
          patientAgeYears: request.patientAgeYears,
          patientWeightKg: request.patientWeightKg,
          patientEgfr: request.patientEgfr,
          patientHepaticClass: request.patientHepaticClass,
          patientPregnant: request.patientPregnant,
        },
        output: { alerts },
        decision,
        enforcement: hardBlocked ? 'ABSOLUTE_BLOCK' : this.maxEnforcement(alerts),
        correlationId: request.correlationId,
        causationId: request.causationId,
      });

      return {
        success: true,
        data: {
          passed: decision === 'PASSED',
          hardBlocked,
          alerts,
          calculationId: calcId,
          knowledgeBaseVersion: KB_VERSION,
          policyVersion: POLICY_VERSION_DEFAULT,
          evaluatedAt: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'PROTOCOL_CHECK_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error in protocol check',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 4. Aggregate CDS Summary (called by Order Engine and Pharmacy Engine)
  // --------------------------------------------------------------------------

  async generateCdsSummary(
    request: GenerateCdsSummaryRequest
  ): Promise<EngineResponse<CdsCheckResult>> {
    return this.evaluate({
      tenantId: request.tenantId,
      encounterId: request.encounterId,
      patientId: request.patientId,
      actionContext: {
        proposedDrugCode: request.proposedDrugCode,
        proposedDrugClass: request.proposedDrugClass,
        proposedDoseMg: request.proposedDoseMg,
        patientAgeYears: request.patientAgeYears,
        patientWeightKg: request.patientWeightKg,
        patientEgfr: request.patientEgfr,
        patientHepaticClass: request.patientHepaticClass,
        patientPregnant: request.patientPregnant,
        currentMedicationCodes: request.currentMedicationCodes,
      },
    });
  }

  // --------------------------------------------------------------------------
  // 5. Allergy Management
  // --------------------------------------------------------------------------

  async recordAllergy(request: RecordAllergyRequest): Promise<EngineResponse<PatientAllergy>> {
    try {
      const now = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(),
        tenant_id: request.tenantId,
        encounter_id: request.encounterId,
        patient_id: request.patientId,
        allergen_type: request.allergenType,
        allergen_code: request.allergenCode,
        allergen_name: request.allergenName,
        reaction_type: request.reactionType,
        severity: request.severity,
        onset_date: request.onsetDate ?? null,
        recorded_by: request.recordedBy,
        is_active: true,
        created_at: now,
      };

      const { data, error } = await this.supabase
        .from('hc_patient_allergies')
        .insert(row)
        .select()
        .single<PatientAllergyRow>();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'ALLERGY_RECORD_FAILED',
            message: error?.message ?? 'Failed to record allergy',
            timestamp: now,
          },
        };
      }

      // Publish event for allergy recorded (Law 5)
      await eventBus.publish({
        eventType: 'hos.allergy.recorded.v1',
        tenantId: request.tenantId,
        aggregateId: data.id,
        aggregateType: 'Allergy',
        payload: {
          allergyId: data.id,
          encounterId: request.encounterId,
          patientId: request.patientId,
          allergenType: request.allergenType,
          allergenCode: request.allergenCode,
          allergenName: request.allergenName,
          reactionType: request.reactionType,
          severity: request.severity,
        },
        userId: request.recordedBy,
      });

      return {
        success: true,
        data: this.mapAllergyRow(data),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ALLERGY_RECORD_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getPatientAllergies(
    tenantId: string,
    patientId: string
  ): Promise<EngineResponse<PatientAllergy[]>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_patient_allergies')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .returns<PatientAllergyRow[]>();

      if (error) {
        return {
          success: false,
          error: {
            code: 'ALLERGY_QUERY_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: (data ?? []).map(this.mapAllergyRow),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ALLERGY_QUERY_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // Health Check
  // --------------------------------------------------------------------------

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_drugs')
        .select('drug_code')
        .limit(1);

      return {
        status: error ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: { database: error ? 'error' : 'ok' },
        message: error ? 'Global KB unreachable' : undefined,
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: { database: 'error' },
        message: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  /**
   * Resolve effective enforcement using the following priority:
   *   1. If global enforcement = ABSOLUTE_BLOCK → always ABSOLUTE_BLOCK (cannot override)
   *   2. If tenant policy override exists → use tenant override
   *   3. Otherwise use global enforcement
   */
  private resolveEnforcement(
    globalEnforcement: string,
    tenantOverride: string | undefined
  ): CdsEnforcement {
    // Invariant: ABSOLUTE_BLOCK cannot be downgraded by any tenant
    if (globalEnforcement === 'ABSOLUTE_BLOCK') return 'ABSOLUTE_BLOCK';
    if (tenantOverride) return tenantOverride as CdsEnforcement;
    return globalEnforcement as CdsEnforcement;
  }

  private resolvePolicyVersion(
    tenantPolicies: TenantCdsPolicyRow[],
    interactionId: string | null,
    protocolId: string | null
  ): string {
    const policy = tenantPolicies.find(
      (p) =>
        (interactionId && p.interaction_id === interactionId) ||
        (protocolId && p.protocol_id === protocolId)
    );
    return policy?.policy_version ?? POLICY_VERSION_DEFAULT;
  }

  private async fetchTenantCdsPolicies(
    tenantId: string,
    interactionIds: string[],
    protocolIds: string[]
  ): Promise<TenantCdsPolicyRow[]> {
    if (interactionIds.length === 0 && protocolIds.length === 0) return [];

    const conditions: string[] = [];
    if (interactionIds.length > 0) {
      conditions.push(`interaction_id.in.(${interactionIds.join(',')})`);
    }
    if (protocolIds.length > 0) {
      conditions.push(`protocol_id.in.(${protocolIds.join(',')})`);
    }

    const { data } = await this.supabase
      .from('hc_tenant_cds_policies')
      .select('id,interaction_id,protocol_id,override_enforcement,policy_version')
      .eq('tenant_id', tenantId)
      .or(conditions.join(','))
      .lte('effective_from', new Date().toISOString())
      .or('effective_to.is.null,effective_to.gt.' + new Date().toISOString())
      .returns<TenantCdsPolicyRow[]>();

    return data ?? [];
  }

  private deriveDecision(
    alerts: CdsAlert[]
  ): 'PASSED' | 'WARNED' | 'BLOCKED' | 'ABSOLUTE_BLOCKED' {
    if (alerts.some((a) => a.enforcement === 'ABSOLUTE_BLOCK')) return 'ABSOLUTE_BLOCKED';
    if (alerts.some((a) => a.enforcement === 'BLOCK')) return 'BLOCKED';
    if (alerts.some((a) => a.enforcement === 'ACKNOWLEDGE')) return 'WARNED';
    return 'PASSED';
  }

  private maxEnforcement(alerts: CdsAlert[]): string {
    const priority: CdsEnforcement[] = ['ABSOLUTE_BLOCK', 'BLOCK', 'ACKNOWLEDGE', 'INFORMATIONAL'];
    for (const e of priority) {
      if (alerts.some((a) => a.enforcement === e)) return e;
    }
    return 'INFORMATIONAL';
  }

  private async writeCalculationRecord(params: {
    id?: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
    algorithmId: string;
    inputSnapshot: Record<string, unknown>;
    output: Record<string, unknown>;
    decision: string;
    enforcement: string;
    correlationId?: string;
    causationId?: string;
    sourceObservationReferences?: Array<Record<string, string>>;
  }): Promise<string> {
    const id = params.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await this.supabase.from('hc_clinical_calculations').insert({
      id,
      tenant_id: params.tenantId,
      algorithm_id: params.algorithmId,
      input_data: params.inputSnapshot,
      output_data: params.output,
      created_at: now,
    });

    if (error) {
      console.error('[CdsEngineService] writeCalculationRecord failed:', error);
      throw new Error(`Failed to write clinical calculation record: ${error.message}`);
    }

    return id;
  }

  private mapAllergyRow(row: PatientAllergyRow): PatientAllergy {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      allergenType: row.allergen_type as PatientAllergy['allergenType'],
      allergenCode: row.allergen_code,
      allergenName: row.allergen_name,
      reactionType: row.reaction_type as PatientAllergy['reactionType'],
      severity: row.severity as PatientAllergy['severity'],
      onsetDate: row.onset_date ?? undefined,
      recordedBy: row.recorded_by,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }
}

