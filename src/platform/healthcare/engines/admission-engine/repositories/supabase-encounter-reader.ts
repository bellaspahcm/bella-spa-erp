/**
 * Supabase Encounter Reader for Admission Engine
 *
 * Implements IEncounterReader to fetch encounter status and tenant validation from DB.
 *
 * @module platform/healthcare/engines/admission-engine/repositories
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IEncounterReader, EncounterSummary } from '../contracts/encounter-reader.interface';

export class SupabaseEncounterReader implements IEncounterReader {
  constructor(private readonly supabase: SupabaseClient) {}

  async getEncounterSummary(tenantId: string, encounterId: string): Promise<EncounterSummary | null> {
    const { data, error } = await this.supabase
      .from('hc_encounters')
      .select('id, tenant_id, patient_party_id, status, encounter_class')
      .eq('tenant_id', tenantId)
      .eq('id', encounterId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      tenantId: data.tenant_id,
      patientPartyId: data.patient_party_id,
      status: data.status,
      encounterClass: data.encounter_class,
    };
  }
}
