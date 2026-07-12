'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGroupedActions } from '@/lib/decision-engine/action-schema-registry';

interface ActionTypeSelectorProps {
  provider: string;
  value?: string;
  onChange: (actionType: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ActionTypeSelector({ provider, value, onChange, placeholder = 'Select action type', disabled }: ActionTypeSelectorProps) {
  const groupedActions = useMemo(() => getGroupedActions(provider), [provider]);

  if (Object.keys(groupedActions).length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="No actions available" />
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
        {Object.entries(groupedActions).map(([group, actions]) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {actions.map((action) => (
              <SelectItem key={action.type} value={action.type}>
                {action.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
