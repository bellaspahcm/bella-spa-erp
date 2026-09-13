/**
 * E2 — English Center Enrollments List Page
 * Path: /dashboard/english-center/enrollments
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EnrollmentListItem {
  id: string;
  studentPartyId: string;
  branchId: string;
  programId: string | null;
  classId: string | null;
  enrollmentStatus: 'pending' | 'active' | 'completed' | 'cancelled';
  enrolledAt: string;
}

export default function EnrollmentsListPage() {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<EnrollmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchEnrollments();
  }, [branchFilter, statusFilter]);

  const fetchEnrollments = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (branchFilter) params.set('branchId', branchFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/english-center/enrollments?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch enrollments');
      }

      const data = await response.json();
      setEnrollments(data.enrollments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">English Center Enrollments</h1>
        <Link
          href="/dashboard/english-center/enrollments/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Enrollment
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Branch</label>
          <input
            type="text"
            placeholder="Filter by branch ID"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="text-center py-8">Loading enrollments...</div>}

      {/* Error */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border text-left">ID</th>
                <th className="px-4 py-2 border text-left">Student</th>
                <th className="px-4 py-2 border text-left">Branch</th>
                <th className="px-4 py-2 border text-left">Program</th>
                <th className="px-4 py-2 border text-left">Class</th>
                <th className="px-4 py-2 border text-left">Status</th>
                <th className="px-4 py-2 border text-left">Enrolled At</th>
                <th className="px-4 py-2 border text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No enrollments found
                  </td>
                </tr>
              ) : (
                enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border text-sm">{enrollment.id.slice(0, 8)}...</td>
                    <td className="px-4 py-2 border">{enrollment.studentPartyId.slice(0, 8)}...</td>
                    <td className="px-4 py-2 border">{enrollment.branchId.slice(0, 8)}...</td>
                    <td className="px-4 py-2 border">
                      {enrollment.programId ? enrollment.programId.slice(0, 8) + '...' : '-'}
                    </td>
                    <td className="px-4 py-2 border">
                      {enrollment.classId ? enrollment.classId.slice(0, 8) + '...' : '-'}
                    </td>
                    <td className="px-4 py-2 border">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          enrollment.enrollmentStatus === 'active'
                            ? 'bg-green-100 text-green-800'
                            : enrollment.enrollmentStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : enrollment.enrollmentStatus === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {enrollment.enrollmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 border text-sm">
                      {new Date(enrollment.enrolledAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 border">
                      <Link
                        href={`/dashboard/english-center/enrollments/${enrollment.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
