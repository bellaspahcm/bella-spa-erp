/**
 * Partner Registration - Multi-Step Wizard
 * 
 * 4-step registration process:
 * 1. Basic Information
 * 2. Business Information (conditional)
 * 3. Document Upload
 * 4. Review & Submit
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PartnerApplicantType,
  PartnerApplicationInsert,
  PartnerApplicationDocument,
} from '@/types/partner-registration.types';
import {
  createDraftApplication,
  updateDraftApplication,
  submitApplication,
  uploadDocument,
} from '@/services/partner-registration-actions';

// Step components
import Step1BasicInfo from './steps/Step1BasicInfo';
import Step2BusinessInfo from './steps/Step2BusinessInfo';
import Step3Documents from './steps/Step3Documents';
import Step4Review from './steps/Step4Review';

type RegistrationStep = 1 | 2 | 3 | 4;

interface FormData {
  // Step 1
  full_name: string;
  email: string;
  phone: string;
  applicant_type: PartnerApplicantType;
  
  // Step 2
  company_name?: string;
  tax_code?: string;
  business_license?: string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  
  // Step 3
  documents: PartnerApplicationDocument[];
}

export default function PartnerRegistrationPage() {
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState<RegistrationStep>(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    phone: '',
    applicant_type: 'individual_broker',
    documents: [],
  });
  
  // ============================================================================
  // STEP NAVIGATION
  // ============================================================================
  
  const goToStep = (step: RegistrationStep) => {
    setCurrentStep(step);
    setError(null);
  };
  
  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as RegistrationStep);
      setError(null);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as RegistrationStep);
      setError(null);
    }
  };
  
  // ============================================================================
  // FORM DATA UPDATE
  // ============================================================================
  
  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };
  
  // ============================================================================
  // STEP 1 COMPLETE: Create Draft Application
  // ============================================================================
  
  const completeStep1 = async (data: {
    full_name: string;
    email: string;
    phone: string;
    applicant_type: PartnerApplicantType;
  }) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      updateFormData(data);
      
      // Create draft application
      const response = await createDraftApplication({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        applicant_type: data.applicant_type,
      });
      
      if (!response.success || !response.application) {
        throw new Error(response.error || 'Failed to create application');
      }
      
      setApplicationId(response.application.id);
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ============================================================================
  // STEP 2 COMPLETE: Update Business Info
  // ============================================================================
  
  const completeStep2 = async (data: {
    company_name?: string;
    tax_code?: string;
    business_license?: string;
    address?: string;
    city?: string;
    district?: string;
    ward?: string;
  }) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (!applicationId) {
        throw new Error('Application ID not found');
      }
      
      updateFormData(data);
      
      // Update draft application
      const response = await updateDraftApplication(applicationId, data);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update application');
      }
      
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ============================================================================
  // STEP 3 COMPLETE: Upload Documents
  // ============================================================================
  
  const completeStep3 = async (files: { type: string; file: File }[]) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (!applicationId) {
        throw new Error('Application ID not found');
      }
      
      const uploadedDocs: PartnerApplicationDocument[] = [];
      
      // Upload each file
      for (const { type, file } of files) {
        const response = await uploadDocument(applicationId, file, type);
        
        if (!response.success || !response.document) {
          throw new Error(response.error || `Failed to upload ${type}`);
        }
        
        uploadedDocs.push(response.document);
      }
      
      updateFormData({ documents: uploadedDocs });
      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ============================================================================
  // STEP 4 COMPLETE: Submit Application
  // ============================================================================
  
  const completeStep4 = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (!applicationId) {
        throw new Error('Application ID not found');
      }
      
      // Submit application
      const response = await submitApplication(applicationId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to submit application');
      }
      
      // Redirect to verification page
      router.push(`/partner/verify?application_id=${applicationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Đăng ký Đối tác Bella AI Platform
          </h1>
          <p className="mt-2 text-gray-600">
            Hoàn thành 4 bước để trở thành đối tác của chúng tôi
          </p>
        </div>
        
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full
                    ${
                      currentStep === step
                        ? 'bg-rose-600 text-white'
                        : currentStep > step
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }
                  `}
                >
                  {currentStep > step ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{step}</span>
                  )}
                </div>
                {step < 4 && (
                  <div
                    className={`
                      w-20 h-1 mx-2
                      ${currentStep > step ? 'bg-green-600' : 'bg-gray-200'}
                    `}
                  />
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-600">Thông tin cơ bản</span>
            <span className="text-xs text-gray-600">Thông tin doanh nghiệp</span>
            <span className="text-xs text-gray-600">Tài liệu</span>
            <span className="text-xs text-gray-600">Xác nhận</span>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {currentStep === 1 && (
            <Step1BasicInfo
              initialData={{
                full_name: formData.full_name,
                email: formData.email,
                phone: formData.phone,
                applicant_type: formData.applicant_type,
              }}
              onComplete={completeStep1}
              isSubmitting={isSubmitting}
            />
          )}
          
          {currentStep === 2 && (
            <Step2BusinessInfo
              applicantType={formData.applicant_type}
              initialData={{
                company_name: formData.company_name,
                tax_code: formData.tax_code,
                business_license: formData.business_license,
                address: formData.address,
                city: formData.city,
                district: formData.district,
                ward: formData.ward,
              }}
              onComplete={completeStep2}
              onBack={prevStep}
              isSubmitting={isSubmitting}
            />
          )}
          
          {currentStep === 3 && (
            <Step3Documents
              applicantType={formData.applicant_type}
              onComplete={completeStep3}
              onBack={prevStep}
              isSubmitting={isSubmitting}
            />
          )}
          
          {currentStep === 4 && (
            <Step4Review
              formData={formData}
              onSubmit={completeStep4}
              onBack={prevStep}
              onEdit={goToStep}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
