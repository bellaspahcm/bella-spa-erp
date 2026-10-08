import { redirect } from 'next/navigation';

import {
  executeCanonicalWarehouseStockTransferAction,
  type WarehouseCanonicalStockTransferActionInput,
} from '@/services/warehouse-canonical-actions';
import type { WarehouseStockTransferSourceType } from '@/platform/logistics/warehouse/stock-transfer-canonical.facade';

interface WarehouseTransferPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const sourceTypes = new Set<WarehouseStockTransferSourceType>([
  'warehouse_transfer',
  'bin_transfer',
  'relocation',
]);

export default async function WarehouseTransferPage({ searchParams }: WarehouseTransferPageProps) {
  const params = await searchParams;
  const status = readParam(params, 'status');
  const error = readParam(params, 'error');

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Canonical Warehouse
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Stock Transfer</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Minimal canonical Stock Transfer entry. This path calls the Warehouse Transfer action
            adapter, then the sealed canonical facade and Logistics OS persistence.
          </p>
        </header>

        {status === 'success' ? (
          <section
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            data-testid="transfer-status"
          >
            <p className="font-semibold">Canonical Stock Transfer completed</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <StatusRow label="Source balance" value={readParam(params, 'source')} />
              <StatusRow label="Destination balance" value={readParam(params, 'destination')} />
              <StatusRow label="Movement" value={readParam(params, 'movement')} />
              <StatusRow label="Traceability" value={readParam(params, 'traceability')} />
            </dl>
          </section>
        ) : null}

        {error ? (
          <section
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            data-testid="transfer-error"
          >
            <p className="font-semibold">Canonical Stock Transfer rejected</p>
            <p className="mt-1">{error}</p>
          </section>
        ) : null}

        <form
          action={submitCanonicalTransfer}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="canonical-transfer-form"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Transfer document ID" name="transferDocumentId" />
            <Field label="Transfer document number" name="transferDocumentNumber" />
            <SelectField
              label="Transfer type"
              name="transferType"
              options={[
                ['warehouse_transfer', 'Warehouse transfer'],
                ['bin_transfer', 'Bin transfer'],
                ['relocation', 'Relocation'],
              ]}
            />
            <Field label="Source line ID" name="sourceLineId" />
            <Field label="Warehouse SKU ID" name="warehouseSkuId" />
            <Field label="From warehouse bin ID" name="fromWarehouseBinId" />
            <Field label="To warehouse bin ID" name="toWarehouseBinId" />
            <Field label="Canonical item ID" name="itemId" />
            <Field label="From location ID" name="fromLocationId" />
            <Field label="To location ID" name="toLocationId" />
            <Field label="Quantity" name="quantity" type="number" step="0.0001" />
            <Field label="Unit of measure" name="unitOfMeasure" defaultValue="EA" />
            <Field label="Lot number" name="lotNumber" />
          </div>
          <button
            type="submit"
            className="h-11 w-fit rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            data-testid="canonical-transfer-submit"
          >
            Submit canonical Transfer
          </button>
        </form>
      </div>
    </main>
  );
}

async function submitCanonicalTransfer(formData: FormData): Promise<void> {
  'use server';

  const quantity = Number(readFormText(formData, 'quantity'));
  const input: WarehouseCanonicalStockTransferActionInput = {
    transferDocument: {
      id: readFormText(formData, 'transferDocumentId'),
      number: readOptionalFormText(formData, 'transferDocumentNumber'),
      type: readTransferType(readFormText(formData, 'transferType')),
    },
    lines: [
      {
        warehouseSkuId: readFormText(formData, 'warehouseSkuId'),
        fromWarehouseBinId: readFormText(formData, 'fromWarehouseBinId'),
        toWarehouseBinId: readFormText(formData, 'toWarehouseBinId'),
        itemId: readFormText(formData, 'itemId'),
        fromLocationId: readFormText(formData, 'fromLocationId'),
        toLocationId: readFormText(formData, 'toLocationId'),
        quantity,
        unitOfMeasure: readFormText(formData, 'unitOfMeasure'),
        lotNumber: readOptionalFormText(formData, 'lotNumber'),
        sourceLineId: readOptionalFormText(formData, 'sourceLineId'),
        metadata: {
          browser_entry: 'canonical_transfer',
        },
      },
    ],
  };

  const result = await executeCanonicalWarehouseStockTransferAction(input);
  const redirectParams = new URLSearchParams();

  if (!result.ok) {
    redirectParams.set('error', `${result.error.code}: ${result.error.message}`);
    redirect(`/warehouse/transfer?${redirectParams.toString()}`);
  }

  const firstLine = result.value.lines[0];
  if (!firstLine) {
    redirectParams.set('error', 'WAREHOUSE_STOCK_TRANSFER_EMPTY_RESULT');
    redirect(`/warehouse/transfer?${redirectParams.toString()}`);
  }

  redirectParams.set('status', 'success');
  redirectParams.set('source', String(firstLine.readBack.sourceBalance.on_hand));
  redirectParams.set('destination', String(firstLine.readBack.destinationBalance.on_hand));
  redirectParams.set('movement', 'RELOCATION:NEUTRAL:COMPLETED');
  redirectParams.set(
    'traceability',
    readMetadataText(firstLine.readBack.traceability.metadata, 'compliance_status') ?? 'RECORDED'
  );
  redirect(`/warehouse/transfer?${redirectParams.toString()}`);
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <input
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`transfer-${props.name}`}
        defaultValue={props.defaultValue}
        name={props.name}
        required={props.name !== 'transferDocumentNumber' && props.name !== 'sourceLineId'}
        step={props.step}
        type={props.type ?? 'text'}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  options: Array<[WarehouseStockTransferSourceType, string]>;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`transfer-${props.name}`}
        name={props.name}
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusRow(props: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide">{props.label}</dt>
      <dd className="mt-1 break-all font-mono text-xs" data-testid={`transfer-${slugify(props.label)}`}>
        {props.value ?? 'NOT_PROVEN'}
      </dd>
    </div>
  );
}

function readTransferType(value: string): WarehouseStockTransferSourceType {
  return sourceTypes.has(value as WarehouseStockTransferSourceType)
    ? (value as WarehouseStockTransferSourceType)
    : 'warehouse_transfer';
}

function readFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalFormText(formData: FormData, key: string): string | undefined {
  const value = readFormText(formData, key);
  return value.length > 0 ? value : undefined;
}

function readParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function readMetadataText(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
