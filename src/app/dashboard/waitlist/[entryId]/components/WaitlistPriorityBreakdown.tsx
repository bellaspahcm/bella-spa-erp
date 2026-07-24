import { Target, Award, DollarSign, Clock, Sparkles, HelpCircle } from 'lucide-react';
import type { WaitlistEntry } from '@/types/waitlist';

interface WaitlistPriorityBreakdownProps {
  entry: WaitlistEntry;
}

export function WaitlistPriorityBreakdown({ entry }: WaitlistPriorityBreakdownProps) {
  const totalScore = entry.priority_score;
  const totalMax = 100;

  // Circular gauge calculations
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(totalScore, totalMax) / totalMax) * circumference;

  const components = [
    {
      label: `Hạng ${entry.customer_tier.toUpperCase()}`,
      score: entry.tier_score,
      max: 40,
      icon: Award,
      gradient: 'from-amber-400 via-amber-500 to-yellow-600',
      bgGradient: 'bg-amber-500/10',
      textColor: 'text-amber-700 dark:text-amber-400',
      description: 'VIP = 40đ, Loyal = 25đ, New = 10đ',
    },
    {
      label: 'Giá trị dịch vụ',
      score: entry.value_score,
      max: 30,
      icon: DollarSign,
      gradient: 'from-blue-400 via-indigo-500 to-indigo-600',
      bgGradient: 'bg-indigo-500/10',
      textColor: 'text-indigo-700 dark:text-indigo-400',
      description: 'Tính theo tỷ lệ giá trị gói dịch vụ (Tối đa 30đ)',
    },
    {
      label: 'Thời gian chờ',
      score: entry.wait_time_score,
      max: 20,
      icon: Clock,
      gradient: 'from-fuchsia-400 via-purple-500 to-purple-600',
      bgGradient: 'bg-purple-500/10',
      textColor: 'text-purple-700 dark:text-purple-400',
      description: 'Cộng dồn theo thời gian xếp hàng (Tối đa 20đ)',
    },
    {
      label: 'Khung giờ linh hoạt',
      score: entry.flexibility_bonus,
      max: 10,
      icon: Sparkles,
      gradient: 'from-emerald-400 via-teal-500 to-teal-600',
      bgGradient: 'bg-teal-500/10',
      textColor: 'text-teal-700 dark:text-teal-400',
      description: 'Thưởng +10đ nếu đồng ý giờ thay thế gần nhất',
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 from-emerald-400 to-teal-500';
    if (score >= 60) return 'text-indigo-500 from-indigo-400 to-blue-500';
    if (score >= 40) return 'text-amber-500 from-amber-400 to-yellow-600';
    return 'text-rose-500 from-rose-400 to-orange-500';
  };

  return (
    <div className="rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-[#1c1b19] p-6 md:p-8 shadow-sm">
      {/* Title */}
      <div className="mb-6 md:mb-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/20 text-slate-700 dark:text-slate-300">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Phân tích ưu tiên xếp hàng
            </h2>
            <p className="text-xs text-slate-500">
              Điểm tự động quyết định vị trí đề xuất của khách hàng
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Premium Circular Gauge */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/40 relative overflow-hidden">
          <div className="relative flex items-center justify-center h-40 w-40">
            {/* Background circle */}
            <svg className="absolute transform -rotate-90 w-full h-full">
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Foreground circle with gradient */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="transition-all duration-1000 ease-out"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                stroke={`url(#score-gradient)`}
              />
              <defs>
                <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="stop-color-start" style={{ stopColor: totalScore >= 80 ? '#10b981' : totalScore >= 60 ? '#6366f1' : totalScore >= 40 ? '#f59e0b' : '#f43f5e' }} />
                  <stop offset="100%" className="stop-color-end" style={{ stopColor: totalScore >= 80 ? '#14b8a6' : totalScore >= 60 ? '#3b82f6' : totalScore >= 40 ? '#eab308' : '#fb7185' }} />
                </linearGradient>
              </defs>
            </svg>

            {/* Score Text */}
            <div className="text-center z-10">
              <span className="text-4xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                {totalScore}
              </span>
              <span className="text-slate-400 text-xs block mt-0.5">/ {totalMax}đ</span>
            </div>
          </div>

          <div className="text-center mt-4">
            <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400 block">
              Trạng thái ưu tiên
            </span>
            <span className={`text-base font-bold bg-gradient-to-r bg-clip-text text-transparent ${getScoreColor(totalScore)}`}>
              {totalScore >= 80 ? 'Ưu tiên đặc biệt' : totalScore >= 60 ? 'Mức độ cao' : totalScore >= 40 ? 'Mức độ trung bình' : 'Mức độ tiêu chuẩn'}
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Details Breakdown */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {components.map((component, index) => {
              const Icon = component.icon;
              return (
                <div
                  key={index}
                  className="group p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/20 dark:bg-[#1a1917]/20 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all duration-200"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${component.bgGradient} ${component.textColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {component.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                      {component.score} <span className="text-slate-400 font-normal text-xs">/ {component.max}</span>
                    </span>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200/20">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${component.gradient} transition-all duration-500 ease-out`}
                      style={{ width: `${(component.score / component.max) * 100}%` }}
                    />
                  </div>
                  
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {component.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Premium Help Note */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-indigo-500 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Thuật toán tính điểm tự động
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Hệ thống cộng dồn điểm của khách hàng theo thời gian xếp hàng thực tế (+ điểm sau mỗi phút chờ) và độ ưu tiên của phân hạng khách. Khách hàng sẵn sàng nhận lịch linh hoạt sẽ được cộng điểm trực tiếp để được ưu tiên xử lý trước.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
