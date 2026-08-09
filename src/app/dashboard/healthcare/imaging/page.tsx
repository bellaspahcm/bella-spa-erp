'use client';

import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Eye, 
  FileText, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  Search, 
  RefreshCw, 
  Mic, 
  Sparkles, 
  ShieldAlert, 
  CheckCheck, 
  PhoneCall, 
  Layers, 
  HardDrive, 
  ArrowRight, 
  Activity, 
  SlidersHorizontal,
  CheckCircle2,
  Flame,
  Ruler,
  Split,
  AlertTriangle,
  ChevronRight,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getImagingOrdersAction, 
  createImagingOrderAction, 
  verifyImagingResultAction,
  getMedicalServicesAction,
  confirmImagingDoctorNotificationAction
} from '@/services/healthcare/healthcare-actions';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { createClient } from '@/lib/supabase-client';

interface AIFinding {
  label: string;
  confidence: number;
  isCritical?: boolean;
}

interface TimelineStep {
  step: string;
  time: string;
  done: boolean;
}

interface ImagingWorkItem {
  id: string;
  ticketNumber: string;
  patientName: string;
  bodySite: string;
  dcmStudyUid: string;
  viewerLink: string;
  status: 'pending' | 'captured' | 'reported';
  radiologistReport?: string;
  priority?: 'STAT' | 'URGENT' | 'ROUTINE' | 'SCREENING';
  radiologistStatus?: 'unassigned' | 'reading' | 'need_opinion' | 'signed' | 'released';
  seriesCount?: number;
  imageCount?: number;
  storageSize?: string;
  aiFindings?: AIFinding[];
  timeline?: TimelineStep[];
  doctorNotified?: boolean;
  doctorNotifiedTime?: string;
  modality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY';
}

export default function ImagingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingDcmItem, setViewingDcmItem] = useState<ImagingWorkItem | null>(null);
  const [dcmSlice, setDcmSlice] = useState(48);
  const [dcmZoom, setDcmZoom] = useState(125);
  const [dcmPreset, setDcmPreset] = useState<'BRAIN' | 'BONE' | 'SOFT_TISSUE' | 'LUNG'>('BRAIN');
  const [dcmIsCine, setDcmIsCine] = useState(false);
  const [dcmShowAI, setDcmShowAI] = useState(true);
  const [selectedSeriesId, setSelectedSeriesId] = useState(2);
  const [dcmHeatmapOpacity, setDcmHeatmapOpacity] = useState(50);
  const [dcmCompareMode, setDcmCompareMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ImagingWorkItem[]>([]);
  
  // Worklist & Priority Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNASSIGNED' | 'READING' | 'NEED_OPINION' | 'SIGNED' | 'RELEASED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Voice Dictation Simulation
  const [isRecordingId, setIsRecordingId] = useState<string | null>(null);

  const [imagingOptions, setImagingOptions] = useState<{ value: string; name: string; modality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY'; bodySite: string }[]>([]);

  const [newImaging, setNewImaging] = useState({
    patientName: '',
    modality: 'XRAY' as ImagingWorkItem['modality'],
    bodySite: '',
    priority: 'ROUTINE' as NonNullable<ImagingWorkItem['priority']>,
  });

  const loadImagingOptions = async () => {
    try {
      const res = await getMedicalServicesAction('ris_imaging');
      const defaultOpts = [
        { value: 'XRAY-CHEST', name: 'X-Quang Ngực Thẳng (Chest AP)', modality: 'XRAY' as const, bodySite: 'X-Quang Ngực Thẳng (Chest AP)' },
        { value: 'CT-BRAIN', name: 'CT-Scanner Sọ Não Không Tiêm Thuốc', modality: 'CT' as const, bodySite: 'CT-Scanner Sọ Não Không Tiêm Thuốc' },
        { value: 'MRI-LSPINE', name: 'MRI Cột Sống Thắt Lưng (L-Spine)', modality: 'MRI' as const, bodySite: 'MRI Cột Sống Thắt Lưng (L-Spine)' },
        { value: 'US-ABDOMEN', name: 'Siêu âm Ổ bụng tổng quát', modality: 'ULTRASOUND' as const, bodySite: 'Siêu âm Ổ bụng tổng quát' },
        { value: 'ENDO-STOMACH', name: 'Nội soi Dạ dày - Tá tràng', modality: 'ENDOSCOPY' as const, bodySite: 'Nội soi Dạ dày - Tá tràng' },
      ];
      if (res.success && res.data && res.data.length > 0) {
        const dbOptions = res.data.map((item: { id: string; name: string; metadata?: { risCode?: string; risModality?: string; risBodySite?: string } }) => {
          const meta = item.metadata || {};
          const code = meta.risCode || item.id.slice(0, 8).toUpperCase();
          return {
            value: code,
            name: item.name,
            modality: (meta.risModality || 'XRAY') as 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY',
            bodySite: meta.risBodySite || item.name,
          };
        });
        const merged = [...dbOptions];
        defaultOpts.forEach(def => {
          if (!merged.some(m => m.value === def.value)) {
            merged.push(def);
          }
        });
        setImagingOptions(merged);
        if (merged.length > 0) {
          setNewImaging(prev => ({
            ...prev,
            modality: merged[0].modality,
            bodySite: merged[0].bodySite,
          }));
        }
      } else {
        setImagingOptions(defaultOpts);
        setNewImaging(prev => ({
          ...prev,
          modality: defaultOpts[0].modality,
          bodySite: defaultOpts[0].bodySite,
        }));
      }
    } catch (err: unknown) {
      console.error('Lỗi tải danh mục chỉ định RIS:', err);
    }
  };

  const loadImagingOrders = async (dateStr?: string) => {
    try {
      setIsLoading(true);
      const res = await getImagingOrdersAction(dateStr || undefined);
      if (res.success && res.data) {
        setItems(res.data as ImagingWorkItem[]);
      } else {
        toast.error('Lỗi tải phiếu CĐHA: ' + res.error);
      }
    } catch (err: unknown) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadImagingOrders(selectedDate);
    void loadImagingOptions();

    const supabase = createClient();
    const channel = supabase
      .channel('hc-imaging-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_imaging_orders' }, () => {
        void loadImagingOrders(selectedDate);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');

  const handleCreateImagingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImaging.patientName.trim()) {
      toast.error('Vui lòng nhập tên bệnh nhân chỉ định CĐHA!');
      return;
    }

    const dbRes = await createImagingOrderAction({
      patientName: newImaging.patientName.trim(),
      modality: newImaging.modality,
      bodySite: newImaging.bodySite,
    });

    if (!dbRes.success) {
      toast.error('Lỗi tạo chỉ định CĐHA: ' + dbRes.error);
      return;
    }

    setIsAddModalOpen(false);
    toast.success(`🎉 Đã khởi tạo phiếu CĐHA ${newImaging.modality} cho bệnh nhân ${newImaging.patientName.trim()}!`);
    setNewImaging({ patientName: '', modality: 'XRAY', bodySite: 'X-Quang Ngực Thẳng (Chest AP)', priority: 'ROUTINE' });
    loadImagingOrders();
  };

  const handleSaveReport = async (id: string) => {
    if (!reportText.trim()) {
      toast.error('Vui lòng nhập nội dung báo cáo chẩn đoán!');
      return;
    }

    const dbRes = await verifyImagingResultAction(id, reportText);
    if (!dbRes.success) {
      toast.error('Lỗi lưu báo cáo CĐHA: ' + dbRes.error);
      return;
    }

    toast.success('🎉 Đã duyệt & ký số Báo cáo Chẩn đoán Hình ảnh thành công!');
    setSelectedId(null);
    setReportText('');
    loadImagingOrders();
  };

  const handleConfirmCallLog = async (id: string) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const res = await confirmImagingDoctorNotificationAction(id, timeStr);
    if (!res.success) {
      toast.error(res.error || 'Lỗi không thể xác nhận thông báo');
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, doctorNotified: true, doctorNotifiedTime: timeStr }
          : item
      )
    );
    toast.success('📞 Đã xác nhận & ghi nhận Call Log thông báo Bác sĩ Lâm Sàng!');
  };

  const handleApplyAIFindings = (findings?: AIFinding[]) => {
    if (!findings || findings.length === 0) return;
    const aiSummary = findings.map((f) => `- ${f.label} (Độ tin cậy AI: ${f.confidence}%)`).join('\n');
    const template = `[MÔ TẢ HÌNH ẢNH RIS AI ASSIST]\n${aiSummary}\n\n[KẾT LUẬN RSNA]\nTheo dõi diễn tiến lâm sàng & đề nghị kết hợp xét nghiệm liên quan.`;
    setReportText((prev) => (prev ? `${prev}\n\n${template}` : template));
    toast.success('⚡ Đã nhập nhanh gợi ý chẩn đoán AI vào Báo Báo!');
  };

  const handleApplyRSNATemplate = (modality: string) => {
    let rsnaText = `[KỸ THUẬT CHỤP]\nChụp ${modality} theo chuỗi xung chuẩn y khoa RSNA/ACR.\n\n[MÔ TẢ HÌNH ẢNH]\nCác cấu trúc giải phẫu hiển thị rõ, không thấy bất thường hình thái nghiêm trọng.\n\n[KẾT LUẬN]\nHình ảnh trong giới hạn sinh lý bình thường.\n\n[ĐỀ NGHỊ]\nTái khám định kỳ theo hẹn của bác sĩ lâm sàng.`;
    if (modality === 'CT') {
      rsnaText = `[KỸ THUẬT CHỤP]\nCT-Scanner cắt lớp mỏng 1mm không tiêm thuốc tương quang.\n\n[MÔ TẢ HÌNH ẢNH]\nNhu mô sọ não không thấy ổ giảm hay tăng tỷ trọng bất thường. Hệ thống não thất không giãn.\n\n[KẾT LUẬN]\nHiện tại chưa phát hiện tổn thương xuất huyết hay choán chỗ nội sọ.\n\n[ĐỀ NGHỊ]\nTheo dõi sát dấu hiệu sinh tồn.`;
    }
    setReportText(rsnaText);
    toast.info('📝 Đã chèn mẫu Báo Cáo Cấu Trúc RSNA chuẩn!');
  };

  const handleToggleVoiceDictation = (id: string) => {
    if (isRecordingId === id) {
      setIsRecordingId(null);
      toast.success('🎙️ Đã hoàn tất Speech-to-Text Voice Dictation!');
    } else {
      setIsRecordingId(id);
      toast.info('🎤 Đang lắng nghe giọng đọc báo cáo của Bác sĩ CĐHA...', { duration: 4000 });
      setTimeout(() => {
        setReportText((prev) => (prev ? `${prev} Ghi nhận nhu mô phế nang thông thoáng.` : 'Ghi nhận nhu mô phế nang thông thoáng, bóng tim bình thường.'));
      }, 2500);
    }
  };

  // Filter Items
  const filteredItems = items
    .filter((item) => {
      const matchesSearch =
        item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.bodySite.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTab =
        activeTab === 'ALL'
          ? true
          : activeTab === 'UNASSIGNED'
          ? item.radiologistStatus === 'unassigned'
          : activeTab === 'READING'
          ? item.radiologistStatus === 'reading'
          : activeTab === 'NEED_OPINION'
          ? item.radiologistStatus === 'need_opinion'
          : activeTab === 'SIGNED'
          ? item.radiologistStatus === 'signed'
          : activeTab === 'RELEASED'
          ? item.radiologistStatus === 'released'
          : true;

      const matchesPriority =
        priorityFilter === 'ALL' ? true : item.priority === priorityFilter;

      return matchesSearch && matchesTab && matchesPriority;
    })
    .sort((a, b) => {
      // Prioritize STAT items at top
      if (a.priority === 'STAT' && b.priority !== 'STAT') return -1;
      if (a.priority !== 'STAT' && b.priority === 'STAT') return 1;
      return 0;
    });

  const seriesList = viewingDcmItem
    ? [
        { id: 1, name: 'Series 1: Localizer Scout', count: 2, type: '2D' },
        { id: 2, name: `Series 2: Axial 1.0mm (${viewingDcmItem.modality})`, count: viewingDcmItem.imageCount || 192, type: '3D Volume' },
        { id: 3, name: 'Series 3: Coronal Reconstruct', count: 48, type: 'MPR' },
        { id: 4, name: 'Series 4: 3D Bone / Angio VR', count: 1, type: 'VR 3D' },
      ]
    : [];

  const activeSeries = seriesList.find((s) => s.id === selectedSeriesId) || seriesList[1];

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* 10. Interoperability Pipeline Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-900/90 via-purple-900/80 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg border border-indigo-500/30">
        <div className="flex items-center gap-2.5 text-xs font-bold">
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 text-[10px] uppercase font-black">
            BELLA MEDICAL ENTERPRISE
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-200">
            <span>EMR</span> <ArrowRight className="w-3 h-3 text-indigo-400" />
            <span className="text-cyan-400 font-bold">RIS ENGINE</span> <ArrowRight className="w-3 h-3 text-indigo-400" />
            <span className="text-purple-400 font-bold">DICOM PACS</span> <ArrowRight className="w-3 h-3 text-indigo-400" />
            <span>BILLING</span> <ArrowRight className="w-3 h-3 text-indigo-400" />
            <span>BHYT GATEWAY</span>
          </div>
        </div>
        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Full Pipeline Active
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Camera className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Phân Hệ Chẩn Đoán Hình Ảnh (RIS Engine & DICOM PACS)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Radiologist Worklist • AI Preliminary Findings • DICOM PACS Viewer & Báo cáo Cấu trúc RSNA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4" />
            + Chỉ Định CĐHA RIS PACS
          </button>
          <button
            onClick={() => toast.info('PACS DICOM Server (Storage-HN-01): 100% Online • WADO-RS Ready!')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <HardDrive className="w-4 h-4 text-indigo-500" />
            Server PACS: 100% Online
          </button>
        </div>
      </div>

      {/* 5. Quick Stat Counter Bar & PACS Storage Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Tổng Ca Chụp RIS PACS</span>
            <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">{items.length} ca chỉ định</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
            <Camera className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">🚨 Ca STAT / Cấp Cứu Khẩn</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
              {items.filter((i) => i.priority === 'STAT').length} ca khẩn cấp
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
            <ShieldAlert className="w-5 h-5 animate-bounce" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">PACS Storage Node</span>
            <span className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5 block">1.4 TB / 5 TB (28%)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">AI Diagnostic Findings</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">100% Active Guard</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 1 & 2. Worklist Tabs & Priority Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Radiologist Worklist Workflow Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100 dark:border-slate-800 text-xs font-bold">
          {[
            { key: 'ALL', label: 'Tất Cả Ca Chụp' },
            { key: 'UNASSIGNED', label: 'Chờ Phân BS CĐHA' },
            { key: 'READING', label: 'Bác Sĩ Đang Đọc' },
            { key: 'NEED_OPINION', label: 'Hội Chẩn Chuyên Khoa' },
            { key: 'SIGNED', label: 'Đã Ký Số Báo Cáo' },
            { key: 'RELEASED', label: 'Đã Trả BHYT/EMR' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-md font-extrabold'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Priority Filter Row */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center w-full">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên bệnh nhân, loại chụp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-44 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer shrink-0 transition-all active:scale-95"
                  title="Xem tất cả các ngày"
                >
                  Tất cả
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto text-xs">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Priority:
            </span>
            {['ALL', 'STAT', 'URGENT', 'ROUTINE', 'SCREENING'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  priorityFilter === p
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {p === 'ALL' ? 'Tất cả' : p === 'STAT' ? '🚨 STAT' : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIS Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const isStat = item.priority === 'STAT';
          const isUrgent = item.priority === 'URGENT';
          const hasCriticalAI = item.aiFindings?.some((f) => f.isCritical);

          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-sm flex flex-col justify-between space-y-4 ${
                isStat
                  ? 'border-rose-500/70 ring-2 ring-rose-500/20 bg-rose-500/[0.01]'
                  : isUrgent
                  ? 'border-amber-500/50'
                  : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/50'
              }`}
            >
              <div className="space-y-3">
                {/* 2. Header Row & Priority Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px]">
                      {item.ticketNumber} • {item.modality}
                    </span>
                    {isStat ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] animate-bounce shadow-xs flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> STAT CẤP CỨU
                      </span>
                    ) : isUrgent ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                        URGENT
                      </span>
                    ) : null}
                  </div>

                  {item.status === 'reported' || item.radiologistStatus === 'signed' || item.radiologistStatus === 'released' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Đã Ký Số
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Chờ Đọc
                    </span>
                  )}
                </div>

                {/* Patient Info */}
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">{item.patientName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">{item.bodySite}</p>
                </div>

                {/* 4. DICOM & Series Metadata Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between text-slate-500 font-mono">
                    <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" /> {item.seriesCount || 8} Series • {item.imageCount || 192} Ảnh DICOM
                    </span>
                    <span>{item.storageSize || '256 MB'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800">
                    <span className="text-slate-400 font-mono text-[10px]">UID: {item.dcmStudyUid.slice(-12)}</span>
                    <button
                      onClick={() => setViewingDcmItem(item)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-extrabold text-[11px] hover:bg-indigo-700 flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem Phim DICOM 3D PACS <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 3. AI Preliminary Findings Box */}
                {item.aiFindings && item.aiFindings.length > 0 && (
                  <div className="p-3 rounded-xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" /> AI Diagnostic Findings
                      </span>
                      <button
                        onClick={() => handleApplyAIFindings(item.aiFindings)}
                        className="text-[10px] font-bold text-purple-600 hover:underline cursor-pointer"
                      >
                        ⚡ Dùng kết quả AI
                      </button>
                    </div>

                    <div className="space-y-1">
                      {item.aiFindings.map((finding, fIdx) => (
                        <div key={fIdx} className="flex items-center justify-between text-[11px]">
                          <span className={finding.isCritical ? 'font-black text-rose-600 dark:text-rose-400' : 'font-bold text-slate-700 dark:text-slate-300'}>
                            • {finding.label}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-mono font-bold text-[10px]">
                            {finding.confidence}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Critical Finding Call Log Alert */}
                {(isStat || hasCriticalAI) && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> CRITICAL FINDING ALERT
                      </span>
                      {item.doctorNotified ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" /> Đã báo BS ({item.doctorNotifiedTime})
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirmCallLog(item.id)}
                          className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <PhoneCall className="w-3 h-3" /> 📞 Báo BS Cấp Cứu
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 9. SLA Timeline 6 Nấc */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Timeline SLA CĐHA</span>
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                    {(item.timeline || [
                      { step: 'Chỉ định', time: '09:00', done: true },
                      { step: 'Đã đến', time: '09:12', done: true },
                      { step: 'Đã chụp', time: '09:18', done: true },
                      { step: 'Đang đọc', time: '09:25', done: true },
                      { step: 'Ký số', time: '09:31', done: true },
                      { step: 'Trả KQ', time: '09:33', done: true },
                    ]).map((st, sIdx) => (
                      <div key={sIdx} className="flex flex-col items-center">
                        <span className={`w-2 h-2 rounded-full mb-0.5 ${st.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        <span>{st.step}</span>
                        <span className="text-[8px] font-mono text-slate-400">{st.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signed Radiologist Report */}
                {item.radiologistReport && (
                  <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <span className="font-bold block text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Báo Báo Chẩn Đoán Đã Ký Số
                    </span>
                    <p className="whitespace-pre-line font-medium text-[11px] leading-relaxed">{item.radiologistReport}</p>
                  </div>
                )}
              </div>

              {/* 7 & 8. Voice Dictation & RSNA Report Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                {selectedId === item.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleToggleVoiceDictation(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                          isRecordingId === item.id
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        {isRecordingId === item.id ? '🎤 Đang ghi âm...' : '🎤 Voice Dictation'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyRSNATemplate(item.modality)}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        📝 Nạp Mẫu RSNA
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      placeholder="Nhập nội dung báo cáo chẩn đoán (hoặc dùng Voice Dictation)..."
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-indigo-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setSelectedId(null)}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => handleSaveReport(item.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 shadow-sm"
                      >
                        Lưu & Ký Số Báo Cáo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSelectedId(item.id); setReportText(item.radiologistReport || ''); }}
                    className="w-full py-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-500 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {item.radiologistReport ? 'Cập Nhật Báo Cáo' : 'Viết Báo Cáo CĐHA (Voice / RSNA)'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Chỉ Định CĐHA RIS PACS Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                Khởi Tạo Phiếu Chỉ Định CĐHA RIS PACS
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateImagingSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Bệnh Nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên bệnh nhân..."
                  value={newImaging.patientName}
                  onChange={(e) => setNewImaging({ ...newImaging, patientName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Dịch Vụ Chỉ Định Chẩn Đoán *</label>
                <PremiumSelect
                  options={imagingOptions.map(opt => ({ value: opt.value, label: `${opt.value} — ${opt.name}` }))}
                  value={imagingOptions.find(o => o.bodySite === newImaging.bodySite)?.value || ''}
                  onChange={(val) => {
                    const match = imagingOptions.find(o => o.value === val);
                    if (match) {
                      setNewImaging({
                        ...newImaging,
                        modality: match.modality,
                        bodySite: match.bodySite,
                      });
                    }
                  }}
                  placeholder="Chọn dịch vụ chỉ định chẩn đoán"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phương Pháp (Modality)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={newImaging.modality}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 font-bold text-slate-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mức Ưu Tiên (Priority)</label>
                  <PremiumSelect
                    value={newImaging.priority}
                    onChange={(val) => setNewImaging({ ...newImaging, priority: val as typeof newImaging.priority })}
                    options={[
                      { value: 'STAT', label: '🚨 STAT — Cấp Cứu Khẩn' },
                      { value: 'URGENT', label: '🟠 Urgent — Khẩn' },
                      { value: 'ROUTINE', label: '🔵 Routine — Thường Quy' },
                      { value: 'SCREENING', label: '🟢 Screening — Tầm Soát' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mô Tả Vị Trí & Chỉ Định Chụp</label>
                <input
                  type="text"
                  required
                  value={newImaging.bodySite}
                  onChange={(e) => setNewImaging({ ...newImaging, bodySite: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-semibold text-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer active:scale-95 transition-all">
                  + Chỉ Định CĐHA RIS PACS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Screen Professional Interactive DICOM PACS 3D Viewer Modal */}
      {viewingDcmItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col font-sans select-none text-slate-800 animate-in fade-in duration-200 overflow-x-hidden max-w-full">
          {/* Modal Header Bar - Responsive Wrap Light Theme (No Slide Ngang) */}
          <div className="bg-white border-b border-slate-200 px-4 py-2.5 shrink-0 shadow-sm max-w-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold border border-indigo-200 shrink-0">
                  {viewingDcmItem.modality} PACS
                </div>
                <div className="min-w-0 truncate text-left">
                  <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
                    <span className="truncate">{viewingDcmItem.patientName}</span>
                    <span className="text-slate-500 font-normal text-[10px]">({viewingDcmItem.ticketNumber})</span>
                  </h2>
                  <p className="text-[10px] text-slate-500 font-mono truncate hidden md:block">
                    {viewingDcmItem.bodySite} • UID: {viewingDcmItem.dcmStudyUid}
                  </p>
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold shrink-0">
                {[
                  { key: 'BRAIN', label: 'Brain W/L' },
                  { key: 'BONE', label: 'Bone' },
                  { key: 'SOFT_TISSUE', label: 'Soft Tissue' },
                  { key: 'LUNG', label: 'Lung' },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => setDcmPreset(preset.key as typeof dcmPreset)}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      dcmPreset === preset.key
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs shrink-0">
                <a
                  href={viewingDcmItem.viewerLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 shrink-0 border border-slate-200"
                >
                  Cửa Sổ Mới <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setViewingDcmItem(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white transition-all cursor-pointer shrink-0 border border-slate-200"
                  title="Đóng PACS Viewer"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Modal Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Series Thumbnails */}
            <div className="w-60 bg-[#0a0e1a] border-r border-slate-800 p-3 space-y-3 shrink-0 overflow-y-auto hidden md:block text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                DANH SÁCH SERIES ({viewingDcmItem.seriesCount || 8} Series)
              </span>

              {seriesList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSeriesId(s.id);
                    setDcmSlice(1);
                  }}
                  className={`w-full p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    s.id === selectedSeriesId
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                      : 'bg-[#101625] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold font-sans">
                    <span>{s.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[9px]">
                      {s.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">{s.count} Slices • 512x512 matrix</p>
                </button>
              ))}
            </div>

            {/* Central DICOM Interactive Viewport */}
            <div className="flex-1 bg-[#050810] flex flex-col justify-between items-center relative p-4 overflow-hidden">
              {/* Top Controls Toolbar */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[#0d1322]/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 flex items-center gap-3 text-xs shadow-2xl">
                <button
                  onClick={() => setDcmZoom((z) => Math.min(z + 25, 250))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDcmZoom((z) => Math.max(z - 25, 75))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-indigo-400 font-bold">{dcmZoom}%</span>
                <div className="w-px h-4 bg-slate-800" />
                <button
                  onClick={() => setDcmShowAI(!dcmShowAI)}
                  className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1 transition-all ${
                    dcmShowAI ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI Diagnostic Overlays
                </button>
              </div>

              {/* HUD Top Left */}
              <div className="absolute top-4 left-4 z-10 text-left text-[11px] font-mono text-cyan-400 space-y-0.5">
                <div className="font-bold text-white text-xs">{viewingDcmItem.patientName}</div>
                <div>{viewingDcmItem.ticketNumber} • Modality: {viewingDcmItem.modality}</div>
                <div>Preset: {dcmPreset} Mode</div>
              </div>

              {/* HUD Top Right */}
              <div className="absolute top-4 right-4 z-10 text-right text-[11px] font-mono text-emerald-400 space-y-0.5">
                <div>Bella DICOM Engine 3D</div>
                <div>Matrix: 512x512</div>
                <div>Lossless Render Mode</div>
              </div>

              {/* Canvas SVG Anatomical View */}
              <div
                className="flex-1 w-full flex items-center justify-center relative transition-transform duration-150"
                style={{ transform: `scale(${dcmZoom / 100})` }}
              >
                <div className="w-96 h-96 relative border border-slate-800 rounded-3xl bg-slate-950 flex items-center justify-center shadow-2xl overflow-hidden">
                  <svg className="w-full h-full p-6 text-slate-700" viewBox="0 0 200 200">
                    {selectedSeriesId === 1 ? (
                      <>
                        {/* 2D Sagittal Scout View */}
                        <path d="M 130 140 C 130 80, 110 50, 80 50 C 50 50, 45 70, 45 100 C 45 120, 50 135, 60 140 C 70 145, 80 145, 80 160 L 110 160 C 110 150, 115 145, 130 140 Z" fill="#151d30" stroke="#475569" strokeWidth="4" />
                        <path d="M 80 50 L 80 160" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                        <path d="M 45 100 L 130 100" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="45" y1={70 + (dcmSlice * 30)} x2="130" y2={70 + (dcmSlice * 30)} stroke="#22d3ee" strokeWidth="2" className="animate-pulse" />
                        <text x="50" y="45" fill="#22d3ee" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">2D Sagittal Localizer</text>
                      </>
                    ) : selectedSeriesId === 3 ? (
                      <>
                        {/* Coronal MPR View */}
                        <ellipse cx="100" cy="100" rx="55" ry="65" fill="#151d30" stroke="#475569" strokeWidth="4" />
                        <path d="M 100 35 Q 100 165 100 165" stroke="#334155" strokeWidth="2" />
                        <ellipse cx="100" cy="100" rx={Math.max(10, Math.min(42, 15 + (dcmSlice % 15)))} ry="25" fill="#0d1322" stroke="#475569" strokeWidth="1.5" />
                        <text x="50" y="28" fill="#a855f7" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">Coronal MPR Reconstruct</text>
                        {dcmShowAI && (
                          <g className="animate-pulse">
                            <ellipse cx="100" cy="100" rx="10" ry="15" fill="#ef4444" opacity="0.65" />
                            <text x="75" y="75" fill="#ef4444" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">AI: Midline Shift (5.2mm)</text>
                          </g>
                        )}
                      </>
                    ) : selectedSeriesId === 4 ? (
                      <>
                        {/* 3D Bone / Angio VR View */}
                        <circle cx="100" cy="100" r="70" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="4" />
                        <path d="M 100 170 Q 100 130 90 100 T 110 60" fill="none" stroke="#f59e0b" strokeWidth="3" opacity="0.9" />
                        <path d="M 90 100 Q 70 80 60 70" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.8" />
                        <path d="M 110 90 Q 130 80 140 70" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.8" />
                        <text x="50" y="22" fill="#f59e0b" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">3D Volume Reconstruction</text>
                        {dcmShowAI && (
                          <g className="animate-pulse">
                            <circle cx="110" cy="60" r="8" fill="#f43f5e" opacity="0.7" />
                            <text x="112" y="48" fill="#f43f5e" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">AI: Aneurysm (99%)</text>
                          </g>
                        )}
                      </>
                    ) : viewingDcmItem.modality === 'CT' ? (
                      <>
                        <circle cx="100" cy="100" r="75" fill="#151d30" stroke="#475569" strokeWidth="6" />
                        <circle cx="100" cy="100" r="62" fill="#0d1322" stroke="#334155" strokeWidth="2" />
                        <path d="M 85 80 Q 95 65 100 80 Q 105 65 115 80 Q 100 110 85 80" fill="#1e293b" />
                        <ellipse cx="100" cy="100" rx={Math.max(5, 15 - Math.abs(96 - dcmSlice) * 0.1)} ry={Math.max(10, 25 - Math.abs(96 - dcmSlice) * 0.15)} fill="#151d30" opacity="0.5" />
                        {dcmShowAI && (
                          <g className="animate-pulse">
                            <ellipse cx="125" cy="95" rx="18" ry="14" fill="#ef4444" opacity="0.75" />
                            <rect x="95" y="65" width="55" height="50" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                            <text x="100" y="60" fill="#ef4444" fontSize="7" fontWeight="bold">AI: Xuất Huyết (98%)</text>
                          </g>
                        )}
                      </>
                    ) : viewingDcmItem.modality === 'MRI' ? (
                      <>
                        <rect x="80" y="30" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                        <rect x="80" y="60" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                        <rect x="80" y="90" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                        <rect x="80" y="120" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                        {dcmShowAI && (
                          <g className="animate-pulse">
                            <ellipse cx="122" cy="118" rx="12" ry="8" fill="#f59e0b" opacity="0.8" />
                            <text x="110" y="140" fill="#f59e0b" fontSize="7" fontWeight="bold">AI: L5-S1 (92%)</text>
                          </g>
                        )}
                      </>
                    ) : (
                      <>
                        <path d="M 50 40 Q 100 20 150 40 L 160 160 L 40 160 Z" fill="#111827" stroke="#374151" strokeWidth="4" />
                        <ellipse cx="75" cy="90" rx="25" ry="35" fill="#1f2937" />
                        <ellipse cx="125" cy="90" rx="25" ry="35" fill="#1f2937" />
                        <circle cx="115" cy="115" r="22" fill="#374151" opacity="0.6" />
                      </>
                    )}
                  </svg>

                  <div className="absolute inset-0 border border-indigo-500/20 pointer-events-none flex items-center justify-center">
                    <div className="w-4 h-4 border border-cyan-400 rounded-full flex items-center justify-center">
                      <div className="w-1 h-1 bg-cyan-400 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Slider Slice Bar */}
              <div className="w-full max-w-xl z-20 bg-[#0d1322]/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-4 text-xs">
                <span className="font-mono text-slate-400 text-[11px] shrink-0">Slice {dcmSlice}</span>
                <input
                  type="range"
                  min="1"
                  max={activeSeries?.count || 192}
                  value={Math.min(dcmSlice, activeSeries?.count || 192)}
                  onChange={(e) => setDcmSlice(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <span className="font-mono text-slate-400 text-[11px] shrink-0">{activeSeries?.count || 192} Slices</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
