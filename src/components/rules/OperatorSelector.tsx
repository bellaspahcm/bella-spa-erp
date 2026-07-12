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
        <SelectTrigger className="w-full">
          <SelectValue placeholder={fieldKey ? 'No operators available' : 'Select field first'} />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {operators.map((operator) => (
          <SelectItem key={operator} value={operator}>
            {OPERATOR_LABELS[operator]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
