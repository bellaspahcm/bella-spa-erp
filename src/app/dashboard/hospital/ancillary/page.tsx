'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LabOrderItem, ImagingOrderItem } from '@/types/healthcare';
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
  Play,
  Check,
  User,
  FlaskConical,
  FileText,
  Video,
  Sparkles,
} from 'lucide-react';


const MOCK_LAB_ORDERS: LabOrderItem[] = [
  {
    id: 'lab-001',
    order_id: 'ord-101',
    test_code: 'GLU',
    test_name: 'Glucose (Đường Huyết)',
    sample_type: 'Máu tĩnh mạch',
    tube_color: 'Xám',
    result_value: '',
    result_unit: 'mmol/L',
    reference_range: '3.9 - 6.4',
    is_abnormal: false,
    is_panic_value: false,
  },
  {
    id: 'lab-002',
    order_id: 'ord-101',
    test_code: 'CREA',
    test_name: 'Creatinine (Chức Năng Thận)',
    sample_type: 'Máu tĩnh mạch',
    tube_color: 'Đỏ',
    result_value: '',
    result_unit: 'umol/L',
    reference_range: '62 - 115',
    is_abnormal: false,
    is_panic_value: false,
  },
  {
    id: 'lab-003',
    order_id: 'ord-101',
    test_code: 'WBC',
    test_name: 'Bạch Cầu (White Blood Cells)',
    sample_type: 'Máu toàn phần',
    tube_color: 'Tím',
    result_value: '',
    result_unit: 'G/L',
    reference_range: '4.0 - 10.0',
    is_abnormal: false,
    is_panic_value: false,
  },
];

const MOCK_IMAGING_ORDERS: ImagingOrderItem[] = [
  {
    id: 'img-001',
    order_id: 'ord-102',
    modality: 'XRAY',
    body_site: 'Lồng Ngực (Chest X-Ray)',
    dcm_study_uid: '1.2.840.113619.2.134568',
    viewer_link: '#',
    radiologist_report: '',
    radiologist_id: 'doc-radiologist-01',
  },
];

export default function HospitalAncillaryPage() {
  const searchParams = useSearchParams();
  const [labOrders, setLabOrders] = useState<LabOrderItem[]>(MOCK_LAB_ORDERS);
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
  const [activeModality, setActiveModality] = useState<string>('XRAY');

  // Diagnosis feedback
  const [aiFeedback, setAiFeedback] = useState<string>('');

  const handleUpdateLabResult = (id: string, value: string) => {
    setLabOrders((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const numValue = parseFloat(value);
          let isAbnormal = false;
          let isPanic = false;

          if (item.test_code === 'GLU') {
            isAbnormal = numValue < 3.9 || numValue > 6.4;
            isPanic = numValue < 2.5 || numValue > 25.0;
          } else if (item.test_code === 'CREA') {
            isAbnormal = numValue < 62 || numValue > 115;
            isPanic = numValue > 500;
          } else if (item.test_code === 'WBC') {
            isAbnormal = numValue < 4.0 || numValue > 10.0;
            isPanic = numValue < 1.0 || numValue > 30.0;
          }

          return {
            ...item,
            result_value: value,
            is_abnormal: isAbnormal,
            is_panic_value: isPanic,
          };
        }
        return item;
      })
    );
  };

  const handleVerifyLab = async (item: LabOrderItem) => {
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

      alert(`Đã duyệt thành công kết quả xét nghiệm ${item.test_code}.`);

      if (item.is_panic_value) {
        speakPanicAlert(item.test_name, item.result_value, item.result_unit || '');
      }
    } catch {
      // Swallowed for offline dev mode
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
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-300 mb-1">
            <FlaskConical className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Bella Hospital Ancillary • LIS & RIS/PACS Integration Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Trung Tâm Cận Lâm Sàng & Hình Ảnh PACS</h1>
          <p className="text-indigo-100 text-sm mt-1">
            Hệ thống quản lý kết quả xét nghiệm sinh hóa LIS, duyệt báo cáo hình ảnh RIS và mô phỏng PACS DICOM Web Viewer.
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('lis')}
          className={`py-3 px-6 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'lis'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>LIS (Phòng Xét Nghiệm)</span>
        </button>
        <button
          onClick={() => setActiveTab('ris')}
          className={`py-3 px-6 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'ris'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>RIS / PACS DICOM (Chẩn Đoán Hình Ảnh)</span>
        </button>
      </div>

      {activeTab === 'lis' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LIS Order List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center space-x-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  <span>Y Lệnh Xét Nghiệm Sinh Hóa Cần Nhập Kết Quả</span>
                </h3>
              </div>

              <div className="p-4 divide-y divide-slate-100">
                {labOrders.map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-indigo-700">[{item.test_code}]</span>
                        <span className="font-semibold text-slate-800">{item.test_name}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Mẫu: {item.sample_type} • Ống lấy máu: <span className="font-semibold">{item.tube_color}</span> • Chỉ số bình thường: {item.reference_range} {item.result_unit}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="Kết quả"
                          value={item.result_value}
                          onChange={(e) => handleUpdateLabResult(item.id, e.target.value)}
                          className="pl-3 pr-14 py-1.5 w-32 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                        <span className="absolute right-3 top-2 text-[10px] font-semibold text-slate-400">
                          {item.result_unit}
                        </span>
                      </div>

                      {item.is_panic_value && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 animate-pulse border border-rose-300">
                          🔴 Nguy kịch
                        </span>
                      )}
                      {item.is_abnormal && !item.is_panic_value && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          🟡 Bất thường
                        </span>
                      )}

                      <button
                        onClick={() => handleVerifyLab(item)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        title="Duyệt kết quả"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Clinical Panel */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center space-x-2 text-cyan-300 mb-3">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <h3 className="font-bold text-sm">AI Clinical Co-pilot Diagnostic</h3>
              </div>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Hệ thống AI tự động phân tích dữ liệu sinh hóa, phát hiện chỉ số bất thường nguy kịch và đề xuất khuyến nghị y khoa theo phác đồ.
              </p>

              <button
                onClick={runAiLabAnalysis}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-md"
              >
                Chạy Phân Tích Chỉ Số AI
              </button>

              {aiFeedback && (
                <div className="mt-4 p-3 bg-white/10 border border-white/10 rounded-xl text-xs font-medium font-mono text-cyan-100 whitespace-pre-wrap leading-relaxed">
                  {aiFeedback}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DICOM PACS Viewer Simulator */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-between h-[500px]">
              {/* PACS Top Control Panel */}
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-4">
                  <span className="font-bold text-slate-200">Bella PACS Viewer (DCM Simulator)</span>
                  <span>Modality: <strong className="text-cyan-400">{activeModality}</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setBrightness(100);
                      setContrast(100);
                      setInvert(false);
                    }}
                    className="p-1 hover:bg-slate-800 rounded text-slate-300"
                    title="Reset hình ảnh"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setInvert(!invert)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-300"
                    title="Đảo ngược màu sắc"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* PACS Image Area */}
              <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black p-4">
                {/* Simulated DICOM Image Overlay Details */}
                <div className="absolute top-4 left-4 text-xs font-mono text-emerald-500/80 space-y-1 z-10 pointer-events-none">
                  <div>PATIENT ID: pat-001</div>
                  <div>ACCESSION NO: acc-9872</div>
                  <div>STUDY DATE: 2026-08-07</div>
                  <div>SERIES: 1</div>
                </div>

                <div className="absolute bottom-4 right-4 text-xs font-mono text-emerald-500/80 z-10 pointer-events-none text-right">
                  <div>ZOOM: 100%</div>
                  <div>W/L: 450 / 80</div>
                  <div>BRIGHTNESS: {brightness}%</div>
                  <div>CONTRAST: {contrast}%</div>
                </div>

                {/* The Medical Scan Image */}
                <div
                  className="w-80 h-80 relative rounded border border-slate-800 bg-contain bg-center bg-no-repeat transition-all"
                  style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=400')`,
                    filter: `brightness(${brightness}%) contrast(${contrast}%) ${invert ? 'invert(100%)' : ''}`,
                  }}
                />
              </div>

              {/* PACS Bottom Adjuster Panel */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Độ Sáng (Brightness):</span>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <Contrast className="w-4 h-4 text-blue-500" />
                  <span>Độ Tương Phản (Contrast):</span>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Radiologist Diagnosis Report Panel */}
          <div className="space-y-4">
            {imagingOrders.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div>
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                    Bác Sĩ Chẩn Đoán Hình Ảnh
                  </span>
                  <h3 className="text-base font-bold text-slate-800">{item.body_site}</h3>
                  <p className="text-xs text-slate-500">Mã phim: {item.dcm_study_uid}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kết Luận Chẩn Đoán Lâm Sàng (RIS Report):
                  </label>
                  <textarea
                    rows={6}
                    value={item.radiologist_report}
                    onChange={(e) =>
                      setImagingOrders((prev) =>
                        prev.map((o) => (o.id === item.id ? { ...o, radiologist_report: e.target.value } : o))
                      )
                    }
                    placeholder="Ghi nhận kết luận chẩn đoán hình ảnh chi tiết (ví dụ: Hình ảnh tổn thương thâm nhiễm thùy dưới phổi phải, nghĩ viêm phổi tiến triển)..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => handleSaveImagingReport(item)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-md"
                >
                  Duyệt Báo Cáo Chẩn Đoán Hình Ảnh
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
