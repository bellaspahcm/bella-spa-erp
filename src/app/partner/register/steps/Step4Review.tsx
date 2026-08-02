/**
 * Step 4: Review & Submit
 * - Review all information
 * - Edit any section
 * - Submit application
 */

'use client';

import type { PartnerApplicantType, PartnerApplicationDocument } from '@/types/partner-registration.types';
import { getApplicantTypeLabel } from '@/types/partner-registration.types';

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  applicant_type: PartnerApplicantType;
  company_name?: string;
  tax_code?: string;
  business_license?: string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  documents: PartnerApplicationDocument[];
}

interface Step4Props {
  formData: FormData;
  onSubmit: () => void;
  onBack: () => void;
  onEdit: (step: 1 | 2 | 3) => void;
  isSubmitting: boolean;
}

export default function Step4Review({
  formData,
  onSubmit,
  onBack,
  onEdit,
  isSubmitting,
}: Step4Props) {
  const isOrganization = formData.applicant_type === 'agency' || formData.applicant_type === 'company';
  
  const formatAddress = () => {
    const parts = [
      formData.address,
      formData.ward,
      formData.district,
      formData.city,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'Chưa cung cấp';
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Bước 4: Xác nhận thông tin
        </h2>
        <p className="text-gray-600">
          Vui lòng kiểm tra lại thông tin trước khi gửi đơn đăng ký
        </p>
      </div>
      
      {/* Section 1: Basic Information */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Thông tin cơ bản</h3>
          <button
            type="button"
            onClick={() => onEdit(1)}
            disabled={isSubmitting}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
          >
            Chỉnh sửa
          </button>
        </div>
        
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Họ và tên</dt>
            <dd className="mt-1 text-sm text-gray-900">{formData.full_name}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Loại hình đối tác</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {getApplicantTypeLabel(formData.applicant_type)}
            </dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{formData.email}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Số điện thoại</dt>
            <dd className="mt-1 text-sm text-gray-900">{formData.phone}</dd>
          </div>
        </dl>
      </div>
      
      {/* Section 2: Business Information */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Thông tin doanh nghiệp</h3>
          <button
            type="button"
            onClick={() => onEdit(2)}
            disabled={isSubmitting}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
          >
            Chỉnh sửa
          </button>
        </div>
        
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isOrganization && (
            <>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  {formData.applicant_type === 'company' ? 'Tên công ty' : 'Tên sàn giao dịch'}
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formData.company_name || 'Chưa cung cấp'}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Mã số thuế</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formData.tax_code || 'Chưa cung cấp'}
                </dd>
              </div>
            </>
          )}
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Giấy phép kinh doanh</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formData.business_license || 'Chưa cung cấp'}
            </dd>
          </div>
          
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Địa chỉ</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatAddress()}</dd>
          </div>
        </dl>
      </div>
      
      {/* Section 3: Documents */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Tài liệu đã tải lên</h3>
          <button
            type="button"
            onClick={() => onEdit(3)}
            disabled={isSubmitting}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
          >
            Chỉnh sửa
          </button>
        </div>
        
        {formData.documents.length > 0 ? (
          <ul className="space-y-3">
            {formData.documents.map((doc, index) => (
              <li key={index} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {getDocumentLabel(doc.type)}
                  </p>
                  {doc.file_name && (
                    <p className="text-xs text-gray-500">{doc.file_name}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Chưa có tài liệu nào</p>
        )}
      </div>
      
      {/* Terms & Conditions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Lưu ý quan trọng</h3>
            <div className="mt-2 text-sm text-blue-700 space-y-1">
              <p>• Sau khi gửi đơn, bạn sẽ nhận email xác minh trong vòng 5 phút</p>
              <p>• Vui lòng kiểm tra cả hộp thư spam/junk</p>
              <p>• Đơn đăng ký sẽ được xem xét trong vòng 1-2 ngày làm việc</p>
              <p>• Chúng tôi có thể liên hệ để yêu cầu bổ sung thông tin nếu cần</p>
            </div>
          </div>
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
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="
            px-8 py-3 bg-rose-600 text-white font-semibold rounded-lg
            hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Đang gửi đơn...
            </span>
          ) : (
            'Gửi đơn đăng ký'
          )}
        </button>
      </div>
    </div>
  );
}

// Helper function to get document label
function getDocumentLabel(type: string): string {
  const labels: Record<string, string> = {
    cccd_front: 'CCCD mặt trước',
    cccd_back: 'CCCD mặt sau',
    business_license: 'Giấy phép kinh doanh',
    tax_certificate: 'Giấy chứng nhận thuế',
    company_registration: 'Giấy đăng ký doanh nghiệp',
    other: 'Tài liệu khác',
  };
  return labels[type] || type;
}
