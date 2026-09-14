'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, FileText, Loader2, Receipt, Save } from 'lucide-react';

const today = new Date().toISOString().slice(0, 10);

export default function EnglishCenterTuitionPage() {
  const [plan, setPlan] = useState({
    branchId: '',
    code: '',
    name: '',
    billingCycle: 'monthly',
    amountMinor: '',
    currency: 'VND',
  });
  const [assignment, setAssignment] = useState({
    tuitionPlanId: '',
    englishEnrollmentId: '',
    classId: '',
    startDate: today,
  });
  const [invoice, setInvoice] = useState({
    assignmentId: '',
    invoiceNumber: '',
    dueDate: today,
    description: 'Tuition fee',
    amountMinor: '',
  });
  const [payment, setPayment] = useState({
    invoiceId: '',
    amountMinor: '',
    method: 'bank_transfer',
    paymentDate: today,
    idempotencyKey: '',
  });
  const [lookupInvoiceId, setLookupInvoiceId] = useState('');
  const [receivable, setReceivable] = useState<unknown>(null);
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
      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = await postJson('/api/english-center/tuition/plans', {
      ...plan,
      branchId: plan.branchId || null,
    }, 'Tuition plan created');
    if (payload?.id) setAssignment((current) => ({ ...current, tuitionPlanId: payload.id }));
  };

  const assignPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = await postJson('/api/english-center/tuition/assignments', {
      ...assignment,
      classId: assignment.classId || null,
    }, 'Tuition assignment created');
    if (payload?.id) setInvoice((current) => ({ ...current, assignmentId: payload.id }));
  };

  const issueInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = await postJson('/api/english-center/tuition/invoices', {
      assignmentId: invoice.assignmentId,
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate,
      lines: [{
        description: invoice.description,
        quantity: 1,
        unitAmountMinor: invoice.amountMinor,
      }],
    }, 'Invoice issued');
    if (payload?.id) {
      setPayment((current) => ({
        ...current,
        invoiceId: payload.id,
        amountMinor: payload.outstandingAmountMinor || invoice.amountMinor,
        idempotencyKey: `pay-${payload.id}`,
      }));
      setLookupInvoiceId(payload.id);
    }
  };

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await postJson('/api/english-center/tuition/payments', payment, 'Payment recorded');
  };

  const loadReceivable = async () => {
    if (!lookupInvoiceId) return;
    setError(null);
    try {
      const response = await fetch(`/api/english-center/tuition/invoices?invoiceId=${encodeURIComponent(lookupInvoiceId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load receivable');
      setReceivable(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center gap-3 border-b border-slate-200 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-950">Tuition Billing</h1>
            <p className="text-sm font-semibold text-slate-500">Plans, assignments, invoices, and payment allocation</p>
          </div>
        </header>

        {(message || error) && (
          <div className={`rounded-lg border p-3 text-sm font-bold ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />}
            {error || message}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-4">
          <form onSubmit={createPlan} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><Banknote className="h-4 w-4 text-teal-600" />Plan</h2>
            <div className="space-y-3">
              <input value={plan.branchId} onChange={(event) => setPlan({ ...plan, branchId: event.target.value })} placeholder="Branch ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={plan.code} onChange={(event) => setPlan({ ...plan, code: event.target.value })} placeholder="Code" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={plan.name} onChange={(event) => setPlan({ ...plan, name: event.target.value })} placeholder="Name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <select value={plan.billingCycle} onChange={(event) => setPlan({ ...plan, billingCycle: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500">
                <option value="monthly">Monthly</option>
                <option value="term">Term</option>
                <option value="course">Course</option>
                <option value="installment">Installment</option>
              </select>
              <input value={plan.amountMinor} onChange={(event) => setPlan({ ...plan, amountMinor: event.target.value })} placeholder="Amount minor" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 text-sm font-black text-white hover:bg-teal-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
            </div>
          </form>

          <form onSubmit={assignPlan} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><Receipt className="h-4 w-4 text-sky-600" />Assign</h2>
            <div className="space-y-3">
              <input value={assignment.tuitionPlanId} onChange={(event) => setAssignment({ ...assignment, tuitionPlanId: event.target.value })} placeholder="Tuition plan ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={assignment.englishEnrollmentId} onChange={(event) => setAssignment({ ...assignment, englishEnrollmentId: event.target.value })} placeholder="English enrollment ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={assignment.classId} onChange={(event) => setAssignment({ ...assignment, classId: event.target.value })} placeholder="Class ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input type="date" value={assignment.startDate} onChange={(event) => setAssignment({ ...assignment, startDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
            </div>
          </form>

          <form onSubmit={issueInvoice} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><FileText className="h-4 w-4 text-amber-600" />Invoice</h2>
            <div className="space-y-3">
              <input value={invoice.assignmentId} onChange={(event) => setInvoice({ ...invoice, assignmentId: event.target.value })} placeholder="Assignment ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={invoice.invoiceNumber} onChange={(event) => setInvoice({ ...invoice, invoiceNumber: event.target.value })} placeholder="Invoice number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input type="date" value={invoice.dueDate} onChange={(event) => setInvoice({ ...invoice, dueDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={invoice.description} onChange={(event) => setInvoice({ ...invoice, description: event.target.value })} placeholder="Line description" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={invoice.amountMinor} onChange={(event) => setInvoice({ ...invoice, amountMinor: event.target.value })} placeholder="Amount minor" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
            </div>
          </form>

          <form onSubmit={recordPayment} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-base font-black"><Receipt className="h-4 w-4 text-emerald-600" />Payment</h2>
            <div className="space-y-3">
              <input value={payment.invoiceId} onChange={(event) => setPayment({ ...payment, invoiceId: event.target.value })} placeholder="Invoice ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={payment.amountMinor} onChange={(event) => setPayment({ ...payment, amountMinor: event.target.value })} placeholder="Amount minor" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <select value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="qr_code">QR code</option>
              </select>
              <input type="date" value={payment.paymentDate} onChange={(event) => setPayment({ ...payment, paymentDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <input value={payment.idempotencyKey} onChange={(event) => setPayment({ ...payment, idempotencyKey: event.target.value })} placeholder="Idempotency key" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
              <button type="submit" disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={lookupInvoiceId} onChange={(event) => setLookupInvoiceId(event.target.value)} placeholder="Invoice ID" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500" />
            <button type="button" onClick={loadReceivable} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-teal-300">
              <Receipt className="h-4 w-4" /> Load receivable
            </button>
          </div>
          {receivable !== null && (
            <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-4 text-xs font-semibold text-slate-100">
              {JSON.stringify(receivable, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </main>
  );
}
