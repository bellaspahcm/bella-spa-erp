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
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>
          Define what happens when conditions match
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actions List */}
        {actions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No actions defined</p>
            <p className="text-sm mt-1">Click &quot;Add Action&quot; to get started</p>
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
          Add Action
        </Button>
      </CardContent>
    </Card>
  );
}
