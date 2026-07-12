'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Card className="bg-white/40 dark:bg-[#1c1b19]/40 backdrop-blur-md border border-white/20 dark:border-white/5 shadow-sm rounded-xl">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">Điều kiện</CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Xác định khi nào quy tắc này được áp dụng
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logical Operator Selector */}
        {conditions.length > 1 && onLogicalOperatorChange && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Khớp</span>
            <Select 
              value={logicalOperator} 
              onValueChange={onLogicalOperatorChange as (value: string) => void}
              disabled={disabled}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">TẤT CẢ (ALL)</SelectItem>
                <SelectItem value="or">BẤT KỲ (ANY)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">điều kiện sau đây:</span>
          </div>
        )}

        {/* Conditions List */}
        {conditions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Chưa định nghĩa điều kiện nào</p>
            <p className="text-sm mt-1">Bấm &quot;Thêm điều kiện&quot; để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conditions.map((condition, index) => (
              <div key={index}>
                <ConditionRow
                  provider={provider}
                  condition={condition}
                  onChange={(updated) => handleUpdateCondition(index, updated)}
                  onDelete={() => handleDeleteCondition(index)}
                  error={errors[`condition-${index}`]}
                  disabled={disabled}
                />
                {/* AND/OR separator between conditions */}
                {index < conditions.length - 1 && (
                  <div className="flex justify-center my-2">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded">
                      {logicalOperator === 'and' ? 'VÀ (AND)' : 'HOẶC (OR)'}
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
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Thêm điều kiện
        </Button>
      </CardContent>
    </Card>
  );
}
