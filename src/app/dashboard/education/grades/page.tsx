/**
 * Bella Education — Student Development Assessment & Star Badges
 *
 * Professional, balanced layout for preschool developmental scoring.
 */

import Link from 'next/link';
import { 
  GraduationCap, 
  ArrowLeft, 
  Search, 
  Award, 
  Sparkles, 
  Star, 
  Heart, 
  Activity, 
  Smile, 
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

const EVALUATION_CARDS = [
  {
    id: 'STU-001',
    name: 'Nguyễn Minh An (Bé Bi)',
    className: 'Lớp Mầm A1',
    height: '98 cm (+1.5cm)',
    weight: '14.5 kg (+0.4kg)',
    whoStatus: 'Đạt chuẩn WHO 🌟',
    badge: '⭐ Bé Ngoan Xuất Sắc',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    cardBorder: 'border-purple-200/80 dark:border-purple-900/60',
    skills: [
      { name: 'Kỹ năng tự phục vụ (Xúc ăn, mang dép)', score: 5 },
      { name: 'Ngôn ngữ & Giao tiếp bạn bè', score: 5 },
      { name: 'Khả năng tập trung hoạt động góc', score: 4 },
    ],
    teacherComment: 'Bé Bi ngoan ngoãn, hòa đồng với các bạn. Bé rất thích giờ đọc truyện và tự giác cất đồ chơi sau khi dùng.',
  },
  {
    id: 'STU-002',
    name: 'Trần Bảo Ngọc (Bé Bắp)',
    className: 'Lớp Chồi B1',
    height: '105 cm (+1.2cm)',
    weight: '16.8 kg (+0.5kg)',
    whoStatus: 'Đạt chuẩn WHO 🌟',
    badge: '🎨 Họa Sĩ Nhí Tài Năng',
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    cardBorder: 'border-indigo-200/80 dark:border-indigo-900/60',
    skills: [
      { name: 'Cảm thụ âm nhạc & Nhịp điệu', score: 5 },
      { name: 'Vẽ tranh & Phối màu sắc', score: 5 },
      { name: 'Tư duy mầm non Reggio Emilia', score: 5 },
    ],
    teacherComment: 'Bé Bắp có năng khiếu vẽ tranh vượt trội. Bé nhận biết màu sắc và tự tin thể hiện ý tưởng độc đáo.',
  },
];

export default function GradesPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── Unified Page Header ── */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Sổ Đánh Giá Phát Triển & Phiếu Bé Ngoan
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Theo dõi chỉ số chiều cao/cân nặng WHO, kỹ năng tư duy và khen thưởng huy hiệu mầm non
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-95 shrink-0">
            <Award className="w-4 h-4" />
            <span>Trao Phiếu Bé Ngoan</span>
          </button>
        </div>

        {/* Bottom Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button className="px-4 py-2 rounded-2xl text-xs font-bold bg-purple-600 text-white shadow-sm transition-colors">
              Tháng 09/2026
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Thể Chất & Chiều Cao
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Kỹ Năng & Tư Duy
            </button>
            <button className="px-4 py-2 rounded-2xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Phiếu Bé Ngoan ⭐
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm tên bé..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── 2 Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {EVALUATION_CARDS.map((card) => (
          <div 
            key={card.id}
            className={`rounded-3xl bg-white dark:bg-slate-800/90 border ${card.cardBorder} p-6 shadow-sm hover:shadow-xl transition-all duration-300 space-y-5 flex flex-col justify-between`}
          >
            <div className="space-y-4">
              {/* Child Header & Badge */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {card.className}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-2">
                    {card.name}
                  </h3>
                </div>
                <span className={`text-xs font-extrabold px-3.5 py-1.5 rounded-full ${card.badgeColor} shadow-sm`}>
                  {card.badge}
                </span>
              </div>

              {/* Growth Metrics */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/40 text-center">
                <div>
                  <p className="text-[11px] text-gray-400 font-medium">Chiều Cao</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">{card.height}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium">Cân Nặng</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">{card.weight}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 font-medium">Đánh Giá WHO</p>
                  <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{card.whoStatus}</p>
                </div>
              </div>

              {/* Skills Rating */}
              <div className="space-y-2.5 pt-1">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Đánh giá chỉ số phát triển:
                </p>
                <div className="space-y-2">
                  {card.skills.map((skill, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">{skill.name}</span>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-3.5 h-3.5 ${i < skill.score ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} 
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Teacher Comment */}
            <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 space-y-1 text-xs">
              <p className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                Lời nhắn cô giáo gửi Phụ huynh:
              </p>
              <p className="text-purple-800 dark:text-purple-400 italic leading-relaxed">
                "{card.teacherComment}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
