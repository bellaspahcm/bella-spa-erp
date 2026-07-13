'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getFieldSchema } from '@/lib/decision-engine/field-schema-registry';
import { ComparisonOperator } from '@/lib/decision-engine/field-schema.types';

interface ValueInputProps {
  provider: string;
  fieldKey?: string;
  operator?: ComparisonOperator;
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ValueInput({ provider, fieldKey, operator, value, onChange, placeholder, disabled }: ValueInputProps) {
  const fieldSchema = useMemo(() => {
    if (!fieldKey) return null;
    return getFieldSchema(provider, fieldKey);
  }, [provider, fieldKey]);

  // Operators that don't need a value input
  const operatorNeedsValue = operator && !['is_empty', 'is_not_empty'].includes(operator);

  if (!fieldKey || !fieldSchema) {
    return (
      <Input
        disabled
        placeholder="Chọn trường trước"
        className="h-11 !rounded-xl bg-slate-100/50 dark:bg-zinc-900/50 border-slate-200/80 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 text-xs w-full cursor-not-allowed"
      />
    );
  }

  if (!operatorNeedsValue) {
    return (
      <Input
        disabled
        placeholder="Không cần nhập giá trị"
        className="h-11 !rounded-xl bg-slate-100/50 dark:bg-zinc-900/50 border-slate-200/80 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 text-xs w-full cursor-not-allowed"
      />
    );
  }

  const effectivePlaceholder = placeholder || fieldSchema.placeholder || `Nhập ${fieldSchema.label.toLowerCase()}`;

  // Boolean type - use switch
  if (fieldSchema.type === 'boolean') {
    return (
      <div className="flex items-center space-x-3 h-11 px-3 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/60 shadow-sm w-full">
        <Switch
          checked={value === true}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <Label className="text-sm font-bold text-slate-700 dark:text-zinc-300">{value === true ? 'ĐÚNG (True)' : 'SAI (False)'}</Label>
      </div>
    );
  }

  // Enum type - use select dropdown
  if (fieldSchema.type === 'enum' && fieldSchema.enumValues) {
    // For 'in' and 'not_in' operators, allow multiple selection (simplified with comma-separated)
    if (operator === 'in' || operator === 'not_in') {
      return (
        <Input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : value || ''}
          onChange={(e) => {
            const values = e.target.value.split(',').map(v => v.trim()).filter(Boolean);
            onChange(values);
          }}
          placeholder="Ví dụ: VIP, Loyal"
          disabled={disabled}
          className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm w-full"
        />
      );
    }

    const selectedOption = fieldSchema.enumValues.find(
      (option) => option.value.toString() === value?.toString()
    );

    return (
      <Select value={value?.toString()} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm">
          <SelectValue placeholder={effectivePlaceholder}>
            {selectedOption ? selectedOption.label : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl max-h-64">
          {fieldSchema.enumValues.map((option) => (
            <SelectItem key={option.value} value={option.value.toString()} className="text-sm rounded-lg py-2.5">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Number type
  if (fieldSchema.type === 'number') {
    return (
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const num = e.target.value === '' ? null : parseFloat(e.target.value);
          onChange(num);
        }}
        placeholder={effectivePlaceholder}
        disabled={disabled}
        min={fieldSchema.validation?.min}
        max={fieldSchema.validation?.max}
        className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm w-full"
      />
    );
  }

  // Date type
  if (fieldSchema.type === 'date') {
    return (
      <Input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm w-full"
      />
    );
  }

  // Datetime type
  if (fieldSchema.type === 'datetime') {
    return (
      <Input
        type="datetime-local"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm w-full"
      />
    );
  }

  // Default: String type
  return (
    <Input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={effectivePlaceholder}
      disabled={disabled}
      className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm w-full"
    />
  );
}
