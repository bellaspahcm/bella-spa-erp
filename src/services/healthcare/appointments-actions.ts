'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';

async function getTenantIdOrThrow(): Promise<string> {
  const user = await getCurrentUser();
  return user?.tenant_id || '88888888-8888-8888-8888-888888888888';
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  specialty: string;
  doctorName: string;
  date: string;
  slotTime: string;
  status: 'confirmed' | 'checked_in' | 'no_show' | 'cancelled' | 'completed';
  channel: 'online_website' | 'zalo_oa' | 'call_center' | 'walk_in';
  qrCode: string;
  reminderSent: boolean;
  notes?: string;
}

interface AppointmentRow {
  appointment_code: string;
  patient_name: string;
  patient_phone: string;
  specialty: string;
  doctor_name: string;
  appointment_date: string;
  slot_time: string;
  status: 'confirmed' | 'checked_in' | 'no_show' | 'cancelled' | 'completed';
  channel: 'online_website' | 'zalo_oa' | 'call_center' | 'walk_in';
  qr_code: string;
  reminder_sent: boolean;
  notes?: string | null;
}

export async function getAppointmentsAction(dateFilter?: string): Promise<{ success: boolean; data?: Appointment[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    let query = (supabase as any)
      .from('hc_appointments')
      .select('*')
      .eq('tenant_id', tenantId);

    if (dateFilter) {
      query = query.eq('appointment_date', dateFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching appointments:', error);
      return { success: false, error: error.message };
    }

    const mapped = ((data || []) as AppointmentRow[]).map((row) => ({
      id: row.appointment_code,
      patientName: row.patient_name,
      patientPhone: row.patient_phone,
      specialty: row.specialty,
      doctorName: row.doctor_name,
      date: new Date(row.appointment_date).toISOString().split('T')[0],
      slotTime: row.slot_time,
      status: row.status,
      channel: row.channel,
      qrCode: row.qr_code,
      reminderSent: row.reminder_sent,
      notes: row.notes || undefined,
    }));

    return { success: true, data: mapped };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Lỗi lấy danh sách lịch khám';
    return { success: false, error: errorMessage };
  }
}

export async function updateAppointmentStatusAction(
  appointmentCode: string,
  status: 'confirmed' | 'checked_in' | 'no_show' | 'cancelled' | 'completed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();
    const db = supabase as unknown as { from: (table: string) => unknown };

    const { error } = await db
      .from('hc_appointments')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('appointment_code', appointmentCode);

    if (error) {
      console.error('Error updating appointment status:', error);
      return { success: false, error: error.message };
    }

    // Automatically sync checked-in patients into clinical encounters queue
    if (status === 'checked_in') {
      const { data: appData } = await db
        .from('hc_appointments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('appointment_code', appointmentCode)
        .maybeSingle();

      if (appData) {
        let { data: party } = await db
          .from('party_parties')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('display_name', appData.patient_name)
          .maybeSingle();

        if (!party) {
          const { data: newParty } = await db
            .from('party_parties')
            .insert({
              tenant_id: tenantId,
              party_type: 'person',
              display_name: appData.patient_name,
            })
            .select()
            .single();
          party = newParty;
        }

        const partyId = party?.id;

        if (partyId) {
          const { data: journey } = await db
            .from('journey_journeys')
            .select('id')
            .eq('tenant_id', tenantId)
            .limit(1)
            .maybeSingle();
          const careJourneyId = journey ? journey.id : '99999999-9999-9999-9999-999999999999';

          const { data: enc } = await db
            .from('hc_encounters')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('patient_party_id', partyId)
            .maybeSingle();

          let encId = enc?.id;

          if (encId) {
            await db
              .from('hc_encounters')
              .update({
                status: 'arrived',
                arrived_at: new Date().toISOString(),
                chief_complaint: appData.notes || appData.specialty || 'Khám theo lịch hẹn',
                updated_at: new Date().toISOString(),
              })
              .eq('id', encId);
          } else {
            const { data: newEnc } = await db
              .from('hc_encounters')
              .insert({
                tenant_id: tenantId,
                care_journey_id: careJourneyId,
                patient_party_id: partyId,
                encounter_class: 'walk_in',
                status: 'arrived',
                arrived_at: new Date().toISOString(),
                chief_complaint: appData.notes || appData.specialty || 'Khám theo lịch hẹn',
              })
              .select()
              .single();
            encId = newEnc?.id;
          }

          if (encId) {
            const { data: qItem } = await db
              .from('hc_patient_queues')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('encounter_id', encId)
              .maybeSingle();

            if (!qItem) {
              await db.from('hc_patient_queues').insert({
                tenant_id: tenantId,
                encounter_id: encId,
                patient_name: appData.patient_name,
                ticket_number: appointmentCode,
                current_station: 'consultation',
                status: 'called',
              });
            } else {
              await db
                .from('hc_patient_queues')
                .update({
                  status: 'called',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', qItem.id);
            }
          }
        }
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái lịch khám';
    return { success: false, error: errorMessage };
  }
}

export async function createAppointmentAction(input: {
  patientName: string;
  patientPhone: string;
  specialty: string;
  doctorName: string;
  slotTime: string;
  appointmentDate?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: Appointment; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();
    const db = supabase as unknown as { from: (table: string) => unknown };

    const appointmentCode = `APP-${Math.floor(8800 + Math.random() * 200)}`;
    const qrCode = `QR-APP-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRow = {
      tenant_id: tenantId,
      appointment_code: appointmentCode,
      patient_name: input.patientName,
      patient_phone: input.patientPhone,
      specialty: input.specialty,
      doctor_name: input.doctorName,
      appointment_date: input.appointmentDate || new Date().toISOString().split('T')[0],
      slot_time: input.slotTime,
      status: 'confirmed',
      channel: 'online_website',
      qr_code: qrCode,
      reminder_sent: true,
      notes: input.notes || null,
    };

    const { data, error } = await db
      .from('hc_appointments')
      .insert(newRow)
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating appointment:', error);
      return { success: false, error: error?.message || 'Không thể tạo lịch khám' };
    }

    const created: Appointment = {
      id: data.appointment_code,
      patientName: data.patient_name,
      patientPhone: data.patient_phone,
      specialty: data.specialty,
      doctorName: data.doctor_name,
      date: new Date(data.appointment_date).toISOString().split('T')[0],
      slotTime: data.slot_time,
      status: data.status,
      channel: data.channel,
      qrCode: data.qr_code,
      reminderSent: data.reminder_sent,
      notes: data.notes || undefined,
    };

    return { success: true, data: created };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Lỗi thêm mới lịch khám';
    return { success: false, error: errorMessage };
  }
}

export async function sendAppointmentReminderAction(
  appointmentCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();
    const db = supabase as unknown as { from: (table: string) => unknown };

    const { error } = await db
      .from('hc_appointments')
      .update({
        reminder_sent: true,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('appointment_code', appointmentCode);

    if (error) {
      console.error('Error updating reminder status:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Lỗi gửi tin nhắn nhắc lịch';
    return { success: false, error: errorMessage };
  }
}
