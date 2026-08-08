'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Plus,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

// ─── Safety Audit Types ───────────────────────────────────────────────────────
type AuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';
type AuditCategory = 'hand_hygiene' | 'medication_safety' | 'infection_control' | 'fall_prevention' | 'documentation' | 'emergency_response';

interface AuditChecklistItem {
  id: string;
  criterion: string;
  standard: string;
  result: 'compliant' | 'partial' | 'non_compliant' | 'na';
  finding: string;
}

interface SafetyAudit {
  id: string;
  auditNo: string;
  title: string;
  category: AuditCategory;
  targetWard: string;
  auditor: string;
  scheduledDate: string;
  completedDate: string | null;
  status: AuditStatus;
  overallScore: number | null;
  totalItems: number;
  compliantItems: number;
  checklist: AuditChecklistItem[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_AUDITS: SafetyAudit[] = [
  {
    id: 'aud-001',
    auditNo: 'AUD-2026-08-001',
    title: 'Kiểm toán Vệ Sinh Tay & Phòng Ngừa KSNK — Khoa ICU',
    category: 'hand_hygiene',
    targetWard: 'Khoa ICU',
    auditor: 'ThS. Phạm Thị Lan — Ủy ban KSNK',
    scheduledDate: '2026-08-05',
    completedDate: '2026-08-05',
    status: 'completed',
    overallScore: 78,
    totalItems: 10,
    compliantItems: 7,
    checklist: [
      { id: 'ci-01', criterion: 'Rửa tay đúng 6 bước WHO trước chăm sóc BN', standard: 'WHO Hand Hygiene 5 Moments', result: 'compliant', finding: 'Tất cả nhân viên thực hiện đúng.' },
      { id: 'ci-02', criterion: 'Sử dụng dung dịch sát khuẩn tay nhanh đúng vị trí', standard: 'WHO / JCI', result: 'compliant', finding: 'Bình rửa tay đầy đủ, dễ tiếp cận.' },
      { id: 'ci-03', criterion: 'Thay găng tay giữa các bệnh nhân', standard: 'CDC 2024', result: 'partial', finding: '2/8 quan sát không thay găng giữa BN liền kề.' },
      { id: 'ci-04', criterion: 'Tuân thủ quy trình đặt và chăm sóc catheter trung tâm (CLABSI bundle)', standard: 'IHI CLABSI Bundle', result: 'non_compliant', finding: 'Thiếu check-list xác nhận khi đặt CVC. 1 trường hợp không dùng tấm drap toàn thân.' },
      { id: 'ci-05', criterion: 'Thay bộ dây truyền dịch đúng lịch (96h)', standard: 'CDC IV Bundle', result: 'compliant', finding: 'Có dán nhãn ngày thay đầy đủ.' },
    ],
  },
  {
    id: 'aud-002',
    auditNo: 'AUD-2026-08-002',
    title: 'Kiểm toán An Toàn Dùng Thuốc — Khoa Nội Tổng Hợp',
    category: 'medication_safety',
    targetWard: 'Khoa Nội Tổng Hợp',
    auditor: 'DS. Nguyễn Thị Mai — Khoa Dược',
    scheduledDate: '2026-08-07',
    completedDate: null,
    status: 'in_progress',
    overallScore: null,
    totalItems: 8,
    compliantItems: 0,
    checklist: [
      { id: 'ci-11', criterion: 'Ghi y lệnh điện tử đầy đủ (liều, đường dùng, tần suất)', standard: 'ISMP 2024', result: 'compliant', finding: 'Hệ thống e-prescription hoạt động tốt.' },
      { id: 'ci-12', criterion: 'Double-check thuốc có nguy cơ cao trước khi dùng', standard: 'ISMP High-Alert Medications', result: 'na', finding: 'Chưa kiểm tra — đang audit.' },
    ],
  },
  {
    id: 'aud-003',
    auditNo: 'AUD-2026-08-003',
    title: 'Kiểm toán Phòng Ngừa Té Ngã — Khoa Tim Mạch',
    category: 'fall_prevention',
    targetWard: 'Khoa Tim Mạch',
    auditor: 'ĐD. Trưởng khoa Hường',
    scheduledDate: '2026-08-10',
    completedDate: null,
    status: 'scheduled',
    overallScore: null,
    totalItems: 6,
    compliantItems: 0,
    checklist: [],
  },
  {
    id: 'aud-004',
    auditNo: 'AUD-2026-07-005',
    title: 'Kiểm toán Hồ Sơ Bệnh Án & Tài Liệu Lâm Sàng — Khoa Ngoại',
    category: 'documentation',
    targetWard: 'Khoa Ngoại',
    auditor: 'BS. Chất lượng Hoài',
    scheduledDate: '2026-07-25',
    completedDate: null,
    status: 'overdue',
    overallScore: null,
    totalItems: 12,
    compliantItems: 0,
    checklist: [],
  },
];

const CATEGORY_CONFIG: Record<AuditCategory, { label: string; color: string }> = {
  hand_hygiene:       { label: 'Vệ sinh tay',       color: 'bg-blue-100 text-blue-800 border-blue-200' },
  medication_safety:  { label: 'An toàn thuốc',     color: 'bg-purple-100 text-purple-800 border-purple-200' },
  infection_control:  { label: 'Kiểm soát NK',      color: 'bg-rose-100 text-rose-800 border-rose-200' },
  fall_prevention:    { label: 'Phòng ngừa ngã',    color: 'bg-amber-100 text-amber-800 border-amber-200' },
  documentation:      { label: 'Hồ sơ tài liệu',   color: 'bg-teal-100 text-teal-800 border-teal-200' },
  emergency_response: { label: 'Đáp ứng cấp cứu',  color: 'bg-orange-100 text-orange-800 border-orange-200' },
};

const STATUS_CONFIG: Record<AuditStatus, { label: string; color: string }> = {
  scheduled:   { label: 'Lên kế hoạch', color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'Đang kiểm toán', color: 'bg-blue-100 text-blue-800' },
  completed:   { label: 'Hoàn thành',   color: 'bg-emerald-100 text-emerald-800' },
  overdue:     { label: 'Quá hạn',      color: 'bg-rose-100 text-rose-800' },
};

const RESULT_CONFIG = {
  compliant:     { label: 'Tuân thủ',    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200' },
  partial:       { label: 'Tuân thủ 1 phần', icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, color: 'bg-amber-50 border-amber-200' },
  non_compliant: { label: 'Không tuân thủ', icon: <XCircle className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 border-rose-200' },
  na:            { label: 'Không áp dụng', icon: <Clock className="w-4 h-4 text-slate-400" />, color: 'bg-slate-50 border-slate-200' },
};

export default function HospitalSafetyAuditPage() {
  const [selected, setSelected] = useState<string | null>('aud-001');

  const selectedAudit = MOCK_AUDITS.find((a) => a.id === selected);
  const completedAudits = MOCK_AUDITS.filter((a) => a.status === 'completed').length;
  const overdueAudits = MOCK_AUDITS.filter((a) => a.status === 'overdue').length;
  const avgScore = Math.round(
    MOCK_AUDITS.filter((a) => a.overallScore !== null).reduce((s, a) => s + (a.overallScore ?? 0), 0) /
    Math.max(1, MOCK_AUDITS.filter((a) => a.overallScore !== null).length)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-teal-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 mb-1">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • Clinical Safety Audit System (JCI / ISO 15189)
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Kiểm Toán An Toàn Bệnh Viện</h1>
            <p className="text-indigo-100 text-sm mt-1">
              Lên kế hoạch và thực hiện kiểm toán định kỳ theo tiêu chuẩn JCI, WHO, CDC. Theo dõi tuân thủ và hành động khắc phục.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-emerald-300">{completedAudits}</div>
              <div className="text-[10px] text-emerald-200/80 font-semibold">Hoàn thành</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-rose-300">{overdueAudits}</div>
              <div className="text-[10px] text-rose-200/80 font-semibold">Quá hạn</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-amber-300">{avgScore}%</div>
              <div className="text-[10px] text-amber-200/80 font-semibold">Điểm tuân thủ TB</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Audit List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-slate-700 text-sm">Danh sách kiểm toán</h3>
            <button className="flex items-center space-x-1 text-xs text-indigo-700 font-semibold hover:text-indigo-900">
              <Plus className="w-3.5 h-3.5" />
              <span>Lên lịch mới</span>
            </button>
          </div>
          {MOCK_AUDITS.map((audit) => {
            const catCfg = CATEGORY_CONFIG[audit.category];
            const stCfg = STATUS_CONFIG[audit.status];
            return (
              <button
                key={audit.id}
                onClick={() => setSelected(audit.id === selected ? null : audit.id)}
                className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${
                  selected === audit.id ? 'border-indigo-500 ring-2 ring-indigo-200' :
                  audit.status === 'overdue' ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${catCfg.color}`}>{catCfg.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stCfg.color}`}>{stCfg.label}</span>
                </div>
                <div className="font-semibold text-slate-800 text-xs line-clamp-2">{audit.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">{audit.targetWard}</div>
                <div className="text-[11px] text-slate-400">{audit.scheduledDate}</div>
                {audit.overallScore !== null && (
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${audit.overallScore >= 80 ? 'bg-emerald-500' : audit.overallScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${audit.overallScore}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-600">{audit.overallScore}%</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Audit Detail */}
        <div className="lg:col-span-2">
          {selectedAudit ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
              <div>
                <div className="text-xs text-slate-400">{selectedAudit.auditNo}</div>
                <h3 className="font-bold text-slate-900 text-base mt-0.5">{selectedAudit.title}</h3>
                <div className="text-xs text-slate-500 mt-1">
                  <strong>Khoa:</strong> {selectedAudit.targetWard} · <strong>Kiểm toán viên:</strong> {selectedAudit.auditor}
                </div>
              </div>

              {selectedAudit.overallScore !== null && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-800 text-sm">Điểm tuân thủ tổng thể</span>
                    <span className={`text-2xl font-black ${selectedAudit.overallScore >= 80 ? 'text-emerald-700' : selectedAudit.overallScore >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>
                      {selectedAudit.overallScore}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${selectedAudit.overallScore >= 80 ? 'bg-emerald-500' : selectedAudit.overallScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${selectedAudit.overallScore}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {selectedAudit.compliantItems}/{selectedAudit.totalItems} tiêu chí tuân thủ
                    {selectedAudit.overallScore < 80 && (
                      <span className="text-amber-700 font-semibold ml-2">— Cần cải thiện (ngưỡng tối thiểu 80%)</span>
                    )}
                  </div>
                </div>
              )}

              {selectedAudit.checklist.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-sm">Kết quả từng tiêu chí</h4>
                  {selectedAudit.checklist.map((item) => {
                    const rc = RESULT_CONFIG[item.result];
                    return (
                      <div key={item.id} className={`border rounded-xl p-3 ${rc.color}`}>
                        <div className="flex items-start space-x-2">
                          <div className="shrink-0 mt-0.5">{rc.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 text-xs">{item.criterion}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">Tiêu chuẩn: {item.standard}</div>
                            {item.finding && (
                              <div className="text-xs text-slate-700 mt-1 italic">{item.finding}</div>
                            )}
                          </div>
                          <span className={`shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded ${rc.color}`}>{rc.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedAudit.checklist.length === 0 && selectedAudit.status === 'scheduled' && (
                <div className="text-center py-8 text-slate-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Chưa bắt đầu kiểm toán</p>
                  <button className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow transition-all">
                    Bắt đầu kiểm toán
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl h-full min-h-[300px] flex items-center justify-center">
              <div className="text-center text-slate-400">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chọn cuộc kiểm toán để xem chi tiết</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
