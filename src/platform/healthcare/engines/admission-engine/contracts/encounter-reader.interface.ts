/**
 * Encounter Reader Interface for Admission Engine
 *
 * Decouples Admission Engine from Encounter Engine domain internals (ADR-011).
 *
 * @module platform/healthcare/engines/admission-engine/contracts
 */

export interface EncounterSummary {
  id: string;
  tenantId: string;
  patientPartyId: string;
  status: string;
  encounterClass: string;
}

export interface IEncounterReader {
  getEncounterSummary(tenantId: string, encounterId: string): Promise<EncounterSummary | null>;
}
