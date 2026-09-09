/**
 * Bella Education — Teacher & Staff Management
 *
 * Full viewport width layout, responsive card grid, staff directory, certifications, and teaching assignments.
 */

import Link from 'next/link';
import { 
  Users, 
  UserPlus, 
  Search, 
  ArrowLeft, 
  Award, 
  Phone, 
  Mail, 
  BookOpen, 
  Calendar, 
  ShieldCheck, 
  Sparkles,
  MapPin
} from 'lucide-react';

const TEACHERS_LIST = [
  {
    id: 'TEA-001',
    name: 'Cô Nguyễn Thị Mai',
    role: 'Giáo viên Chủ nhiệm Lớp Mầm A1',
    degree: 'Cử nhân Sư phạm Mầm non - ĐH Quốc Gia',
    experience: '8 Năm kinh nghiệm',
    phone: '0982 111 222',
    email: 'mai.nguyen@bellapreschool.edu.vn',
    classAssigned: 'Lớp Mầm A1 — Họa Mi',
    certifications: ['Montessori International', 'Sơ cứu Y tế Trẻ em'],
    status: 'Đang Giảng Dạy',
    theme: {
      cardBorder: 'border-rose-200/80 dark:border-rose-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      avatarBg: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      badgeBg: 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
      primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
      secondaryBtn: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100',
    },
  },
  {
    id: 'TEA-002',
    name: 'Cô Trần Ngọc Anh',
    role: 'Giáo viên Chủ nhiệm Lớp Chồi B1',
    degree: 'Thạc sĩ Tâm lý Học Mầm non - ĐH Sư Phạm',
    experience: '10 Năm kinh nghiệm',
    phone: '0915 222 333',
    email: 'ngocanh.tran@bellapreschool.edu.vn',
    classAssigned: 'Lớp Chồi B1 — Thỏ Ngọc',
    certifications: ['Reggio Emilia Expert', 'Chứng chỉ Tiếng Anh C1'],
    status: 'Đang Giảng Dạy',
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
    id: 'TEA-003',
    name: 'Cô Đặng Thùy Linh',
    role: 'Giáo viên Chủ nhiệm Lớp Lá C1',
    degree: 'Cử nhân Ngôn ngữ Anh & GD Mầm non',
    experience: '6 Năm kinh nghiệm',
    phone: '0973 444 555',
    email: 'thuylinh.dang@bellapreschool.edu.vn',
    classAssigned: 'Lớp Lá C1 — Vàng Anh',
    certifications: ['Tiền Tiểu học Chuẩn Quốc gia', 'Tốt nghiệp loại Ưu'],
    status: 'Đang Giảng Dạy',
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
    id: 'TEA-004',
    name: 'Cô Hoàng Bích Ngọc',
    role: 'Giáo viên Chủ nhiệm Lớp Nhà Trẻ N1',
    degree: 'Cử nhân Giáo dục Đặc biệt',
    experience: '5 Năm kinh nghiệm',
    phone: '0904 666 777',
    email: 'bichngoc.hoang@bellapreschool.edu.vn',
    classAssigned: 'Lớp Nhà Trẻ N1 — Gấu Misa',
    certifications: ['Chăm sóc Trẻ sơ sinh & Nhà trẻ', 'Dinh dưỡng Nhi khoa'],
    status: 'Đang Giảng Dạy',
    theme: {
      cardBorder: 'border-amber-200/80 dark:border-amber-900/60',
      cardBg: 'bg-white dark:bg-slate-800/90',
      avatarBg: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
      primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
      secondaryBtn: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100',
    },
  },
];

export default function TeachersPage() {
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
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Đội Ngũ Giáo Viên & Nhân Viên Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quản lý 32 giáo viên chuyên môn, trợ giảng và nhân viên y tế dinh dưỡng
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-rose-500/20 transition-all active:scale-95 shrink-0">
            <UserPlus className="w-4 h-4" />
            <span>Thêm Giáo Viên Mới</span>
          </button>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm tên cô giáo, trình độ, lớp dạy..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <button className="px-4 py-2 rounded-2xl text-xs font-bold bg-rose-600 text-white shadow-sm whitespace-nowrap">
              Tất Cả Cô Giáo (32)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors whitespace-nowrap">
              Chủ Nhiệm (12)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors whitespace-nowrap">
              Trợ Giảng (14)
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors whitespace-nowrap">
              Năng Khiếu & Ngoại Ngữ (6)
            </button>
          </div>
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {TEACHERS_LIST.map((t) => (
          <div 
            key={t.id}
            className={`rounded-3xl border ${t.theme.cardBorder} ${t.theme.cardBg} p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl ${t.theme.avatarBg} flex items-center justify-center font-extrabold text-base shrink-0 shadow-sm`}>
                  {t.name.split(' ').pop()?.[0]}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                    {t.name}
                  </h3>
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                    {t.role}
                  </p>
                </div>
              </div>
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${t.theme.badgeBg}`}>
                {t.status}
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="text-gray-400 font-medium">Bằng cấp:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{t.degree}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="text-gray-400 font-medium">Thâm niên:</span>
                <span className="font-bold text-gray-900 dark:text-white">{t.experience}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span className="text-gray-400 font-medium">Phụ trách:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{t.classAssigned}</span>
              </div>
            </div>

            {/* Certifications */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {t.certifications.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-3 h-3 text-rose-500" />
                  {c}
                </span>
              ))}
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <a href={`tel:${t.phone}`} className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-colors flex-1 ${t.theme.secondaryBtn}`}>
                <Phone className="w-3.5 h-3.5" />
                <span>{t.phone}</span>
              </a>
              <button className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all flex-1 ${t.theme.primaryBtn}`}>
                <BookOpen className="w-3.5 h-3.5" />
                <span>Phân Công Lớp</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
