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
    <Card className="bg-white/50 dark:bg-zinc-950/40 backdrop-blur-md border border-slate-200/50 dark:border-zinc-800/60 shadow-sm rounded-3xl overflow-hidden relative pl-4 hover:shadow-md hover:border-slate-200 dark:hover:border-zinc-850 transition-all duration-300">
      {/* Left Accent Bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary via-primary-hover to-accent" />

      <CardHeader className="pb-3 pt-5 pr-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-black text-slate-700 dark:text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Hành động #{actionNumber}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {actionSchema?.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8.5 w-8.5 rounded-full text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-850/80 active:scale-95 transition-all"
                    >
                      <Info className="h-4.5 w-4.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-xl p-3 border-slate-200 dark:border-zinc-800 shadow-xl max-w-xs">
                    <p className="text-xs">{actionSchema.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={disabled}
              className="h-8.5 w-8.5 rounded-full text-slate-400 hover:text-destructive dark:text-zinc-500 hover:bg-red-500/10 active:scale-95 transition-all"
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pb-5 pr-5">
        {/* Action Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 tracking-wider uppercase">
            Loại hành động
            <span className="text-destructive font-black text-sm ml-1">*</span>
          </label>
          <ActionTypeSelector
            provider={provider}
            value={action.type}
            onChange={handleTypeChange}
            disabled={disabled}
          />
          {errors.type && (
            <p className="text-xs text-destructive bg-destructive/5 px-2.5 py-1.5 rounded-xl border border-destructive/10 mt-1 font-semibold flex items-center gap-1.5">
              ⚠️ {errors.type}
            </p>
          )}
        </div>

        {/* Action Parameters Form */}
        {action.type && (
          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/60">
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
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 pt-3 border-t border-slate-100 dark:border-zinc-800/45">
            ℹ️ {actionSchema.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
