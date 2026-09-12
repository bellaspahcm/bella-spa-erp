/**
 * Party Repository - Database Access Layer
 * 
 * Responsibilities:
 * - CRUD operations on party_parties table
 * - Tenant isolation enforcement
 * - Party type validation
 * 
 * R3: Created for Education Identity Cutover
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface Party {
  id: string;
  tenant_id: string;
  party_type: 'person' | 'organization' | 'system';
  party_subtype?: string | null;
  display_name: string;
  full_legal_name?: string | null;
  short_name?: string | null;
  tax_id?: string | null;
  registration_number?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export class PartyRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find party by ID (with tenant isolation)
   */
  async findById(partyId: string, tenantId: string): Promise<Party | null> {
    const { data, error } = await this.supabase
      .from('party_parties')
      .select('*')
      .eq('id', partyId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find party: ${error.message}`);
    }

    return data as Party;
  }

  /**
   * Find parties by type (with tenant isolation)
   */
  async findByType(partyType: 'person' | 'organization' | 'system', tenantId: string): Promise<Party[]> {
    const { data, error } = await this.supabase
      .from('party_parties')
      .select('*')
      .eq('party_type', partyType)
      .eq('tenant_id', tenantId)
      .order('display_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to find parties by type: ${error.message}`);
    }

    return (data as Party[]) || [];
  }

  /**
   * Validate party exists and is of correct type
   */
  async validatePartyType(
    partyId: string,
    tenantId: string,
    expectedType: 'person' | 'organization' | 'system'
  ): Promise<{ valid: boolean; party?: Party; error?: string }> {
    const party = await this.findById(partyId, tenantId);

    if (!party) {
      return { valid: false, error: `Party with ID ${partyId} does not exist` };
    }

    if (party.party_type !== expectedType) {
      return {
        valid: false,
        party,
        error: `Party ${partyId} is not a ${expectedType} (type: ${party.party_type})`,
      };
    }

    return { valid: true, party };
  }
}
