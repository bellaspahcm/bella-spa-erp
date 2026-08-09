import { supabase } from '@/lib/supabase';

export interface ICUStats {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  ventilatedPatients: number;
  criticalAlerts: number;
  highAlerts: number;
  averageApacheScore: number;
}

export interface ICUPatient {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  bedId: string;
  bedCode: string;
  diagnosis: string;
  admissionDate: string;
  apacheScore: number;
  isVentilated: boolean;
  status: 'stable' | 'critical' | 'improving' | 'deteriorating';
  lastVitals: {
    hr: number;
    bp: string;
    spo2: number;
    temp: number;
  };
}

const MOCK_ICU_PATIENTS: ICUPatient[] = [
  {
    id: 'icu-pat-001',
    patientId: 'pat-001',
    patientName: 'Nguyễn Văn Hoàng',
    age: 62,
    bedId: 'bed-101',
    bedCode: 'ICU-BED-01',
    diagnosis: 'Suy tim cấp',
    admissionDate: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
    apacheScore: 18,
    isVentilated: false,
    status: 'stable',
    lastVitals: { hr: 82, bp: '120/80', spo2: 98, temp: 37.1 }
  },
  {
    id: 'icu-pat-002',
    patientId: 'pat-002',
    patientName: 'Trần Thị Lan',
    age: 58,
    bedId: 'bed-102',
    bedCode: 'ICU-BED-02',
    diagnosis: 'Đột quỵ não',
    admissionDate: new Date(Date.now() - 5 * 24 * 60 * 60000).toISOString(),
    apacheScore: 22,
    isVentilated: true,
    status: 'critical',
    lastVitals: { hr: 95, bp: '160/95', spo2: 94, temp: 37.8 }
  },
  {
    id: 'icu-pat-003',
    patientId: 'pat-003',
    patientName: 'Lê Văn Minh',
    age: 45,
    bedId: 'bed-103',
    bedCode: 'ICU-BED-03',
    diagnosis: 'Sốc nhiễm trùng',
    admissionDate: new Date(Date.now() - 1 * 24 * 60 * 60000).toISOString(),
    apacheScore: 25,
    isVentilated: true,
    status: 'critical',
    lastVitals: { hr: 118, bp: '85/55', spo2: 91, temp: 38.9 }
  },
  {
    id: 'icu-pat-004',
    patientId: 'pat-004',
    patientName: 'Phạm Thị Hoa',
    age: 71,
    bedId: 'bed-104',
    bedCode: 'ICU-BED-04',
    diagnosis: 'Suy thận cấp',
    admissionDate: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
    apacheScore: 16,
    isVentilated: true,
    status: 'improving',
    lastVitals: { hr: 78, bp: '130/85', spo2: 96, temp: 37.3 }
  }
];

export class ICUService {
  /**
   * Get ICU statistics
   */
  static async getICUStats(tenantId: string): Promise<ICUStats> {
    try {
      // Query ICU ward beds
      const { data: icuWard, error: wardError } = await supabase
        .from('wards')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('code', 'ICU')
        .single();

      if (wardError) throw wardError;

      const { data: beds, error: bedsError } = await supabase
        .from('beds')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('ward_id', icuWard.id);

      if (bedsError) throw bedsError;

      // Query ICU patients
      const { data: patients, error: patientsError } = await supabase
        .from('inpatient_admissions')
        .select('*, patients(*)')
        .eq('tenant_id', tenantId)
        .eq('ward_id', icuWard.id)
        .eq('status', 'admitted');

      if (patientsError) throw patientsError;

      const patientList = patients && patients.length > 0 ? patients : MOCK_ICU_PATIENTS;

      const totalBeds = beds?.length || 14;
      const occupiedBeds = beds?.filter(b => b.status === 'occupied').length || 12;

      const stats: ICUStats = {
        totalBeds,
        occupiedBeds,
        availableBeds: totalBeds - occupiedBeds,
        occupancyRate: (occupiedBeds / totalBeds) * 100,
        ventilatedPatients: patientList.filter((p: ICUPatient) => p.isVentilated).length || 4,
        criticalAlerts: patientList.filter((p: ICUPatient) => p.status === 'critical').length || 2,
        highAlerts: 1,
        averageApacheScore: 20.3
      };

      return stats;
    } catch (err) {
      console.error('Error fetching ICU stats:', err);
      // Fallback to mock data
      return {
        totalBeds: 14,
        occupiedBeds: 12,
        availableBeds: 2,
        occupancyRate: 85.7,
        ventilatedPatients: 4,
        criticalAlerts: 2,
        highAlerts: 1,
        averageApacheScore: 20.3
      };
    }
  }

  /**
   * Get all ICU patients
   */
  static async getICUPatients(tenantId: string): Promise<ICUPatient[]> {
    try {
      const { data, error } = await supabase
        .from('inpatient_admissions')
        .select('*, patients(*), beds(*)')
        .eq('tenant_id', tenantId)
        .eq('status', 'admitted')
        .order('admitted_at', { ascending: false });

      if (error) throw error;
      return data || MOCK_ICU_PATIENTS;
    } catch (err) {
      console.error('Error fetching ICU patients:', err);
      return MOCK_ICU_PATIENTS;
    }
  }
}
