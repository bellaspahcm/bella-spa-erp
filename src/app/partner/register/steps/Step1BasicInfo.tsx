/**
 * Step 1: Basic Information
 * - Full name
 * - Email
 * - Phone
 * - Applicant type (Individual/Agency/Company)
 */

'use client';

import { useState } from 'react';
import type { PartnerApplicantType } from '@/types/partner-registration.types';

interface Step1Props {
  initialData: {
    full_name: string;
    email: string;
    phone: string;
    applicant_type: PartnerApplicantType;
  };
  onComplete: (data: Step1Props['initialData']) => void;
  isSubmitting: boolean;
}

export default function Step1BasicInfo({ initialData, onComplete, isSubmitting }: Step1Props) {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Vui lòng nhập họ tên';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^[0-9]{10,11}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Số điện thoại không hợp lệ (10-11 số)';
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
          Bước 1: Thông tin cơ bản
        </h2>
        <p className="text-gray-600">
          Vui lòng cung cấp thông tin liên hệ của bạn
        </p>
      </div>
      
      {/* Full Name */}
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
          Họ và tên <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="full_name"
          value={formData.full_name}
          onChange={(e) => updateField('full_name', e.target.value)}
          className={`
            w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2
            ${
              errors.full_name
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-rose-500'
            }
          `}
          placeholder="Nguyễn Văn A"
          disabled={isSubmitting}
        />
        {errors.full_name && (
          <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
        )}
      </div>
      
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          className={`
            w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2
            ${
              errors.email
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-rose-500'
            }
          `}
          placeholder="example@email.com"
          disabled={isSubmitting}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>
      
      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Số điện thoại <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="phone"
          value={formData.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          className={`
            w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2
            ${
              errors.phone
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-rose-500'
            }
          `}
          placeholder="0901234567"
          disabled={isSubmitting}
        />
        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
      </div>
      
      {/* Applicant Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Loại hình đối tác <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="applicant_type"
              value="individual_broker"
              checked={formData.applicant_type === 'individual_broker'}
              onChange={(e) => updateField('applicant_type', e.target.value as PartnerApplicantType)}
              className="mt-1 h-4 w-4 text-rose-600 focus:ring-rose-500"
              disabled={isSubmitting}
            />
            <div className="ml-3">
              <div className="font-medium text-gray-900">Môi giới cá nhân</div>
              <div className="text-sm text-gray-600">
                Cá nhân hoạt động môi giới độc lập
              </div>
            </div>
          </label>
          
          <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="applicant_type"
              value="agency"
              checked={formData.applicant_type === 'agency'}
              onChange={(e) => updateField('applicant_type', e.target.value as PartnerApplicantType)}
              className="mt-1 h-4 w-4 text-rose-600 focus:ring-rose-500"
              disabled={isSubmitting}
            />
            <div className="ml-3">
              <div className="font-medium text-gray-900">Sàn giao dịch</div>
              <div className="text-sm text-gray-600">
                Sàn giao dịch bất động sản hoặc dịch vụ
              </div>
            </div>
          </label>
          
          <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="applicant_type"
              value="company"
              checked={formData.applicant_type === 'company'}
              onChange={(e) => updateField('applicant_type', e.target.value as PartnerApplicantType)}
              className="mt-1 h-4 w-4 text-rose-600 focus:ring-rose-500"
              disabled={isSubmitting}
            />
            <div className="ml-3">
              <div className="font-medium text-gray-900">Công ty</div>
              <div className="text-sm text-gray-600">
                Công ty hoạt động trong lĩnh vực liên quan
              </div>
            </div>
          </label>
        </div>
      </div>
      
      {/* Submit Button */}
      <div className="flex justify-end pt-4">
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
