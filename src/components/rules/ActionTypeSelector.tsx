'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGroupedActions, getActionSchema } from '@/lib/decision-engine/action-schema-registry';

interface ActionTypeSelectorProps {
  provider: string;
  value?: string;
  onChange: (actionType: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ActionTypeSelector({ provider, value, onChange, placeholder = 'Select action type', disabled }: ActionTypeSelectorProps) {
  const groupedActions = useMemo(() => getGroupedActions(provider), [provider]);

  const selectedAction = useMemo(() => {
    if (!value) return null;
    return getActionSchema(provider, value);
  }, [provider, value]);

  if (Object.keys(groupedActions).length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full h-11 !rounded-xl bg-slate-100/50 dark:bg-zinc-900/50 border-slate-200/80 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 text-sm">
          <SelectValue placeholder="Không có hành động khả dụng" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={(val) => { if (val) onChange(val); }} disabled={disabled}>
      <SelectTrigger className="w-full h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm">
        <SelectValue placeholder={placeholder}>
          {selectedAction ? selectedAction.label : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl max-h-64">
        {Object.entries(groupedActions).map(([group, actions]) => (
          <SelectGroup key={group}>
            <SelectLabel className="text-xs font-bold text-slate-400 dark:text-zinc-500 tracking-wider uppercase px-2 py-1.5">{group}</SelectLabel>
            {actions.map((action) => (
              <SelectItem key={action.type} value={action.type} className="text-sm rounded-lg py-2.5">
                {action.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
