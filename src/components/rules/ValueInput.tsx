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
        placeholder="Select field first" 
        className="w-full"
      />
    );
  }

  if (!operatorNeedsValue) {
    return (
      <Input 
        disabled 
        placeholder="No value needed" 
        className="w-full"
      />
    );
  }

  const effectivePlaceholder = placeholder || fieldSchema.placeholder || `Enter ${fieldSchema.label.toLowerCase()}`;

  // Boolean type - use switch
  if (fieldSchema.type === 'boolean') {
    return (
      <div className="flex items-center space-x-2 h-10">
        <Switch
          checked={value === true}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <Label>{value === true ? 'True' : 'False'}</Label>
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
          placeholder="e.g., VIP, Loyal"
          disabled={disabled}
          className="w-full"
        />
      );
    }

    return (
      <Select value={value?.toString()} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={effectivePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {fieldSchema.enumValues.map((option) => (
            <SelectItem key={option.value} value={option.value.toString()}>
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
        className="w-full"
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
        className="w-full"
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
        className="w-full"
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
      className="w-full"
    />
  );
}
