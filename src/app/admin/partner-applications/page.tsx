/**
 * Admin - Partner Applications List
 * 
 * Features:
 * - List all partner applications
 * - Filter by status
 * - Search by name/email/company
 * - View details modal
 * - Quick actions (approve/reject)
 * - Pagination
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PartnerApplication,
  PartnerApplicationStatus,
  PartnerApplicantType,
} from '@/types/partner-registration.types';
import {
  getStatusLabel,
  getStatusColor,
  getApplicantTypeLabel,
} from '@/types/partner-registration.types';

// Temporary: Mock data until API is ready
const MOCK_APPLICATIONS: PartnerApplication[] = [];

export default function PartnerApplicationsPage() {
  const router = useRouter();
  
  const [applications, setApplications] = useState<PartnerApplication[]>(MOCK_APPLICATIONS);
  const [filteredApplications, setFilteredApplications] = useState<PartnerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<PartnerApplicationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Define loadApplications before using it in useEffect
  const loadApplications = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/partner-applications');
      
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setApplications(data.applications);
        setFilteredApplications(data.applications);
      } else {
        throw new Error(data.error || 'Failed to load applications');
      }
    } catch (err: unknown) {
      setError('Failed to load applications');
      console.error('[loadApplications] Error:', err);
      setApplications([]);
      setFilteredApplications([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load applications on mount
  useEffect(() => {
    loadApplications();
  }, []);
  
  // Apply filters
  useEffect(() => {
    let filtered = applications;
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.full_name.toLowerCase().includes(query) ||
          app.email.toLowerCase().includes(query) ||
          (app.company_name && app.company_name.toLowerCase().includes(query))
      );
    }
    
    setFilteredApplications(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [applications, statusFilter, searchQuery]);
  
  // Pagination
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentApplications = filteredApplications.slice(startIndex, endIndex);
  
  // Status color mapping for badges
  const getStatusBadgeClass = (status: PartnerApplicationStatus): string => {
    const color = getStatusColor(status);
    const classes = {
      gray: 'bg-gray-100 text-gray-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };
    return classes[color];
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Partner Applications</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage partner registration requests
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button
                onClick={loadApplications}
                className="
                  inline-flex items-center px-4 py-2 border border-gray-300
                  rounded-md shadow-sm text-sm font-medium text-gray-700
                  bg-white hover:bg-gray-50
                "
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or company..."
                className="
                  w-full px-4 py-2 border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-rose-500
                "
              />
            </div>
            
            {/* Status Filter */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PartnerApplicationStatus | 'all')}
                className="
                  w-full px-4 py-2 border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-rose-500
                "
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="need_more_info">Need More Info</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="provisioned">Provisioned</option>
                <option value="activated">Activated</option>
              </select>
            </div>
          </div>
          
          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{applications.length}</div>
              <div className="text-sm text-gray-600">Total Applications</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-900">
                {applications.filter((a) => a.status === 'pending_verification').length}
              </div>
              <div className="text-sm text-yellow-700">Pending Review</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">
                {applications.filter((a) => a.status === 'approved').length}
              </div>
              <div className="text-sm text-green-700">Approved</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-900">
                {applications.filter((a) => a.status === 'rejected').length}
              </div>
              <div className="text-sm text-red-700">Rejected</div>
            </div>
          </div>
        </div>
        
        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600" />
            <p className="mt-4 text-gray-600">Loading applications...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex">
              <svg className="h-6 w-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
                <button
                  onClick={loadApplications}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && !error && applications.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No applications yet</h3>
            <p className="mt-2 text-gray-500">
              Partner applications will appear here once they are submitted.
            </p>
          </div>
        )}
        
        {/* Applications Table */}
        {!isLoading && !error && currentApplications.length > 0 && (
          <>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Applicant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{app.full_name}</div>
                          <div className="text-sm text-gray-500">{app.email}</div>
                          {app.company_name && (
                            <div className="text-sm text-gray-500">{app.company_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {getApplicantTypeLabel(app.applicant_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`
                            inline-flex px-3 py-1 text-xs font-semibold rounded-full
                            ${getStatusBadgeClass(app.status)}
                          `}
                        >
                          {getStatusLabel(app.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {app.submitted_at
                          ? new Date(app.submitted_at).toLocaleDateString('vi-VN')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => router.push(`/admin/partner-applications/${app.id}`)}
                          className="text-rose-600 hover:text-rose-900"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="
                      relative inline-flex items-center px-4 py-2 border border-gray-300
                      text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="
                      ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300
                      text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(endIndex, filteredApplications.length)}
                      </span>{' '}
                      of <span className="font-medium">{filteredApplications.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="
                          relative inline-flex items-center px-2 py-2 rounded-l-md border
                          border-gray-300 bg-white text-sm font-medium text-gray-500
                          hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                        "
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`
                            relative inline-flex items-center px-4 py-2 border text-sm font-medium
                            ${
                              currentPage === page
                                ? 'z-10 bg-rose-50 border-rose-500 text-rose-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }
                          `}
                        >
                          {page}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="
                          relative inline-flex items-center px-2 py-2 rounded-r-md border
                          border-gray-300 bg-white text-sm font-medium text-gray-500
                          hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                        "
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* No Results */}
        {!isLoading && !error && applications.length > 0 && filteredApplications.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No matching results</h3>
            <p className="mt-2 text-gray-500">
              Try adjusting your search or filter to find what you're looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
