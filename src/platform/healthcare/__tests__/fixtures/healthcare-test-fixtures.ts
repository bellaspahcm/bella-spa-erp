/**
 * Healthcare Test Fixtures
 * 
 * Centralized test data bootstrap for all healthcare integration tests.
 * Ensures consistent test environment across Order Engine, Pharmacy Engine, etc.
 * 
 * Usage:
 *   const fixtures = await HealthcareTestFixtures.setup();
 *   // Use fixtures.encounter, fixtures.patient, etc.
 *   await fixtures.cleanup();
 */

import { createClient } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';

export const HEALTHCARE_TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export interface HealthcareTestFixture {
  tenantId: string;
  patientId: string;
  patientPartyId: string;
  providerId: string;
  providerPartyId: string;
  journeyId: string;
  encounterId: string;
  encounterStatus: string;
  cleanup: () => Promise<void>;
}

export class HealthcareTestFixtures {
  private static supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  
  /**
   * Setup complete healthcare test fixture
   * 
   * Creates:
   * - Patient party
   * - Provider party
   * - Journey
   * - Active encounter
   * 
   * Returns fixture with cleanup function
   */
  static async setup(): Promise<HealthcareTestFixture> {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    
    const supabase = this.supabase;
    const tenantId = HEALTHCARE_TEST_TENANT_ID;
    
    // Generate IDs
    const patientPartyId = randomUUID();
    const providerPartyId = randomUUID();
    const journeyId = randomUUID();
    const encounterId = randomUUID();
    
    try {
      // 1. Create patient party
      const { error: patientError } = await supabase
        .from('party_parties')
        .insert({
          id: patientPartyId,
          tenant_id: tenantId,
          party_type: 'person',
          display_name: `Test Patient ${patientPartyId.slice(0, 8)}`,
        });
      
      if (patientError) {
        throw new Error(`Failed to create patient party: ${patientError.message}`);
      }
      
      // 2. Create provider party
      const { error: providerError } = await supabase
        .from('party_parties')
        .insert({
          id: providerPartyId,
          tenant_id: tenantId,
          party_type: 'person',
          display_name: `Dr. Test Provider ${providerPartyId.slice(0, 8)}`,
        });
      
      if (providerError) {
        throw new Error(`Failed to create provider party: ${providerError.message}`);
      }
      
      // 3. Create journey
      const { error: journeyError } = await supabase
        .from('journey_journeys')
        .insert({
          id: journeyId,
          tenant_id: tenantId,
          primary_party_id: patientPartyId,
          journey_type: 'clinical_journey',
          vertical: 'healthcare',
          status: 'active',
        });
      
      if (journeyError) {
        throw new Error(`Failed to create journey: ${journeyError.message}`);
      }
      
      // 4. Create active encounter
      const { error: encounterError } = await supabase
        .from('hc_encounters')
        .insert({
          id: encounterId,
          tenant_id: tenantId,
          patient_party_id: patientPartyId,
          doctor_party_id: providerPartyId,
          care_journey_id: journeyId,
          encounter_class: 'AMB',  // HL7 canonical: Ambulatory (outpatient)
          encounter_type: 'outpatient',  // Required NOT NULL field
          status: 'in-progress',  // ACTIVE for ordering (canonical HL7 with hyphen)
          scheduled_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          period_start: new Date().toISOString(),  // Required NOT NULL field
        });
      
      if (encounterError) {
        throw new Error(`Failed to create encounter: ${encounterError.message}`);
      }
      
      // Return fixture
      return {
        tenantId,
        patientId: patientPartyId,
        patientPartyId,
        providerId: providerPartyId,
        providerPartyId,
        journeyId,
        encounterId,
        encounterStatus: 'in_progress',
        cleanup: async () => {
          // Cleanup in reverse order (FK constraints)
          await supabase.from('hc_encounters').delete().eq('id', encounterId);
          await supabase.from('journey_journeys').delete().eq('id', journeyId);
          await supabase.from('party_parties').delete().eq('id', providerPartyId);
          await supabase.from('party_parties').delete().eq('id', patientPartyId);
        },
      };
    } catch (error) {
      // Cleanup on failure
      await supabase.from('hc_encounters').delete().eq('id', encounterId);
      await supabase.from('journey_journeys').delete().eq('id', journeyId);
      await supabase.from('party_parties').delete().eq('id', providerPartyId);
      await supabase.from('party_parties').delete().eq('id', patientPartyId);
      
      throw error;
    }
  }
  
  /**
   * Setup fixture and return encounter in FINISHED state
   * For testing "cannot create order on finished encounter"
   */
  static async setupFinishedEncounter(): Promise<HealthcareTestFixture> {
    const fixture = await this.setup();
    
    // Update encounter to finished
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    
    await this.supabase
      .from('hc_encounters')
      .update({
        status: 'finished',
        finished_at: new Date().toISOString(),
      })
      .eq('id', fixture.encounterId);
    
    return {
      ...fixture,
      encounterStatus: 'finished',
    };
  }
  
  /**
   * Setup fixture and return encounter in CANCELLED state
   * For testing "cannot create order on cancelled encounter"
   */
  static async setupCancelledEncounter(): Promise<HealthcareTestFixture> {
    const fixture = await this.setup();
    
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    
    await this.supabase
      .from('hc_encounters')
      .update({
        status: 'cancelled',
      })
      .eq('id', fixture.encounterId);
    
    return {
      ...fixture,
      encounterStatus: 'cancelled',
    };
  }
}
