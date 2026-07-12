import { Target } from 'lucide-react';
import type { WaitlistEntry } from '@/types/waitlist';

interface WaitlistPriorityBreakdownProps {
  entry: WaitlistEntry;
}

interface PriorityComponent {
  label: string;
  score: number;
  max: number;
  color: string;
}

export function WaitlistPriorityBreakdown({ entry }: WaitlistPriorityBreakdownProps) {
  const components: PriorityComponent[] = [
    {
      label: `Hạng ${entry.customer_tier.toUpperCase()}`,
      score: entry.tier_score,
      max: 40,
      color: 'bg-yellow-500',
    },
    {
      label: 'Giá trị đơn',
      score: entry.value_score,
      max: 30,
      color: 'bg-blue-500',
    },
    {
      label: 'Thời gian chờ',
      score: entry.wait_time_score,
      max: 20,
      color: 'bg-purple-500',
    },
    {
      label: 'Linh hoạt',
      score: entry.flexibility_bonus,
      max: 10,
      color: 'bg-emerald-500',
    },
  ];

  const totalScore = entry.priority_score;
  const totalMax = 100;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">
          Phân tích ưu tiên{' '}
          <span className={`font-bold ${getScoreColor(totalScore)}`}>
            ({totalScore}/{totalMax})
          </span>
        </h2>
      </div>

      <div className="space-y-4">
        {/* Individual Components */}
        {components.map((component, index) => (
          <div key={index}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {component.label}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {component.score}/{component.max}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${component.color}`}
                style={{ width: `${(component.score / component.max) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {/* Total Score */}
        <div className="border-t border-gray-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">Tổng cộng</span>
            <span className={`text-base font-bold ${getScoreColor(totalScore)}`}>
              {totalScore}/{totalMax}
            </span>
          </div>
          <div className="h-4 w-full rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                totalScore >= 80
                  ? 'bg-emerald-500'
                  : totalScore >= 60
                  ? 'bg-blue-500'
                  : totalScore >= 40
                  ? 'bg-yellow-500'
                  : 'bg-gray-400'
              }`}
              style={{ width: `${(totalScore / totalMax) * 100}%` }}
            />
          </div>
        </div>

        {/* Explanation */}
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">📊 Cách tính điểm ưu tiên:</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• <strong>Hạng khách:</strong> VIP = 40đ, Loyal = 25đ, New = 10đ</li>
            <li>• <strong>Giá trị đơn:</strong> Tối đa 30đ (dựa trên giá dịch vụ)</li>
            <li>• <strong>Thời gian chờ:</strong> Tối đa 20đ (tăng dần theo thời gian)</li>
            <li>• <strong>Linh hoạt:</strong> +10đ nếu chấp nhận lịch thay thế</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
