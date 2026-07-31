'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
import RulePrioritySlider from './RulePrioritySlider';

interface RuleMetadataFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

const CATEGORIES_BY_PROVIDER: Record<string, string[]> = {
  booking: ['assignment', 'capacity', 'conflict', 'waitlist', 'priority'],
  discount: ['membership', 'campaign', 'bundle', 'referral'],
  payroll: ['kpi_bonus', 'attendance_deduction', 'session_bonus', 'rating_bonus'],
  commission: ['service_commission', 'product_commission', 'performance_bonus'],
  inventory: ['reorder', 'allocation', 'expiry'],
};

const STATUSES = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'disabled', label: 'Đã tắt' },
  { value: 'pending_approval', label: 'Chờ phê duyệt' },
];

export default function RuleMetadataForm({ data, onChange }: RuleMetadataFormProps) {
  const vocab = useModuleVocabulary();
  const isRealEstate = vocab.booking.singular.includes('giữ chỗ') || vocab.worker.short === 'CVTV';
  const isCleaning = vocab.worker.short === 'NVS';

  const providers = [
    {
      value: 'booking',
      label: isRealEstate ? 'Đơn giữ chỗ & Hợp đồng' : isCleaning ? 'Phiếu công việc & Ca làm' : 'Đặt lịch & Hẹn dịch vụ',
    },
    { value: 'discount', label: 'Chiết khấu & Ưu đãi' },
    { value: 'payroll', label: 'Tính lương & Thưởng' },
    { value: 'commission', label: 'Hoa hồng & Doanh số' },
    {
      value: 'inventory',
      label: isRealEstate ? 'Giỏ hàng & Căn hộ' : isCleaning ? 'Vật tư & Trang thiết bị' : 'Kho hàng & Sản phẩm',
    },
  ];

  const categoryLabels: Record<string, string> = {
    // booking
    assignment: isRealEstate ? 'Phân bổ tư vấn viên' : isCleaning ? 'Phân bổ nhân viên vệ sinh' : 'Phân bổ ca làm',
    capacity: isRealEstate ? 'Hạn mức giữ chỗ' : 'Công suất phục vụ',
    conflict: 'Xung đột lịch',
    waitlist: isRealEstate ? 'Danh sách giữ chỗ hàng chờ' : 'Danh sách chờ',
    priority: 'Độ ưu tiên xử lý',
    // discount
    membership: 'Hạng thành viên / VIP',
    campaign: 'Chiến dịch ưu đãi',
    bundle: 'Gói sản phẩm / Combo',
    referral: 'Giới thiệu khách hàng',
    // payroll
    kpi_bonus: 'Thưởng KPI',
    attendance_deduction: 'Khấu trừ chuyên cần',
    session_bonus: isRealEstate ? 'Thưởng giao dịch' : 'Hoa hồng ca làm',
    rating_bonus: 'Thưởng đánh giá',
    // commission
    service_commission: isRealEstate ? 'Hoa hồng tư vấn' : 'Hoa hồng dịch vụ',
    product_commission: isRealEstate ? 'Hoa hồng bán căn hộ' : 'Hoa hồng bán sản phẩm',
    performance_bonus: 'Thưởng hiệu suất',
    // inventory
    reorder: isRealEstate ? 'Cập nhật bảng hàng' : 'Đặt hàng lại',
    allocation: isRealEstate ? 'Phân bổ giỏ hàng' : 'Phân bổ kho',
    expiry: isRealEstate ? 'Hạn giữ chỗ căn' : 'Hạn sử dụng',
  };

  const handleChange = (field: string, value: unknown) => {
    onChange({ ...data, [field]: value });
  };

  const providerStr = (data.provider as string) || '';
  const categoryStr = (data.category as string) || '';
  const statusStr = (data.status as string) || '';
  const nameStr = (data.name as string) || '';
  const descStr = (data.description as string) || '';
  const priorityNum = (data.priority as number) ?? 100;

  const categories = CATEGORIES_BY_PROVIDER[providerStr] || [];

  return (
    <div className="space-y-6">
      {/* Rule Name */}
      <div className="space-y-2 group">
        <Label
          htmlFor="name"
          className="text-xs font-bold text-slate-700 dark:text-zinc-300 tracking-wider uppercase flex items-center gap-1"
        >
          Tên quy tắc <span className="text-destructive font-black text-sm">*</span>
        </Label>
        <Input
          id="name"
          value={nameStr}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Ví dụ: Quy tắc phân bổ nhân sự cho khách hàng VIP"
          required
          className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm"
        />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
          Tên ngắn gọn, rõ ràng để dễ nhận diện trong hệ thống quyết định.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label
          htmlFor="description"
          className="text-xs font-bold text-slate-700 dark:text-zinc-300 tracking-wider uppercase"
        >
          Mô tả chi tiết
        </Label>
        <Textarea
          id="description"
          value={descStr}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Mô tả chức năng của quy tắc này và thời điểm áp dụng..."
          rows={3}
          className="!rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm resize-none"
        />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
          Giải thích chi tiết về tác động nghiệp vụ (tùy chọn).
        </p>
      </div>

      {/* Provider and Category - Side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Provider */}
        <div className="space-y-2">
          <Label
            htmlFor="provider"
            className="text-xs font-bold text-slate-700 dark:text-zinc-300 tracking-wider uppercase"
          >
            Nghiệp vụ áp dụng <span className="text-destructive font-black text-sm">*</span>
          </Label>
          <PremiumSelect
            value={providerStr}
            onChange={(value) => {
              handleChange('provider', value);
              handleChange('category', ''); // Reset category when provider changes
            }}
            options={providers}
            placeholder="Chọn nghiệp vụ"
            buttonClassName="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm font-medium text-slate-800 dark:text-zinc-200"
            dropdownClassName="shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-slate-200/80 dark:border-zinc-800"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label
            htmlFor="category"
            className="text-xs font-bold text-slate-700 dark:text-zinc-300 tracking-wider uppercase"
          >
            Phân loại cụ thể <span className="text-destructive font-black text-sm">*</span>
          </Label>
          <PremiumSelect
            value={categoryStr}
            onChange={(value) => handleChange('category', value)}
            disabled={!providerStr}
            options={categories.map((c) => ({
              value: c,
              label: categoryLabels[c] || c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            }))}
            placeholder="Chọn phân loại"
            buttonClassName="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm font-medium text-slate-800 dark:text-zinc-200"
            dropdownClassName="shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-slate-200/80 dark:border-zinc-800"
          />
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-100 dark:border-zinc-800/40 rounded-2xl shadow-inner">
        <div className="flex justify-between items-center">
          <Label
            htmlFor="priority"
            className="text-xs font-bold text-slate-700 dark:text-zinc-300 tracking-wider uppercase"
          >
            Mức độ ưu tiên
          </Label>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 animate-pulse">
            {priorityNum}
          </span>
        </div>
        <RulePrioritySlider
          value={priorityNum}
          onChange={(value) => handleChange('priority', value)}
        />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
          * Quy tắc có điểm ưu tiên cao hơn sẽ luôn được thẩm định trước trong chuỗi xử lý.
        </p>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label
          htmlFor="status"
          className="text-xs font-bold text-slate-700 dark:text-zinc-300 tracking-wider uppercase"
        >
          Trạng thái cấu hình
        </Label>
        <PremiumSelect
          value={statusStr}
          onChange={(value) => handleChange('status', value)}
          options={STATUSES}
          placeholder="Chọn trạng thái"
          buttonClassName="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm font-medium text-slate-800 dark:text-zinc-200"
          dropdownClassName="shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-slate-200/80 dark:border-zinc-800"
        />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
          Chỉ các quy tắc &ldquo;Hoạt động&rdquo; mới được nạp vào Decision Engine thời gian thực.
        </p>
      </div>
    </div>
  );
}
