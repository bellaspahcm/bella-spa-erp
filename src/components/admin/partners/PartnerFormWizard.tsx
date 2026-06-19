/**
 * Partner Form Wizard Component
 * 
 * Multi-step form for creating/editing API partners
 * 
 * Steps:
 * 1. Basic Info (name, type, contact)
 * 2. Scopes & Permissions
 * 3. Webhooks (optional)
 * 4. Review & Submit
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CreateAPIPartnerInput,
  UpdateAPIPartnerInput,
  APIPartner,
  PartnerType,
  APIScope,
} from '@/types/api-gateway';

// Step Components (will be imported)
import { BasicInfoStep } from './wizard-steps/BasicInfoStep';
import { ScopesStep } from './wizard-steps/ScopesStep';
import { WebhooksStep } from './wizard-steps/WebhooksStep';
import { ReviewStep } from './wizard-steps/ReviewStep';

const STEPS = [
  { id: 1, name: 'Basic Info', description: 'Partner details' },
  { id: 2, name: 'Scopes', description: 'Permissions' },
  { id: 3, name: 'Webhooks', description: 'Event notifications' },
  { id: 4, name: 'Review', description: 'Confirm & submit' },
];

export interface PartnerFormData {
  // Basic Info
  partner_name: string;
  partner_type: PartnerType;
  partner_description: string;
  contact_email: string;
  contact_phone: string;
  is_sandbox: boolean;
  
  // Scopes
  allowed_scopes: APIScope[];
  
  // Webhooks
  webhook_url: string;
  webhook_secret: string;
  webhook_events: string[];
  
  // Advanced
  rate_limit_tier: 'free' | 'basic' | 'pro' | 'enterprise' | 'unlimited';
  notes: string;
}

export interface PartnerFormWizardProps {
  mode: 'create' | 'edit';
  existingPartner?: APIPartner;
  tenantId: string;
}

export function PartnerFormWizard({
  mode,
  existingPartner,
  tenantId,
}: PartnerFormWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form data state
  const [formData, setFormData] = useState<PartnerFormData>({
    partner_name: existingPartner?.partner_name || '',
    partner_type: existingPartner?.partner_type || 'other',
    partner_description: existingPartner?.partner_description || '',
    contact_email: existingPartner?.contact_email || '',
    contact_phone: existingPartner?.contact_phone || '',
    is_sandbox: existingPartner?.is_sandbox || false,
    
    allowed_scopes: existingPartner?.allowed_scopes || [],
    
    webhook_url: existingPartner?.webhook_url || '',
    webhook_secret: existingPartner?.webhook_secret || '',
    webhook_events: existingPartner?.webhook_events || [],
    
    rate_limit_tier: (existingPartner?.rate_limit_tier as unknown) || 'basic',
    notes: existingPartner?.notes || '',
  });

  // Update form data
  const updateFormData = (updates: Partial<PartnerFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Navigation
  const goToNextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validation
  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 1: // Basic Info
        if (!formData.partner_name.trim()) {
          toast.error('Partner name is required');
          return false;
        }
        if (!formData.contact_email.trim()) {
          toast.error('Contact email is required');
          return false;
        }
        return true;

      case 2: // Scopes
        if (formData.allowed_scopes.length === 0) {
          toast.error('At least one scope is required');
          return false;
        }
        return true;

      case 3: // Webhooks (optional, always valid)
        return true;

      case 4: // Review
        return true;

      default:
        return true;
    }
  };

  // Submit
  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (mode === 'create') {
        // Create new partner
        const input: CreateAPIPartnerInput = {
          tenant_id: tenantId,
          partner_name: formData.partner_name,
          partner_type: formData.partner_type,
          partner_description: formData.partner_description || undefined,
          contact_email: formData.contact_email || undefined,
          contact_phone: formData.contact_phone || undefined,
          is_sandbox: formData.is_sandbox,
          allowed_scopes: formData.allowed_scopes,
          webhook_url: formData.webhook_url || undefined,
          webhook_secret: formData.webhook_secret || undefined,
          webhook_events: formData.webhook_events.length > 0 ? formData.webhook_events : undefined,
          rate_limit_tier: formData.rate_limit_tier,
          notes: formData.notes || undefined,
        };

        const response = await fetch('/api/admin/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to create partner');
        }

        const { data: newPartner } = await response.json();

        toast.success(`Partner "${formData.partner_name}" created successfully`);
        router.push(`/dashboard/admin/partners/${newPartner.id}`);
      } else {
        // Update existing partner
        const input: UpdateAPIPartnerInput = {
          partner_name: formData.partner_name,
          partner_description: formData.partner_description || undefined,
          contact_email: formData.contact_email || undefined,
          contact_phone: formData.contact_phone || undefined,
          allowed_scopes: formData.allowed_scopes,
          webhook_url: formData.webhook_url || undefined,
          webhook_secret: formData.webhook_secret || undefined,
          webhook_events: formData.webhook_events.length > 0 ? formData.webhook_events : undefined,
          rate_limit_tier: formData.rate_limit_tier,
          notes: formData.notes || undefined,
        };

        const response = await fetch(`/api/admin/partners/${existingPartner!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to update partner');
        }

        toast.success(`Partner "${formData.partner_name}" updated successfully`);
        router.push(`/dashboard/admin/partners/${existingPartner!.id}`);
      }
    } catch (error: unknown) {
      console.error('Error submitting form:', error);
      toast.error(error.message || 'Failed to save partner');
    } finally {
      setLoading(false);
    }
  };

  // Handle next button click
  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep === STEPS.length) {
        handleSubmit();
      } else {
        goToNextStep();
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Progress Indicator */}
      <nav aria-label="Progress" className="bg-white dark:bg-gray-800 p-4 rounded-lg">
        <ol className="flex items-center justify-between">
          {STEPS.map((step, stepIdx) => (
            <li key={step.id} className="relative flex-1">
              {/* Connector Line */}
              {stepIdx !== STEPS.length - 1 && (
                <div className="absolute top-4 left-1/2 w-full h-0.5 -z-10">
                  <div
                    className={`h-full ${
                      currentStep > step.id ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}

              {/* Step Button */}
              <button
                onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                disabled={currentStep < step.id}
                className={`relative flex flex-col items-center group ${
                  currentStep >= step.id ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                    currentStep > step.id
                      ? 'bg-primary border-primary text-white'
                      : currentStep === step.id
                      ? 'border-primary bg-white text-primary'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">{step.id}</span>
                  )}
                </span>
                <span className="mt-2 text-xs font-medium text-center">
                  {step.name}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
        {currentStep === 1 && (
          <BasicInfoStep formData={formData} updateFormData={updateFormData} />
        )}
        {currentStep === 2 && (
          <ScopesStep formData={formData} updateFormData={updateFormData} />
        )}
        {currentStep === 3 && (
          <WebhooksStep formData={formData} updateFormData={updateFormData} />
        )}
        {currentStep === 4 && <ReviewStep formData={formData} mode={mode} />}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <Button
          variant="outline"
          onClick={goToPreviousStep}
          disabled={currentStep === 1 || loading}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-sm text-muted-foreground">
          Step {currentStep} of {STEPS.length}
        </div>

        <Button onClick={handleNext} disabled={loading}>
          {loading ? (
            'Saving...'
          ) : currentStep === STEPS.length ? (
            mode === 'create' ? (
              'Create Partner'
            ) : (
              'Update Partner'
            )
          ) : (
            <>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
