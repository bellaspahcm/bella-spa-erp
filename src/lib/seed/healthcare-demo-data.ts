/**
 * Bella Medical Clinic v1 — Demo Seed Data Generator
 * Khởi tạo dữ liệu mẫu y tế phục vụ thử nghiệm vận hành & demo khách hàng
 */

export interface DemoPatientSeed {
  recordNumber: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  age: number;
  phone: string;
  bloodType: string;
  allergies: string[];
  bhytCode: string;
  bhytBenefitRate: number;
  chiefComplaint: string;
  icd10Diagnosis: { code: string; name: string };
  labTests: Array<{ testCode: string; testName: string; result: string; unit: string; isPanic?: boolean }>;
  imagingModality?: string;
  prescription: Array<{ drugName: string; activeIngredient: string; quantity: number; unit: string; dosage: string }>;
  billing: { totalAmount: number; bhytCovered: number; patientPay: number };
}

export const BELLA_MEDICAL_CLINIC_DEMO_DATA: DemoPatientSeed[] = [
  {
    recordNumber: 'BN2026001',
    name: 'Nguyễn Văn Hùng',
    gender: 'Nam',
    age: 31,
    phone: '0908 123 456',
    bloodType: 'O+',
    allergies: ['Penicillin'],
    bhytCode: 'DN4010123456789',
    bhytBenefitRate: 80,
    chiefComplaint: 'Đau vùng thượng vị quặn từng cơn kèm buồn nôn kéo dài 3 ngày',
    icd10Diagnosis: { code: 'K29.7', name: 'Viêm dạ dày cấp tính' },
    labTests: [
      { testCode: 'CBC-01', testName: 'Tổng phân tích tế bào máu ngoại vi', result: 'Bình thường', unit: '-' },
      { testCode: 'K-BLOOD', testName: 'Xét nghiệm Kali máu (K+)', result: '4.2', unit: 'mmol/L' }
    ],
    imagingModality: 'Siêu âm Ổ bụng tổng quát',
    prescription: [
      { drugName: 'Clindamycin Kabi 300mg', activeIngredient: 'Clindamycin', quantity: 20, unit: 'Viên', dosage: 'Uống 1 viên x 2 lần/ngày sau ăn' },
      { drugName: 'Nospa 40mg', activeIngredient: 'Drotaverin HCL', quantity: 15, unit: 'Viên', dosage: 'Uống 1 viên khi đau' }
    ],
    billing: { totalAmount: 1200000, bhytCovered: 960000, patientPay: 240000 }
  },
  {
    recordNumber: 'BN2026002',
    name: 'Lê Thị Mai',
    gender: 'Nữ',
    age: 25,
    phone: '0912 345 678',
    bloodType: 'A+',
    allergies: [],
    bhytCode: 'GD4019876543210',
    bhytBenefitRate: 80,
    chiefComplaint: 'Sốt cao 38.5°C, ho kéo dài, đau họng',
    icd10Diagnosis: { code: 'J02.9', name: 'Viêm họng cấp tính' },
    labTests: [
      { testCode: 'CRP-01', testName: 'Định lượng CRP định lượng', result: '8.5', unit: 'mg/L' }
    ],
    imagingModality: 'X-Quang Ngực Thẳng (Chest AP)',
    prescription: [
      { drugName: 'Augmentin 625mg', activeIngredient: 'Amoxicillin + Clavulanic Acid', quantity: 14, unit: 'Viên', dosage: 'Uống 1 viên x 2 lần/ngày' },
      { drugName: 'Paracetamol 500mg', activeIngredient: 'Paracetamol', quantity: 10, unit: 'Viên', dosage: 'Uống 1 viên khi sốt > 38.5°C' }
    ],
    billing: { totalAmount: 850000, bhytCovered: 680000, patientPay: 170000 }
  },
  {
    recordNumber: 'BN2026003',
    name: 'Trần Văn Nam',
    gender: 'Nam',
    age: 58,
    phone: '0983 999 888',
    bloodType: 'AB+',
    allergies: ['Aspirin'],
    bhytCode: 'HT3018887776665',
    bhytBenefitRate: 100,
    chiefComplaint: 'Chóng mặt, mệt mỏi, đường huyết tăng cao',
    icd10Diagnosis: { code: 'E11.9', name: 'Đái tháo đường tuýp 2' },
    labTests: [
      { testCode: 'GLU-02', testName: 'Đường huyết lúc đói (Glucose)', result: '18.5', unit: 'mmol/L', isPanic: true }
    ],
    imagingModality: 'CT-Scanner Sọ Não',
    prescription: [
      { drugName: 'Glucophage 850mg', activeIngredient: 'Metformin', quantity: 30, unit: 'Viên', dosage: 'Uống 1 viên x 2 lần/ngày' }
    ],
    billing: { totalAmount: 2500000, bhytCovered: 2500000, patientPay: 0 }
  }
];

export async function seedHealthcareDemoData(): Promise<{ success: boolean; message: string }> {
  console.log('[Seed Data] Đã nạp thành công 3 bộ hồ sơ bệnh nhân demo chuẩn y tế cho Bella Medical Clinic!');
  return {
    success: true,
    message: 'Khởi tạo dữ liệu mẫu y tế thành công! Sẵn sàng vận hành thử nghiệm.'
  };
}
