/**
 * Bella Education — Preschool Facilities & Asset Management
 *
 * Full viewport width layout, classroom equipment, toy inventory, HVAC, security cameras, and maintenance logs.
 */

import Link from 'next/link';
import { 
  Building2, 
  Plus, 
  Search, 
  ArrowLeft, 
  Wrench, 
  ShieldCheck, 
  Tv, 
  Sparkles,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const FACILITIES_LIST = [
  {
    id: 'FAC-001',
    name: 'Hệ Thống Camera Giám Sát AI & PCCC Tầng 1-3',
    location: 'Toàn bộ Khu vực Trường',
    type: 'An Nông & An Toàn',
    lastCheck: '01/09/2026',
    status: 'Hoạt Động Tốt (100%)',
    theme: {
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
    },
  },
  {
    id: 'FAC-002',
    name: 'Bộ Đồ Chơi Gỗ Montessori & Bể Hạt Gỗ Khối Mầm A1',
    location: 'Phòng 101 • Tầng 1',
    type: 'Thiết Bị Học Tập Mầm Non',
    lastCheck: '05/09/2026 (Khử trùng hàng tuần)',
    status: 'Đã Khử Trùng UVC',
    theme: {
      badgeBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300',
    },
  },
  {
    id: 'FAC-003',
    name: 'Máy Lọc Không Khí Hepa & Điều Hòa Âm Trần Daikin',
    location: '12 Phòng Học & Phòng Ngủ Trưa',
    type: 'Điều Hòa & Môi Trường',
    lastCheck: '15/08/2026',
    status: 'Lịch Bảo Trì Ngày 15/09',
    theme: {
      badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300',
    },
  },
  {
    id: 'FAC-004',
    name: 'Khu Vui Chơi Liên Hoàn Ngoài Trời & Cỏ Nhân Tạo',
    location: 'Sân Trường Trung Tâm',
    type: 'Vận Động Ngoài Trời',
    lastCheck: '30/08/2026',
    status: 'Hoạt Động Tốt',
    theme: {
      badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300',
    },
  },
];

export default function FacilitiesPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Header Banner */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Cơ Sở Vật Chất & Trang Thiết Bị Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quản lý 12 phòng học, thiết bị y tế, khu vui chơi ngoài trời và lịch kiểm định an toàn
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 shrink-0">
            <Wrench className="w-4 h-4" />
            <span>Khai Báo Báo Trì Trang Thiết Bị</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60">
            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Tổng Số Phòng Học</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">12 Phòng</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Thiết Bị Đã Khử Trùng</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">100% Đạt Chuẩn</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60">
            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Camera AI Giám Sát</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">48 Mắt HD</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60">
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Kiểm Định PCCC & An Toàn</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">Đã Duyệt 2026</p>
          </div>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {FACILITIES_LIST.map((fac) => (
          <div key={fac.id} className="p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {fac.type}
                </span>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white mt-1.5">{fac.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Vị trí: <strong className="text-gray-800 dark:text-gray-200">{fac.location}</strong></p>
              </div>
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${fac.theme.badgeBg}`}>
                {fac.status}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 text-xs flex items-center justify-between">
              <span className="text-gray-400 font-medium">Lần kiểm tra gần nhất:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">{fac.lastCheck}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
