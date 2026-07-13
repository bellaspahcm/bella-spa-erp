'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGroupedFields, getFieldSchema } from '@/lib/decision-engine/field-schema-registry';

interface FieldSelectorProps {
  provider: string;
  value?: string;
  onChange: (fieldKey: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FieldSelector({ provider, value, onChange, placeholder = 'Select field', disabled }: FieldSelectorProps) {
  const groupedFields = useMemo(() => getGroupedFields(provider), [provider]);

  const selectedField = useMemo(() => {
    if (!value) return null;
    return getFieldSchema(provider, value);
  }, [provider, value]);

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
    <Select value={value} onValueChange={(val) => { if (val) onChange(val); }} disabled={disabled}>
      <SelectTrigger className="w-full h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm">
        <SelectValue placeholder={placeholder}>
          {selectedField ? selectedField.label : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl max-h-64">
        {Object.entries(groupedFields).map(([group, fields]) => (
          <SelectGroup key={group}>
            <SelectLabel className="text-xs font-bold text-slate-400 dark:text-zinc-500 tracking-wider uppercase px-2 py-1.5">{group}</SelectLabel>
            {fields.map((field) => (
              <SelectItem key={field.key} value={field.key} className="text-sm rounded-lg py-2.5">
                {field.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
