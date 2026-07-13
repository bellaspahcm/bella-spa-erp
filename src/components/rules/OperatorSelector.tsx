'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getOperatorsForField } from '@/lib/decision-engine/field-schema-registry';
import { OPERATOR_LABELS, ComparisonOperator } from '@/lib/decision-engine/field-schema.types';

interface OperatorSelectorProps {
  provider: string;
  fieldKey?: string;
  value?: ComparisonOperator;
  onChange: (operator: ComparisonOperator) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function OperatorSelector({ provider, fieldKey, value, onChange, placeholder = 'Select operator', disabled }: OperatorSelectorProps) {
  const operators = useMemo(() => {
    if (!fieldKey) return [];
    return getOperatorsForField(provider, fieldKey);
  }, [provider, fieldKey]);

  if (!fieldKey || operators.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full h-11 !rounded-xl bg-slate-100/50 dark:bg-zinc-900/50 border-slate-200/80 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 text-sm">
          <SelectValue placeholder={fieldKey ? 'Không có phép so sánh' : 'Chọn trường trước'} />
        </SelectTrigger>
      </Select>
    );
  }

  const selectedLabel = value ? OPERATOR_LABELS[value] : undefined;

  return (
    <Select value={value} onValueChange={(val) => { if (val) onChange(val as ComparisonOperator); }} disabled={disabled}>
      <SelectTrigger className="w-full h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm">
        <SelectValue placeholder={placeholder}>
          {selectedLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl max-h-64">
        {operators.map((operator) => (
          <SelectItem key={operator} value={operator} className="text-sm rounded-lg py-2.5">
            {OPERATOR_LABELS[operator]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
