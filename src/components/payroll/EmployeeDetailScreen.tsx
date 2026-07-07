'use client';

import { useState } from 'react';
import { 
  ArrowLeft, 
  TrendingDown, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  BarChart3,
  Wallet,
  DollarSign,
  Award,
  Star,
  AlertCircle,
  CreditCard,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Mock data - sẽ thay bằng real API sau
const MOCK_EMPLOYEE_DATA = {
  employee: {
    id: 'emp001',
    name: 'Nguyễn Văn A',
    position: 'Senior KTV',
    hireDate: '2024-01-15',
    yearsOfService: 2.5,
  },
  month: '2026-06',
  salary: {
    total: 8650000,
    totalLastMonth: 9100000,
    changePercent: -4.9,
  },
  breakdown: {
    baseSalary: {
      amount: 5538462,
      contractSalary: 6000000,
      workingDays: 24,
      standardDays: 26,
      absentDates: ['2026-06-10', '2026-06-15'],
    },
    serviceCommission: {
      amount: 2250000,
      sessions: 15,
      ratePerSession: 150000,
      sessionBreakdown: [
        { packageName: 'Combo Mẹ & Bé Tiết Kiệm', count: 8, multiplier: 1.0, weighted: 8.0 },
        { packageName: 'Combo Mẹ & Bé Hạnh Phúc', count: 3, multiplier: 1.5, weighted: 4.5 },
        { packageName: 'Combo Mẹ & Bé VIP Toàn Diện', count: 1, multiplier: 2.0, weighted: 2.0 },
        { packageName: 'Dịch vụ lẻ', count: 0.5, multiplier: 1.0, weighted: 0.5 },
      ],
    },
    positionBonus: {
      amount: 450000,
      baseCommission: 2250000,
      multiplier: 1.2,
      positionTier: 'Senior',
    },
    ratingBonus: {
      amount: 465000,
      weightedSessions: 15.5,
      bonusPerSession: 30000,
      averageRating: 4.7,
    },
    attendancePenalty: {
      amount: -50000,
      lateDays: 1,
      lateAmount: 50000,
      lateDates: [{ date: '2026-06-12', minutes: 15 }],
    },
    advances: {
      amount: -500000,
      records: [{ date: '2026-06-15', amount: 500000, reason: 'Chi phí cá nhân' }],
    },
  },
};

interface BreakdownCardProps {
  title: string;
  amount: number;
  type: 'earning' | 'deduction';
  description: string;
  icon: React.ReactNode;
  details?: React.ReactNode;
  actionLabel?: string;
  onActionClick?: () => void;
}

function BreakdownCard({ 
  title, 
  amount, 
  type, 
  description, 
  icon,
  details,
  actionLabel,
  onActionClick 
}: BreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const bgColor = type === 'earning' ? 'bg-green-50/50' : 'bg-red-50/50';
  const borderColor = type === 'earning' ? 'border-green-200' : 'border-red-200';
  const textColor = type === 'earning' ? 'text-green-700' : 'text-red-700';
  const iconBgColor = type === 'earning' ? 'bg-green-100' : 'bg-red-100';
  const iconColor = type === 'earning' ? 'text-green-600' : 'text-red-600';

  return (
    <Card 
      className={`p-3 ${bgColor} border ${borderColor} hover:shadow-lg hover:border-opacity-100 transition-all cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Icon */}
          <div className={`p-2 rounded-lg ${iconBgColor} ${iconColor} flex-shrink-0`}>
            {icon}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            <p className="text-xs text-gray-600 mt-0.5 truncate">{description}</p>
          </div>
        </div>
        
        {/* Amount & Chevron */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-lg font-bold ${textColor} tabular-nums`}>
            {amount.toLocaleString('vi-VN')}đ
          </span>
          <div className="text-gray-400">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && details && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {details}
          {actionLabel && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={(e) => {
                e.stopPropagation();
                onActionClick?.();
              }}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export function EmployeeDetailScreen() {
  const data = MOCK_EMPLOYEE_DATA;
  const [showComparison, setShowComparison] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const changeIcon = data.salary.changePercent >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  const changeColor = data.salary.changePercent >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={20} />
                <span className="ml-2">Quay lại</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {data.employee.name}
                </h1>
                <p className="text-sm text-gray-600">
                  {data.employee.position} • Ngày vào: {formatDate(data.employee.hireDate)} ({data.employee.yearsOfService} năm)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComparison(true)}
              >
                <BarChart3 size={16} className="mr-2" />
                So sánh
              </Button>
              <Button variant="outline" size="sm">
                <FileText size={16} className="mr-2" />
                Xuất PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Total Salary Card */}
        <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-200/50 rounded-xl">
                <Wallet size={24} className="text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1 font-medium">TỔNG LƯƠNG</p>
                <p className="text-3xl font-bold text-blue-900 tabular-nums">
                  {data.salary.total.toLocaleString('vi-VN')}đ
                </p>
                <div className={`flex items-center gap-1.5 mt-1 ${changeColor}`}>
                  {changeIcon}
                  <span className="text-xs font-medium">
                    Tháng 5/2026: {data.salary.totalLastMonth.toLocaleString('vi-VN')}đ 
                    ({data.salary.changePercent >= 0 ? '+' : ''}{data.salary.changePercent}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Section Title */}
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">CHI TIẾT LƯƠNG</h2>
        </div>

        {/* Breakdown Cards */}
        <div className="space-y-3">
          {/* Base Salary */}
          <BreakdownCard
            title="LƯƠNG CƠ BẢN"
            amount={data.breakdown.baseSalary.amount}
            type="earning"
            icon={<Wallet size={20} />}
            description={`${data.breakdown.baseSalary.contractSalary.toLocaleString('vi-VN')}đ × (${data.breakdown.baseSalary.workingDays}/${data.breakdown.baseSalary.standardDays} ngày)`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Công thức:</p>
                  <p className="text-gray-600 font-mono bg-white p-2 rounded mt-1">
                    {data.breakdown.baseSalary.contractSalary.toLocaleString('vi-VN')}đ ÷ 26 × {data.breakdown.baseSalary.workingDays} = {data.breakdown.baseSalary.amount.toLocaleString('vi-VN')}đ
                  </p>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Vắng mặt:</p>
                  <ul className="list-disc list-inside text-gray-600 mt-1">
                    {data.breakdown.baseSalary.absentDates.map((date) => (
                      <li key={date}>{formatDate(date)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            }
            actionLabel="Xem chấm công"
          />

          {/* Service Commission */}
          <BreakdownCard
            title="HOA HỒNG DỊCH VỤ"
            amount={data.breakdown.serviceCommission.amount}
            type="earning"
            icon={<DollarSign size={20} />}
            description={`${data.breakdown.serviceCommission.sessions} ca hoàn thành × ${data.breakdown.serviceCommission.ratePerSession.toLocaleString('vi-VN')}đ/ca`}
            details={
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium text-gray-700 mb-2">Breakdown theo gói:</p>
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    {data.breakdown.serviceCommission.sessionBreakdown.map((pkg, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-gray-600">{pkg.packageName}:</span>
                        <span className="text-gray-900 font-medium">
                          {pkg.count} ca × {pkg.multiplier} = {pkg.weighted} ca
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between font-semibold">
                        <span>Tổng quy đổi:</span>
                        <span>
                          {data.breakdown.serviceCommission.sessionBreakdown.reduce((sum, p) => sum + p.weighted, 0)} ca
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
            actionLabel="Xem 12 ca"
          />

          {/* Position Bonus */}
          <BreakdownCard
            title="THƯỞNG VỊ TRÍ"
            amount={data.breakdown.positionBonus.amount}
            type="earning"
            icon={<Award size={20} />}
            description={`${data.breakdown.positionBonus.baseCommission.toLocaleString('vi-VN')}đ × (${data.breakdown.positionBonus.multiplier} - 1.0)`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Công thức:</p>
                  <p className="text-gray-600 font-mono bg-white p-2 rounded mt-1">
                    {data.breakdown.positionBonus.baseCommission.toLocaleString('vi-VN')}đ × ({data.breakdown.positionBonus.multiplier} - 1.0) = {data.breakdown.positionBonus.amount.toLocaleString('vi-VN')}đ
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600">
                    Hệ số {data.breakdown.positionBonus.positionTier}: <span className="font-semibold">{data.breakdown.positionBonus.multiplier}</span>
                  </p>
                </div>
              </div>
            }
            actionLabel="Xem cấu hình chức danh"
          />

          {/* Rating Bonus */}
          <BreakdownCard
            title="THƯỞNG ĐÁNH GIÁ"
            amount={data.breakdown.ratingBonus.amount}
            type="earning"
            icon={<Star size={20} />}
            description={`${data.breakdown.ratingBonus.weightedSessions} ca quy đổi × ${data.breakdown.ratingBonus.bonusPerSession.toLocaleString('vi-VN')}đ/ca`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Rating trung bình:</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl">⭐⭐⭐⭐☆</span>
                    <span className="text-gray-900 font-semibold">{data.breakdown.ratingBonus.averageRating} sao</span>
                    <span className="text-gray-600">→ {data.breakdown.ratingBonus.bonusPerSession.toLocaleString('vi-VN')}đ/ca</span>
                  </div>
                </div>
              </div>
            }
            actionLabel="Xem đánh giá chi tiết"
          />

          {/* Attendance Penalty */}
          <BreakdownCard
            title="PHẠT CHẤM CÔNG"
            amount={data.breakdown.attendancePenalty.amount}
            type="deduction"
            icon={<AlertCircle size={20} />}
            description={`${data.breakdown.attendancePenalty.lateDays} ngày đi muộn × ${data.breakdown.attendancePenalty.lateAmount.toLocaleString('vi-VN')}đ`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Chi tiết:</p>
                  <ul className="list-disc list-inside text-gray-600 mt-1">
                    {data.breakdown.attendancePenalty.lateDates.map((late, idx) => (
                      <li key={idx}>
                        {formatDate(late.date)} (muộn {late.minutes} phút)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            }
            actionLabel="Xem chấm công"
          />

          {/* Advances */}
          <BreakdownCard
            title="TẠM ỨNG"
            amount={data.breakdown.advances.amount}
            type="deduction"
            icon={<CreditCard size={20} />}
            description={`${data.breakdown.advances.records.length} lần tạm ứng trong tháng`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">Lịch sử tạm ứng:</p>
                  <ul className="space-y-1 mt-1">
                    {data.breakdown.advances.records.map((record, idx) => (
                      <li key={idx} className="text-gray-600 flex justify-between">
                        <span>{formatDate(record.date)}: {record.reason}</span>
                        <span className="font-semibold">{record.amount.toLocaleString('vi-VN')}đ</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            }
            actionLabel="Xem lịch sử tạm ứng"
          />
        </div>

        {/* Summary */}
        <Card className="p-5 mt-6 bg-gray-100 border-2 border-gray-300">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-gray-600" />
            <h3 className="text-base font-semibold text-gray-900">TỔNG KẾT</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tổng thu nhập:</span>
              <span className="font-semibold text-gray-900">
                {(
                  data.breakdown.baseSalary.amount +
                  data.breakdown.serviceCommission.amount +
                  data.breakdown.positionBonus.amount +
                  data.breakdown.ratingBonus.amount
                ).toLocaleString('vi-VN')}đ
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tổng khấu trừ:</span>
              <span className="font-semibold text-red-600">
                {(data.breakdown.attendancePenalty.amount + data.breakdown.advances.amount).toLocaleString('vi-VN')}đ
              </span>
            </div>
            <div className="pt-2 border-t-2 border-gray-400">
              <div className="flex justify-between">
                <span className="font-bold text-gray-900">TỔNG LƯƠNG:</span>
                <span className="font-bold text-2xl text-blue-900">
                  {data.salary.total.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Comparison Modal - Placeholder */}
      {showComparison && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-auto m-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">SO SÁNH LƯƠNG - {data.employee.name}</h2>
              <p className="text-gray-600 mb-4">Tính năng đang phát triển...</p>
              <Button onClick={() => setShowComparison(false)}>Đóng</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
