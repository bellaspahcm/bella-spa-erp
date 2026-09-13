/**
 * E2 — English Center Enrollment Detail Page
 * Path: /dashboard/english-center/enrollments/:id
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EnrollmentDetail {
  id: string;
  tenantId: string;
  canonicalEnrollmentId: string;
  studentPartyId: string;
  courseId: string;
  branchId: string;
  programId: string | null;
  classId: string | null;
  intake: string | null;
  englishLevelAtEnrollment: string | null;
  enrollmentStatus: 'pending' | 'active' | 'completed' | 'cancelled';
  enrolledAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export default function EnrollmentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ classId: '', programId: '' });

  useEffect(() => {
    fetchEnrollment();
  }, [params.id]);

  const fetchEnrollment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/english-center/enrollments/${params.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch enrollment');
      }

      const data = await response.json();
      setEnrollment(data);
      setEditData({
        classId: data.classId || '',
        programId: data.programId || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!enrollment) return;

    try {
      const response = await fetch(`/api/english-center/enrollments/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: editData.classId || undefined,
          programId: editData.programId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update enrollment');
      }

      const updated = await response.json();
      setEnrollment(updated);
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleActivate = async () => {
    if (!enrollment) return;

    try {
      const response = await fetch(`/api/english-center/enrollments/${params.id}/activate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to activate enrollment');
      }

      const updated = await response.json();
      setEnrollment(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading enrollment...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
        <Link href="/dashboard/english-center/enrollments" className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Enrollments
        </Link>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8">Enrollment not found</div>
        <Link href="/dashboard/english-center/enrollments" className="text-blue-600 hover:underline">
          ← Back to Enrollments
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/english-center/enrollments"
          className="text-blue-600 hover:underline"
        >
          ← Back to Enrollments
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Enrollment Detail</h1>
        <div className="flex gap-2">
          {enrollment.enrollmentStatus === 'pending' && (
            <button
              onClick={handleActivate}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Activate
            </button>
          )}
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit Context
            </button>
          ) : (
            <>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditData({
                    classId: enrollment.classId || '',
                    programId: enrollment.programId || '',
                  });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          <span
            className={`px-3 py-1 rounded text-sm font-semibold ${
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
        </div>

        {/* Core Data */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">Enrollment ID</label>
            <p className="font-mono text-sm">{enrollment.id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Canonical Enrollment</label>
            <p className="font-mono text-sm">{enrollment.canonicalEnrollmentId}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Student Party ID</label>
            <p className="font-mono text-sm">{enrollment.studentPartyId}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Course ID</label>
            <p className="font-mono text-sm">{enrollment.courseId}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Branch ID</label>
            <p className="font-mono text-sm">{enrollment.branchId}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Enrolled At</label>
            <p>{new Date(enrollment.enrolledAt).toLocaleString()}</p>
          </div>
        </div>

        <hr />

        {/* English Center Context (Editable) */}
        <h3 className="text-lg font-semibold">English Center Context</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">Program ID</label>
            {editMode ? (
              <input
                type="text"
                value={editData.programId}
                onChange={(e) => setEditData({ ...editData, programId: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="UUID"
              />
            ) : (
              <p className="font-mono text-sm">{enrollment.programId || '-'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Class ID</label>
            {editMode ? (
              <input
                type="text"
                value={editData.classId}
                onChange={(e) => setEditData({ ...editData, classId: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="UUID"
              />
            ) : (
              <p className="font-mono text-sm">{enrollment.classId || '-'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Intake/Cohort</label>
            <p>{enrollment.intake || '-'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">English Level</label>
            <p>{enrollment.englishLevelAtEnrollment || '-'}</p>
          </div>
        </div>

        <hr />

        {/* Metadata */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Metadata</label>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
            {JSON.stringify(enrollment.metadata, null, 2)}
          </pre>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
          <div>
            <label className="block font-medium">Created At</label>
            <p>{new Date(enrollment.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="block font-medium">Updated At</label>
            <p>{new Date(enrollment.updatedAt).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
