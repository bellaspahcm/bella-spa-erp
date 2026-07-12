'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RulePrioritySlider from './RulePrioritySlider';

interface RuleMetadataFormProps {
  data: any;
  onChange: (data: any) => void;
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
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const categories = CATEGORIES_BY_PROVIDER[data.provider] || [];

  return (
    <div className="space-y-6">
      {/* Rule Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Tên quy tắc <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Ví dụ: Quy tắc phân bổ KTV cho khách hàng VIP"
          required
        />
        <p className="text-sm text-muted-foreground">
          Tên rõ ràng và mô tả đúng quy tắc này
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Mô tả chức năng của quy tắc này và thời điểm áp dụng..."
          rows={3}
        />
        <p className="text-sm text-muted-foreground">
          Giải thích chi tiết (tùy chọn)
        </p>
      </div>

      {/* Provider and Category - Side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Provider */}
        <div className="space-y-2">
          <Label htmlFor="provider">
            Nghiệp vụ áp dụng <span className="text-red-500">*</span>
          </Label>
          <Select
            value={data.provider}
            onValueChange={(value) => {
              handleChange('provider', value);
              handleChange('category', ''); // Reset category when provider changes
            }}
          >
            <SelectTrigger id="provider">
              <SelectValue placeholder="Chọn nghiệp vụ" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.value} value={provider.value}>
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">
            Phân loại <span className="text-red-500">*</span>
          </Label>
          <Select
            value={data.category}
            onValueChange={(value) => handleChange('category', value)}
            disabled={!data.provider}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Chọn phân loại" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {CATEGORY_LABELS[category] || category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">
          Độ ưu tiên: {data.priority}
        </Label>
        <RulePrioritySlider
          value={data.priority}
          onChange={(value) => handleChange('priority', value)}
        />
        <p className="text-sm text-muted-foreground">
          Quy tắc có độ ưu tiên cao hơn sẽ được đánh giá trước (0-1000)
        </p>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Trạng thái</Label>
        <Select
          value={data.status}
          onValueChange={(value) => handleChange('status', value)}
        >
          <SelectTrigger id="status">
            <SelectValue placeholder="Chọn trạng thái" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Quy tắc ở trạng thái bản nháp sẽ không được thực thi
        </p>
      </div>
    </div>
  );
}
