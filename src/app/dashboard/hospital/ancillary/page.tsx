'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LabOrderItem, ImagingOrderItem } from '@/types/healthcare';
import { PatientContextBar, BELLA_DEMO_PATIENT } from '@/components/hospital/PatientContextBar';
import {
  getLabOrdersAction,
  verifyLabResultAction,
  createLabOrdersAction,
  createImagingOrderAction,
  updateImagingReportAction,
} from '@/services/healthcare/lis-ris-actions';
import {
  ClipboardList,
  Activity,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  Sun,
  Contrast,
  Undo2,
  Check,
  User,
  FlaskConical,
  FileText,
  Sparkles,
  Scan,
  ZoomIn,
  RotateCw,
  FlipHorizontal2,
  Maximize2,
  Ruler,
  Layers,
  ChevronRight,
  Shield,
  Brain,
  PenLine,
  CheckSquare,
} from 'lucide-react';


type LabVerifyStatus = 'pending' | 'verified' | 'panic_notified';
type ReportStatus = 'draft' | 'preliminary' | 'final' | 'amended';

interface ExtendedLabOrder extends LabOrderItem {
  ordered_at?: string;
  ordered_by?: string;
  verified_at?: string;
  verified_by?: string;
  verify_status?: LabVerifyStatus;
  clinical_interpretation?: string;
}

interface StudyItem {
  uid: string;
  date: string;
  modality: 'XRAY' | 'CT' | 'MRI' | 'US';
  description: string;
  series: { name: string; count: number }[];
  imageUrl: string;
  status: 'available' | 'pending';
}

interface PACSReport {
  studyUid: string;
  clinicalIndication: string;
  technique: string;
  findings: string;
  impression: string;
  status: ReportStatus;
  signedBy?: string;
  signedAt?: string;
}

const MOCK_STUDIES: StudyItem[] = [
  {
    uid: 'acc-9872',
    date: '08/08/2026',
    modality: 'XRAY',
    description: 'Chest X-Ray PA',
    series: [{ name: 'PA View', count: 1 }, { name: 'Lateral', count: 1 }],
    imageUrl: '/chest_xray.png',
    status: 'available',
  },
  {
    uid: 'acc-9841',
    date: '07/08/2026',
    modality: 'CT',
    description: 'CT Chest with Contrast',
    series: [{ name: 'Scout', count: 1 }, { name: 'Axial', count: 180 }, { name: 'Coronal', count: 60 }],
    imageUrl: '/ct_chest.png',
    status: 'available',
  },
  {
    uid: 'acc-9801',
    date: '03/08/2026',
    modality: 'XRAY',
    description: 'Chest X-Ray (Baseline)',
    series: [{ name: 'PA View', count: 1 }],
    imageUrl: '/chest_xray.png',
    status: 'available',
  },
];

const INITIAL_REPORTS: Record<string, PACSReport> = {
  'acc-9872': {
    studyUid: 'acc-9872',
    clinicalIndication: 'Ho khan, sốt 38.9°C, SpO₂ 91% — bệnh nhân ICU, tiền sử suy hô hấp cấp.',
    technique: 'Chest X-Ray PA view, portable. Thực hiện tại khoa ICU lúc 20:30.',
    findings: 'Hình ảnh thâm nhiễm dạng đốm hai bên thùy dưới phổi, rõ bên phải. Góc sườn hoành hai bên có tràn dịch màng phổi lượng nhỏ. Bóng tim không to (CTR 0.45). Trachea thẳng giữa. Xương sườn và cấu trúc xương không có tổn thương.',
    impression: 'Nghĩ viêm phổi cả hai bên. Tràn dịch màng phổi hai bên lượng nhỏ. Đề nghị theo dõi lâm sàng và điều trị kháng sinh phổ rộng.',
    status: 'preliminary',
    signedBy: undefined,
    signedAt: undefined,
  },
  'acc-9841': {
    studyUid: 'acc-9841',
    clinicalIndication: 'Đánh giá tiến triển viêm phổi, loại trừ áp xe phổi.',
    technique: 'CT Ngực có cản quang, 1mm slice. Thực hiện tại phòng CT lúc 08:45.',
    findings: '',
    impression: '',
    status: 'draft',
  },
};


const now = Date.now();

const MOCK_LAB_ORDERS: ExtendedLabOrder[] = [
  {
    id: 'lab-001', order_id: 'ord-101',
    test_code: 'GLU', test_name: 'Glucose (Đường Huyết)',
    sample_type: 'Máu tĩnh mạch', tube_color: 'Xám',
    result_value: '14.2', result_unit: 'mmol/L', reference_range: '3.9 - 6.4',
    is_abnormal: true, is_panic_value: false,
    ordered_at: new Date(now - 3 * 60 * 60000).toISOString(),
    ordered_by: 'BS.CKII Phạm Quốc Việt',
    verify_status: 'verified', verified_at: new Date(now - 2 * 60 * 60000).toISOString(),
    verified_by: 'KTV Nguyễn Quốc Bảo',
    clinical_interpretation: 'CAO — Tăng đường huyết mức độ cao, cần điều chỉnh Insulin.',
  },
  {
    id: 'lab-002', order_id: 'ord-101',
    test_code: 'CREA', test_name: 'Creatinine (Chức Năng Thận)',
    sample_type: 'Máu tĩnh mạch', tube_color: 'Đỏ',
    result_value: '312', result_unit: 'umol/L', reference_range: '62 - 115',
    is_abnormal: true, is_panic_value: true,
    ordered_at: new Date(now - 3 * 60 * 60000).toISOString(),
    ordered_by: 'BS.CKII Phạm Quốc Việt',
    verify_status: 'panic_notified', verified_at: new Date(now - 2.5 * 60 * 60000).toISOString(),
    verified_by: 'KTV Nguyễn Quốc Bảo',
    clinical_interpretation: '🔴 NGUY KỊCH — Suy thận cấp. Đã báo bác sĩ điều trị ngay.',
  },
  {
    id: 'lab-003', order_id: 'ord-101',
    test_code: 'WBC', test_name: 'Bạch Cầu (WBC)',
    sample_type: 'Máu toàn phần', tube_color: 'Tím',
    result_value: '13.8', result_unit: 'G/L', reference_range: '4.0 - 10.0',
    is_abnormal: true, is_panic_value: false,
    ordered_at: new Date(now - 3 * 60 * 60000).toISOString(),
    ordered_by: 'BS.CKII Phạm Quốc Việt',
    verify_status: 'verified', verified_at: new Date(now - 2 * 60 * 60000).toISOString(),
    verified_by: 'KTV Nguyễn Quốc Bảo',
    clinical_interpretation: 'CAO — Tăng bạch cầu, nghĩ nhiễm trùng tiến triển.',
  },
  {
    id: 'lab-004', order_id: 'ord-101',
    test_code: 'HGB', test_name: 'Hemoglobin (Huyết Sắc Tố)',
    sample_type: 'Máu toàn phần', tube_color: 'Tím',
    result_value: '9.2', result_unit: 'g/dL', reference_range: '12.0 - 16.0',
    is_abnormal: true, is_panic_value: false,
    ordered_at: new Date(now - 3 * 60 * 60000).toISOString(),
    ordered_by: 'BS.CKII Phạm Quốc Việt',
    verify_status: 'verified', verified_at: new Date(now - 2 * 60 * 60000).toISOString(),
    verified_by: 'KTV Nguyễn Quốc Bảo',
    clinical_interpretation: 'THẤP — Thiếu máu mức độ trung bình.',
  },
  {
    id: 'lab-005', order_id: 'ord-101',
    test_code: 'K+', test_name: 'Kali Máu (Potassium)',
    sample_type: 'Máu tĩnh mạch', tube_color: 'Vàng',
    result_value: '3.1', result_unit: 'mEq/L', reference_range: '3.5 - 5.0',
    is_abnormal: true, is_panic_value: false,
    ordered_at: new Date(now - 3 * 60 * 60000).toISOString(),
    ordered_by: 'BS.CKII Phạm Quốc Việt',
    verify_status: 'verified', verified_at: new Date(now - 1.5 * 60 * 60000).toISOString(),
    verified_by: 'KTV Nguyễn Quốc Bảo',
    clinical_interpretation: 'THẤP — Hạ kali máu. Đây là lý do Furosemide đang tạm ngưng (MAR).',
  },
  {
    id: 'lab-006', order_id: 'ord-101',
    test_code: 'Na+', test_name: 'Natri Máu (Sodium)',
    sample_type: 'Máu tĩnh mạch', tube_color: 'Vàng',
    result_value: '138', result_unit: 'mEq/L', reference_range: '135 - 145',
    is_abnormal: false, is_panic_value: false,
    ordered_at: new Date(now - 3 * 60 * 60000).toISOString(),
    ordered_by: 'BS.CKII Phạm Quốc Việt',
    verify_status: 'verified', verified_at: new Date(now - 1.5 * 60 * 60000).toISOString(),
    verified_by: 'KTV Nguyễn Quốc Bảo',
    clinical_interpretation: 'BÌNH THƯỜNG.',
  },
  {
    id: 'lab-007', order_id: 'ord-102',
    test_code: 'CRP', test_name: 'C-Reactive Protein (Viêm)',
    sample_type: 'Máu tĩnh mạch', tube_color: 'Đỏ',
    result_value: '', result_unit: 'mg/L', reference_range: '< 5.0',
    is_abnormal: false, is_panic_value: false,
    ordered_at: new Date(now - 30 * 60000).toISOString(),
    ordered_by: 'BS. Nguyễn Thu Hà',
    verify_status: 'pending',
    clinical_interpretation: undefined,
  },
  {
    id: 'lab-008', order_id: 'ord-102',
    test_code: 'PCT', test_name: 'Procalcitonin (Nhiễm Khuẩn)',
    sample_type: 'Máu tĩnh mạch', tube_color: 'Đỏ',
    result_value: '', result_unit: 'ng/mL', reference_range: '< 0.5',
    is_abnormal: false, is_panic_value: false,
    ordered_at: new Date(now - 30 * 60000).toISOString(),
    ordered_by: 'BS. Nguyễn Thu Hà',
    verify_status: 'pending',
    clinical_interpretation: undefined,
  },
];

const MOCK_IMAGING_ORDERS: ImagingOrderItem[] = [
  {
    id: 'img-001', order_id: 'ord-103',
    modality: 'XRAY',
    body_site: 'Lồng Ngực — Chest X-Ray PA',
    dcm_study_uid: '1.2.840.113619.2.134568',
    viewer_link: '#',
    radiologist_report: 'Hình ảnh thâm nhiễm đốm nhỏ lan toả hai phổi, nổi bật thuỳ dưới phổi phải. Rãnh liên thuỳ mờ nhẹ. Tim không to. Góc sườn hoành hai bên bình thường. Kết luận: Nghĩ viêm phổi tiến triển hai bên, cần theo dõi và điều trị kháng sinh phổ rộng.',
    radiologist_id: 'doc-radiologist-01',
  },
  {
    id: 'img-002', order_id: 'ord-104',
    modality: 'CT',
    body_site: 'Bụng — CT Scan Ổ Bụng Có Thuốc Cản Quang',
    dcm_study_uid: '1.2.840.113619.2.134569',
    viewer_link: '#',
    radiologist_report: '',
    radiologist_id: 'doc-radiologist-01',
  },
];

function AncillaryPageInner() {
  const searchParams = useSearchParams();
  const [labOrders, setLabOrders] = useState<ExtendedLabOrder[]>(MOCK_LAB_ORDERS);
  const [imagingOrders, setImagingOrders] = useState<ImagingOrderItem[]>(MOCK_IMAGING_ORDERS);
  // Read initial tab from URL query param (?tab=lis or ?tab=ris)
  const [activeTab, setActiveTab] = useState<'lis' | 'ris'>(() => {
    return 'lis'; // SSR-safe default; will be synced in useEffect
  });

  // Sync tab whenever URL ?tab param changes (sidebar navigation)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'ris') {
      setActiveTab('ris');
    } else {
      setActiveTab('lis');
    }
  }, [searchParams]);

  // DICOM Viewer state
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [invert, setInvert] = useState<boolean>(false);

  // Diagnosis feedback
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [activeStudyUid, setActiveStudyUid] = useState<string>('acc-9872');
  const [pacsReports, setPacsReports] = useState<Record<string, PACSReport>>(INITIAL_REPORTS);
  const [showAiOverlay, setShowAiOverlay] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<string>('pan');
  const [ctSlice, setCtSlice] = useState<number>(42);
  const [zoom, setZoom] = useState<number>(100);

  // Derived: active study object
  const activeStudy = MOCK_STUDIES.find((s) => s.uid === activeStudyUid) ?? MOCK_STUDIES[0];

  const handleUpdateLabResult = (id: string, value: string) => {
    setLabOrders((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const numValue = parseFloat(value);
          let isAbnormal = false;
          let isPanic = false;
          let interp = '';

          if (item.test_code === 'GLU') {
            isAbnormal = numValue < 3.9 || numValue > 6.4;
            isPanic = numValue < 2.5 || numValue > 25.0;
            interp = isPanic ? '🔴 NGUY KỊCH — Hạ/tăng đường huyết nghiêm trọng' : isAbnormal ? (numValue > 6.4 ? 'CAO — Tăng đường huyết' : 'THẤP — Hạ đường huyết') : 'BÌNH THƯỜNG';
          } else if (item.test_code === 'CREA') {
            isAbnormal = numValue < 62 || numValue > 115;
            isPanic = numValue > 500;
            interp = isPanic ? '🔴 NGUY KỊCH — Suy thận cấp, báo bác sĩ ngay' : isAbnormal ? 'CAO — Chức năng thận suy giảm' : 'BÌNH THƯỜNG';
          } else if (item.test_code === 'WBC') {
            isAbnormal = numValue < 4.0 || numValue > 10.0;
            isPanic = numValue < 1.0 || numValue > 30.0;
            interp = isPanic ? '🔴 NGUY KỊCH — Nhiễm trùng nặng / suy tuỷ' : isAbnormal ? (numValue > 10 ? 'CAO — Nhiễm trùng tiến triển' : 'THẤP — Giảm bạch cầu') : 'BÌNH THƯỜNG';
          } else if (item.test_code === 'K+') {
            isAbnormal = numValue < 3.5 || numValue > 5.0;
            isPanic = numValue < 2.5 || numValue > 6.5;
            interp = isPanic ? '🔴 NGUY KỊCH — Kali nguy hiểm, nguy cơ rối loạn nhịp tim' : isAbnormal ? (numValue < 3.5 ? 'THẤP — Hạ kali máu' : 'CAO — Tăng kali máu') : 'BÌNH THƯỜNG';
          } else if (item.test_code === 'CRP') {
            isAbnormal = numValue >= 5.0;
            isPanic = numValue > 100;
            interp = isPanic ? '🔴 NGUY KỊCH — Viêm hệ thống nặng / nhiễm trùng huyết' : isAbnormal ? 'CAO — Phản ứng viêm tiến triển' : 'BÌNH THƯỜNG';
          } else if (item.test_code === 'PCT') {
            isAbnormal = numValue >= 0.5;
            isPanic = numValue > 10;
            interp = isPanic ? '🔴 NGUY KỊCH — Nhiễm khuẩn huyết nguy hiểm' : isAbnormal ? 'CAO — Nhiễm khuẩn tiến triển, cần kháng sinh mạnh' : 'BÌNH THƯỜNG';
          } else {
            interp = isAbnormal ? 'Bất thường' : 'Bình thường';
          }

          return {
            ...item,
            result_value: value,
            is_abnormal: isAbnormal,
            is_panic_value: isPanic,
            verify_status: 'pending' as LabVerifyStatus,
            clinical_interpretation: interp,
          };
        }
        return item;
      })
    );
  };

  const handleVerifyLab = async (item: ExtendedLabOrder) => {
    if (!item.result_value) {
      alert('Vui lòng nhập giá trị xét nghiệm trước khi duyệt!');
      return;
    }

    try {
      await verifyLabResultAction({
        labOrderId: item.id,
        resultValue: item.result_value,
        resultUnit: item.result_unit,
        referenceRange: item.reference_range,
        isAbnormal: item.is_abnormal,
        isPanicValue: item.is_panic_value,
        verifiedBy: 'usr-tech-01',
      });
    } catch {
      // Fallback to optimistic
    }

    // Optimistic UI — mark verified
    setLabOrders((prev) => prev.map((o) =>
      o.id === item.id
        ? { ...o, verify_status: item.is_panic_value ? 'panic_notified' : 'verified', verified_at: new Date().toISOString(), verified_by: 'KTV Nguyễn Quốc Bảo' }
        : o
    ));

    if (item.is_panic_value) {
      speakPanicAlert(item.test_name, item.result_value, item.result_unit || '');
    }
  };

  const speakPanicAlert = (testName: string, value: string, unit: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const text = `Cảnh báo giá trị nguy kịch. Xét nghiệm ${testName} đạt ngưỡng ${value} ${unit}. Yêu cầu cấp báo bác sĩ điều trị.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSaveImagingReport = async (item: ImagingOrderItem) => {
    if (!item.radiologist_report) {
      alert('Vui lòng nhập kết luận chẩn đoán hình ảnh trước khi lưu!');
      return;
    }

    try {
      await updateImagingReportAction({
        imagingOrderId: item.id,
        radiologistReport: item.radiologist_report,
        radiologistId: 'usr-radio-01',
      });
      alert('Đã lưu và duyệt báo cáo chẩn đoán hình ảnh thành công.');
    } catch {
      // Fallback
    }
  };

  const runAiLabAnalysis = () => {
    const feedbackParts = labOrders.map((l) => {
      if (!l.result_value) return `${l.test_name}: Chưa có kết quả.`;
      const status = l.is_panic_value
        ? '🔴 NGUY KỊCH'
        : l.is_abnormal
        ? '🟡 BẤT THƯỜNG'
        : '🟢 BÌNH THƯỜNG';
      return `${l.test_name}: ${l.result_value} ${l.result_unit} (${status})`;
    });

    setAiFeedback(
      `[AI Clinical Co-pilot]:\n` +
      feedbackParts.join('\n') +
      `\n\nKhuyến nghị lâm sàng: ` +
      (labOrders.some((l) => l.is_panic_value)
        ? `Phát hiện chỉ số nguy kịch. Cần lập tức thực hiện Break-Glass mở EMR khẩn cấp để tra cứu tiền sử bệnh lý và hội chẩn gấp.`
        : labOrders.some((l) => l.is_abnormal)
        ? `Phát hiện chỉ số nằm ngoài khoảng tham chiếu. Khuyến nghị theo dõi sát các triệu chứng lâm sàng và chỉ định thêm y lệnh chẩn đoán hình ảnh phổi.`
        : `Các chỉ số sinh hóa nằm trong ngưỡng an toàn. Tiếp tục theo dõi phác đồ hiện tại.`)
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-cyan-950 via-slate-900 to-indigo-950 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-cyan-500/20">
        {/* Background decorative objects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-300 mb-2">
              <FlaskConical className="w-5 h-5 animate-pulse text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-200">
                Bella Hospital Ancillary • LIS & RIS/PACS Integration Portal
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold font-serif tracking-tight text-white drop-shadow-sm" style={{ color: '#ffffff' }}>
              Trung Tâm Cận Lâm Sàng & Hình Ảnh PACS
            </h1>
            <p className="text-sm mt-2 font-medium max-w-3xl text-cyan-100/90 leading-relaxed">
              Hệ thống quản lý kết quả xét nghiệm sinh hóa LIS, duyệt báo cáo hình ảnh RIS và mô phỏng PACS DICOM Web Viewer.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 rounded-xl gap-2 max-w-fit">
        <button
          onClick={() => setActiveTab('lis')}
          className={`py-2.5 px-5 text-sm font-bold flex items-center space-x-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'lis'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FlaskConical className="w-4.5 h-4.5" />
          <span>LIS (Phòng Xét Nghiệm)</span>
        </button>
        <button
          onClick={() => setActiveTab('ris')}
          className={`py-2.5 px-5 text-sm font-bold flex items-center space-x-2 rounded-lg transition-all cursor-pointer ${
            activeTab === 'ris'
              ? 'bg-indigo-650 text-white shadow'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Scan className="w-4.5 h-4.5" />
          <span>RIS / PACS DICOM (Chẩn Đoán Hình Ảnh)</span>
        </button>
      </div>

      {/* ── PERSISTENT PATIENT CONTEXT BAR ────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-y from-indigo-500 to-purple-500" />
        <div className="flex flex-wrap items-center gap-5 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow">
              L
            </div>
            <div>
              <div className="font-extrabold text-slate-905 text-sm leading-tight">Lê Thị Hương</div>
              <div className="text-xs font-bold text-slate-700 mt-1">Nữ · 62t · MRN: <span className="font-mono">pat-001</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <span className="text-xs font-bold text-indigo-805 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full shadow-sm">🛏 ICU-BED-01</span>
            <span className="text-xs font-bold text-slate-805 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">Hồi sức Tích cực (ICU)</span>
            <span className="text-xs font-bold text-teal-805 bg-teal-50 border border-teal-250 px-3 py-1.5 rounded-full shadow-sm">📅 Ngày điều trị 5</span>
            <span className="text-xs font-extrabold text-rose-905 bg-rose-50 border border-rose-300 px-3 py-1.5 rounded-full shadow-sm">⚠ Dị ứng: Penicillin, Sulfonamides</span>
          </div>
          <div className="text-xs text-slate-700 font-semibold italic">Persistent Patient Context · All clinical workspaces</div>
        </div>
      </div>

      {activeTab === 'lis' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LIS Order List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4.5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-extrabold text-slate-800 flex items-center space-x-2 text-sm uppercase tracking-wide">
                  <ClipboardList className="w-5 h-5 text-indigo-650" />
                  <span>Y Lệnh Xét Nghiệm Sinh Hóa Cần Nhập Kết Quả</span>
                </h3>
              </div>

              <div className="p-4.5 space-y-3.5 bg-slate-50/20">
                {labOrders.map((item) => {
                  const ext = item as ExtendedLabOrder;
                  const isVerified = ext.verify_status === 'verified' || ext.verify_status === 'panic_notified';
                  const isPending = !ext.verify_status || ext.verify_status === 'pending';
                  return (
                    <div key={item.id} className={`p-4 rounded-xl border shadow-sm transition-all ${
                      item.is_panic_value ? 'bg-rose-50/70 border-rose-300 border-2 relative overflow-hidden' :
                      item.is_abnormal ? 'bg-amber-50/60 border-amber-250' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}>
                      {item.is_panic_value && <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-indigo-800 text-sm">[{item.test_code}]</span>
                            <span className="font-bold text-slate-800 text-sm">{item.test_name}</span>
                            {item.is_panic_value && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white animate-pulse uppercase tracking-wider">
                                🔴 NGUY KỊCH
                              </span>
                            )}
                            {item.is_abnormal && !item.is_panic_value && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                                🟡 BẤT THƯỜNG
                              </span>
                            )}
                            {isVerified && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-250 uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã duyệt
                              </span>
                            )}
                            {isPending && item.result_value && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider animate-pulse">
                                Chờ duyệt
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-700 font-semibold leading-relaxed">
                            Mẫu: <span className="text-slate-905 font-bold">{item.sample_type}</span> · Ống: <strong className="text-slate-905 font-bold">{item.tube_color}</strong> · Tham chiếu: <strong className="text-slate-905 font-bold">{item.reference_range} {item.result_unit}</strong>
                            {ext.ordered_by && <span> · BS chỉ định: <strong className="text-slate-905 font-bold">{ext.ordered_by}</strong></span>}
                          </div>
                          {/* Clinical Interpretation — clearly separated from AI */}
                          {ext.clinical_interpretation && isVerified && (
                            <div className={`text-xs font-bold px-3 py-1.5 rounded border inline-block mt-2 shadow-sm ${
                              item.is_panic_value ? 'bg-rose-100 text-rose-900 border-rose-300' :
                              item.is_abnormal ? 'bg-amber-100 text-amber-900 border-amber-250' :
                              'bg-emerald-50 text-emerald-900 border-emerald-250'
                            }`}>
                              🔬 Kết quả lâm sàng: {ext.clinical_interpretation}
                            </div>
                          )}
                          {isVerified && ext.verified_by && (
                            <div className="text-[10px] text-slate-700 font-semibold mt-1">
                              Duyệt lúc {ext.verified_at ? new Date(ext.verified_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--'} bởi {ext.verified_by}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
                          {isVerified ? (
                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200/80 shadow-sm">
                              <span className={`text-xl font-black tracking-tight ${
                                item.is_panic_value ? 'text-rose-900' : item.is_abnormal ? 'text-amber-900' : 'text-emerald-900'
                              }`}>{item.result_value}</span>
                              <span className="text-xs text-slate-700 font-bold">{item.result_unit}</span>
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="number"
                                placeholder="Nhập KQ"
                                value={item.result_value}
                                onChange={(e) => handleUpdateLabResult(item.id, e.target.value)}
                                className={`pl-3 pr-14 py-2 w-32 border rounded-lg text-sm focus:outline-none focus:ring-2 font-bold ${
                                  item.is_panic_value ? 'border-rose-450 bg-rose-50 focus:ring-rose-500 text-rose-950' :
                                  item.is_abnormal ? 'border-amber-350 bg-amber-50 focus:ring-amber-500 text-amber-955' :
                                  'border-slate-350 focus:ring-indigo-500 text-slate-900 bg-white'
                                }`}
                              />
                              <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-700">{item.result_unit}</span>
                            </div>
                          )}

                          {!isVerified && (
                            <button
                              onClick={() => handleVerifyLab(item as ExtendedLabOrder)}
                              disabled={!item.result_value}
                              className={`p-2.5 rounded-lg transition-all text-white shadow-md cursor-pointer ${
                                item.result_value ? 'bg-emerald-650 hover:bg-emerald-700 hover:shadow-lg' : 'bg-slate-300 cursor-not-allowed'
                              }`}
                              title="Duyệt kết quả"
                            >
                              <Check className="w-4.5 h-4.5 font-bold" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI Clinical Panel */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-xl p-6 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center space-x-2 text-cyan-300 mb-3.5">
                <Sparkles className="w-5.5 h-5.5 animate-pulse text-cyan-405" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">AI Clinical Co-pilot Diagnostic</h3>
              </div>
              <p className="text-xs text-slate-300 mb-5 leading-relaxed font-semibold">
                Hệ thống AI tự động phân tích dữ liệu sinh hóa, phát hiện chỉ số bất thường nguy kịch và đề xuất khuyến nghị y khoa theo phác đồ.
              </p>

              <button
                onClick={runAiLabAnalysis}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md hover:shadow-lg cursor-pointer uppercase tracking-wider"
              >
                Chạy Phân Tích Chỉ Số AI
              </button>

              {aiFeedback && (
                <div className="mt-5 p-4 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold font-mono text-cyan-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {aiFeedback}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ─────────────────────────────────────────────────────────────────
        // PACS / RIS — 4-Zone Professional Radiology Workstation
        // Zone 1 (left): Study/Series List
        // Zone 2 (center): DICOM Viewer
        // Zone 3 (right): Radiology Report
        // Zone 4 (bottom): Toolbar + Controls
        // ─────────────────────────────────────────────────────────────────
        <div className="space-y-4">

          {/* ── ZONE: STUDY/SERIES/VIEWER/REPORT ─────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_360px] gap-5 h-[720px]">

            {/* ── ZONE 1: Study List (left) ────────────────────────────── */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-800">
                <div className="text-[10px] font-black text-slate-405 uppercase tracking-widest">Studies Worklist</div>
                <div className="text-[10px] text-slate-700 font-bold mt-1">MRN: pat-001 · 3 studies available</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {MOCK_STUDIES.map((study) => {
                  const isActive = study.uid === activeStudyUid;
                  const modalityColor: Record<string, string> = {
                    XRAY: 'text-cyan-400 drop-shadow-[0_0_2px_rgba(34,211,238,0.3)]',
                    CT: 'text-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.3)]',
                    MRI: 'text-violet-400 drop-shadow-[0_0_2px_rgba(167,139,250,0.3)]',
                    US: 'text-emerald-400 drop-shadow-[0_0_2px_rgba(52,211,153,0.3)]',
                  };
                  return (
                    <button
                      key={study.uid}
                      onClick={() => setActiveStudyUid(study.uid)}
                      className={`w-full text-left rounded-xl p-3 transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-indigo-900/30 border-indigo-500/50 shadow-inner shadow-indigo-950/40'
                          : 'bg-slate-900/55 border-slate-850 hover:bg-slate-900 hover:border-slate-750'
                      }`}
                    >
                      <div className={`text-[10px] font-black uppercase tracking-wider ${
                        modalityColor[study.modality]
                      }`}>{study.modality}</div>
                      <div className="text-xs font-bold text-slate-200 mt-1 leading-tight">{study.description}</div>
                      <div className="text-[9px] text-slate-700 font-bold mt-1">{study.date}</div>
                      {/* Series */}
                      <div className="mt-2.5 space-y-1 pt-2 border-t border-slate-900">
                        {study.series.map((s) => (
                          <div key={s.name} className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                            <span>{s.name}</span>
                            <span className="ml-auto text-slate-700 font-bold">{s.count} img</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Series thumbnails row */}
              <div className="p-3 bg-slate-900 border-t border-slate-800">
                <div className="text-[10px] text-slate-700 font-bold mb-2">Series Thumbnails</div>
                <div className="flex gap-2">
                  {[activeStudy].map((study, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg border border-slate-700 bg-black overflow-hidden flex-shrink-0 relative group">
                      <img src={study.imageUrl} alt="thumb" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── ZONE 2: DICOM Viewer (center) ────────────────────────── */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-lg relative">
              {/* Viewer Header */}
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-slate-250">Bella PACS Viewer</span>
                  <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded font-bold">{activeStudy.modality}</span>
                  <span className="text-[10px] text-slate-700 font-bold">{activeStudy.description} · {activeStudy.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAiOverlay(!showAiOverlay)}
                    className={`text-[10px] px-2.5 py-1 rounded-md border font-extrabold transition-all cursor-pointer ${
                      showAiOverlay
                        ? 'bg-violet-600/40 border-violet-500 text-violet-300 shadow'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-violet-400 hover:bg-slate-750'
                    }`}
                  >
                    ✦ AI Overlay {showAiOverlay ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => { setBrightness(100); setContrast(100); }}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-350 cursor-pointer" title="Reset Viewport">
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setInvert(!invert)}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-350 cursor-pointer" title="Invert LUT">
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* DICOM Info overlay — top left */}
              <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                <div className="absolute top-4 left-4 text-[10px] font-mono text-emerald-400/90 space-y-1.5 z-10 pointer-events-none drop-shadow-[0_0_2px_rgba(52,211,153,0.4)]">
                  <div>PATIENT: {BELLA_DEMO_PATIENT.name.toUpperCase()}</div>
                  <div>MRN: {BELLA_DEMO_PATIENT.mrn.toUpperCase()}</div>
                  <div>ACC: {activeStudy.uid.toUpperCase()}</div>
                  <div>DATE: {activeStudy.date}</div>
                  <div>SERIES: 1 / {activeStudy.series.length}</div>
                </div>

                {/* Top right DICOM info */}
                <div className="absolute top-4 right-4 text-[10px] font-mono text-emerald-400/90 space-y-1.5 z-10 pointer-events-none text-right drop-shadow-[0_0_2px_rgba(52,211,153,0.4)]">
                  <div>ZOOM: {zoom}%</div>
                  <div>W/L: {brightness * 4.5 | 0} / {contrast * 0.8 | 0}</div>
                  {activeStudy.modality === 'CT' && <div>SLICE: {ctSlice} / 180</div>}
                </div>

                {/* Main image */}
                <img
                  src={activeStudy.imageUrl}
                  alt={activeStudy.description}
                  className="w-full h-full object-contain transition-all duration-100"
                  style={{
                    filter: `brightness(${brightness}%) contrast(${contrast}%) ${invert ? 'invert(100%)' : ''}`,
                    transform: `scale(${zoom / 100})`,
                  }}
                />

                {/* AI Overlay — only when toggled ON */}
                {showAiOverlay && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Right lower lobe opacity marker */}
                    <div className="absolute" style={{ bottom: '28%', right: '32%' }}>
                      <div className="w-18 h-18 border-2 border-violet-400 rounded-full animate-pulse opacity-70" />
                      <div className="absolute -bottom-6 left-0 text-[10px] font-bold text-violet-300 whitespace-nowrap bg-black/60 px-1.5 py-0.5 rounded">
                        AI: Opacity 91%
                      </div>
                    </div>
                    {/* Small effusion marker */}
                    <div className="absolute" style={{ bottom: '15%', left: '28%' }}>
                      <div className="w-12 h-8 border border-dashed border-amber-400 rounded opacity-70" />
                      <div className="absolute -bottom-5 left-0 text-[10px] font-bold text-amber-300 whitespace-nowrap bg-black/60 px-1.5 py-0.5 rounded">
                        Effusion?
                      </div>
                    </div>
                    {/* AI badge */}
                    <div className="absolute bottom-4 left-4 text-[10px] bg-violet-600/90 text-violet-100 font-bold px-2.5 py-1 rounded flex items-center gap-1">
                      <Brain className="w-3.5 h-3.5" /> AI Radiology Assist — NOT a clinical diagnosis
                    </div>
                  </div>
                )}

                {/* Active tool badge */}
                <div className="absolute bottom-4 right-4 text-[10px] font-mono text-slate-400 bg-black/60 px-2.5 py-0.5 rounded border border-slate-800">
                  Tool: {activeTool.toUpperCase()}
                </div>
              </div>

              {/* ── ZONE 4: Toolbar (bottom) ────────────────────────────── */}
              <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center gap-2 flex-wrap">
                {/* Tools */}
                {([
                  { id: 'pan', icon: <Scan className="w-4 h-4" />, label: 'Pan' },
                  { id: 'zoom', icon: <ZoomIn className="w-4 h-4" />, label: 'Zoom' },
                  { id: 'rotate', icon: <RotateCw className="w-4 h-4" />, label: 'Rotate' },
                  { id: 'flip', icon: <FlipHorizontal2 className="w-4 h-4" />, label: 'Flip' },
                  { id: 'measure', icon: <Ruler className="w-4 h-4" />, label: 'Measure' },
                  { id: 'annotate', icon: <PenLine className="w-4 h-4" />, label: 'Annotate' },
                  { id: 'fullscreen', icon: <Maximize2 className="w-4 h-4" />, label: 'Fullscreen' },
                ] as { id: string; icon: React.ReactNode; label: string }[]).map((tool) => (
                  <button
                    key={tool.id}
                    title={tool.label}
                    onClick={() => setActiveTool(tool.id)}
                    className={`p-2 rounded-lg text-xs transition-all cursor-pointer ${
                      activeTool === tool.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white'
                    }`}
                  >
                    {tool.icon}
                  </button>
                ))}

                <div className="w-px h-5 bg-slate-800 mx-1" />

                {/* Brightness slider */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <input type="range" min={50} max={200} value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-16 accent-cyan-500 cursor-pointer" />
                  <span className="w-8 font-bold font-mono text-[10px] text-slate-350">{brightness}%</span>
                </div>

                {/* Contrast slider */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Contrast className="w-3.5 h-3.5 text-blue-400" />
                  <input type="range" min={50} max={200} value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-16 accent-cyan-500 cursor-pointer" />
                  <span className="w-8 font-bold font-mono text-[10px] text-slate-350">{contrast}%</span>
                </div>

                {/* CT slice (only for CT) */}
                {activeStudy.modality === 'CT' && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto">
                    <Layers className="w-3.5 h-3.5 text-amber-405" />
                    <span className="font-bold text-[10px] uppercase">Slice</span>
                    <input type="range" min={1} max={180} value={ctSlice}
                    onChange={(e) => setCtSlice(parseInt(e.target.value))}
                    className="w-20 accent-amber-500 cursor-pointer" />
                    <span className="w-14 font-bold font-mono text-[10px] text-slate-300">{ctSlice}/180</span>
                  </div>
                )}
                {/* Zoom control */}
                <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto">
                  <ZoomIn className="w-3.5 h-3.5 text-cyan-405" />
                  <input type="range" min={50} max={200} value={zoom}
                    onChange={(e) => setZoom(parseInt(e.target.value))}
                    className="w-16 accent-cyan-500 cursor-pointer" />
                  <span className="w-12 font-bold font-mono text-[10px] text-slate-300">{zoom}%</span>
                </div>
              </div>
            </div>

            {/* ── ZONE 3: Radiology Report (right) ─────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-md flex flex-col overflow-hidden">
              <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">
                <div className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">Radiology Report RIS</div>
                <div className="text-xs font-extrabold text-slate-805 mt-1">{activeStudy.description}</div>
                <div className="flex items-center gap-1.5 mt-2">
                  {/* Report State Machine badge */}
                  {([
                    { status: 'draft', label: 'DRAFT', color: 'bg-slate-200 text-slate-700 font-bold border border-slate-300' },
                    { status: 'preliminary', label: 'PRELIM', color: 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' },
                    { status: 'final', label: 'FINAL', color: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold' },
                    { status: 'amended', label: 'AMENDED', color: 'bg-rose-100 text-rose-900 border border-rose-350 font-extrabold' },
                  ] as { status: ReportStatus; label: string; color: string }[]).map((s) => {
                    const currentReport = pacsReports[activeStudyUid];
                    const isActive = currentReport?.status === s.status;
                    return (
                      <span key={s.status} className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isActive ? s.color : 'bg-slate-100 text-slate-400 font-semibold'
                      }`}>
                        {s.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Report body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                {pacsReports[activeStudyUid] ? (
                  <>
                    {/* Clinical Indication */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Clinical Indication</label>
                      <textarea
                        rows={2}
                        value={pacsReports[activeStudyUid]?.clinicalIndication ?? ''}
                        onChange={(e) => setPacsReports((prev) => ({
                          ...prev,
                          [activeStudyUid]: { ...prev[activeStudyUid], clinicalIndication: e.target.value },
                        }))}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none resize-none text-slate-800 bg-white"
                        placeholder="Lý do chỉ định chụp..."
                      />
                    </div>

                    {/* Technique */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Technique</label>
                      <textarea
                        rows={2}
                        value={pacsReports[activeStudyUid]?.technique ?? ''}
                        onChange={(e) => setPacsReports((prev) => ({
                          ...prev,
                          [activeStudyUid]: { ...prev[activeStudyUid], technique: e.target.value },
                        }))}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none resize-none text-slate-800 bg-white"
                        placeholder="Kỹ thuật thực hiện..."
                      />
                    </div>

                    {/* Findings */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Findings</label>
                      <textarea
                        rows={4}
                        value={pacsReports[activeStudyUid]?.findings ?? ''}
                        onChange={(e) => setPacsReports((prev) => ({
                          ...prev,
                          [activeStudyUid]: { ...prev[activeStudyUid], findings: e.target.value },
                        }))}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none resize-none text-slate-800 bg-white leading-relaxed"
                        placeholder="Mô tả hình ảnh chi tiết..."
                      />
                    </div>

                    {/* Impression — most important */}
                    <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-200 shadow-sm space-y-1.5">
                      <label className="text-[10px] font-extrabold text-indigo-850 uppercase tracking-wider block">★ Impression (Kết luận)</label>
                      <textarea
                        rows={3}
                        value={pacsReports[activeStudyUid]?.impression ?? ''}
                        onChange={(e) => setPacsReports((prev) => ({
                          ...prev,
                          [activeStudyUid]: { ...prev[activeStudyUid], impression: e.target.value },
                        }))}
                        className="w-full border border-indigo-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-505 focus:border-indigo-505 focus:outline-none resize-none text-slate-900 bg-white font-bold leading-relaxed shadow-inner"
                        placeholder="Kết luận chẩn đoán hình ảnh..."
                      />
                    </div>

                    {/* AI Radiology Assist */}
                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl p-4 border border-violet-200 shadow-sm">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-violet-850 mb-2.5">
                        <Brain className="w-4 h-4 text-violet-600 animate-pulse" />
                        ✦ AI RADIOLOGY ASSIST
                        <span className="ml-auto font-bold text-violet-400 lowercase normal-case">Not a diagnosis</span>
                      </div>
                      <div className="text-xs text-violet-900 space-y-2 mb-3">
                        <div className="font-bold text-[10px] text-violet-700 uppercase tracking-wide">Findings detected:</div>
                        <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded border border-violet-100 shadow-sm font-semibold">
                          <CheckSquare className="w-3.5 h-3.5 text-violet-650" />
                          <span>Right lower lobe opacity</span>
                          <span className="ml-auto font-black text-violet-700">91%</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded border border-violet-100 shadow-sm font-semibold">
                          <CheckSquare className="w-3.5 h-3.5 text-violet-650" />
                          <span>Small pleural effusion</span>
                          <span className="ml-auto font-black text-violet-700">74%</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 bg-white/40 px-2 py-1 rounded border border-slate-200 font-semibold">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Cardiomegaly</span>
                          <span className="ml-auto font-bold">Not detected</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-violet-705 italic border-t border-violet-200 pt-2 leading-relaxed font-semibold">
                        AI suggestion: Correlate with clinical findings and lab results. Human review required before reporting.
                      </div>
                      <button
                        onClick={() => setShowAiOverlay(!showAiOverlay)}
                        className="mt-3 w-full text-xs bg-violet-600 hover:bg-violet-750 text-white py-2 rounded-lg font-bold transition-all shadow-md cursor-pointer uppercase tracking-wider"
                      >
                        {showAiOverlay ? '✓ AI Overlay Active' : '▷ View AI Overlay'}
                      </button>
                    </div>

                    {/* Signed-by info (if FINAL) */}
                    {pacsReports[activeStudyUid]?.status === 'final' && (
                      <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-3.5 text-xs text-emerald-900 font-bold shadow-sm space-y-1">
                        <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                          <Shield className="w-4 h-4 text-emerald-600" /> FINAL REPORT — Signed
                        </div>
                        <div className="text-slate-800 text-[11px] font-semibold mt-1">
                          By: {pacsReports[activeStudyUid].signedBy} · {pacsReports[activeStudyUid].signedAt}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-slate-700 font-bold text-center py-10">Chưa có báo cáo cho y lệnh này.</div>
                )}
              </div>

              {/* Report action buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 shrink-0">
                {pacsReports[activeStudyUid]?.status !== 'final' && (
                  <button
                    onClick={() => setPacsReports((prev) => ({
                      ...prev,
                      [activeStudyUid]: {
                        ...prev[activeStudyUid],
                        status: prev[activeStudyUid]?.status === 'draft' ? 'preliminary' : 'draft',
                      },
                    }))}
                    className="w-full text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                  >
                    {pacsReports[activeStudyUid]?.status === 'draft' ? '▷ Submit Preliminary' : '↩ Revert to Draft'}
                  </button>
                )}
                {pacsReports[activeStudyUid]?.status !== 'final' ? (
                  <button
                    onClick={() => setPacsReports((prev) => ({
                      ...prev,
                      [activeStudyUid]: {
                        ...prev[activeStudyUid],
                        status: 'final',
                        signedBy: 'BS. Nguyễn Văn A',
                        signedAt: new Date().toLocaleString('vi-VN'),
                      },
                    }))}
                    className="w-full text-xs bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer uppercase tracking-wider"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Sign &amp; Finalize Report
                  </button>
                ) : (
                  <button
                    onClick={() => setPacsReports((prev) => ({
                      ...prev,
                      [activeStudyUid]: {
                        ...prev[activeStudyUid],
                        status: 'amended',
                      },
                    }))}
                    className="w-full text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-2.5 rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                  >
                    ✎ Amend Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Derive active study from the state (used in JSX above)
// This is needed because hooks can't be called conditionally
function AncillaryPageWrapper() {
  return <AncillaryPageInner />;
}

export default AncillaryPageWrapper;
