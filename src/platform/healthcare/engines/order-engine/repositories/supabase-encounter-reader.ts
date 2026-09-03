import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EncounterReader,
  EncounterSnapshot,
} from '../contracts/encounter-reader.interface';
import { EncounterNotFoundError } from '../contracts/encounter-reader.interface';
import type { Database } from '@/types/database.types';

type EncounterRow = Database['public']['Tables']['hc_encounters']['Row'];

export class SupabaseEncounterReader implements EncounterReader {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getEncounterSnapshot(tenantId: string, encounterId: string): Promise<EncounterSnapshot> {
    const { data, error } = await this.supabase
      .from('hc_encounters')
      .select('id, patient_party_id, status, encounter_class, started_at, finished_at')
      .eq('tenant_id', tenantId)
      .eq('id', encounterId)
      .single<EncounterRow>();

    if (error || !data) {
      throw new EncounterNotFoundError(encounterId, tenantId);
    }

    return {
      encounterId: data.id,
      patientPartyId: data.patient_party_id,
      status: this.mapEncounterStatus(data.status),
      encounterType: data.encounter_class || 'scheduled',
      admittedAt: data.started_at ? new Date(data.started_at) : new Date(),
      dischargedAt: data.finished_at ? new Date(data.finished_at) : null,
    };
  }

  async canCreateOrders(tenantId: string, encounterId: string): Promise<boolean> {
    try {
      const snapshot = await this.getEncounterSnapshot(tenantId, encounterId);
      // Only IN_PROGRESS encounters allow new orders
      return snapshot.status === 'IN_PROGRESS';
    } catch (error) {
      // Encounter not found or other errors → cannot create orders
      return false;
    }
  }

  private mapEncounterStatus(dbStatus: string): EncounterSnapshot['status'] {
    // Map database status to domain status
    // DB: 'planned', 'arrived', 'triaged', 'in-progress', 'on-hold', 'finished', 'cancelled'
    switch (dbStatus) {
      case 'planned':
      case 'arrived':
        return 'REGISTERED';
      case 'triaged':
      case 'in-progress':
      case 'on-hold':
        return 'IN_PROGRESS';
      case 'finished':
        return 'FINISHED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'REGISTERED';
    }
  }
}
