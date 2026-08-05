'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Shield, Search, ArrowRight, UserPlus, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface Patient {
  readonly id: string;
  readonly name: string;
  readonly gender: 'male' | 'female' | 'other';
  readonly dob: string;
  readonly bhyt?: string;
  readonly cccd?: string;
  readonly phone: string;
  readonly relationships: Array<{
    readonly targetName: string;
    readonly type: string;
  }>;
}

export default function PatientsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [bhyt, setBhyt] = useState('');
  const [cccd, setCccd] = useState('');

  const genderOptions = [
    { value: 'male', label: 'Nam' },
    { value: 'female', label: 'Nữ' },
    { value: 'other', label: 'Khác' },
  ];

  const [patients, setPatients] = useState<Patient[]>([
    {
      id: 'pat-01',
      name: 'Nguyễn Văn Hùng',
      gender: 'male',
      dob: '1995-10-12',
      bhyt: 'GD4797921800124',
      cccd: '037095000214',
      phone: '0912345678',
      relationships: [{ targetName: 'Nguyễn Văn A', type: 'Con trai' }],
    },
    {
      id: 'pat-02',
      name: 'Lê Thị Mai',
      gender: 'female',
      dob: '2001-04-20',
      bhyt: 'DN4797921800567',
      cccd: '038096001234',
      phone: '0987654321',
      relationships: [{ targetName: 'Trần Thị C', type: 'Mẹ đẻ' }],
    },
  ]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dob || !phone) {
      toast.error('Vui lòng điền đầy đủ Họ tên, Ngày sinh và Số điện thoại');
      return;
    }

    const newPat: Patient = {
      id: `pat-${Date.now()}`,
      name,
      gender,
      dob,
      phone,
      bhyt: bhyt || undefined,
      cccd: cccd || undefined,
      relationships: [],
    };

    setPatients((prev) => [newPat, ...prev]);
    toast.success('🎉 Đăng ký bệnh nhân mới thành công');
    
    // Reset form
    setName('');
    setDob('');
    setPhone('');
    setBhyt('');
    setCccd('');
    setShowAddModal(false);
  };

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      (p.bhyt && p.bhyt.includes(searchQuery))
  );

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 shadow-sm">
            <Users className="w-5 h-5" />
          </span>
          <div className="text-left">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Hồ sơ Bệnh nhân (Parties)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý định danh y tế và thông tin hành chính của bệnh nhân phòng khám
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Đăng ký Bệnh nhân mới
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center gap-3 p-4 rounded-[16px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-[0_4px_12px_-1px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bệnh nhân theo Tên, Số điện thoại hoặc Mã BHYT..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Patients Table / List */}
      <div className="rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold">
              <th className="p-4">Họ và Tên</th>
              <th className="p-4">Ngày sinh</th>
              <th className="p-4">Giới tính</th>
              <th className="p-4">Số điện thoại</th>
              <th className="p-4">Mã BHYT</th>
              <th className="p-4">Mã CCCD</th>
              <th className="p-4">Mối quan hệ</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filtered.length > 0 ? (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-all font-medium text-slate-700 dark:text-slate-300">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                  <td className="p-4">{p.dob}</td>
                  <td className="p-4 uppercase">{p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : 'Khác'}</td>
                  <td className="p-4">{p.phone}</td>
                  <td className="p-4">
                    {p.bhyt ? (
                      <span className="flex items-center gap-1 text-teal-600 font-mono">
                        <Shield className="w-3 h-3" />
                        {p.bhyt}
                      </span>
                    ) : (
                      <span className="text-slate-400">Chưa cập nhật</span>
                    )}
                  </td>
                  <td className="p-4 font-mono">{p.cccd || <span className="text-slate-400">Chưa cập nhật</span>}</td>
                  <td className="p-4">
                    {p.relationships.length > 0 ? (
                      p.relationships.map((r, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-md text-[10px]">
                          {r.type}: {r.targetName}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => router.push(`/dashboard/healthcare/patients/${p.id}`)}
                      className="text-teal-600 hover:text-teal-700 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      Chi tiết <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  Không tìm thấy bệnh nhân nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-left animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-600" />
              Đăng ký Bệnh nhân mới
            </h3>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập họ và tên bệnh nhân..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Ngày sinh *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Giới tính</label>
                  <PremiumSelect
                    options={genderOptions}
                    value={gender}
                    onChange={(val) => setGender(val as 'male' | 'female' | 'other')}
                    placeholder="Chọn giới tính..."
                    buttonClassName="py-2.5 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Số điện thoại liên hệ..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Số thẻ BHYT (nếu có)</label>
                  <input
                    type="text"
                    value={bhyt}
                    onChange={(e) => setBhyt(e.target.value)}
                    placeholder="Mã số BHYT..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Số CCCD (nếu có)</label>
                  <input
                    type="text"
                    value={cccd}
                    onChange={(e) => setCccd(e.target.value)}
                    placeholder="Mã số CCCD..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
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
                  Xác nhận đăng ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
