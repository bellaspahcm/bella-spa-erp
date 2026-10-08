import { redirect } from 'next/navigation';

import {
  executeHospitalityHotelCoreChainAction,
  type HospitalityHotelCoreChainActionInput,
} from '@/services/hospitality-hotel-core-chain-actions';

interface HotelCoreChainPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HotelCoreChainPage({ searchParams }: HotelCoreChainPageProps) {
  const params = await searchParams;
  const status = readParam(params, 'status');
  const error = readParam(params, 'error');

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Bella Hospitality
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Hotel Core Chain</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Minimal browser verification entry for the sealed Hotel Core service chain.
          </p>
        </header>

        {status === 'success' ? (
          <section
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            data-testid="hotel-core-chain-status"
          >
            <p className="font-semibold">Hospitality Hotel Core chain completed</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <StatusRow label="Product" value={readParam(params, 'product')} />
              <StatusRow label="Stay" value={readParam(params, 'stay')} />
              <StatusRow label="Occupancy" value={readParam(params, 'occupancy')} />
              <StatusRow label="Folio" value={readParam(params, 'folio')} />
              <StatusRow label="Finance" value={readParam(params, 'finance')} />
              <StatusRow label="Payment" value={readParam(params, 'payment')} />
            </dl>
          </section>
        ) : null}

        {error ? (
          <section
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            data-testid="hotel-core-chain-error"
          >
            <p className="font-semibold">Hospitality Hotel Core chain rejected</p>
            <p className="mt-1">{error}</p>
          </section>
        ) : null}

        <form
          action={submitHotelCoreChain}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="hotel-core-chain-form"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Proof marker" name="marker" />
            <Field label="Guest Party ID" name="guestPartyId" />
            <Field label="Check-in date" name="checkInDate" type="date" />
            <Field label="Check-out date" name="checkOutDate" type="date" />
            <Field label="Amount minor" name="amountMinor" type="number" defaultValue="2400000" />
            <Field label="Currency" name="currency" defaultValue="VND" />
            <Field label="Payment method" name="paymentMethod" defaultValue="cash" />
          </div>
          <button
            type="submit"
            className="h-11 w-fit rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            data-testid="hotel-core-chain-submit"
          >
            Run Hotel Core chain
          </button>
        </form>
      </div>
    </main>
  );
}

async function submitHotelCoreChain(formData: FormData): Promise<void> {
  'use server';

  const amountMinor = Number(readFormText(formData, 'amountMinor'));
  const input: HospitalityHotelCoreChainActionInput = {
    marker: readFormText(formData, 'marker'),
    guestPartyId: readFormText(formData, 'guestPartyId'),
    checkInDate: readFormText(formData, 'checkInDate'),
    checkOutDate: readFormText(formData, 'checkOutDate'),
    amountMinor,
    currency: readFormText(formData, 'currency') || 'VND',
    paymentMethod: readFormText(formData, 'paymentMethod') || 'cash',
  };

  const result = await executeHospitalityHotelCoreChainAction(input);
  const redirectParams = new URLSearchParams();

  if (!result.ok) {
    redirectParams.set('error', `${result.error.code}: ${result.error.message}`);
    redirect(`/hospitality/hotel-core-chain?${redirectParams.toString()}`);
  }

  redirectParams.set('status', 'success');
  redirectParams.set('product', result.value.productKey);
  redirectParams.set('stay', result.value.stayStatus);
  redirectParams.set('occupancy', result.value.occupancyStatus);
  redirectParams.set(
    'folio',
    `${result.value.folioStatus}:${result.value.folioOutstandingAmountMinor}`
  );
  redirectParams.set('finance', result.value.financeInvoiceId);
  redirectParams.set(
    'payment',
    `${result.value.financeAllocationId}:${result.value.financeAllocatedAmountMinor}`
  );
  redirect(`/hospitality/hotel-core-chain?${redirectParams.toString()}`);
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <input
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`hotel-core-${props.name}`}
        defaultValue={props.defaultValue}
        name={props.name}
        required
        type={props.type ?? 'text'}
      />
    </label>
  );
}

function StatusRow(props: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide">{props.label}</dt>
      <dd className="mt-1 break-all font-mono text-xs" data-testid={`hotel-core-${slugify(props.label)}`}>
        {props.value ?? 'NOT_PROVEN'}
      </dd>
    </div>
  );
}

function readFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
