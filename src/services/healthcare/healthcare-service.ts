/**
 * BELLA HEALTHCARE PLATFORM — SERVER SERVICE ENGINE
 * 
 * Governance: Architecture Principles Rule #2 (Bounded Context) & Rule #4 (Accounting Ledger Boundary)
 * Zero Silent Failures: Re-throw errors for caller & test suites
 */

import { createClient } from '@/lib/supabase-server';
import type { PatientProfile, Encounter, ClinicalOrder, LabOrderItem, Prescription, PatientJourneyQueueItem } from '@/types/healthcare';
import { createHealthcareEvent, HEALTHCARE_EVENT_CATALOG } from '@/lib/events/healthcare-events';

/**
 * Get or Create Patient Profile (1-1 Extension of `customers`)
 */
export async function getOrCreatePatientProfile(input: {
  tenantId: string;
  customerId: string;
  bloodType?: PatientProfile['blood_type'];
  bhytCode?: string;
  knownAllergies?: string[];
  medicalHistory?: string[];
}): Promise<{ success: boolean; data?: PatientProfile; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Check existing
    const { data: existing, error: selectErr } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('customer_id', input.customerId)
      .maybeSingle();

    if (selectErr) {
      console.error('Error fetching patient profile: %s', selectErr.message);
      throw selectErr;
    }

    if (existing) {
      return { success: true, data: existing as PatientProfile };
    }

    // 2. Insert new profile
    const newProfile = {
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      blood_type: input.bloodType || 'UNKNOWN',
      bhyt_code: input.bhytCode || null,
      known_allergies: input.knownAllergies || [],
      medical_history: input.medicalHistory || [],
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('patient_profiles')
      .insert([newProfile])
      .select('*')
      .single();

    if (insertErr) {
      console.error('Error creating patient profile: %s', insertErr.message);
      throw insertErr;
    }

    return { success: true, data: inserted as PatientProfile };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get/create patient profile';
    return { success: false, error: message };
  }
}

/**
 * Start New Encounter (EMR Aggregate Root)
 */
export async function startEncounter(input: {
  tenantId: string;
  customerId: string;
  patientId: string;
  practitionerId: string;
  facilityId: string;
  chiefComplaint?: string;
  priority?: Encounter['priority'];
}): Promise<{ success: boolean; data?: Encounter; error?: string }> {
  try {
    const supabase = await createClient();

    const encounterPayload = {
      tenant_id: input.tenantId,
      patient_party_id: input.patientId,
      doctor_party_id: input.practitionerId,
      care_journey_id: input.facilityId, // Maps to care journey
      encounter_class: 'walk_in',
      status: 'in_progress',
      chief_complaint: input.chiefComplaint || null,
      started_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from('hc_encounters')
      .insert([encounterPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Error starting encounter: %s', error.message);
      throw error;
    }

    // Emit Domain Event
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.ENCOUNTER_STARTED,
      'v1',
      input.tenantId,
      'clinical',
      {
        encounterId: inserted.id,
        patientId: input.patientId,
        customerId: input.customerId,
        practitionerId: input.practitionerId,
        facilityId: input.facilityId,
        priority: input.priority || 'routine',
        startedAt: inserted.started_at,
      }
    );

    console.info('Healthcare Domain Event Emitted: %s', domainEvent.eventName);

    return { success: true, data: inserted as unknown as Encounter };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start encounter';
    return { success: false, error: message };
  }
}

/**
 * Issue Prescription for an Encounter
 */
export async function issuePrescription(input: {
  tenantId: string;
  encounterId: string;
  patientId: string;
  doctorId: string;
  drugs: Prescription['items'];
  diagnosis?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: Prescription; error?: string }> {
  try {
    const supabase = await createClient();

    const prescriptionPayload = {
      tenant_id: input.tenantId,
      encounter_id: input.encounterId,
      patient_party_id: input.patientId,
      doctor_party_id: input.doctorId,
      drugs: input.drugs as Prescription['items'],
      diagnosis: input.diagnosis || null,
      notes: input.notes || null,
    };

    const { data: inserted, error } = await supabase
      .from('hc_prescriptions')
      .insert([prescriptionPayload])
      .select('*')
      .single();

    if (error) {
      console.error('Error issuing prescription: %s', error.message);
      throw error;
    }

    // Emit Domain Event
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.PRESCRIPTION_ISSUED,
      'v1',
      input.tenantId,
      'pharmacy',
      {
        prescriptionId: inserted.id,
        encounterId: input.encounterId,
        patientId: input.patientId,
        doctorPractitionerId: input.doctorId,
        itemCount: input.drugs.length,
        issuedAt: new Date().toISOString(),
      }
    );

    console.info('Healthcare Domain Event Emitted: %s', domainEvent.eventName);

    return { success: true, data: inserted as unknown as Prescription };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to issue prescription';
    return { success: false, error: message };
  }
}

/**
 * Get Patient Journey Queue for a Tenant
 */
export async function getPatientJourneyQueue(
  tenantId: string
): Promise<{ success: boolean; data?: PatientJourneyQueueItem[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('hc_patient_queues')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching patient queues: %s', error.message);
      throw error;
    }

    return { success: true, data: (data || []) as PatientJourneyQueueItem[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch patient queues';
    return { success: false, error: message };
  }
}
