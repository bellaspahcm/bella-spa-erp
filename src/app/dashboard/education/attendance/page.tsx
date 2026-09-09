/**
 * Bella Education — Daily Roll-Call & Safe Pickup Verification
 *
 * Synchronized style: Unified Header, 2 Column Responsive Grid, Harmonized Theme.
 */

import Link from 'next/link';
import { 
  CalendarCheck, 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Thermometer,
  QrCode,
  Sparkles,
  UserCheck,
  BellRing
} from 'lucide-react';

const ROLL_CALL_DATA = [
  {
    id: 'STU-001',
    name: 'Nguyễn Minh An (Bé Bi)',
    className: 'Lớp Mầm A1',
    checkInTime: '07:45 AM',
    temp: '36.5°C',
    tempStatus: 'normal',
    status: 'Present',
    pickupPerson: 'Nguyễn Văn Hùng (Bố)',
    pickupVerified: true,
  },
  {
    id: 'STU-002',
    name: 'Trần Bảo Ngọc (Bé Bắp)',
    className: 'Lớp Mầm A1',
    checkInTime: '07:50 AM',
    temp: '36.6°C',
    tempStatus: 'normal',
    status: 'Present',
    pickupPerson: 'Lê Thị Thu Hương (Mẹ)',
    pickupVerified: true,
  },
  {
    id: 'STU-003',
    name: 'Phạm Hoàng Nam (Bé Bin)',
    className: 'Lớp Mầm A1',
    checkInTime: '08:10 AM',
    temp: '37.8°C (Cảnh báo)',
    tempStatus: 'warning',
    status: 'Present',
    pickupPerson: 'Phạm Quốc Bảo (Bố)',
    pickupVerified: true,
  },
  {
    id: 'STU-004',
    name: 'Lê Hoàng Yến (Bé Na)',
    className: 'Lớp Mầm A1',
    checkInTime: '---',
    temp: '---',
    tempStatus: 'none',
    status: 'Excused',
    pickupPerson: 'Đã báo vắng (Bệnh sốt)',
    pickupVerified: false,
  },
];

export default function AttendancePage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Unified Page Header ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Điểm Danh & Đưa Đón Bé An Toàn
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ghi nhận điểm danh buổi sáng, kiểm tra thân nhiệt và xác thực QR đưa đón chính chủ
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold px-3.5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              📅 Thứ Tư, 09/09/2026
            </span>
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95">
              <CheckCircle2 className="w-4 h-4" />
              <span>Điểm Danh Nhanh</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button className="px-4 py-2 rounded-2xl text-xs font-bold bg-amber-500 text-white shadow-sm transition-colors whitespace-nowrap">
              Lớp Mầm A1 (22/23)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Lớp Chồi B1 (24/24)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Lớp Lá C1 (25/25)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Nhà Trẻ N1 (15/15)
            </button>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm tên bé..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── 2 Column Grid: Left Table, Right Pickup Safety Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Roll-Call Table */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                Danh Sách Điểm Danh Buổi Sáng
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
              Sĩ Số 22/23
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200/80 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-5">Học Sinh</th>
                  <th className="py-3.5 px-3">Giờ Đến</th>
                  <th className="py-3.5 px-3">Thân Nhiệt</th>
                  <th className="py-3.5 px-4 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs text-gray-700 dark:text-gray-300">
                {ROLL_CALL_DATA.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-gray-900 dark:text-white">
                      <div>
                        <p className="text-xs">{row.name}</p>
                        <span className="text-[10px] text-gray-400 font-normal">{row.id}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">
                      {row.checkInTime}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        row.tempStatus === 'warning' 
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' 
                          : row.tempStatus === 'normal'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}>
                        <Thermometer className="w-3 h-3" />
                        {row.temp}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {row.status === 'Present' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Có Mặt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                          <XCircle className="w-3 h-3" />
                          Có Phép
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Safe Pickup Panel */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                  Ủy Quyền Đưa Đón & Quét QR An Toàn
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Xác thực danh tính phụ huynh đón bé buổi chiều
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {ROLL_CALL_DATA.map((row) => (
                <div 
                  key={row.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                      {row.name}
                    </h4>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300">
                      Người đón: <strong>{row.pickupPerson}</strong>
                    </p>
                    {row.pickupVerified && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <QrCode className="w-3 h-3" /> QR Xác Thực Chính Chủ
                      </span>
                    )}
                  </div>

                  <button className="px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all shrink-0">
                    Xác Nhận Đón
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-1 text-xs">
            <p className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-indigo-500" />
              Quy Trình An Toàn Đưa Đón:
            </p>
            <p className="text-indigo-800 dark:text-indigo-400 leading-relaxed text-[11px]">
              Mọi trường hợp thay đổi người đưa đón bất ngờ phải được Phụ huynh xác nhận qua ứng dụng Zalo / Sổ liên lạc điện tử trước 15:30.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
