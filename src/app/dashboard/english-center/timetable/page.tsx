'use client';

/**
 * E5 — English Center Timetable & Room Scheduling Page
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  Loader2,
  Plus,
  RefreshCw,
  School,
  Users,
} from 'lucide-react';

type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

interface TimetableSessionItem {
  id: string;
  branchId: string;
  classId: string;
  teacherId: string | null;
  roomId: string | null;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  topic: string | null;
}

interface RoomItem {
  id: string;
  branchId: string;
  code: string;
  name: string;
  capacity: number;
  status: 'active' | 'inactive';
}

interface SessionFormState {
  branchId: string;
  classId: string;
  teacherId: string;
  roomId: string;
  startsAt: string;
  endsAt: string;
  topic: string;
}

interface RoomFormState {
  branchId: string;
  code: string;
  name: string;
  capacity: string;
}

const blankSession: SessionFormState = {
  branchId: '',
  classId: '',
  teacherId: '',
  roomId: '',
  startsAt: '',
  endsAt: '',
  topic: '',
};

const blankRoom: RoomFormState = {
  branchId: '',
  code: '',
  name: '',
  capacity: '20',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function statusTone(status: SessionStatus) {
  if (status === 'scheduled') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'completed') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function EnglishCenterTimetablePage() {
  const [sessions, setSessions] = useState<TimetableSessionItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(blankSession);
  const [roomForm, setRoomForm] = useState<RoomFormState>(blankRoom);
  const [branchFilter, setBranchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchFilter) params.set('branchId', branchFilter);

      const [sessionResponse, roomResponse] = await Promise.all([
        fetch(`/api/english-center/timetable?${params.toString()}`),
        fetch(`/api/english-center/rooms?${params.toString()}`),
      ]);

      if (!sessionResponse.ok) throw new Error('Failed to fetch timetable');
      if (!roomResponse.ok) throw new Error('Failed to fetch rooms');

      const sessionData = await sessionResponse.json();
      const roomData = await roomResponse.json();
      setSessions(sessionData.sessions || []);
      setRooms(roomData.rooms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchFilter]);

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/english-center/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...roomForm,
          capacity: Number(roomForm.capacity),
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to create room');
      }
      setMessage('Room created');
      setRoomForm(blankRoom);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const scheduleSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/english-center/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sessionForm,
          teacherId: sessionForm.teacherId || null,
          roomId: sessionForm.roomId || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to schedule session');
      }
      setMessage('Session scheduled');
      setSessionForm(blankSession);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const scheduledCount = sessions.filter((session) => session.status === 'scheduled').length;
  const occupiedRooms = new Set(sessions.filter((session) => session.status === 'scheduled' && session.roomId).map((session) => session.roomId)).size;

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-950">English Center Timetable</h1>
                <p className="text-sm font-semibold text-slate-500">
                  Teacher, room, class, branch, and tenant conflict controls
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-300 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-400">Scheduled Sessions</span>
              <Clock className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-3xl font-black">{scheduledCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-400">Active Rooms</span>
              <DoorOpen className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-2 text-3xl font-black">{rooms.filter((room) => room.status === 'active').length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-400">Occupied Rooms</span>
              <School className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-3xl font-black">{occupiedRooms}</p>
          </div>
        </section>

        {(message || error) && (
          <div className={`rounded-lg border p-3 text-sm font-bold ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />}
            {error || message}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <form onSubmit={createRoom} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                <DoorOpen className="h-4 w-4 text-sky-600" />
                Create Room
              </h2>
              <div className="space-y-3">
                <input value={roomForm.branchId} onChange={(event) => setRoomForm({ ...roomForm, branchId: event.target.value })} placeholder="Branch ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <input value={roomForm.code} onChange={(event) => setRoomForm({ ...roomForm, code: event.target.value })} placeholder="Room code" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                  <input value={roomForm.capacity} onChange={(event) => setRoomForm({ ...roomForm, capacity: event.target.value })} inputMode="numeric" placeholder="Capacity" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                </div>
                <input value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} placeholder="Room name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
              </div>
              <button type="submit" disabled={saving || !roomForm.branchId || !roomForm.code || !roomForm.name} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Room
              </button>
            </form>

            <form onSubmit={scheduleSession} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
                Schedule Session
              </h2>
              <div className="space-y-3">
                <input value={sessionForm.branchId} onChange={(event) => setSessionForm({ ...sessionForm, branchId: event.target.value })} placeholder="Branch ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <input value={sessionForm.classId} onChange={(event) => setSessionForm({ ...sessionForm, classId: event.target.value })} placeholder="Class ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <input value={sessionForm.teacherId} onChange={(event) => setSessionForm({ ...sessionForm, teacherId: event.target.value })} placeholder="Teacher ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <input value={sessionForm.roomId} onChange={(event) => setSessionForm({ ...sessionForm, roomId: event.target.value })} placeholder="Room ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="datetime-local" value={sessionForm.startsAt} onChange={(event) => setSessionForm({ ...sessionForm, startsAt: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                  <input type="datetime-local" value={sessionForm.endsAt} onChange={(event) => setSessionForm({ ...sessionForm, endsAt: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
                </div>
                <input value={sessionForm.topic} onChange={(event) => setSessionForm({ ...sessionForm, topic: event.target.value })} placeholder="Topic" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
              </div>
              <button type="submit" disabled={saving || !sessionForm.branchId || !sessionForm.classId || !sessionForm.startsAt || !sessionForm.endsAt} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Schedule
              </button>
            </form>
          </aside>

          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black">Timetable</h2>
                <p className="text-sm font-semibold text-slate-500">{sessions.length} sessions in current scope</p>
              </div>
              <input value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} placeholder="Filter by branch ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 lg:w-72" />
            </div>

            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm font-bold text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading timetable
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <CalendarDays className="mb-3 h-10 w-10 text-slate-400" />
                <h3 className="text-base font-black">No sessions scheduled</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Create a room and schedule the first class session for this branch.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <article key={session.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-950">{session.topic || 'Class session'}</h3>
                        <span className={`rounded-md border px-2 py-1 text-xs font-black ${statusTone(session.status)}`}>{session.status}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {formatDateTime(session.startsAt)} - {formatDateTime(session.endsAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1"><School className="h-3.5 w-3.5" />Class {session.classId.slice(0, 8)}</span>
                        <span className="inline-flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" />Room {session.roomId ? session.roomId.slice(0, 8) : 'TBD'}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />Teacher {session.teacherId ? session.teacherId.slice(0, 8) : 'TBD'}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
