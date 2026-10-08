import { randomUUID } from 'crypto';

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { HospitalityPropertyRoomRepository, type HospitalitySqlClient } from '../repositories/property-room.repository';
import { HospitalityGuestReservationRepository } from '../repositories/guest-reservation.repository';
import { HospitalityFrontOfficeStayRepository } from '../repositories/front-office-stay.repository';
import { HospitalityFolioPaymentRepository } from '../repositories/folio-payment.repository';
import { HospitalityPropertyRoomService } from '../services/property-room.service';
import { HospitalityGuestReservationService } from '../services/guest-reservation.service';
import { HospitalityFrontOfficeStayService } from '../services/front-office-stay.service';
import { HospitalityFolioPaymentService } from '../services/folio-payment.service';
import type { HospitalityPropertyRoomFoundation } from '../types/property-room.types';
import type { HospitalityGuestReservation } from '../types/guest-reservation.types';
import type { HospitalityFrontOfficeStay } from '../types/front-office-stay.types';
import type {
  ConfirmedPaymentInvoiceReceivableAllocationInput,
  ConfirmedPaymentReceivableAllocationInput,
  ConfirmedPaymentReceivableAllocationResult,
  ISemanticReceivableChargeContract,
  PaymentReceivableAllocationInput,
  PaymentReceivableAllocationResult,
  SemanticReceivableChargeResult,
  ServiceReceivableChargeInput,
  TuitionServiceRecognizedChargeInput,
} from '@/platform/finance/contracts';

jest.setTimeout(120_000);

const dbUrl =
  process.env.DATABASE_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || '';

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

const describeWithRealDb = isRunnableDbUrl(dbUrl) ? describe : describe.skip;

type PgRows<Row extends Record<string, unknown>> = {
  readonly rows: Row[];
};

type CountRow = {
  readonly count: number;
};

type FolioVisibilityRow = {
  readonly id: string;
  readonly tenant_id: string;
};

class PgHospitalitySqlClient implements HospitalitySqlClient {
  constructor(private readonly client: Client) {}

  async query<Row extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<PgRows<Row>> {
    const result = await this.client.query<Row & QueryResultRow>(sql, values ? [...values] : undefined);
    return { rows: result.rows };
  }
}

class FakeFinanceContract implements ISemanticReceivableChargeContract {
  readonly serviceReceivableCalls: ServiceReceivableChargeInput[] = [];
  readonly invoicePaymentCalls: ConfirmedPaymentInvoiceReceivableAllocationInput[] = [];

  async recognizeServiceReceivable(
    input: ServiceReceivableChargeInput
  ): Promise<SemanticReceivableChargeResult> {
    this.serviceReceivableCalls.push(input);
    return {
      invoiceId: randomUUID(),
      invoiceNumber: `FRC-HOSP-${this.serviceReceivableCalls.length}`,
      transactionId: randomUUID(),
      receivableLedgerEntryCount: 1,
      receivablePositionId: randomUUID(),
      transactionLineCount: 2,
      duplicate: false,
      policyEvidence: {
        legalSource: '99/2025/TT-BTC',
        effectiveFrom: '2026-01-01',
        applicableRegime: 'VI_TT99_2025',
        businessSemantic: 'SERVICE_RECEIVABLE_RECOGNIZED',
        verificationStatus: 'PROVEN',
      },
    };
  }

  async recognizeTuitionServiceReceivable(
    _input: TuitionServiceRecognizedChargeInput
  ): Promise<SemanticReceivableChargeResult> {
    throw new Error('not used by Hospitality folio');
  }

  async allocatePaymentToReceivable(
    _input: PaymentReceivableAllocationInput
  ): Promise<PaymentReceivableAllocationResult> {
    throw new Error('not used by Hospitality folio');
  }

  async allocateConfirmedPaymentToReceivables(
    _input: ConfirmedPaymentReceivableAllocationInput
  ): Promise<ConfirmedPaymentReceivableAllocationResult> {
    throw new Error('not used by Hospitality folio');
  }

  async allocateConfirmedPaymentToInvoiceReceivable(
    input: ConfirmedPaymentInvoiceReceivableAllocationInput
  ): Promise<ConfirmedPaymentReceivableAllocationResult> {
    this.invoicePaymentCalls.push(input);
    const cashMovementId = randomUUID();
    return {
      transactionId: randomUUID(),
      cashMovementId,
      allocatedAmountMinor: input.amountMinor,
      duplicate: false,
      allocations: [{
        invoiceId: input.invoiceId,
        receivablePositionId: randomUUID(),
        cashMovementId,
        allocationId: randomUUID(),
        allocatedAmountMinor: input.amountMinor,
        duplicate: false,
      }],
    };
  }
}

async function queryAsTenant<Row extends Record<string, unknown>>(
  tenantId: string,
  sql: string,
  values?: readonly unknown[]
): Promise<Row[]> {
  const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
  const userId = `hospitality-proof-${tenantId}`;
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: {
      tenant_id: tenantId,
      role: 'admin',
    },
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query('SET LOCAL row_security = on');
    await client.query(
      `
        SELECT
          set_config('request.jwt.claim.sub', $1, true),
          set_config('request.jwt.claim.role', 'authenticated', true),
          set_config('request.jwt.claims', $2, true),
          set_config('app.current_tenant_id', $3, true)
      `,
      [userId, claims, tenantId]
    );
    const result = await client.query<Row & QueryResultRow>(sql, values ? [...values] : undefined);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

describeWithRealDb('Hospitality Phase 4 Folio + Payment Real DB proof', () => {
  let client: Client;
  let propertyService: HospitalityPropertyRoomService;
  let reservationService: HospitalityGuestReservationService;
  let frontOfficeService: HospitalityFrontOfficeStayService;
  let folioService: HospitalityFolioPaymentService;
  let finance: FakeFinanceContract;
  let tenantAId = '';
  let tenantBId = '';

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    const sqlClient = new PgHospitalitySqlClient(client);
    propertyService = new HospitalityPropertyRoomService(
      new HospitalityPropertyRoomRepository(sqlClient)
    );
    reservationService = new HospitalityGuestReservationService(
      new HospitalityGuestReservationRepository(sqlClient)
    );
    frontOfficeService = new HospitalityFrontOfficeStayService(
      new HospitalityFrontOfficeStayRepository(sqlClient)
    );
    finance = new FakeFinanceContract();
    folioService = new HospitalityFolioPaymentService(
      new HospitalityFolioPaymentRepository(sqlClient),
      finance
    );

    tenantAId = randomUUID();
    tenantBId = randomUUID();

    await cleanupHospitalityRows();

    await client.query(
      `
        INSERT INTO public.tenants (id, name, status, product_key)
        VALUES
          ($1, $2, 'active', 'bella_hospitality'),
          ($3, $4, 'active', 'bella_hospitality')
      `,
      [
        tenantAId,
        `Hospitality Phase4 Tenant A ${Date.now()}`,
        tenantBId,
        `Hospitality Phase4 Tenant B ${Date.now()}`,
      ]
    );
  });

  afterAll(async () => {
    if (client) {
      try {
        await cleanupHospitalityRows();
        await assertNoHospitalityRowsRemain();
      } finally {
        await client.end();
      }
    }
  });

  async function cleanupHospitalityRows(): Promise<void> {
    await client.query('SET row_security = off');

    await client.query(
      'DELETE FROM public.hospitality_folio_payment_applications WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_folio_finance_links WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_folio_items WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_folios WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_room_occupancies WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_stays WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_reservation_rooms WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_reservations WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_guests WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_rooms WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_room_types WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_floors WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_buildings WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_properties WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
  }

  async function assertNoHospitalityRowsRemain(): Promise<void> {
    const tableNames = [
      'hospitality_folio_payment_applications',
      'hospitality_folio_finance_links',
      'hospitality_folio_items',
      'hospitality_folios',
      'hospitality_room_occupancies',
      'hospitality_stays',
      'hospitality_reservation_rooms',
      'hospitality_reservations',
      'hospitality_guests',
      'hospitality_rooms',
      'hospitality_room_types',
      'hospitality_floors',
      'hospitality_buildings',
      'hospitality_properties',
    ] as const;

    for (const tableName of tableNames) {
      const result = await client.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantAId, tenantBId]]
      );
      expect(result.rows[0]?.count).toBe(0);
    }
  }

  async function seedParty(tenantId: string, displayName: string): Promise<string> {
    const partyId = randomUUID();
    await client.query(
      `
        INSERT INTO public.party_parties (id, tenant_id, party_type, display_name)
        VALUES ($1::uuid, $2::uuid, 'person', $3)
      `,
      [partyId, tenantId, displayName]
    );
    return partyId;
  }

  async function createFoundation(label: string): Promise<HospitalityPropertyRoomFoundation> {
    const suffix = `${Date.now()}-${label}`;
    return propertyService.createPropertyRoomFoundation({
      tenantId: tenantAId,
      property: {
        code: `PROP-P4-${suffix}`,
        name: `Bella Phase4 Hotel ${label}`,
        propertyType: 'hotel',
      },
      building: {
        code: `BLD-P4-${label}`,
        name: `Tower P4 ${label}`,
      },
      floor: {
        floorNumber: 1,
        code: `L1-P4-${label}`,
        name: `Level 1 P4 ${label}`,
      },
      roomType: {
        code: `RT-P4-${label}`,
        name: `Room Type P4 ${label}`,
        maxOccupancy: 2,
        baseAdults: 2,
      },
      room: {
        roomNumber: `40${label}`,
        displayName: `Room P4 ${label}`,
      },
    });
  }

  async function createReservationChain(
    label: string,
    foundation: HospitalityPropertyRoomFoundation,
    checkInDate: string,
    checkOutDate: string
  ): Promise<HospitalityGuestReservation> {
    const partyId = await seedParty(tenantAId, `Phase4 Guest ${label}`);
    return reservationService.createGuestReservation({
      tenantId: tenantAId,
      propertyId: foundation.property.id,
      guest: { partyId },
      reservation: {
        reservationCode: `RSV-P4-${Date.now()}-${label}`,
        checkInDate,
        checkOutDate,
        adults: 1,
      },
      reservedRoom: {
        roomTypeId: foundation.roomType.id,
        roomId: foundation.room.id,
      },
    });
  }

  async function checkInReservation(
    reservationChain: HospitalityGuestReservation
  ): Promise<HospitalityFrontOfficeStay> {
    return frontOfficeService.checkIn({
      tenantId: tenantAId,
      propertyId: reservationChain.reservation.propertyId,
      reservationId: reservationChain.reservation.id,
      guestId: reservationChain.guest.id,
      reservationRoomId: reservationChain.reservedRoom.id,
      roomId: reservationChain.reservedRoom.roomId,
      checkedInAt: `${reservationChain.reservation.checkInDate}T08:00:00.000Z`,
    });
  }

  async function createActiveStay(
    label: string,
    checkInDate: string,
    checkOutDate: string
  ): Promise<{
    readonly foundation: HospitalityPropertyRoomFoundation;
    readonly reservationChain: HospitalityGuestReservation;
    readonly frontOffice: HospitalityFrontOfficeStay;
  }> {
    const foundation = await createFoundation(label);
    const reservationChain = await createReservationChain(label, foundation, checkInDate, checkOutDate);
    const frontOffice = await checkInReservation(reservationChain);
    return { foundation, reservationChain, frontOffice };
  }

  it('posts room charge, records Finance receivable link, applies payment, and settles folio', async () => {
    const { frontOffice } = await createActiveStay('A', '2027-06-01', '2027-06-03');
    const folio = await folioService.openFolio({
      tenantId: tenantAId,
      propertyId: frontOffice.stay.propertyId,
      stayId: frontOffice.stay.id,
      guestId: frontOffice.stay.guestId,
      currency: 'VND',
    });

    const charge = await folioService.postRoomCharge({
      tenantId: tenantAId,
      folioId: folio.id,
      amountMinor: 2_400_000,
      currency: 'VND',
      servicePeriodStart: '2027-06-01',
      servicePeriodEnd: '2027-06-03',
      recognitionDate: '2027-06-03',
      dueDate: '2027-06-03',
      description: 'Room charge Phase 4',
    });

    expect(charge.item.status).toBe('posted');
    expect(charge.financeLink.status).toBe('recognized');
    expect(charge.folio.outstandingAmountMinor).toBe(2_400_000);
    expect(finance.serviceReceivableCalls.at(-1)).toMatchObject({
      tenantId: tenantAId,
      amountMinor: 2_400_000,
      businessSourceType: 'HOSPITALITY_FOLIO_ITEM',
      businessSourceId: charge.item.id,
      businessSemantic: 'SERVICE_RECEIVABLE_RECOGNIZED',
    });

    const payment = await folioService.applyPaymentToFolio({
      tenantId: tenantAId,
      folioId: folio.id,
      amountMinor: 2_400_000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt: '2027-06-03T10:00:00.000Z',
      idempotencyKey: `p4-pay-${charge.item.id}`,
    });

    expect(payment.folio.status).toBe('settled');
    expect(payment.folio.outstandingAmountMinor).toBe(0);
    expect(payment.application.status).toBe('applied');
    expect(finance.invoicePaymentCalls.at(-1)).toMatchObject({
      tenantId: tenantAId,
      invoiceId: charge.financeLink.financeInvoiceId,
      paymentSourceType: 'HOSPITALITY_FOLIO_PAYMENT_APPLICATION',
      amountMinor: 2_400_000,
    });
  });

  it('closes only a settled folio', async () => {
    const { frontOffice } = await createActiveStay('B', '2027-07-01', '2027-07-02');
    const folio = await folioService.openFolio({
      tenantId: tenantAId,
      propertyId: frontOffice.stay.propertyId,
      stayId: frontOffice.stay.id,
      guestId: frontOffice.stay.guestId,
    });
    await folioService.postRoomCharge({
      tenantId: tenantAId,
      folioId: folio.id,
      amountMinor: 900_000,
      currency: 'VND',
      servicePeriodStart: '2027-07-01',
      servicePeriodEnd: '2027-07-02',
      recognitionDate: '2027-07-02',
      dueDate: '2027-07-02',
      description: 'One night room charge',
    });
    await folioService.applyPaymentToFolio({
      tenantId: tenantAId,
      folioId: folio.id,
      amountMinor: 900_000,
      currency: 'VND',
      paymentMethod: 'cash',
      receivedAt: '2027-07-02T04:00:00.000Z',
      idempotencyKey: `p4-close-${folio.id}`,
    });

    const closed = await folioService.closeSettledFolio({
      tenantId: tenantAId,
      folioId: folio.id,
      closedAt: '2027-07-02T05:00:00.000Z',
    });

    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBe('2027-07-02T05:00:00.000Z');
  });

  it('rejects overpayment and leaves no payment application row', async () => {
    const { frontOffice } = await createActiveStay('C', '2027-08-01', '2027-08-03');
    const folio = await folioService.openFolio({
      tenantId: tenantAId,
      propertyId: frontOffice.stay.propertyId,
      stayId: frontOffice.stay.id,
      guestId: frontOffice.stay.guestId,
    });
    await folioService.postRoomCharge({
      tenantId: tenantAId,
      folioId: folio.id,
      amountMinor: 1_500_000,
      currency: 'VND',
      servicePeriodStart: '2027-08-01',
      servicePeriodEnd: '2027-08-03',
      recognitionDate: '2027-08-03',
      dueDate: '2027-08-03',
      description: 'Room charge overpayment guard',
    });

    await expect(folioService.applyPaymentToFolio({
      tenantId: tenantAId,
      folioId: folio.id,
      amountMinor: 1_500_001,
      currency: 'VND',
      paymentMethod: 'cash',
      receivedAt: '2027-08-03T10:00:00.000Z',
      idempotencyKey: `p4-overpay-${folio.id}`,
    })).rejects.toThrow('HOSPITALITY_FOLIO_PAYMENT_EXCEEDS_OUTSTANDING');

    const applicationCount = await client.query<CountRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM public.hospitality_folio_payment_applications
        WHERE tenant_id = $1::uuid
          AND folio_id = $2::uuid
      `,
      [tenantAId, folio.id]
    );
    expect(applicationCount.rows[0]?.count).toBe(0);
  });

  it('enforces RLS same-tenant visibility and cross-tenant invisibility for folios', async () => {
    const { frontOffice } = await createActiveStay('D', '2027-09-01', '2027-09-02');
    const folio = await folioService.openFolio({
      tenantId: tenantAId,
      propertyId: frontOffice.stay.propertyId,
      stayId: frontOffice.stay.id,
      guestId: frontOffice.stay.guestId,
    });

    const sameTenantRows = await queryAsTenant<FolioVisibilityRow>(
      tenantAId,
      'SELECT id, tenant_id FROM public.hospitality_folios WHERE id = $1',
      [folio.id]
    );
    const crossTenantRows = await queryAsTenant<FolioVisibilityRow>(
      tenantBId,
      'SELECT id, tenant_id FROM public.hospitality_folios WHERE id = $1',
      [folio.id]
    );

    expect(sameTenantRows).toHaveLength(1);
    expect(sameTenantRows[0].tenant_id).toBe(tenantAId);
    expect(crossTenantRows).toHaveLength(0);
  });
});
