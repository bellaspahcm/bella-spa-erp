'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareText, Reply, Save, Send } from 'lucide-react';

export default function EnglishCenterEngagementPage() {
  const [template, setTemplate] = useState({
    branchId: '',
    code: '',
    name: '',
    category: 'general',
    defaultChannel: 'in_app',
    titleTemplate: '',
    bodyTemplate: '',
    requiresAcknowledgement: false,
  });
  const [messageForm, setMessageForm] = useState({
    templateId: '',
    triggerType: 'manual',
    sourceType: 'manual',
    sourceId: '',
    englishEnrollmentId: '',
    studentPartyId: '',
    recipientPartyId: '',
    recipientRole: 'parent',
    channel: 'in_app',
    title: '',
    body: '',
    idempotencyKey: '',
  });
  const [responseForm, setResponseForm] = useState({
    recipientId: '',
    responseType: 'acknowledgement',
    actorPartyId: '',
    body: '',
  });
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const postJson = async (url: string, body: object, label: string) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Failed to ${label}`);
      setMessage(label);
      setLastResult(payload);
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = await postJson('/api/english-center/engagement/templates', {
      branchId: template.branchId || null,
      code: template.code,
      name: template.name,
      category: template.category,
      defaultChannels: [template.defaultChannel],
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
      requiresAcknowledgement: template.requiresAcknowledgement,
    }, 'Template created');
    if (payload?.id) setMessageForm((current) => ({ ...current, templateId: payload.id }));
  };

  const queueMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = await postJson('/api/english-center/engagement/messages', {
      templateId: messageForm.templateId || null,
      triggerType: messageForm.triggerType,
      sourceType: messageForm.sourceType,
      sourceId: messageForm.sourceId,
      englishEnrollmentId: messageForm.englishEnrollmentId,
      studentPartyId: messageForm.studentPartyId,
      content: {
        title: messageForm.title,
        body: messageForm.body,
      },
      recipients: [{
        partyId: messageForm.recipientPartyId,
        role: messageForm.recipientRole,
        channels: [messageForm.channel],
        consentStatus: 'granted',
      }],
      requiresAcknowledgement: true,
      idempotencyKey: messageForm.idempotencyKey,
      dispatchNow: false,
    }, 'Message queued');
    const firstRecipientId = payload?.recipients?.[0]?.id;
    if (firstRecipientId) {
      setResponseForm((current) => ({
        ...current,
        recipientId: firstRecipientId,
        actorPartyId: messageForm.recipientPartyId,
      }));
    }
  };

  const recordResponse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await postJson('/api/english-center/engagement/responses', {
      recipientId: responseForm.recipientId,
      responseType: responseForm.responseType,
      actorPartyId: responseForm.actorPartyId,
      body: responseForm.body || null,
    }, 'Response recorded');
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center gap-3 border-b border-slate-200 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-950">Parent / Student Engagement</h1>
            <p className="text-sm font-semibold text-slate-500">Templates, queued communication, and responses</p>
          </div>
        </header>

        {(message || error) && (
          <div className={`rounded-lg border p-3 text-sm font-bold ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />}
            {error || message}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[320px_1fr_320px]">
          <form onSubmit={createTemplate} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><MessageSquareText className="h-4 w-4 text-indigo-600" />Template</h2>
            <div className="space-y-3">
              <input value={template.branchId} onChange={(event) => setTemplate({ ...template, branchId: event.target.value })} placeholder="Branch ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <input value={template.code} onChange={(event) => setTemplate({ ...template, code: event.target.value })} placeholder="Code" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <input value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} placeholder="Name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <select value={template.category} onChange={(event) => setTemplate({ ...template, category: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500">
                <option value="attendance">Attendance</option>
                <option value="progress">Progress</option>
                <option value="tuition">Tuition</option>
                <option value="general">General</option>
              </select>
              <select value={template.defaultChannel} onChange={(event) => setTemplate({ ...template, defaultChannel: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500">
                <option value="in_app">In app</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="zalo_oa">Zalo OA</option>
                <option value="push">Push</option>
              </select>
              <input value={template.titleTemplate} onChange={(event) => setTemplate({ ...template, titleTemplate: event.target.value })} placeholder="Title template" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <textarea value={template.bodyTemplate} onChange={(event) => setTemplate({ ...template, bodyTemplate: event.target.value })} placeholder="Body template" className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <input type="checkbox" checked={template.requiresAcknowledgement} onChange={(event) => setTemplate({ ...template, requiresAcknowledgement: event.target.checked })} />
                Requires acknowledgement
              </label>
              <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
            </div>
          </form>

          <form onSubmit={queueMessage} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><Send className="h-4 w-4 text-sky-600" />Queue Message</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={messageForm.templateId} onChange={(event) => setMessageForm({ ...messageForm, templateId: event.target.value })} placeholder="Template ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <input value={messageForm.sourceId} onChange={(event) => setMessageForm({ ...messageForm, sourceId: event.target.value })} placeholder="Source ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <input value={messageForm.englishEnrollmentId} onChange={(event) => setMessageForm({ ...messageForm, englishEnrollmentId: event.target.value })} placeholder="English enrollment ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <input value={messageForm.studentPartyId} onChange={(event) => setMessageForm({ ...messageForm, studentPartyId: event.target.value })} placeholder="Student party ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <input value={messageForm.recipientPartyId} onChange={(event) => setMessageForm({ ...messageForm, recipientPartyId: event.target.value })} placeholder="Recipient party ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <select value={messageForm.recipientRole} onChange={(event) => setMessageForm({ ...messageForm, recipientRole: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500">
                <option value="student">Student</option>
                <option value="parent">Parent</option>
                <option value="guardian">Guardian</option>
              </select>
              <select value={messageForm.channel} onChange={(event) => setMessageForm({ ...messageForm, channel: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500">
                <option value="in_app">In app</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="zalo_oa">Zalo OA</option>
                <option value="push">Push</option>
              </select>
              <input value={messageForm.idempotencyKey} onChange={(event) => setMessageForm({ ...messageForm, idempotencyKey: event.target.value })} placeholder="Idempotency key" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <input value={messageForm.title} onChange={(event) => setMessageForm({ ...messageForm, title: event.target.value })} placeholder="Title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 md:col-span-2" />
              <textarea value={messageForm.body} onChange={(event) => setMessageForm({ ...messageForm, body: event.target.value })} placeholder="Body" className="min-h-28 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 md:col-span-2" />
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-60 md:col-span-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Queue
              </button>
            </div>
          </form>

          <form onSubmit={recordResponse} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><Reply className="h-4 w-4 text-emerald-600" />Response</h2>
            <div className="space-y-3">
              <input value={responseForm.recipientId} onChange={(event) => setResponseForm({ ...responseForm, recipientId: event.target.value })} placeholder="Recipient ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <select value={responseForm.responseType} onChange={(event) => setResponseForm({ ...responseForm, responseType: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500">
                <option value="acknowledgement">Acknowledgement</option>
                <option value="decline">Decline</option>
                <option value="reply">Reply</option>
              </select>
              <input value={responseForm.actorPartyId} onChange={(event) => setResponseForm({ ...responseForm, actorPartyId: event.target.value })} placeholder="Actor party ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <textarea value={responseForm.body} onChange={(event) => setResponseForm({ ...responseForm, body: event.target.value })} placeholder="Response body" className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500" />
              <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
            </div>
          </form>
        </section>

        {lastResult !== null && (
          <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs font-semibold text-slate-100">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
