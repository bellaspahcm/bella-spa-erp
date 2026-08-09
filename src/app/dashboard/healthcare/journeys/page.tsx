'use client';

import React, { useState } from 'react';
import { Activity, Plus, Search, CheckCircle, Clock, Calendar, Check, Play, User, Sparkles, Shield, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface Milestone {
  readonly id: string;
  readonly name: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface SubJourney {
  readonly id: string;
  readonly name: string;
  readonly status: 'pending' | 'active' | 'completed';
  readonly milestones: Milestone[];
}

interface CareJourney {
  readonly id: string;
  readonly patientName: string;
  readonly type: string;
  readonly status: 'active' | 'paused' | 'completed' | 'cancelled';
  readonly startedAt: string;
  readonly doctorName: string;
  readonly subJourneys: SubJourney[];
}

const DENTAL_PRESET_JOURNEYS: CareJourney[] = [
  {
    id: 'journey-01',
    patientName: 'Nguyễn Văn Hùng',
    doctorName: 'BS. Lê Minh',
    type: 'Cấy ghép Implant răng #36',
    status: 'active',
    startedAt: '2026-06-01',
    subJourneys: [
      {
        id: 'sj-01',
        name: 'Giai đoạn 1: Phẫu thuật cấy ghép trụ',
        status: 'completed',
        milestones: [
          { id: 'ms-11', name: 'Chụp phim CBCT 3D & Lên phác đồ', status: 'completed' },
          { id: 'ms-12', name: 'Phẫu thuật cắm trụ Implant', status: 'completed' },
          { id: 'ms-13', name: 'Cắt chỉ & Kiểm tra sau 7-10 ngày', status: 'completed' },
        ],
      },
      {
        id: 'sj-02',
        name: 'Giai đoạn 2: Chờ tích hợp xương (Osseointegration)',
        status: 'active',
        milestones: [
          { id: 'ms-21', name: 'Kiểm tra độ tích hợp xương Implant', status: 'in_progress' },
          { id: 'ms-22', name: 'Đặt nắp lành thương (Healing Abutment)', status: 'pending' },
        ],
      },
      {
        id: 'sj-03',
        name: 'Giai đoạn 3: Lắp mão răng sứ phục hình',
        status: 'pending',
        milestones: [
          { id: 'ms-31', name: 'Lấy dấu răng & Chế tác răng sứ CAD/CAM', status: 'pending' },
          { id: 'ms-32', name: 'Thử răng sứ & Gắn cố định khớp cắn', status: 'pending' },
        ],
      },
    ],
  },
  {
    id: 'journey-02',
    patientName: 'Lê Thị Mai',
    doctorName: 'BS. Trần Thảo',
    type: 'Chỉnh nha mặt trong (Orthodontics)',
    status: 'active',
    startedAt: '2026-07-15',
    subJourneys: [
      {
        id: 'sj-21',
        name: 'Giai đoạn 1: Chuẩn bị lâm sàng',
        status: 'completed',
        milestones: [
          { id: 'ms-41', name: 'Lấy mẫu răng & Phân tích khớp cắn', status: 'completed' },
          { id: 'ms-42', name: 'Nhổ răng tiền cối chỉ định', status: 'completed' },
        ],
      },
      {
        id: 'sj-22',
        name: 'Giai đoạn 2: Gắn khí cụ chỉnh nha',
        status: 'active',
        milestones: [
          { id: 'ms-51', name: 'Gắn mắc cài hai hàm', status: 'in_progress' },
          { id: 'ms-52', name: 'Thay thun & Tăng lực kéo định kỳ', status: 'pending' },
        ],
      },
    ],
  },
];

const MEDICAL_PRESET_JOURNEYS: CareJourney[] = [
  {
    id: 'journey-01',
    patientName: 'Nguyễn Văn Hùng',
    doctorName: 'BS. Lê Minh',
    type: 'Điều trị nội trú viêm phổi cấp',
    status: 'active',
    startedAt: '2026-06-01',
    subJourneys: [
      {
        id: 'sj-01',
        name: 'Giai đoạn 1: Tiếp nhận & Nhập viện',
        status: 'completed',
        milestones: [
          { id: 'ms-11', name: 'Khám cấp cứu & Chụp X-quang phổi', status: 'completed' },
          { id: 'ms-12', name: 'Xét nghiệm công thức máu & Khí máu', status: 'completed' },
          { id: 'ms-13', name: 'Lập hồ sơ bệnh án nội trú & Nhận buồng bệnh', status: 'completed' },
        ],
      },
      {
        id: 'sj-02',
        name: 'Giai đoạn 2: Điều trị tích cực tại khoa Nội',
        status: 'active',
        milestones: [
          { id: 'ms-21', name: 'Kháng sinh truyền tĩnh mạch & Thở oxy', status: 'in_progress' },
          { id: 'ms-22', name: 'Theo dõi sinh hiệu (HA, Nhiệt độ, SpO2) mỗi 4h', status: 'pending' },
        ],
      },
      {
        id: 'sj-03',
        name: 'Giai đoạn 3: Phục hồi & Xuất viện',
        status: 'pending',
        milestones: [
          { id: 'ms-31', name: 'Đánh giá lại phim X-quang & Chức năng hô hấp', status: 'pending' },
          { id: 'ms-32', name: 'Hoàn thiện thủ tục thanh toán ra viện & Kê đơn thuốc về', status: 'pending' },
        ],
      },
    ],
  },
  {
    id: 'journey-02',
    patientName: 'Lê Thị Mai',
    doctorName: 'BS. Trần Thảo',
    type: 'Chăm sóc hậu sản thường quy',
    status: 'active',
    startedAt: '2026-07-15',
    subJourneys: [
      {
        id: 'sj-21',
        name: 'Giai đoạn 1: Theo dõi 24h đầu sau sinh',
        status: 'completed',
        milestones: [
          { id: 'ms-41', name: 'Kiểm tra cơn co tử cung & Lượng máu mất', status: 'completed' },
          { id: 'ms-42', name: 'Hướng dẫn mẹ cho bé bú sớm & Vận động nhẹ', status: 'completed' },
        ],
      },
      {
        id: 'sj-22',
        name: 'Giai đoạn 2: Chăm sóc & Phục hồi tại buồng',
        status: 'active',
        milestones: [
          { id: 'ms-51', name: 'Chiếu tia plasma cuống rốn bé & Vết khâu mẹ', status: 'in_progress' },
          { id: 'ms-52', name: 'Tiêm vaccine viêm gan B & Lao cho trẻ sơ sinh', status: 'pending' },
        ],
      },
    ],
  },
];

export default function JourneysPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>('journey-01');
  const [isMedical, setIsMedical] = useState(false);

  // Form states
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('BS. Lê Minh');
  const [journeyType, setJourneyType] = useState('Cấy ghép Implant răng (#36 / Nobel Biocare)');
  const [journeys, setJourneys] = useState<CareJourney[]>(DENTAL_PRESET_JOURNEYS);

  const doctorOptions = isMedical
    ? [
        { value: 'BS. Lê Minh', label: 'BS. Lê Minh (Trưởng khoa Nội tổng quát)' },
        { value: 'BS. Trần Thảo', label: 'BS. Trần Thảo (Chuyên gia Sản phụ khoa)' },
      ]
    : [
        { value: 'BS. Lê Minh', label: 'BS. Lê Minh (Trưởng khoa Phục hình)' },
        { value: 'BS. Trần Thảo', label: 'BS. Trần Thảo (Chuyên gia Chỉnh nha)' },
      ];

  const [customServices, setCustomServices] = useState<{ value: string; label: string }[]>([]);

  React.useEffect(() => {
    // Detect tenant healthcare specialization
    try {
      const cached = window.localStorage.getItem('bella.sidebar.brand.v3');
      if (cached) {
        const brand = JSON.parse(cached) as Record<string, unknown>;
        const displayName = typeof brand.displayName === 'string' ? brand.displayName : '';
        const subtitle = typeof brand.subtitle === 'string' ? brand.subtitle : '';
        const hasHospital = Boolean(brand.isHospitalInpatient) || /hospital|bệnh viện|medical|y khoa|y tế/i.test(displayName);
        const hasDental = /dental|nha khoa/i.test(displayName) || /clinical management/i.test(subtitle);
        const isMed = hasHospital && !hasDental;
        setIsMedical(isMed);
        if (isMed) {
          setJourneys(MEDICAL_PRESET_JOURNEYS);
          setJourneyType('Điều trị nội trú viêm phổi cấp (Kháng sinh đồ)');
        }
      }
    } catch (e) {
      console.error(e);
    }

    import('@/services/package-actions').then(m => {
      m.getPackages().then(packages => {
        if (packages && packages.length > 0) {
          const options = packages.map(p => ({
            value: p.name,
            label: `${p.name} (${new Intl.NumberFormat('vi-VN').format(p.price)}đ)`,
          }));
          setCustomServices(options);
        }
      }).catch(() => {});
    });
  }, []);

  const journeyTypeOptions = isMedical
    ? [
        { value: 'Điều trị nội trú viêm phổi cấp (Kháng sinh đồ)', label: 'Điều trị nội trú viêm phổi cấp (Kháng sinh đồ)' },
        { value: 'Chăm sóc hậu sản thường quy (Sinh thường/Sinh mổ)', label: 'Chăm sóc hậu sản thường quy (Sinh thường/Sinh mổ)' },
        { value: 'Tầm soát sức khỏe tổng quát VIP (LIS/RIS)', label: 'Tầm soát sức khỏe tổng quát VIP (LIS/RIS)' },
        ...customServices.filter(s => !['Điều trị nội trú viêm phổi cấp (Kháng sinh đồ)', 'Chăm sóc hậu sản thường quy (Sinh thường/Sinh mổ)', 'Tầm soát sức khỏe tổng quát VIP (LIS/RIS)'].includes(s.value)),
      ]
    : [
        { value: 'Cấy ghép Implant răng (#36 / Nobel Biocare)', label: 'Cấy ghép Implant răng (#36 / Nobel Biocare)' },
        { value: 'Chỉnh nha niềng răng mặt trong (Invisalign)', label: 'Chỉnh nha niềng răng mặt trong (Invisalign)' },
        { value: 'Điều trị nha khoa tổng quát & Bọc sứ', label: 'Điều trị nha khoa tổng quát & Bọc sứ' },
        ...customServices.filter(s => !['Cấy ghép Implant răng (#36 / Nobel Biocare)', 'Chỉnh nha niềng răng mặt trong (Invisalign)', 'Điều trị nha khoa tổng quát & Bọc sứ'].includes(s.value)),
      ];

  const handleStartJourney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      toast.error('Vui lòng nhập tên bệnh nhân');
      return;
    }

    const selectedOption = journeyTypeOptions.find(o => o.value === journeyType);
    const selectedTypeName = selectedOption ? selectedOption.label.split(' (')[0] : journeyType;

    const newJourney: CareJourney = {
      id: `journey-${Date.now()}`,
      patientName,
      doctorName,
      type: selectedTypeName,
      status: 'active',
      startedAt: new Date().toISOString().split('T')[0],
      subJourneys: [
        {
          id: `sj-${Date.now()}-1`,
          name: 'Giai đoạn 1: Khám & Chuẩn bị lâm sàng',
          status: 'active',
          milestones: [
            { id: `ms-${Date.now()}-11`, name: 'Chụp phim & Lên phác đồ điều trị', status: 'in_progress' },
            { id: `ms-${Date.now()}-12`, name: 'Xét nghiệm máu & Đánh giá thể trạng', status: 'pending' },
          ],
        },
        {
          id: `sj-${Date.now()}-2`,
          name: 'Giai đoạn 2: Tiến hành trị liệu chính',
          status: 'pending',
          milestones: [
            { id: `ms-${Date.now()}-21`, name: 'Thực hiện kỹ thuật lâm sàng', status: 'pending' },
          ],
        },
      ],
    };

    setJourneys((prev) => [newJourney, ...prev]);
    setSelectedJourneyId(newJourney.id);
    toast.success('🚀 Khởi chạy Care Journey điều trị mới thành công');
    
    setPatientName('');
    setShowAddModal(false);
  };

  const handleUpdateMilestone = (journeyId: string, subId: string, milestoneId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    setJourneys((prev) =>
      prev.map((j) => {
        if (j.id === journeyId) {
          const updatedSjs = j.subJourneys.map((sj) => {
            if (sj.id === subId) {
              const updatedMs = sj.milestones.map((m) =>
                m.id === milestoneId ? { ...m, status: newStatus } : m
              );
              // Calculate if sub-journey status changes
              const allDone = updatedMs.every((m) => m.status === 'completed');
              const anyActive = updatedMs.some((m) => m.status === 'in_progress' || m.status === 'completed');
              const sjStatus = allDone ? 'completed' : anyActive ? 'active' : 'pending';

              return { ...sj, status: sjStatus as unknown, milestones: updatedMs };
            }
            return sj;
          });
          return { ...j, subJourneys: updatedSjs };
        }
        return j;
      })
    );
    toast.info(`Cập nhật tiến trình: ${newStatus === 'completed' ? 'Hoàn tất mốc y khoa' : 'Đang thực hiện'}`);
  };

  const selectedJourney = journeys.find((j) => j.id === selectedJourneyId) || journeys[0] || null;

  // Calculate stats for selected journey
  const totalMilestones = selectedJourney
    ? selectedJourney.subJourneys.reduce((acc, sj) => acc + sj.milestones.length, 0)
    : 0;
  const completedMilestones = selectedJourney
    ? selectedJourney.subJourneys.reduce(
        (acc, sj) => acc + sj.milestones.filter((m) => m.status === 'completed').length,
        0
      )
    : 0;
  const progressPercent = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative p-6 md:p-7 rounded-[28px] hc-glass-card hc-glass-card-hover flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-200/90 dark:border-slate-800/90 shadow-xl">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white font-extrabold text-xl shadow-lg shadow-teal-500/25 ring-4 ring-teal-500/20 dark:ring-teal-500/30 shrink-0">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Lộ trình Y khoa (Care Journeys)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Đa giai đoạn lâm sàng
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Hành trình điều trị Bệnh nhân
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Theo dõi tiến trình phẫu thuật, phục hình, chỉnh nha và các mốc theo dõi y khoa theo thời gian real-time
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-teal-500/25 transition-all active:scale-95 self-start md:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Khởi chạy Hành trình mới</span>
        </button>
      </div>

      {/* Main 2-column workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left column: Journeys List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-[24px] hc-glass-card border border-slate-200/80 dark:border-slate-800/80 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>📋</span> Danh sách Hành trình ({journeys.length})
              </h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-teal-50 text-teal-600 dark:bg-teal-950/40 rounded-full border border-teal-200/60">
                Đang theo dõi
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bệnh nhân hoặc dịch vụ..."
                className="w-full pl-10 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200/80 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900/90 dark:border-slate-800 dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-3.5 max-h-[560px] overflow-y-auto pr-1 scrollbar-thin">
              {journeys
                .filter((j) => j.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || j.type.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((j) => {
                  const isSelected = j.id === selectedJourneyId;
                  const initials = j.patientName.split(' ').map((n) => n[0]).join('').slice(0, 2);
                  const jTotalMs = j.subJourneys.reduce((acc, sj) => acc + sj.milestones.length, 0);
                  const jDoneMs = j.subJourneys.reduce((acc, sj) => acc + sj.milestones.filter((m) => m.status === 'completed').length, 0);
                  const jPct = jTotalMs > 0 ? Math.round((jDoneMs / jTotalMs) * 100) : 0;

                  return (
                    <div
                      key={j.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedJourneyId(j.id);
                        toast.success(`Đã chọn hành trình: ${j.patientName}`, {
                          description: `${j.type} • Bác sĩ: ${j.doctorName}`,
                          duration: 2500,
                        });
                        const detailPanel = document.getElementById('clinical-roadmap-panel');
                        if (detailPanel) {
                          detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedJourneyId(j.id);
                        }
                      }}
                      className={`p-4.5 rounded-2xl border cursor-pointer transition-all duration-200 text-left group select-none relative overflow-hidden active:scale-[0.98] ${
                        isSelected
                          ? 'bg-gradient-to-r from-teal-50/90 via-emerald-50/70 to-teal-50/40 border-teal-500 shadow-lg shadow-teal-500/15 ring-2 ring-teal-500/30 dark:from-teal-950/60 dark:to-slate-900 dark:border-teal-500'
                          : 'bg-white/90 border-slate-200/80 hover:border-teal-400 hover:shadow-md dark:bg-slate-900/90 dark:border-slate-800 dark:hover:border-teal-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                            {initials}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors leading-tight">
                              {j.patientName}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                              {j.doctorName}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 bg-teal-500 text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-sm">
                          {j.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-snug line-clamp-1">
                        {j.type}
                      </p>

                      {/* Mini Progress Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-slate-400">Tiến độ điều trị</span>
                          <span className="text-teal-600 dark:text-teal-400 font-extrabold">{jPct}% ({jDoneMs}/{jTotalMs})</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${jPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 font-semibold pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" /> Bắt đầu: {j.startedAt}
                        </span>
                        <span className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          Chi tiết <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right column: Selected Journey Visual Roadmap Timeline (8 cols) */}
        <div id="clinical-roadmap-panel" className="lg:col-span-8">
          {selectedJourney ? (
            <div className="p-7 rounded-[28px] hc-glass-card hc-glass-card-hover border border-slate-200/90 dark:border-slate-800/90 shadow-xl space-y-7 text-left">
              {/* Executive Summary Card */}
              <div className="p-6 rounded-[22px] bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 !text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 !text-teal-300 border border-teal-500/30">
                        HÀNH TRÌNH ĐIỀU TRỊ Y KHOA
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 !text-emerald-300 border border-emerald-500/30">
                        {selectedJourney.status.toUpperCase()}
                      </span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight !text-white drop-shadow-sm">
                      {selectedJourney.type}
                    </h2>
                  </div>

                  <div className="text-right sm:text-right shrink-0">
                    <span className="text-[10px] font-bold !text-slate-400 block uppercase tracking-wider">Tỉ lệ hoàn tất</span>
                    <span className="text-3xl font-black !text-emerald-400 font-mono">{progressPercent}%</span>
                  </div>
                </div>

                {/* Patient & Doctor metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium !text-slate-300">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 !text-teal-400 shrink-0" />
                    <div>
                      <span className="text-[10px] !text-slate-400 block font-bold">Bệnh nhân</span>
                      <span className="font-extrabold !text-white">{selectedJourney.patientName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 !text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[10px] !text-slate-400 block font-bold">Bác sĩ phụ trách</span>
                      <span className="font-extrabold !text-white">{selectedJourney.doctorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 !text-blue-400 shrink-0" />
                    <div>
                      <span className="text-[10px] !text-slate-400 block font-bold">Thời gian khởi chạy</span>
                      <span className="font-extrabold !text-white">{selectedJourney.startedAt}</span>
                    </div>
                  </div>
                </div>

                {/* Overall Progress Bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold !text-slate-400">
                    <span className="!text-slate-300">Mốc y khoa đã hoàn tất: {completedMilestones} / {totalMilestones} mốc</span>
                    <span className="!text-teal-300 font-mono font-extrabold">{progressPercent}% COMPLETED</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-emerald-500 rounded-full transition-all duration-700 shadow-md"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Sub-journeys Accordion/Timeline list */}
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span>📍</span> Tiến trình lâm sàng chi tiết (Clinical Roadmap)
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    {selectedJourney.subJourneys.length} Giai đoạn chính
                  </span>
                </div>

                <div className="space-y-7 relative">
                  {/* Connecting vertical timeline backbone line */}
                  <div className="absolute left-[17px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-teal-500 via-emerald-500 to-slate-200 dark:to-slate-800 pointer-events-none" />

                  {selectedJourney.subJourneys.map((sj, idx) => {
                    const sjDone = sj.milestones.filter((m) => m.status === 'completed').length;
                    const sjTotal = sj.milestones.length;

                    return (
                      <div key={sj.id} className="relative pl-11 group">
                        {/* Timeline node icon */}
                        <div
                          className={`absolute left-0 top-0.5 w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border shadow-md transition-all ${
                            sj.status === 'completed'
                              ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20'
                              : sj.status === 'active'
                              ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white border-teal-400 shadow-teal-500/25 ring-4 ring-teal-500/20 animate-pulse'
                              : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                          }`}
                        >
                          {sj.status === 'completed' ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        <div className="space-y-3">
                          {/* Phase Header Card */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-sm text-slate-900 dark:text-white">
                                  {sj.name}
                                </h4>
                                <span
                                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                    sj.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                                      : sj.status === 'active'
                                      ? 'bg-teal-50 text-teal-600 border-teal-200/60 dark:bg-teal-950/40 dark:text-teal-400'
                                      : 'bg-slate-200/60 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  {sj.status === 'completed' ? 'ĐÃ HOÀN TẤT' : sj.status === 'active' ? 'ĐANG THỰC HIỆN' : 'CHỜ KHỞI ĐỘNG'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                                Hoàn tất: {sjDone} / {sjTotal} mốc kỹ thuật
                              </p>
                            </div>
                          </div>

                          {/* Milestones list */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sj.milestones.map((m) => (
                              <div
                                key={m.id}
                                onClick={() => {
                                  const nextStatus = m.status === 'completed' ? 'in_progress' : m.status === 'in_progress' ? 'completed' : 'in_progress';
                                  handleUpdateMilestone(selectedJourney.id, sj.id, m.id, nextStatus);
                                }}
                                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.98] ${
                                  m.status === 'completed'
                                    ? 'bg-emerald-50/60 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800/60'
                                    : m.status === 'in_progress'
                                    ? 'bg-teal-50/80 border-teal-400 dark:bg-teal-950/40 dark:border-teal-700 shadow-sm ring-2 ring-teal-500/20'
                                    : 'bg-white/90 border-slate-200/80 hover:border-teal-300 dark:bg-slate-900/90 dark:border-slate-800'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <span className="text-xs text-slate-800 dark:text-slate-200 font-extrabold block leading-tight">
                                    {m.name}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 block">
                                    {m.status === 'completed' ? '✅ Đã hoàn tất (Click để hoàn tác)' : m.status === 'in_progress' ? '⚡ Đang thực hiện' : '⏳ Chưa bắt đầu (Click để chạy)'}
                                  </span>
                                </div>

                                <div className="shrink-0">
                                  {m.status === 'completed' ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateMilestone(selectedJourney.id, sj.id, m.id, 'in_progress');
                                      }}
                                      className="p-1.5 rounded-xl bg-emerald-500 text-white shadow-sm inline-flex items-center justify-center hover:bg-rose-500 transition-colors"
                                      title="Bấm để hoàn tác mốc này"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  ) : m.status === 'in_progress' ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateMilestone(selectedJourney.id, sj.id, m.id, 'completed');
                                      }}
                                      className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold text-[10px] rounded-xl shadow-md transition-all active:scale-95"
                                    >
                                      Xác nhận Xong
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateMilestone(selectedJourney.id, sj.id, m.id, 'in_progress');
                                      }}
                                      className="p-2 border border-slate-300 dark:border-slate-700 hover:bg-teal-500 hover:text-white hover:border-teal-500 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
                                      title="Bắt đầu mốc này"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[28px] shadow-sm">
              Vui lòng chọn một hành trình ở cột bên trái để xem tiến độ điều trị chi tiết
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-7 text-left animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600">
                  <Activity className="w-5 h-5" />
                </span>
                Khởi chạy Care Journey điều trị mới
              </h3>
              <span className="text-xs text-slate-400 font-semibold">Tạo lộ trình y khoa</span>
            </div>

            <form onSubmit={handleStartJourney} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">Tên bệnh nhân *</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nhập tên bệnh nhân điều trị..."
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">Bác sĩ phụ trách *</label>
                <PremiumSelect
                  options={doctorOptions}
                  value={doctorName}
                  onChange={setDoctorName}
                  placeholder="Chỉ định bác sĩ..."
                  buttonClassName="py-3 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">Loại lộ trình điều trị y khoa *</label>
                <PremiumSelect
                  options={journeyTypeOptions}
                  value={journeyType}
                  onChange={setJourneyType}
                  placeholder="Chọn loại lộ trình..."
                  buttonClassName="py-3 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Bắt đầu Lộ trình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

