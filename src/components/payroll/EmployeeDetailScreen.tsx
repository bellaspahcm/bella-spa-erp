'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  ClipboardList,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Type definitions matching API response
interface EmployeeDetailData {
  employee: {
    id: string;
    name: string;
    position: string;
    hireDate: string;
    yearsOfService: number;
  };
  month: string;
  salary: {
    total: number;
    totalLastMonth: number;
    changePercent: number;
    history?: Array<{ month: string; total: number }>;
  };
  breakdown: {
    baseSalary: {
      amount: number;
      contractSalary: number;
      workingDays: number;
      standardDays: number;
      absentDates: string[];
    };
    serviceCommission: {
      amount: number;
      sessions: number;
      ratePerSession: number;
      sessionBreakdown: Array<{
        packageName: string;
        count: number;
        multiplier: number;
        weighted: number;
      }>;
    };
    positionBonus: {
      amount: number;
      baseCommission: number;
      multiplier: number;
      positionTier: string;
    };
    ratingBonus: {
      amount: number;
      weightedSessions: number;
      bonusPerSession: number;
      averageRating: number | null;
    };
    attendancePenalty: {
      amount: number;
      lateDays: number;
      lateAmount: number;
      lateDates: Array<{ date: string; minutes: number }>;
    };
    advances: {
      amount: number;
      records: Array<{ date: string; amount: number; reason: string }>;
    };
    productSalesCommission?: {
      amount: number;
      records: Array<{ productName: string; quantity: number; amount: number; date: string; status: string }>;
    };
  };
}

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || isNaN(Number(value))) return '0 ₫';
  return Number(value).toLocaleString('vi-VN') + ' ₫';
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
  
  const bgColor = type === 'earning' ? 'bg-primary/5' : 'bg-rose-50/20';
  const borderColor = type === 'earning' 
    ? 'border-primary/20 hover:border-primary/40 hover:bg-primary/5' 
    : 'border-rose-100/50 hover:border-rose-800/30 hover:bg-rose-50/30';
  const textColor = type === 'earning' ? 'text-primary' : 'text-rose-600';
  const iconBgColor = type === 'earning' ? 'bg-primary/10' : 'bg-rose-50';
  const iconColor = type === 'earning' ? 'text-primary' : 'text-rose-600';

  return (
    <Card 
      className={`p-4 ${bgColor} border ${borderColor} rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {/* Icon */}
          <div className={`p-2.5 rounded-xl ${iconBgColor} ${iconColor} flex-shrink-0 transition-transform group-hover:scale-105`}>
            {icon}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-850 text-sm tracking-tight">{title}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{description}</p>
          </div>
        </div>
        
        {/* Amount & Chevron */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className={`text-lg font-bold ${textColor} tracking-tight tabular-nums`}>
            {formatCurrency(amount)}
          </span>
          <div className="text-slate-400">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && details && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <div className="text-xs text-slate-650 leading-relaxed">
            {details}
          </div>
          {actionLabel && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 text-xs font-bold rounded-lg border-slate-200 bg-white hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all active:scale-95"
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

export function EmployeeDetailScreen({ employeeId, month }: { employeeId: string; month?: string }) {
  const router = useRouter();
  const [data, setData] = useState<EmployeeDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const queryParams = new URLSearchParams();
        if (month) {
          queryParams.append('month', month);
        }
        
        const response = await fetch(`/api/payroll/employees/${employeeId}/detail?${queryParams}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch employee data: ${response.statusText}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching employee detail:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [employeeId, month]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Đang tải dữ liệu lương...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Lỗi tải dữ liệu</h2>
          <p className="text-gray-600 mb-4">{error || 'Không tìm thấy dữ liệu nhân viên'}</p>
          <Button onClick={() => window.location.reload()}>
            Thử lại
          </Button>
        </Card>
      </div>
    );
  }

  const changeIcon = data.salary.changePercent >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Sticky Premium Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-6 py-4 space-y-3">
          {/* Breadcrumbs & Back Button */}
          <div className="flex items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
              <Link href="/dashboard" className="hover:text-primary transition-colors">
                Tổng quan
              </Link>
              <ChevronRight size={12} className="opacity-40" />
              <Link href="/dashboard/salary" className="hover:text-primary transition-colors">
                Bảng lương
              </Link>
              <ChevronRight size={12} className="opacity-40" />
              <span className="text-primary font-bold">Chi tiết lương</span>
            </div>

            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:bg-primary/5 hover:text-primary hover:border-primary/30 group print:hidden"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
              <span>Quay lại</span>
            </button>
          </div>

          {/* Title & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div>
              <h1 className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
                {data.employee.name}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                <span className="font-bold text-primary uppercase tracking-wider">{data.employee.position}</span>
                {' • '}
                Ngày vào: {formatDate(data.employee.hireDate)} ({data.employee.yearsOfService} năm)
              </p>
            </div>
            
            <div className="flex gap-2 print:hidden">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold border-slate-200 hover:text-primary hover:border-primary/30 active:scale-95 transition-all"
                onClick={() => setShowComparison(true)}
              >
                <BarChart3 size={14} className="mr-1.5" />
                So sánh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="rounded-xl text-xs font-bold border-slate-200 hover:text-primary hover:border-primary/30 active:scale-95 transition-all"
                onClick={() => window.print()}
              >
                <FileText size={14} className="mr-1.5" />
                Xuất PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Total Salary Card - uses tenant primary color via CSS variable */}
        <Card className="p-6 text-white rounded-[2rem] border-none shadow-xl mb-8 relative overflow-hidden group" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 100%)' }}>
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-sm">
                <Wallet size={24} className="text-white/90" />
              </div>
              <div>
                <p 
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'rgba(255, 255, 255, 0.85)' }}
                >
                  Tổng lương nhận thực tế
                </p>
                <p 
                  className="text-3.5xl font-extrabold font-heading tracking-tight mt-1 tabular-nums"
                  style={{ color: '#ffffff' }}
                >
                  {formatCurrency(data.salary.total)}
                </p>
                <div className="inline-flex items-center gap-1.5 mt-2 bg-white/10 text-white/90 rounded-lg px-2.5 py-1 text-xs backdrop-blur-sm">
                  <span className={data.salary.changePercent >= 0 ? 'text-green-200' : 'text-rose-300'}>
                    {changeIcon}
                  </span>
                  <span className="font-medium">
                    Tháng trước: {formatCurrency(data.salary.totalLastMonth)} 
                    {' '}({data.salary.changePercent >= 0 ? '+' : ''}{data.salary.changePercent}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Section Title */}
        <div className="flex items-center gap-2 mb-6">
          <ClipboardList size={18} className="text-primary" />
          <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-widest">Chi tiết lương</h2>
        </div>

        {/* Breakdown Cards */}
        <div className="space-y-3.5">
          {/* Base Salary */}
          <BreakdownCard
            title="LƯƠNG CƠ BẢN"
            amount={data.breakdown.baseSalary.amount}
            type="earning"
            icon={<Wallet size={20} />}
            description={`${formatCurrency(data.breakdown.baseSalary.contractSalary)} × (${data.breakdown.baseSalary.workingDays}/${data.breakdown.baseSalary.standardDays} ngày)`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-semibold text-slate-700">Công thức tính:</p>
                  <p className="text-slate-600 font-mono bg-slate-50 border border-slate-100 p-2.5 rounded-xl mt-1">
                    {formatCurrency(data.breakdown.baseSalary.contractSalary)} ÷ 26 × {data.breakdown.baseSalary.workingDays} = {formatCurrency(data.breakdown.baseSalary.amount)}
                  </p>
                </div>
                {data.breakdown.baseSalary.absentDates.length > 0 && (
                  <div className="text-sm">
                    <p className="font-semibold text-slate-700">Các ngày vắng mặt:</p>
                    <ul className="list-disc list-inside text-slate-500 mt-1 font-medium space-y-0.5">
                      {data.breakdown.baseSalary.absentDates.map((date) => (
                        <li key={date}>{formatDate(date)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            }
            actionLabel="Xem bảng chấm công chi tiết"
            onActionClick={() => router.push(`/dashboard/salary?tab=attendance&employee=${encodeURIComponent(data.employee.name)}&month=${month || ''}`)} 
          />

          {/* Service Commission */}
          <BreakdownCard
            title="HOA HỒNG DỊCH VỤ"
            amount={data.breakdown.serviceCommission.amount}
            type="earning"
            icon={<DollarSign size={20} />}
            description={`${data.breakdown.serviceCommission.sessions} ca hoàn thành × ${formatCurrency(data.breakdown.serviceCommission.ratePerSession)}/ca`}
            details={
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="font-semibold text-slate-700 mb-2">Chi tiết theo gói dịch vụ:</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                    {data.breakdown.serviceCommission.sessionBreakdown.map((pkg, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-medium">
                        <span className="text-slate-650">{pkg.packageName}:</span>
                        <span className="text-slate-800 font-bold">
                          {pkg.count} ca × {pkg.multiplier} = {pkg.weighted} ca
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex justify-between font-bold text-slate-800 text-xs">
                        <span>Tổng ca quy đổi:</span>
                        <span>
                          {data.breakdown.serviceCommission.sessionBreakdown.reduce((sum, p) => sum + p.weighted, 0)} ca
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
            actionLabel="Xem danh sách ca dịch vụ"
            onActionClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(data.employee.name)}`)}
          />

          {/* Product Sales Commission */}
          {data.breakdown.productSalesCommission && data.breakdown.productSalesCommission.amount > 0 && (
            <BreakdownCard
              title="HOA HỒNG BÁN HÀNG"
              amount={data.breakdown.productSalesCommission.amount}
              type="earning"
              icon={<TrendingUp size={20} />}
              description="Hoa hồng từ bán sản phẩm"
              details={
                <div className="space-y-2">
                  <p className="font-semibold text-slate-700 text-sm">Chi tiết đơn hàng bán sản phẩm:</p>
                  <ul className="space-y-2 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    {data.breakdown.productSalesCommission.records.map((sale, idx) => (
                      <li key={idx} className="text-xs font-medium text-slate-650 flex justify-between">
                        <span>{sale.productName} × {sale.quantity} ({new Date(sale.date).toLocaleDateString('vi-VN')})</span>
                        <span className="font-bold text-slate-800">{formatCurrency(sale.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              }
              actionLabel="Xem lịch sử bán sản phẩm"
              onActionClick={() => router.push(`/dashboard/product-sales?ktv=${employeeId}&month=${month || ''}`)}
            />
          )}

          {/* Position Bonus */}
          <BreakdownCard
            title="THƯỞNG VỊ TRÍ"
            amount={data.breakdown.positionBonus.amount}
            type="earning"
            icon={<Award size={20} />}
            description={`${formatCurrency(data.breakdown.positionBonus.baseCommission)} × (${data.breakdown.positionBonus.multiplier} - 1.0)`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-semibold text-slate-700">Công thức tính:</p>
                  <p className="text-slate-600 font-mono bg-slate-50 border border-slate-100 p-2.5 rounded-xl mt-1">
                    {formatCurrency(data.breakdown.positionBonus.baseCommission)} × ({data.breakdown.positionBonus.multiplier} - 1.0) = {formatCurrency(data.breakdown.positionBonus.amount)}
                  </p>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Hệ số cấp bậc ({data.breakdown.positionBonus.positionTier}): <span className="font-bold text-slate-700">{data.breakdown.positionBonus.multiplier}</span>
                </div>
              </div>
            }
            actionLabel="Xem cấu hình chức danh & bậc thợ"
            onActionClick={() => router.push('/dashboard/services')}
          />

          {/* Rating Bonus */}
          <BreakdownCard
            title="THƯỞNG ĐÁNH GIÁ"
            amount={data.breakdown.ratingBonus.amount}
            type="earning"
            icon={<Star size={20} />}
            description={`${data.breakdown.ratingBonus.weightedSessions} ca quy đổi × ${formatCurrency(data.breakdown.ratingBonus.bonusPerSession)}/ca`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-semibold text-slate-700">Điểm đánh giá trung bình (Rating):</p>
                  <div className="flex items-center gap-2 mt-1.5 bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-amber-500 text-base">⭐⭐⭐⭐☆</span>
                    <span className="text-slate-850 font-bold text-sm">{data.breakdown.ratingBonus.averageRating} sao</span>
                    <span className="text-slate-350 font-medium">•</span>
                    <span className="text-primary font-bold text-xs">+{formatCurrency(data.breakdown.ratingBonus.bonusPerSession)} / ca</span>
                  </div>
                </div>
              </div>
            }
            actionLabel="Xem lịch sử đánh giá từ khách hàng"
            onActionClick={() => router.push(`/dashboard/sessions?search=${encodeURIComponent(data.employee.name)}`)}
          />

          {/* Attendance Penalty */}
          <BreakdownCard
            title="PHẠT CHẤM CÔNG"
            amount={data.breakdown.attendancePenalty.amount}
            type="deduction"
            icon={<AlertCircle size={20} />}
            description={`${data.breakdown.attendancePenalty.lateDays} ngày đi muộn × ${formatCurrency(data.breakdown.attendancePenalty.lateAmount)}`}
            details={
              <div className="space-y-2">
                <div className="text-sm">
                  <p className="font-semibold text-slate-700">Chi tiết ngày đi muộn:</p>
                  <ul className="list-disc list-inside text-slate-500 font-medium mt-1 space-y-0.5">
                    {data.breakdown.attendancePenalty.lateDates.map((late, idx) => (
                      <li key={idx}>
                        {formatDate(late.date)} (muộn {late.minutes} phút)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            }
            actionLabel="Xem lịch sử đi muộn chi tiết"
            onActionClick={() => router.push(`/dashboard/salary?tab=attendance&employee=${encodeURIComponent(data.employee.name)}&month=${month || ''}`)}
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
                  <p className="font-semibold text-slate-700">Lịch sử tạm ứng trong tháng:</p>
                  <ul className="space-y-2 mt-2 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    {data.breakdown.advances.records.map((record, idx) => (
                      <li key={idx} className="text-xs font-medium text-slate-650 flex justify-between">
                        <span>{formatDate(record.date)}: {record.reason}</span>
                        <span className="font-bold text-slate-800">{formatCurrency(record.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            }
            actionLabel="Xem lịch sử tạm ứng chi tiết"
            onActionClick={() => router.push(`/dashboard/salary?tab=advances&employee=${encodeURIComponent(data.employee.name)}&month=${month || ''}`)}
          />
        </div>

        {/* Summary */}
        <Card className="p-6 mt-8 rounded-[2rem] border border-slate-200/50 bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-widest">Tổng kết bảng lương</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-slate-500">Tổng thu nhập (Trước khấu trừ):</span>
              <span className="font-bold text-slate-850">
                {formatCurrency(
                  data.breakdown.baseSalary.amount +
                  data.breakdown.serviceCommission.amount +
                  data.breakdown.positionBonus.amount +
                  data.breakdown.ratingBonus.amount +
                  (data.breakdown.productSalesCommission?.amount || 0)
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-slate-500">Tổng khấu trừ:</span>
              <span className="font-bold text-rose-600">
                {formatCurrency(data.breakdown.attendancePenalty.amount + data.breakdown.advances.amount)}
              </span>
            </div>
            <div className="pt-4 border-t border-slate-105 flex items-center justify-between">
              <span className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">Tổng lương thực nhận:</span>
              <span className="font-extrabold text-2xl md:text-3xl text-primary font-heading tracking-tight">
                {formatCurrency(data.salary.total)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <Card className="w-full max-w-md rounded-[2rem] border-none shadow-2xl overflow-hidden bg-white p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold font-heading text-slate-900 tracking-tight">So sánh lương kỹ thuật viên</h2>
              <p className="text-xs text-slate-500 font-medium">So sánh kết quả thu nhập của {data.employee.name} qua các tháng</p>
            </div>
            
            <div className="bg-slate-50 border border-slate-100/80 rounded-2xl p-6 relative">
              <div className="h-48 flex items-end justify-between gap-3 pt-6 px-1">
                {data.salary.history && data.salary.history.length > 0 ? (
                  data.salary.history.map((item, idx) => {
                    const maxVal = Math.max(...(data.salary.history || []).map(h => h.total), 1);
                    const percentage = (item.total / maxVal) * 100;
                    // Check if this month is the current month
                    const isCurrent = item.month === `${data.month.split('-')[1]}/${data.month.split('-')[0]}`;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end relative">
                        {/* Hover Tooltip showing exact value */}
                        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-800 text-white text-[9px] font-bold py-1 px-1.5 rounded shadow-md z-20 pointer-events-none -translate-y-12 text-center">
                          {formatCurrency(item.total)}
                        </div>
                        
                        {/* Vertical Bar */}
                        <div 
                          className="w-full rounded-t-lg transition-all duration-500 relative cursor-pointer"
                          style={{ 
                            height: `${Math.max(6, percentage)}%`,
                            background: isCurrent 
                              ? 'linear-gradient(to top, var(--primary) 0%, var(--accent) 100%)' 
                              : 'linear-gradient(to top, #CBD5E1 0%, #94A3B8 100%)',
                            opacity: isCurrent ? 1 : 0.8
                          }}
                          title={`${item.month}: ${formatCurrency(item.total)}`}
                        />
                        
                        {/* Month Label */}
                        <span className={`text-[10px] font-extrabold mt-1 tracking-tight ${isCurrent ? 'text-primary font-black' : 'text-slate-400'}`}>
                          {item.month}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 text-center w-full">Không có dữ liệu lịch sử</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                className="rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover px-6 py-2 transition-all active:scale-95" 
                onClick={() => setShowComparison(false)}
              >
                Đóng cửa sổ
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CSS overrides for print mode */}
      <style>{`
        @media print {
          /* Hide sidebar, headers, and actions */
          aside, 
          .beauty-erp-sidebar,
          .beauty-erp-mobile-header,
          .print\\:hidden,
          button,
          a,
          nav {
            display: none !important;
          }
          /* Expand layout container to page limits */
          body, html, main, .max-w-4xl {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
