'use client';

import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionTypeSelector } from './ActionTypeSelector';
import { ActionParamsForm } from './ActionParamsForm';
import { getActionSchema } from '@/lib/decision-engine/action-schema-registry';

export interface ActionExpression {
  type?: string;
  params?: Record<string, any>;
}

interface ActionRowProps {
  provider: string;
  action: ActionExpression;
  actionNumber: number;
  onChange: (action: ActionExpression) => void;
  onDelete: () => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export function ActionRow({ provider, action, actionNumber, onChange, onDelete, errors = {}, disabled }: ActionRowProps) {
  const actionSchema = useMemo(() => {
    if (!action.type) return null;
    return getActionSchema(provider, action.type);
  }, [provider, action.type]);

  // Initialize params with default values when action type changes
  useEffect(() => {
    if (actionSchema && !action.params) {
      const defaultParams: Record<string, any> = {};
      actionSchema.params.forEach(param => {
        if (param.defaultValue !== undefined) {
          defaultParams[param.key] = param.defaultValue;
        }
      });
      if (Object.keys(defaultParams).length > 0) {
        onChange({
          ...action,
          params: defaultParams,
        });
      }
    }
  }, [actionSchema, action, onChange]);

  const handleTypeChange = (type: string) => {
    onChange({
      type,
      params: {},
    });
  };

  const handleParamsChange = (params: Record<string, any>) => {
    onChange({
      ...action,
      params,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Action {actionNumber}
          </CardTitle>
          <div className="flex items-center gap-1">
            {actionSchema?.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{actionSchema.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={disabled}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Type Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Action Type
            <span className="text-red-500 ml-1">*</span>
          </label>
          <ActionTypeSelector
            provider={provider}
            value={action.type}
            onChange={handleTypeChange}
            disabled={disabled}
          />
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type}</p>
          )}
        </div>

        {/* Action Parameters Form */}
        {action.type && (
          <div className="pt-2 border-t">
            <ActionParamsForm
              provider={provider}
              actionType={action.type}
              params={action.params || {}}
              onChange={handleParamsChange}
              errors={errors}
              disabled={disabled}
            />
          </div>
        )}

        {/* Action Description */}
        {actionSchema?.description && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            ℹ️ {actionSchema.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
