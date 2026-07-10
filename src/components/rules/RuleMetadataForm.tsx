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
  { value: 'booking', label: 'Booking' },
  { value: 'discount', label: 'Discount' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'commission', label: 'Commission' },
  { value: 'inventory', label: 'Inventory' },
];

const CATEGORIES_BY_PROVIDER: Record<string, string[]> = {
  booking: ['assignment', 'capacity', 'conflict', 'waitlist', 'priority'],
  discount: ['membership', 'campaign', 'bundle', 'referral'],
  payroll: ['kpi_bonus', 'attendance_deduction', 'session_bonus', 'rating_bonus'],
  commission: ['service_commission', 'product_commission', 'performance_bonus'],
  inventory: ['reorder', 'allocation', 'expiry'],
};

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'pending_approval', label: 'Pending Approval' },
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
          Rule Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., VIP Customer Priority Assignment"
          required
        />
        <p className="text-sm text-muted-foreground">
          A clear, descriptive name for this rule
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={data.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe what this rule does and when it applies..."
          rows={3}
        />
        <p className="text-sm text-muted-foreground">
          Optional detailed explanation
        </p>
      </div>

      {/* Provider and Category - Side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Provider */}
        <div className="space-y-2">
          <Label htmlFor="provider">
            Provider <span className="text-red-500">*</span>
          </Label>
          <Select
            value={data.provider}
            onValueChange={(value) => {
              handleChange('provider', value);
              handleChange('category', ''); // Reset category when provider changes
            }}
          >
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select provider" />
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
            Category <span className="text-red-500">*</span>
          </Label>
          <Select
            value={data.category}
            onValueChange={(value) => handleChange('category', value)}
            disabled={!data.provider}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">
          Priority: {data.priority}
        </Label>
        <RulePrioritySlider
          value={data.priority}
          onChange={(value) => handleChange('priority', value)}
        />
        <p className="text-sm text-muted-foreground">
          Higher priority rules are evaluated first (0-1000)
        </p>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={data.status}
          onValueChange={(value) => handleChange('status', value)}
        >
          <SelectTrigger id="status">
            <SelectValue placeholder="Select status" />
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
          Draft rules are not executed
        </p>
      </div>
    </div>
  );
}
