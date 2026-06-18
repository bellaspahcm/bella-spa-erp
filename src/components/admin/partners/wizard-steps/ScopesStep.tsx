/**
 * Scopes Step - Step 2 of Partner Form Wizard
 * 
 * Allows selecting API scopes with presets
 */

'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Info } from 'lucide-react';
import { PartnerFormData } from '../PartnerFormWizard';
import { APIScope, SCOPE_PRESETS } from '@/types/api-gateway';

interface ScopesStepProps {
  formData: PartnerFormData;
  updateFormData: (updates: Partial<PartnerFormData>) => void;
}

const SCOPE_CATEGORIES = [
  {
    name: 'Orders',
    scopes: [
      { value: 'order:read', label: 'Read Orders', description: 'View order details' },
      { value: 'order:write', label: 'Create Orders', description: 'Create new orders' },
      { value: 'order:complete', label: 'Complete Orders', description: 'Mark orders as completed' },
      { value: 'order:cancel', label: 'Cancel Orders', description: 'Cancel existing orders' },
      { value: 'order:*', label: 'All Order Permissions', description: 'Full order access' },
    ],
  },
  {
    name: 'Payments',
    scopes: [
      { value: 'payment:read', label: 'Read Payments', description: 'View payment details' },
      { value: 'payment:write', label: 'Create Payments', description: 'Record payments' },
      { value: 'payment:refund', label: 'Refund Payments', description: 'Process refunds' },
      { value: 'payment:*', label: 'All Payment Permissions', description: 'Full payment access' },
    ],
  },
  {
    name: 'Invoices',
    scopes: [
      { value: 'invoice:read', label: 'Read Invoices', description: 'View invoice details' },
      { value: 'invoice:create', label: 'Create Invoices', description: 'Generate invoices' },
      { value: 'invoice:cancel', label: 'Cancel Invoices', description: 'Cancel invoices' },
      { value: 'invoice:*', label: 'All Invoice Permissions', description: 'Full invoice access' },
    ],
  },
  {
    name: 'POS',
    scopes: [
      { value: 'pos:sync', label: 'Sync POS Data', description: 'Synchronize POS data' },
      { value: 'pos:read', label: 'Read POS Data', description: 'View POS information' },
      { value: 'pos:*', label: 'All POS Permissions', description: 'Full POS access' },
    ],
  },
  {
    name: 'HR',
    scopes: [
      { value: 'hr:sync', label: 'Sync HR Data', description: 'Synchronize HR data' },
      { value: 'hr:read', label: 'Read HR Data', description: 'View HR information' },
      { value: 'hr:*', label: 'All HR Permissions', description: 'Full HR access' },
    ],
  },
  {
    name: 'Analytics',
    scopes: [
      { value: 'analytics:read', label: 'Read Analytics', description: 'View analytics data' },
      { value: 'analytics:*', label: 'All Analytics Permissions', description: 'Full analytics access' },
    ],
  },
  {
    name: 'Webhooks',
    scopes: [
      { value: 'webhook:subscribe', label: 'Subscribe to Webhooks', description: 'Register webhook endpoints' },
      { value: 'webhook:read', label: 'Read Webhooks', description: 'View webhook subscriptions' },
      { value: 'webhook:*', label: 'All Webhook Permissions', description: 'Full webhook access' },
    ],
  },
];

const PRESETS = [
  { key: 'basic', label: 'Basic', description: 'Read-only access to orders and analytics' },
  { key: 'pos_integration', label: 'POS Integration', description: 'Full POS and order management' },
  { key: 'payment_gateway', label: 'Payment Gateway', description: 'Payment processing and webhooks' },
  { key: 'hr_platform', label: 'HR Platform', description: 'HR sync and analytics' },
  { key: 'invoice_provider', label: 'Invoice Provider', description: 'E-invoice generation' },
  { key: 'admin', label: 'Admin (Full Access)', description: '⚠️ All permissions (use with caution)' },
];

export function ScopesStep({ formData, updateFormData }: ScopesStepProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const toggleScope = (scope: APIScope) => {
    const currentScopes = formData.allowed_scopes;
    const isSelected = currentScopes.includes(scope);

    if (isSelected) {
      updateFormData({
        allowed_scopes: currentScopes.filter((s) => s !== scope),
      });
    } else {
      updateFormData({
        allowed_scopes: [...currentScopes, scope],
      });
    }
  };

  const applyPreset = (presetKey: string) => {
    const scopes = SCOPE_PRESETS[presetKey as keyof typeof SCOPE_PRESETS];
    if (scopes) {
      updateFormData({ allowed_scopes: scopes });
      setSelectedPreset(presetKey);
    }
  };

  const clearAllScopes = () => {
    updateFormData({ allowed_scopes: [] });
    setSelectedPreset(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Scopes & Permissions</h2>
        <p className="text-muted-foreground mt-1">
          Select which API scopes this partner can access
        </p>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <Label>Quick Presets</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`p-3 text-left border rounded-lg hover:border-primary transition-colors ${
                selectedPreset === preset.key ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <div className="font-medium text-sm">{preset.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{preset.description}</div>
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={clearAllScopes}>
          Clear All Scopes
        </Button>
      </div>

      {/* Scope Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Individual Scopes</Label>
          <Badge variant="outline">
            {formData.allowed_scopes.length} scope{formData.allowed_scopes.length !== 1 ? 's' : ''} selected
          </Badge>
        </div>

        <div className="space-y-6">
          {SCOPE_CATEGORIES.map((category) => (
            <div key={category.name} className="space-y-2">
              <h4 className="font-semibold text-sm">{category.name}</h4>
              <div className="space-y-2">
                {category.scopes.map((scope) => {
                  const isSelected = formData.allowed_scopes.includes(scope.value as APIScope);
                  return (
                    <button
                      key={scope.value}
                      type="button"
                      onClick={() => toggleScope(scope.value as APIScope)}
                      className={`w-full flex items-start gap-3 p-3 border rounded-lg hover:border-primary transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center h-5 w-5 rounded border-2 ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">{scope.label}</div>
                        <div className="text-xs text-muted-foreground">{scope.description}</div>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                          {scope.value}
                        </code>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {formData.allowed_scopes.length === 0 && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>At least one scope is required.</strong> Select scopes individually or use a preset.
          </div>
        </div>
      )}
    </div>
  );
}
