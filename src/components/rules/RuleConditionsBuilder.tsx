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
    <Card>
      <CardHeader>
        <CardTitle>Conditions</CardTitle>
        <CardDescription>
          Define when this rule should apply
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logical Operator Selector */}
        {conditions.length > 1 && onLogicalOperatorChange && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Match</span>
            <Select 
              value={logicalOperator} 
              onValueChange={onLogicalOperatorChange as (value: string) => void}
              disabled={disabled}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">ALL</SelectItem>
                <SelectItem value="or">ANY</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">of the following conditions:</span>
          </div>
        )}

        {/* Conditions List */}
        {conditions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No conditions defined</p>
            <p className="text-sm mt-1">Click &quot;Add Condition&quot; to get started</p>
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
                      {logicalOperator.toUpperCase()}
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
          Add Condition
        </Button>
      </CardContent>
    </Card>
  );
}
