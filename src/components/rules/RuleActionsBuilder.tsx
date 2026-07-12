'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { ActionRow, ActionExpression } from './ActionRow';

interface RuleActionsBuilderProps {
  provider: string;
  actions: ActionExpression[];
  onChange: (actions: ActionExpression[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function RuleActionsBuilder({
  provider,
  actions,
  onChange,
  errors = {},
  disabled,
}: RuleActionsBuilderProps) {
  const handleAddAction = useCallback(() => {
    onChange([
      ...actions,
      { type: undefined, params: {} },
    ]);
  }, [actions, onChange]);

  const handleUpdateAction = useCallback((index: number, action: ActionExpression) => {
    const newActions = [...actions];
    newActions[index] = action;
    onChange(newActions);
  }, [actions, onChange]);

  const handleDeleteAction = useCallback((index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    onChange(newActions);
  }, [actions, onChange]);

  return (
    <Card className="bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border border-white/20 dark:border-white/5 shadow-sm rounded-xl">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">Hành động</CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Xác định điều gì xảy ra khi các điều kiện được thỏa mãn
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actions List */}
        {actions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Chưa định nghĩa hành động nào</p>
            <p className="text-sm mt-1">Bấm &quot;Thêm hành động&quot; để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action, index) => {
              // Parse action errors if they exist
              const actionErrorKey = `action-${index}`;
              let actionErrors = {};
              if (errors[actionErrorKey]) {
                try {
                  actionErrors = JSON.parse(errors[actionErrorKey]);
                } catch {
                  actionErrors = { general: errors[actionErrorKey] };
                }
              }

              return (
                <ActionRow
                  key={index}
                  provider={provider}
                  action={action}
                  actionNumber={index + 1}
                  onChange={(updated) => handleUpdateAction(index, updated)}
                  onDelete={() => handleDeleteAction(index)}
                  errors={actionErrors}
                  disabled={disabled}
                />
              );
            })}
          </div>
        )}

        {/* Add Action Button */}
        <Button
          variant="outline"
          onClick={handleAddAction}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm hành động
        </Button>
      </CardContent>
    </Card>
  );
}
