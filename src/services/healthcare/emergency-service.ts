import { createBrowserClient } from '@/lib/supabase-browser-client';

// Get browser client for client-side calls
const getBrowserSupabase = () => {
  return createBrowserClient();
};

export interface EmergencyStats {
  totalPatients: number;
  waitingTriage: number;
  critical: number;
  triaging: number;
  treating: number;
  waitingBed: number;
  avgWaitTime: number; // minutes
}

export interface EmergencyPatient {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  gender: 'Nam' | 'Nữ';
  arrivalTime: string;
  triageLevel: 1 | 2 | 3 | 4 | 5; // ESI 1-5 (1=most critical)
  chiefComplaint: string;
  status: 'waiting_triage' | 'triaging' | 'waiting_treatment' | 'in_treatment' | 'waiting_bed' | 'admitted';
  assignedTo?: string;
  vitalSigns?: {
    temp: number;
    hr: number;
    bp: string;
    spo2: number;
  };
}

// Mock data for development
const MOCK_ER_PATIENTS: EmergencyPatient[] = [
  {
    id: 'er-001',
    patientId: 'pat-er-001',
    patientName: 'Nguyễn Văn A',
    age: 45,
    gender: 'Nam',
    arrivalTime: new Date(Date.now() - 30 * 60000).toISOString(),
    triageLevel: 2,
    chiefComplaint: 'Đau ngực dữ dội',
    status: 'in_treatment',
    assignedTo: 'BS. Trần Văn B',
    vitalSigns: { temp: 37.2, hr: 95, bp: '140/90', spo2: 96 }
  },
  {
    id: 'er-002',
    patientId: 'pat-er-002',
    patientName: 'Trần Thị C',
    age: 72,
    gender: 'Nữ',
    arrivalTime: new Date(Date.now() - 15 * 60000).toISOString(),
    triageLevel: 1,
    chiefComplaint: 'Ngừng thở, co giật',
    status: 'in_treatment',
    assignedTo: 'BS. Nguyễn Văn D',
    vitalSigns: { temp: 36.8, hr: 45, bp: '80/50', spo2: 88 }
  },
  {
    id: 'er-003',
    patientId: 'pat-er-003',
    patientName: 'Lê Văn E',
    age: 28,
    gender: 'Nam',
    arrivalTime: new Date(Date.now() - 45 * 60000).toISOString(),
    triageLevel: 3,
    chiefComplaint: 'Sốt cao, đau đầu',
    status: 'waiting_treatment',
    vitalSigns: { temp: 39.5, hr: 88, bp: '120/80', spo2: 98 }
  }
];

export class EmergencyService {
  /**
   * Get Emergency Room statistics
   */
  static async getERStats(tenantId: string): Promise<EmergencyStats> {
    // Return mock data immediately (database tables not ready yet)
    return {
      totalPatients: 24,
      waitingTriage: 8,
      critical: 2,
      triaging: 3,
      treating: 9,
      waitingBed: 2,
      avgWaitTime: 28
    };

    /* TODO: Enable database queries when tables are ready
    try {
      const supabase = getBrowserSupabase();
      const { data: patients, error } = await supabase
        .from('emergency_patients')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['waiting_triage', 'triaging', 'waiting_treatment', 'in_treatment', 'waiting_bed']);

      if (error) throw error;

      const patientList = patients && patients.length > 0 ? patients : MOCK_ER_PATIENTS;

      const stats: EmergencyStats = {
        totalPatients: patientList.length,
        waitingTriage: patientList.filter((p: EmergencyPatient) => p.status === 'waiting_triage').length,
        critical: patientList.filter((p: EmergencyPatient) => p.triageLevel <= 2).length,
        triaging: patientList.filter((p: EmergencyPatient) => p.status === 'triaging').length,
        treating: patientList.filter((p: EmergencyPatient) => p.status === 'in_treatment').length,
        waitingBed: patientList.filter((p: EmergencyPatient) => p.status === 'waiting_bed').length,
        avgWaitTime: 28
      };

      return stats;
    } catch (err) {
      console.error('Error fetching ER stats:', err);
      return {
        totalPatients: 24,
        waitingTriage: 8,
        critical: 2,
        triaging: 3,
        treating: 9,
        waitingBed: 2,
        avgWaitTime: 28
      };
    }
    */
  }

  /**
   * Get all emergency patients
   */
  static async getEmergencyPatients(tenantId: string): Promise<EmergencyPatient[]> {
    try {
      const supabase = getBrowserSupabase();
      const { data, error } = await supabase
        .from('emergency_patients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('arrival_time', { ascending: true });

      if (error) throw error;
      return data || MOCK_ER_PATIENTS;
    } catch (err) {
      console.error('Error fetching emergency patients:', err);
      return MOCK_ER_PATIENTS;
    }
  }
}
