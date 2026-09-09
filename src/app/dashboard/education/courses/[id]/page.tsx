'use client';

/**
 * Bella Education — Classroom Workspace & Operations Detail View
 * 
 * Scalable Class Workspace Architecture:
 * - Classroom Header Info (Grade, Room, Capacity, Lead Teachers)
 * - Workspace Tabs: Tổng Quan | Học Sinh | Điểm Danh | Hoạt Động | Sức Khỏe & Ăn Uống | Liên Lạc Phụ Huynh
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Users, 
  CalendarCheck, 
  Heart, 
  Utensils, 
  MessageSquare, 
  GraduationCap, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  FileText, 
  ShieldCheck,
  UserCheck,
  ChevronRight,
  Clock
} from 'lucide-react';

const CLASS_DETAILS: Record<string, {
  name: string;
  grade: string;
  room: string;
  teacher: string;
  studentsCount: number;
  maxStudents: number;
  focus: string;
  students: Array<{ id: string; name: string; age: string; parent: string; phone: string; status: string; temp: string }>;
}> = {
  'mam-a1': {
    name: 'Lớp Mầm A1 — Họa Mi',
    grade: 'Khối Mầm (3 tuổi)',
    room: 'Phòng 101 • Tầng 1',
    teacher: 'Cô Nguyễn Thị Mai & Cô Lê Thu Trang',
    studentsCount: 22,
    maxStudents: 25,
    focus: 'Phát triển Ngôn ngữ & Kỹ năng Giao tiếp',
    students: [
      { id: 'STU-001', name: 'Nguyễn Minh An (Bé Bi)', age: '3 tuổi', parent: 'Nguyễn Văn Hùng (Bố)', phone: '0901 234 567', status: 'Có mặt', temp: '36.5°C' },
      { id: 'STU-002', name: 'Trần Bảo Ngọc (Bé Bắp)', age: '3 tuổi', parent: 'Lê Thị Thu Hương (Mẹ)', phone: '0902 345 678', status: 'Có mặt', temp: '36.6°C' },
      { id: 'STU-003', name: 'Phạm Hoàng Nam (Bé Bin)', age: '3 tuổi', parent: 'Phạm Quốc Bảo (Bố)', phone: '0903 456 789', status: 'Có mặt', temp: '37.8°C (Cảnh báo)' },
      { id: 'STU-004', name: 'Lê Hoàng Yến (Bé Na)', age: '3 tuổi', parent: 'Đã báo vắng (Bệnh sốt)', phone: '0904 567 890', status: 'Có phép', temp: '---' },
    ],
  },
};

export default function ClassWorkspacePage() {
  const params = useParams();
  const classId = (params?.id as string) || 'mam-a1';
  const cls = CLASS_DETAILS[classId] || CLASS_DETAILS['mam-a1'];

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'attendance' | 'health'>('overview');

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Workspace Header */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education/courses" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Quản lý lớp học"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60">
                  {cls.grade}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {cls.room}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-1">
                {cls.name} — Workspace Vận Hành
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Giáo viên chủ nhiệm: <strong>{cls.teacher}</strong> • Định hướng: {cls.focus}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/dashboard/education/attendance?class=${classId}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Điểm Danh Ngay</span>
            </Link>
          </div>
        </div>

        {/* Workspace Tab Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tổng Quan Vận Hành
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'students'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Danh Sách Học Sinh ({cls.studentsCount})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Nhật Ký Điểm Danh
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'health'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Sức Khỏe & Dinh Dưỡng
          </button>
        </div>
      </div>

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Sĩ Số & Công Suất Lớp Học
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900">
                <span className="text-xs text-slate-500 block mb-1">Sĩ số thực tế</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{cls.studentsCount} bé</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900">
                <span className="text-xs text-slate-500 block mb-1">Sức chứa tối đa</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{cls.maxStudents} bé</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-1">Số chỗ còn trống</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{cls.maxStudents - cls.studentsCount} chỗ</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Trạng Thái Điểm Danh Hôm Nay
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                <span>Có mặt đúng giờ:</span>
                <span>20 bé</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-bold">
                <span>Vắng có phép:</span>
                <span>2 bé</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold">
                <span>Cảnh báo sức khỏe / sốt:</span>
                <span>1 bé</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Students List */}
      {activeTab === 'students' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm overflow-hidden space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Danh Sách Học Sinh Lớp Mầm A1
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Mã Trẻ</th>
                  <th className="p-3">Họ và Tên Học Sinh</th>
                  <th className="p-3">Độ Tuổi</th>
                  <th className="p-3">Người Giám Hộ</th>
                  <th className="p-3">Số Điện Thoại</th>
                  <th className="p-3 text-right">Trạng Thái Hôm Nay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {cls.students.map((std) => (
                  <tr key={std.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-bold text-slate-500">{std.id}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{std.name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{std.age}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-200">{std.parent}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{std.phone}</td>
                    <td className="p-3 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        std.status === 'Có mặt' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {std.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
