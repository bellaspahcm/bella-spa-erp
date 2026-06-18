/**
 * Review Step - Step 4 of Partner Form Wizard
 * 
 * Final review before submission
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { PartnerFormData } from '../PartnerFormWizard';

interface ReviewStepProps {
  formData: PartnerFormData;
  mode: 'create' | 'edit';
}

export function ReviewStep({ formData, mode }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Review & Confirm</h2>
        <p className="text-muted-foreground mt-1">
          Please review the partner details before {mode === 'create' ? 'creating' : 'updating'}
        </p>
      </div>

      <div className="space-y-6">
        {/* Basic Info Section */}
        <div className="p-4 border rounded-lg space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Basic Information
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Partner Name:</span>
              <div className="font-medium">{formData.partner_name}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Partner Type:</span>
              <div className="font-medium capitalize">{formData.partner_type}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Contact Email:</span>
              <div className="font-medium">{formData.contact_email || '—'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Contact Phone:</span>
              <div className="font-medium">{formData.contact_phone || '—'}</div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Description:</span>
              <div className="font-medium">
                {formData.partner_description || <span className="text-muted-foreground">No description</span>}
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Environment:</span>
              <div className="mt-1">
                {formData.is_sandbox ? (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                    Sandbox (Testing)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-50 text-green-800">
                    Production
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scopes Section */}
        <div className="p-4 border rounded-lg space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            {formData.allowed_scopes.length > 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            Scopes & Permissions
          </h3>
          {formData.allowed_scopes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {formData.allowed_scopes.map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-sm text-red-600">
              ⚠️ No scopes selected. At least one scope is required.
            </div>
          )}
        </div>

        {/* Webhooks Section */}
        <div className="p-4 border rounded-lg space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Webhook Configuration
          </h3>
          {formData.webhook_url ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Webhook URL:</span>
                <div className="font-mono text-xs bg-muted p-2 rounded mt-1">
                  {formData.webhook_url}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Webhook Secret:</span>
                <div className="font-mono text-xs">
                  {formData.webhook_secret ? '••••••••' : 'Not configured'}
                </div>
              </div>
              {formData.webhook_events.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Subscribed Events:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.webhook_events.map((event) => (
                      <Badge key={event} variant="secondary" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No webhook configured (can be added later)
            </div>
          )}
        </div>

        {/* Rate Limiting Section */}
        <div className="p-4 border rounded-lg space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Rate Limiting
          </h3>
          <div className="text-sm">
            <span className="text-muted-foreground">Tier:</span>
            <Badge variant="outline" className="ml-2 capitalize">
              {formData.rate_limit_tier}
            </Badge>
          </div>
        </div>

        {/* Notes Section */}
        {formData.notes && (
          <div className="p-4 border rounded-lg space-y-3">
            <h3 className="font-semibold">Internal Notes</h3>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {formData.notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
