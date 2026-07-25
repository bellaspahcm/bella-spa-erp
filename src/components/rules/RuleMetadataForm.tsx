'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RulePrioritySlider from './RulePrioritySlider';

interface RuleMetadataFormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

const PROVIDERS = [
  { value: 'booking', label: 'Đặt lịch' },
  { value: 'discount', label: 'Chiết khấu' },
  { value: 'payroll', label: 'Tính lương' },
  { value: 'commission', label: 'Hoa hồng' },
  { value: 'inventory', label: 'Kho hàng' },
];

const CATEGORIES_BY_PROVIDER: Record<string, string[]> = {
  booking: ['assignment', 'capacity', 'conflict', 'waitlist', 'priority'],
  discount: ['membership', 'campaign', 'bundle', 'referral'],
  payroll: ['kpi_bonus', 'attendance_deduction', 'session_bonus', 'rating_bonus'],
  commission: ['service_commission', 'product_commission', 'performance_bonus'],
  inventory: ['reorder', 'allocation', 'expiry'],
};

const CATEGORY_LABELS: Record<string, string> = {
  // booking
  assignment: 'Phân bổ ca',
  capacity: 'Công suất',
  conflict: 'Xung đột lịch',
  waitlist: 'Danh sách chờ',
  priority: 'Ưu tiên',
  // discount
  membership: 'Hạng thành viên',
  campaign: 'Chiến dịch',
  bundle: 'Gói combo',
  referral: 'Giới thiệu',
  // payroll
  kpi_bonus: 'Thưởng KPI',
  attendance_deduction: 'Khấu trừ chuyên cần',
  session_bonus: 'Hoa hồng ca làm',
  rating_bonus: 'Thưởng đánh giá',
  // commission
  service_commission: 'Hoa hồng dịch vụ',
  product_commission: 'Hoa hồng sản phẩm',
  performance_bonus: 'Thưởng hiệu suất',
  // inventory
  reorder: 'Đặt hàng lại',
  allocation: 'Phân bổ kho',
  expiry: 'Hạn sử dụng',
};

const STATUSES = [
  { value: 'draft', label: 'Bản nháp' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'disabled', label: 'Đã tắt' },
  { value: 'pending_approval', label: 'Chờ phê duyệt' },
];

export default function RuleMetadataForm({ data, onChange }: RuleMetadataFormProps) {
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

  const selectedProvider = PROVIDERS.find((p) => p.value === providerStr);
  const selectedCategoryLabel = categoryStr
    ? CATEGORY_LABELS[categoryStr] || categoryStr.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    : undefined;
  const selectedStatus = STATUSES.find((s) => s.value === statusStr);

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
          placeholder="Ví dụ: Quy tắc phân bổ KTV cho khách hàng VIP"
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
          <Select
            value={providerStr}
            onValueChange={(value) => {
              handleChange('provider', value);
              handleChange('category', ''); // Reset category when provider changes
            }}
          >
            <SelectTrigger
              id="provider"
              className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm"
            >
              <SelectValue placeholder="Chọn nghiệp vụ">
                {selectedProvider ? selectedProvider.label : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl">
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.value} value={provider.value} className="text-sm rounded-lg py-2.5">
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label
            htmlFor="category"
            className="text-xs font-bold text-slate-700 dark:text-zinc-300 tracking-wider uppercase"
          >
            Phân loại cụ thể <span className="text-destructive font-black text-sm">*</span>
          </Label>
          <Select
            value={categoryStr}
            onValueChange={(value) => handleChange('category', value)}
            disabled={!providerStr}
          >
            <SelectTrigger
              id="category"
              className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm"
            >
              <SelectValue placeholder="Chọn phân loại">
                {selectedCategoryLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl">
              {categories.map((category) => (
                <SelectItem key={category} value={category} className="text-sm rounded-lg py-2.5">
                  {CATEGORY_LABELS[category] || category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Select
          value={statusStr}
          onValueChange={(value) => handleChange('status', value)}
        >
          <SelectTrigger
            id="status"
            className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm"
          >
            <SelectValue placeholder="Chọn trạng thái">
              {selectedStatus ? selectedStatus.label : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl">
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value} className="text-sm rounded-lg py-2.5">
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
          Chỉ các quy tắc &ldquo;Hoạt động&rdquo; mới được nạp vào Decision Engine thời gian thực.
        </p>
      </div>
    </div>
  );
}
