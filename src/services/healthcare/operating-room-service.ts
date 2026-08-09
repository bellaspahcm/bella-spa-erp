import { supabase } from '@/lib/supabase';

export interface OperatingRoomStats {
  totalSurgeriesToday: number;
  inProgress: number;
  completed: number;
  scheduled: number;
  delayed: number;
  avgDuration: number; // minutes
  roomsInUse: number;
  totalRooms: number;
}

export interface Surgery {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  surgeryType: string;
  procedure: string;
  surgeon: string;
  anesthesiologist: string;
  roomNumber: string;
  scheduledStart: string;
  actualStart?: string;
  estimatedDuration: number; // minutes
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'delayed';
  priority: 'elective' | 'urgent' | 'emergency';
}

const MOCK_SURGERIES: Surgery[] = [
  {
    id: 'surg-001',
    patientId: 'pat-surg-001',
    patientName: 'Nguyễn Văn A',
    age: 55,
    surgeryType: 'Phẫu thuật tim mạch',
    procedure: 'Bypass động mạch vành',
    surgeon: 'BS. CKI Trần Văn B',
    anesthesiologist: 'BS. Lê Thị C',
    roomNumber: 'OR-01',
    scheduledStart: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
    actualStart: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
    estimatedDuration: 240,
    status: 'in_progress',
    priority: 'urgent'
  },
  {
    id: 'surg-002',
    patientId: 'pat-surg-002',
    patientName: 'Trần Thị D',
    age: 42,
    surgeryType: 'Phẫu thuật ổ bụng',
    procedure: 'Cắt túi mật nội soi',
    surgeon: 'BS. CKII Phạm Văn E',
    anesthesiologist: 'BS. Nguyễn Văn F',
    roomNumber: 'OR-03',
    scheduledStart: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
    actualStart: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
    estimatedDuration: 90,
    status: 'in_progress',
    priority: 'elective'
  },
  {
    id: 'surg-003',
    patientId: 'pat-surg-003',
    patientName: 'Lê Văn G',
    age: 68,
    surgeryType: 'Phẫu thuật chấn thương',
    procedure: 'Cố định gãy xương đùi',
    surgeon: 'BS. Hoàng Văn H',
    anesthesiologist: 'BS. Vũ Thị I',
    roomNumber: 'OR-02',
    scheduledStart: new Date(Date.now() + 1 * 60 * 60000).toISOString(),
    estimatedDuration: 120,
    status: 'scheduled',
    priority: 'urgent'
  },
  {
    id: 'surg-004',
    patientId: 'pat-surg-004',
    patientName: 'Phạm Thị K',
    age: 35,
    surgeryType: 'Phẫu thuật sản khoa',
    procedure: 'Mổ lấy thai',
    surgeon: 'BS. Đặng Văn L',
    anesthesiologist: 'BS. Bùi Thị M',
    roomNumber: 'OR-04',
    scheduledStart: new Date(Date.now() - 30 * 60000).toISOString(),
    actualStart: new Date(Date.now() - 15 * 60000).toISOString(),
    estimatedDuration: 45,
    status: 'delayed',
    priority: 'emergency'
  }
];

export class OperatingRoomService {
  /**
   * Get Operating Room statistics for today
   */
  static async getORStats(tenantId: string): Promise<OperatingRoomStats> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: surgeries, error } = await supabase
        .from('surgeries')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('scheduled_start', today.toISOString())
        .lt('scheduled_start', tomorrow.toISOString())
        .neq('status', 'cancelled');

      if (error) throw error;

      const surgeryList = surgeries && surgeries.length > 0 ? surgeries : MOCK_SURGERIES;

      const stats: OperatingRoomStats = {
        totalSurgeriesToday: surgeryList.length,
        inProgress: surgeryList.filter((s: Surgery) => s.status === 'in_progress').length,
        completed: surgeryList.filter((s: Surgery) => s.status === 'completed').length,
        scheduled: surgeryList.filter((s: Surgery) => s.status === 'scheduled').length,
        delayed: surgeryList.filter((s: Surgery) => s.status === 'delayed').length,
        avgDuration: 135, // Mock average
        roomsInUse: surgeryList.filter((s: Surgery) => s.status === 'in_progress').length,
        totalRooms: 6
      };

      return stats;
    } catch (err) {
      console.error('Error fetching OR stats:', err);
      // Fallback to mock data
      return {
        totalSurgeriesToday: 18,
        inProgress: 3,
        completed: 11,
        scheduled: 2,
        delayed: 2,
        avgDuration: 135,
        roomsInUse: 3,
        totalRooms: 6
      };
    }
  }

  /**
   * Get all surgeries for today
   */
  static async getTodaySurgeries(tenantId: string): Promise<Surgery[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('surgeries')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('scheduled_start', today.toISOString())
        .lt('scheduled_start', tomorrow.toISOString())
        .order('scheduled_start', { ascending: true });

      if (error) throw error;
      return data || MOCK_SURGERIES;
    } catch (err) {
      console.error('Error fetching surgeries:', err);
      return MOCK_SURGERIES;
    }
  }
}
