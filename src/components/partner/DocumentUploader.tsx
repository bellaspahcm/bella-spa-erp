'use client';

import { useState, useRef } from 'react';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, type DocumentCategory } from '@/lib/storage/partner-documents';

interface DocumentUploaderProps {
  applicationId: string;
  category: DocumentCategory;
  onUploadSuccess?: (fileUrl: string, filePath: string) => void;
  onUploadError?: (error: string) => void;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  business_license: 'Giấy phép kinh doanh',
  tax_certificate: 'Giấy chứng nhận thuế',
  id_card: 'CMND/CCCD',
  bank_document: 'Tài liệu ngân hàng',
  other: 'Khác',
};

export default function DocumentUploader({
  applicationId,
  category,
  onUploadSuccess,
  onUploadError,
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = `File quá lớn. Kích thước tối đa: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
      setError(errorMsg);
      onUploadError?.(errorMsg);
      return;
    }
    
    setSelectedFile(file);
  };
  
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('applicationId', applicationId);
      formData.append('category', category);
      
      // Upload with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(Math.round(percentComplete));
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            onUploadSuccess?.(response.fileUrl, response.filePath);
            setSelectedFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          } else {
            const errorMsg = response.error || 'Upload thất bại';
            setError(errorMsg);
            onUploadError?.(errorMsg);
          }
        } else {
          const errorMsg = 'Upload thất bại';
          setError(errorMsg);
          onUploadError?.(errorMsg);
        }
        setUploading(false);
      });
      
      xhr.addEventListener('error', () => {
        const errorMsg = 'Lỗi kết nối';
        setError(errorMsg);
        onUploadError?.(errorMsg);
        setUploading(false);
      });
      
      xhr.open('POST', '/api/partner/documents/upload');
      xhr.send(formData);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload thất bại';
      setError(errorMsg);
      onUploadError?.(errorMsg);
      setUploading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {CATEGORY_LABELS[category]}
        </label>
        
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-rose-50 file:text-rose-700
              hover:file:bg-rose-100
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          
          {selectedFile && !uploading && (
            <button
              onClick={handleUpload}
              className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 
                transition-colors font-medium text-sm whitespace-nowrap"
            >
              Upload
            </button>
          )}
        </div>
        
        <p className="mt-1 text-xs text-gray-500">
          Chấp nhận: {ALLOWED_EXTENSIONS.join(', ')} (Tối đa {MAX_FILE_SIZE / 1024 / 1024}MB)
        </p>
      </div>
      
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Đang upload...</span>
            <span className="font-medium text-rose-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-rose-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
