'use client';

import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldSelector } from './FieldSelector';
import { OperatorSelector } from './OperatorSelector';
import { ValueInput } from './ValueInput';
import { getFieldSchema } from '@/lib/decision-engine/field-schema-registry';
import { ComparisonOperator } from '@/lib/decision-engine/field-schema.types';

export interface ConditionExpression {
  field?: string;
  operator?: ComparisonOperator;
  value?: any;
}

interface ConditionRowProps {
  provider: string;
  condition: ConditionExpression;
  onChange: (condition: ConditionExpression) => void;
  onDelete: () => void;
  error?: string;
  disabled?: boolean;
}

export function ConditionRow({ provider, condition, onChange, onDelete, error, disabled }: ConditionRowProps) {
  const fieldSchema = useMemo(() => {
    if (!condition.field) return null;
    return getFieldSchema(provider, condition.field);
  }, [provider, condition.field]);

  // Extract specific errors if error is a composite key
  const fieldError = error;
  const operatorError = undefined;
  const valueError = undefined;

  // Auto-select default operator when field changes
  useEffect(() => {
    if (fieldSchema && !condition.operator && fieldSchema.defaultOperator) {
      onChange({
        ...condition,
        operator: fieldSchema.defaultOperator,
        value: undefined, // Reset value when field changes
      });
    }
  }, [fieldSchema, condition, onChange]);

  const handleFieldChange = (field: string) => {
    onChange({
      field,
      operator: undefined,
      value: undefined,
    });
  };

  const handleOperatorChange = (operator: ComparisonOperator) => {
    onChange({
      ...condition,
      operator,
      // Reset value if operator doesn't need it
      value: ['is_empty', 'is_not_empty'].includes(operator) ? undefined : condition.value,
    });
  };

  const handleValueChange = (value: any) => {
    onChange({
      ...condition,
      value,
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 items-start">
        {/* Field Selector */}
        <div className="col-span-4">
          <FieldSelector
            provider={provider}
            value={condition.field}
            onChange={handleFieldChange}
            disabled={disabled}
          />
        </div>

        {/* Operator Selector */}
        <div className="col-span-3">
          <OperatorSelector
            provider={provider}
            fieldKey={condition.field}
            value={condition.operator}
            onChange={handleOperatorChange}
            disabled={disabled}
          />
        </div>

        {/* Value Input */}
        <div className="col-span-4">
          <ValueInput
            provider={provider}
            fieldKey={condition.field}
            operator={condition.operator}
            value={condition.value}
            onChange={handleValueChange}
            disabled={disabled}
          />
        </div>

        {/* Delete Button & Info */}
        <div className="col-span-1 flex items-center gap-1">
          {fieldSchema?.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{fieldSchema.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={disabled}
            className="h-10 w-10 text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {fieldError && (
        <p className="text-sm text-destructive px-1">{fieldError}</p>
      )}

      {/* Field Description */}
      {fieldSchema?.description && (
        <p className="text-xs text-muted-foreground px-1">
          {fieldSchema.description}
        </p>
      )}
    </div>
  );
}
