import { redirect } from 'next/navigation';

import {
  executeCanonicalWarehouseStockInAction,
  type WarehouseCanonicalStockInActionInput,
} from '@/services/warehouse-canonical-actions';
import type { WarehouseStockInSourceType } from '@/platform/logistics/warehouse/stock-in-canonical.facade';

interface WarehouseStockInPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const sourceTypes = new Set<WarehouseStockInSourceType>([
  'purchase_order',
  'production_order',
  'return',
  'transfer',
]);

export default async function WarehouseStockInPage({ searchParams }: WarehouseStockInPageProps) {
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Stock-In</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Minimal canonical Stock-In entry. This path calls the Warehouse Stock-In action adapter,
            then the canonical facade and Logistics OS persistence.
          </p>
        </header>

        {status === 'success' ? (
          <section
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            data-testid="stock-in-status"
          >
            <p className="font-semibold">Canonical Stock-In completed</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <StatusRow label="Balance on hand" value={readParam(params, 'onHand')} />
              <StatusRow label="Movement" value={readParam(params, 'movement')} />
              <StatusRow label="Traceability" value={readParam(params, 'traceability')} />
              <StatusRow label="Item" value={readParam(params, 'itemId')} />
            </dl>
          </section>
        ) : null}

        {error ? (
          <section
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            data-testid="stock-in-error"
          >
            <p className="font-semibold">Canonical Stock-In rejected</p>
            <p className="mt-1">{error}</p>
          </section>
        ) : null}

        <form
          action={submitCanonicalStockIn}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="canonical-stock-in-form"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Source document ID" name="sourceDocumentId" />
            <Field label="Source document number" name="sourceDocumentNumber" />
            <SelectField
              label="Source type"
              name="sourceType"
              options={[
                ['purchase_order', 'Purchase order'],
                ['production_order', 'Production order'],
                ['return', 'Return'],
                ['transfer', 'Transfer'],
              ]}
            />
            <Field label="Source line ID" name="sourceLineId" />
            <Field label="Warehouse SKU ID" name="warehouseSkuId" />
            <Field label="Warehouse bin ID" name="warehouseBinId" />
            <Field label="Canonical item ID" name="itemId" />
            <Field label="Canonical location ID" name="locationId" />
            <Field label="Quantity" name="quantity" type="number" step="0.0001" />
            <Field label="Unit of measure" name="unitOfMeasure" defaultValue="EA" />
            <Field label="Lot number" name="lotNumber" />
            <Field label="Unit cost" name="unitCost" type="number" step="0.01" defaultValue="0" />
            <Field label="Currency" name="currency" defaultValue="VND" />
          </div>
          <button
            type="submit"
            className="h-11 w-fit rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            data-testid="canonical-stock-in-submit"
          >
            Submit canonical Stock-In
          </button>
        </form>
      </div>
    </main>
  );
}

async function submitCanonicalStockIn(formData: FormData): Promise<void> {
  'use server';

  const sourceType = readSourceType(readFormText(formData, 'sourceType'));
  const quantity = Number(readFormText(formData, 'quantity'));
  const unitCost = Number(readFormText(formData, 'unitCost'));

  const input: WarehouseCanonicalStockInActionInput = {
    sourceDocument: {
      id: readFormText(formData, 'sourceDocumentId'),
      number: readOptionalFormText(formData, 'sourceDocumentNumber'),
      type: sourceType,
    },
    lines: [
      {
        warehouseSkuId: readFormText(formData, 'warehouseSkuId'),
        warehouseBinId: readFormText(formData, 'warehouseBinId'),
        itemId: readFormText(formData, 'itemId'),
        locationId: readFormText(formData, 'locationId'),
        quantity,
        unitOfMeasure: readFormText(formData, 'unitOfMeasure'),
        lotNumber: readOptionalFormText(formData, 'lotNumber'),
        unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
        currency: readOptionalFormText(formData, 'currency'),
        sourceLineId: readOptionalFormText(formData, 'sourceLineId'),
        metadata: {
          browser_entry: 'canonical_stock_in',
        },
      },
    ],
  };

  const result = await executeCanonicalWarehouseStockInAction(input);
  const redirectParams = new URLSearchParams();

  if (!result.ok) {
    redirectParams.set('error', `${result.error.code}: ${result.error.message}`);
    redirect(`/warehouse/stock-in?${redirectParams.toString()}`);
  }

  const firstLine = result.value.lines[0];
  if (!firstLine) {
    redirectParams.set('error', 'WAREHOUSE_STOCK_IN_EMPTY_RESULT');
    redirect(`/warehouse/stock-in?${redirectParams.toString()}`);
  }

  redirectParams.set('status', 'success');
  redirectParams.set('itemId', firstLine.itemId);
  redirectParams.set('onHand', String(firstLine.readBack.balance.on_hand));
  redirectParams.set(
    'movement',
    `${firstLine.readBack.movement.reason}:${firstLine.readBack.movement.status}`.toUpperCase()
  );
  redirectParams.set(
    'traceability',
    readMetadataText(firstLine.readBack.traceability.metadata, 'compliance_status') ?? 'RECORDED'
  );
  redirect(`/warehouse/stock-in?${redirectParams.toString()}`);
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
        data-testid={`stock-in-${props.name}`}
        defaultValue={props.defaultValue}
        name={props.name}
        required={props.name !== 'sourceDocumentNumber' && props.name !== 'sourceLineId'}
        step={props.step}
        type={props.type ?? 'text'}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  options: Array<[WarehouseStockInSourceType, string]>;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`stock-in-${props.name}`}
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
      <dd className="mt-1 break-all font-mono text-xs" data-testid={`stock-in-${slugify(props.label)}`}>
        {props.value ?? 'NOT_PROVEN'}
      </dd>
    </div>
  );
}

function readSourceType(value: string): WarehouseStockInSourceType {
  return sourceTypes.has(value as WarehouseStockInSourceType)
    ? (value as WarehouseStockInSourceType)
    : 'purchase_order';
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
