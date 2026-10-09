import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  Play,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

import {
  executeHospitalityHotelCoreChainAction,
  type HospitalityHotelCoreChainActionInput,
} from '@/services/hospitality-hotel-core-chain-actions';
import { getCurrentUser } from '@/services/user-actions';

export const dynamic = 'force-dynamic';

const HOTEL_CORE_CHAIN_ROUTE = '/hospitality/hotel-core-chain';

interface HotelCoreChainPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HotelCoreChainPage({ searchParams }: HotelCoreChainPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(HOTEL_CORE_CHAIN_ROUTE)}`);
  }

  const params = await searchParams;
  const status = readParam(params, 'status');
  const error = readParam(params, 'error');
  const hasProof = status === 'success';
  const evidence = readOperationalEvidence(params, hasProof);

  return (
    <main className="min-h-screen bg-[#F6F7F4] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700">
              Bella Hospitality
            </p>
            <h1 className="mt-2 text-3xl font-bold">Hotel Operations Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Dashboard vận hành khách sạn dựa trên Hotel Core chain đã có. Mọi số liệu chưa
              được action hiện tại chứng minh sẽ giữ trạng thái NOT_PROVEN.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <EvidencePill icon={ShieldCheck} label="Product" value={evidence.product} proven={hasProof} />
            <EvidencePill icon={Building2} label="Tenant/RLS" value={hasProof ? 'SCOPED' : 'NOT_PROVEN'} proven={hasProof} />
          </div>
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

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            data-testid="hotel-operations-dashboard"
          >
            <KpiCard icon={DoorOpen} label="Phòng trống" value={hasProof ? '1' : 'NOT_PROVEN'} detail="Room foundation active" tone="emerald" />
            <KpiCard icon={BedDouble} label="Đang lưu trú" value={evidence.occupancy === 'occupied' ? '1' : '0'} detail={`Occupancy: ${evidence.occupancy}`} tone="blue" />
            <KpiCard icon={Sparkles} label="Cần dọn" value={hasProof ? '1' : 'NOT_PROVEN'} detail="Sau checkout cần housekeeping proof riêng" tone="amber" />
            <KpiCard icon={CalendarCheck} label="Đặt phòng" value={hasProof ? '1' : 'NOT_PROVEN'} detail={`Reservation: ${shortId(evidence.reservation)}`} tone="slate" />
          </div>

          <form
            action={submitHotelCoreChain}
            className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            data-testid="hotel-core-chain-form"
          >
            <div>
              <h2 className="text-base font-bold">Chạy proof đặt phòng</h2>
              <p className="mt-1 text-sm text-slate-600">
                Tạo chuỗi phòng, khách, đặt phòng, nhận phòng, folio, thanh toán và trả phòng qua contract hiện có.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
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
              className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              data-testid="hotel-core-chain-submit"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Run Hotel Core chain
            </button>
          </form>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Panel
            title="Phòng và đặt phòng"
            description="Danh sách vận hành từ proof room/reservation hiện có."
            testId="hotel-operations-room-reservation"
          >
            <RoomRow
              room={shortId(evidence.room)}
              roomStatus={hasProof ? 'active' : 'NOT_PROVEN'}
              reservation={shortId(evidence.reservation)}
              occupancy={evidence.occupancy}
              folio={evidence.folio}
            />
            <FlowStep
              icon={Building2}
              title="Tài sản và phòng"
              status={hasProof ? 'PROVEN' : 'NOT_PROVEN'}
              detail={`Room ID: ${evidence.room}`}
            />
            <FlowStep
              icon={CalendarCheck}
              title="Khách và đặt phòng"
              status={hasProof ? 'PROVEN' : 'NOT_PROVEN'}
              detail={`Reservation ID: ${evidence.reservation}`}
            />
          </Panel>

          <Panel
            title="Lễ tân và thanh toán"
            description="Nhận phòng -> lưu trú -> folio -> thanh toán -> trả phòng."
            testId="hotel-operations-front-office-folio"
          >
            <FlowStep icon={DoorOpen} title="Nhận phòng" status={evidence.stay} detail={`Stay: ${evidence.stay}`} />
            <FlowStep icon={ReceiptText} title="Folio" status={evidence.folio} detail={`Outstanding: ${evidence.outstanding}`} />
            <FlowStep icon={CreditCard} title="Thanh toán" status={evidence.payment} detail={`Finance: ${shortId(evidence.finance)}`} />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Buồng phòng"
            description="Chỉ hiển thị trạng thái đã được suy ra từ checkout; task dọn phòng cần proof riêng."
            testId="hotel-operations-housekeeping"
          >
            <FlowStep
              icon={Sparkles}
              title="Phòng sau trả phòng"
              status={hasProof ? 'DIRTY_CANDIDATE' : 'NOT_PROVEN'}
              detail="Không tự đánh dấu phòng sẵn sàng bán khi chưa có housekeeping completion."
            />
            <FlowStep
              icon={ClipboardCheck}
              title="Nghiệm thu dọn phòng"
              status="NOT_PROVEN"
              detail="Cần luồng Housekeeping contract riêng trước khi PASS."
            />
          </Panel>

          <Panel
            title="Bảo trì"
            description="Bảo trì được tách khỏi quyền mở bán phòng."
            testId="hotel-operations-maintenance"
          >
            <FlowStep
              icon={Wrench}
              title="Sự cố thiết bị"
              status="NOT_PROVEN"
              detail="Không có maintenance request trong Hotel Core action hiện tại."
            />
            <FlowStep
              icon={ArrowRight}
              title="Trả phòng về kinh doanh"
              status="BLOCKED_BY_HOUSEKEEPING_PROOF"
              detail="Maintenance không tự chuyển phòng sang available."
            />
          </Panel>
        </section>
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
  redirectParams.set('room', result.value.roomId);
  redirectParams.set('reservation', result.value.reservationId);
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

function KpiCard(props: {
  icon: typeof DoorOpen;
  label: string;
  value: string;
  detail: string;
  tone: 'emerald' | 'blue' | 'amber' | 'slate';
}) {
  const Icon = props.icon;
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }[props.tone];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${toneClass}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">{props.label}</p>
      <p className="mt-1 break-words text-2xl font-bold text-slate-950">{props.value}</p>
      <p className="mt-2 text-xs text-slate-500">{props.detail}</p>
    </article>
  );
}

function Panel(props: {
  title: string;
  description: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      data-testid={props.testId}
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold">{props.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{props.description}</p>
      </div>
      <div className="grid gap-3">{props.children}</div>
    </section>
  );
}

function RoomRow(props: {
  room: string;
  roomStatus: string;
  reservation: string;
  occupancy: string;
  folio: string;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
      <RoomCell label="Phòng" value={props.room} />
      <RoomCell label="Trạng thái" value={props.roomStatus} />
      <RoomCell label="Đặt phòng" value={props.reservation} />
      <RoomCell label="Lưu trú" value={props.occupancy} />
      <RoomCell label="Folio" value={props.folio} />
    </div>
  );
}

function RoomCell(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{props.label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{props.value}</p>
    </div>
  );
}

function FlowStep(props: {
  icon: typeof DoorOpen;
  title: string;
  status: string;
  detail: string;
}) {
  const Icon = props.icon;

  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-950">{props.title}</p>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
            {props.status}
          </span>
        </div>
        <p className="mt-1 break-words text-sm text-slate-600">{props.detail}</p>
      </div>
    </div>
  );
}

function EvidencePill(props: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  proven: boolean;
}) {
  const Icon = props.icon;

  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 ${
      props.proven
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-slate-200 bg-white text-slate-600'
    }`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {props.label}: {props.value}
    </span>
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

function readOperationalEvidence(
  params: Record<string, string | string[] | undefined> | undefined,
  hasProof: boolean
) {
  const folio = readParam(params, 'folio') ?? 'NOT_PROVEN';
  const [folioStatus, outstanding] = folio.includes(':')
    ? folio.split(':', 2)
    : [folio, 'NOT_PROVEN'];
  const payment = readParam(params, 'payment') ?? 'NOT_PROVEN';
  const [, paid] = payment.includes(':')
    ? payment.split(':', 2)
    : ['NOT_PROVEN', 'NOT_PROVEN'];

  return {
    product: readParam(params, 'product') ?? 'NOT_PROVEN',
    room: readParam(params, 'room') ?? 'NOT_PROVEN',
    reservation: readParam(params, 'reservation') ?? 'NOT_PROVEN',
    stay: readParam(params, 'stay') ?? 'NOT_PROVEN',
    occupancy: readParam(params, 'occupancy') ?? 'NOT_PROVEN',
    folio: hasProof ? folioStatus : 'NOT_PROVEN',
    outstanding: hasProof ? outstanding : 'NOT_PROVEN',
    finance: readParam(params, 'finance') ?? 'NOT_PROVEN',
    payment: hasProof ? paid : 'NOT_PROVEN',
  };
}

function shortId(value: string): string {
  if (value === 'NOT_PROVEN') return value;
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
