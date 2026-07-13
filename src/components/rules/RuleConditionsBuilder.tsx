'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { ConditionRow, ConditionExpression } from './ConditionRow';

interface RuleConditionsBuilderProps {
  provider: string;
  conditions: ConditionExpression[];
  onChange: (conditions: ConditionExpression[]) => void;
  logicalOperator?: 'and' | 'or';
  onLogicalOperatorChange?: (operator: 'and' | 'or') => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function RuleConditionsBuilder({
  provider,
  conditions,
  onChange,
  logicalOperator = 'and',
  onLogicalOperatorChange,
  errors = {},
  disabled,
}: RuleConditionsBuilderProps) {
  const handleAddCondition = useCallback(() => {
    onChange([
      ...conditions,
      { field: undefined, operator: undefined, value: undefined },
    ]);
  }, [conditions, onChange]);

  const handleUpdateCondition = useCallback((index: number, condition: ConditionExpression) => {
    const newConditions = [...conditions];
    newConditions[index] = condition;
    onChange(newConditions);
  }, [conditions, onChange]);

  const handleDeleteCondition = useCallback((index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    onChange(newConditions);
  }, [conditions, onChange]);

  return (
    <Card className="bg-white/50 dark:bg-zinc-950/40 backdrop-blur-md border border-slate-200/60 dark:border-zinc-800/40 shadow-md rounded-3xl overflow-hidden relative">
      {/* Top Gradient Ribbon (Canva Style) */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-violet-500 via-primary to-accent" />

      <CardHeader className="pt-7 pb-5">
        <CardTitle className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
          Điều kiện kích hoạt
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Quy tắc này sẽ tự động kích hoạt khi các điều kiện kiểm tra bên dưới được thỏa mãn
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Logical Operator Selector (Canva Pill Style) */}
        {conditions.length > 1 && onLogicalOperatorChange && (
          <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-zinc-900/40 p-1.5 rounded-2xl border border-slate-200/40 dark:border-zinc-800/40 w-fit">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 pl-2">Khớp</span>
            <div className="flex rounded-xl overflow-hidden bg-slate-200/40 dark:bg-zinc-850 p-1 gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onLogicalOperatorChange('and')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-all duration-200 ${
                  logicalOperator === 'and'
                    ? 'bg-white dark:bg-zinc-800 text-primary shadow-sm border border-slate-200/50 dark:border-zinc-700/50 scale-102 font-black'
                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Tất cả (AND)
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onLogicalOperatorChange('or')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-all duration-200 ${
                  logicalOperator === 'or'
                    ? 'bg-white dark:bg-zinc-800 text-primary shadow-sm border border-slate-200/50 dark:border-zinc-700/50 scale-102 font-black'
                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Bất kỳ (OR)
              </button>
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 pr-2">điều kiện dưới đây:</span>
          </div>
        )}

        {/* Conditions List */}
        {conditions.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800/80 text-slate-400 dark:text-zinc-500 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-full bg-slate-100/80 dark:bg-zinc-900/60 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-zinc-500">
              <Plus className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider">Chưa thiết lập điều kiện</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Bấm nút thêm điều kiện phía dưới để bắt đầu</p>
          </div>
        ) : (
          <div className={conditions.length > 1 ? "relative pl-8 border-l-2 border-dashed border-slate-200 dark:border-zinc-800 ml-6 space-y-6" : "space-y-6"}>
            {conditions.map((condition, index) => (
              <div key={index} className="relative animate-in fade-in duration-300">
                {/* Node Connector Dot */}
                {conditions.length > 1 && (
                  <div className="absolute -left-[39px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white dark:bg-zinc-950 border-2 border-primary flex items-center justify-center shadow-sm z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                )}

                <ConditionRow
                  provider={provider}
                  condition={condition}
                  onChange={(updated) => handleUpdateCondition(index, updated)}
                  onDelete={() => handleDeleteCondition(index)}
                  error={errors[`condition-${index}`]}
                  disabled={disabled}
                />

                {/* Node Connection Flow Separator */}
                {index < conditions.length - 1 && (
                  <div className="absolute -left-[49px] -bottom-[16px] z-10 flex justify-center">
                    <span className="text-[9px] font-black tracking-widest uppercase text-white bg-gradient-to-r from-primary to-accent px-2.5 py-0.5 rounded-full shadow-md">
                      {logicalOperator === 'and' ? 'VÀ' : 'HOẶC'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Condition Button */}
        <Button
          variant="outline"
          onClick={handleAddCondition}
          disabled={disabled}
          className="w-full h-11 border-dashed border-slate-300 dark:border-zinc-800 hover:border-primary hover:text-primary rounded-2xl transition-all duration-200 active:scale-[0.98] font-bold text-xs uppercase tracking-wider"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm điều kiện mới
        </Button>
      </CardContent>
    </Card>
  );
}
