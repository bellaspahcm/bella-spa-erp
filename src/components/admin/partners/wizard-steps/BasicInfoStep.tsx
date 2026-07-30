/**
 * Basic Info Step - Step 1 of Partner Form Wizard
 * 
 * Collects:
 * - Partner name
 * - Partner type
 * - Description
 * - Contact email & phone
 * - Sandbox mode flag
 */

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PartnerFormData } from '../PartnerFormWizard';
import { PartnerType } from '@/types/api-gateway';

interface BasicInfoStepProps {
  formData: PartnerFormData;
  updateFormData: (updates: Partial<PartnerFormData>) => void;
}

const PARTNER_TYPES: Array<{ value: PartnerType; label: string; description: string }> = [
  { value: 'pos', label: 'POS', description: 'Point of Sale system (KiotViet, MISA)' },
  { value: 'payment', label: 'Payment', description: 'Payment gateway (Casso, PayOS)' },
  { value: 'invoice', label: 'Invoice', description: 'E-Invoice provider (VNPT, Viettel)' },
  { value: 'franchise', label: 'Franchise', description: 'Franchise partner' },
  { value: 'hr', label: 'HR', description: 'HR platform integration' },
  { value: 'analytics', label: 'Analytics', description: 'Analytics/BI tool' },
  { value: 'mobile_app', label: 'Mobile App', description: 'Mobile application' },
  { value: 'other', label: 'Other', description: 'Other integrations' },
];

export function BasicInfoStep({ formData, updateFormData }: BasicInfoStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Basic Information</h2>
        <p className="text-muted-foreground mt-1">
          Enter the partner&apos;s basic details and contact information
        </p>
      </div>

      <div className="grid gap-6">
        {/* Partner Name */}
        <div className="space-y-2">
          <Label htmlFor="partner_name">
            Partner Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="partner_name"
            placeholder="e.g., KiotViet, Casso Payment"
            value={formData.partner_name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateFormData({ partner_name: e.target.value })
            }
            required
          />
          <p className="text-xs text-muted-foreground">
            The official name of the partner organization
          </p>
        </div>

        {/* Partner Type */}
        <div className="space-y-2">
          <Label htmlFor="partner_type">
            Partner Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.partner_type}
            onValueChange={(value: string | null) =>
              value && updateFormData({ partner_type: value as PartnerType })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select partner type" />
            </SelectTrigger>
            <SelectContent>
              {PARTNER_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col gap-0.5 py-0.5">
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {type.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="partner_description">Description</Label>
          <textarea
            id="partner_description"
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Brief description of the partner and integration purpose..."
            value={formData.partner_description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              updateFormData({ partner_description: e.target.value })
            }
          />
        </div>

        {/* Contact Email */}
        <div className="space-y-2">
          <Label htmlFor="contact_email">
            Contact Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contact_email"
            type="email"
            placeholder="partner@example.com"
            value={formData.contact_email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateFormData({ contact_email: e.target.value })
            }
            required
          />
        </div>

        {/* Contact Phone */}
        <div className="space-y-2">
          <Label htmlFor="contact_phone">Contact Phone</Label>
          <Input
            id="contact_phone"
            type="tel"
            placeholder="+84 xxx xxx xxx"
            value={formData.contact_phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateFormData({ contact_phone: e.target.value })
            }
          />
        </div>

        {/* Sandbox Mode */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="is_sandbox" className="text-base">
                Sandbox Mode
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enable testing environment with isolated data
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_sandbox}
              onClick={() => updateFormData({ is_sandbox: !formData.is_sandbox })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer hover:opacity-90 active:scale-95 ${
                formData.is_sandbox ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_sandbox ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {formData.is_sandbox && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
              Test API keys will be generated (pk_test_...)
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
