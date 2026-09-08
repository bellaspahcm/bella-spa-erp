/**
 * Bella Education — Preschool Dashboard Page
 * 
 * High-end, modern, adorable & professional management interface for Kindergartens & Preschools.
 * Synchronized 2-Column Responsive Grid.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Users, 
  CalendarCheck, 
  GraduationCap, 
  Heart, 
  Utensils, 
  Sparkles, 
  Baby, 
  ShieldCheck, 
  Clock, 
  Award,
  BellRing,
  CheckCircle2,
  ChevronRight,
  UserPlus,
  Apple
} from 'lucide-react';

export default function EducationDashboardPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Preschool Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-amber-500 p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/10">
        {/* Background decorative circles & sparkles */}
        <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
              <span>Hệ Thống Quản Lý Mầm Non Quốc Tế</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              Trường Mầm Non Bella Preschool
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm font-medium leading-relaxed">
              Kiến tạo môi trường giáo dục mầm non tràn ngập tình thương, an toàn tuyệt đối và phát triển trí tuệ toàn diện cho các bé.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/dashboard/education/enrollments"
              className="inline-flex items-center gap-2 rounded-2xl bg-white text-indigo-700 px-5 py-3 text-xs font-bold shadow-lg shadow-black/10 hover:bg-amber-50 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4 text-amber-500" />
              <span>Nhập Học Mới</span>
            </Link>
            <Link
              href="/dashboard/education/attendance"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-900/40 text-white px-5 py-3 text-xs font-bold border border-white/20 backdrop-blur-md hover:bg-indigo-900/60 transition-all active:scale-95"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-300" />
              <span>Điểm Danh Nhanh</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI & Statistics Cards ── */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* ── Core Action Modules Grid (2 Column Grid) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Baby className="w-5 h-5 text-indigo-500" />
              Phân Hệ Quản Lý Mầm Non
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Truy cập nhanh các nghiệp vụ quản lý lớp học, sức khỏe và phụ huynh
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickActionCard
            href="/dashboard/education/courses"
            icon={<BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
            title="Chương Trình & Lớp Học"
            description="Quản lý 12 lớp Mầm, Chồi, Lá, Nursery, thời khóa biểu & môn học kỹ năng."
            badge="12 Lớp Học"
            accentBg="bg-indigo-500/10"
            hoverBorder="hover:border-indigo-300 dark:hover:border-indigo-800"
          />
          <QuickActionCard
            href="/dashboard/education/enrollments"
            icon={<Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
            title="Bé Nhập Học & Hồ Sơ"
            description="Tiếp nhận hồ sơ nhập học, thông tin liên lạc phụ huynh, tiền sử y tế & đưa đón."
            badge="280 Học Sinh"
            accentBg="bg-emerald-500/10"
            hoverBorder="hover:border-emerald-300 dark:hover:border-emerald-800"
          />
          <QuickActionCard
            href="/dashboard/education/attendance"
            icon={<CalendarCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
            title="Điểm Danh & Đưa Đón"
            description="Điểm danh theo lớp, ghi nhận phụ huynh đưa đón an toàn qua QR code chính chủ."
            badge="Mở Điểm Danh"
            accentBg="bg-amber-500/10"
            hoverBorder="hover:border-amber-300 dark:hover:border-amber-800"
          />
          <QuickActionCard
            href="/dashboard/education/grades"
            icon={<GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
            title="Đánh Giá & Phát Triển"
            description="Theo dõi chỉ số chiều cao/cân nặng WHO, tư duy mầm non & trao Phiếu Bé Ngoan."
            badge="Tháng 09/2026"
            accentBg="bg-purple-500/10"
            hoverBorder="hover:border-purple-300 dark:hover:border-purple-800"
          />
          <QuickActionCard
            href="/dashboard/education/attendance"
            icon={<Utensils className="w-6 h-6 text-rose-600 dark:text-rose-400" />}
            title="Thực Đơn & Dinh Dưỡng"
            description="Lập kế hoạch bữa ăn sáng, trưa, xế đạt chuẩn calo & quản lý dị ứng thực phẩm."
            badge="Calo Đạt Chuẩn"
            accentBg="bg-rose-500/10"
            hoverBorder="hover:border-rose-300 dark:hover:border-rose-800"
          />
          <QuickActionCard
            href="/dashboard/education/enrollments"
            icon={<Heart className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />}
            title="Sổ Liên Lạc Điện Tử"
            description="Kết nối Zalo/SMS với Phụ huynh, gửi hình ảnh hoạt động góc hàng ngày của bé."
            badge="Tương Tác Hàng Ngày"
            accentBg="bg-cyan-500/10"
            hoverBorder="hover:border-cyan-300 dark:hover:border-cyan-800"
          />
        </div>
      </div>

      {/* ── Preschool Daily Schedule & Health Reminders (2 Column Grid) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Schedule Timeline */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  Lịch Sinh Hoạt Mầm Non Hôm Nay
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Thời khóa biểu chuẩn hóa theo độ tuổi
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
              Thứ Tư, 09/09/2026
            </span>
          </div>

          <div className="space-y-3.5">
            <ScheduleItem
              time="07:30 - 08:30"
              title="Đón Trẻ & Kiểm Tra Sức Khỏe Buổi Sáng"
              desc="Đo thân nhiệt, sát khuẩn tay, ghi nhận người đưa đón và tình trạng sức khỏe ban đầu."
              status="Hoàn thành"
              color="emerald"
            />
            <ScheduleItem
              time="08:30 - 09:15"
              title="Thể Dục Sáng & Hoạt Động Góc Sáng Tạo"
              desc="Tập bài thể dục nhịp điệu mầm non, chơi Lego phát triển tư duy, góc vẽ tranh."
              status="Đang diễn ra"
              color="indigo"
            />
            <ScheduleItem
              time="11:00 - 12:00"
              title="Bữa Trưa Dinh Dưỡng & Vệ Sinh Cá Nhân"
              desc="Thực đơn: Cơm mềm, sườn rạm mật ong, canh bí đỏ thịt băm, tráng miệng chuối chín."
              status="Sắp diễn ra"
              color="amber"
            />
            <ScheduleItem
              time="12:00 - 14:00"
              title="Giấc Ngủ Trưa Yên Bình"
              desc="Phòng ngủ điều hòa nhiệt độ chuẩn 26°C, bật nhạc thiền mầm non giúp bé ngủ sâu."
              status="Chờ thực hiện"
              color="gray"
            />
          </div>
        </div>

        {/* Health & Safety Side Panel */}
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                An Toàn & Lưu Ý Y Tế
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nhắc nhở quan trọng trong ngày
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                <span className="flex items-center gap-1.5">
                  <Apple className="w-4 h-4 text-rose-500" />
                  Dị Ứng Thực Phẩm
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-200/70 dark:bg-rose-900/70 text-rose-900 dark:text-rose-200 text-[10px]">
                  Lớp Mầm A1
                </span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400">
                Bé <strong>Minh An</strong> dị ứng đậu hải sản. Bếp ăn đã chuẩn bị phần ăn thay thế.
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-amber-500" />
                  Nhắc Thuốc Uống
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 text-[10px]">
                  11:30 Trưa
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Bé <strong>Bảo Ngọc</strong> (Lớp Chồi B2): Phụ huynh gửi sirô ho 5ml sau bữa ăn trưa.
              </p>
            </div>

            <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-800 dark:text-indigo-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  Đón Trẻ Chờ Duyệt
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-200/70 dark:bg-indigo-900/70 text-indigo-900 dark:text-indigo-200 text-[10px]">
                  3 Đơn Mới
                </span>
              </div>
              <p className="text-xs text-indigo-700 dark:text-indigo-400">
                Phụ huynh bé Hoàng Nam ủy quyền cho Ông Nội đón chiều nay.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function DashboardStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <StatCard 
        title="Tổng Số Lớp Học" 
        value="12 Lớp" 
        subtext="Mầm, Chồi, Lá & Nursery"
        icon={<BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        gradient="from-indigo-500/10 via-indigo-500/5 to-transparent"
        borderColor="border-indigo-200/80 dark:border-indigo-800/80"
      />
      <StatCard 
        title="Bé Đã Nhập Học" 
        value="280 Bé" 
        subtext="148 Nam • 132 Nữ"
        icon={<Baby className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
        borderColor="border-emerald-200/80 dark:border-emerald-800/80"
      />
      <StatCard 
        title="Có Mặt Hôm Nay" 
        value="268 / 280" 
        subtext="Tỷ lệ chuyên cần 95.7%"
        icon={<CalendarCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        gradient="from-amber-500/10 via-amber-500/5 to-transparent"
        borderColor="border-amber-200/80 dark:border-amber-800/80"
      />
      <StatCard 
        title="Đánh Giá Phát Triển" 
        value="4.9 / 5.0" 
        subtext="⭐ 98% Bé Ngoan Xuất Sắc"
        icon={<Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
        gradient="from-purple-500/10 via-purple-500/5 to-transparent"
        borderColor="border-purple-200/80 dark:border-purple-800/80"
      />
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  subtext,
  icon,
  gradient,
  borderColor
}: { 
  title: string; 
  value: number | string; 
  subtext: string;
  icon: React.ReactNode;
  gradient: string;
  borderColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800/80 border ${borderColor} p-5 shadow-sm transition-all hover:shadow-md`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {title}
          </p>
          <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {value}
          </h3>
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1">
            {subtext}
          </p>
        </div>
        <div className="p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600/50 shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
  badge,
  accentBg,
  hoverBorder,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  accentBg: string;
  hoverBorder: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm hover:shadow-xl transition-all duration-300 ${hoverBorder} flex flex-col justify-between space-y-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`p-3 rounded-2xl ${accentBg} transition-transform group-hover:scale-110 duration-300 shrink-0`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {badge}
        </span>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center justify-between">
          <span>{title}</span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>
    </Link>
  );
}

function ScheduleItem({
  time,
  title,
  desc,
  status,
  color,
}: {
  time: string;
  title: string;
  desc: string;
  status: string;
  color: 'emerald' | 'indigo' | 'amber' | 'gray';
}) {
  const colorMap = {
    emerald: 'bg-emerald-500 text-white',
    indigo: 'bg-indigo-600 text-white animate-pulse',
    amber: 'bg-amber-500 text-white',
    gray: 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300',
  };

  return (
    <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50">
      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 w-24 shrink-0 pt-0.5">
        {time}
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
            {title}
          </h4>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${colorMap[color]}`}>
            {status}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {desc}
        </p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-200 dark:bg-slate-700 rounded-3xl h-28" />
      ))}
    </div>
  );
}
