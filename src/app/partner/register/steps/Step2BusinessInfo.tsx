/**
 * Step 2: Business Information
 * - Company name (for agency/company)
 * - Tax code (for agency/company)
 * - Business license
 * - Address
 */

'use client';

import { useState } from 'react';
import type { PartnerApplicantType } from '@/types/partner-registration.types';

interface Step2Props {
  applicantType: PartnerApplicantType;
  initialData: {
    company_name?: string;
    tax_code?: string;
    business_license?: string;
    address?: string;
    city?: string;
    district?: string;
    ward?: string;
  };
  onComplete: (data: Step2Props['initialData']) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export default function Step2BusinessInfo({
  applicantType,
  initialData,
  onComplete,
  onBack,
  isSubmitting,
}: Step2Props) {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const isOrganization = applicantType === 'agency' || applicantType === 'company';
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Required fields for agency/company
    if (isOrganization) {
      if (!formData.company_name?.trim()) {
        newErrors.company_name = 'Vui lòng nhập tên công ty/sàn';
      }
      
      if (!formData.tax_code?.trim()) {
        newErrors.tax_code = 'Vui lòng nhập mã số thuế';
      } else if (!/^[0-9]{10,13}$/.test(formData.tax_code.replace(/-/g, ''))) {
        newErrors.tax_code = 'Mã số thuế không hợp lệ (10-13 số)';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onComplete(formData);
    }
  };
  
  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Bước 2: Thông tin doanh nghiệp
        </h2>
        <p className="text-gray-600">
          {isOrganization
            ? 'Vui lòng cung cấp thông tin về công ty/sàn của bạn'
            : 'Bạn có thể bổ sung thông tin địa chỉ (không bắt buộc)'}
        </p>
      </div>
      
      {/* Company Name (required for agency/company) */}
      {isOrganization && (
        <div>
          <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
            {applicantType === 'company' ? 'Tên công ty' : 'Tên sàn giao dịch'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="company_name"
            value={formData.company_name || ''}
            onChange={(e) => updateField('company_name', e.target.value)}
            className={`
              w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2
              ${
                errors.company_name
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-rose-500'
              }
            `}
            placeholder="Công ty TNHH..."
            disabled={isSubmitting}
          />
          {errors.company_name && (
            <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>
          )}
        </div>
      )}
      
      {/* Tax Code (required for agency/company) */}
      {isOrganization && (
        <div>
          <label htmlFor="tax_code" className="block text-sm font-medium text-gray-700 mb-1">
            Mã số thuế <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="tax_code"
            value={formData.tax_code || ''}
            onChange={(e) => updateField('tax_code', e.target.value)}
            className={`
              w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2
              ${
                errors.tax_code
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-rose-500'
              }
            `}
            placeholder="0123456789"
            disabled={isSubmitting}
          />
          {errors.tax_code && (
            <p className="mt-1 text-sm text-red-600">{errors.tax_code}</p>
          )}
        </div>
      )}
      
      {/* Business License */}
      <div>
        <label htmlFor="business_license" className="block text-sm font-medium text-gray-700 mb-1">
          Giấy phép kinh doanh {isOrganization && <span className="text-gray-500">(tùy chọn)</span>}
        </label>
        <input
          type="text"
          id="business_license"
          value={formData.business_license || ''}
          onChange={(e) => updateField('business_license', e.target.value)}
          className="
            w-full px-4 py-2 border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-rose-500
          "
          placeholder="Số giấy phép"
          disabled={isSubmitting}
        />
      </div>
      
      {/* Address */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
          Địa chỉ
        </label>
        <input
          type="text"
          id="address"
          value={formData.address || ''}
          onChange={(e) => updateField('address', e.target.value)}
          className="
            w-full px-4 py-2 border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-rose-500
          "
          placeholder="Số nhà, tên đường"
          disabled={isSubmitting}
        />
      </div>
      
      {/* City/District/Ward Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
            Tỉnh/Thành phố
          </label>
          <input
            type="text"
            id="city"
            value={formData.city || ''}
            onChange={(e) => updateField('city', e.target.value)}
            className="
              w-full px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-rose-500
            "
            placeholder="Hà Nội"
            disabled={isSubmitting}
          />
        </div>
        
        <div>
          <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">
            Quận/Huyện
          </label>
          <input
            type="text"
            id="district"
            value={formData.district || ''}
            onChange={(e) => updateField('district', e.target.value)}
            className="
              w-full px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-rose-500
            "
            placeholder="Quận 1"
            disabled={isSubmitting}
          />
        </div>
        
        <div>
          <label htmlFor="ward" className="block text-sm font-medium text-gray-700 mb-1">
            Phường/Xã
          </label>
          <input
            type="text"
            id="ward"
            value={formData.ward || ''}
            onChange={(e) => updateField('ward', e.target.value)}
            className="
              w-full px-4 py-2 border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-rose-500
            "
            placeholder="Phường Bến Nghé"
            disabled={isSubmitting}
          />
        </div>
      </div>
      
      {/* Buttons */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="
            px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          Quay lại
        </button>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="
            px-6 py-3 bg-rose-600 text-white font-medium rounded-lg
            hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {isSubmitting ? 'Đang xử lý...' : 'Tiếp tục'}
        </button>
      </div>
    </form>
  );
}
