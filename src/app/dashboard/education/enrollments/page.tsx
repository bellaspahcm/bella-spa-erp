'use client';

/**
 * Bella Education — Student Registry & Admission Management
 * 
 * Scalable Architecture:
 * - Unified Header Title: "Quản Lý Trẻ"
 * - Academic Year Context: 2026 - 2027
 * - Exception-Based Health UI (Highlight only when warning exists)
 * - Admission Workflow Modal (Multi-step enrollment process)
 * - Scalable CTAs: [ Xem Hồ Sơ (Student 360°) ] [ Sổ Liên Lạc ] [ ⋯ ]
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Baby, 
  UserPlus, 
  Search, 
  ArrowLeft, 
  Phone, 
  FileText,
  Heart,
  Calendar,
  Sparkles,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  ShieldCheck,
  X,
  Check,
  UserCheck,
  GraduationCap,
  CreditCard,
  MessageSquare
} from 'lucide-react';

type StudentItem = {
  id: string;
  name: string;
  nickname: string;
  dob: string;
  age: string;
  gender: string;
  className: string;
  parentName: string;
  parentPhone: string;
  hasHealthAlert: boolean;
  medicalNote: string;
  status: 'Đang Học' | 'Chờ Nhập Học' | 'Đã Nghỉ Học';
  statusKey: 'active' | 'pending' | 'inactive';
  theme: {
    avatarBg: string;
    badgeBg: string;
    badgeText: string;
  };
};

const STUDENTS_LIST: StudentItem[] = [
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
    hasHealthAlert: true,
    medicalNote: 'Dị ứng hạt hải sản. Cần lưu ý bữa ăn trưa.',
    status: 'Đang Học',
    statusKey: 'active',
    theme: {
      avatarBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
      badgeText: 'text-indigo-700 dark:text-indigo-300 border-indigo-200/60',
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
    hasHealthAlert: false,
    medicalNote: 'Sức khỏe bình thường. Đã tiêm đủ 6 mũi vắc-xin.',
    status: 'Đang Học',
    statusKey: 'active',
    theme: {
      avatarBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300 border-emerald-200/60',
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
    hasHealthAlert: true,
    medicalNote: 'Đeo kính 1.5 độ. Ưu tiên ngồi hàng ghế đầu.',
    status: 'Đang Học',
    statusKey: 'active',
    theme: {
      avatarBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
      badgeText: 'text-amber-700 dark:text-amber-300 border-amber-200/60',
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
    hasHealthAlert: true,
    medicalNote: 'Chưa quen ngủ trưa riêng. Cần dỗ dành ban đầu.',
    status: 'Chờ Nhập Học',
    statusKey: 'pending',
    theme: {
      avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
      badgeText: 'text-rose-700 dark:text-rose-300 border-rose-200/60',
    },
  },
];

export default function EnrollmentsPage() {
  const [selectedYear, setSelectedYear] = useState('2026 - 2027');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'active' | 'pending' | 'healthAlert'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
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

  const filteredStudents = STUDENTS_LIST.filter((stu) => {
    const matchesSearch = stu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stu.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stu.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stu.parentPhone.includes(searchQuery) ||
                          stu.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedStatusTab === 'all') return matchesSearch;
    if (selectedStatusTab === 'active') return matchesSearch && stu.statusKey === 'active';
    if (selectedStatusTab === 'pending') return matchesSearch && stu.statusKey === 'pending';
    if (selectedStatusTab === 'healthAlert') return matchesSearch && stu.hasHealthAlert;
    return matchesSearch;
  });

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Unified Page Header ── */}
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
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Baby className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Quản Lý Trẻ
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Danh sách 280 trẻ mầm non, hồ sơ cá nhân, người giám hộ & lịch sử quá trình học tập
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

            {/* Admission Workflow Button */}
            <button 
              onClick={() => { setIsAdmissionModalOpen(true); setModalStep(1); }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đăng Ký Nhập Học Mới</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter Tabs */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên bé, biệt danh, tên phụ huynh, SĐT..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button 
              onClick={() => setSelectedStatusTab('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'all' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất cả trẻ ({STUDENTS_LIST.length})
            </button>
            <button 
              onClick={() => setSelectedStatusTab('active')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'active' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Đang học (263)
            </button>
            <button 
              onClick={() => setSelectedStatusTab('pending')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'pending' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Chờ nhập học (5)
            </button>
            <button 
              onClick={() => setSelectedStatusTab('healthAlert')}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedStatusTab === 'healthAlert' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              ⚠️ Lưu ý y tế (12)
            </button>
          </div>
        </div>
      </div>

      {/* ── 2 Column Grid for Student Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" ref={menuRef}>
        {filteredStudents.map((stu) => {
          const isMenuOpen = activeMenuId === stu.id;

          return (
            <div 
              key={stu.id}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5 relative"
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

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${stu.theme.badgeBg} ${stu.theme.badgeText}`}>
                    {stu.status}
                  </span>

                  {/* ⋯ Overflow Actions Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(isMenuOpen ? null : stu.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Thao tác khác"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                        <Link
                          href={`/dashboard/education/enrollments/${stu.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 rounded-xl transition-colors"
                        >
                          <FileText className="w-4 h-4 text-emerald-500" />
                          <span>Hồ Sơ Y Tế & Sức Khỏe</span>
                        </Link>
                        <Link
                          href={`/dashboard/education/attendance?student=${stu.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 rounded-xl transition-colors"
                        >
                          <CalendarCheck className="w-4 h-4 text-indigo-500" />
                          <span>Lịch Sử Điểm Danh</span>
                        </Link>
                        <Link
                          href={`/dashboard/education/grades?student=${stu.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 rounded-xl transition-colors"
                        >
                          <GraduationCap className="w-4 h-4 text-amber-500" />
                          <span>Đánh Giá Phát Triển</span>
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                          <Link
                            href={`/dashboard/education/finance?student=${stu.id}`}
                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 rounded-xl transition-colors"
                          >
                            <CreditCard className="w-4 h-4 text-rose-500" />
                            <span>Học Phí & Công Nợ</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
                  <a href={`tel:${stu.parentPhone}`} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {stu.parentPhone}
                  </a>
                </div>
              </div>

              {/* ── Exception-Based Health UI ── */}
              {stu.hasHealthAlert ? (
                <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-900/60 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    ⚠ LƯU Ý SỨC KHỎE & DẶN DÒ:
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                    {stu.medicalNote}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-2xl border border-emerald-200/60 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>✓ Hồ sơ y tế đầy đủ • Sức khỏe bình thường</span>
                </div>
              )}

              {/* Action Buttons: Primary Student 360° CTA */}
              <div className="pt-1 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700/60">
                <Link 
                  href={`/dashboard/education/enrollments/${stu.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Xem Hồ Sơ 360°</span>
                </Link>
                <Link 
                  href={`/dashboard/education/communication?student=${stu.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Sổ Liên Lạc</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ADMISSION WORKFLOW MODAL ── */}
      {isAdmissionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 relative">
            <button
              onClick={() => setIsAdmissionModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Quy trình đăng ký nhập học • Bước {modalStep}/3
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Đăng Ký Hồ Sơ Nhập Học Mới
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thu thập thông tin bé, người giám hộ, tiền sử y tế và phân lớp dự kiến
              </p>
            </div>

            {/* Modal Step 1 */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Họ và tên trẻ *
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Lê Hoàng Nam"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Tên thường gọi / Biệt danh
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Bé Tôm"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Ngày sinh *
                    </label>
                    <input
                      type="date"
                      defaultValue="2023-06-15"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Giới tính
                    </label>
                    <select className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500">
                      <option>Nam</option>
                      <option>Nữ</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Step 2 */}
            {modalStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Họ tên người giám hộ *
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Lê Văn Thành (Bố)"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Số điện thoại liên hệ *
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 0989 112 334"
                      className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Ghi chú y tế / Dặn dò đặc biệt (Dị ứng, chế độ ăn)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="VD: Dị ứng sữa bò, cần dùng sữa hạt thay thế."
                    className="w-full p-3 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 text-xs space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Kiểm tra hồ sơ hợp lệ:
                  </span>
                  <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    ✓ Mã học sinh tự động sinh: STU-005 • Đạt tiêu chuẩn phân lớp Khối Mầm.
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
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Tiếp theo: Giám hộ →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAdmissionModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Hoàn Tất Đăng Ký Nhập Học</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
