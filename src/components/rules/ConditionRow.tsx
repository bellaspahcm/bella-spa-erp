'use client';

import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info, AlertCircle } from 'lucide-react';
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

  // Extract specific errors
  const fieldError = error;

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
    <div className={`p-4 rounded-2xl transition-all duration-300 space-y-2 border ${
      fieldError
        ? 'bg-red-500/[0.02] border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.02)]'
        : 'bg-slate-50/70 dark:bg-zinc-900/35 border-slate-100/80 dark:border-zinc-800/40 hover:border-slate-200 dark:hover:border-zinc-850 shadow-sm hover:shadow'
    }`}>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Field Selector */}
        <div className="sm:col-span-4 w-full">
          <FieldSelector
            provider={provider}
            value={condition.field}
            onChange={handleFieldChange}
            disabled={disabled}
          />
        </div>

        {/* Operator Selector */}
        <div className="sm:col-span-3 w-full">
          <OperatorSelector
            provider={provider}
            fieldKey={condition.field}
            value={condition.operator}
            onChange={handleOperatorChange}
            disabled={disabled}
          />
        </div>

        {/* Value Input */}
        <div className="sm:col-span-4 w-full">
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
        <div className="sm:col-span-1 flex justify-end items-center gap-1 w-full">
          {fieldSchema?.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/70 transition-all active:scale-95"
                  >
                    <Info className="h-4.5 w-4.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-xl p-3 border-slate-200 dark:border-zinc-800 shadow-xl max-w-xs">
                  <p className="text-xs">{fieldSchema.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={disabled}
            className="h-9 w-9 rounded-full text-slate-400 hover:text-destructive dark:text-zinc-500 hover:bg-red-500/10 active:scale-95 transition-all"
          >
            <X className="h-4.5 w-4.5" />
          </Button>
        </div>
      </div>

      {/* Helper Context & Errors */}
      {fieldError && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-500/[0.02] border border-red-500/10 px-3 py-2 rounded-xl animate-in slide-in-from-top-1 duration-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{fieldError}</span>
        </div>
      )}

      {/* Inline Description Helper */}
      {fieldSchema?.description && !fieldError && (
        <p className="text-[11px] text-slate-400 dark:text-zinc-500 pl-1">
          💡 {fieldSchema.description}
        </p>
      )}
    </div>
  );
}
