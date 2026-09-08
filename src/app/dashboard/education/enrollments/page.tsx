/**
 * Bella Education — Student Enrollment & Parent Contacts
 *
 * Synchronized style: Unified Header, 2 Column Card Grid, Full Viewport Width.
 */

import Link from 'next/link';
import { 
  Users, 
  UserPlus, 
  Search, 
  ArrowLeft, 
  Baby, 
  Phone, 
  FileText,
  Heart,
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';

const STUDENTS_LIST = [
  {
    id: 'STU-001',
    name: 'Nguyễn Minh An',
    nickname: 'Bé Bi',
    dob: '15/05/2023',
    age: '3 Tuổi',
    gender: 'Nam',
    className: 'Lớp Mầm A1 — Họa Mi',
    parentName: 'Nguyễn Văn Hùng (Bố)',
    parentPhone: '0988 123 456',
    medicalNote: 'Dị ứng hạt hải sản. Cần lưu ý bữa ăn trưa.',
    status: 'Đang Học',
    theme: {
      cardBorder: 'border-indigo-200/80 dark:border-indigo-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      avatarBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
      primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20',
      secondaryBtn: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100',
    },
  },
  {
    id: 'STU-002',
    name: 'Trần Bảo Ngọc',
    nickname: 'Bé Bắp',
    dob: '20/11/2022',
    age: '4 Tuổi',
    gender: 'Nữ',
    className: 'Lớp Chồi B1 — Thỏ Ngọc',
    parentName: 'Lê Thị Thu Hương (Mẹ)',
    parentPhone: '0912 345 678',
    medicalNote: 'Sức khỏe bình thường. Đã tiêm đủ 6 mũi vắc-xin.',
    status: 'Đang Học',
    theme: {
      cardBorder: 'border-emerald-200/80 dark:border-emerald-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
      primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
      secondaryBtn: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100',
    },
  },
  {
    id: 'STU-003',
    name: 'Phạm Hoàng Nam',
    nickname: 'Bé Bin',
    dob: '10/02/2021',
    age: '5 Tuổi',
    gender: 'Nam',
    className: 'Lớp Lá C1 — Vàng Anh',
    parentName: 'Phạm Quốc Bảo (Bố)',
    parentPhone: '0977 888 999',
    medicalNote: 'Đeo kính 1.5 độ. Ưu tiên ngồi hàng ghế đầu.',
    status: 'Đang Học',
    theme: {
      cardBorder: 'border-amber-200/80 dark:border-amber-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      avatarBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
      primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
      secondaryBtn: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100',
    },
  },
  {
    id: 'STU-004',
    name: 'Vũ Khánh Linh',
    nickname: 'Bé Miu',
    dob: '05/08/2024',
    age: '2 Tuổi',
    gender: 'Nữ',
    className: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    parentName: 'Hoàng Anh Tuấn (Bố)',
    parentPhone: '0903 111 222',
    medicalNote: 'Chưa quen ngủ trưa riêng. Cần dỗ dành ban đầu.',
    status: 'Chờ Duyệt',
    theme: {
      cardBorder: 'border-rose-200/80 dark:border-rose-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
      secondaryBtn: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100',
    },
  },
];

export default function EnrollmentsPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Unified Page Header ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Top Navigation & Action */}
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
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Baby className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Hồ Sơ Nhập Học & Đăng Ký Bé Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quản lý 280 học sinh mầm non, tiền sử y tế, thông tin liên lạc và lớp học
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0">
            <UserPlus className="w-4 h-4" />
            <span>Đăng Ký Nhập Học Mới</span>
          </button>
        </div>

        {/* Search & Category Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm tên bé, tên phụ huynh, SĐT..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button className="px-4 py-2 rounded-2xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition-colors whitespace-nowrap">
              Đang Học (280)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Chờ Duyệt (5)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Lưu Ý Y Tế (12)
            </button>
          </div>
        </div>
      </div>

      {/* ── 2 Column Grid for Student Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {STUDENTS_LIST.map((stu) => (
          <div 
            key={stu.id}
            className={`rounded-3xl border ${stu.theme.cardBorder} ${stu.theme.cardBg} p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5`}
          >
            {/* Top Student Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl ${stu.theme.avatarBg} flex items-center justify-center font-extrabold text-base shrink-0 shadow-sm`}>
                  {stu.name.split(' ').pop()?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                      {stu.name}
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      "{stu.nickname}"
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                    Mã Bé: <strong className="text-gray-800 dark:text-gray-200">{stu.id}</strong> • {stu.gender} • {stu.age}
                  </p>
                </div>
              </div>
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${stu.theme.badgeBg}`}>
                {stu.status}
              </span>
            </div>

            {/* Class & Parent Contacts */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="text-gray-400 font-medium">Lớp học hiện tại:</span>
                <span className="font-bold text-gray-900 dark:text-white">{stu.className}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="text-gray-400 font-medium">Phụ huynh:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{stu.parentName}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="text-gray-400 font-medium">SĐT liên hệ:</span>
                <a href={`tel:${stu.parentPhone}`} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {stu.parentPhone}
                </a>
              </div>
            </div>

            {/* Medical Note Box */}
            <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-[11px]">
                <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                Ghi chú sức khỏe & dặn dò:
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                {stu.medicalNote}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-1 flex items-center justify-between gap-3">
              <button className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-colors flex-1 ${stu.theme.secondaryBtn}`}>
                <FileText className="w-3.5 h-3.5" />
                <span>Hồ Sơ Y Tế</span>
              </button>
              <button className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all flex-1 ${stu.theme.btnPrimary}`}>
                <span>Sổ Liên Lạc Bé</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
