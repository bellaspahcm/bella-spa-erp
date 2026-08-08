'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Eye,
  FileText,
  User,
  Bed,
  Pill,
  TrendingDown,
  XCircle,
} from 'lucide-react';

// ─── Patient Safety Incident Types ───────────────────────────────────────────
type IncidentSeverity = 'near_miss' | 'no_harm' | 'minor' | 'moderate' | 'severe' | 'sentinel';
type IncidentCategory = 'fall' | 'medication' | 'hai' | 'procedure' | 'identification' | 'other';
type IncidentStatus = 'reported' | 'investigating' | 'rca_complete' | 'closed';

interface SafetyIncident {
  id: string;
  reportNo: string;
  reportedAt: string;
  reportedBy: string;
  incidentDate: string;
  patientName: string;
  wardBed: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  immediateAction: string;
  status: IncidentStatus;
  rcaDeadline: string | null;
  rootCauses: string[];
  correctiveActions: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_INCIDENTS: SafetyIncident[] = [
  {
    id: 'inc-001',
    reportNo: 'SC-2026-0892-001',
    reportedAt: '2026-08-06T10:30:00Z',
    reportedBy: 'ĐD. Lý Thu Hà',
    incidentDate: '2026-08-06',
    patientName: 'Nguyễn Văn Hoàng',
    wardBed: 'ICU-BED-01',
    category: 'medication',
    severity: 'moderate',
    title: 'Sai liều kháng sinh — Meropenem nhập nhầm 2g thay vì 1g',
    description: 'Điều dưỡng cấp phát Meropenem 2g do nhãn lọ giống nhau. Phát hiện trước khi truyền, lọ chưa mở.',
    immediateAction: 'Giữ nguyên lọ thuốc. Thông báo BS điều trị. Lấy lại đơn thuốc đúng từ kho dược.',
    status: 'rca_complete',
    rcaDeadline: '2026-08-13',
    rootCauses: [
      'Kho dược lưu 2 quy cách (1g và 2g) cùng ngăn, nhãn nhỏ khó phân biệt.',
      'Thiếu bước double-check 2 điều dưỡng với thuốc ICU.',
    ],
    correctiveActions: [
      'Tách riêng ngăn lưu trữ Meropenem 1g và 2g với nhãn màu khác nhau.',
      'Áp dụng quy trình double-check bắt buộc với tất cả thuốc ICU.',
      'Đào tạo lại điều dưỡng toàn khoa về 5 Rights của cấp phát thuốc.',
    ],
  },
  {
    id: 'inc-002',
    reportNo: 'SC-2026-0895-001',
    reportedAt: '2026-08-07T15:00:00Z',
    reportedBy: 'ĐD. Nguyễn Văn Phong',
    incidentDate: '2026-08-07',
    patientName: 'Phạm Thị Loan',
    wardBed: 'ICU-BED-03',
    category: 'hai',
    severity: 'severe',
    title: 'Nhiễm khuẩn liên quan thở máy (VAP) nghi ngờ',
    description: 'BN thở máy ngày 4, sốt 38.8°C, đờm đục tăng, X-quang ngực thâm nhiễm mới. Cấy BAL đã gửi.',
    immediateAction: 'Thay băng và bộ dây thở máy. Điều chỉnh kháng sinh theo kinh nghiệm chờ kết quả cấy. Thông báo Ủy ban KSNK.',
    status: 'investigating',
    rcaDeadline: '2026-08-14',
    rootCauses: [],
    correctiveActions: [],
  },
  {
    id: 'inc-003',
    reportNo: 'SC-2026-0001-001',
    reportedAt: '2026-08-05T08:00:00Z',
    reportedBy: 'ĐD. Hoàng Minh Tuấn',
    incidentDate: '2026-08-04',
    patientName: 'BN không xác định — Khu vực hành lang Khoa Tim',
    wardBed: 'Hành lang Khoa Tim',
    category: 'fall',
    severity: 'minor',
    title: 'Bệnh nhân tự ngã khi đứng dậy từ xe lăn',
    description: 'BN 72 tuổi, hậu phẫu ngày 3, tự đứng dậy không báo điều dưỡng. Ngã ngồi xuống sàn. Không chấn thương, X-quang hông bình thường.',
    immediateAction: 'Đánh giá lâm sàng ngay. Lắp thanh chắn giường. Đặt biển báo nguy cơ ngã. Thông báo gia đình.',
    status: 'closed',
    rcaDeadline: null,
    rootCauses: [
      'BN thiếu kiên nhẫn, không bấm chuông gọi điều dưỡng.',
      'Thiếu giám sát định kỳ do tỷ lệ điều dưỡng/BN cao vào giờ cao điểm.',
    ],
    correctiveActions: [
      'Đánh giá nguy cơ ngã bằng thang Morse mỗi 12h với BN hậu phẫu.',
      'Gắn biển "Nguy cơ ngã cao" đầu giường cho BN điểm Morse ≥ 45.',
    ],
  },
];

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; color: string; bg: string }> = {
  near_miss: { label: 'Suýt xảy ra',  color: 'text-slate-700',   bg: 'bg-slate-100 border-slate-200' },
  no_harm:   { label: 'Không hại',    color: 'text-teal-700',    bg: 'bg-teal-100 border-teal-200' },
  minor:     { label: 'Nhẹ',          color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-200' },
  moderate:  { label: 'Trung bình',   color: 'text-amber-700',   bg: 'bg-amber-100 border-amber-200' },
  severe:    { label: 'Nặng',         color: 'text-orange-700',  bg: 'bg-orange-100 border-orange-200' },
  sentinel:  { label: 'Nghiêm trọng', color: 'text-rose-700',    bg: 'bg-rose-100 border-rose-200' },
};

const CATEGORY_CONFIG: Record<IncidentCategory, { label: string; icon: React.ReactNode }> = {
  fall:           { label: 'Té ngã',            icon: <User className="w-3.5 h-3.5" /> },
  medication:     { label: 'Dùng thuốc',        icon: <Pill className="w-3.5 h-3.5" /> },
  hai:            { label: 'Nhiễm khuẩn BV',   icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  procedure:      { label: 'Thủ thuật',         icon: <FileText className="w-3.5 h-3.5" /> },
  identification: { label: 'Nhầm BN',           icon: <Bed className="w-3.5 h-3.5" /> },
  other:          { label: 'Khác',              icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  reported:      { label: 'Mới báo cáo',     color: 'bg-blue-100 text-blue-800' },
  investigating: { label: 'Đang điều tra',   color: 'bg-amber-100 text-amber-800' },
  rca_complete:  { label: 'RCA hoàn thành',  color: 'bg-purple-100 text-purple-800' },
  closed:        { label: 'Đã đóng',         color: 'bg-emerald-100 text-emerald-800' },
};

export default function HospitalSafetyIncidentsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all');

  const filtered = MOCK_INCIDENTS.filter(
    (i) => filterSeverity === 'all' || i.severity === filterSeverity
  );
  const selectedIncident = MOCK_INCIDENTS.find((i) => i.id === selected);

  const byCategory = MOCK_INCIDENTS.reduce<Record<string, number>>((acc, inc) => {
    acc[inc.category] = (acc[inc.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-900 via-pink-900 to-purple-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-rose-300 mb-1">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • Patient Safety Incident Reporting System
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Báo Cáo Sự Cố An Toàn Bệnh Nhân</h1>
            <p className="text-rose-100 text-sm mt-1">
              Ghi nhận, phân tích nguyên nhân gốc rễ (RCA) và triển khai hành động khắc phục các sự cố an toàn nội trú.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black">{MOCK_INCIDENTS.length}</div>
              <div className="text-[10px] text-white/70 font-semibold">Tháng này</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-amber-300">{MOCK_INCIDENTS.filter((i) => i.status === 'investigating').length}</div>
              <div className="text-[10px] text-amber-200/80 font-semibold">Đang điều tra</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-rose-300">{MOCK_INCIDENTS.filter((i) => i.severity === 'severe' || i.severity === 'sentinel').length}</div>
              <div className="text-[10px] text-rose-200/80 font-semibold">Mức độ nặng+</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary by Category */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(byCategory) as [IncidentCategory, number][]).map(([cat, count]) => {
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <div key={cat} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                {cfg.icon}
              </div>
              <div>
                <div className="font-black text-slate-900 text-lg">{count}</div>
                <div className="text-xs text-slate-500">{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter + New */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterSeverity('all')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterSeverity === 'all' ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>Tất cả</button>
          {(['moderate', 'severe', 'sentinel'] as IncidentSeverity[]).map((sev) => (
            <button key={sev} onClick={() => setFilterSeverity(sev)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterSeverity === sev ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
              {SEVERITY_CONFIG[sev].label}
            </button>
          ))}
        </div>
        <button className="flex items-center space-x-1.5 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow transition-all">
          <Plus className="w-3.5 h-3.5" />
          <span>Báo cáo sự cố mới</span>
        </button>
      </div>

      {/* Incident List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-3">
          {filtered.map((inc) => {
            const sevCfg = SEVERITY_CONFIG[inc.severity];
            const stCfg = STATUS_CONFIG[inc.status];
            const catCfg = CATEGORY_CONFIG[inc.category];
            return (
              <button
                key={inc.id}
                onClick={() => setSelected(inc.id === selected ? null : inc.id)}
                className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${selected === inc.id ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className={`flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded border ${sevCfg.bg} ${sevCfg.color}`}>
                    {catCfg.icon}
                    <span>{sevCfg.label}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stCfg.color}`}>{stCfg.label}</span>
                </div>
                <div className="font-semibold text-slate-800 text-xs mt-1 line-clamp-2">{inc.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">{inc.patientName} · {inc.wardBed}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{new Date(inc.incidentDate).toLocaleDateString('vi-VN')}</div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {selectedIncident ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-slate-400">{selectedIncident.reportNo}</div>
                  <h3 className="font-bold text-slate-900 text-base mt-0.5">{selectedIncident.title}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Báo cáo bởi: {selectedIncident.reportedBy} · {new Date(selectedIncident.reportedAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${STATUS_CONFIG[selectedIncident.status].color}`}>
                  {STATUS_CONFIG[selectedIncident.status].label}
                </span>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Mô tả sự cố</div>
                  <div className="text-xs text-slate-700">{selectedIncident.description}</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="text-[10px] font-black text-blue-600 uppercase mb-1">Hành động xử lý ngay</div>
                  <div className="text-xs text-blue-800">{selectedIncident.immediateAction}</div>
                </div>
                {selectedIncident.rootCauses.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <div className="text-[10px] font-black text-amber-700 uppercase mb-2">Nguyên nhân gốc rễ (RCA)</div>
                    <ul className="space-y-1">
                      {selectedIncident.rootCauses.map((rc, i) => (
                        <li key={i} className="text-xs text-amber-800 flex items-start space-x-1.5">
                          <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" />
                          <span>{rc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedIncident.correctiveActions.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <div className="text-[10px] font-black text-emerald-700 uppercase mb-2">Hành động khắc phục</div>
                    <ul className="space-y-1">
                      {selectedIncident.correctiveActions.map((ca, i) => (
                        <li key={i} className="text-xs text-emerald-800 flex items-start space-x-1.5">
                          <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-600" />
                          <span>{ca}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl h-full min-h-[300px] flex items-center justify-center">
              <div className="text-center text-slate-400">
                <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chọn sự cố để xem chi tiết RCA</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
