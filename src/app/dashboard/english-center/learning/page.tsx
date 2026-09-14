'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, BookOpenCheck, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, Save } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  englishEnrollmentId: string;
  status: string;
  notes: string | null;
  recordedAt: string;
}

interface ProgressRecord {
  id: string;
  englishEnrollmentId: string;
  progressLabel: string;
  skillArea: string | null;
  notes: string | null;
  recordedAt: string;
}

const blankAttendance = {
  sessionId: '',
  englishEnrollmentId: '',
  status: 'present',
  notes: '',
};

const blankProgress = {
  englishEnrollmentId: '',
  sessionId: '',
  progressLabel: 'on_track',
  skillArea: 'overall',
  notes: '',
};

export default function EnglishCenterLearningPage() {
  const [sessionId, setSessionId] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [attendanceForm, setAttendanceForm] = useState(blankAttendance);
  const [progressForm, setProgressForm] = useState(blankProgress);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/english-center/learning/attendance?sessionId=${encodeURIComponent(sessionId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load attendance');
      setAttendance(payload.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/english-center/learning/progress?englishEnrollmentId=${encodeURIComponent(enrollmentId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load progress');
      setProgress(payload.progress || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/english-center/learning/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: attendanceForm.sessionId,
          attendance: [{
            englishEnrollmentId: attendanceForm.englishEnrollmentId,
            status: attendanceForm.status,
            notes: attendanceForm.notes || null,
          }],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to mark attendance');
      setMessage('Attendance saved');
      setSessionId(attendanceForm.sessionId);
      setAttendanceForm(blankAttendance);
      setAttendance(payload.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const recordProgress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/english-center/learning/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...progressForm,
          sessionId: progressForm.sessionId || undefined,
          notes: progressForm.notes || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to record progress');
      setMessage('Progress saved');
      setEnrollmentId(progressForm.englishEnrollmentId);
      setProgressForm(blankProgress);
      setProgress((current) => [payload, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">Learning Operations</h1>
              <p className="text-sm font-semibold text-slate-500">Attendance and progress operations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => Promise.all([loadAttendance(), loadProgress()])}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-300 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {(message || error) && (
          <div className={`rounded-lg border p-3 text-sm font-bold ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />}
            {error || message}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-4">
            <form onSubmit={markAttendance} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                Mark Attendance
              </h2>
              <div className="space-y-3">
                <input value={attendanceForm.sessionId} onChange={(event) => setAttendanceForm({ ...attendanceForm, sessionId: event.target.value })} placeholder="Session ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <input value={attendanceForm.englishEnrollmentId} onChange={(event) => setAttendanceForm({ ...attendanceForm, englishEnrollmentId: event.target.value })} placeholder="English enrollment ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <select value={attendanceForm.status} onChange={(event) => setAttendanceForm({ ...attendanceForm, status: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
                <textarea value={attendanceForm.notes} onChange={(event) => setAttendanceForm({ ...attendanceForm, notes: event.target.value })} placeholder="Notes" className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </form>

            <form onSubmit={recordProgress} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                <BookOpenCheck className="h-4 w-4 text-sky-600" />
                Record Progress
              </h2>
              <div className="space-y-3">
                <input value={progressForm.englishEnrollmentId} onChange={(event) => setProgressForm({ ...progressForm, englishEnrollmentId: event.target.value })} placeholder="English enrollment ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <input value={progressForm.sessionId} onChange={(event) => setProgressForm({ ...progressForm, sessionId: event.target.value })} placeholder="Session ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <select value={progressForm.progressLabel} onChange={(event) => setProgressForm({ ...progressForm, progressLabel: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
                  <option value="needs_support">Needs support</option>
                  <option value="on_track">On track</option>
                  <option value="strong">Strong</option>
                  <option value="excellent">Excellent</option>
                </select>
                <select value={progressForm.skillArea} onChange={(event) => setProgressForm({ ...progressForm, skillArea: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
                  <option value="overall">Overall</option>
                  <option value="listening">Listening</option>
                  <option value="speaking">Speaking</option>
                  <option value="reading">Reading</option>
                  <option value="writing">Writing</option>
                  <option value="grammar">Grammar</option>
                  <option value="vocabulary">Vocabulary</option>
                </select>
                <textarea value={progressForm.notes} onChange={(event) => setProgressForm({ ...progressForm, notes: event.target.value })} placeholder="Notes" className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </form>
          </aside>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex gap-2">
                <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="Session ID" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <button type="button" onClick={loadAttendance} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-emerald-300">
                  Load
                </button>
              </div>
              <div className="space-y-2">
                {attendance.map((record) => (
                  <div key={record.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="font-black text-slate-900">{record.englishEnrollmentId}</div>
                    <div className="font-semibold text-slate-500">{record.status} · {record.recordedAt}</div>
                    {record.notes && <div className="mt-1 text-slate-600">{record.notes}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex gap-2">
                <input value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)} placeholder="English enrollment ID" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <button type="button" onClick={loadProgress} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-emerald-300">
                  Load
                </button>
              </div>
              <div className="space-y-2">
                {progress.map((record) => (
                  <div key={record.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="font-black text-slate-900">{record.progressLabel}</div>
                    <div className="font-semibold text-slate-500">{record.skillArea || 'overall'} · {record.recordedAt}</div>
                    {record.notes && <div className="mt-1 text-slate-600">{record.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
