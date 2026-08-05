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
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="relative p-6 md:p-7 rounded-[28px] hc-glass-card hc-glass-card-hover flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-200/90 dark:border-slate-800/90 shadow-xl">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white font-extrabold text-xl shadow-lg shadow-teal-500/25 ring-4 ring-teal-500/20 dark:ring-teal-500/30">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Hành chính Y tế (Parties)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Định danh Bệnh nhân
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Hồ sơ Bệnh nhân phòng khám
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Quản lý định danh y tế, mã BHYT, CCCD và mối quan hệ gia đình của bệnh nhân
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-teal-500/25 transition-all active:scale-95 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Đăng ký Bệnh nhân mới</span>
        </button>
      </div>

      {/* Quick Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-[22px] hc-glass-card hc-glass-card-hover border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold block mb-1">Tổng bệnh nhân</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{patients.length}</span>
            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">Đã định danh đầy đủ</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 border border-teal-200/60 dark:border-teal-800/60">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-[22px] hc-glass-card hc-glass-card-hover border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold block mb-1">Thẻ BHYT đã liên kết</span>
            <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
              {patients.filter((p) => p.bhyt).length}
            </span>
            <span className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400 block mt-1">Xác thực CSDL BHYT</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 border border-cyan-200/60 dark:border-cyan-800/60">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-[22px] hc-glass-card hc-glass-card-hover border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-bold block mb-1">Đăng ký mới hôm nay</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              +2
            </span>
            <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1">100% thông tin chuẩn</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/60 dark:border-emerald-800/60">
            <Heart className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl hc-glass-card border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bệnh nhân theo Tên, Số điện thoại hoặc Mã BHYT..."
            className="w-full pl-11 pr-4 py-2.5 text-xs font-medium rounded-xl border border-slate-200/80 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900/90 dark:border-slate-800 dark:text-white"
          />
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
          Hiển thị: {filtered.length} / {patients.length}
        </span>
      </div>

      {/* Patients Table */}
      <div className="rounded-[28px] hc-glass-card hc-glass-card-hover border border-slate-200/90 dark:border-slate-800/90 shadow-xl p-1">
        <div className="overflow-x-auto rounded-[24px]">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100/60 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-extrabold uppercase tracking-wider">
                <th className="p-4.5">Bệnh nhân</th>
                <th className="p-4.5">Ngày sinh / Tuổi</th>
                <th className="p-4.5">Giới tính</th>
                <th className="p-4.5">Số điện thoại</th>
                <th className="p-4.5">Mã BHYT</th>
                <th className="p-4.5">Mã CCCD</th>
                <th className="p-4.5">Mối quan hệ</th>
                <th className="p-4.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
              {filtered.length > 0 ? (
                filtered.map((p) => {
                  const initials = p.name.split(' ').map((n) => n[0]).join('').slice(0, 2);
                  return (
                    <tr key={p.id} className="hover:bg-teal-50/30 dark:hover:bg-slate-900/50 transition-all group">
                      <td className="p-4.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-700 dark:text-teal-300 font-black text-xs flex items-center justify-center border border-teal-500/30 shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div>
                            <span className="font-black text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors block">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {p.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4.5 font-bold text-slate-800 dark:text-slate-200">
                        {p.dob}
                      </td>
                      <td className="p-4.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          p.gender === 'male' 
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60' 
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60'
                        }`}>
                          {p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : 'Khác'}
                        </span>
                      </td>
                      <td className="p-4.5 font-mono font-bold text-slate-900 dark:text-white">
                        {p.phone}
                      </td>
                      <td className="p-4.5">
                        {p.bhyt ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-900/50 font-mono font-bold text-[11px]">
                            <Shield className="w-3.5 h-3.5 text-teal-600" />
                            {p.bhyt}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Chưa cập nhật</span>
                        )}
                      </td>
                      <td className="p-4.5 font-mono font-semibold text-slate-600 dark:text-slate-400">
                        {p.cccd || <span className="text-slate-400">Chưa cập nhật</span>}
                      </td>
                      <td className="p-4.5">
                        {p.relationships.length > 0 ? (
                          p.relationships.map((r, i) => (
                            <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-[10px] font-extrabold inline-block border border-slate-200/60 dark:border-slate-700">
                              {r.type}: {r.targetName}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4.5 text-right">
                        <button 
                          onClick={() => router.push(`/dashboard/healthcare/patients/${p.id}`)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                        >
                          <span>Chi tiết</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400 font-medium">
                    Không tìm thấy bệnh nhân nào khớp với từ khóa tìm kiếm
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl p-7 text-left animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600">
                  <UserPlus className="w-5 h-5" />
                </span>
                Đăng ký Bệnh nhân mới
              </h3>
              <span className="text-xs text-slate-400 font-semibold">Tạo hồ sơ y tế</span>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập đầy đủ họ và tên bệnh nhân..."
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">Ngày sinh *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">Giới tính</label>
                  <PremiumSelect
                    options={genderOptions}
                    value={gender}
                    onChange={(val) => setGender(val as 'male' | 'female' | 'other')}
                    placeholder="Chọn giới tính..."
                    buttonClassName="py-3 px-3 rounded-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Số điện thoại liên hệ chính..."
                  className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">Số thẻ BHYT (nếu có)</label>
                  <input
                    type="text"
                    value={bhyt}
                    onChange={(e) => setBhyt(e.target.value)}
                    placeholder="Mã BHYT..."
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">Số CCCD (nếu có)</label>
                  <input
                    type="text"
                    value={cccd}
                    onChange={(e) => setCccd(e.target.value)}
                    placeholder="Mã CCCD..."
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono"
                  />
                </div>
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

