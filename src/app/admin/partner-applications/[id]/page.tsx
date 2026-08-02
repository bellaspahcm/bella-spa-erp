/**
 * Admin - Partner Application Detail
 * 
 * Features:
 * - View full application details
 * - View documents
 * - View activity timeline
 * - Approve/Reject/Request More Info actions
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { PartnerApplication } from '@/types/partner-registration.types';
import {
  getStatusLabel,
  getStatusColor,
  getApplicantTypeLabel,
} from '@/types/partner-registration.types';

export default function PartnerApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;
  
  const [application, setApplication] = useState<PartnerApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Actions
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  useEffect(() => {
    loadApplication();
  }, [applicationId]);
  
  const loadApplication = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/admin/partner-applications/${applicationId}`);
      // const data = await response.json();
      // setApplication(data.application);
      
      // For now, show error
      setError('Database not yet deployed. Application data will appear here after migration.');
    } catch (err) {
      setError('Failed to load application');
      console.error('[loadApplication] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleApprove = async () => {
    if (!application) return;
    
    setIsApproving(true);
    try {
      // TODO: Implement approve action
      alert('Approve action - To be implemented in Day 3');
    } finally {
      setIsApproving(false);
    }
  };
  
  const handleReject = async () => {
    if (!application || !rejectReason.trim()) return;
    
    setIsRejecting(true);
    try {
      // TODO: Implement reject action
      alert(`Reject action - Reason: ${rejectReason}`);
      setShowRejectModal(false);
    } finally {
      setIsRejecting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600" />
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <svg
              className="mx-auto h-16 w-16 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Error</h2>
            <p className="mt-2 text-gray-600">{error}</p>
            <div className="mt-6 flex gap-4 justify-center">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={loadApplication}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900">Application Not Found</h2>
            <p className="mt-2 text-gray-600">
              The application you're looking for doesn't exist or has been deleted.
            </p>
            <button
              onClick={() => router.push('/admin/partner-applications')}
              className="mt-6 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
            >
              Back to Applications
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const statusColor = getStatusColor(application.status);
  const statusBgClass = {
    gray: 'bg-gray-100 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
  }[statusColor];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Application Details</h1>
                <p className="text-sm text-gray-500">ID: {application.id.slice(0, 8)}</p>
              </div>
            </div>
            
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusBgClass}`}>
              {getStatusLabel(application.status)}
            </span>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Applicant Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Applicant Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{application.full_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Applicant Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {getApplicantTypeLabel(application.applicant_type)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{application.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{application.phone}</dd>
                </div>
              </dl>
            </div>
            
            {/* Business Info */}
            {(application.company_name || application.tax_code) && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {application.company_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Company Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{application.company_name}</dd>
                    </div>
                  )}
                  {application.tax_code && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Tax Code</dt>
                      <dd className="mt-1 text-sm text-gray-900">{application.tax_code}</dd>
                    </div>
                  )}
                  {application.business_license && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Business License</dt>
                      <dd className="mt-1 text-sm text-gray-900">{application.business_license}</dd>
                    </div>
                  )}
                  {application.address && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {[
                          application.address,
                          application.ward,
                          application.district,
                          application.city,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
            
            {/* Documents */}
            {application.documents && application.documents.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
                <div className="space-y-3">
                  {application.documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {doc.file_name || doc.type}
                          </div>
                          <div className="text-xs text-gray-500">
                            Uploaded {new Date(doc.uploaded_at).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            {application.status === 'pending_verification' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="
                      w-full px-4 py-2 bg-green-600 text-white rounded-lg
                      hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                      font-medium
                    "
                  >
                    {isApproving ? 'Approving...' : 'Approve Application'}
                  </button>
                  
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="
                      w-full px-4 py-2 bg-red-600 text-white rounded-lg
                      hover:bg-red-700 font-medium
                    "
                  >
                    Reject Application
                  </button>
                  
                  <button
                    className="
                      w-full px-4 py-2 border border-yellow-600 text-yellow-700 rounded-lg
                      hover:bg-yellow-50 font-medium
                    "
                  >
                    Request More Info
                  </button>
                </div>
              </div>
            )}
            
            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
              <div className="space-y-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">Created</p>
                    <p className="text-xs text-gray-500">
                      {new Date(application.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
                
                {application.submitted_at && (
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">Submitted</p>
                      <p className="text-xs text-gray-500">
                        {new Date(application.submitted_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                )}
                
                {application.email_verified_at && (
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">Email Verified</p>
                      <p className="text-xs text-gray-500">
                        {new Date(application.email_verified_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">System Info</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Application ID</dt>
                  <dd className="mt-1 text-xs text-gray-900 font-mono">{application.id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Registration Type</dt>
                  <dd className="mt-1 text-xs text-gray-900">{application.registration_type}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-xs text-gray-900">
                    {new Date(application.created_at).toLocaleString('vi-VN')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-xs text-gray-900">
                    {new Date(application.updated_at).toLocaleString('vi-VN')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
      
      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Application</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this application.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="
                w-full px-3 py-2 border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-rose-500
              "
              placeholder="Enter rejection reason..."
            />
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || isRejecting}
                className="
                  px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {isRejecting ? 'Rejecting...' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
