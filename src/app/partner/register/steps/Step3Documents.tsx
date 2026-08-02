/**
 * Step 3: Document Upload
 * - CCCD front/back (required for individual)
 * - Business license (required for agency/company)
 * - Tax certificate (optional)
 * - Company registration (optional for company)
 */

'use client';

import { useState } from 'react';
import type { PartnerApplicantType } from '@/types/partner-registration.types';

interface Step3Props {
  applicantType: PartnerApplicantType;
  onComplete: (files: { type: string; file: File }[]) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

interface DocumentFile {
  type: string;
  file: File | null;
  label: string;
  required: boolean;
  preview?: string;
}

export default function Step3Documents({
  applicantType,
  onComplete,
  onBack,
  isSubmitting,
}: Step3Props) {
  const isOrganization = applicantType === 'agency' || applicantType === 'company';
  
  // Document requirements based on applicant type
  const initialDocuments: DocumentFile[] = isOrganization
    ? [
        { type: 'business_license', file: null, label: 'Giấy phép kinh doanh', required: true },
        { type: 'tax_certificate', file: null, label: 'Giấy chứng nhận thuế', required: false },
        {
          type: 'company_registration',
          file: null,
          label: 'Giấy đăng ký doanh nghiệp',
          required: applicantType === 'company',
        },
      ]
    : [
        { type: 'cccd_front', file: null, label: 'CCCD mặt trước', required: true },
        { type: 'cccd_back', file: null, label: 'CCCD mặt sau', required: true },
      ];
  
  const [documents, setDocuments] = useState<DocumentFile[]>(initialDocuments);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    documents.forEach((doc) => {
      if (doc.required && !doc.file) {
        newErrors[doc.type] = `Vui lòng tải lên ${doc.label}`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      const filesToUpload = documents
        .filter((doc) => doc.file !== null)
        .map((doc) => ({ type: doc.type, file: doc.file! }));
      
      onComplete(filesToUpload);
    }
  };
  
  const handleFileChange = (type: string, file: File | null) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.type === type) {
          // Generate preview for images
          let preview: string | undefined;
          if (file && file.type.startsWith('image/')) {
            preview = URL.createObjectURL(file);
          }
          return { ...doc, file, preview };
        }
        return doc;
      })
    );
    
    // Clear error
    if (errors[type]) {
      setErrors((prev) => ({ ...prev, [type]: '' }));
    }
  };
  
  const handleDrop = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOver(null);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(type, file);
    }
  };
  
  const handleDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    setDragOver(type);
  };
  
  const handleDragLeave = () => {
    setDragOver(null);
  };
  
  const removeFile = (type: string) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.type === type) {
          if (doc.preview) {
            URL.revokeObjectURL(doc.preview);
          }
          return { ...doc, file: null, preview: undefined };
        }
        return doc;
      })
    );
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bước 3: Tài liệu</h2>
        <p className="text-gray-600">
          Vui lòng tải lên các tài liệu cần thiết (JPG, PNG, PDF - Tối đa 5MB)
        </p>
      </div>
      
      <div className="space-y-4">
        {documents.map((doc) => (
          <div key={doc.type} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                {doc.label}
                {doc.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {doc.file && (
                <button
                  type="button"
                  onClick={() => removeFile(doc.type)}
                  className="text-sm text-red-600 hover:text-red-700"
                  disabled={isSubmitting}
                >
                  Xóa
                </button>
              )}
            </div>
            
            {doc.file ? (
              // File Preview
              <div className="flex items-center space-x-4">
                {doc.preview ? (
                  <img
                    src={doc.preview}
                    alt={doc.label}
                    className="w-24 h-24 object-cover rounded border"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded border flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{doc.file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(doc.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              // Drop Zone
              <div
                onDrop={(e) => handleDrop(e, doc.type)}
                onDragOver={(e) => handleDragOver(e, doc.type)}
                onDragLeave={handleDragLeave}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center
                  ${
                    dragOver === doc.type
                      ? 'border-rose-400 bg-rose-50'
                      : errors[doc.type]
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }
                  transition-colors cursor-pointer
                `}
              >
                <input
                  type="file"
                  id={doc.type}
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate file size (5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        setErrors((prev) => ({
                          ...prev,
                          [doc.type]: 'File quá lớn (tối đa 5MB)',
                        }));
                        return;
                      }
                      handleFileChange(doc.type, file);
                    }
                  }}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <label htmlFor={doc.type} className="cursor-pointer">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="font-semibold text-rose-600">Nhấp để chọn file</span>{' '}
                    hoặc kéo thả vào đây
                  </p>
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG, PDF (tối đa 5MB)</p>
                </label>
              </div>
            )}
            
            {errors[doc.type] && (
              <p className="mt-2 text-sm text-red-600">{errors[doc.type]}</p>
            )}
          </div>
        ))}
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
          {isSubmitting ? 'Đang tải lên...' : 'Tiếp tục'}
        </button>
      </div>
    </form>
  );
}
