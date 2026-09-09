'use client';

/**
 * Bella Education — Preschool Classroom Operations & Capacity Management
 * 
 * Scalable Architecture:
 * - Unified Page Title: "Quản Lý Lớp Học"
 * - Context Selector: Academic Year 2026 - 2027
 * - Capacity Management (Còn chỗ, Gần đầy, Đã đầy)
 * - Live Operational Status ("Hôm nay lớp thế nào?")
 * - Scalable CTAs: [ Mở lớp ] [ Điểm danh ] [ ⋯ More Options ]
 * - Create Class Workflow Modal with Conflict Checks
 */

import { useState, useRef, useEffect } from 'react';
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
  MapPin,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Heart,
  MoreVertical,
  CalendarCheck,
  ExternalLink,
  Settings,
  Utensils,
  FileText,
  X,
  ShieldCheck,
  Check
} from 'lucide-react';

type ClassItem = {
  id: string;
  name: string;
  grade: string;
  gradeKey: 'mam' | 'choi' | 'la' | 'nursery';
  teacher: string;
  room: string;
  students: number;
  maxStudents: number;
  focus: string;
  todayStatus: {
    present: number;
    excused: number;
    unmarked: number;
    healthAlerts: number;
  };
  theme: {
    badgeBg: string;
    badgeText: string;
  };
};

const PRESCHOOL_CLASSES: ClassItem[] = [
  {
    id: 'mam-a1',
    name: 'Lớp Mầm A1 — Họa Mi',
    grade: 'Khối Mầm (3 tuổi)',
    gradeKey: 'mam',
    teacher: 'Cô Nguyễn Thị Mai & Cô Lê Thu Trang',
    room: 'Phòng 101 • Tầng 1',
    students: 22,
    maxStudents: 25,
    focus: 'Phát triển Ngôn ngữ & Kỹ năng Giao tiếp',
    todayStatus: {
      present: 20,
      excused: 2,
      unmarked: 0,
      healthAlerts: 1,
    },
    theme: {
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
      badgeText: 'text-indigo-700 dark:text-indigo-300 border-indigo-200/60',
    },
  },
  {
    id: 'choi-b1',
    name: 'Lớp Chồi B1 — Thỏ Ngọc',
    grade: 'Khối Chồi (4 tuổi)',
    gradeKey: 'choi',
    teacher: 'Cô Trần Ngọc Anh & Cô Phạm Thanh Hà',
    room: 'Phòng 202 • Tầng 2',
    students: 24,
    maxStudents: 25,
    focus: 'Tư duy Toán học Reggio Emilia & Mỹ thuật',
    todayStatus: {
      present: 22,
      excused: 1,
      unmarked: 1,
      healthAlerts: 0,
    },
    theme: {
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300 border-emerald-200/60',
    },
  },
  {
    id: 'la-c1',
    name: 'Lớp Lá C1 — Vàng Anh',
    grade: 'Khối Lá (5 tuổi)',
    gradeKey: 'la',
    teacher: 'Cô Đặng Thùy Linh & Cô Vũ Khánh Vân',
    room: 'Phòng 301 • Tầng 3',
    students: 25,
    maxStudents: 25,
    focus: 'Tiền Tiểu học & Tiếng Anh Song ngữ Montessori',
    todayStatus: {
      present: 25,
      excused: 0,
      unmarked: 0,
      healthAlerts: 0,
    },
    theme: {
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
      badgeText: 'text-amber-700 dark:text-amber-300 border-amber-200/60',
    },
  },
  {
    id: 'nursery-n1',
    name: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    grade: 'Nhà Trẻ (18-36 tháng)',
    gradeKey: 'nursery',
    teacher: 'Cô Hoàng Bích Ngọc & Cô Bùi Thảo Chi',
    room: 'Phòng 102 • Tầng 1',
    students: 15,
    maxStudents: 18,
    focus: 'Vận động thô & Thói quen tự lập đầu đời',
    todayStatus: {
      present: 13,
      excused: 1,
      unmarked: 1,
      healthAlerts: 1,
    },
    theme: {
      badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
      badgeText: 'text-rose-700 dark:text-rose-300 border-rose-200/60',
    },
  },
];

export default function CoursesPage() {
  const [selectedYear, setSelectedYear] = useState('2026 - 2027');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCapacityStatus = (students: number, maxStudents: number) => {
    const remaining = maxStudents - students;
    if (remaining <= 0) {
      return {
        label: 'Đã đầy',
        badgeClass: 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200/80',
        barClass: 'bg-rose-500',
      };
    }
    if (remaining <= 2) {
      return {
        label: `Gần đầy (Còn ${remaining} chỗ)`,
        badgeClass: 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200/80',
        barClass: 'bg-amber-500',
      };
    }
    return {
      label: `Còn ${remaining} chỗ`,
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200/80',
      barClass: 'bg-emerald-500',
    };
  };

  const filteredClasses = PRESCHOOL_CLASSES.filter((cls) => {
    const matchesSearch = cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cls.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cls.room.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || cls.gradeKey === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Unified Header Banner ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Top Navigation & Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
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
                  Quản Lý Lớp Học
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quản lý danh sách lớp học, phân công giáo viên chủ nhiệm & theo dõi vận hành từng lớp
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            {/* Academic Year Context Selector */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-2xl px-4 py-2.5 pr-8 focus:outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <option>Năm học 2026 - 2027</option>
                <option>Năm học 2025 - 2026</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Create Class Workflow Button */}
            <button 
              onClick={() => { setIsNewClassModalOpen(true); setModalStep(1); }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Mở Lớp Học Mới</span>
            </button>
          </div>
        </div>

        {/* Search & Grade Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm lớp học, giáo viên, phòng..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button 
              onClick={() => setSelectedGrade('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedGrade === 'all' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tất cả ({PRESCHOOL_CLASSES.length})
            </button>
            <button 
              onClick={() => setSelectedGrade('mam')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedGrade === 'mam' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Khối Mầm (1)
            </button>
            <button 
              onClick={() => setSelectedGrade('choi')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedGrade === 'choi' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Khối Chồi (1)
            </button>
            <button 
              onClick={() => setSelectedGrade('la')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedGrade === 'la' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Khối Lá (1)
            </button>
            <button 
              onClick={() => setSelectedGrade('nursery')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedGrade === 'nursery' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Nhà Trẻ (1)
            </button>
          </div>
        </div>
      </div>

      {/* ── 2 Column Grid: Operational Classroom Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" ref={menuRef}>
        {filteredClasses.map((cls) => {
          const fillPercentage = Math.round((cls.students / cls.maxStudents) * 100);
          const capStatus = getCapacityStatus(cls.students, cls.maxStudents);
          const isMenuOpen = activeMenuId === cls.id;

          return (
            <div 
              key={cls.id}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5 relative"
            >
              {/* Card Header: Grade Badge, Capacity Status & Room */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${cls.theme.badgeBg} ${cls.theme.badgeText}`}>
                      {cls.grade}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${capStatus.badgeClass}`}>
                      {capStatus.label}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {cls.room}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight leading-snug">
                    {cls.name}
                  </h3>

                  {/* ⋯ Overflow Actions Button */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(isMenuOpen ? null : cls.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Thao tác khác"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Popover Overflow Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                        <Link
                          href={`/dashboard/education/grades?class=${cls.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 rounded-xl transition-colors"
                        >
                          <GraduationCap className="w-4 h-4 text-indigo-500" />
                          <span>Sổ Đánh Giá Học Sinh</span>
                        </Link>
                        <Link
                          href={`/dashboard/education/attendance?class=${cls.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 rounded-xl transition-colors"
                        >
                          <Utensils className="w-4 h-4 text-emerald-500" />
                          <span>Thực Đơn & Dinh Dưỡng</span>
                        </Link>
                        <Link
                          href={`/dashboard/education/communication?class=${cls.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 rounded-xl transition-colors"
                        >
                          <FileText className="w-4 h-4 text-amber-500" />
                          <span>Nhật Ký & Báo Cáo Lớp</span>
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(null)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                          >
                            <Settings className="w-4 h-4" />
                            <span>Cấu Hình Thông Tin Lớp</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Capacity Management Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-500 dark:text-gray-400">Công suất lớp:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      <strong>{cls.students}</strong> / {cls.maxStudents} bé ({fillPercentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${capStatus.barClass} transition-all duration-500`} 
                      style={{ width: `${fillPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Operational Live Status (Hôm nay lớp thế nào?) ── */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 space-y-2">
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
                  Vận hành hôm nay:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100/60 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{cls.todayStatus.present} có mặt</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400 font-bold bg-sky-100/60 dark:bg-sky-950/60 px-2.5 py-1 rounded-xl">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{cls.todayStatus.excused} có phép</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold bg-amber-100/60 dark:bg-amber-950/60 px-2.5 py-1 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{cls.todayStatus.unmarked} chưa điểm danh</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold bg-rose-100/60 dark:bg-rose-950/60 px-2.5 py-1 rounded-xl">
                    <Heart className="w-3.5 h-3.5" />
                    <span>{cls.todayStatus.healthAlerts} sức khỏe</span>
                  </div>
                </div>
              </div>

              {/* Card Middle: Teachers & Focus */}
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
                  <Users className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
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

              {/* ── Scalable Card Bottom CTAs ── */}
              <div className="pt-2 flex items-center justify-between gap-2.5 border-t border-slate-100 dark:border-slate-700/60">
                <Link
                  href={`/dashboard/education/courses/${cls.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở Lớp Học</span>
                </Link>
                <Link
                  href={`/dashboard/education/attendance?class=${cls.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Điểm Danh</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CREATE NEW CLASS WORKFLOW MODAL ── */}
      {isNewClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setIsNewClassModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Quy trình mở lớp mầm non • Bước {modalStep}/3
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Khởi Tạo Lớp Học Mới
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kiểm tra xung đột phòng học, thời khóa biểu và phân công giáo viên chủ nhiệm
              </p>
            </div>

            {/* Modal Form Step 1 */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Năm học áp dụng
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedYear}
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Khối lớp
                    </label>
                    <select className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500">
                      <option>Khối Mầm (3 tuổi)</option>
                      <option>Khối Chồi (4 tuổi)</option>
                      <option>Khối Lá (5 tuổi)</option>
                      <option>Nhà Trẻ (18-36 tháng)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Tên lớp mới
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Lớp Mầm A2 — Sơn Ca"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Sức chứa tối đa (Học sinh)
                    </label>
                    <input
                      type="number"
                      defaultValue={25}
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Phòng học chỉ định
                    </label>
                    <select className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500">
                      <option>Phòng 103 • Tầng 1 (Trống)</option>
                      <option>Phòng 204 • Tầng 2 (Trống)</option>
                      <option>Phòng 302 • Tầng 3 (Trống)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Form Step 2 */}
            {modalStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Phân công Giáo viên chủ nhiệm & Trợ giảng
                  </label>
                  <select className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500">
                    <option>Cô Nguyễn Thị Lan & Cô Trần Thị Hoa</option>
                    <option>Cô Phạm Thanh Thảo & Cô Đỗ Kim Anh</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Định hướng kỹ năng & Định hướng giáo dục
                  </label>
                  <input
                    type="text"
                    defaultValue="Phát triển Ngôn ngữ & Mỹ thuật Sáng tạo"
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Kiểm tra xung đột hệ thống:
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    ✓ Phòng 103 khả dụng • Giáo viên chưa bị trùng lịch dạy năm 2026-2027.
                  </p>
                </div>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {modalStep > 1 && (
                <button
                  type="button"
                  onClick={() => setModalStep(modalStep - 1)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Quay lại
                </button>
              )}
              {modalStep < 2 ? (
                <button
                  type="button"
                  onClick={() => setModalStep(2)}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Tiếp theo: Phân công →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsNewClassModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Kích Hoạt Lớp Học Mới</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
