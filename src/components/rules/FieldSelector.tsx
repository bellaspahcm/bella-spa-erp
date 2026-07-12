'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGroupedFields } from '@/lib/decision-engine/field-schema-registry';

interface FieldSelectorProps {
  provider: string;
  value?: string;
  onChange: (fieldKey: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FieldSelector({ provider, value, onChange, placeholder = 'Select field', disabled }: FieldSelectorProps) {
  const groupedFields = useMemo(() => getGroupedFields(provider), [provider]);

  if (Object.keys(groupedFields).length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="No fields available" />
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
        {Object.entries(groupedFields).map(([group, fields]) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {fields.map((field) => (
              <SelectItem key={field.key} value={field.key}>
                {field.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
