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
    <Card className="bg-white/50 dark:bg-zinc-950/40 backdrop-blur-md border border-slate-200/60 dark:border-zinc-800/40 shadow-md rounded-3xl overflow-hidden relative">
      {/* Top Gradient Ribbon (Canva Style) */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-pink-500 via-primary to-accent" />

      <CardHeader className="pt-7 pb-5">
        <CardTitle className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
          Hành động thực thi
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Quyết định hệ thống sẽ xử lý điều gì sau khi toàn bộ điều kiện lọc phía trên khớp thành công
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Actions List */}
        {actions.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800/80 text-slate-400 dark:text-zinc-500 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-full bg-slate-100/80 dark:bg-zinc-900/60 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-zinc-500">
              <Plus className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider">Chưa thiết lập hành động</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Bấm nút thêm hành động phía dưới để bắt đầu cấu hình kết quả</p>
          </div>
        ) : (
          <div className="space-y-5">
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
                <div key={index} className="animate-in fade-in duration-300">
                  <ActionRow
                    provider={provider}
                    action={action}
                    actionNumber={index + 1}
                    onChange={(updated) => handleUpdateAction(index, updated)}
                    onDelete={() => handleDeleteAction(index)}
                    errors={actionErrors}
                    disabled={disabled}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Add Action Button */}
        <Button
          variant="outline"
          onClick={handleAddAction}
          disabled={disabled}
          className="w-full h-11 border-dashed border-slate-300 dark:border-zinc-800 hover:border-primary hover:text-primary rounded-2xl transition-all duration-200 active:scale-[0.98] font-bold text-xs uppercase tracking-wider"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm hành động mới
        </Button>
      </CardContent>
    </Card>
  );
}
