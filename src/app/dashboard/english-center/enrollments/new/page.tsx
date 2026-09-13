/**
 * E2 — English Center Create Enrollment Page
 * Path: /dashboard/english-center/enrollments/new
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateEnrollmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    studentPartyId: '',
    courseId: '',
    branchId: '',
    programId: '',
    classId: '',
    intake: '',
    englishLevelAtEnrollment: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        studentPartyId: formData.studentPartyId,
        courseId: formData.courseId,
        branchId: formData.branchId,
        programId: formData.programId || undefined,
        classId: formData.classId || undefined,
        intake: formData.intake || undefined,
        englishLevelAtEnrollment: formData.englishLevelAtEnrollment || undefined,
      };

      const response = await fetch('/api/english-center/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create enrollment');
      }

      const enrollment = await response.json();
      router.push(`/dashboard/english-center/enrollments/${enrollment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/english-center/enrollments"
          className="text-blue-600 hover:underline"
        >
          ← Back to Enrollments
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Create English Center Enrollment</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Party ID */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Student Party ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.studentPartyId}
            onChange={(e) => setFormData({ ...formData, studentPartyId: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="UUID of student party"
          />
        </div>

        {/* Course ID */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Course ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.courseId}
            onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="UUID of course"
          />
        </div>

        {/* Branch ID */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Branch ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.branchId}
            onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="UUID of English Center branch"
          />
        </div>

        {/* Program ID */}
        <div>
          <label className="block text-sm font-medium mb-1">Program ID (optional)</label>
          <input
            type="text"
            value={formData.programId}
            onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="UUID of English program"
          />
        </div>

        {/* Class ID */}
        <div>
          <label className="block text-sm font-medium mb-1">Class ID (optional)</label>
          <input
            type="text"
            value={formData.classId}
            onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="UUID of class"
          />
        </div>

        {/* Intake */}
        <div>
          <label className="block text-sm font-medium mb-1">Intake/Cohort (optional)</label>
          <input
            type="text"
            value={formData.intake}
            onChange={(e) => setFormData({ ...formData, intake: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 2026-Q3, September 2026"
          />
        </div>

        {/* English Level */}
        <div>
          <label className="block text-sm font-medium mb-1">
            English Level at Enrollment (optional)
          </label>
          <input
            type="text"
            value={formData.englishLevelAtEnrollment}
            onChange={(e) =>
              setFormData({ ...formData, englishLevelAtEnrollment: e.target.value })
            }
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., A1, B2, Intermediate"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Enrollment'}
          </button>
          <Link
            href="/dashboard/english-center/enrollments"
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
