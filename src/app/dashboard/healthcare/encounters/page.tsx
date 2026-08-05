'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, Search, ArrowRight, Calendar, User, UserCheck, HelpCircle, Activity, CheckCircle, Clock } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [patientName, setPatientName] = useState('Nguyễn Văn Hùng');
  const [doctorName, setDoctorName] = useState('BS. Lê Minh');
  const [status, setStatus] = useState<'planned' | 'arrived' | 'in_progress' | 'finished'>('planned');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [queueNumber, setQueueNumber] = useState('104');
  const [scheduledAt, setScheduledAt] = useState('');

  const [encounters, setEncounters] = useState<Encounter[]>([
    {
      id: 'enc-01',
      patientName: 'Nguyễn Văn Hùng',
      doctorName: 'BS. Lê Minh',
      status: 'in_progress',
      chiefComplaint: 'Đau răng hàm trái',
      queueNumber: 102,
    },
    {
      id: 'enc-02',
      patientName: 'Lê Thị Mai',
      doctorName: 'BS. Trần Thảo',
      status: 'arrived',
      chiefComplaint: 'Tái khám bọc sứ',
      queueNumber: 103,
    },
    {
      id: 'enc-03',
      patientName: 'Trần Minh Hoàng',
      doctorName: 'BS. Lê Minh',
      status: 'planned',
      chiefComplaint: 'Nhổ răng khôn #38',
      scheduledAt: '2026-08-05T14:30',
    },
  ]);

  const patientOptions = [
    { value: 'Nguyễn Văn Hùng', label: 'Nguyễn Văn Hùng (GD4797921800124)' },
    { value: 'Lê Thị Mai', label: 'Lê Thị Mai (DN4797921800567)' },
    { value: 'Trần Minh Hoàng', label: 'Trần Minh Hoàng (CC037095000214)' },
  ];

  const doctorOptions = [
    { value: 'BS. Lê Minh', label: 'BS. Lê Minh (Nha sĩ Trưởng)' },
    { value: 'BS. Trần Thảo', label: 'BS. Trần Thảo (Chuyên gia phục hình)' },
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
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 rounded-md">LÊN LỊCH</span>;
      case 'arrived':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 rounded-md">PHÒNG CHỜ</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-600 dark:bg-teal-950/20 dark:text-teal-400 border border-teal-100 rounded-md">ĐANG KHÁM</span>;
      case 'finished':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 rounded-md">ĐÃ HOÀN TẤT</span>;
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 shadow-sm">
            <ClipboardList className="w-5 h-5" />
          </span>
          <div className="text-left">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Quản lý lượt khám bệnh (Encounters)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Theo dõi lịch sử khám, ghi nhận lý do điều trị và chỉ định bác sĩ phụ trách
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Tạo lượt khám mới
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-[16px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-[0_4px_12px_-1px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Tên bệnh nhân, Bác sĩ hoặc Lý do..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { value: 'all', label: 'Tất cả' },
            { value: 'planned', label: 'Lên lịch hẹn' },
            { value: 'arrived', label: 'Phòng chờ' },
            { value: 'in_progress', label: 'Đang điều trị' },
            { value: 'finished', label: 'Đã hoàn tất' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                statusFilter === tab.value
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-850'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800 text-slate-500 font-bold">
              <th className="p-4">Stt/Lịch hẹn</th>
              <th className="p-4">Bệnh nhân</th>
              <th className="p-4">Bác sĩ phụ trách</th>
              <th className="p-4">Lý do khám bệnh</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
            {filtered.length > 0 ? (
              filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-all">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">
                    {e.status === 'planned' ? (
                      <span className="flex items-center gap-1.5 font-mono text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        {e.scheduledAt ? e.scheduledAt.replace('T', ' ') : '—'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-850 rounded font-mono text-[11px]">
                        Stt: {e.queueNumber}
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{e.patientName}</td>
                  <td className="p-4 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {e.doctorName}
                  </td>
                  <td className="p-4">{e.chiefComplaint}</td>
                  <td className="p-4">{getStatusBadge(e.status)}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => router.push(`/dashboard/healthcare/encounters/${e.id}`)}
                      className="text-teal-600 hover:text-teal-700 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      Chi tiết <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Không tìm thấy lượt khám bệnh nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-left animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-600" />
              Đăng ký Lượt khám bệnh mới
            </h3>

            <form onSubmit={handleRegisterEncounter} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Bệnh nhân khám *</label>
                <PremiumSelect
                  options={patientOptions}
                  value={patientName}
                  onChange={setPatientName}
                  placeholder="Chọn bệnh nhân..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Bác sĩ phụ trách *</label>
                <PremiumSelect
                  options={doctorOptions}
                  value={doctorName}
                  onChange={setDoctorName}
                  placeholder="Chỉ định bác sĩ..."
                  buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Trạng thái khám *</label>
                  <PremiumSelect
                    options={statusOptions}
                    value={status}
                    onChange={(val) => setStatus(val as any)}
                    placeholder="Trạng thái..."
                    buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {status === 'planned' ? (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">Lịch hẹn lúc</label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400">Số thứ tự khám (Stt)</label>
                    <input
                      type="number"
                      required
                      value={queueNumber}
                      onChange={(e) => setQueueNumber(e.target.value)}
                      placeholder="Số thứ tự..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono font-semibold"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Lý do khám bệnh *</label>
                <textarea
                  required
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Ghi nhận lý do khám lâm sàng..."
                  className="w-full min-h-[60px] p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all"
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
