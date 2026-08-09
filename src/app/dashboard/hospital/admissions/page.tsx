'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { InpatientAdmission, Bed, Ward, ICD10Diagnosis } from '@/types/healthcare';
import { InpatientAdmissionService, BedEngineService } from '@/services/healthcare-hospital-services';
import {
  Hospital,
  UserPlus,
  Activity,
  FileCheck,
  CheckCircle2,
  Clock,
  User,
  Bed as BedIcon,
  Stethoscope,
  Pill,
  Printer,
  Search,
  Filter,
  AlertTriangle,
  ChevronRight,
  X,
  ShieldCheck,
  CheckSquare,
  FileText,
  Building2,
  AlertCircle,
  FileWarning,
} from 'lucide-react';
import PremiumSelect from '@/components/ui/PremiumSelect';

// Extended type to represent full clinical view
interface ExtendedInpatientAdmission extends InpatientAdmission {
  patient_name: string;
  age: number;
  gender: 'Nam' | 'Nữ';
  clinical_state: 'treating' | 'waiting_cls' | 'has_alert' | 'waiting_doctor' | 'preparing_discharge';
  total_orders: number;
  pending_orders: number;
  mar_percentage: number;
  mar_administered: number;
  mar_scheduled: number;
  mar_pending: number;
  mar_missed: number;
  pending_cls: number;
  alerts_count: number;
  alert_details?: string[];
  vitals: {
    temp: number;
    hr: number;
    systolic_bp: number;
    diastolic_bp: number;
    spo2: number;
  };
  allergies: string[];
  last_activity: {
    time: string;
    text: string;
  };
  attending_doctor_name: string;
}

const MOCK_INPATIENT_DATA: ExtendedInpatientAdmission[] = [
  {
    id: 'adm-001',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-001',
    patient_id: 'pat-001',
    patient_name: 'Nguyễn Văn Hoàng',
    age: 62,
    gender: 'Nam',
    bed_id: 'bed-001',
    ward_id: 'ward-001',
    admitting_doctor_id: 'doc-001',
    attending_doctor_id: 'doc-001',
    attending_doctor_name: 'BS. CKII Nguyễn Văn Minh',
    admission_diagnosis: [
      {
        icd10_code: 'I50.9',
        icd10_name_vi: 'Suy tim, không đặc hiệu',
        is_primary: true
      }
    ],
    status: 'admitted',
    clinical_state: 'treating',
    total_orders: 8,
    pending_orders: 0,
    mar_percentage: 96,
    mar_administered: 7,
    mar_scheduled: 8,
    mar_pending: 1,
    mar_missed: 0,
    pending_cls: 0,
    alerts_count: 0,
    vitals: { temp: 37.1, hr: 82, systolic_bp: 120, diastolic_bp: 80, spo2: 98 },
    allergies: ['Dị ứng Penicillin'],
    last_activity: { time: '14:32', text: 'Điều dưỡng ghi nhận SpO₂ 98%' },
    admitted_at: '2026-08-06T16:04:56Z',
    created_at: '2026-08-06T16:04:56Z',
    updated_at: '2026-08-06T16:04:56Z'
  },
  {
    id: 'adm-002',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-002',
    patient_id: 'pat-002',
    patient_name: 'Phạm Thị Mai',
    age: 45,
    gender: 'Nữ',
    bed_id: 'bed-002',
    ward_id: 'ward-002',
    admitting_doctor_id: 'doc-002',
    attending_doctor_id: 'doc-002',
    attending_doctor_name: 'ThS. BS Lê Thị Mai',
    admission_diagnosis: [
      {
        icd10_code: 'J18.9',
        icd10_name_vi: 'Viêm phổi, không đặc hiệu',
        is_primary: true
      }
    ],
    status: 'admitted',
    clinical_state: 'waiting_cls',
    total_orders: 5,
    pending_orders: 2,
    mar_percentage: 100,
    mar_administered: 4,
    mar_scheduled: 4,
    mar_pending: 0,
    mar_missed: 0,
    pending_cls: 2,
    alerts_count: 0,
    vitals: { temp: 37.8, hr: 88, systolic_bp: 115, diastolic_bp: 75, spo2: 96 },
    allergies: [],
    last_activity: { time: '13:52', text: 'Yêu cầu cận lâm sàng X-quang ngực thẳng được gửi đi' },
    admitted_at: '2026-08-07T16:04:56Z',
    created_at: '2026-08-07T16:04:56Z',
    updated_at: '2026-08-07T16:04:56Z'
  },
  {
    id: 'adm-003',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-003',
    patient_id: 'pat-003',
    patient_name: 'Trần Quốc Tuấn',
    age: 58,
    gender: 'Nam',
    bed_id: 'bed-003',
    ward_id: 'ward-001',
    admitting_doctor_id: 'doc-001',
    attending_doctor_id: 'doc-001',
    attending_doctor_name: 'BS. CKII Nguyễn Văn Minh',
    admission_diagnosis: [
      {
        icd10_code: 'I10',
        icd10_name_vi: 'Tăng huyết áp vô căn (nguyên phát)',
        is_primary: true
      }
    ],
    status: 'admitted',
    clinical_state: 'has_alert',
    total_orders: 7,
    pending_orders: 1,
    mar_percentage: 85,
    mar_administered: 6,
    mar_scheduled: 7,
    mar_pending: 0,
    mar_missed: 1,
    pending_cls: 0,
    alerts_count: 2,
    alert_details: ['Trễ liều thuốc hạ áp lúc 15:00', 'Huyết áp đo lúc 15:30 tăng cao (145/95)'],
    vitals: { temp: 36.9, hr: 95, systolic_bp: 145, diastolic_bp: 95, spo2: 95 },
    allergies: ['Dị ứng Aspirin'],
    last_activity: { time: '15:30', text: 'Sinh hiệu huyết áp đo bất thường (145/95 mmHg)' },
    admitted_at: '2026-08-05T08:30:00Z',
    created_at: '2026-08-05T08:30:00Z',
    updated_at: '2026-08-05T08:30:00Z'
  },
  {
    id: 'adm-004',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-004',
    patient_id: 'pat-004',
    patient_name: 'Lê Thị Lan',
    age: 34,
    gender: 'Nữ',
    bed_id: 'bed-004',
    ward_id: 'ward-003',
    admitting_doctor_id: 'doc-003',
    attending_doctor_id: 'doc-003',
    attending_doctor_name: 'BS. Nguyễn Văn Hùng',
    admission_diagnosis: [
      {
        icd10_code: 'K29.5',
        icd10_name_vi: 'Viêm dạ dày mạn tính, không đặc hiệu',
        is_primary: true
      }
    ],
    status: 'admitted',
    clinical_state: 'waiting_doctor',
    total_orders: 4,
    pending_orders: 1,
    mar_percentage: 100,
    mar_administered: 4,
    mar_scheduled: 4,
    mar_pending: 0,
    mar_missed: 0,
    pending_cls: 1,
    alerts_count: 0,
    vitals: { temp: 37.0, hr: 78, systolic_bp: 110, diastolic_bp: 70, spo2: 97 },
    allergies: [],
    last_activity: { time: '14:15', text: 'Y lệnh thuốc mới đang chờ bác sĩ ký xác nhận' },
    admitted_at: '2026-08-07T10:15:00Z',
    created_at: '2026-08-07T10:15:00Z',
    updated_at: '2026-08-07T10:15:00Z'
  },
  {
    id: 'adm-005',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-005',
    patient_id: 'pat-005',
    patient_name: 'Hoàng Văn Nam',
    age: 70,
    gender: 'Nam',
    bed_id: 'bed-005',
    ward_id: 'ward-001',
    admitting_doctor_id: 'doc-001',
    attending_doctor_id: 'doc-001',
    attending_doctor_name: 'BS. CKII Nguyễn Văn Minh',
    admission_diagnosis: [
      {
        icd10_code: 'E11.9',
        icd10_name_vi: 'Đái tháo đường typ 2 không biến chứng',
        is_primary: true
      }
    ],
    status: 'admitted',
    clinical_state: 'preparing_discharge',
    total_orders: 6,
    pending_orders: 0,
    mar_percentage: 100,
    mar_administered: 6,
    mar_scheduled: 6,
    mar_pending: 0,
    mar_missed: 0,
    pending_cls: 0,
    alerts_count: 0,
    vitals: { temp: 36.8, hr: 75, systolic_bp: 120, diastolic_bp: 80, spo2: 99 },
    allergies: [],
    last_activity: { time: '16:00', text: 'Báo cáo tóm tắt bệnh án xuất viện hoàn tất' },
    admitted_at: '2026-08-04T09:00:00Z',
    created_at: '2026-08-04T09:00:00Z',
    updated_at: '2026-08-04T09:00:00Z'
  }
];

export default function HospitalAdmissionsPage() {
  const [admissions, setAdmissions] = useState<ExtendedInpatientAdmission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedAlertFilter, setSelectedAlertFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all'); // all, treating, has_alert, waiting_doctor, waiting_cls, preparing_discharge

  // Patient Quick View Drawer State
  const [selectedPatientView, setSelectedPatientView] = useState<ExtendedInpatientAdmission | null>(null);

  // New Admission Form State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [patientId, setPatientId] = useState<string>('pat-006');
  const [encounterId, setEncounterId] = useState<string>('enc-006');
  const [selectedWardId, setSelectedWardId] = useState<string>('ward-001');
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [doctorName, setDoctorName] = useState<string>('BS. CKII Nguyễn Văn Minh');
  const [icd10Code, setIcd10Code] = useState<string>('I50.9');
  const [icd10Name, setIcd10Name] = useState<string>('Suy tim, không đặc hiệu');

  // Discharge Safety Checklist State
  const [selectedDischargeAdmission, setSelectedDischargeAdmission] = useState<ExtendedInpatientAdmission | null>(null);
  const [dischargeChecklist, setDischargeChecklist] = useState({
    diagnosisCompleted: false,
    medicationReviewed: false,
    homePrescriptionReady: false,
    billingCleared: false,
    insuranceVerified: false,
    summaryCompleted: false,
    doctorSigned: false,
  });
  const [dischargeSummary, setDischargeSummary] = useState<string>('');

  const handlePrintDocument = (type: 'admission' | 'prescription' | 'mar' | 'discharge', adm: ExtendedInpatientAdmission) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const bed = beds.find((b) => b.id === adm.bed_id);
    const ward = wards.find((w) => w.id === adm.ward_id);

    let content = '';

    if (type === 'admission') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <p>Mã HS: ${adm.patient_id} | Đợt nhập viện: ${adm.id}</p>
            <hr style="border: 1px solid #ccc; width: 60%;" />
            <h1 style="margin-top: 20px;">PHIẾU TIẾP NHẬN NỘI TRÚ</h1>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <tr>
              <td style="padding: 8px; width: 30%;"><strong>Họ và tên bệnh nhân:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">${adm.patient_name}</td>
              <td style="padding: 8px; width: 15%;"><strong>Giới tính:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">${adm.gender}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Mã phòng/giường:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">${bed?.bed_code || adm.bed_id} (${ward?.name || 'Khoa Nội'})</td>
              <td style="padding: 8px;"><strong>Ngày nhập viện:</strong></td>
              <td style="padding: 8px; border-bottom: 1px dashed #000;">${new Date(adm.admitted_at).toLocaleDateString('vi-VN')}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Chẩn đoán chính:</strong></td>
              <td colspan="3" style="padding: 8px; border-bottom: 1px dashed #000;">
                ${adm.admission_diagnosis.map((d) => `[${d.icd10_code}] ${d.icd10_name_vi}`).join(', ')}
              </td>
            </tr>
          </table>
          <div style="margin-top: 50px; float: right; text-align: center; width: 250px;">
            <p>Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</p>
            <strong>BÁC SĨ ĐIỀU TRỊ</strong>
            <div style="margin-top: 80px;">${adm.attending_doctor_name}</div>
          </div>
        </div>
      `;
    } else if (type === 'prescription') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <p>Mã HS: ${adm.patient_id} | Đơn thuốc: RX-${adm.id.slice(-6)}</p>
            <hr style="border: 1px solid #ccc; width: 60%;" />
            <h1 style="margin-top: 20px;">ĐƠN THUỐC ĐIỀU TRỊ NỘI TRÚ</h1>
          </div>
          <p><strong>Bệnh nhân:</strong> ${adm.patient_name} | <strong>Tuổi:</strong> ${adm.age}</p>
          <p><strong>Chẩn đoán:</strong> ${adm.admission_diagnosis.map((d) => `[${d.icd10_code}] ${d.icd10_name_vi}`).join(', ')}</p>
          <h3 style="margin-top: 30px; border-bottom: 2px solid #000; padding-bottom: 5px;">CHỈ ĐỊNH THUỐC</h3>
          <ol style="padding-left: 20px; font-size: 15px;">
            <li style="margin-bottom: 15px;">
              <strong>Amoxicillin 500mg</strong> - Số lượng: 20 Viên<br />
              <i>Liều dùng: Uống 2 viên/ngày, chia 2 lần sáng tối sau ăn.</i>
            </li>
            <li style="margin-bottom: 15px;">
              <strong>Paracetamol 500mg</strong> - Số lượng: 10 Viên<br />
              <i>Liều dùng: Uống 1 viên khi sốt > 38.5 độ C, cách tối thiểu 4-6 tiếng.</i>
            </li>
          </ol>
          <div style="margin-top: 60px; float: right; text-align: center; width: 250px;">
            <p>Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</p>
            <strong>BÁC SĨ KÊ ĐƠN</strong>
            <div style="margin-top: 80px;">${adm.attending_doctor_name}</div>
          </div>
        </div>
      `;
    } else if (type === 'mar') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.4;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <h3>PHIẾU THEO DÕI SỬ DỤNG THUỐC (MAR CARD)</h3>
            <p>Giường: ${bed?.bed_code || adm.bed_id} | Khoa: ${ward?.name || 'Khoa Nội'} | Bệnh nhân: ${adm.patient_name}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;" border="1">
            <thead>
              <tr style="background-color: #f2f2f2; font-size: 13px;">
                <th style="padding: 8px;">Tên Thuốc / Hàm Lượng</th>
                <th style="padding: 8px;">Sáng (08:00)</th>
                <th style="padding: 8px;">Trưa (12:00)</th>
                <th style="padding: 8px;">Chiều (16:00)</th>
                <th style="padding: 8px;">Tối (20:00)</th>
                <th style="padding: 8px;">Ký xác nhận (Điều dưỡng)</th>
              </tr>
            </thead>
            <tbody style="font-size: 12px;">
              <tr>
                <td style="padding: 10px;"><strong>Amoxicillin 500mg</strong></td>
                <td style="text-align: center;">1 Viên</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">1 Viên</td>
                <td style="padding: 10px;">ĐD. Nguyễn Văn B</td>
              </tr>
              <tr>
                <td style="padding: 10px;"><strong>Glucose 5% (Truyền dịch)</strong></td>
                <td style="text-align: center;">500 ml</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">-</td>
                <td style="padding: 10px;">ĐD. Nguyễn Văn B</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else if (type === 'discharge') {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2>BỆNH VIỆN ĐA KHOA QUỐC TẾ BELLA</h2>
            <p>Mã HS: ${adm.patient_id} | Đợt điều trị: ${adm.id}</p>
            <hr style="border: 1px solid #ccc; width: 60%;" />
            <h1 style="margin-top: 20px;">GIẤY RA VIỆN (DISCHARGE REPORT)</h1>
          </div>
          <p><strong>Bệnh nhân:</strong> ${adm.patient_name} | <strong>Giới tính:</strong> ${adm.gender} | <strong>Tuổi:</strong> ${adm.age}</p>
          <p><strong>Chẩn đoán ra viện:</strong> ${adm.admission_diagnosis.map((d) => `[${d.icd10_code}] ${d.icd10_name_vi}`).join(', ')}</p>
          <p><strong>Tóm tắt quá trình điều trị:</strong> ${adm.discharge_summary || 'Bệnh nhân đáp ứng điều trị tốt, các chỉ số sinh hiệu trở lại bình thường.'}</p>
          <p><strong>Lời dặn bác sĩ:</strong> Uống thuốc theo đơn ra viện, tái khám sau 7 ngày.</p>
          <div style="margin-top: 60px; float: right; text-align: center; width: 250px;">
            <p>Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</p>
            <strong>TRƯỞNG KHOA LÂM SÀNG</strong>
            <div style="margin-top: 80px;">${adm.attending_doctor_name}</div>
          </div>
        </div>
      `;
    }

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const admData = await InpatientAdmissionService.getInpatientAdmissions('bella_healthcare');
      const bedsData = await BedEngineService.getHospitalBeds('bella_healthcare');
      const wardsData = await BedEngineService.getHospitalWards('bella_healthcare');

      setBeds(bedsData);
      setWards(wardsData);

      // Construct extended fields from database or match with mock details
      const extendedAdms: ExtendedInpatientAdmission[] = admData.map((dbAdm) => {
        const mockMatch = MOCK_INPATIENT_DATA.find((m) => m.patient_id === dbAdm.patient_id);
        return {
          ...dbAdm,
          patient_name: mockMatch?.patient_name || (dbAdm.patient_id === 'pat-001' ? 'Nguyễn Văn Hoàng' : dbAdm.patient_id === 'pat-002' ? 'Phạm Thị Mai' : `Bệnh nhân ${dbAdm.patient_id.slice(-4)}`),
          age: mockMatch?.age || 45,
          gender: mockMatch?.gender || 'Nam',
          clinical_state: mockMatch?.clinical_state || 'treating',
          total_orders: mockMatch?.total_orders || 6,
          pending_orders: mockMatch?.pending_orders || 0,
          mar_percentage: mockMatch?.mar_percentage || 100,
          mar_administered: mockMatch?.mar_administered || 6,
          mar_scheduled: mockMatch?.mar_scheduled || 6,
          mar_pending: mockMatch?.mar_pending || 0,
          mar_missed: mockMatch?.mar_missed || 0,
          pending_cls: mockMatch?.pending_cls || 0,
          alerts_count: mockMatch?.alerts_count || 0,
          alert_details: mockMatch?.alert_details || [],
          vitals: mockMatch?.vitals || { temp: 37.0, hr: 80, systolic_bp: 120, diastolic_bp: 80, spo2: 98 },
          allergies: mockMatch?.allergies || [],
          last_activity: mockMatch?.last_activity || { time: '16:04', text: 'Đợt tiếp nhận nội trú được ghi nhận' },
          attending_doctor_name: mockMatch?.attending_doctor_name || 'BS. CKII Nguyễn Văn Minh',
        };
      });

      // Ensure we always have mock data populated for demo purposes if DB lacks records
      if (extendedAdms.length === 0) {
        setAdmissions(MOCK_INPATIENT_DATA);
      } else {
        // Merge db records and mock data to show robust clinical list
        const merged = [...extendedAdms];
        MOCK_INPATIENT_DATA.forEach((m) => {
          if (!merged.some((x) => x.id === m.id)) {
            merged.push(m);
          }
        });
        setAdmissions(merged);
      }

      const availableBed = bedsData.find((b) => b.status === 'available');
      if (availableBed) {
        setSelectedBedId(availableBed.id);
      }
    } catch (err: unknown) {
      // Fallback on error (like RLS or DB connection issue) to keep demonstration operational
      setAdmissions(MOCK_INPATIENT_DATA);
      // Construct basic mock beds/wards
      setBeds([
        { id: 'bed-001', tenant_id: 'bella_healthcare', ward_id: 'ward-001', bed_code: 'ICU-BED-01', bed_type: 'icu', status: 'occupied', daily_rate: 1500000, updated_at: '' },
        { id: 'bed-002', tenant_id: 'bella_healthcare', ward_id: 'ward-002', bed_code: 'INT-BED-01', bed_type: 'regular', status: 'occupied', daily_rate: 500000, updated_at: '' },
        { id: 'bed-003', tenant_id: 'bella_healthcare', ward_id: 'ward-001', bed_code: 'ICU-BED-02', bed_type: 'icu', status: 'occupied', daily_rate: 1500000, updated_at: '' },
        { id: 'bed-004', tenant_id: 'bella_healthcare', ward_id: 'ward-003', bed_code: 'PED-BED-01', bed_type: 'regular', status: 'occupied', daily_rate: 600000, updated_at: '' },
        { id: 'bed-005', tenant_id: 'bella_healthcare', ward_id: 'ward-001', bed_code: 'ICU-BED-03', bed_type: 'icu', status: 'occupied', daily_rate: 1500000, updated_at: '' },
        { id: 'bed-006', tenant_id: 'bella_healthcare', ward_id: 'ward-001', bed_code: 'ICU-BED-04', bed_type: 'icu', status: 'available', daily_rate: 1500000, updated_at: '' },
        { id: 'bed-007', tenant_id: 'bella_healthcare', ward_id: 'ward-002', bed_code: 'INT-BED-02', bed_type: 'regular', status: 'available', daily_rate: 500000, updated_at: '' },
      ]);
      setWards([
        { id: 'ward-001', tenant_id: 'bella_healthcare', name: 'Khoa Hồi Sức Tích Cực (ICU)', description: 'Chăm sóc đặc biệt', created_at: '', updated_at: '' },
        { id: 'ward-002', tenant_id: 'bella_healthcare', name: 'Khoa Nội Tổng Hợp', description: 'Điều trị nội khoa', created_at: '', updated_at: '' },
        { id: 'ward-003', tenant_id: 'bella_healthcare', name: 'Khoa Nhi', description: 'Chăm sóc trẻ em', created_at: '', updated_at: '' },
      ]);
      setSelectedBedId('bed-006');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedId) {
      alert('Vui lòng chọn giường trống để gán bệnh nhân!');
      return;
    }

    try {
      const created = await InpatientAdmissionService.createInpatientAdmission({
        tenantId: 'bella_healthcare',
        encounterId: encounterId || `enc-${Date.now()}`,
        patientId: patientId || `pat-${Date.now()}`,
        bedId: selectedBedId,
        wardId: selectedWardId,
        admittingDoctorId: 'doc-001',
        attendingDoctorId: 'doc-001',
        admissionDiagnosis: [
          {
            icd10_code: icd10Code || 'I10',
            icd10_name_vi: icd10Name || 'Tăng huyết áp vô căn',
            is_primary: true,
          },
        ],
      });

      // Construct extended object for state
      const extendedNew: ExtendedInpatientAdmission = {
        ...created,
        patient_name: patientId === 'pat-006' ? 'Cao Minh Tú' : `Bệnh nhân ${patientId}`,
        age: 39,
        gender: 'Nam',
        clinical_state: 'treating',
        total_orders: 3,
        pending_orders: 0,
        mar_percentage: 100,
        mar_administered: 3,
        mar_scheduled: 3,
        mar_pending: 0,
        mar_missed: 0,
        pending_cls: 0,
        alerts_count: 0,
        vitals: { temp: 36.6, hr: 76, systolic_bp: 120, diastolic_bp: 80, spo2: 98 },
        allergies: [],
        last_activity: { time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), text: 'Tiếp nhận nhập viện thành công' },
        attending_doctor_name: doctorName,
      };

      setAdmissions((prev) => [extendedNew, ...prev]);
      setShowAddModal(false);
      await loadData();
    } catch (err: unknown) {
      // In case DB failed, insert locally to allow visual demo
      const localNew: ExtendedInpatientAdmission = {
        id: `adm-${Date.now()}`,
        tenant_id: 'bella_healthcare',
        encounter_id: encounterId || `enc-${Date.now()}`,
        patient_id: patientId || `pat-${Date.now()}`,
        patient_name: patientId === 'pat-006' ? 'Cao Minh Tú' : `Bệnh nhân ${patientId}`,
        age: 39,
        gender: 'Nam',
        bed_id: selectedBedId,
        ward_id: selectedWardId,
        admitting_doctor_id: 'doc-001',
        attending_doctor_id: 'doc-001',
        admission_diagnosis: [
          {
            icd10_code: icd10Code || 'I10',
            icd10_name_vi: icd10Name || 'Tăng huyết áp vô căn',
            is_primary: true,
          },
        ],
        status: 'admitted',
        clinical_state: 'treating',
        total_orders: 3,
        pending_orders: 0,
        mar_percentage: 100,
        mar_administered: 3,
        mar_scheduled: 3,
        mar_pending: 0,
        mar_missed: 0,
        pending_cls: 0,
        alerts_count: 0,
        vitals: { temp: 36.6, hr: 76, systolic_bp: 120, diastolic_bp: 80, spo2: 98 },
        allergies: [],
        last_activity: { time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), text: 'Tiếp nhận nhập viện (Demo Local)' },
        attending_doctor_name: doctorName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setAdmissions((prev) => [localNew, ...prev]);
      setShowAddModal(false);
    }
  };

  const handleConfirmDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDischargeAdmission) return;

    try {
      const discharged = await InpatientAdmissionService.dischargePatient(
        selectedDischargeAdmission.id,
        dischargeSummary || 'Bệnh nhân ổn định, đáp ứng điều trị nội trú tốt.'
      );

      setAdmissions((prev) =>
        prev.map((a) =>
          a.id === discharged.id
            ? { ...a, status: 'discharged', discharged_at: discharged.discharged_at, discharge_summary: discharged.discharge_summary }
            : a
        )
      );
      setSelectedDischargeAdmission(null);
      resetDischargeFlow();
      await loadData();
    } catch (err: unknown) {
      // Offline fallback
      setAdmissions((prev) =>
        prev.map((a) =>
          a.id === selectedDischargeAdmission.id
            ? {
                ...a,
                status: 'discharged',
                clinical_state: 'treating',
                discharged_at: new Date().toISOString(),
                discharge_summary: dischargeSummary || 'Bệnh nhân ổn định, đáp ứng điều trị nội trú tốt (Demo Local).'
              }
            : a
        )
      );
      setSelectedDischargeAdmission(null);
      resetDischargeFlow();
    }
  };

  const resetDischargeFlow = () => {
    setDischargeSummary('');
    setDischargeChecklist({
      diagnosisCompleted: false,
      medicationReviewed: false,
      homePrescriptionReady: false,
      billingCleared: false,
      insuranceVerified: false,
      summaryCompleted: false,
      doctorSigned: false,
    });
  };

  const startDischargeFlow = (adm: ExtendedInpatientAdmission) => {
    setSelectedDischargeAdmission(adm);
    // Auto-pre-check based on patient clinical state to look realistic
    setDischargeChecklist({
      diagnosisCompleted: true,
      medicationReviewed: true,
      homePrescriptionReady: adm.clinical_state === 'preparing_discharge',
      billingCleared: adm.clinical_state === 'preparing_discharge',
      insuranceVerified: true,
      summaryCompleted: adm.clinical_state === 'preparing_discharge',
      doctorSigned: false,
    });
    setDischargeSummary('Bệnh nhân ổn định, các chỉ số sinh hiệu trở lại bình thường. Đủ điều kiện ra viện nội trú.');
  };

  const availableBeds = beds.filter((b) => b.status === 'available');

  // Compute stats for EMR Command Dashboard
  const stats = {
    total: admissions.filter(a => a.status === 'admitted').length,
    treating: admissions.filter(a => a.status === 'admitted' && a.clinical_state === 'treating').length,
    waitingOrders: admissions.filter(a => a.status === 'admitted' && a.clinical_state === 'waiting_doctor').length,
    marRate: admissions.filter(a => a.status === 'admitted').length > 0
      ? (admissions.filter(a => a.status === 'admitted').reduce((acc, curr) => acc + curr.mar_percentage, 0) / admissions.filter(a => a.status === 'admitted').length).toFixed(1)
      : '100',
    dischargeReady: admissions.filter(a => a.status === 'admitted' && a.clinical_state === 'preparing_discharge').length,
    criticalAlerts: admissions.filter(a => a.status === 'admitted' && a.clinical_state === 'has_alert').length,
    waitingCls: admissions.filter(a => a.status === 'admitted' && a.clinical_state === 'waiting_cls').length
  };

  // Filter admissions
  const filteredAdmissions = admissions.filter((adm) => {
    // Only display active inpatient for command center, or display everything
    if (activeTab === 'treating' && adm.clinical_state !== 'treating') return false;
    if (activeTab === 'has_alert' && adm.clinical_state !== 'has_alert') return false;
    if (activeTab === 'waiting_doctor' && adm.clinical_state !== 'waiting_doctor') return false;
    if (activeTab === 'waiting_cls' && adm.clinical_state !== 'waiting_cls') return false;
    if (activeTab === 'preparing_discharge' && adm.clinical_state !== 'preparing_discharge') return false;

    // Search query matching
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      adm.id.toLowerCase().includes(searchLower) ||
      adm.patient_id.toLowerCase().includes(searchLower) ||
      adm.patient_name.toLowerCase().includes(searchLower) ||
      adm.admission_diagnosis.some((d) => d.icd10_code.toLowerCase().includes(searchLower) || d.icd10_name_vi.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    // Dropdown filters
    if (selectedWard !== 'all' && adm.ward_id !== selectedWard) return false;
    if (selectedState !== 'all' && adm.clinical_state !== selectedState) return false;
    if (selectedAlertFilter !== 'all') {
      if (selectedAlertFilter === 'high_alert' && adm.clinical_state !== 'has_alert') return false;
      if (selectedAlertFilter === 'missed_mar' && adm.mar_missed === 0) return false;
      if (selectedAlertFilter === 'allergy' && adm.allergies.length === 0) return false;
    }

    return true;
  });

  const allDischargeChecklistChecked = Object.values(dischargeChecklist).every(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
          <Hospital className="w-96 h-96" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-indigo-300 mb-1">
            <Hospital className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">BELLA HOSPITAL CORE • INPATIENT EMR & MAR</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight !text-white" style={{ color: '#ffffff' }}>Bệnh án Nội trú & Điều hành Điều trị</h1>
          <p className="text-indigo-200/90 text-sm mt-1 max-w-2xl">
            Theo dõi bệnh nhân, y lệnh, thuốc, kết quả cận lâm sàng và trạng thái điều trị theo thời gian thực.
          </p>
        </div>
        <button
          onClick={() => {
            const nextPatientNum = admissions.length + 1;
            setPatientId(`pat-00${nextPatientNum}`);
            setEncounterId(`enc-00${nextPatientNum}`);
            setShowAddModal(true);
          }}
          className="relative z-10 flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-emerald-950/40 transition-all border border-emerald-400/20 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tiếp Nhận Nội Trú</span>
        </button>
      </div>

      {/* Hospital Inpatient Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">BN Nội Trú</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-3xl font-black text-slate-900">{stats.total}</span>
            <span className="text-xs text-slate-400">bệnh nhân</span>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold mt-1">Đang nằm giường điều trị</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đang Điều Trị</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-3xl font-black text-emerald-600">{stats.treating}</span>
            <span className="text-xs text-emerald-600/80">ổn định</span>
          </div>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold self-start mt-1">Sức khỏe tiến triển tốt</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chờ Y Lệnh</span>
          <div className="mt-2 flex items-baseline space-x-1.5">
            <span className="text-3xl font-black text-purple-600">{stats.waitingOrders}</span>
            <span className="text-xs text-purple-600/80">yêu cầu</span>
            {stats.waitingOrders > 0 && <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />}
          </div>
          <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-bold self-start mt-1">Cần bác sĩ ký duyệt</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">MAR Hôm Nay</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-3xl font-black text-blue-600">{stats.marRate}%</span>
            <span className="text-xs text-slate-400">hoàn thành</span>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold mt-1">Đã cấp phát đúng phác đồ</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)] hover:shadow-md transition-all flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chuẩn Bị Ra Viện</span>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-3xl font-black text-slate-800">{stats.dischargeReady}</span>
            <span className="text-xs text-slate-400">chờ duyệt</span>
          </div>
          <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold self-start mt-1">Đang hoàn tất thủ tục</span>
        </div>

      </div>

      {/* Clinical Alerts Panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)]">
        <div className="flex items-center space-x-2 text-slate-800 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-sm">Cảnh báo lâm sàng cần xử lý ngay</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          
          <button
            onClick={() => { setSelectedAlertFilter('high_alert'); setActiveTab('all'); }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              selectedAlertFilter === 'high_alert'
                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            <span>🔴 {stats.criticalAlerts} Bệnh nhân có cảnh báo nguy kịch</span>
          </button>

          <button
            onClick={() => { setSelectedAlertFilter('missed_mar'); setActiveTab('all'); }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              selectedAlertFilter === 'missed_mar'
                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>🟠 1 Y lệnh thuốc trễ liều (Missed MAR)</span>
          </button>

          <button
            onClick={() => { setSelectedState('waiting_cls'); setActiveTab('all'); setSelectedAlertFilter('all'); }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              selectedState === 'waiting_cls'
                ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>🟡 {stats.waitingCls} Cận lâm sàng đang chờ kết quả</span>
          </button>

          <button
            onClick={() => { setSelectedAlertFilter('allergy'); setActiveTab('all'); }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              selectedAlertFilter === 'allergy'
                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>🔴 2 Bệnh nhân có tiền sử dị ứng thuốc</span>
          </button>

          <button
            onClick={() => { setSelectedState('waiting_doctor'); setActiveTab('all'); setSelectedAlertFilter('all'); }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              selectedState === 'waiting_doctor'
                ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>🟣 {stats.waitingOrders} Bệnh án sắp đến hạn ký đánh giá y lệnh</span>
          </button>

          {(selectedAlertFilter !== 'all' || selectedState !== 'all') && (
            <button
              onClick={() => {
                setSelectedAlertFilter('all');
                setSelectedState('all');
                setActiveTab('all');
              }}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 px-2 py-1.5 transition-colors"
            >
              Đặt lại lọc
            </button>
          )}

        </div>
      </div>

      {/* Preset tabs and Advanced search filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        
        {/* Preset Tab Bar */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'treating', label: '🟢 Đang điều trị' },
            { id: 'has_alert', label: '🔴 Có cảnh báo' },
            { id: 'waiting_doctor', label: '🟣 Chờ bác sĩ' },
            { id: 'waiting_cls', label: '🟡 Chờ cận lâm sàng' },
            { id: 'preparing_discharge', label: '🔵 Chuẩn bị ra viện' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedAlertFilter('all');
                setSelectedState('all');
              }}
              className={`py-2.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm BN / MRN / Chẩn đoán..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <PremiumSelect
              value={selectedWard}
              onChange={(value) => setSelectedWard(value)}
              options={[
                { value: 'all', label: 'Tất cả Khoa điều trị', icon: <Building2 className="w-4 h-4" /> },
                ...wards.map((w) => ({
                  value: w.id,
                  label: w.name,
                  icon: <Building2 className="w-4 h-4" />
                }))
              ]}
              placeholder="Chọn khoa điều trị"
            />
          </div>

          <div>
            <PremiumSelect
              value={selectedState}
              onChange={(value) => setSelectedState(value)}
              options={[
                { value: 'all', label: 'Tất cả Trạng thái Lâm sàng', icon: <Activity className="w-4 h-4" /> },
                { value: 'treating', label: '🟢 Đang điều trị', icon: <Activity className="w-4 h-4" /> },
                { value: 'waiting_cls', label: '🟡 Chờ cận lâm sàng', icon: <Clock className="w-4 h-4" /> },
                { value: 'has_alert', label: '🔴 Có cảnh báo nguy hiểm', icon: <AlertTriangle className="w-4 h-4" /> },
                { value: 'waiting_doctor', label: '🟣 Chờ bác sĩ ký duyệt', icon: <User className="w-4 h-4" /> },
                { value: 'preparing_discharge', label: '🔵 Chuẩn bị ra viện', icon: <FileCheck className="w-4 h-4" /> }
              ]}
              placeholder="Chọn trạng thái"
            />
          </div>

          <div>
            <PremiumSelect
              value={selectedAlertFilter}
              onChange={(value) => setSelectedAlertFilter(value)}
              options={[
                { value: 'all', label: 'Mức độ ưu tiên / Cảnh báo', icon: <Filter className="w-4 h-4" /> },
                { value: 'high_alert', label: 'Độ ưu tiên cao (🔴 Alert)', icon: <AlertCircle className="w-4 h-4" /> },
                { value: 'missed_mar', label: 'MAR trễ liều (Missed dose)', icon: <Clock className="w-4 h-4" /> },
                { value: 'allergy', label: 'Có tiền sử dị ứng thuốc', icon: <FileWarning className="w-4 h-4" /> }
              ]}
              placeholder="Chọn cảnh báo"
            />
          </div>

        </div>

      </div>

      {/* Table Census Section (Full Width with strong shadow) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08),_0_5px_15px_rgba(0,0,0,0.02)] hover:shadow-xl transition-all duration-300 overflow-hidden">
        
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Stethoscope className="w-5 h-5 text-indigo-600" />
            <span>Bảng Điều Hành & Theo Dõi Điều Trị Nội Trú ({filteredAdmissions.length})</span>
          </h2>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">Real-time Command Center</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Đang tải dữ liệu lâm sàng y tế...</div>
        ) : filteredAdmissions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Không tìm thấy bệnh nhân nào khớp với bộ lọc điều hành.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Bệnh Nhân / MRN</th>
                  <th className="py-3 px-4">Khoa & Giường</th>
                  <th className="py-3 px-4">Chẩn Đoán ICD-10</th>
                  <th className="py-3 px-4">Clinical State</th>
                  <th className="py-3 px-4 text-center">Y Lệnh</th>
                  <th className="py-3 px-4 text-center">MAR Today</th>
                  <th className="py-3 px-4 text-center">CLS Pending</th>
                  <th className="py-3 px-4 text-center">Alert</th>
                  <th className="py-3 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredAdmissions.map((adm) => {
                  const bed = beds.find((b) => b.id === adm.bed_id);
                  const ward = wards.find((w) => w.id === adm.ward_id);

                  // Clinical state styling
                  let stateTag = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">🟢 Điều trị</span>;
                  if (adm.clinical_state === 'waiting_cls') {
                    stateTag = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">🟡 Chờ CLS</span>;
                  } else if (adm.clinical_state === 'has_alert') {
                    stateTag = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">🔴 Cảnh báo</span>;
                  } else if (adm.clinical_state === 'waiting_doctor') {
                    stateTag = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">🟣 Chờ BS</span>;
                  } else if (adm.clinical_state === 'preparing_discharge') {
                    stateTag = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">🔵 Chuẩn bị ra</span>;
                  }

                  return (
                    <tr
                      key={adm.id}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                        adm.clinical_state === 'has_alert' ? 'bg-rose-50/20' : ''
                      }`}
                      onClick={() => setSelectedPatientView(adm)}
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs flex items-center space-x-1 whitespace-nowrap">
                          <span>{adm.patient_name}</span>
                          <span className="text-[10px] font-normal text-slate-400">({adm.age}t, {adm.gender})</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {adm.id} | MRN: {adm.patient_id}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-700 text-[11px] truncate max-w-[220px]" title={ward?.name}>
                          {ward?.name || 'Khoa Nội'}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1 mt-0.5">
                          <BedIcon className="w-3 h-3 text-emerald-600" />
                          <span>{bed?.bed_code || adm.bed_id}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        {adm.admission_diagnosis.map((diag, i) => (
                          <div key={i} className="font-semibold text-slate-800 truncate max-w-[280px]" title={diag.icd10_name_vi}>
                            <span className="text-indigo-700">[{diag.icd10_code}]</span> {diag.icd10_name_vi}
                          </div>
                        ))}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {stateTag}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="font-bold text-slate-900">{adm.total_orders}</div>
                        {adm.pending_orders > 0 && (
                          <div className="text-[9px] text-purple-600 font-extrabold">{adm.pending_orders} chờ ký</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`font-bold text-[11px] ${adm.mar_missed > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {adm.mar_percentage}%
                          </span>
                          {adm.mar_missed > 0 ? (
                            <span className="text-[9px] text-rose-600 font-extrabold bg-rose-50 px-1 rounded">
                              {adm.mar_missed} missed
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400">
                              {adm.mar_administered}/{adm.mar_scheduled}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {adm.pending_cls > 0 ? (
                          <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full text-[10px]">
                            {adm.pending_cls} chờ
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {adm.alerts_count > 0 ? (
                          <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-extrabold flex items-center justify-center text-[10px] mx-auto animate-pulse">
                            {adm.alerts_count}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedPatientView(adm)}
                          className="inline-flex items-center space-x-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold"
                        >
                          <span>Mở</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Lower Section Timeline & Support Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Hoạt động lâm sàng */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.05)] p-5 hover:shadow-md transition-all duration-300">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Activity className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">Hoạt động lâm sàng gần nhất</h3>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { time: '16:00', icon: 'check', text: 'Bác sĩ Minh ký hoàn tất tóm tắt bệnh án cho BN Hoàng Văn Nam (adm-005).' },
              { time: '15:30', icon: 'alert', text: 'Sinh hiệu huyết áp của BN Trần Quốc Tuấn (adm-003) tăng bất thường: 145/95 mmHg.' },
              { time: '14:32', icon: 'vitals', text: 'Điều dưỡng Nguyễn Văn B cập nhật sinh hiệu SpO₂: 98% cho BN Nguyễn Văn Hoàng (adm-001).' },
              { time: '14:15', icon: 'order', text: 'Y lệnh Ceftriaxone IV được ký duyệt điện tử bởi BS. Nguyễn Văn Hùng.' },
              { time: '13:52', icon: 'lab', text: 'Khoa Cận lâm sàng (Lab) trả kết quả xét nghiệm tổng phân tích máu CBC cho BN Phạm Thị Mai.' },
              { time: '11:20', icon: 'admission', text: 'Tiếp nhận bệnh nhân Lê Thị Lan nhập viện điều trị nội trú tại Khoa Nhi giường PED-BED-01.' },
            ].map((act, index) => (
              <div key={index} className="flex items-start space-x-3 text-xs bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-indigo-600 font-mono pt-0.5">{act.time}</span>
                <div className="flex-1">
                  <p className="text-slate-700 leading-relaxed font-semibold">{act.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Activity Monitor info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.05)] p-5 flex flex-col justify-between hover:shadow-md transition-all duration-300">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800">Hệ thống Giám sát An toàn</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mt-3 font-semibold">
              Hệ thống tự động liên kết các bản ghi EMR (Bệnh án điện tử) và MAR (Phiếu phát thuốc) và monitor giường bệnh để cập nhật nhật ký lâm sàng trung tâm thời gian thực.
            </p>
            <div className="mt-3 space-y-1.5 text-[11px] text-slate-500 font-semibold">
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Đồng bộ 100% với Bed Engine & MPI</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Cơ chế kiểm duyệt xuất viện 7 bước an toàn</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 text-indigo-900 p-3 rounded-xl border border-indigo-100 text-xs mt-4">
            <span className="font-extrabold block mb-1">Clinical Safety v1.0</span>
            <p className="text-[11px] leading-normal font-semibold">
              Bella Hospital OS áp dụng các rào chắn an toàn (Guardrails) ngăn ngừa nhầm lẫn thuốc và vi phạm y lệnh.
            </p>
          </div>
        </div>

      </div>

      {/* Patient Quick View Drawer */}
      {selectedPatientView && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300">
          
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 transition-transform duration-300 transform translate-x-0 relative">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Hồ sơ xem nhanh</span>
                <h3 className="text-lg font-bold">{selectedPatientView.patient_name}</h3>
                <span className="text-xs text-slate-400">MRN: {selectedPatientView.patient_id} • Tuổi: {selectedPatientView.age} ({selectedPatientView.gender})</span>
              </div>
              <button
                onClick={() => setSelectedPatientView(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Critical Alert Warnings */}
              {selectedPatientView.allergies.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0 animate-pulse" />
                  <div>
                    <span className="font-extrabold block">Cảnh Báo Lâm Sàng: Dị Ứng</span>
                    <span className="font-semibold">{selectedPatientView.allergies.join(', ')}</span>
                  </div>
                </div>
              )}

              {/* Location & Diagnosis */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Đơn vị & Giường nằm:</span>
                  <span className="font-extrabold text-indigo-900">{selectedPatientView.attending_doctor_name}</span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {wards.find(w => w.id === selectedPatientView.ward_id)?.name || 'Khoa Nội'} — Giường {beds.find(b => b.id === selectedPatientView.bed_id)?.bed_code || selectedPatientView.bed_id}
                </div>
                
                <div className="pt-2.5 border-t border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Chẩn đoán chính nhập viện:</span>
                  <div className="text-xs font-bold text-slate-800 mt-1">
                    {selectedPatientView.admission_diagnosis.map((d, i) => (
                      <span key={i}><span className="text-indigo-600">[{d.icd10_code}]</span> {d.icd10_name_vi}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Vitals Signs Monitor Dashboard */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Theo dõi sinh hiệu (Vitals Signs)</h4>
                
                <div className="grid grid-cols-4 gap-2">
                  
                  <div className={`p-2 rounded-xl text-center border ${selectedPatientView.vitals.temp > 37.5 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[9px] font-bold text-slate-400 block">Nhiệt độ</span>
                    <span className="text-xs font-bold block mt-1">{selectedPatientView.vitals.temp}°C</span>
                  </div>

                  <div className={`p-2 rounded-xl text-center border ${selectedPatientView.vitals.hr > 90 ? 'bg-rose-50 border-rose-200 text-rose-900 font-extrabold' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[9px] font-bold text-slate-400 block">Nhịp tim</span>
                    <span className="text-xs font-bold block mt-1">{selectedPatientView.vitals.hr} bpm</span>
                  </div>

                  <div className={`p-2 rounded-xl text-center border ${selectedPatientView.vitals.systolic_bp > 140 ? 'bg-rose-50 border-rose-200 text-rose-900 font-extrabold' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[9px] font-bold text-slate-400 block">Huyết áp</span>
                    <span className="text-[10px] font-bold block mt-1">{selectedPatientView.vitals.systolic_bp}/{selectedPatientView.vitals.diastolic_bp}</span>
                  </div>

                  <div className={`p-2 rounded-xl text-center border ${selectedPatientView.vitals.spo2 < 96 ? 'bg-rose-50 border-rose-200 text-rose-900 font-extrabold' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[9px] font-bold text-slate-400 block">SpO₂</span>
                    <span className="text-xs font-bold block mt-1">{selectedPatientView.vitals.spo2}%</span>
                  </div>

                </div>
              </div>

              {/* Medication Administration (MAR Today) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Phiếu MAR ngày hôm nay</h4>
                  <span className="text-[10px] font-bold text-indigo-600">{selectedPatientView.mar_percentage}%</span>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${selectedPatientView.mar_percentage}%` }} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-slate-400 block text-[9px] font-bold">Chỉ định</span>
                      <span className="font-bold text-slate-800">{selectedPatientView.mar_scheduled} liều</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] font-bold">Đã cho uống</span>
                      <span className="font-bold text-emerald-700">{selectedPatientView.mar_administered} liều</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] font-bold">Trễ / Missed</span>
                      <span className={`font-bold ${selectedPatientView.mar_missed > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {selectedPatientView.mar_missed} liều
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Clinical Orders */}
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Y lệnh lâm sàng hoạt động</h4>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  <div className="p-3 bg-slate-50/50 flex justify-between items-center">
                    <span className="font-bold text-slate-700">Y lệnh thuốc bổ sung</span>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">Hoạt động</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-bold">Ceftriaxone IV 1g</span>
                      <span className="text-slate-500">Mỗi 12 tiếng</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Glucose 5% 500ml IV</span>
                      <span className="text-slate-500">Tốc độ 60 giọt/phút</span>
                    </div>
                    {selectedPatientView.clinical_state === 'waiting_doctor' && (
                      <div className="bg-purple-50 text-purple-700 p-2 rounded text-[10px] font-bold flex items-center justify-between">
                        <span>Loratadin 10mg (Chờ Bác sĩ duyệt)</span>
                        <span className="animate-pulse font-extrabold uppercase">Pending</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handlePrintDocument('admission', selectedPatientView)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Phiếu Nhập</span>
                </button>
                <button
                  onClick={() => handlePrintDocument('mar', selectedPatientView)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Phiếu MAR</span>
                </button>
              </div>

              {selectedPatientView.status === 'admitted' ? (
                <button
                  onClick={() => {
                    setSelectedPatientView(null);
                    startDischargeFlow(selectedPatientView);
                  }}
                  className="w-full flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg hover:shadow-indigo-950/30 transition-all"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Xét duyệt xuất viện nội trú</span>
                </button>
              ) : (
                <button
                  onClick={() => handlePrintDocument('discharge', selectedPatientView)}
                  className="w-full flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg hover:shadow-emerald-950/30 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>In giấy ra viện</span>
                </button>
              )}
            </div>

          </div>

        </div>
      )}

      {/* New Inpatient Admission Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <UserPlus className="w-6 h-6 text-emerald-600" />
              <span>Tiếp Nhận Bệnh Nhân Điều Trị Nội Trú</span>
            </h2>

            <form onSubmit={handleCreateAdmission} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Bệnh Nhân (Patient ID):</label>
                  <input
                    type="text"
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Lượt Khám (Encounter ID):</label>
                  <input
                    type="text"
                    required
                    value={encounterId}
                    onChange={(e) => setEncounterId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Khoa Điều Trị:</label>
                  <select
                    value={selectedWardId}
                    onChange={(e) => setSelectedWardId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Giường Trống:</label>
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50"
                  >
                    {availableBeds.length === 0 ? (
                      <option value="">Không có giường trống</option>
                    ) : (
                      availableBeds.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bed_code} ({b.bed_type.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Chẩn Đoán ICD-10:</label>
                  <input
                    type="text"
                    required
                    value={icd10Code}
                    onChange={(e) => setIcd10Code(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên Chẩn Đoán Tiếng Việt:</label>
                  <input
                    type="text"
                    required
                    value={icd10Name}
                    onChange={(e) => setIcd10Name(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-md"
                >
                  Xác Nhận Nhập Viện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discharge Safety Checklist Modal */}
      {selectedDischargeAdmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-indigo-200">
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                  <ShieldCheck className="w-6 h-6 text-indigo-600" />
                  <span>Quy Trình Kiểm Duyệt Xuất Viện (Discharge Safety Checklist)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Đợt điều trị: <strong>{selectedDischargeAdmission.id}</strong> | Bệnh nhân: <strong>{selectedDischargeAdmission.patient_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedDischargeAdmission(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Checklist Điều kiện bắt buộc</span>
              
              <div className="space-y-2.5 text-xs text-slate-700">
                
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeChecklist.diagnosisCompleted}
                    onChange={(e) => setDischargeChecklist({ ...dischargeChecklist, diagnosisCompleted: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">✓ Chẩn đoán ra viện & Ghi chú lâm sàng hoàn tất</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeChecklist.medicationReviewed}
                    onChange={(e) => setDischargeChecklist({ ...dischargeChecklist, medicationReviewed: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">✓ Rà soát sử dụng y lệnh thuốc & Xác nhận không có MAR trễ</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeChecklist.homePrescriptionReady}
                    onChange={(e) => setDischargeChecklist({ ...dischargeChecklist, homePrescriptionReady: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">✓ Đơn thuốc ra viện được bác sĩ điều trị duyệt cấp</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeChecklist.billingCleared}
                    onChange={(e) => setDischargeChecklist({ ...dischargeChecklist, billingCleared: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">✓ Viện phí nội trú đã tất toán thanh toán tại quầy tài chính</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeChecklist.insuranceVerified}
                    onChange={(e) => setDischargeChecklist({ ...dischargeChecklist, insuranceVerified: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">✓ Xác nhận bảo lãnh viện phí / Cổng giám định BHYT thành công</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeChecklist.summaryCompleted}
                    onChange={(e) => setDischargeChecklist({ ...dischargeChecklist, summaryCompleted: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">✓ Báo cáo tóm tắt quá trình bệnh án xuất viện hoàn tất</span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dischargeChecklist.doctorSigned}
                    onChange={(e) => setDischargeChecklist({ ...dischargeChecklist, doctorSigned: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-indigo-700">✓ Bác sĩ Trưởng khoa/Bác sĩ điều trị ký số xác nhận duyệt ra viện</span>
                </label>

              </div>
            </div>

            <form onSubmit={handleConfirmDischarge} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tóm Tắt Tổng Kết Xuất Viện (Discharge Summary):</label>
                <textarea
                  required
                  rows={3}
                  value={dischargeSummary}
                  onChange={(e) => setDischargeSummary(e.target.value)}
                  placeholder="Ghi rõ tình trạng sức khỏe khi xuất viện, lời dặn bác sĩ, hẹn tái khám..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {!allDischargeChecklistChecked && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] p-2.5 rounded-lg font-bold">
                  ⚠️ Cảnh báo: Vui lòng kiểm tra và xác nhận hoàn tất đầy đủ 7 đầu mục an toàn lâm sàng và hành chính trước khi duyệt ra viện.
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDischargeAdmission(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!allDischargeChecklistChecked}
                  className={`px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-md transition-all ${
                    allDischargeChecklistChecked
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  Phê Duyệt Xuất Viện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
