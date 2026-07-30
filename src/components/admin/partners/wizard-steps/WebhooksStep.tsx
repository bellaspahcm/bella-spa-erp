/**
 * Webhooks Step - Step 3 of Partner Form Wizard
 * 
 * Optional webhook configuration
 */

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, Info } from 'lucide-react';
import { PartnerFormData } from '../PartnerFormWizard';

interface WebhooksStepProps {
  formData: PartnerFormData;
  updateFormData: (updates: Partial<PartnerFormData>) => void;
}

const AVAILABLE_EVENTS = [
  { value: 'order.created', label: 'Order Created', description: 'New order is created' },
  { value: 'order.updated', label: 'Order Updated', description: 'Order details are modified' },
  { value: 'order.completed', label: 'Order Completed', description: 'Order is marked complete' },
  { value: 'order.cancelled', label: 'Order Cancelled', description: 'Order is cancelled' },
  { value: 'payment.received', label: 'Payment Received', description: 'Payment is recorded' },
  { value: 'payment.refunded', label: 'Payment Refunded', description: 'Payment is refunded' },
  { value: 'invoice.created', label: 'Invoice Created', description: 'Invoice is generated' },
  { value: 'invoice.cancelled', label: 'Invoice Cancelled', description: 'Invoice is cancelled' },
];

export function WebhooksStep({ formData, updateFormData }: WebhooksStepProps) {
  const toggleEvent = (event: string) => {
    const currentEvents = formData.webhook_events;
    const isSelected = currentEvents.includes(event);

    if (isSelected) {
      updateFormData({
        webhook_events: currentEvents.filter((e) => e !== event),
      });
    } else {
      updateFormData({
        webhook_events: [...currentEvents, event],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Webhook Configuration</h2>
        <p className="text-muted-foreground mt-1">
          Optional: Configure webhooks to receive real-time event notifications
        </p>
      </div>

      <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          Webhooks are optional. You can skip this step and configure them later if needed.
        </div>
      </div>

      <div className="space-y-6">
        {/* Webhook URL */}
        <div className="space-y-2">
          <Label htmlFor="webhook_url">Webhook URL</Label>
          <Input
            id="webhook_url"
            type="url"
            placeholder="https://partner.example.com/webhooks/bella"
            value={formData.webhook_url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateFormData({ webhook_url: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            HTTPS endpoint where webhook events will be sent
          </p>
        </div>

        {/* Webhook Secret */}
        <div className="space-y-2">
          <Label htmlFor="webhook_secret">Webhook Secret</Label>
          <Input
            id="webhook_secret"
            type="text"
            placeholder="whsec_..."
            value={formData.webhook_secret}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateFormData({ webhook_secret: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            Secret key for webhook signature verification (optional but recommended)
          </p>
        </div>

        {/* Event Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Webhook Events</Label>
            {formData.webhook_events.length > 0 && (
              <Badge variant="outline">
                {formData.webhook_events.length} event{formData.webhook_events.length !== 1 ? 's' : ''} selected
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Select which events should trigger webhook notifications
          </p>

          <div className="grid gap-2">
            {AVAILABLE_EVENTS.map((event) => {
              const isSelected = formData.webhook_events.includes(event.value);
              return (
                <button
                  key={event.value}
                  type="button"
                  onClick={() => toggleEvent(event.value)}
                  className={`flex items-start gap-3 p-3 border rounded-lg hover:border-primary hover:shadow-sm active:scale-98 transition-all cursor-pointer ${
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center h-5 w-5 rounded border-2 ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{event.label}</div>
                    <div className="text-xs text-muted-foreground">{event.description}</div>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                      {event.value}
                    </code>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
