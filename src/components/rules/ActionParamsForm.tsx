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
  params: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
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

  const handleParamChange = (paramKey: string, value: any) => {
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
            <SelectTrigger id={inputId}>
              <SelectValue placeholder={param.placeholder || `Select ${param.label.toLowerCase()}`} />
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
            value={value ?? ''}
            onChange={(e) => {
              const num = e.target.value === '' ? null : parseFloat(e.target.value);
              handleParamChange(param.key, num);
            }}
            placeholder={param.placeholder}
            disabled={disabled}
            min={param.validation?.min}
            max={param.validation?.max}
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
            value={value || ''}
            onChange={(e) => handleParamChange(param.key, e.target.value)}
            placeholder={param.placeholder}
            disabled={disabled}
            rows={3}
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
          value={value || ''}
          onChange={(e) => handleParamChange(param.key, e.target.value)}
          placeholder={param.placeholder}
          disabled={disabled}
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
