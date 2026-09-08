/**
 * Bella Education — Preschool Class & Curriculum Management
 *
 * Full viewport width layout with responsive 1/2/3/4 column grid and balanced padding.
 */

import Link from 'next/link';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Users, 
  Sparkles, 
  ArrowLeft,
  GraduationCap,
  Calendar,
  MapPin
} from 'lucide-react';

type ClassItem = {
  id: string;
  name: string;
  grade: string;
  teacher: string;
  room: string;
  students: number;
  maxStudents: number;
  focus: string;
  theme: {
    cardBorder: string;
    cardBg: string;
    badgeBg: string;
    badgeText: string;
    progressFill: string;
    primaryBtn: string;
    secondaryBtn: string;
    iconText: string;
  };
};

const PRESCHOOL_CLASSES: ClassItem[] = [
  {
    id: 'mam-a1',
    name: 'Lớp Mầm A1 — Họa Mi',
    grade: 'Khối Mầm (3 tuổi)',
    teacher: 'Cô Nguyễn Thị Mai & Cô Lê Thu Trang',
    room: 'Phòng 101 • Tầng 1',
    students: 22,
    maxStudents: 25,
    focus: 'Phát triển Ngôn ngữ & Kỹ năng Giao tiếp',
    theme: {
      cardBorder: 'border-indigo-200/80 dark:border-indigo-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
      progressFill: 'bg-indigo-500',
      primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20',
      secondaryBtn: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100',
      iconText: 'text-indigo-600 dark:text-indigo-400',
    },
  },
  {
    id: 'choi-b1',
    name: 'Lớp Chồi B1 — Thỏ Ngọc',
    grade: 'Khối Chồi (4 tuổi)',
    teacher: 'Cô Trần Ngọc Anh & Cô Phạm Thanh Hà',
    room: 'Phòng 202 • Tầng 2',
    students: 24,
    maxStudents: 25,
    focus: 'Tư duy Toán học Reggio Emilia & Mỹ thuật',
    theme: {
      cardBorder: 'border-emerald-200/80 dark:border-emerald-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      progressFill: 'bg-emerald-500',
      primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
      secondaryBtn: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100',
      iconText: 'text-emerald-600 dark:text-emerald-400',
    },
  },
  {
    id: 'la-c1',
    name: 'Lớp Lá C1 — Vàng Anh',
    grade: 'Khối Lá (5 tuổi)',
    teacher: 'Cô Đặng Thùy Linh & Cô Vũ Khánh Vân',
    room: 'Phòng 301 • Tầng 3',
    students: 25,
    maxStudents: 25,
    focus: 'Tiền Tiểu học & Tiếng Anh Song ngữ Montessori',
    theme: {
      cardBorder: 'border-amber-200/80 dark:border-amber-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
      badgeText: 'text-amber-700 dark:text-amber-300',
      progressFill: 'bg-amber-500',
      primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
      secondaryBtn: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100',
      iconText: 'text-amber-600 dark:text-amber-400',
    },
  },
  {
    id: 'nursery-n1',
    name: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    grade: 'Nhà Trẻ (18-36 tháng)',
    teacher: 'Cô Hoàng Bích Ngọc & Cô Bùi Thảo Chi',
    room: 'Phòng 102 • Tầng 1',
    students: 15,
    maxStudents: 18,
    focus: 'Vận động thô & Thói quen tự lập đầu đời',
    theme: {
      cardBorder: 'border-rose-200/80 dark:border-rose-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
      badgeText: 'text-rose-700 dark:text-rose-300',
      progressFill: 'bg-rose-500',
      primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
      secondaryBtn: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100',
      iconText: 'text-rose-600 dark:text-rose-400',
    },
  },
];

export default function CoursesPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Unified Header Banner ── */}
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
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Chương Trình & Danh Sách Lớp Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quản lý 12 lớp học, phân công giáo viên chủ nhiệm và định hướng kỹ năng mầm non
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 shrink-0">
            <Plus className="w-4 h-4" />
            <span>Mở Lớp Học Mới</span>
          </button>
        </div>

        {/* Search & Category Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm lớp học, giáo viên, phòng..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button className="px-4 py-2 rounded-2xl text-xs font-bold bg-indigo-600 text-white shadow-sm transition-colors whitespace-nowrap">
              Tất cả (12)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Khối Mầm (3)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Khối Chồi (4)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Khối Lá (3)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap">
              Nhà Trẻ (2)
            </button>
          </div>
        </div>
      </div>

      {/* ── 2 Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {PRESCHOOL_CLASSES.map((cls) => {
          const fillPercentage = Math.round((cls.students / cls.maxStudents) * 100);

          return (
            <div 
              key={cls.id}
              className={`rounded-3xl border ${cls.theme.cardBorder} ${cls.theme.cardBg} p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5`}
            >
              {/* Card Top: Grade Badge, Title, Room & Capacity Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${cls.theme.badgeBg} ${cls.theme.badgeText}`}>
                    {cls.grade}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {cls.room}
                  </span>
                </div>

                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-snug">
                  {cls.name}
                </h3>

                {/* Capacity Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-500 dark:text-gray-400">Sĩ Số:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      <strong className={cls.theme.iconText}>{cls.students}</strong> / {cls.maxStudents} bé ({fillPercentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${cls.theme.progressFill} transition-all duration-500`} 
                      style={{ width: `${fillPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Middle: Teacher & Curriculum Focus */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                <div className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
                  <Users className={`w-4 h-4 shrink-0 mt-0.5 ${cls.theme.iconText}`} />
                  <div>
                    <span className="text-gray-400 font-medium">Giáo viên: </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{cls.teacher}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <span className="text-gray-400 font-medium">Định hướng: </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{cls.focus}</span>
                  </div>
                </div>
              </div>

              {/* Card Bottom: Actions */}
              <div className="pt-2 flex items-center justify-between gap-2.5">
                <Link
                  href="/dashboard/education/attendance"
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold border transition-colors flex-1 ${cls.theme.secondaryBtn}`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Điểm Danh</span>
                </Link>
                <Link
                  href="/dashboard/education/grades"
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all flex-1 ${cls.theme.primaryBtn}`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Sổ Đánh Giá</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
