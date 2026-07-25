'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getActionSchema } from '@/lib/decision-engine/action-schema-registry';
import { ActionParam } from '@/lib/decision-engine/action-schema.types';

interface ActionParamsFormProps {
  provider: string;
  actionType: string;
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function ActionParamsForm({ provider, actionType, params, onChange, errors = {}, disabled }: ActionParamsFormProps) {
  const actionSchema = useMemo(() => {
    return getActionSchema(provider, actionType);
  }, [provider, actionType]);

  if (!actionSchema) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No parameters required for this action
      </div>
    );
  }

  if (actionSchema.params.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No parameters required
      </div>
    );
  }

  const handleParamChange = (paramKey: string, value: unknown) => {
    onChange({
      ...params,
      [paramKey]: value,
    });
  };

  const renderParamInput = (param: ActionParam) => {
    const value = params[param.key];
    const error = errors[param.key];
    const inputId = `action-param-${param.key}`;

    // Boolean type - use switch
    if (param.type === 'boolean') {
      return (
        <div key={param.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={inputId}>
              {param.label}
              {param.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Switch
              id={inputId}
              checked={value === true}
              onCheckedChange={(checked) => handleParamChange(param.key, checked)}
              disabled={disabled}
            />
          </div>
          {param.description && (
            <p className="text-xs text-muted-foreground">{param.description}</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    // Enum type - use select
    if (param.type === 'enum' && param.enumValues) {
      const selectedOption = param.enumValues.find(
        (option) => option.value.toString() === value?.toString()
      );

      return (
        <div key={param.key} className="space-y-2">
          <Label htmlFor={inputId}>
            {param.label}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Select
            value={value?.toString()}
            onValueChange={(val) => handleParamChange(param.key, val)}
            disabled={disabled}
          >
            <SelectTrigger id={inputId} className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all duration-200 text-sm">
              <SelectValue placeholder={param.placeholder || `Select ${param.label.toLowerCase()}`}>
                {selectedOption ? selectedOption.label : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {param.enumValues.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {param.description && (
            <p className="text-xs text-muted-foreground">{param.description}</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    // Number type
    if (param.type === 'number') {
      return (
        <div key={param.key} className="space-y-2">
          <Label htmlFor={inputId}>
            {param.label}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={inputId}
            type="number"
            value={(value as string | number) ?? ''}
            onChange={(e) => {
              const num = e.target.value === '' ? null : parseFloat(e.target.value);
              handleParamChange(param.key, num);
            }}
            placeholder={param.placeholder}
            disabled={disabled}
            min={param.validation?.min}
            max={param.validation?.max}
            className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm"
          />
          {param.description && (
            <p className="text-xs text-muted-foreground">{param.description}</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    // String type - check if it's long text (textarea) or short text (input)
    const isLongText = param.key.includes('reason') || param.key.includes('message') || param.key.includes('description');

    if (isLongText) {
      return (
        <div key={param.key} className="space-y-2">
          <Label htmlFor={inputId}>
            {param.label}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Textarea
            id={inputId}
            value={(value as string) || ''}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            placeholder={param.placeholder}
            disabled={disabled}
            rows={3}
            className="!rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm resize-none"
          />
          {param.description && (
            <p className="text-xs text-muted-foreground">{param.description}</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }

    // Default: String type with Input
    return (
      <div key={param.key} className="space-y-2">
        <Label htmlFor={inputId}>
          {param.label}
          {param.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Input
          id={inputId}
          type="text"
          value={(value as string) || ''}
          onChange={(e) => handleParamChange(param.key, e.target.value)}
          placeholder={param.placeholder}
          disabled={disabled}
          className="h-11 !rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/80 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-900/60 dark:hover:border-zinc-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm transition-all duration-200 text-sm"
        />
        {param.description && (
          <p className="text-xs text-muted-foreground">{param.description}</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {actionSchema.params.map(renderParamInput)}
    </div>
  );
}
