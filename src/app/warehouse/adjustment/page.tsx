import { redirect } from 'next/navigation';

import {
  executeCanonicalWarehouseStockAdjustmentAction,
  type WarehouseCanonicalStockAdjustmentActionInput,
} from '@/services/warehouse-canonical-actions';
import { AdjustmentReason } from '@/platform/logistics/contracts/inventory.contract';
import type { WarehouseStockAdjustmentSourceType } from '@/platform/logistics/warehouse/stock-adjustment-canonical.facade';

interface WarehouseAdjustmentPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const sourceTypes = new Set<WarehouseStockAdjustmentSourceType>([
  'cycle_count',
  'damage',
  'loss',
  'found',
  'reconciliation',
  'correction',
]);

const reasons = new Set<AdjustmentReason>([
  AdjustmentReason.DAMAGE,
  AdjustmentReason.LOSS,
  AdjustmentReason.FOUND,
  AdjustmentReason.CYCLE_COUNT,
  AdjustmentReason.RECONCILIATION,
  AdjustmentReason.CORRECTION,
]);

export default async function WarehouseAdjustmentPage({ searchParams }: WarehouseAdjustmentPageProps) {
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Stock Adjustment</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Minimal canonical Stock Adjustment entry. This path calls the Warehouse Adjustment
            action adapter, then the sealed canonical facade and Logistics OS persistence.
          </p>
        </header>

        {status === 'success' ? (
          <section
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            data-testid="adjustment-status"
          >
            <p className="font-semibold">Canonical Stock Adjustment completed</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <StatusRow label="Balance" value={readParam(params, 'balance')} />
              <StatusRow label="Movement" value={readParam(params, 'movement')} />
              <StatusRow label="Traceability" value={readParam(params, 'traceability')} />
              <StatusRow label="Delta" value={readParam(params, 'delta')} />
            </dl>
          </section>
        ) : null}

        {error ? (
          <section
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            data-testid="adjustment-error"
          >
            <p className="font-semibold">Canonical Stock Adjustment rejected</p>
            <p className="mt-1">{error}</p>
          </section>
        ) : null}

        <form
          action={submitCanonicalAdjustment}
          className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="canonical-adjustment-form"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Adjustment document ID" name="adjustmentDocumentId" />
            <Field label="Adjustment document number" name="adjustmentDocumentNumber" />
            <SelectField
              label="Adjustment type"
              name="adjustmentType"
              options={[
                ['cycle_count', 'Cycle count'],
                ['damage', 'Damage'],
                ['loss', 'Loss'],
                ['found', 'Found'],
                ['reconciliation', 'Reconciliation'],
                ['correction', 'Correction'],
              ]}
            />
            <SelectReason label="Reason" name="reason" />
            <Field label="Source line ID" name="sourceLineId" />
            <Field label="Warehouse SKU ID" name="warehouseSkuId" />
            <Field label="Warehouse bin ID" name="warehouseBinId" />
            <Field label="Canonical item ID" name="itemId" />
            <Field label="Location ID" name="locationId" />
            <Field label="Quantity delta" name="quantityDelta" type="number" step="0.0001" />
            <Field label="Unit of measure" name="unitOfMeasure" defaultValue="EA" />
            <Field label="Lot number" name="lotNumber" />
            <Field label="Notes" name="notes" />
            <Field label="Unit cost" name="unitCost" type="number" step="0.01" defaultValue="0" />
            <Field label="Currency" name="currency" defaultValue="VND" />
          </div>
          <button
            type="submit"
            className="h-11 w-fit rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            data-testid="canonical-adjustment-submit"
          >
            Submit canonical Adjustment
          </button>
        </form>
      </div>
    </main>
  );
}

async function submitCanonicalAdjustment(formData: FormData): Promise<void> {
  'use server';

  const quantityDelta = Number(readFormText(formData, 'quantityDelta'));
  const unitCost = Number(readFormText(formData, 'unitCost'));
  const input: WarehouseCanonicalStockAdjustmentActionInput = {
    adjustmentDocument: {
      id: readFormText(formData, 'adjustmentDocumentId'),
      number: readOptionalFormText(formData, 'adjustmentDocumentNumber'),
      type: readAdjustmentType(readFormText(formData, 'adjustmentType')),
    },
    lines: [
      {
        warehouseSkuId: readFormText(formData, 'warehouseSkuId'),
        warehouseBinId: readFormText(formData, 'warehouseBinId'),
        itemId: readFormText(formData, 'itemId'),
        locationId: readFormText(formData, 'locationId'),
        quantityDelta,
        unitOfMeasure: readFormText(formData, 'unitOfMeasure'),
        reason: readReason(readFormText(formData, 'reason')),
        lotNumber: readOptionalFormText(formData, 'lotNumber'),
        sourceLineId: readOptionalFormText(formData, 'sourceLineId'),
        notes: readOptionalFormText(formData, 'notes'),
        unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
        currency: readOptionalFormText(formData, 'currency'),
        metadata: {
          browser_entry: 'canonical_adjustment',
        },
      },
    ],
  };

  const result = await executeCanonicalWarehouseStockAdjustmentAction(input);
  const redirectParams = new URLSearchParams();

  if (!result.ok) {
    redirectParams.set('error', `${result.error.code}: ${result.error.message}`);
    redirect(`/warehouse/adjustment?${redirectParams.toString()}`);
  }

  const firstLine = result.value.lines[0];
  if (!firstLine) {
    redirectParams.set('error', 'WAREHOUSE_STOCK_ADJUSTMENT_EMPTY_RESULT');
    redirect(`/warehouse/adjustment?${redirectParams.toString()}`);
  }

  const movementType = firstLine.quantityDelta > 0 ? 'ADJUSTMENT_INCREASE' : 'ADJUSTMENT_DECREASE';
  const direction = firstLine.quantityDelta > 0 ? 'INBOUND' : 'OUTBOUND';

  redirectParams.set('status', 'success');
  redirectParams.set('balance', String(firstLine.readBack.balance.on_hand));
  redirectParams.set('movement', `${movementType}:${direction}:COMPLETED`);
  redirectParams.set('delta', String(firstLine.quantityDelta));
  redirectParams.set(
    'traceability',
    readMetadataText(firstLine.readBack.traceability.metadata, 'compliance_status') ?? 'RECORDED'
  );
  redirect(`/warehouse/adjustment?${redirectParams.toString()}`);
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
        data-testid={`adjustment-${props.name}`}
        defaultValue={props.defaultValue}
        name={props.name}
        required={props.name !== 'adjustmentDocumentNumber' && props.name !== 'sourceLineId' && props.name !== 'notes'}
        step={props.step}
        type={props.type ?? 'text'}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  options: Array<[WarehouseStockAdjustmentSourceType, string]>;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`adjustment-${props.name}`}
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

function SelectReason(props: { label: string; name: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {props.label}
      <select
        className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-emerald-600"
        data-testid={`adjustment-${props.name}`}
        name={props.name}
      >
        <option value={AdjustmentReason.CYCLE_COUNT}>Cycle count</option>
        <option value={AdjustmentReason.DAMAGE}>Damage</option>
        <option value={AdjustmentReason.LOSS}>Loss</option>
        <option value={AdjustmentReason.FOUND}>Found</option>
        <option value={AdjustmentReason.RECONCILIATION}>Reconciliation</option>
        <option value={AdjustmentReason.CORRECTION}>Correction</option>
      </select>
    </label>
  );
}

function StatusRow(props: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide">{props.label}</dt>
      <dd className="mt-1 break-all font-mono text-xs" data-testid={`adjustment-${slugify(props.label)}`}>
        {props.value ?? 'NOT_PROVEN'}
      </dd>
    </div>
  );
}

function readAdjustmentType(value: string): WarehouseStockAdjustmentSourceType {
  return sourceTypes.has(value as WarehouseStockAdjustmentSourceType)
    ? (value as WarehouseStockAdjustmentSourceType)
    : 'cycle_count';
}

function readReason(value: string): AdjustmentReason {
  return reasons.has(value as AdjustmentReason)
    ? (value as AdjustmentReason)
    : AdjustmentReason.CYCLE_COUNT;
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
