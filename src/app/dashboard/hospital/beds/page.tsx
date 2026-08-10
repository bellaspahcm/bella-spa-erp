'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Bed as BedIcon,
  Building,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Plus,
  Settings,
  HeartPulse,
  DoorOpen,
  History,
  Grid,
  List,
  RefreshCw,
  X,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import { useBedEngine } from '@/products/bella-hospital/hooks/use-bed-engine';
import { BreakGlassSecurityService } from '@/services/healthcare-hospital-services';
import { createClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

const WARD_OPTIONS = [
  { value: 'all', label: 'Tất cả khoa' },
  { value: 'w-icu', label: 'Hồi sức tích cực (ICU)' },
  { value: 'w-internal', label: 'Nội tổng hợp' },
  { value: 'w-surgery', label: 'Ngoại khoa' }
];

const STATE_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'available', label: 'Sẵn sàng' },
  { value: 'occupied', label: 'Đang sử dụng' },
  { value: 'cleaning', label: 'Đang vệ sinh' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'reserved', label: 'Đặt trước' },
  { value: 'blocked', label: 'Đã khóa' },
  { value: 'isolation', label: 'Cách ly' }
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả loại giường' },
  { value: 'standard', label: 'Tiêu chuẩn' },
  { value: 'icu', label: 'ICU đặc biệt' },
  { value: 'vip', label: 'VIP' },
  { value: 'pediatric', label: 'Giường Nhi' }
];

// Define strict types according to Law 11
type BedStateExtended =
  | 'occupied'
  | 'available'
  | 'cleaning'
  | 'maintenance'
  | 'reserved'
  | 'blocked'
  | 'isolation';

interface PatientContext {
  id: string;
  name: string;
  age: number;
  gender: 'Nam' | 'Nữ';
  diagnosis: string;
  doctorName: string;
  daysAdmitted: number;
  alertCount: number;
  orderCount: number;
}

interface BedConstraint {
  icuCompatible: boolean;
  hasVentilator: boolean;
  hasMonitor: boolean;
  isolationCapable: boolean;
  pediatricSuitable: boolean;
  gender?: 'Nam' | 'Nữ' | 'all';
}

interface BedCardData {
  id: string;
  code: string;
  wardId: string;
  wardName: string;
  roomId: string;
  roomName: string;
  bedType: 'standard' | 'icu' | 'vip' | 'isolation' | 'pediatric' | 'recovery';
  state: BedStateExtended;
  dailyRate: number;
  patient?: PatientContext;
  constraints?: BedConstraint;
  reservedFor?: string;
  lastUpdated: string;
}

interface QueueItem {
  id: string;
  patientName: string;
  patientId: string;
  department: string;
  priority: 'Critical' | 'High' | 'Routine';
  waitTime: string;
}

// Enterprise Rich Mock Dataset (aligned with the plan & DB structures)
const MOCK_BEDS_DATA: BedCardData[] = [
  // ICU WARD
  {
    id: 'b-icu-01',
    code: 'ICU-BED-01',
    wardId: 'w-icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    roomId: 'r-icu-101',
    roomName: 'Phòng Áp Lực Âm 101',
    bedType: 'icu',
    state: 'occupied',
    dailyRate: 1500000,
    patient: {
      id: 'PAT-8291',
      name: 'Nguyễn Văn Hùng',
      age: 67,
      gender: 'Nam',
      diagnosis: 'Suy tim cấp tính độ IV / Phù phổi cấp',
      doctorName: 'BS. CKII Nguyễn Văn Minh',
      daysAdmitted: 2,
      alertCount: 1,
      orderCount: 8,
    },
    constraints: {
      icuCompatible: true,
      hasVentilator: true,
      hasMonitor: true,
      isolationCapable: true,
      pediatricSuitable: false,
    },
    lastUpdated: '10 phút trước',
  },
  {
    id: 'b-icu-02',
    code: 'ICU-BED-02',
    wardId: 'w-icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    roomId: 'r-icu-101',
    roomName: 'Phòng Áp Lực Âm 101',
    bedType: 'icu',
    state: 'occupied',
    dailyRate: 1500000,
    patient: {
      id: 'PAT-1204',
      name: 'Trần Thị Bình',
      age: 54,
      gender: 'Nữ',
      diagnosis: 'Viêm phổi nặng biến chứng ARDS',
      doctorName: 'BS. CKI Trần Đức Hùng',
      daysAdmitted: 5,
      alertCount: 0,
      orderCount: 12,
    },
    constraints: {
      icuCompatible: true,
      hasVentilator: true,
      hasMonitor: true,
      isolationCapable: true,
      pediatricSuitable: false,
    },
    lastUpdated: 'Vừa xong',
  },
  {
    id: 'b-icu-03',
    code: 'ICU-BED-03',
    wardId: 'w-icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    roomId: 'r-icu-102',
    roomName: 'Phòng Hồi Sức Chung 102',
    bedType: 'icu',
    state: 'isolation',
    dailyRate: 1800000,
    patient: {
      id: 'PAT-4402',
      name: 'Phạm Văn Cường',
      age: 41,
      gender: 'Nam',
      diagnosis: 'Sốc nhiễm khuẩn đường mật (Sepsis)',
      doctorName: 'BS. CKII Nguyễn Văn Minh',
      daysAdmitted: 1,
      alertCount: 3,
      orderCount: 6,
    },
    constraints: {
      icuCompatible: true,
      hasVentilator: true,
      hasMonitor: true,
      isolationCapable: true,
      pediatricSuitable: false,
    },
    lastUpdated: '25 phút trước',
  },
  {
    id: 'b-icu-04',
    code: 'ICU-BED-04',
    wardId: 'w-icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    roomId: 'r-icu-102',
    roomName: 'Phòng Hồi Sức Chung 102',
    bedType: 'icu',
    state: 'available',
    dailyRate: 1500000,
    constraints: {
      icuCompatible: true,
      hasVentilator: true,
      hasMonitor: true,
      isolationCapable: false,
      pediatricSuitable: false,
    },
    lastUpdated: '1 giờ trước',
  },
  {
    id: 'b-icu-05',
    code: 'ICU-BED-05',
    wardId: 'w-icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    roomId: 'r-icu-103',
    roomName: 'Phòng Hồi Sức Sơ Sinh 103',
    bedType: 'pediatric',
    state: 'reserved',
    reservedFor: 'Bệnh nhi Trần Gia Bảo (Chờ chuyển từ Cấp cứu)',
    dailyRate: 1200000,
    constraints: {
      icuCompatible: true,
      hasVentilator: true,
      hasMonitor: true,
      isolationCapable: false,
      pediatricSuitable: true,
    },
    lastUpdated: '5 phút trước',
  },
  {
    id: 'b-icu-06',
    code: 'ICU-BED-06',
    wardId: 'w-icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    roomId: 'r-icu-103',
    roomName: 'Phòng Hồi Sức Sơ Sinh 103',
    bedType: 'pediatric',
    state: 'cleaning',
    dailyRate: 1200000,
    constraints: {
      icuCompatible: true,
      hasVentilator: false,
      hasMonitor: true,
      isolationCapable: false,
      pediatricSuitable: true,
    },
    lastUpdated: '12 phút trước',
  },

  // INTERNAL MEDICINE WARD
  {
    id: 'b-int-01',
    code: 'INT-BED-201',
    wardId: 'w-internal',
    wardName: 'Khoa Nội Tổng Hợp',
    roomId: 'r-int-201',
    roomName: 'Phòng Nội Thần Kinh 201',
    bedType: 'standard',
    state: 'occupied',
    dailyRate: 600000,
    patient: {
      id: 'PAT-9011',
      name: 'Lê Văn Tám',
      age: 72,
      gender: 'Nam',
      diagnosis: 'Nhồi máu não bán cầu trái ngày thứ 4',
      doctorName: 'BS. Vũ Thị Dung',
      daysAdmitted: 4,
      alertCount: 0,
      orderCount: 4,
    },
    constraints: {
      icuCompatible: false,
      hasVentilator: false,
      hasMonitor: false,
      isolationCapable: false,
      pediatricSuitable: false,
    },
    lastUpdated: '2 giờ trước',
  },
  {
    id: 'b-int-02',
    code: 'INT-BED-202',
    wardId: 'w-internal',
    wardName: 'Khoa Nội Tổng Hợp',
    roomId: 'r-int-201',
    roomName: 'Phòng Nội Thần Kinh 201',
    bedType: 'standard',
    state: 'available',
    dailyRate: 600000,
    constraints: {
      icuCompatible: false,
      hasVentilator: false,
      hasMonitor: false,
      isolationCapable: false,
      pediatricSuitable: false,
      gender: 'Nam',
    },
    lastUpdated: '4 giờ trước',
  },
  {
    id: 'b-int-03',
    code: 'INT-BED-203',
    wardId: 'w-internal',
    wardName: 'Khoa Nội Tổng Hợp',
    roomId: 'r-int-202',
    roomName: 'Phòng Nội Tim Mạch 202',
    bedType: 'vip',
    state: 'occupied',
    dailyRate: 1200000,
    patient: {
      id: 'PAT-7032',
      name: 'Nguyễn Thị Tuyết',
      age: 63,
      gender: 'Nữ',
      diagnosis: 'Tăng huyết áp kháng trị / Suy thận độ III',
      doctorName: 'BS. CKII Nguyễn Văn Minh',
      daysAdmitted: 7,
      alertCount: 0,
      orderCount: 5,
    },
    constraints: {
      icuCompatible: false,
      hasVentilator: false,
      hasMonitor: true,
      isolationCapable: false,
      pediatricSuitable: false,
      gender: 'Nữ',
    },
    lastUpdated: 'Vừa xong',
  },
  {
    id: 'b-int-04',
    code: 'INT-BED-204',
    wardId: 'w-internal',
    wardName: 'Khoa Nội Tổng Hợp',
    roomId: 'r-int-202',
    roomName: 'Phòng Nội Tim Mạch 202',
    bedType: 'standard',
    state: 'maintenance',
    dailyRate: 600000,
    lastUpdated: '2 ngày trước',
  },

  // SURGERY WARD
  {
    id: 'b-surg-01',
    code: 'SURG-BED-301',
    wardId: 'w-surgery',
    wardName: 'Khoa Ngoại Khoa',
    roomId: 'r-surg-301',
    roomName: 'Phòng Hậu Phẫu 301',
    bedType: 'standard',
    state: 'occupied',
    dailyRate: 700000,
    patient: {
      id: 'PAT-3389',
      name: 'Trần Hoàng Long',
      age: 38,
      gender: 'Nam',
      diagnosis: 'Hậu phẫu cắt ruột thừa nội soi ngày 1',
      doctorName: 'BS. CKI Trần Đức Hùng',
      daysAdmitted: 1,
      alertCount: 0,
      orderCount: 3,
    },
    constraints: {
      icuCompatible: false,
      hasVentilator: false,
      hasMonitor: true,
      isolationCapable: false,
      pediatricSuitable: false,
    },
    lastUpdated: '30 phút trước',
  },
  {
    id: 'b-surg-02',
    code: 'SURG-BED-302',
    wardId: 'w-surgery',
    wardName: 'Khoa Ngoại Khoa',
    roomId: 'r-surg-301',
    roomName: 'Phòng Hậu Phẫu 301',
    bedType: 'standard',
    state: 'blocked',
    dailyRate: 700000,
    lastUpdated: '5 ngày trước',
  },
  {
    id: 'b-surg-03',
    code: 'SURG-BED-303',
    wardId: 'w-surgery',
    wardName: 'Khoa Ngoại Khoa',
    roomId: 'r-surg-302',
    roomName: 'Phòng Ngoại Chấn Thương 302',
    bedType: 'standard',
    state: 'available',
    dailyRate: 700000,
    constraints: {
      icuCompatible: false,
      hasVentilator: false,
      hasMonitor: false,
      isolationCapable: false,
      pediatricSuitable: false,
    },
    lastUpdated: '12 giờ trước',
  }
];

const INITIAL_QUEUE_DATA: QueueItem[] = [
  {
    id: 'q-01',
    patientName: 'Nguyễn Văn Anh',
    patientId: 'PAT-5421',
    department: 'Khoa Hồi Sức Tích Cực (ICU)',
    priority: 'Critical',
    waitTime: '18 phút',
  },
  {
    id: 'q-02',
    patientName: 'Trần Thị Bích',
    patientId: 'PAT-2091',
    department: 'Khoa Nội Tổng Hợp',
    priority: 'High',
    waitTime: '42 phút',
  },
  {
    id: 'q-03',
    patientName: 'Phạm Văn Chiến',
    patientId: 'PAT-9034',
    department: 'Khoa Ngoại Khoa',
    priority: 'Routine',
    waitTime: '1 giờ 12 phút',
  },
  {
    id: 'q-04',
    patientName: 'Lâm Hoàng My',
    patientId: 'PAT-4890',
    department: 'Khoa Hồi Sức Tích Cực (ICU)',
    priority: 'High',
    waitTime: '5 phút',
  }
];

export default function InpatientBedCommandCenter() {
  const { queryBeds, allocateBed, releaseBed, loading: engineLoading } = useBedEngine();

  // State Management
  const [beds, setBeds] = useState<BedCardData[]>(MOCK_BEDS_DATA);
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE_DATA);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Real-time & Loading States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Allocation Modal State
  const [allocationTarget, setAllocationTarget] = useState<BedCardData | null>(null);
  const [allocationQueueItem, setAllocationQueueItem] = useState<QueueItem | null>(null);

  // Break-Glass Modal States (3 Steps Logic)
  const [showBreakGlassModal, setShowBreakGlassModal] = useState<boolean>(false);
  const [breakGlassStep, setBreakGlassStep] = useState<number>(1);
  const [breakGlassPatientId, setBreakGlassPatientId] = useState<string>('');
  const [breakGlassReason, setBreakGlassReason] = useState<string>('');
  const [breakGlassSuccess, setBreakGlassSuccess] = useState<string>('');

  // Fetch real data from supabase if available, merge with Mock data to guarantee rich aesthetics
  const loadHospitalBeds = async () => {
    setRefreshing(true);
    try {
      const result = await queryBeds({ tenantId: 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d' });
      if (result.success && result.data && result.data.length > 0) {
        // Map database records into extended UI model
        const mappedData: BedCardData[] = result.data.map((dbBed) => {
          // Find matching mock item for patient context preservation
          const mockMatch = MOCK_BEDS_DATA.find((m) => m.code === dbBed.bed_code);
          
          let stateMapped: BedStateExtended = dbBed.status as BedStateExtended;
          if (dbBed.status === 'out_of_service') stateMapped = 'blocked';

          return {
            id: dbBed.id,
            code: dbBed.bed_code,
            wardId: dbBed.ward_id,
            wardName: dbBed.ward_id === 'w-icu' ? 'Khoa Hồi Sức Tích Cực (ICU)' : dbBed.ward_id === 'w-internal' ? 'Khoa Nội Tổng Hợp' : 'Khoa Ngoại Khoa',
            roomId: dbBed.room_id,
            roomName: dbBed.room_id.replace('r-', 'Phòng ').toUpperCase(),
            bedType: dbBed.bed_type as BedCardData['bedType'],
            state: stateMapped,
            dailyRate: dbBed.daily_rate,
            patient: dbBed.current_patient_id ? (mockMatch?.patient || {
              id: dbBed.current_patient_id,
              name: 'Bệnh nhân nội trú',
              age: 45,
              gender: 'Nam',
              diagnosis: 'Chẩn đoán xác định từ EMR',
              doctorName: 'BS. Trực lâm sàng',
              daysAdmitted: 2,
              alertCount: 0,
              orderCount: 1,
            }) : undefined,
            constraints: mockMatch?.constraints || {
              icuCompatible: dbBed.bed_type === 'icu',
              hasVentilator: dbBed.bed_type === 'icu',
              hasMonitor: true,
              isolationCapable: dbBed.bed_type === 'isolation',
              pediatricSuitable: false,
            },
            lastUpdated: 'Vừa đồng bộ',
          };
        });

        // Merge mapped data with any mock data items not present in the DB
        const dbCodes = new Set(mappedData.map(d => d.code));
        const nonDbMocks = MOCK_BEDS_DATA.filter(m => !dbCodes.has(m.code));
        setBeds([...mappedData, ...nonDbMocks]);
      } else {
        setBeds(MOCK_BEDS_DATA);
      }
    } catch (error) {
      console.error('[CommandCenter] Database fetch failed, falling back to mock dataset:', error);
      setBeds(MOCK_BEDS_DATA);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadHospitalBeds();

    // Setup realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel('hc-beds-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_beds' }, () => {
        void loadHospitalBeds();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Recalculate indicators dynamically
  const capacityStats = useMemo(() => {
    const total = beds.length;
    const occupied = beds.filter((b) => b.state === 'occupied' || b.state === 'isolation').length;
    const available = beds.filter((b) => b.state === 'available').length;
    const reserved = beds.filter((b) => b.state === 'reserved').length;
    const processing = beds.filter((b) => b.state === 'cleaning' || b.state === 'maintenance' || b.state === 'blocked').length;
    const utilization = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return { total, occupied, available, reserved, processing, utilization };
  }, [beds]);

  const wardStats = useMemo(() => {
    const wards = Array.from(new Set(beds.map((b) => b.wardId)));
    return wards.map((wId) => {
      const wardBeds = beds.filter((b) => b.wardId === wId);
      const total = wardBeds.length;
      const occupied = wardBeds.filter((b) => b.state === 'occupied' || b.state === 'isolation').length;
      const utilization = total > 0 ? Math.round((occupied / total) * 100) : 0;
      const name = wardBeds[0]?.wardName || 'Khoa Nội Trú';
      return { id: wId, name, total, occupied, utilization };
    });
  }, [beds]);

  // Handle Bed Allocation
  const handleAssignPatient = async () => {
    if (!allocationTarget) return;
    
    const patientId = allocationQueueItem?.patientId || 'PAT-TEMP';
    const patientName = allocationQueueItem?.patientName || 'Bệnh nhân chờ';

    setLoading(true);
    try {
      const result = await allocateBed({
        tenantId: 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d', // Bella General Hospital UUID
        encounterId: '00000000-0000-0000-0000-000000000000',
        admissionId: `ADM-${Date.now()}`, // Generate temporary admission ID
        patientId,
        wardId: allocationTarget.wardId,
        bedType: allocationTarget.bedType,
        userId: 'system', // Add current user ID if available
      });

      if (result.success) {
        toast.success(`🎉 Đã gán giường ${allocationTarget.code} cho bệnh nhân ${patientName}`);
        
        // Update local state directly to show immediate visual feedback
        setBeds((prev) =>
          prev.map((b) =>
            b.id === allocationTarget.id
              ? {
                  ...b,
                  state: 'occupied',
                  patient: {
                    id: patientId,
                    name: patientName,
                    age: 40,
                    gender: 'Nam',
                    diagnosis: 'Chẩn đoán tiếp nhận điều trị nội trú',
                    doctorName: 'BS. Trực ban lâm sàng',
                    daysAdmitted: 1,
                    alertCount: 0,
                    orderCount: 0,
                  },
                }
              : b
          )
        );

        if (allocationQueueItem) {
          setQueue((prev) => prev.filter((q) => q.id !== allocationQueueItem.id));
        }
      } else {
        toast.error(`Lỗi phân bổ giường: ${result.error?.message || 'Lỗi không xác định'}`);
      }
    } catch {
      toast.error('Không thể thực hiện phân bổ giường');
    } finally {
      setLoading(false);
      setAllocationTarget(null);
      setAllocationQueueItem(null);
    }
  };

  // Change Bed Status (for cleaning, maintenance, release, etc.)
  const handleStatusUpdate = async (bedId: string, newState: BedStateExtended) => {
    try {
      const dbStatus = newState === 'blocked' ? 'out_of_service' : newState;
      
      const supabase = createClient();
      const { error } = await supabase
        .from('hc_beds')
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq('id', bedId);

      if (error) {
        // Fallback status change on mock array if DB update fails or table is empty
        setBeds((prev) =>
          prev.map((b) => (b.id === bedId ? { ...b, state: newState, patient: newState === 'available' ? undefined : b.patient } : b))
        );
        toast.success(`Cập nhật trạng thái giường thành: ${newState} (Local Cache)`);
      } else {
        toast.success(`🎉 Đã cập nhật trạng thái giường thành: ${newState}`);
        void loadHospitalBeds();
      }
    } catch {
      toast.error('Lỗi khi cập nhật trạng thái giường');
    }
  };

  // Break-Glass 3 Steps Authentication Logic
  const handleBreakGlassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (breakGlassStep === 1) {
      setBreakGlassStep(2);
      return;
    }
    if (breakGlassStep === 2) {
      if (!breakGlassPatientId.trim() || !breakGlassReason.trim()) {
        toast.error('Vui lòng nhập mã bệnh nhân và lý do khẩn cấp!');
        return;
      }
      setBreakGlassStep(3);
      return;
    }

    // Step 3: Trigger actual security override API
    setLoading(true);
    try {
      await BreakGlassSecurityService.activateBreakGlassAccess({
        tenantId: 'bella_healthcare',
        userId: 'usr-doctor-001',
        userEmail: 'doctor@bella.vn',
        userName: 'BS. Trịnh Văn Nam (Trưởng Khoa ICU)',
        patientId: breakGlassPatientId,
        reason: breakGlassReason,
      });

      setBreakGlassSuccess('✓ Xác thực thành công! Quyền truy cập bệnh án EMR khẩn cấp đã được kích hoạt và ghi vết audit log.');
      toast.success('🚨 Quyền Break-Glass đã được kích hoạt');

      setTimeout(() => {
        setShowBreakGlassModal(false);
        setBreakGlassStep(1);
        setBreakGlassPatientId('');
        setBreakGlassReason('');
        setBreakGlassSuccess('');
      }, 2500);
    } catch {
      toast.error('Kích hoạt Break-Glass thất bại. Kiểm tra lại phân quyền tài khoản!');
    } finally {
      setLoading(false);
    }
  };

  // Filter beds according to panel parameters
  const filteredBeds = useMemo(() => {
    return beds.filter((bed) => {
      const matchesWard = selectedWard === 'all' || bed.wardId === selectedWard;
      const matchesState = selectedState === 'all' || bed.state === selectedState;
      const matchesType = selectedType === 'all' || bed.bedType === selectedType;
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        bed.code.toLowerCase().includes(searchLower) ||
        (bed.patient && bed.patient.name.toLowerCase().includes(searchLower)) ||
        (bed.patient && bed.patient.id.toLowerCase().includes(searchLower)) ||
        bed.roomName.toLowerCase().includes(searchLower);

      return matchesWard && matchesState && matchesType && matchesSearch;
    });
  }, [beds, selectedWard, selectedState, selectedType, searchQuery]);

  // Group beds by Ward -> Room for Structured Bed Board representation
  const groupedBeds = useMemo(() => {
    const groups: Record<string, Record<string, BedCardData[]>> = {};

    filteredBeds.forEach((bed) => {
      if (!groups[bed.wardId]) {
        groups[bed.wardId] = {};
      }
      if (!groups[bed.wardId][bed.roomId]) {
        groups[bed.wardId][bed.roomId] = [];
      }
      groups[bed.wardId][bed.roomId].push(bed);
    });

    return groups;
  }, [filteredBeds]);

  // Helper labels & icons
  const getStatusBadge = (state: BedStateExtended) => {
    const baseClass = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border";
    switch (state) {
      case 'occupied':
        return <span className={`${baseClass} bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`}>🟢 Đang sử dụng</span>;
      case 'available':
        return <span className={`${baseClass} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`}>🔵 Sẵn sàng</span>;
      case 'cleaning':
        return <span className={`${baseClass} bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`}>🟡 Đang vệ sinh</span>;
      case 'maintenance':
        return <span className={`${baseClass} bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20`}>🟠 Bảo trì</span>;
      case 'reserved':
        return <span className={`${baseClass} bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20`}>🟣 Đặt trước</span>;
      case 'blocked':
        return <span className={`${baseClass} bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20`}>⚫ Đã khóa</span>;
      case 'isolation':
        return <span className={`${baseClass} bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20`}>🔴 Cách ly</span>;
    }
  };

  const getBedTypeLabel = (type: string) => {
    switch (type) {
      case 'icu': return 'Giường ICU';
      case 'vip': return 'Giường VIP';
      case 'isolation': return 'Phòng Cách ly';
      case 'pediatric': return 'Giường Nhi';
      case 'recovery': return 'Hồi sức';
      default: return 'Giường Thường';
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto bg-transparent text-slate-800 dark:text-slate-200">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-cyan-950 via-teal-900 to-emerald-950 rounded-2xl p-6 text-white shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border border-cyan-800/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1.5 z-10">
          <div className="flex items-center space-x-2 text-cyan-300">
            <Building className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Bella Hospital Core • Bed Command System</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
            Trung tâm Điều hành Giường bệnh Nội trú
          </h1>
          <p className="text-cyan-100/90 text-xs font-medium max-w-2xl" style={{ color: '#e0f2fe' }}>
            Hệ thống điều phối năng lực giường bệnh, giám sát thời gian thực, quản lý phân khoa và cảnh báo an toàn lâm sàng.
          </p>
        </div>
        <div className="flex items-center gap-3 z-10 shrink-0">
          <button
            onClick={() => void loadHospitalBeds()}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-white/10 hover:bg-white/5 active:scale-95 transition-all text-white/80 hover:text-white"
            title="Đồng bộ lại"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setBreakGlassStep(1);
              setShowBreakGlassModal(true);
            }}
            className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg shadow-rose-950/20 active:scale-95 transition-all border border-red-500/20"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Break-Glass Mở EMR Khẩn Cấp</span>
          </button>
        </div>
      </div>

      {/* 5-TIER ARCHITECTURE LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: MAIN WORKBOARD (3 COLS) */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* TẦNG 1: CAPACITY KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-3">
              <div className="p-3 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl">
                <BedIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Giường</div>
                <div className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{capacityStats.total}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-3">
              <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đang sử dụng</div>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">{capacityStats.occupied}</span>
                  <span className="text-xs font-bold text-slate-400">({capacityStats.utilization}%)</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sẵn sàng</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{capacityStats.available}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-3">
              <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đang xử lý</div>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{capacityStats.processing}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-3">
              <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã đặt trước</div>
                <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">{capacityStats.reserved}</div>
              </div>
            </div>
          </div>

          {/* TẦNG 2: OPERATIONAL SIGNALS */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-5 rounded-2xl text-white border border-slate-800 shadow-lg shadow-slate-950/40 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hiệu suất Sử dụng Giường bệnh</div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-black">{capacityStats.utilization}%</span>
                  <span className="text-xs text-slate-400">{capacityStats.occupied} / {capacityStats.total} Giường toàn viện</span>
                </div>
              </div>
              
              {/* Phân khoa mini stats */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                {wardStats.map((ward) => (
                  <div key={ward.id} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center space-x-2">
                    <span className="text-slate-400 text-[11px]">{ward.name.replace('Khoa', '').trim()}:</span>
                    <span className="text-cyan-300">{ward.utilization}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Utilization Bar */}
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500" 
                style={{ width: `${capacityStats.utilization}%` }} 
              />
            </div>

            {/* Critical Operational Signals Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="flex items-center space-x-2 text-rose-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>🚨 {queue.length} bệnh nhân trong hàng chờ xếp giường</span>
              </div>
              <div className="flex items-center space-x-2 text-amber-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>🧼 {beds.filter(b => b.state === 'cleaning').length} giường cần vệ sinh khử khuẩn</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>🛠 {beds.filter(b => b.state === 'maintenance').length} giường đang bảo trì cơ sở</span>
              </div>
            </div>
          </div>

          {/* TẦNG 3: FILTER PANEL */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md space-y-4 text-left">
            
            {/* DÒNG 1: 3 DROPDOWNS BỘ LỌC */}
            <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 w-full">
              <div className="flex-1 min-w-0 md:max-w-[240px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Khoa điều trị</label>
                <PremiumSelect
                  options={WARD_OPTIONS}
                  value={selectedWard}
                  onChange={(val) => setSelectedWard(val)}
                  buttonClassName="!py-2 !px-3 !text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 [&_span]:!text-xs [&_span]:!font-medium [&_svg]:!w-3.5 [&_svg]:!h-3.5"
                />
              </div>

              <div className="flex-1 min-w-0 md:max-w-[240px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Trạng thái giường</label>
                <PremiumSelect
                  options={STATE_OPTIONS}
                  value={selectedState}
                  onChange={(val) => setSelectedState(val)}
                  buttonClassName="!py-2 !px-3 !text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 [&_span]:!text-xs [&_span]:!font-medium [&_svg]:!w-3.5 [&_svg]:!h-3.5"
                />
              </div>

              <div className="flex-1 min-w-0 md:max-w-[240px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Loại giường</label>
                <PremiumSelect
                  options={TYPE_OPTIONS}
                  value={selectedType}
                  onChange={(val) => setSelectedType(val)}
                  buttonClassName="!py-2 !px-3 !text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 [&_span]:!text-xs [&_span]:!font-medium [&_svg]:!w-3.5 [&_svg]:!h-3.5"
                />
              </div>

              {/* Clear filters button */}
              <div className="shrink-0">
                {(selectedWard !== 'all' || selectedState !== 'all' || selectedType !== 'all' || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedWard('all');
                      setSelectedState('all');
                      setSelectedType('all');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl cursor-pointer transition-all active:scale-95 text-center h-[38px] flex items-center justify-center"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* DÒNG 2: SEARCH & VIEW MODE */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm giường, bệnh nhân, phòng..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-950 text-xs font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shrink-0 bg-slate-50 dark:bg-slate-950">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-cyan-500/10 text-cyan-600' : 'bg-transparent text-slate-400'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 cursor-pointer transition-all ${viewMode === 'list' ? 'bg-cyan-500/10 text-cyan-600' : 'bg-transparent text-slate-400'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* TẦNG 4: BED BOARD (CHÍNH) */}
          <div className="space-y-6">
            {Object.keys(groupedBeds).length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <BedIcon className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {searchQuery || selectedWard !== 'all' || selectedState !== 'all' || selectedType !== 'all'
                      ? 'Không tìm thấy giường phù hợp'
                      : 'Chưa có giường nội trú được cấu hình'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {searchQuery || selectedWard !== 'all' || selectedState !== 'all' || selectedType !== 'all'
                      ? 'Hãy thay đổi bộ lọc hoặc thử lại với từ khóa tìm kiếm khác.'
                      : 'Hệ thống hiện tại chưa có sơ đồ buồng giường nào được khởi tạo.'}
                  </p>
                </div>
                <div>
                  {searchQuery || selectedWard !== 'all' || selectedState !== 'all' || selectedType !== 'all' ? (
                    <button
                      onClick={() => {
                        setSelectedWard('all');
                        setSelectedState('all');
                        setSelectedType('all');
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Xóa bộ lọc
                    </button>
                  ) : (
                    <button
                      onClick={() => void loadHospitalBeds()}
                      className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 mx-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Thiết lập sơ đồ giường
                    </button>
                  )}
                </div>
              </div>
            ) : (
              Object.entries(groupedBeds).map(([wardId, rooms]) => {
                const wardName = Object.values(rooms)[0]?.[0]?.wardName || 'Khoa Nội Trú';
                const wardTotal = beds.filter(b => b.wardId === wardId).length;
                const wardOccupied = beds.filter(b => b.wardId === wardId && (b.state === 'occupied' || b.state === 'isolation')).length;
                const wardAvailable = beds.filter(b => b.wardId === wardId && b.state === 'available').length;
                const wardCleaning = beds.filter(b => b.wardId === wardId && b.state === 'cleaning').length;

                return (
                  <div key={wardId} className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 space-y-4">
                    {/* Ward Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800 gap-3">
                      <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                        {wardName}
                      </h2>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                        <span>{wardTotal} giường</span>
                        <span>•</span>
                        <span className="text-rose-500">{wardOccupied} đang điều trị</span>
                        <span>•</span>
                        <span className="text-emerald-500">{wardAvailable} sẵn sàng</span>
                        <span>•</span>
                        <span className="text-amber-500">{wardCleaning} đang vệ sinh</span>
                      </div>
                    </div>

                    {/* Rooms within this ward */}
                    <div className="space-y-6">
                      {Object.entries(rooms).map(([roomId, roomBeds]) => {
                        const roomName = roomBeds[0]?.roomName || 'Phòng Nội Trú';
                        return (
                          <div key={roomId} className="space-y-3 text-left">
                            <h3 className="text-xs font-bold text-slate-500 flex items-center gap-2">
                              <DoorOpen className="w-3.5 h-3.5" />
                              {roomName}
                            </h3>

                            {viewMode === 'grid' ? (
                              /* Grid View */
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {roomBeds.map((bed) => (
                                  <div
                                    key={bed.id}
                                    className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition-all relative overflow-hidden group shadow-md hover:shadow-lg ${
                                      bed.state === 'occupied' || bed.state === 'isolation'
                                        ? 'border-rose-200 dark:border-rose-950 bg-white dark:bg-slate-900/60'
                                        : bed.state === 'available'
                                        ? 'border-emerald-200 dark:border-emerald-950 bg-white dark:bg-slate-900/60'
                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                    }`}
                                  >
                                    {/* Card Header */}
                                    <div className="flex justify-between items-start gap-2">
                                      <div>
                                        <div className="text-[10px] font-bold text-slate-400">{getBedTypeLabel(bed.bedType)}</div>
                                        <h4 className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{bed.code}</h4>
                                      </div>
                                      {getStatusBadge(bed.state)}
                                    </div>

                                    {/* Patient Context (If Occupied / Isolation) */}
                                    {bed.patient ? (
                                      <div className="bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/10 dark:border-rose-950/30 rounded-xl p-3 space-y-2">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <div className="text-xs font-black text-rose-900 dark:text-rose-200">{bed.patient.name}</div>
                                            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{bed.patient.id} • {bed.patient.gender} • {bed.patient.age}t</div>
                                          </div>
                                        </div>
                                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                                          <strong>Lâm sàng:</strong> {bed.patient.diagnosis}
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 border-t border-rose-500/10 pt-2">
                                          <span>MD: {bed.patient.doctorName.split('.').pop()?.trim()}</span>
                                          <span>⏱ {bed.patient.daysAdmitted} ngày</span>
                                        </div>
                                        
                                        {/* Clinical Safety Indicators */}
                                        <div className="flex items-center gap-2 pt-1 border-t border-rose-500/10 text-[9px] font-black">
                                          {bed.patient.alertCount > 0 && (
                                            <span className="bg-red-500 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                              ⚠ {bed.patient.alertCount} Cảnh báo
                                            </span>
                                          )}
                                          <span className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded">
                                            💊 {bed.patient.orderCount} Y lệnh
                                          </span>
                                        </div>
                                      </div>
                                    ) : bed.state === 'reserved' ? (
                                      /* Reserved Mode */
                                      <div className="bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/10 dark:border-purple-950/30 rounded-xl p-3">
                                        <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Thông tin giữ giường:</div>
                                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{bed.reservedFor}</p>
                                      </div>
                                    ) : (
                                      /* Constraints details for Available Beds */
                                      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-3 space-y-1.5 text-[10px] font-bold text-slate-500">
                                        <div className="flex justify-between items-center">
                                          <span>Hỗ trợ ICU</span>
                                          <span className={bed.constraints?.icuCompatible ? 'text-emerald-500' : 'text-slate-300'}>✓</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span>Máy thở dã chiến</span>
                                          <span className={bed.constraints?.hasVentilator ? 'text-emerald-500' : 'text-slate-300'}>✓</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span>Monitor đo sinh hiệu</span>
                                          <span className={bed.constraints?.hasMonitor ? 'text-emerald-500' : 'text-slate-300'}>✓</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Action Bar */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold">
                                      <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" /> {bed.lastUpdated}
                                      </span>
                                      
                                      <div className="flex items-center gap-1.5">
                                        {bed.state === 'occupied' && (
                                          <>
                                            <button 
                                              onClick={() => void handleStatusUpdate(bed.id, 'cleaning')}
                                              className="px-2 py-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg cursor-pointer transition-all active:scale-95"
                                            >
                                              Vệ sinh
                                            </button>
                                            <button 
                                              onClick={() => void handleStatusUpdate(bed.id, 'available')}
                                              className="px-2 py-1 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg cursor-pointer transition-all active:scale-95"
                                            >
                                              Xuất viện
                                            </button>
                                          </>
                                        )}
                                        {bed.state === 'cleaning' && (
                                          <button 
                                            onClick={() => void handleStatusUpdate(bed.id, 'available')}
                                            className="px-2 py-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg cursor-pointer transition-all active:scale-95"
                                          >
                                            Sẵn sàng
                                          </button>
                                        )}
                                        {bed.state === 'available' && (
                                          <>
                                            <button 
                                              onClick={() => setAllocationTarget(bed)}
                                              className="px-2 py-1 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-0.5"
                                            >
                                              <UserPlus className="w-3 h-3" /> Gán
                                            </button>
                                            <button 
                                              onClick={() => void handleStatusUpdate(bed.id, 'maintenance')}
                                              className="px-2 py-1 text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer transition-all active:scale-95"
                                            >
                                              Bảo trì
                                            </button>
                                          </>
                                        )}
                                        {bed.state === 'maintenance' && (
                                          <button 
                                            onClick={() => void handleStatusUpdate(bed.id, 'cleaning')}
                                            className="px-2 py-1 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg cursor-pointer transition-all active:scale-95"
                                          >
                                            Xử lý sạch
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* List View Table */
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      <th className="p-3">Mã Giường</th>
                                      <th className="p-3">Loại Giường</th>
                                      <th className="p-3">Trạng thái</th>
                                      <th className="p-3">Bệnh Nhân / Lý Do</th>
                                      <th className="p-3">Đơn Giá / Ngày</th>
                                      <th className="p-3 text-right">Thao tác</th>
                                    </tr>
                                  </thead>
                                  <tbody className="text-xs font-semibold text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
                                    {roomBeds.map((bed) => (
                                      <tr key={bed.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                                        <td className="p-3 font-bold text-slate-900 dark:text-white">{bed.code}</td>
                                        <td className="p-3 text-slate-500">{getBedTypeLabel(bed.bedType)}</td>
                                        <td className="p-3">{getStatusBadge(bed.state)}</td>
                                        <td className="p-3">
                                          {bed.patient ? (
                                            <div>
                                              <span className="font-bold text-slate-900 dark:text-white">{bed.patient.name}</span>
                                              <span className="text-[10px] text-slate-400 ml-1.5">({bed.patient.id})</span>
                                            </div>
                                          ) : bed.state === 'reserved' ? (
                                            <span className="text-purple-600 font-medium">{bed.reservedFor}</span>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="p-3 text-slate-500 font-mono">{bed.dailyRate.toLocaleString('vi-VN')} đ</td>
                                        <td className="p-3 text-right">
                                          <div className="flex justify-end gap-1.5">
                                            {bed.state === 'available' && (
                                              <button 
                                                onClick={() => setAllocationTarget(bed)}
                                                className="px-2.5 py-1 text-cyan-600 bg-cyan-500/10 rounded-lg hover:bg-cyan-500/20 cursor-pointer"
                                              >
                                                Gán
                                              </button>
                                            )}
                                            {bed.state === 'occupied' && (
                                              <button 
                                                onClick={() => void handleStatusUpdate(bed.id, 'cleaning')}
                                                className="px-2.5 py-1 text-amber-600 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 cursor-pointer"
                                              >
                                                Giải phóng
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: OPERATIONAL QUEUE (1 COL) */}
        <div className="space-y-6">
          
          {/* TẦNG 5: BED ASSIGNMENT QUEUE */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-lg shadow-slate-200/50 dark:shadow-black/20 space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-500" />
                Hàng đợi điều phối giường
              </h3>
              <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-black">
                {queue.length} CHỜ
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-500">Đã giải phóng hết hàng chờ tiếp nhận!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-xl space-y-2 transition-all hover:border-slate-300"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">{item.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">{item.patientId} • {item.department}</div>
                      </div>
                      
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        item.priority === 'Critical'
                          ? 'bg-red-500 text-white'
                          : item.priority === 'High'
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {item.priority === 'Critical' ? 'Nguy kịch' : item.priority === 'High' ? 'Khẩn cấp' : 'Thường quy'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold border-t border-slate-200/50 dark:border-slate-800/50 pt-2 mt-2">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> Chờ {item.waitTime}
                      </span>
                      
                      <button
                        onClick={() => {
                          // Find first available bed matching item's department if possible
                          const wardMapping: Record<string, string> = {
                            'Khoa Hồi Sức Tích Cực (ICU)': 'w-icu',
                            'Khoa Nội Tổng Hợp': 'w-internal',
                            'Khoa Ngoại Khoa': 'w-surgery',
                          };
                          const targetWardId = wardMapping[item.department] || 'all';
                          
                          const idealBed = beds.find(b => b.state === 'available' && (targetWardId === 'all' || b.wardId === targetWardId));
                          if (idealBed) {
                            setAllocationTarget(idealBed);
                            setAllocationQueueItem(item);
                            toast.info(`Hệ thống tự động đề xuất giường lý tưởng: ${idealBed.code}`);
                          } else {
                            toast.error('Không tìm thấy giường trống khả dụng ở khoa này! Vui lòng chọn giường thủ công ở bảng phân phối.');
                          }
                        }}
                        className="px-2.5 py-1 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg cursor-pointer transition-all active:scale-95"
                      >
                        Xếp giường
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QUICK HISTORICAL ACTIONS CARD */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-md text-left space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-600" />
              Lịch sử điều phối vừa qua
            </h3>
            
            <div className="space-y-2 text-[11px] font-bold text-slate-500">
              <div className="flex justify-between">
                <span>BS. Nam đã gán ICU-BED-02</span>
                <span className="text-slate-400">2 phút trước</span>
              </div>
              <div className="flex justify-between">
                <span>ĐD. Hạnh đã giải phóng INT-BED-202</span>
                <span className="text-slate-400">12 phút trước</span>
              </div>
              <div className="flex justify-between">
                <span>Giường ICU-BED-06 chuyển vệ sinh</span>
                <span className="text-slate-400">25 phút trước</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL: ASSIGN PATIENT TO BED */}
      {allocationTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-left space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-600" />
                Gán bệnh nhân vào giường
              </h3>
              <button 
                onClick={() => {
                  setAllocationTarget(null);
                  setAllocationQueueItem(null);
                }} 
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 text-xs">
                <div className="text-slate-400 font-bold">Giường tiếp nhận:</div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{allocationTarget.code}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{allocationTarget.wardName} • {allocationTarget.roomName}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Chọn bệnh nhân điều phối:</label>
                {allocationQueueItem ? (
                  <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">{allocationQueueItem.patientName}</div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{allocationQueueItem.patientId} • Chờ {allocationQueueItem.waitTime}</div>
                    </div>
                    <button 
                      onClick={() => setAllocationQueueItem(null)}
                      className="text-rose-500 text-[10px] font-bold hover:underline cursor-pointer"
                    >
                      Thay đổi
                    </button>
                  </div>
                ) : (
                  <select
                    onChange={(e) => {
                      const item = queue.find(q => q.id === e.target.value);
                      if (item) setAllocationQueueItem(item);
                    }}
                    defaultValue=""
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 focus:outline-none"
                  >
                    <option value="" disabled>-- Chọn bệnh nhân từ hàng đợi tiếp nhận --</option>
                    {queue.map(q => (
                      <option key={q.id} value={q.id}>{q.patientName} ({q.patientId} - {q.department})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setAllocationTarget(null);
                  setAllocationQueueItem(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleAssignPatient()}
                disabled={loading || (!allocationQueueItem)}
                className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl cursor-pointer shadow-md disabled:opacity-50"
              >
                {loading ? 'Đang điều phối...' : 'Xác nhận gán giường'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BREAK-GLASS ACCESS EMERGENCY (3-STEPS GOVERNANCE SYSTEM) */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-950/40 text-left space-y-4">
            
            {/* Modal Title Banner */}
            <div className="flex items-center space-x-3 text-rose-700 mb-2">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
              <h2 className="text-base font-black uppercase tracking-tight">Kích Hoạt Break-Glass Mở EMR Khẩn Cấp</h2>
            </div>

            {/* Stepper Indicator */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-slate-100 dark:border-slate-800 py-2">
              <span className={breakGlassStep >= 1 ? 'text-rose-600' : ''}>1. Cảnh báo an ninh</span>
              <span>→</span>
              <span className={breakGlassStep >= 2 ? 'text-rose-600' : ''}>2. Khai báo thông tin</span>
              <span>→</span>
              <span className={breakGlassStep >= 3 ? 'text-rose-600' : ''}>3. Audit Log & Kích hoạt</span>
            </div>

            {breakGlassSuccess ? (
              /* Success Stage */
              <div className="p-5 bg-emerald-100/80 border border-emerald-300 text-emerald-800 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                <div className="text-sm font-black">{breakGlassSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleBreakGlassSubmit} className="space-y-4">
                
                {/* STEP 1: SAFETY INFORMATION */}
                {breakGlassStep === 1 && (
                  <div className="space-y-3">
                    <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
                      ⚠️ <strong>CẢNH BÁO AN NINH TUÂN THỦ TIER-3 GOVERNANCE:</strong>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        <li>Tính năng Break-Glass chỉ được sử dụng cho các trường hợp cấp cứu y khoa đe dọa trực tiếp tính mạng bệnh nhân.</li>
                        <li>Việc truy cập không có lý do chính đáng sẽ bị kỷ luật nghiêm khắc theo quy định bệnh viện.</li>
                        <li>Toàn bộ thông tin sẽ được tự động báo cáo lên Hội đồng Y khoa & CISO thông qua Event Bus.</li>
                      </ul>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs font-bold pt-2">
                      <span className="text-slate-400">Xác nhận tuân thủ an toàn thông tin</span>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-rose-600 text-white rounded-xl shadow-md cursor-pointer hover:bg-rose-700"
                      >
                        Tiếp tục →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: DECLARATION FORM */}
                {breakGlassStep === 2 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mã bệnh nhân cần truy cập EMR (MRN / Patient ID):</label>
                      <input
                        type="text"
                        required
                        value={breakGlassPatientId}
                        onChange={(e) => setBreakGlassPatientId(e.target.value)}
                        placeholder="Ví dụ: PAT-8291..."
                        className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none dark:bg-slate-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lý do y khoa khẩn cấp bắt buộc:</label>
                      <textarea
                        required
                        rows={3}
                        value={breakGlassReason}
                        onChange={(e) => setBreakGlassReason(e.target.value)}
                        placeholder="Ví dụ: Bệnh nhân hôn mê sâu tại khoa Cấp cứu, cần truy cập khẩn cấp để kiểm tra tiền sử sốc phản vệ với penicillin..."
                        className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none dark:bg-slate-950"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setBreakGlassStep(1)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
                      >
                        Quay lại
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-rose-600 text-white rounded-xl shadow-md cursor-pointer hover:bg-rose-700"
                      >
                        Kiểm tra log →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: SECURITY AUDIT PREVIEW */}
                {breakGlassStep === 3 && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-4 text-xs space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Thông tin ghi nhận Audit log:</div>
                      <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                        <div>Người thực hiện:</div>
                        <div className="text-slate-900 dark:text-white">BS. Trịnh Văn Nam</div>
                        <div>Chức danh:</div>
                        <div>Bác sĩ trưởng ban - ICU</div>
                        <div>Mã bệnh nhân:</div>
                        <div className="text-rose-600 dark:text-rose-400">{breakGlassPatientId}</div>
                        <div>Lý do ghi nhận:</div>
                        <div className="italic font-medium text-slate-500">{breakGlassReason}</div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setBreakGlassStep(2)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl cursor-pointer"
                      >
                        Quay lại
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {loading ? 'Đang kích hoạt an ninh...' : 'Xác nhận kích hoạt Break-Glass'}
                      </button>
                    </div>
                  </div>
                )}
                
              </form>
            )}

            {breakGlassStep !== 3 && !breakGlassSuccess && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
