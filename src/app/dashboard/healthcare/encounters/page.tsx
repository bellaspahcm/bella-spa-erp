'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Plus, Search, ArrowRight, Calendar, User, UserCheck, HelpCircle, Activity, CheckCircle, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface Encounter {
  readonly id: string;
  readonly patientName: string;
  readonly doctorName: string;
  readonly status: 'planned' | 'arrived' | 'in_progress' | 'finished';
  readonly chiefComplaint: string;
  readonly queueNumber?: number;
  readonly scheduledAt?: string;
}

export default function EncountersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearchParam = searchParams.get('search') || searchParams.get('patient') || '';
  const shouldOpenNew = searchParams.get('new') === 'true';

  const [searchQuery, setSearchQuery] = useState(initialSearchParam);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(shouldOpenNew);

  // Sync searchParams when URL changes
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('patient');
    if (q) {
      setSearchQuery(q);
    }
    if (searchParams.get('new') === 'true') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  // Form states
  const [patientName, setPatientName] = useState(initialSearchParam || 'Nguyễn Văn Hùng');
  const [doctorName, setDoctorName] = useState('Lê Minh');
  const [status, setStatus] = useState<'planned' | 'arrived' | 'in_progress' | 'finished'>('planned');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [queueNumber, setQueueNumber] = useState('104');
  const [scheduledAt, setScheduledAt] = useState('');

  const [encounters, setEncounters] = useState<Encounter[]>([
    {
      id: 'enc-01',
      patientName: 'Nguyễn Văn Hùng',
      doctorName: 'Lê Minh',
      status: 'in_progress',
      chiefComplaint: 'Đau răng hàm trái #36',
      queueNumber: 102,
    },
    {
      id: 'enc-02',
      patientName: 'Lê Thị Mai',
      doctorName: 'Trần Thảo',
      status: 'arrived',
      chiefComplaint: 'Tái khám bọc sứ #11, #21',
      queueNumber: 103,
    },
    {
      id: 'enc-03',
      patientName: 'Trần Minh Hoàng',
      doctorName: 'Lê Minh',
      status: 'planned',
      chiefComplaint: 'Nhổ răng khôn #38',
      scheduledAt: '2026-08-05T14:30',
    },
    {
      id: 'enc-04',
      patientName: 'Nguyễn Văn Hùng',
      doctorName: 'BS. Trần Thảo',
      status: 'finished',
      chiefComplaint: 'Vệ sinh cạo vôi răng 2 hàm',
      queueNumber: 88,
    },
  ]);

  const patientOptions = [
    { value: 'Nguyễn Văn Hùng', label: 'Nguyễn Văn Hùng (GD4797921800124)' },
    { value: 'Lê Thị Mai', label: 'Lê Thị Mai (DN4797921800567)' },
    { value: 'Trần Minh Hoàng', label: 'Trần Minh Hoàng (CC037095000214)' },
  ];

  const doctorOptions = [
    { value: 'Lê Minh', label: 'BS. Lê Minh (Nha sĩ Trưởng)' },
    { value: 'Trần Thảo', label: 'BS. Trần Thảo (Chuyên gia phục hình)' },
  ];

  const statusOptions = [
    { value: 'planned', label: 'Lên lịch hẹn' },
    { value: 'arrived', label: 'Phòng chờ (Queue)' },
    { value: 'in_progress', label: 'Đang điều trị' },
    { value: 'finished', label: 'Đã hoàn tất' },
  ];

  const handleRegisterEncounter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chiefComplaint.trim()) {
      toast.error('Vui lòng nhập lý do khám bệnh');
      return;
    }

    const newEnc: Encounter = {
      id: `enc-${Date.now()}`,
      patientName,
      doctorName,
      status,
      chiefComplaint,
      queueNumber: ['arrived', 'in_progress'].includes(status) ? Number(queueNumber) : undefined,
      scheduledAt: status === 'planned' ? scheduledAt || new Date().toISOString().slice(0, 16) : undefined,
    };

    setEncounters((prev) => [newEnc, ...prev]);
    toast.success('🎉 Đăng ký lượt khám bệnh mới thành công');
    
    // Reset form
    setChiefComplaint('');
    setQueueNumber((prev) => String(Number(prev) + 1));
    setScheduledAt('');
    setShowAddModal(false);
  };

  const filtered = encounters.filter((e) => {
    const matchesSearch =
      e.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.chiefComplaint.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Encounter['status']) => {
    switch (status) {
      case 'planned':
        return <span className="px-2.5 py-1 text-[10px] font-black bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 rounded-full">LÊN LỊCH</span>;
      case 'arrived':
        return <span className="px-2.5 py-1 text-[10px] font-black bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 rounded-full">PHÒNG CHỜ</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 text-[10px] font-black bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/60 rounded-full">ĐANG KHÁM</span>;
      case 'finished':
        return <span className="px-2.5 py-1 text-[10px] font-black bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 rounded-full">ĐÃ HOÀN TẤT</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative p-6 md:p-7 rounded-[28px] hc-glass-card hc-glass-card-hover flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-200/90 dark:border-slate-800/90 shadow-xl">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white font-extrabold text-xl shadow-lg shadow-teal-500/25 ring-4 ring-teal-500/20 dark:ring-teal-500/30">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Nhật ký Lâm sàng (Encounters)
              </span>
              {searchQuery && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200">
                  Lọc: {searchQuery}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Lịch sử & Lượt khám bệnh
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Theo dõi toàn bộ lịch sử các đợt khám bệnh, chẩn đoán và diễn biến lâm sàng của bệnh nhân
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-teal-500/25 transition-all active:scale-95 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo lượt khám mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl hc-glass-card border border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Tên bệnh nhân, Bác sĩ hoặc Lý do..."
            className="w-full pl-11 pr-8 py-2.5 text-xs font-medium rounded-xl border border-slate-200/80 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900/90 dark:border-slate-800 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible py-2 px-1 shrink-0 scrollbar-none">
          {[
            { value: 'all', label: 'Tất cả' },
            { value: 'planned', label: 'Lên lịch' },
            { value: 'arrived', label: 'Phòng chờ' },
            { value: 'in_progress', label: 'Đang khám' },
            { value: 'finished', label: 'Đã hoàn tất' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl border transition-all whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="rounded-[28px] hc-glass-card hc-glass-card-hover border border-slate-200/90 dark:border-slate-800/90 shadow-xl p-1">
        <div className="overflow-x-auto rounded-[24px]">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100/60 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-extrabold uppercase tracking-wider">
                <th className="p-4.5">Stt / Lịch hẹn</th>
                <th className="p-4.5">Bệnh nhân</th>
                <th className="p-4.5">Bác sĩ phụ trách</th>
                <th className="p-4.5">Lý do khám bệnh</th>
                <th className="p-4.5">Trạng thái</th>
                <th className="p-4.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
              {filtered.length > 0 ? (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-teal-50/30 dark:hover:bg-slate-900/50 transition-all group">
                    <td className="p-4.5 font-bold text-slate-900 dark:text-white">
                      {e.status === 'planned' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-mono text-[11px]">
                          <Clock className="w-3.5 h-3.5" />
                          {e.scheduledAt ? e.scheduledAt.replace('T', ' ') : '—'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-mono text-[11px] font-bold">
                          Stt: #{e.queueNumber}
                        </span>
                      )}
                    </td>
                    <td className="p-4.5 font-black text-slate-900 dark:text-white text-sm">
                      {e.patientName}
                    </td>
                    <td className="p-4.5 font-bold text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{e.doctorName}</span>
                      </div>
                    </td>
                    <td className="p-4.5 font-semibold text-slate-800 dark:text-slate-200">
                      {e.chiefComplaint}
                    </td>
                    <td className="p-4.5">{getStatusBadge(e.status)}</td>
                    <td className="p-4.5 text-right">
                      <button 
                        onClick={() => router.push(`/dashboard/healthcare/encounters/${e.id}`)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                      >
                        <span>Chi tiết</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-medium">
                    Không tìm thấy lượt khám bệnh nào phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-7 text-left animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600">
                  <ClipboardList className="w-5 h-5" />
                </span>
                Đăng ký Lượt khám bệnh mới
              </h3>
              <span className="text-xs text-slate-400 font-semibold">Tạo đợt khám</span>
            </div>

            <form onSubmit={handleRegisterEncounter} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">Bệnh nhân khám *</label>
                <PremiumSelect
                  options={patientOptions}
                  value={patientName}
                  onChange={setPatientName}
                  placeholder="Chọn bệnh nhân..."
                  buttonClassName="py-3 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">Trạng thái khám *</label>
                  <PremiumSelect
                    options={statusOptions}
                    value={status}
                    onChange={(val) => setStatus(val as any)}
                    placeholder="Trạng thái..."
                    buttonClassName="py-3 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                {status === 'planned' ? (
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">Lịch hẹn lúc</label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">Số thứ tự (Stt)</label>
                    <input
                      type="number"
                      required
                      value={queueNumber}
                      onChange={(e) => setQueueNumber(e.target.value)}
                      placeholder="Số thứ tự..."
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">Lý do khám bệnh *</label>
                <textarea
                  required
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Ghi nhận lý do khám lâm sàng..."
                  className="w-full min-h-[70px] p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium resize-none"
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
                  Đăng ký lượt khám
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

