/**
 * ESI (Emergency Severity Index) Triage Protocol Implementation
 *
 * Implements standard 5-level ESI Triage Algorithm:
 * - ESI 1: Immediate (Life-saving intervention required) -> 0 min wait
 * - ESI 2: Emergent (High risk, confused/lethargic, severe pain/distress) -> < 10 min wait
 * - ESI 3: Urgent (Requires 2+ resources, stable vitals) -> < 30 min wait
 * - ESI 4: Less Urgent (Requires 1 resource) -> < 60 min wait
 * - ESI 5: Non-Urgent (Requires 0 resources) -> < 120 min wait
 *
 * @module platform/healthcare/engines/emergency-engine/domain/protocols
 */

import { ITriageProtocol, AcuityAssessmentInput, AcuityLevelResult } from './triage-protocol.interface';

export class EsiTriageProtocol implements ITriageProtocol {
  public readonly name = 'ESI_V4';

  public evaluate(input: AcuityAssessmentInput): AcuityLevelResult {
    // ESI Level 1: Immediate life-saving intervention needed
    if (input.requiresImmediateLifeSaving) {
      return {
        protocolName: this.name,
        acuityLevel: 1,
        acuityCategory: 'IMMEDIATE',
        targetTimeMinutes: 0,
        priorityScore: 100,
        explanation: 'ESI Level 1: Immediate life-saving intervention required.',
      };
    }

    // ESI Level 2: High risk situation, confused/lethargic/disoriented, or severe pain/distress
    const isVitalsDanger = this.checkDangerZoneVitals(input);
    if (input.isHighRiskSituation || input.isConfusedLethargicDisoriented || input.isInSeverePainOrDistress || isVitalsDanger) {
      return {
        protocolName: this.name,
        acuityLevel: 2,
        acuityCategory: 'EMERGENT',
        targetTimeMinutes: 10,
        priorityScore: 80,
        explanation: isVitalsDanger
          ? 'ESI Level 2: Unstable vital signs detected in danger zone.'
          : 'ESI Level 2: High risk, confusion, or severe distress.',
      };
    }

    // ESI Level 3, 4, 5 based on expected resource count
    const resourceCount = input.expectedResourceCount ?? 0;

    if (resourceCount >= 2) {
      return {
        protocolName: this.name,
        acuityLevel: 3,
        acuityCategory: 'URGENT',
        targetTimeMinutes: 30,
        priorityScore: 60,
        explanation: `ESI Level 3: Requires ${resourceCount} resources, vitals stable.`,
      };
    }

    if (resourceCount === 1) {
      return {
        protocolName: this.name,
        acuityLevel: 4,
        acuityCategory: 'LESS_URGENT',
        targetTimeMinutes: 60,
        priorityScore: 40,
        explanation: 'ESI Level 4: Requires 1 resource.',
      };
    }

    return {
      protocolName: this.name,
      acuityLevel: 5,
      acuityCategory: 'NON_URGENT',
      targetTimeMinutes: 120,
      priorityScore: 20,
      explanation: 'ESI Level 5: Requires 0 resources.',
    };
  }

  private checkDangerZoneVitals(input: AcuityAssessmentInput): boolean {
    if (!input.vitalSigns) return false;
    const { heartRate, respiratoryRate, oxygenSaturation, glasgowComaScale } = input.vitalSigns;

    if (oxygenSaturation !== undefined && oxygenSaturation < 90) return true;
    if (glasgowComaScale !== undefined && glasgowComaScale < 13) return true;
    if (heartRate !== undefined && (heartRate > 130 || heartRate < 40)) return true;
    if (respiratoryRate !== undefined && (respiratoryRate > 30 || respiratoryRate < 8)) return true;

    return false;
  }
}
